# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This repo **is a Claude Code plugin**, not an application. There is no build step, no test runner, and no dev server. "Running" it means installing it into Claude Code and invoking its skills/agents from a user workspace.

Two audiences must not be confused:
- **Root `CLAUDE.md`** (this file) — for Claude instances *developing* the plugin.
- **`templates/CLAUDE.md`** — deployed into a user's workspace by `/prospect-studio:setup`. Edit it when changing user-facing workflows, skills, agents, or frontmatter conventions.

## Install / Iterate Loop

No test suite. The dev loop is:

1. Edit files under `agents/`, `skills/`, `hooks/`, `scripts/`, `mcp-server/`, or `templates/`.
2. In Claude Code: `/plugin marketplace add D:/projects/prospect-studio` then `/plugin install prospect-studio@prospect-studio-marketplace` then `/reload-plugins`.
3. In a throwaway workspace: `/prospect-studio:setup` and exercise the changed skill/agent.
4. Bump `version` in `.claude-plugin/plugin.json` and add an entry to `CHANGELOG.md` before merging.

The SessionStart hook `scripts/install-deps.sh` runs `npm install` for the MCP server into `${CLAUDE_PLUGIN_DATA}` automatically when `mcp-server/package.json` changes — you don't install node_modules manually.

## Architecture

The plugin is five cooperating layers wired together by `.claude-plugin/plugin.json`, `.mcp.json`, and `hooks/hooks.json`:

1. **Agents** (`agents/*.md`) — specialized subagents invoked by natural-language routing or by other agents. The set is intentionally scoped to lead generation only: `sales` (orchestrator), `research`, `discovery`, `outreach`, `analyst`, `coach`.

   **`sales` is the top-level strategist / orchestrator.** It's the default entry point for any open-ended or goal-shaped request ("help me hit quota", "run into fintech", "what should I work on"). It plans, judges, and delegates — it never does raw scraping, outreach drafting, or profile authoring itself. Its `disallowedTools` explicitly removes the bundled scraper tools (`scrape_url`, `scrape_company_intel`, `find_contacts`, `batch_scrape`) and Bash to force delegation through the specialists. It *does* hold direct Frappe tools for dedup/preview/push and SerpAPI for quick sanity checks.

   **Delegation graph**: `sales` → {`research`, `discovery`, `outreach`, `analyst`, `coach`}; `discovery` → `research` (for stage 2 deep-dives). `research` owns all paid Apify calls. `coach` is read-only (no Write tool) and only reviews sales artifacts. Tool allowlists are declared in each agent's frontmatter and must be kept minimal — if you add a new cross-cutting capability, prefer routing it through `sales` as an orchestration pattern rather than giving every specialist direct access.

2. **Skills** (`skills/*/SKILL.md`) — user-facing entry points (`/prospect-studio:<name>`). Skills orchestrate agents and MCP tools; they don't do heavy lifting themselves. Skill names appear in `templates/CLAUDE.md` — when adding/removing a skill, update that template in the same commit.

