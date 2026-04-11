#!/usr/bin/env node
/**
 * prospect-studio Frappe/ERPNext Lead MCP Server
 *
 * Ports the KStar OpenCode plugin to Claude Code MCP. Pushes prospect-studio
 * lead profiles into a Frappe/ERPNext `Lead` DocType via the REST API.
 *
 * Auth:  token <apiKey>:<apiSecret>   (Frappe standard)
 * Config (all via env, all optional with sensible defaults except credentials):
 *   FRAPPE_URL          — base URL of the Frappe site (no trailing slash)
 *   FRAPPE_API_KEY      — API key from Frappe user settings
 *   FRAPPE_API_SECRET   — API secret
 *   FRAPPE_LEAD_OWNER   — default lead_owner email for new leads
 *   WORKSPACE_ROOT      — absolute path to the user's prospect-studio workspace
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ── Config ──────────────────────────────────────────────────────────────────────

const FRAPPE_URL = (process.env.FRAPPE_URL || "").replace(/\/$/, "");
const FRAPPE_API_KEY = process.env.FRAPPE_API_KEY || "";
const FRAPPE_API_SECRET = process.env.FRAPPE_API_SECRET || "";
const FRAPPE_LEAD_OWNER = process.env.FRAPPE_LEAD_OWNER || "";
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

function authHeader() {
  return `token ${FRAPPE_API_KEY}:${FRAPPE_API_SECRET}`;
}

function configError() {
  const missing = [];
  if (!FRAPPE_URL) missing.push("FRAPPE_URL");
  if (!FRAPPE_API_KEY) missing.push("FRAPPE_API_KEY");
  if (!FRAPPE_API_SECRET) missing.push("FRAPPE_API_SECRET");
  if (missing.length === 0) return null;
  return (
    `Frappe MCP not configured — missing: ${missing.join(", ")}. ` +
    `Set them in plugin user config (frappe_url / frappe_api_key / frappe_api_secret) ` +
    `and re-run /reload-plugins.`
  );
}

// ── HTTP ────────────────────────────────────────────────────────────────────────

async function apiFetch(pathSuffix, init = {}) {
  const err = configError();
  if (err) return { ok: false, status: 0, body: err };

  const url = pathSuffix.startsWith("http")
    ? pathSuffix
    : `${FRAPPE_URL}${pathSuffix.startsWith("/") ? "" : "/"}${pathSuffix}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text.slice(0, 8000) };
  if (!text) return { ok: true, data: "" };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: true, data: text };
  }
}

function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out;
}

// ── Frappe Lead schema (shared zod) ────────────────────────────────────────────

const FRAPPE_SOURCE = [
  "Website",
  "LinkedIn",
  "Cold Call",
  "Cold Calling",
  "Exhibition",
  "Email",
  "Email Campaign",
  "Referral",
  "Reference",
  "Other",
  "Partner",
  "Walk In",
  "Campaign",
  "Mass Mailing",
  "Advertisement",
  "Existing Customer",
];

const FRAPPE_STATUS = [
  "Lead",
  "Open",
  "Replied",
  "Opportunity",
  "Quotation",
  "Lost Quotation",
  "Interested",
  "Converted",
  "Do Not Contact",
];

const FRAPPE_EMPLOYEE_BAND = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

const leadFieldsShape = {
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  middle_name: z.string().optional(),
  company_name: z.string().optional(),
  email_id: z.string().optional(),
  phone: z.string().optional(),
  mobile_no: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  no_of_employees: z.enum(FRAPPE_EMPLOYEE_BAND).optional(),
  source: z.enum(FRAPPE_SOURCE).optional(),
  lead_owner: z.string().optional(),
  lead_score: z.number().optional(),
  automation_notes: z.string().optional(),
  pain_points: z.string().optional(),
  status: z.enum(FRAPPE_STATUS).optional(),
  job_title: z.string().optional(),
  tech_stack: z.string().optional(),
  company_linkedin: z.string().optional(),
  contact1_linkedin: z.string().optional(),
  type: z.enum(["Client", "Channel Partner", "Consultant"]).optional(),
  request_type: z
    .enum(["Product Enquiry", "Request for Information", "Suggestions", "Other"])
    .optional(),
  campaign_name: z.string().optional(),
  qualification_status: z.enum(["Unqualified", "In Process", "Qualified"]).optional(),
};

const leadFieldsSchema = z.object(leadFieldsShape);

function applyDefaults(f) {
  const first_name = f.first_name || "Lead";
  const company_name = f.company_name || "";
  const lead_owner = f.lead_owner || FRAPPE_LEAD_OWNER;
  const status = f.status || "Lead";
  const source = f.source || "Website";
  return { first_name, company_name, lead_owner, status, source };
}

function buildLeadDoc(f) {
  const defaults = applyDefaults(f);
  if (!defaults.company_name) return { ok: false, reason: "missing company_name" };
  if (!defaults.lead_owner) {
    return {
      ok: false,
      reason: "missing lead_owner (set fields.lead_owner or FRAPPE_LEAD_OWNER env)",
    };
  }
  return { ok: true, doc: stripUndefined({ ...f, ...defaults }) };
}

// ── Markdown → Frappe Lead mapping ─────────────────────────────────────────────

/**
 * Parse a prospect-studio lead profile into a Frappe Lead payload.
 * Prefers frontmatter (structured), falls back to bold markers in body.
 */
