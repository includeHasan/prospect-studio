#!/usr/bin/env node
/**
 * lead-agent Web Scraper MCP Server
 * HTTP fetch + cheerio scraping with Playwright MCP fallback hints.
 * Ported from .opencode/plugins/web-scraper.ts
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

// ── Constants ──────────────────────────────────────────────────────────────────

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

const DEFAULT_TIMEOUT_MS = 12000;
const MAX_BODY_BYTES = 500_000;
const THIN_CONTENT_WORDS = 45;
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

// ── Helpers ────────────────────────────────────────────────────────────────────

const randomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeUrl(url) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : "https://" + url;
}

function extractDomain(url) {
  try { return new URL(normalizeUrl(url)).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function playwrightInstructions(url) {
  const u = normalizeUrl(url);
  return [
    `### Use Playwright MCP — no local Chromium needed`,
    `HTTP fetch returned thin or blocked content. Continue with Playwright MCP:`,
    `1. \`navigate_page\` → \`${u}\``,
    `2. Wait for real content to load (handle any challenge if needed)`,
    `3. \`take_snapshot\` or \`evaluate_script\` to extract visible text`,
    `4. Merge result into the lead profile`,
    `*Do not use for LinkedIn (ToS).*`,
  ].join("\n");
}

function saveToFile(content, relPath) {
  const absPath = join(WORKSPACE_ROOT, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content, "utf-8");
}

// ── HTTP Fetch ─────────────────────────────────────────────────────────────────

async function fetchPage(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(normalizeUrl(url), {
      signal: controller.signal,
      headers: {
        "User-Agent": randomUserAgent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return { error: `HTTP ${res.status} ${res.statusText}` };
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return { error: `Non-HTML content type: ${contentType}` };
    }
    const buffer = await res.arrayBuffer();
    const html = buffer.byteLength > MAX_BODY_BYTES
      ? Buffer.from(buffer).slice(0, MAX_BODY_BYTES).toString("utf-8")
      : Buffer.from(buffer).toString("utf-8");
    return { html, finalUrl: res.url, status: res.status };
  } catch (e) {
    clearTimeout(timer);
    return e.name === "AbortError"
      ? { error: `Request timed out after ${timeoutMs}ms` }
      : { error: e.message ?? "Unknown fetch error" };
  }
}

function looksLikeBotBlock(html) {
  const h = html.slice(0, 80_000).toLowerCase();
  return /cloudflare|checking your browser|cf-browser-verification|__cf_bm|challenge-platform|perimeterx|datadome|hcaptcha|recaptcha|attention required|just a moment|enable javascript|bot.?detection|pardon our interruption|access denied/i.test(h)
    || (/captcha/.test(h) && /verify|challenge|security check/i.test(h));
}

function needsPlaywright(parsed, html) {
  if (looksLikeBotBlock(html)) return true;
  if (parsed.wordCount < THIN_CONTENT_WORDS && html.length > 1200) return true;
  return /just a moment|checking your browser|please wait|enable javascript|loading\.\.\./i.test(
    (parsed.title + " " + html.slice(0, 4000)).toLowerCase()
  );
}

function fetchErrorSuggestsPlaywright(err) {
  return /403|401|429|503|forbidden|blocked|unavailable|timeout|timed out|ECONNRESET|non-html/i.test(err);
}

async function fetchForScrape(url) {
  const r = await fetchPage(url);
  if ("error" in r) return { error: r.error, suggestPlaywright: fetchErrorSuggestsPlaywright(r.error) };
  const parsed = parsePage(r.html, r.finalUrl);
  return { html: r.html, finalUrl: r.finalUrl, status: r.status, needsPlaywright: needsPlaywright(parsed, r.html) };
}

// ── Page Parsing ───────────────────────────────────────────────────────────────

function parsePage(html, pageUrl) {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header, .nav, .footer, .header, .cookie, .banner, .popup, .modal, iframe, svg").remove();

  const title = $("title").first().text().trim() || $("h1").first().text().trim();
  const description = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";
  const keywords = $('meta[name="keywords"]').attr("content") || "";

  const headings = [];
  $("h1, h2, h3").each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > 2 && t.length < 200) headings.push(t);
  });

  let mainEl = $("main, article, [role='main'], .content, #content, .main, #main");
  if (!mainEl.length) mainEl = $("body");
  const rawText = mainEl.text().replace(/\s+/g, " ").trim();
  const mainText = rawText.length > 4000 ? rawText.slice(0, 4000) + "…" : rawText;

  const emailRx = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const emails = [...new Set(html.match(emailRx) || [])]
    .filter((e) => !e.includes(".png") && !e.includes(".jpg") && !e.endsWith(".js")
      && !e.includes("example.com") && !e.includes("sentry.io") && !e.includes("@2x")
      && e.split("@")[0].length >= 2)
    .slice(0, 10);

  const phones = [...new Set((html.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []))].slice(0, 5);

  const socialLinks = {};
  const socialPatterns = {
    linkedin: /linkedin\.com\/(?:company|in)\//,
    twitter: /(?:twitter|x)\.com\//,
    facebook: /facebook\.com\//,
    instagram: /instagram\.com\//,
    youtube: /youtube\.com\//,
    github: /github\.com\//,
    crunchbase: /crunchbase\.com\//,
  };
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    for (const [net, pat] of Object.entries(socialPatterns)) {
      if (pat.test(href) && !socialLinks[net]) {
        socialLinks[net] = href.startsWith("http") ? href : `https://${extractDomain(pageUrl)}${href}`;
      }
    }
  });

  const baseDomain = extractDomain(pageUrl);
  const internalLinks = [], externalLinks = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const abs = href.startsWith("http") ? href : new URL(href, normalizeUrl(pageUrl)).href;
      if (abs.includes(baseDomain)) { if (!internalLinks.includes(abs)) internalLinks.push(abs); }
      else { if (!externalLinks.includes(abs)) externalLinks.push(abs); }
    } catch { /* skip malformed */ }
  });

  const techHints = [];
  const techPatterns = {
    "WordPress": /wp-content|wp-includes/, "Shopify": /cdn\.shopify\.com/,
    "Webflow": /webflow\.com/, "HubSpot": /hs-scripts\.com|hubspot\.com/,
    "Salesforce": /salesforce\.com|force\.com/, "Intercom": /intercom\.io/,
    "Zendesk": /zendesk\.com/, "Stripe": /stripe\.com/,
    "Google Analytics": /google-analytics\.com|gtag\/js/,
    "Segment": /segment\.com|analytics\.js/,
    "Next.js": /__next|_next\/static/, "React": /react\.production\.min\.js|react-dom/,
    "Vue": /vue\.min\.js/, "Angular": /angular\.min\.js/,
    "Wix": /wix\.com/, "Squarespace": /squarespace\.com/,
  };
  for (const [tech, pat] of Object.entries(techPatterns)) {
    if (pat.test(html)) techHints.push(tech);
  }

  return {
    url: pageUrl, title, description, keywords,
    headings: headings.slice(0, 15), mainText,
    wordCount: rawText.split(/\s+/).filter(Boolean).length,
    emails, phones, socialLinks,
    internalLinks: internalLinks.slice(0, 20),
    externalLinks: externalLinks.slice(0, 10),
    techHints,
  };
}

