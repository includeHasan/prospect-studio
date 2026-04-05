# Changelog

All notable changes to prospect-studio will be documented here.

Format: [Semantic Versioning](https://semver.org) — `MAJOR.MINOR.PATCH`

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