function parseLeadProfile(raw) {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatter = {};
  let body = raw;
  if (fmMatch) {
    body = raw.slice(fmMatch[0].length);
    for (const line of fmMatch[1].split(/\r?\n/)) {
      const m = line.match(/^([a-z0-9_]+):\s*(.*)$/i);
      if (m) frontmatter[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }

  // Helper: find a **Label:** value line in the body
  const getBold = (label) => {
    const re = new RegExp(`\\*\\*${label}:?\\*\\*\\s*(.+)`, "i");
    const m = body.match(re);
    return m ? m[1].trim() : undefined;
  };

  // Helper: grab a full section by heading name
  const getSection = (heading) => {
    const re = new RegExp(`##\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|\\n---|$)`, "i");
    const m = body.match(re);
    return m ? m[1].trim() : "";
  };

  // Company + website
  const company_name =
    frontmatter.company_name ||
    frontmatter.company ||
    getBold("Company") ||
    getBold("Company Name") ||
    (frontmatter.title || "").replace(/\s*—.*$/, "").trim() ||
    undefined;

  let website = frontmatter.website || getBold("Website") || getBold("Domain");
  if (website && !/^https?:\/\//.test(website)) website = `https://${website.replace(/^\/+/, "")}`;

  // Location
  const city = frontmatter.city || getBold("City");
  const state = frontmatter.state || getBold("State");
  const country = frontmatter.country || getBold("Country") || getBold("HQ");

  // Company facts
  const industry = frontmatter.industry || getBold("Industry");
  const no_of_employees = mapEmployeeBand(frontmatter.no_of_employees || getBold("Employees") || getBold("Size"));
  const tech_stack = frontmatter.tech_stack || getBold("Tech Stack");
  const company_linkedin =
    frontmatter.company_linkedin || getBold("Company LinkedIn") || getBold("LinkedIn");

  // Primary contact (from frontmatter if present, else first row of Key Contacts table)
  let first_name = frontmatter.first_name;
  let last_name = frontmatter.last_name;
  let job_title = frontmatter.job_title;
  let email_id = frontmatter.email_id || frontmatter.email;
  let mobile_no = frontmatter.mobile_no || frontmatter.mobile || frontmatter.phone;
  let contact1_linkedin = frontmatter.contact1_linkedin;

  if (!first_name || !email_id) {
    const contact = parseFirstContactRow(body);
    if (contact) {
      if (!first_name) {
        const parts = (contact.name || "").split(/\s+/);
        first_name = parts[0] || undefined;
        last_name = last_name || parts.slice(1).join(" ") || undefined;
      }
      job_title = job_title || contact.title;
      email_id = email_id || contact.email;
      mobile_no = mobile_no || contact.phone;
      contact1_linkedin = contact1_linkedin || contact.linkedin;
    }
  }

  if (!first_name && company_name) first_name = company_name.split(/\s+/)[0];

  // Score: prefer frontmatter icp_score (1-10 → ×10 for Frappe 0-100), then body "Score: X/10"
  let lead_score;
  if (frontmatter.icp_score) {
    const n = parseInt(frontmatter.icp_score, 10);
    if (!isNaN(n)) lead_score = n <= 10 ? n * 10 : n;
  }
  if (lead_score == null) {
    const m = body.match(/Score:\s*(\d+)\s*\/?\s*10/i);
    if (m) lead_score = parseInt(m[1], 10) * 10;
  }

  // Pain points — full section
  const painSection = getSection("Pain Points") || getSection("Pain points");
  const pain_points = painSection ? painSection.slice(0, 4000) : undefined;

  // Source mapping
  const source = mapSource(frontmatter.source);

  // Status mapping — frontmatter uses prospect-studio pipeline, Frappe has its own
  const status = mapStatus(frontmatter.status);

  // Qualification status
  const qualification_status = mapQualification(frontmatter.icp_score, frontmatter.priority);

  const automation_notes_parts = [];
  if (frontmatter.icp_score) automation_notes_parts.push(`ICP score: ${frontmatter.icp_score}/10`);
  if (frontmatter.priority) automation_notes_parts.push(`Priority: ${frontmatter.priority}`);
  if (frontmatter.source) automation_notes_parts.push(`Discovery source: ${frontmatter.source}`);
  if (frontmatter.discovery_batch) automation_notes_parts.push(`Batch: ${frontmatter.discovery_batch}`);
  const automation_notes = automation_notes_parts.length ? automation_notes_parts.join(" | ") : undefined;

  return stripUndefined({
    first_name,
    last_name,
    company_name,
    email_id,
    mobile_no,
    website,
    industry,
    city,
    state,
    country,
    no_of_employees,
    source,
    lead_score,
    automation_notes,
    pain_points,
    status,
    job_title,
    tech_stack,
    company_linkedin,
    contact1_linkedin,
    qualification_status,
  });
}

function parseFirstContactRow(body) {
  // Look for a markdown table under "Key Contacts" / "Contacts"
  const sectionRe = /##\s*(?:Key\s+)?Contacts?[^\n]*\n([\s\S]*?)(?=\n##\s|\n---|$)/i;
  const m = body.match(sectionRe);
  if (!m) return null;
  const section = m[1];
  const lines = section.split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
  if (lines.length < 3) return null; // header + separator + at least one row

  const header = lines[0]
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim().toLowerCase());
  const row = lines[2]
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());

  const col = (keyRegex) => {
    const idx = header.findIndex((h) => keyRegex.test(h));
    return idx >= 0 ? row[idx] : undefined;
  };

  const name = col(/name/);
  const title = col(/title|role|position/);
  const emailRaw = col(/email/);
  const phoneRaw = col(/phone|mobile/);
  const linkedinRaw = col(/linkedin/);

  const email = emailRaw?.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
  const linkedin = linkedinRaw?.match(/https?:\/\/[^\s)|]+/)?.[0];

  return { name, title, email, phone: phoneRaw, linkedin };
}

