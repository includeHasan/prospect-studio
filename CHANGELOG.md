# Changelog

All notable changes to prospect-studio will be documented here.

Format: [Semantic Versioning](https://semver.org) — `MAJOR.MINOR.PATCH`

---

## [1.6.0] — 2026-04-11

### Install & cross-platform fixes

- **Fixed `marketplace.json` schema** — plugin `source` must start with `./` (bare `"."` fails validation). Local installs via `/plugin marketplace add` now work.
- **Fixed `plugin.json` `userConfig` schema** — every entry now has `type` (`string` / `directory`) and `title` fields required by the current plugin manifest schema. Previous installs failed with "Invalid option" validation errors on every user config field.
- **Fixed Windows hook execution** — `install-deps.sh` is now invoked as `bash "${CLAUDE_PLUGIN_ROOT}/scripts/install-deps.sh"` instead of as a bare executable, so it runs under Git Bash on Windows. Previously the hook silently failed, leaving `${CLAUDE_PLUGIN_DATA}/node_modules` empty and both local MCP servers (`web-scraper`, `frappe`) unable to start.
- **Portable Python hooks** — `deadline-monitor.py`, `track-document.py`, and `track-search.py` are now invoked through a `bash -c` trampoline that detects `python3` / `python` / `py` in that order, so the hooks work on macOS, Linux, and Windows regardless of which Python alias is installed. Missing Python exits 0 silently as before.

### SerpAPI: Google Maps Local Business engine is first-class

- **Both SerpAPI engines are now documented and enforced across agents**:
  - `engine: "google"` — Google Web Search, default for digital/non-local ICPs (SaaS, funded startups, LinkedIn URL discovery, news/funding lookups).
  - `engine: "google_maps"` — Google Maps Local Business, **required** for any brick-and-mortar / location-bound ICP (clinics, gyms, restaurants, salons, auto shops, retail, local services). Returns structured place data: name, address, phone, website, rating, review count, category, hours.
- Rule: if the ICP is location-bound, start with `google_maps`; a single research pass may use both (Maps for structured place data, Web for news/people).
- Updated in lockstep: `templates/CLAUDE.md` (SerpAPI Usage section), `agents/discovery.md` (Step 2 query building), `agents/research.md` (Step 1 search), `agents/sales.md` (orchestrator sanity-check tool note).

---

## [1.5.0] — 2026-04-11

### Core Sales Agent (Orchestrator)

**New agent**
- `sales` — the strategic orchestrator. Thinks, plans, judges, and delegates like a senior sales lead. It is now the **default entry point for open-ended or goal-shaped requests** ("help me hit quota", "what should I work on today", "run a campaign into fintech", "judge these leads", "build me a plan for Acme").

**What it does**
- **Thinks** — parses the real goal, asks at most one clarifying question
- **Plans** — produces a numbered plan with effort estimates and delegation targets, shows it to the user, waits for a nod before executing
- **Executes** — delegates to specialist agents (`research`, `discovery`, `outreach`, `analyst`, `coach`) rather than doing raw work itself
- **Judges** — applies a BANT+fit rubric with explicit kill criteria after each step; updates lead profile frontmatter with scores and adds a `## Disposition` note for killed leads
- **Iterates** — ends with a crisp recommendation ("tackle first", "also worth your time", "killed", "parked", "blocked on"), not a data dump

**Tool allowlist** (intentional)
- ✅ `Read`, `Glob`, `Write`, `Edit`, `TodoWrite`, `Agent`, SerpAPI (sanity checks only), `WebFetch`, all Frappe tools
- ❌ `scrape_url`, `scrape_company_intel`, `find_contacts`, `batch_scrape`, Bash, direct Apify — forces delegation through specialists

**New skill**
- `/prospect-studio:sales` — thin entry point that routes strategic requests to the `sales` agent. Task-shaped requests still go directly to the specialist.

**Updated**
- `templates/CLAUDE.md` — new Skills entry, new Subagents table highlighting `sales` as the orchestrator, delegation rule ("strategic → `sales`, task-shaped → specialist")
- Root `CLAUDE.md` — documents the delegation graph and the reasoning behind `sales`'s tool disallowlist

---

## [1.4.0] — 2026-04-11

### Frappe / ERPNext CRM Sync

**New MCP server**
- `frappe` — local Node MCP server at `mcp-server/frappe-server.js`, ported from the KStar OpenCode plugin (`kstar.ts`). Talks to any Frappe/ERPNext instance's REST API with `Authorization: token <key>:<secret>`. Shares `node_modules` with the existing `web-scraper` server via the same `package.json`, so no extra install step is needed.

**New tools**
- `frappe_parse_lead_file` — preview a lead profile as a Frappe Lead payload without hitting the network
- `frappe_push_lead_file` — parse + push a single workspace lead profile to Frappe
- `frappe_create_lead` — create a lead from explicit field values
- `frappe_push_leads_batch` — bulk `insert_many` for csv-import / deep-dived discovery batches (supports `continueOnError`)
- `frappe_list_leads` — filterable query with pagination for dedup and reporting
- `frappe_get_lead` — read one lead by Frappe document name
- `frappe_update_lead` — patch a lead after a meeting or status change
- `frappe_lead_count` — count with filters

**New user config** (all optional — Frappe disabled if any of the first three is blank)
- `frappe_url` — base URL of the Frappe site (e.g. `https://erp.mycompany.com`)
- `frappe_api_key`, `frappe_api_secret` — credentials (sensitive)
- `frappe_lead_owner` — default owner email for new leads

**Enriched lead profile schema**
The `documents/leads/*.md` frontmatter now carries structured fields that map directly to Frappe's `Lead` DocType: `company_name`, `website`, `industry`, `city`/`state`/`country`, `no_of_employees`, `tech_stack`, `company_linkedin`, plus primary contact (`first_name`, `last_name`, `job_title`, `email_id`, `mobile_no`, `contact1_linkedin`). The `research` agent now builds this enriched frontmatter by default.

**Automatic mapping**
The server's `parseLeadProfile` function handles workspace → Frappe translation:
- `icp_score` (1-10) → `lead_score` (0-100, ×10)
- `priority` + `icp_score` → `qualification_status` (Qualified / In Process / Unqualified)
- workspace `status` (new|contacted|qualified|nurturing|closed) → Frappe `status` (Lead|Open|Interested|Replied|Converted)
- workspace `source` (manual|bulk-discovery|csv-import) → Frappe `source` (Website|Campaign|Mass Mailing)
- `no_of_employees` raw number → Frappe band enum (`1-10`, `11-50`, `51-200`, ...)
- Body `## Pain Points` section → `pain_points` (first 4000 chars)
- Markdown Key Contacts table → primary contact fields (when frontmatter is missing)
- `icp_score` + `priority` + `source` + `discovery_batch` → `automation_notes` (for traceability)

**Research workflow**
- `agents/research.md` Step 3 rewritten with the enriched frontmatter template.
- New Step 5: after saving a profile, offer to dedup-check (`frappe_list_leads`) and push (`frappe_parse_lead_file` → confirm → `frappe_push_lead_file`). Silent fallback when Frappe is not configured.

**Rules**
- Always preview with `frappe_parse_lead_file` and confirm with the user before any push — pushing to a live CRM is a side effect on shared infrastructure.
- Dedup before create; prefer `frappe_update_lead` when a company match exists.
- Fill frontmatter during research, not at push time.
- The source file, `templates/CLAUDE.md` field-mapping table, and `agents/research.md` Step 3 frontmatter template are a coupled contract — changes to any one must propagate to all three.

---

## [1.3.0] — 2026-04-11

### Apify MCP Integration (Opt-in, Paid, Gated)

**New MCP server**
- `apify` — remote MCP at `https://mcp.apify.com`, authenticated via the new optional `apify_token` user config. Pinned to exactly four Actors: `code_crafter/leads-finder`, `harvestapi/linkedin-company-employees`, `dev_fusion/Linkedin-Profile-Scraper`, `apidojo/tweet-scraper`. `search-actors`/`add-actor` are deliberately disabled so agents can't discover and spin up arbitrary paid Actors.

**Cost-control rules** (enforced in `agents/research.md`, `agents/discovery.md`, and `templates/CLAUDE.md`):
- Apify calls require **explicit user confirmation** every time — Actor name, target, data, and a "this is a paid call" notice.
- Only suggested on **high-score leads**: `icp_score ≥ 7`, or `priority: high|urgent`, or user-flagged hot.
- **Forbidden during bulk-discovery stage 1** (quick-scoring 15-50 companies). Only allowed in stage 2 deep-dives on user-selected companies.
- One Actor, one target, one confirmation — no batch calls.
- When `apify_token` is blank, all Apify calls fail and agents fall back silently to SerpAPI + the bundled web-scraper without mentioning Apify.

**LinkedIn policy clarified**
- Bundled `web-scraper` and Playwright are still forbidden from scraping LinkedIn.
- Apify's `harvestapi/linkedin-company-employees` and `dev_fusion/Linkedin-Profile-Scraper` are the sanctioned path for compliant LinkedIn data — but only under the cost-control rules above.

**Changed**
- `plugin.json` — new optional `apify_token` user config (sensitive).
- `agents/research.md` — added Step 1b covering the Apify workflow and gating rules.
- `agents/discovery.md` — added explicit "Apify Rules" section, forbidding stage-1 usage.
- `templates/CLAUDE.md` — new "Data Sources" cost-tier table and full "Apify MCP Usage" section.
- `README.md` — rewrote the data-sources section with the cost warning.
- Root `CLAUDE.md` — documents the three-file rule-synchronization requirement for Apify behavior changes.

---

## [1.2.0] — 2026-04-11

### Scope Narrowed to Lead Generation

prospect-studio is now focused exclusively on B2B lead generation, prospecting, and outreach. Non-sales functionality has been removed.

**Removed**
- `planning` agent (PRD/FRD writing)
- `prd-writer` skill
- `task-manager` skill
- `goal-tracker` skill

**Changed**
- `coach` agent now only reviews sales artifacts: outreach emails, lead profiles, battlecards, and pitch materials. PRD and OKR review criteria removed.
- `deadline-monitor.py` no longer scans tasks — the daily brief is now a pure lead pipeline snapshot with stale-lead alerts.
- `daily-briefing` skill rewritten around pipeline + follow-ups only.
- `setup` skill no longer creates `documents/prd/`, `documents/frd/`, `documents/tasks/`, `documents/goals/`, or `notes/ideas/`. Fresh workspaces get a leaner folder tree.
- `templates/CLAUDE.md` rewritten to drop PRD/FRD/task/goal workflows, subagents, file-naming rules, and frontmatter types.
- README updated — capability table, skill list, and workspace tree reflect the narrower scope.

**Note for existing users**
Existing `documents/prd/`, `documents/tasks/`, and `documents/goals/` folders in your workspace are not touched by the plugin upgrade. Move or delete them manually if you want a clean workspace.

---

## [1.1.0] — 2026-04-05

### Bulk Lead Discovery

**New Agent**
- `discovery` — Conversational bulk prospecting specialist. Asks 2-3 ICP questions, searches for matching companies via SerpAPI, quick-scores 15-50 companies, presents a summary table, and deep-dives selected ones via the research agent. Supports industry filter, ICP criteria, competitor lookalike, and CSV import entry points.

**New Skills (2)**
- `prospect-discovery` — Bulk lead discovery entry point ("find me leads", "discover prospects", "who should I sell to")
- `csv-import` — Import CSV/spreadsheet of companies with flexible column mapping for enrichment and scoring

**Updated**
- `pipeline-review` — Now surfaces unqualified prospects from bulk discovery, grouped by batch
- `templates/CLAUDE.md` — Added bulk discovery workflow, new skills, discovery agent, and new frontmatter tags

**New Frontmatter Tags**
- `source: bulk-discovery|csv-import|manual` — how the lead was discovered
- `discovery_batch: YYYY-MM-DD-[topic]` — groups leads from the same discovery run
- `status: prospect` — discovered but not yet deep-dived

---

## [1.0.0] — 2026-04-05

### Initial Release

**Agents (5)**
- `research` — Lead research and market intelligence specialist
- `planning` — PRD/FRD writer and product requirements specialist
- `outreach` — Sales outreach and multi-touch email sequence specialist
- `analyst` — Market research and competitive intelligence specialist
- `coach` — Strategic coach and document reviewer

**Skills (10)**
- `setup` — First-run workspace initializer
- `daily-briefing` — Morning briefing from workspace state
- `lead-research` — Research and qualify B2B leads
- `pipeline-review` — Full pipeline view with follow-up recommendations
- `meeting-notes` — Structured meeting notes with action item extraction
- `competitive-intel` — Competitive analysis and battlecard generation
- `weekly-report` — Weekly status report with optional PPTX export
- `prd-writer` — PRD/FRD creation with proper structure
- `task-manager` — Task creation, tracking, and project status
- `goal-tracker` — OKR setting and progress tracking

**MCP Servers (3)**
- `web-scraper` — HTTP fetch + cheerio scraper (4 tools: scrape_url, scrape_company_intel, find_contacts, batch_scrape) with Playwright MCP fallback hints
- `playwright` — Full browser automation for JS-heavy pages (via @playwright/mcp)
- `serpapi` — Multi-engine web search via SerpAPI remote MCP

**Hooks**
- `SessionStart` — Auto-installs MCP server dependencies, runs deadline monitor
- `PostToolUse (Write|Edit)` — Auto-logs document activity to activity-log.md
- `PostToolUse (search tools)` — Auto-logs searches to search-log.md

**Security**
- SerpAPI key stored in OS keychain via `userConfig` (never written to disk)
- Migrated from hardcoded key in opencode.json