function formatParsedPage(p, showLinks = false) {
  const lines = [
    `## ${p.title || "(no title)"}`,
    `**URL**: ${p.url}`,
    p.description ? `**Description**: ${p.description}` : "",
    p.keywords ? `**Keywords**: ${p.keywords}` : "",
    `**Words**: ~${p.wordCount}`, "",
  ];
  if (p.headings.length) { lines.push("### Headings"); p.headings.forEach((h) => lines.push(`- ${h}`)); lines.push(""); }
  if (p.mainText) { lines.push("### Content", p.mainText, ""); }
  if (p.emails.length) { lines.push("### Emails Found"); p.emails.forEach((e) => lines.push(`- ${e}`)); lines.push(""); }
  if (p.phones.length) { lines.push("### Phone Numbers"); p.phones.forEach((ph) => lines.push(`- ${ph}`)); lines.push(""); }
  if (Object.keys(p.socialLinks).length) {
    lines.push("### Social Links");
    for (const [net, url] of Object.entries(p.socialLinks)) lines.push(`- **${net}**: ${url}`);
    lines.push("");
  }
  if (p.techHints.length) { lines.push("### Technology Stack", p.techHints.join(", "), ""); }
  if (showLinks && p.internalLinks.length) {
    lines.push("### Internal Links (sample)");
    p.internalLinks.slice(0, 10).forEach((l) => lines.push(`- ${l}`));
    lines.push("");
  }
  return lines.filter((l) => l !== undefined).join("\n");
}