function mapEmployeeBand(value) {
  if (!value) return undefined;
  const v = value.toString().toLowerCase().replace(/[^\d\-+kK]/g, "");
  const num = parseInt(v, 10);
  if (isNaN(num)) {
    // Already an enum value?
    return FRAPPE_EMPLOYEE_BAND.includes(value) ? value : undefined;
  }
  if (num <= 10) return "1-10";
  if (num <= 50) return "11-50";
  if (num <= 200) return "51-200";
  if (num <= 500) return "201-500";
  if (num <= 1000) return "501-1000";
  return "1000+";
}

function mapSource(value) {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v.includes("linkedin")) return "LinkedIn";
  if (v.includes("bulk") || v.includes("discovery")) return "Campaign";
  if (v.includes("csv") || v.includes("import")) return "Mass Mailing";
  if (v.includes("referral") || v.includes("reference")) return "Referral";
  if (v.includes("cold")) return "Cold Calling";
  if (v.includes("email")) return "Email Campaign";
  if (v.includes("partner")) return "Partner";
  if (v.includes("exhibition") || v.includes("event")) return "Exhibition";
  if (v.includes("existing")) return "Existing Customer";
  if (FRAPPE_SOURCE.includes(value)) return value;
  return "Website";
}

function mapStatus(value) {
  if (!value) return "Lead";
  const v = value.toLowerCase();
  if (v === "new" || v === "prospect") return "Lead";
  if (v === "contacted") return "Open";
  if (v === "qualified") return "Interested";
  if (v === "nurturing") return "Replied";
  if (v === "closed") return "Converted";
  if (v === "lost") return "Lost Quotation";
  if (FRAPPE_STATUS.includes(value)) return value;
  return "Lead";
}

