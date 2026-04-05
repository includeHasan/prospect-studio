# Changelog

All notable changes to prospect-studio will be documented here.

Format: [Semantic Versioning](https://semver.org) — `MAJOR.MINOR.PATCH`

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
