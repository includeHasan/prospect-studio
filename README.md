# prospect-studio

> B2B lead generation, prospecting, and outreach workspace for [Claude Code](https://claude.ai/code).

A Claude Code plugin with 6 specialized sales subagents (led by a `sales` strategist that plans and delegates), 10 skills, bundled web-scraper and Frappe/ERPNext MCP servers, and integrations with SerpAPI, Playwright, and Apify — focused exclusively on lead generation.

---

## What It Does

| Capability | How |
|---|---|
| Research any company as a lead | `research` agent + web scraper + SerpAPI |
| Bulk-discover prospects for your ICP | `discovery` agent + SerpAPI |
| Premium LinkedIn / ICP enrichment | Apify MCP (opt-in, paid, confirmation-gated) |
| **Push leads to Frappe/ERPNext CRM** | Bundled `frappe` MCP — maps lead profile frontmatter directly to Frappe `Lead` DocType |
| Build 4-touch outreach sequences | `outreach` agent reads lead profiles |
| Competitive analysis + battlecards | `analyst` agent |
| Review outreach emails & battlecards | `coach` agent |
| Morning pipeline briefing | `daily-briefing` skill |
| Auto-log all activity & searches | PostToolUse hooks |
| Daily pipeline brief on session start | SessionStart hook |

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
1. **SerpAPI key** — stored in OS keychain, never written to disk
2. **Apify API token** — *optional, leave blank to skip.* Enables premium LinkedIn & ICP enrichment via four pinned Actors. ⚠️ Paid — always confirmation-gated. Get one from [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations).
3. **Frappe URL / API key / API secret / lead owner** — *optional, leave blank to skip.* Enables pushing researched leads into a Frappe/ERPNext CRM. Get the key + secret from your Frappe user's Settings → API Access.
4. **Workspace root path** — e.g. `D:/work/leads` or `/home/user/leads`

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
/prospect-studio:sales              → ⭐ Talk to the core sales strategist (start here)
/prospect-studio:daily-briefing     → Morning pipeline briefing
/prospect-studio:lead-research      → Research a single company as a lead
/prospect-studio:prospect-discovery → Bulk-discover prospects for your ICP
/prospect-studio:csv-import         → Import a CSV of companies for enrichment
/prospect-studio:pipeline-review    → Full pipeline + follow-up recommendations
/prospect-studio:meeting-notes      → Structured meeting notes + action items
/prospect-studio:competitive-intel  → Competitive analysis + battlecards
/prospect-studio:weekly-report      → Weekly pipeline status report (+ optional PPTX)
```

### Natural language (Claude routes automatically)

```
"Research Stripe as a lead"
"Find me leads in fintech"
"Draft outreach for Acme Corp"
"Good morning"
"Who should I follow up with?"
"Competitive analysis for the CRM market"
"Coach, review this email"
```

---

## Data Sources

prospect-studio has four web data sources, tiered by cost:

| Source | Use For | Cost |
|---|---|---|
| `web-scraper` (bundled) | Company website enrichment — home/about/pricing/team/contact pages | Free |
| `playwright` MCP | JS-heavy pages the web-scraper can't read | Free |
| `serpapi` MCP | Search queries, news, funding, finding LinkedIn URLs | Metered |
| `apify` MCP | LinkedIn employee rosters, profiles, Twitter/X posts, premium ICP bulk-finder | 💰 **Expensive** |

**Apify is opt-in and strictly gated**:
- Only enabled if you set an `apify_token`
- Only suggested on high-score leads (`icp_score ≥ 7` or `priority: high/urgent`)
- The plugin **always** asks you for confirmation before any paid Actor call
- Forbidden during bulk-discovery stage 1 (quick-scoring) — prevents burning credits on unqualified companies
- Only four Actors are pinned: `code_crafter/leads-finder`, `harvestapi/linkedin-company-employees`, `dev_fusion/Linkedin-Profile-Scraper`, `apidojo/tweet-scraper`

**LinkedIn policy**: never scraped directly by the bundled `web-scraper` or Playwright (TOS + bot blocks). SerpAPI is used to find LinkedIn URLs; Apify is the sanctioned path for actual profile/company data.

---

## Workspace Structure

After running `/prospect-studio:setup`:

```
your-workspace/
├── CLAUDE.md              ← workspace instructions (deployed by setup)
├── documents/
│   ├── leads/             ← YYYY-MM-DD-company-name.md
│   ├── projects/battlecards/
│   └── activity-log.md    ← auto-managed
├── research/
│   └── search-log.md      ← auto-managed
├── notes/daily|meetings|quick/
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