function mapQualification(icpScore, priority) {
  const n = parseInt(icpScore, 10);
  if (!isNaN(n)) {
    if (n >= 7) return "Qualified";
    if (n >= 4) return "In Process";
    return "Unqualified";
  }
  if (priority === "high" || priority === "urgent") return "Qualified";
  if (priority === "medium") return "In Process";
  return undefined;
}

// ── MCP Server ──────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "prospect-studio-frappe",
  version: "1.0.0",
});

server.tool(
  "frappe_create_lead",
  "Create one lead in Frappe/ERPNext via POST /api/resource/Lead. Requires company_name. Unmapped fields are sent through. Frappe credentials come from plugin user_config.",
  { fields: leadFieldsSchema },
  async ({ fields }) => {
    const built = buildLeadDoc(fields);
    if (!built.ok) return text(`Error: ${built.reason}`);
    const result = await apiFetch("/api/resource/Lead", {
      method: "POST",
      body: JSON.stringify(built.doc),
    });
    return text(formatResult(result));
  }
);

server.tool(
  "frappe_push_leads_batch",
  "Bulk-create leads in one call via POST /api/method/frappe.client.insert_many. If continueOnError=true, invalid rows are skipped; otherwise the whole batch is aborted on first validation error. Use this for csv-import or bulk-discovery deep-dives.",
  {
    leads: z.array(leadFieldsSchema),
    continueOnError: z.boolean().optional(),
  },
  async ({ leads, continueOnError }) => {
    const docs = [];
    const skipped = [];
    for (let i = 0; i < leads.length; i++) {
      const built = buildLeadDoc(leads[i]);
      if (!built.ok) {
        const msg = `Row ${i + 1}: ${built.reason}`;
        if (continueOnError) {
          skipped.push(msg);
          continue;
        }
        return text(msg);
      }
      docs.push({ doctype: "Lead", ...built.doc });
    }
    if (docs.length === 0) {
      return text(["No valid leads to insert.", ...(skipped.length ? ["Skipped:", ...skipped] : [])].join("\n"));
    }
    const result = await apiFetch("/api/method/frappe.client.insert_many", {
      method: "POST",
      body: JSON.stringify({ docs }),
    });
    const lines = [
      `insert_many: ${docs.length} lead(s) submitted (${leads.length} row(s) in request).`,
      formatResult(result),
    ];
    if (skipped.length) lines.push("Skipped rows:", ...skipped);
    return text(lines.join("\n"));
  }
);

server.tool(
  "frappe_list_leads",
  "List leads from Frappe with optional filters, fields, order_by, pagination (limit_page_length max 1000). filters is an array of [field, operator, value] triples.",
  {
    fields: z.array(z.string()).optional(),
    filters: z.array(z.array(z.string())).optional(),
    order_by: z.string().optional(),
    limit_page_length: z.number().optional(),
    limit_start: z.number().optional(),
  },
  async ({ fields, filters, order_by, limit_page_length, limit_start }) => {
    const params = new URLSearchParams();
    if (fields?.length) params.set("fields", JSON.stringify(fields));
    if (filters?.length) params.set("filters", JSON.stringify(filters));
    if (order_by) params.set("order_by", order_by);
    if (limit_page_length != null) params.set("limit_page_length", String(limit_page_length));
    if (limit_start != null) params.set("limit_start", String(limit_start));
    const q = params.toString();
    const result = await apiFetch(`/api/resource/Lead${q ? `?${q}` : ""}`, { method: "GET" });
    return text(formatResult(result));
  }
);