// ── MCP Server ─────────────────────────────────────────────────────────────────

const server = new McpServer({ name: "web-scraper", version: "1.0.0" });

// ── Tool: scrape_url ───────────────────────────────────────────────────────────

server.tool(
  "scrape_url",
  "Fetch and parse a single webpage via HTTP + cheerio (no local browser). Returns title, description, headings, main text, emails, phones, social links, and tech stack. Flags bot-blocked pages and provides Playwright MCP fallback instructions.",
  {
    url: z.string().describe("Full URL to scrape (e.g. https://acme.com/about)"),
    showLinks: z.boolean().optional().describe("Include internal and external links in output"),
    saveToFile: z.string().optional().describe("Relative path to save output as markdown (e.g. research/acme-about.md)"),
    skipPlaywrightHint: z.boolean().optional().describe("Omit Playwright MCP instructions even when content looks thin or blocked"),
  },
  async ({ url, showLinks, saveToFile: savePath, skipPlaywrightHint }) => {
    const result = await fetchForScrape(url);
    if ("error" in result) {
      let msg = `Failed to fetch ${url}: ${result.error}`;
      if (result.suggestPlaywright) msg += "\n\n---\n" + playwrightInstructions(url);
      return { content: [{ type: "text", text: msg }] };
    }
    const parsed = parsePage(result.html, result.finalUrl);
    let output = formatParsedPage(parsed, showLinks ?? false);
    output += `\n\n---\n*Engine: HTTP fetch + cheerio (no local Chromium)*`;
    if (!skipPlaywrightHint && result.needsPlaywright) {
      output += "\n\n---\n" + playwrightInstructions(result.finalUrl);
    }
    if (savePath) { saveToFile(output, savePath); output += `\n\n*Saved to: ${savePath}*`; }
    return { content: [{ type: "text", text: output }] };
  }
);

// ── Tool: scrape_company_intel ─────────────────────────────────────────────────

server.tool(
  "scrape_company_intel",
  "Auto-scrape multiple pages of a company website (home, about, pricing, team, contact). Aggregates all emails, phones, social profiles, and tech stack signals. HTTP fetch only — flags pages needing Playwright MCP.",
  {
    domain: z.string().describe("Company domain without protocol (e.g. acme.com or www.acme.com)"),
    pages: z.array(z.string()).optional().describe("Page paths to scrape (defaults to home/about/pricing/team/contact pages)"),
    saveToFile: z.string().optional().describe("Save report to relative path (e.g. research/acme-intel.md)"),
    delayMs: z.number().optional().describe("Delay between requests in ms (default 1200, min 500)"),
    skipPlaywrightHint: z.boolean().optional().describe("Omit Playwright MCP section at the end"),
  },
  async ({ domain, pages, saveToFile: savePath, delayMs, skipPlaywrightHint }) => {
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const baseUrl = `https://${cleanDomain}`;
    const delay = Math.max(500, delayMs ?? 1200);
    const paths = pages?.length ? pages : ["/", "/about", "/about-us", "/company", "/pricing", "/pricing-plans", "/team", "/contact", "/contact-us"];

    const sections = [`# Company Intel: ${cleanDomain}`, `**Scraped**: ${new Date().toISOString().slice(0, 10)}`, `**Source**: Direct website scrape`, ""];
    const allEmails = new Set(), allPhones = new Set(), allSocial = {}, allTech = new Set();
    const successPages = [], mcpUrls = [];

    for (let i = 0; i < paths.length; i++) {
      const pagePath = paths[i];
      const pageUrl = pagePath.startsWith("http") ? pagePath : `${baseUrl}${pagePath.startsWith("/") ? pagePath : "/" + pagePath}`;
      if (i > 0) await sleep(delay);
      const result = await fetchForScrape(pageUrl);
      if ("error" in result) continue;
      if (result.needsPlaywright) mcpUrls.push(result.finalUrl);
      const parsed = parsePage(result.html, result.finalUrl);
      successPages.push(parsed.url);
      sections.push(`## Page: ${pagePath === "/" ? "Home" : pagePath}`, `**URL**: ${parsed.url}`);
      if (parsed.title) sections.push(`**Title**: ${parsed.title}`);
      if (parsed.description) sections.push(`**Description**: ${parsed.description}`);
      sections.push("");
      if (parsed.headings.length) { sections.push("**Key Sections**: " + parsed.headings.slice(0, 6).join(" · ")); sections.push(""); }
      if (parsed.mainText) { sections.push(parsed.mainText.slice(0, 1500) + (parsed.mainText.length > 1500 ? "…" : "")); sections.push(""); }
      parsed.emails.forEach((e) => allEmails.add(e));
      parsed.phones.forEach((p) => allPhones.add(p));
      Object.assign(allSocial, parsed.socialLinks);
      parsed.techHints.forEach((t) => allTech.add(t));
    }

    sections.push("---", "## Aggregated Findings", "");
    if (allEmails.size) { sections.push("### Contact Emails"); [...allEmails].forEach((e) => sections.push(`- ${e}`)); sections.push(""); }
    if (allPhones.size) { sections.push("### Phone Numbers"); [...allPhones].forEach((p) => sections.push(`- ${p}`)); sections.push(""); }
    if (Object.keys(allSocial).length) {
      sections.push("### Social Profiles");
      for (const [net, url] of Object.entries(allSocial)) sections.push(`- **${net}**: ${url}`);
      sections.push("");
    }
    if (allTech.size) { sections.push("### Technology Stack", [...allTech].join(", "), ""); }
    sections.push(`### Pages Scraped (${successPages.length})`);
    successPages.forEach((u) => sections.push(`- ${u}`));
    sections.push("");
    if (!skipPlaywrightHint && mcpUrls.length) {
      sections.push("### URLs Needing Playwright MCP", "HTTP-only returned thin/blocked content. Use `navigate_page` → `take_snapshot`:");
      [...new Set(mcpUrls)].forEach((u) => sections.push(`- ${u}`));
      sections.push("");
    }

    const output = sections.join("\n");
    if (savePath) { saveToFile(output, savePath); return { content: [{ type: "text", text: output + `\n\n*Saved to: ${savePath}*` }] }; }
    return { content: [{ type: "text", text: output }] };
  }
);