3. **MCP servers** (`.mcp.json`): five servers are wired in — `web-scraper` and `frappe` (local, both bundled under `mcp-server/` and sharing a single `package.json`/`node_modules`), `playwright` (npx), `serpapi` (remote, auth via `${user_config.serpapi_key}`), and `apify` (remote, auth via `${user_config.apify_token}`). `web-scraper/server.js` is HTTP+cheerio only; when a page needs JS it returns a structured "Playwright MCP needed" hint rather than spawning a browser. `frappe-server.js` is a port of the KStar OpenCode plugin — it hits a Frappe/ERPNext `/api/resource/Lead` REST endpoint with `Authorization: token <key>:<secret>`. `NODE_PATH` points at `${CLAUDE_PLUGIN_DATA}/node_modules` because deps live outside the repo, and **both local servers share the same install** — if you add a dep to one, it's available to the other automatically.

   **Apify is a paid service and deliberately constrained.** The URL pins exactly four Actors plus `docs`: `code_crafter/leads-finder`, `harvestapi/linkedin-company-employees`, `dev_fusion/Linkedin-Profile-Scraper`, `apidojo/tweet-scraper`. `search-actors`/`add-actor` are intentionally **not** enabled — we don't want agents discovering and spinning up arbitrary paid Actors. `apify_token` is optional; if blank, all Apify calls fail and agents must fall back silently to SerpAPI + web-scraper without mentioning Apify. The "ask-user-before-every-call + high-score-leads-only + never-in-stage-1-bulk-discovery" rules live in `agents/research.md` (Step 1b), `agents/discovery.md` (Apify Rules section), and `templates/CLAUDE.md` (Apify MCP Usage section). **Any change to Apify behavior must update all three in lockstep** — the rules are the load-bearing cost-control.

   **Frappe is optional too.** Four user config fields — `frappe_url`, `frappe_api_key`, `frappe_api_secret`, `frappe_lead_owner` — if any of the first three is blank, `frappe-server.js` returns a "not configured" error on every call and agents must fall back silently (no Frappe mention). The server reads these from env. The server's `parseLeadProfile` function is the single source of truth for the workspace → Frappe field mapping — it prefers frontmatter, falls back to `**Label:**` bold markers and a Key Contacts markdown table. When the Frappe `Lead` schema in the source server file changes (enums, new fields), three files must move together: `mcp-server/frappe-server.js` (zod shape + enum lists + mapping functions), `templates/CLAUDE.md` (the "Frontmatter Standard" → "Lead profiles" block and the field mapping table), and `agents/research.md` (Step 3 frontmatter template). They are a coupled contract.

4. **Hooks** (`hooks/hooks.json`) — three automations:
   - `SessionStart`: `install-deps.sh` (MCP deps) + `deadline-monitor.py` (scans `documents/leads/` only and writes `notes/daily/YYYY-MM-DD-brief.md` with pipeline counts + stale-lead alerts).
   - `PostToolUse` on `Write|Edit`: `track-document.py` appends to `documents/activity-log.md`.
   - `PostToolUse` on `mcp__serpapi|WebFetch|WebSearch`: `track-search.py` appends to `research/search-log.md`.
   Hook scripts are Python 3 and Bash — they must exit 0 on any error (never block the session). They read `WORKSPACE_ROOT` from env / user config, not from `cwd`.

5. **User workspace contract** — `templates/CLAUDE.md` defines the directory layout, frontmatter schema, file naming, and the set of auto-tracked files (`activity-log.md`, `search-log.md`, `notes/daily/*-brief.md`). Scripts that write into the workspace must respect these paths and the "do not edit manually" auto-tracked files. Frontmatter fields (`status`, `source`, `discovery_batch`, etc.) are a shared contract between skills, agents, and the pipeline-review logic — don't add new values without updating the template and any skill that filters on them.

## Cross-cutting Conventions

- **Paths with `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`** are resolved by the harness. Use them in `.mcp.json` / `hooks.json` / scripts — never hardcode absolute paths.
- **User config** is referenced as `${user_config.<key>}` in `.mcp.json` and declared in `plugin.json`'s `userConfig`. `serpapi_key` is `sensitive: true` (keychain-backed). Never log or persist it.
- **LinkedIn must never be scraped by the bundled `web-scraper` or Playwright** — LinkedIn bot-blocks aggressively and it's a TOS violation. The rule is enforced in the web scraper and must be preserved. SerpAPI is used to find LinkedIn URLs; the Apify MCP (when configured) is the sanctioned path for actual LinkedIn profile/company data via maintained Actors. Keep this three-way distinction coherent in agent prompts and `templates/CLAUDE.md`.
- **Bulk discovery tagging**: leads produced by the `discovery` agent or `csv-import` skill carry `source: bulk-discovery|csv-import` and `discovery_batch: YYYY-MM-DD-[topic]` frontmatter; `pipeline-review` groups unqualified prospects by this batch. Changes to either side must stay in sync.
- **Windows-first environment**: this repo is developed on Windows under bash. Use forward slashes and Unix shell syntax in scripts; `install-deps.sh` is Bash and must stay POSIX.