server.tool(
  "frappe_get_lead",
  "GET a single Lead by its Frappe document name (e.g. CRM-LEAD-2026-00042).",
  { id: z.string() },
  async ({ id }) => {
    const result = await apiFetch(`/api/resource/Lead/${encodeURIComponent(id)}`, { method: "GET" });
    return text(formatResult(result));
  }
);

server.tool(
  "frappe_update_lead",
  "Update a lead — send only the fields to change. PUT /api/resource/Lead/<id>.",
  {
    id: z.string(),
    fields: leadFieldsSchema,
  },
  async ({ id, fields }) => {
    const result = await apiFetch(`/api/resource/Lead/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(stripUndefined(fields)),
    });
    return text(formatResult(result));
  }
);

server.tool(
  "frappe_lead_count",
  "Get lead count via frappe.client.get_count with optional filters.",
  {
    filters: z.array(z.array(z.string())).optional(),
  },
  async ({ filters }) => {
    const params = new URLSearchParams({ doctype: "Lead" });
    if (filters?.length) params.set("filters", JSON.stringify(filters));
    const result = await apiFetch(`/api/method/frappe.client.get_count?${params.toString()}`, {
      method: "GET",
    });
    return text(formatResult(result));
  }
);

server.tool(
  "frappe_push_lead_file",
  "Read a prospect-studio lead profile (e.g. documents/leads/2026-04-11-acme.md), parse frontmatter and body into Frappe Lead fields, and POST to Frappe. `overrides` lets you patch any field before sending (e.g. set qualification_status=Qualified). Preferred path for sending a single researched lead to the CRM.",
  {
    relativePath: z.string(),
    overrides: leadFieldsSchema.optional(),
  },
  async ({ relativePath, overrides }) => {
    const full = join(WORKSPACE_ROOT, relativePath.replace(/^[/\\]+/, ""));
    if (!existsSync(full)) return text(`File not found: ${relativePath}`);
    const raw = readFileSync(full, "utf-8");
    const parsed = parseLeadProfile(raw);
    const merged = { ...parsed, ...(overrides || {}) };
    const built = buildLeadDoc(merged);
    if (!built.ok) {
      return text(
        `Error: ${built.reason}\nParsed fields:\n${JSON.stringify(parsed, null, 2)}`
      );
    }
    const result = await apiFetch("/api/resource/Lead", {
      method: "POST",
      body: JSON.stringify(built.doc),
    });
    if (!result.ok) return text(formatResult(result));
    return text(
      `Pushed to Frappe: ${JSON.stringify(built.doc, null, 2)}\n\n---\n${formatResult(result)}`
    );
  }
);

server.tool(
  "frappe_parse_lead_file",
  "Parse a prospect-studio lead profile into Frappe Lead fields without pushing. Use this to preview the mapping before calling frappe_push_lead_file.",
  { relativePath: z.string() },
  async ({ relativePath }) => {
    const full = join(WORKSPACE_ROOT, relativePath.replace(/^[/\\]+/, ""));
    if (!existsSync(full)) return text(`File not found: ${relativePath}`);
    const raw = readFileSync(full, "utf-8");
    const parsed = parseLeadProfile(raw);
    return text(
      `Parsed Frappe Lead fields from ${relativePath}:\n\n${JSON.stringify(parsed, null, 2)}`
    );
  }
);

// ── Helpers ────────────────────────────────────────────────────────────────────

function text(s) {
  return { content: [{ type: "text", text: typeof s === "string" ? s : JSON.stringify(s, null, 2) }] };
}

function formatResult(result) {
  if (result.ok) {
    return typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2);
  }
  return `HTTP ${result.status}\n${result.body}`;
}

// ── Start ──────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