// ── Tool: find_contacts ────────────────────────────────────────────────────────

server.tool(
  "find_contacts",
  "Extract emails, phones, and social links from a domain or URL. Deep-scans /contact, /about, /team pages automatically. HTTP fetch + cheerio only — flags pages needing Playwright MCP.",
  {
    target: z.string().describe("URL or domain to extract contacts from (e.g. acme.com or https://acme.com/contact)"),
    deepScan: z.boolean().optional().describe("Also scan /contact, /about, /team pages automatically (default true)"),
  },
  async ({ target, deepScan = true }) => {
    const isFullUrl = target.startsWith("http://") || target.startsWith("https://") || target.includes("/");
    const urlsToScan = [];
    if (isFullUrl) {
      urlsToScan.push(normalizeUrl(target));
    } else {
      const base = `https://${target.replace(/^www\./, "")}`;
      urlsToScan.push(base);
      if (deepScan) urlsToScan.push(`${base}/contact`, `${base}/contact-us`, `${base}/about`, `${base}/team`);
    }

    const allEmails = new Set(), allPhones = new Set(), allSocial = {};
    const scannedUrls = [], mcpUrls = [];

    for (let i = 0; i < urlsToScan.length; i++) {
      if (i > 0) await sleep(800);
      const result = await fetchForScrape(urlsToScan[i]);
      if ("error" in result) continue;
      if (result.needsPlaywright) mcpUrls.push(result.finalUrl);
      const parsed = parsePage(result.html, result.finalUrl);
      scannedUrls.push(result.finalUrl);
      parsed.emails.forEach((e) => allEmails.add(e));
      parsed.phones.forEach((p) => allPhones.add(p));
      Object.assign(allSocial, parsed.socialLinks);
    }

    if (!allEmails.size && !allPhones.size && !Object.keys(allSocial).length) {
      let msg = `No contact information found on ${target}.\nPages scanned: ${scannedUrls.join(", ") || "none (all failed)"}\n`;
      if (mcpUrls.length) msg += `\n---\n` + playwrightInstructions(mcpUrls[0]);
      else msg += `\nThe site may use contact forms only, be JS-rendered, or block automated requests.\n\n---\n` + playwrightInstructions(scannedUrls[0] ?? normalizeUrl(target));
      return { content: [{ type: "text", text: msg }] };
    }

    const lines = [`## Contacts: ${extractDomain(target)}`, `**Scanned**: ${scannedUrls.length} page(s) (HTTP fetch)`, mcpUrls.length ? `**May need Playwright MCP**: ${[...new Set(mcpUrls)].join(", ")}` : "", ""].filter(Boolean);
    if (allEmails.size) { lines.push("### Email Addresses"); [...allEmails].forEach((e) => lines.push(`- \`${e}\``)); lines.push(""); }
    if (allPhones.size) { lines.push("### Phone Numbers"); [...allPhones].forEach((p) => lines.push(`- ${p}`)); lines.push(""); }
    if (Object.keys(allSocial).length) {
      lines.push("### Social Profiles");
      for (const [net, url] of Object.entries(allSocial)) lines.push(`- **${net}**: ${url}`);
      lines.push("");
    }
    lines.push("### Pages Scanned"); scannedUrls.forEach((u) => lines.push(`- ${u}`));
    if (mcpUrls.length) lines.push("\n---\n" + playwrightInstructions(mcpUrls[0]));
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ── Tool: batch_scrape ─────────────────────────────────────────────────────────

server.tool(
  "batch_scrape",
  "Scrape a list of URLs via HTTP fetch + cheerio (max 20). Marks rows needing Playwright MCP for JS-heavy or bot-walled content. Modes: summary (default), full, contacts-only.",
  {
    urls: z.array(z.string()).describe("URLs to scrape (max 20)"),
    mode: z.enum(["summary", "full", "contacts-only"]).optional().describe("Output mode: summary (default) | full | contacts-only"),
    delayMs: z.number().optional().describe("Delay between requests in ms (default 1500, min 500)"),
    saveToFile: z.string().optional().describe("Save combined report to relative path"),
    skipPlaywrightHint: z.boolean().optional().describe("Omit per-row Playwright MCP notes"),
  },
  async ({ urls, mode = "summary", delayMs, saveToFile: savePath, skipPlaywrightHint }) => {
    if (urls.length > 20) return { content: [{ type: "text", text: "Maximum 20 URLs per batch to avoid rate limiting. Split into smaller batches." }] };

    const delay = Math.max(500, delayMs ?? 1500);
    const sections = [`# Batch Scrape Report`, `**Date**: ${new Date().toISOString().slice(0, 10)}`, `**URLs**: ${urls.length} | **Mode**: ${mode}`, ""];
    let success = 0, fail = 0;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (i > 0) await sleep(delay);
      const result = await fetchForScrape(url);

      if ("error" in result) {
        sections.push(`## ❌ ${url}`, `Error: ${result.error}`);
        if (result.suggestPlaywright && !skipPlaywrightHint) sections.push(playwrightInstructions(normalizeUrl(url)));
        sections.push(""); fail++; continue;
      }

      const parsed = parsePage(result.html, result.finalUrl);
      success++;
      sections.push(`## ✅ ${parsed.title || extractDomain(url)}`, `**URL**: ${result.finalUrl}`);
      if (!skipPlaywrightHint && result.needsPlaywright) sections.push(`**⚠️ Playwright MCP**: Content looks thin or blocked — use navigate_page → take_snapshot`);

      if (mode === "contacts-only") {
        if (parsed.emails.length) sections.push(`**Emails**: ${parsed.emails.join(", ")}`);
        if (parsed.phones.length) sections.push(`**Phones**: ${parsed.phones.join(", ")}`);
        const soc = Object.entries(parsed.socialLinks).map(([n, u]) => `${n}: ${u}`).join(", ");
        if (soc) sections.push(`**Social**: ${soc}`);
      } else if (mode === "summary") {
        if (parsed.description) sections.push(`**Description**: ${parsed.description}`);
        if (parsed.headings.length) sections.push(`**Headings**: ${parsed.headings.slice(0, 4).join(" · ")}`);
        if (parsed.emails.length) sections.push(`**Emails**: ${parsed.emails.join(", ")}`);
        if (parsed.techHints.length) sections.push(`**Tech**: ${parsed.techHints.join(", ")}`);
        const soc = Object.entries(parsed.socialLinks).map(([n, u]) => `[${n}](${u})`).join(", ");
        if (soc) sections.push(`**Social**: ${soc}`);
      } else {
        sections.push(formatParsedPage(parsed, false));
      }
      sections.push("");
    }

    sections.push("---", `**Results**: ${success} succeeded · ${fail} failed out of ${urls.length}`);
    const output = sections.join("\n");
    if (savePath) { saveToFile(output, savePath); return { content: [{ type: "text", text: output + `\n\n*Saved to: ${savePath}*` }] }; }
    return { content: [{ type: "text", text: output }] };
  }
);

// ── Start ──────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
