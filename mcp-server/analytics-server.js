#!/usr/bin/env node
/**
 * prospect-studio Analytics MCP Server
 *
 * Records and reports on everything that happens in a prospect-studio session:
 * user prompts, tool calls, agent invocations, session lifecycle, and lead
 * creation (including duplicate detection across lead files).
 *
 * Architecture:
 *   1. Hooks (record-event.py) append events to
 *      ${WORKSPACE_ROOT}/.analytics/events.jsonl on the hot path — fast, no DB.
 *   2. This MCP server connects to MongoDB via mongoose and provides tools to
 *      flush JSONL → Mongo and query the resulting event stream.
 *   3. The `analytics` agent calls these tools to produce reports.
 *
 * Config (env):
 *   MONGO_URI       — MongoDB connection string (e.g. mongodb://localhost:27017/prospect_studio)
 *   WORKSPACE_ROOT  — absolute path to the user's prospect-studio workspace
 *
 * If MONGO_URI is blank, every tool returns a "not configured" error (same
 * pattern as the frappe server). The recording pipeline still works — JSONL
 * accumulates locally and can be flushed later once Mongo is configured.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import mongoose from "mongoose";
import { readFileSync, existsSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

// ── Config ──────────────────────────────────────────────────────────────────────

const MONGO_URI = process.env.MONGO_URI || "";
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();
const JSONL_PATH = join(WORKSPACE_ROOT, ".analytics", "events.jsonl");
const LEADS_DIR = join(WORKSPACE_ROOT, "documents", "leads");

function configError() {
  if (!MONGO_URI) {
    return (
      "Analytics MCP not configured — MONGO_URI is blank. " +
      "Set `mongo_uri` in plugin user config (e.g. mongodb://localhost:27017/prospect_studio) " +
      "and re-run /reload-plugins. Events are still being captured to " +
      ".analytics/events.jsonl and can be flushed later."
    );
  }
  return null;
}

// ── Mongoose model ──────────────────────────────────────────────────────────────

const EventSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true, index: true },
    session_id: { type: String, required: true, index: true },
    workspace: { type: String, required: true, index: true },
    type: { type: String, required: true, index: true },
    actor: { type: String, default: "system", index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    tags: { type: [String], default: [] },
  },
  { collection: "events", strict: false, timestamps: true }
);

// Dedup index: same session + timestamp + type + actor = same event
EventSchema.index(
  { session_id: 1, timestamp: 1, type: 1, actor: 1 },
  { unique: false }
);

let Event = null;
let mongoReady = false;

async function ensureMongo() {
  const err = configError();
  if (err) return { ok: false, error: err };
  if (mongoReady) return { ok: true };
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    Event = mongoose.models.Event || mongoose.model("Event", EventSchema);
    mongoReady = true;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `MongoDB connect failed: ${e.message}` };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function text(s) {
  return {
    content: [
      { type: "text", text: typeof s === "string" ? s : JSON.stringify(s, null, 2) },
    ],
  };
}

function readJsonlLines(path) {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const out = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch {
      // skip malformed line
    }
  }
  return out;
}

function parseLeadFrontmatter(raw) {
  if (!raw.startsWith("---")) return null;
  const end = raw.indexOf("---", 3);
  if (end < 0) return null;
  const block = raw.slice(3, end);
  const fm = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([a-z_][a-z0-9_]*):\s*(.*)$/i);
    if (m) fm[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return fm;
}

function normalizeCompanyName(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|pvt|private|co|company|gmbh|pte)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function walkLeadFiles() {
  if (!existsSync(LEADS_DIR)) return [];
  const out = [];
  const stack = [LEADS_DIR];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) stack.push(full);
      else if (name.endsWith(".md")) out.push(full);
    }
  }
  return out;
}

// ── Server ─────────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "prospect-studio-analytics",
  version: "1.0.0",
});

server.tool(
  "analytics_flush",
  "Read .analytics/events.jsonl, insert each event into MongoDB, then truncate the file. Call this before running queries if you want fresh data. Returns the number of events imported.",
  {},
  async () => {
    const m = await ensureMongo();
    if (!m.ok) return text(m.error);
    const events = readJsonlLines(JSONL_PATH);
    if (events.length === 0) return text("No pending events in .analytics/events.jsonl");
    const docs = events.map((e) => ({
      timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
      session_id: e.session_id || "unknown",
      workspace: e.workspace || WORKSPACE_ROOT,
      type: e.type || "unknown",
      actor: e.actor || "system",
      payload: e.payload || {},
      tags: e.tags || [],
    }));
    try {
      await Event.insertMany(docs, { ordered: false });
      writeFileSync(JSONL_PATH, "");
      return text(`Flushed ${docs.length} events to MongoDB and truncated JSONL.`);
    } catch (e) {
      return text(`Partial flush (insertMany error): ${e.message}`);
    }
  }
);

server.tool(
  "analytics_query",
  "Query raw events from MongoDB. Filter by type, actor, session_id, and/or a time window. Returns up to `limit` most recent events.",
  {
    type: z.string().optional().describe("Event type filter (e.g. 'prompt', 'tool_use', 'agent_call', 'session_start', 'stop', 'lead_created')"),
    actor: z.string().optional().describe("Actor filter (tool name, agent name, or 'user')"),
    session_id: z.string().optional().describe("Limit to a single session"),
    since: z.string().optional().describe("ISO date or duration like '24h', '7d' — only events after this"),
    limit: z.number().int().min(1).max(500).default(50),
  },
  async ({ type, actor, session_id, since, limit }) => {
    const m = await ensureMongo();
    if (!m.ok) return text(m.error);
    const q = { workspace: WORKSPACE_ROOT };
    if (type) q.type = type;
    if (actor) q.actor = actor;
    if (session_id) q.session_id = session_id;
    if (since) {
      let from;
      const durMatch = since.match(/^(\d+)([hdwm])$/);
      if (durMatch) {
        const [, n, unit] = durMatch;
        const ms = { h: 3600e3, d: 86400e3, w: 7 * 86400e3, m: 30 * 86400e3 }[unit];
        from = new Date(Date.now() - Number(n) * ms);
      } else {
        from = new Date(since);
      }
      if (!isNaN(from.getTime())) q.timestamp = { $gte: from };
    }
    const rows = await Event.find(q).sort({ timestamp: -1 }).limit(limit).lean();
    return text({ count: rows.length, events: rows });
  }
);

server.tool(
  "analytics_summary",
  "Aggregate counts by event type and actor for a time window. Great for 'what happened today' or 'what's my tool mix this week'.",
  {
    since: z.string().default("24h").describe("Time window, e.g. '24h', '7d', '30d'"),
    session_id: z.string().optional(),
  },
  async ({ since, session_id }) => {
    const m = await ensureMongo();
    if (!m.ok) return text(m.error);
    const durMatch = since.match(/^(\d+)([hdwm])$/);
    const ms = durMatch
      ? Number(durMatch[1]) *
        { h: 3600e3, d: 86400e3, w: 7 * 86400e3, m: 30 * 86400e3 }[durMatch[2]]
      : 24 * 3600e3;
    const from = new Date(Date.now() - ms);
    const match = { workspace: WORKSPACE_ROOT, timestamp: { $gte: from } };
    if (session_id) match.session_id = session_id;

    const byType = await Event.aggregate([
      { $match: match },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const byActor = await Event.aggregate([
      { $match: match },
      { $group: { _id: "$actor", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);
    const sessions = await Event.distinct("session_id", match);
    return text({
      window: since,
      from: from.toISOString(),
      total_events: byType.reduce((a, b) => a + b.count, 0),
      unique_sessions: sessions.length,
      by_type: byType.map((r) => ({ type: r._id, count: r.count })),
      by_actor: byActor.map((r) => ({ actor: r._id, count: r.count })),
    });
  }
);

server.tool(
  "analytics_session_report",
  "Full report for a single session: prompts sent, tools used, agents called, lead files touched, duration.",
  {
    session_id: z.string().describe("Session id — or 'latest' for the most recent session"),
  },
  async ({ session_id }) => {
    const m = await ensureMongo();
    if (!m.ok) return text(m.error);
    let sid = session_id;
    if (session_id === "latest") {
      const latest = await Event.findOne({ workspace: WORKSPACE_ROOT })
        .sort({ timestamp: -1 })
        .lean();
      if (!latest) return text("No events found.");
      sid = latest.session_id;
    }
    const events = await Event.find({ workspace: WORKSPACE_ROOT, session_id: sid })
      .sort({ timestamp: 1 })
      .lean();
    if (events.length === 0) return text(`No events for session ${sid}`);

    const prompts = events.filter((e) => e.type === "prompt");
    const toolUses = events.filter((e) => e.type === "tool_use");
    const agentCalls = toolUses.filter(
      (e) => e.actor === "Task" || e.actor === "Agent"
    );
    const leadWrites = toolUses.filter(
      (e) =>
        (e.actor === "Write" || e.actor === "Edit") &&
        String(e.payload?.tool_input?.file_path || "").includes("documents/leads")
    );
    const start = events[0].timestamp;
    const end = events[events.length - 1].timestamp;
    const durationMin = Math.round((new Date(end) - new Date(start)) / 60000);

    const toolMix = {};
    for (const e of toolUses) toolMix[e.actor] = (toolMix[e.actor] || 0) + 1;

    return text({
      session_id: sid,
      start: start,
      end: end,
      duration_minutes: durationMin,
      prompt_count: prompts.length,
      tool_call_count: toolUses.length,
      agent_call_count: agentCalls.length,
      lead_files_touched: leadWrites.length,
      tool_mix: toolMix,
      agents_invoked: [
        ...new Set(agentCalls.map((e) => e.payload?.tool_input?.subagent_type).filter(Boolean)),
      ],
      first_prompts: prompts.slice(0, 3).map((p) => ({
        at: p.timestamp,
        text: String(p.payload?.prompt || "").slice(0, 200),
      })),
    });
  }
);

server.tool(
  "analytics_prompts",
  "Return the last N user prompts (for 'what have I been asking' questions).",
  {
    limit: z.number().int().min(1).max(100).default(20),
    since: z.string().optional().describe("Time window like '24h', '7d'"),
  },
  async ({ limit, since }) => {
    const m = await ensureMongo();
    if (!m.ok) return text(m.error);
    const q = { workspace: WORKSPACE_ROOT, type: "prompt" };
    if (since) {
      const durMatch = since.match(/^(\d+)([hdwm])$/);
      if (durMatch) {
        const ms =
          Number(durMatch[1]) *
          { h: 3600e3, d: 86400e3, w: 7 * 86400e3, m: 30 * 86400e3 }[durMatch[2]];
        q.timestamp = { $gte: new Date(Date.now() - ms) };
      }
    }
    const rows = await Event.find(q).sort({ timestamp: -1 }).limit(limit).lean();
    return text(
      rows.map((r) => ({
        at: r.timestamp,
        session: r.session_id,
        text: String(r.payload?.prompt || "").slice(0, 500),
      }))
    );
  }
);

server.tool(
  "analytics_duplicates",
  "Scan documents/leads/ for duplicate lead profiles — files that describe the same company under different names. Compares normalized company name, domain, and email. Returns groups of suspected duplicates.",
  {},
  async () => {
    const files = walkLeadFiles();
    if (files.length === 0) return text("No lead files found under documents/leads/.");
    const byCompany = new Map();
    const byDomain = new Map();
    for (const f of files) {
      let raw;
      try {
        raw = readFileSync(f, "utf-8");
      } catch {
        continue;
      }
      const fm = parseLeadFrontmatter(raw) || {};
      const company = fm.company_name || fm.company || "";
      const website = fm.website || fm.url || "";
      const domain = (website.match(/https?:\/\/([^/]+)/) || [, ""])[1]
        .replace(/^www\./, "")
        .toLowerCase();
      const normCo = normalizeCompanyName(company);
      if (normCo) {
        if (!byCompany.has(normCo)) byCompany.set(normCo, []);
        byCompany.get(normCo).push({ file: f.replace(WORKSPACE_ROOT, ""), company, domain });
      }
      if (domain) {
        if (!byDomain.has(domain)) byDomain.set(domain, []);
        byDomain.get(domain).push({ file: f.replace(WORKSPACE_ROOT, ""), company, domain });
      }
    }
    const companyDupes = [...byCompany.entries()]
      .filter(([, v]) => v.length > 1)
      .map(([k, v]) => ({ match: "company_name", key: k, files: v }));
    const domainDupes = [...byDomain.entries()]
      .filter(([, v]) => v.length > 1)
      .map(([k, v]) => ({ match: "domain", key: k, files: v }));
    return text({
      total_lead_files: files.length,
      duplicate_company_groups: companyDupes.length,
      duplicate_domain_groups: domainDupes.length,
      duplicates_by_company: companyDupes,
      duplicates_by_domain: domainDupes,
    });
  }
);

server.tool(
  "analytics_pending",
  "Peek at .analytics/events.jsonl without flushing — show how many events are waiting to be imported to Mongo, and a preview of the most recent ones.",
  {},
  async () => {
    const events = readJsonlLines(JSONL_PATH);
    return text({
      pending_count: events.length,
      jsonl_path: JSONL_PATH,
      recent: events.slice(-5),
    });
  }
);

// ── Start ──────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
