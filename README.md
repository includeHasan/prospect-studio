# prospect-studio

> B2B lead generation, market research, and business document workspace for [Claude Code](https://claude.ai/code).

A Claude Code plugin with 5 specialized subagents, 10 skills, a web scraper MCP server, and automated workspace tracking — migrated and improved from OpenCode.

---

## What It Does

| Capability | How |
|---|---|
| Research any company as a lead | `research` agent + web scraper + SerpAPI |
| Build 4-touch outreach sequences | `outreach` agent reads lead profiles |
| Competitive analysis + battlecards | `analyst` agent |
| PRD/FRD writing | `planning` agent |
| Document review & feedback | `coach` agent |
| Morning briefing + pipeline review | skills |
| Auto-log all activity & searches | PostToolUse hooks |
| Daily brief on session start | SessionStart hook |

---

## Prerequisites

- [Claude Code](https://claude.ai/code) installed and authenticated
- [Node.js](https://nodejs.org) 18+ (for the web scraper MCP server)
- [Python 3.8+](https://python.org) (for hook scripts)
- A [SerpAPI](https://serpapi.com) account (free tier available)
- For document exports: `pip install python-docx python-pptx openpyxl`

---

## Install

Run these three commands in Claude Code (not the terminal):

```
/plugin marketplace add github:includeHasan/prospect-studio
/plugin install prospect-studio@prospect-studio-marketplace
/reload-plugins
```

You'll be prompted to enter:
1. SerpAPI key (stored in OS keychain — never written to disk)
2. Workspace root path (e.g. `D:/work/leads` or `/home/user/leads`)

**For local install** (if you cloned the repo):
```
/plugin marketplace add /path/to/prospect-studio
/plugin install prospect-studio@prospect-studio-marketplace
/reload-plugins
```

---

## First-Time Setup

Navigate to your workspace directory, then run the setup skill:

```
/prospect-studio:setup
```

This creates the full workspace folder structure and deploys `CLAUDE.md` to your workspace root. Run it once per workspace.

---

## Usage

### Skills (invoke directly)

```
/prospect-studio:daily-briefing     → Morning standup from workspace state
/prospect-studio:lead-research      → Research a company as a lead
/prospect-studio:pipeline-review    → Full pipeline + follow-up recommendations
/prospect-studio:meeting-notes      → Structured meeting notes + action items
/prospect-studio:competitive-intel  → Competitive analysis + battlecards
/prospect-studio:weekly-report      → Weekly status report (+ optional PPTX)
/prospect-studio:prd-writer         → Create PRD or FRD
/prospect-studio:task-manager       → Create and track tasks
/prospect-studio:goal-tracker       → OKR setting and progress tracking
```

### Natural language (Claude routes automatically)

```
"Research Stripe as a lead"
"Draft outreach for Acme Corp"
"Good morning"
"Who should I follow up with?"
"Competitive analysis for the CRM market"
"Create a PRD for user authentication"
"Coach, review this email"
"Set Q2 OKRs"
```

---

## Web Scraper

The bundled `web-scraper` MCP server scrapes company websites without a browser:

| Tool | Use |
|---|---|
| `scrape_company_intel` | Auto-scrape home/about/pricing/team/contact pages |
| `scrape_url` | Deep-read a single page |
| `find_contacts` | Extract emails, phones, social links |
| `batch_scrape` | 2–20 URLs at once |

When pages are JS-heavy or bot-protected, the tool returns Playwright MCP instructions automatically. No local Chromium install needed.

> **Never scrape LinkedIn** — use SerpAPI to find LinkedIn URLs instead.

---

## Workspace Structure

After running `/prospect-studio:setup`:

```
your-workspace/
├── CLAUDE.md              ← workspace instructions (deployed by setup)
├── documents/
│   ├── leads/             ← YYYY-MM-DD-company-name.md
│   ├── prd/               ← YYYY-MM-DD-feature-name-prd.md
│   ├── frd/
│   ├── tasks/active|completed|backlog/
│   ├── goals/YYYY/q1-q4/
│   ├── projects/battlecards/
│   └── activity-log.md    ← auto-managed
├── research/
│   └── search-log.md      ← auto-managed
├── notes/daily|meetings|ideas|quick/
└── exports/               ← DOCX, PPTX, XLSX outputs
```

---

## Team Usage

Each team member runs these in Claude Code:

```
/plugin marketplace add github:includeHasan/prospect-studio
/plugin install prospect-studio@prospect-studio-marketplace
/reload-plugins
```

Then in their workspace directory:
```
/prospect-studio:setup
```

SerpAPI keys are stored per-user in the OS keychain. Workspace data stays local.

---

## Update

Pull the latest from GitHub, then in Claude Code:

```
/plugin marketplace add github:includeHasan/prospect-studio
/plugin install prospect-studio@prospect-studio-marketplace
/reload-plugins
```

Dependencies auto-reinstall on next session start if `package.json` changed.

---

## Contributing

1. Fork the repo
2. Test changes locally:
   ```
   /plugin marketplace add /path/to/prospect-studio
   /plugin install prospect-studio@prospect-studio-marketplace
   /reload-plugins
   ```
3. Run `/prospect-studio:setup` in a test workspace to validate
4. Bump `version` in `.claude-plugin/plugin.json`
5. Update `CHANGELOG.md`
6. Open a pull request

---

## License

MIT
