# Lead Generation & Sales Workspace

Personal workspace for B2B lead generation, prospecting, outreach, and competitive research — powered by the prospect-studio Claude Code plugin.

## Directory Structure

```
documents/           # Main document storage
  |- leads/          # Lead profiles and research (YYYY-MM-DD-company-name.md)
  |- projects/
  |   |- battlecards/
  |- templates/      # Document templates
  |- archive/        # Archived documents
  |- activity-log.md # Auto-tracked document activity (do not edit)

research/            # Market & lead research outputs
  |- search-log.md   # Auto-tracked web search history (do not edit)

notes/               # Quick notes and captures
  |- daily/          # Daily briefs (auto-generated on session start)
  |- meetings/       # Meeting notes
  |- quick/          # Quick captures

exports/             # Exported documents (DOCX, PPTX, XLSX, CSV)
```

## Available Skills

### `/prospect-studio:sales` ⭐ — **start here for open-ended asks**
Talk to the core sales strategist. Use whenever the request is strategic rather than task-shaped.
- "Help me hit quota" / "What should I work on today"
- "Run a campaign into [market]"
- "Judge these leads for me"
- "Build me a sales plan for [company/industry]"
- "Take this list and make it produce"

The sales agent plans, delegates to the specialist agents, judges results, and ends with a recommendation. For task-shaped requests ("research Acme", "draft outreach for Beta"), skip `sales` and go directly to the specialist.

### `/prospect-studio:daily-briefing`
Morning pipeline briefing — stale leads, stage counts, recommended next actions.
- "Good morning" / "Brief me" / "Daily standup" / "Catch me up"

### `/prospect-studio:lead-research`
Research and qualify a single lead, gather company information, find contacts, build a lead profile.
- "Research [company] as a lead"
- "Qualify this prospect"

### `/prospect-studio:prospect-discovery`
Bulk-discover potential customers — the discovery agent asks about your business and ICP, finds matching companies, and scores them.
- "Find me leads" / "Discover prospects"
- "Find [industry] companies for my business"
- "Who should I sell to?"

### `/prospect-studio:csv-import`
Import a CSV of companies for enrichment and scoring with flexible column mapping.
- "Import leads from [file path]"
- "Enrich this CSV"

### `/prospect-studio:pipeline-review`
Full lead pipeline view — status distribution, stale contacts, hot leads, recommended next actions.
- "Review my pipeline" / "Who should I follow up with?" / "Pipeline report"

### `/prospect-studio:meeting-notes`
Capture structured meeting notes with auto-extracted action items.
- "Take meeting notes"
- "Log this meeting with [person/company]"

### `/prospect-studio:competitive-intel`
Research competitors, build comparison matrices, identify market gaps, generate battlecards.
- "Competitive analysis for [market]"
- "Battlecard for [competitor]"

### `/prospect-studio:weekly-report`
Generate weekly pipeline status report — optionally export as PPTX.
- "Weekly report" / "What did I accomplish this week?"

## Workflows

### Daily Sales Routine
1. Session opens → `deadline-monitor` auto-scans leads → writes `notes/daily/YYYY-MM-DD-brief.md`
2. Say "good morning" or "brief me" → `daily-briefing` skill reads workspace state → full morning pipeline briefing
3. Work through follow-ups, new prospects, and outreach
4. End of week: "weekly report" → `weekly-report` skill generates a pipeline summary

### Single-Lead Workflow
1. **Enrich** with `scrape_company_intel` → gets emails, tech stack, social profiles directly from company site
2. **Research** with research agent → SerpAPI for news, funding, pain points
3. **Build lead profile** → saved to `documents/leads/YYYY-MM-DD-company-name.md`
4. **Review pipeline** with `pipeline-review` skill
5. **Draft outreach** with outreach agent → personalized 4-touch email sequence
6. **Log responses** as meeting notes with `meeting-notes` skill
7. **Track stage**: `new` → `contacted` → `qualified` → `nurturing` → `closed`

### Bulk Lead Discovery
1. **Discover** — "find me leads" → discovery agent asks about your business and ICP
2. **Score** — agent searches via SerpAPI, quick-scrapes homepages, scores 15-50 companies
3. **Select** — review summary table, pick companies to deep-dive (by number or score threshold)
4. **Deep-dive** — selected companies get full lead profiles via research agent
5. **Outreach** — "draft outreach for [company]" for any qualified lead
6. **CSV import** — "import leads from [path]" to enrich an external company list

Bulk-discovered leads are tagged with `source: bulk-discovery` and `discovery_batch: YYYY-MM-DD-[topic]` in frontmatter. They appear in pipeline review under "Unqualified Prospects" until deep-dived.

### Competitive Research
1. "Competitive analysis for [market]" → analyst agent
2. Builds comparison matrix + battlecards
3. Saved to `research/` and `documents/projects/battlecards/`
4. "Coach, review this battlecard" → coach agent gives feedback

## Subagents

The `sales` agent is the orchestrator — it plans and delegates to the four specialists below. Use `sales` for open-ended goals; go directly to a specialist for task-shaped requests.

| Subagent | Role | Trigger With |
|----------|------|--------------|
| `sales` ⭐ | **Strategist / orchestrator.** Thinks, plans, judges, delegates. Never does raw scraping itself. | "Help me hit quota", "what should I work on", "run into [market]", "judge these leads", "build me a plan" |
| `research` | Deep-dive specialist — one company at a time. Owns all paid Apify calls. Authors lead profiles. Pushes to Frappe. | "Research [company]", "find contacts at [company]", "qualify this lead" |
| `discovery` | Bulk prospector — 15-50 companies at a time. Quick-scores then hands top picks to `research`. | "Find me leads", "discover companies in [industry]", "bulk lead discovery" |
| `outreach` | Email / sequence writer. Drafts personalised first touches and follow-ups. | "Draft outreach for [lead]", "write follow-up email", "create email sequence" |
| `analyst` | Competitive positioning and market landscape. | "Competitive analysis", "market research", "battlecard for [company]" |
| `coach` | Read-only reviewer of outreach emails, lead profiles, battlecards, pitches. | "Review this", "coach me on this email", "is this good?" |

**Delegation rule:** when the user's ask is strategic (goal + context + no specific task), route through `sales`. When it's a clear single task ("research Acme"), route directly to the specialist.

## Frappe / ERPNext CRM Sync

If the user configured `frappe_url` + `frappe_api_key` + `frappe_api_secret` during plugin setup, researched leads can be pushed into their Frappe/ERPNext `Lead` DocType. If those are blank, Frappe tools fail silently — fall back to local files only and don't mention Frappe.

### Push workflow (single lead)

1. Finish the research and save the lead profile to `documents/leads/YYYY-MM-DD-company-name.md` with enriched frontmatter (see "Lead profiles" under Frontmatter Standard).
2. **Preview first** — call `frappe_parse_lead_file` with the relative path to see exactly what will be sent. Show the parsed JSON to the user.
3. **Confirm with the user** — "Push this lead to Frappe?" Wait for explicit yes.
4. Call `frappe_push_lead_file` with the same relative path. Optionally pass `overrides` to patch any field (e.g. `{ qualification_status: "Qualified" }`).
5. Append the returned Frappe document name (e.g. `CRM-LEAD-2026-00042`) to the lead profile's Sources section and update its workspace `status` to reflect any state change.

### Push workflow (bulk from csv-import or deep-dived discovery batch)

1. Make sure every lead in the batch has at least `company_name` and ideally `first_name`/`email_id` in frontmatter.
2. Ask the user before pushing — show a count and a sample row.
3. Call `frappe_push_leads_batch` with `continueOnError: true` so one bad row doesn't abort the whole batch.
4. Report back: how many inserted, how many skipped, and which.

### Tool reference

| Tool | Use For |
|---|---|
| `frappe_parse_lead_file` | Preview what a lead profile will look like as a Frappe Lead — no network call |
| `frappe_push_lead_file` | Parse + push a single lead profile to Frappe |
| `frappe_create_lead` | Create a lead from explicit field values (when you don't have a profile file yet) |
| `frappe_push_leads_batch` | Bulk insert_many — for csv-import / deep-dived discovery batches |
| `frappe_list_leads` | Query existing leads — useful for dedup before pushing |
| `frappe_get_lead` | Read one lead by Frappe id |
| `frappe_update_lead` | Patch a lead after a meeting or status change |
| `frappe_lead_count` | Count leads matching filters |

### Rules
- **Always preview + confirm before pushing.** Pushing to a live CRM is a side effect on shared infrastructure.
- **Dedup before creating** — call `frappe_list_leads` with a `company_name` filter first. If a match exists, prefer `frappe_update_lead` over creating a duplicate.
- **Fill frontmatter during research, not at push time.** The better the frontmatter, the cleaner the Frappe record. Avoid push-time scrambling.
- **Map status both ways.** After a push, update the workspace `status` to reflect Frappe's view of the lead (e.g. if you flipped it to `qualified`, the push will set Frappe status to `Interested` — note that in the profile).

## Data Sources

prospect-studio has four web data sources. Pick the right one for the job:

| Source | Use For | Cost | Notes |
|---|---|---|---|
| `web-scraper` (bundled) | Company website enrichment (home/about/pricing/team/contact) | Free | HTTP+cheerio, no browser, very fast |
| `playwright` MCP | JS-heavy pages the web-scraper can't read | Free | Only when web-scraper flags "Playwright MCP needed" |
| `serpapi` MCP | Search for companies, news, funding, LinkedIn URLs | Metered | Preferred for search queries |
| `apify` MCP | LinkedIn employee/profile data, premium ICP bulk-finder, Twitter/X posts | 💰 **Expensive** | Optional. **Hot leads only, always ask first** — see Apify rules below |

### Web Scraper Usage

**Always use `scrape_company_intel` before web search for lead enrichment** — it gets emails and tech stack from the company website in one call.

**HTTP first → Playwright MCP fallback**
1. `scrape_company_intel` / `scrape_url` → HTTP fetch + cheerio (fast, no browser)
2. If response flags "Playwright MCP needed" → use Playwright MCP:
   - `navigate_page` → URL
   - Wait for content to load
   - `take_snapshot` or extract text

**Never scrape LinkedIn with the bundled `web-scraper` or `playwright`** — LinkedIn bot-blocks aggressively and it's a TOS violation. Use SerpAPI to find LinkedIn URLs, and use the Apify MCP for compliant profile/company data.

| Tool | Use For |
|------|---------|
| `scrape_url` | Deep-read a single page |
| `scrape_company_intel` | Auto-scrape home/about/pricing/team/contact pages |
| `find_contacts` | Extract emails, phones, social links from any domain |
| `batch_scrape` | Scrape 2–20 URLs at once (modes: summary, full, contacts-only) |

### Apify MCP Usage — ⚠️ EXPENSIVE, OPT-IN, HIGH-VALUE LEADS ONLY

The Apify MCP server gives access to premium maintained scrapers ("Actors"). **Actor runs cost real money per call** — sometimes several cents to several dollars per run depending on the Actor and dataset size. Treat Apify the way you'd treat a paid phone-call to a data vendor: only when the lead is worth it, and only with explicit user consent.

Only available if the user set `apify_token` during plugin setup. If they didn't, Apify tools will fail — fall back to SerpAPI + the bundled `web-scraper` silently and don't mention Apify.

#### Hard rules (must follow)

1. **Never call an Apify Actor without asking the user first.** Show which Actor, on which target, and a one-line reason. Wait for an explicit "yes". Example:
   > "This lead looks hot. I'd like to pull their LinkedIn employee list using `harvestapi/linkedin-company-employees` — this will cost a small Apify credit. Proceed?"
2. **Only use Apify on qualified, high-value leads.** A lead qualifies if **any** of these are true:
   - `icp_score` ≥ 7 in the lead profile
   - `priority: high` or `priority: urgent` in frontmatter
   - User explicitly called it a "hot lead", "priority lead", or asked for deep enrichment by name
3. **Never use Apify during bulk discovery stage 1** (the quick-score pass over 15-50 companies). Stage 1 is SerpAPI + bundled `scrape_url` only. Apify may be used in *stage 2 deep-dive* — and only on the companies the user selected from the summary table, one at a time, with per-call confirmation.
4. **Never batch-call Apify across many leads in one go.** One lead, one confirmation, one Actor call.
5. **Always try the free path first.** If `scrape_company_intel` + SerpAPI can answer the question, use them. Only reach for Apify when the data is behind a login wall, LinkedIn, or a directory the bundled scraper demonstrably can't read.
6. **Cite the Actor and `datasetId`** in the lead profile's Sources section so the user can trace the spend.

#### Sanctioned Actors (pinned in `.mcp.json`)

These four Actors are always loaded — use them by name rather than going through `search-actors`:

| Actor | Use For | Typical Trigger |
|---|---|---|
| `code_crafter/leads-finder` | Find companies matching an ICP (industry + size + location + keywords) in bulk | User asks to "find more leads like X" on a *hot* lead, or wants premium ICP-matched company lists beyond what SerpAPI returns |
| `harvestapi/linkedin-company-employees` | Pull the employee roster of a specific company from LinkedIn — get titles, seniority, decision-makers | Deep-dive on a qualified lead where you need to identify the actual buyer / champion |
| `dev_fusion/Linkedin-Profile-Scraper` | Pull a single LinkedIn profile — background, role history, recent activity | Outreach prep for a named decision-maker once the user has picked who to contact |
| `apidojo/tweet-scraper` | Pull recent tweets/X posts from a company or person handle | Detecting buying signals, pain points, recent product launches, or personalization hooks for outreach |

Other Actors exist in Apify Store but are **not** enabled in this workspace by default. Do not suggest them unless the user explicitly asks to install one.

#### Workflow

```
1. Finish free-tier research first (scrape_company_intel + SerpAPI + web-scraper)
2. Confirm lead qualifies (icp_score ≥ 7 or priority: high/urgent or user-flagged hot)
3. Ask user: "I'd like to run <actor> on <target> to get <specific data>. This is a paid
   Apify call. Proceed?"
4. On yes → call the Actor with minimal input (just what's needed)
5. Use get-actor-output with the returned datasetId to pull full results
6. Merge the data into the lead profile
7. Cite: "Source: Apify <actor-name> (datasetId: <id>) — <YYYY-MM-DD>"
```

#### When to stick with free tools instead of Apify
- Simple company website reads → `scrape_company_intel` (free, faster)
- Plain Google search results / finding URLs → `serpapi` (cheaper per call)
- Reading a page where you already have the URL → `WebFetch` or `scrape_url`
- Stage 1 bulk quick-scoring → SerpAPI + `scrape_url` only
- Leads that aren't yet qualified → wait until they are

## Document Generation

To create DOCX, PPTX, XLSX, or CSV files, Claude generates and runs a Python script:

```python
# Example: Create a Word document
from docx import Document
doc = Document()
doc.add_heading('Title', 0)
doc.add_paragraph('Content here')
doc.save('exports/YYYY-MM-DD-document.docx')
```

**Prerequisites** (install once):
```bash
pip install python-docx python-pptx openpyxl
```

Always save exports to the `exports/` folder.

## File Naming Conventions

- Leads: `YYYY-MM-DD-company-name.md`
- Meetings: `YYYY-MM-DD-company-name-meeting.md`
- Research: `YYYY-MM-DD-topic-analysis.md`
- Battlecards: `YYYY-MM-DD-competitor-name-battlecard.md`

## Frontmatter Standard

### Non-lead documents (meetings, research, battlecards, notes)

```yaml
---
title: Document Title
type: meeting|research|battlecard|note
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: draft|active|archived
priority: urgent|high|medium|low
tags: []
---
```

### Lead profiles — enriched & Frappe-mappable

Every field below is optional except `title`, `type`, `company_name`, and `status`. The `frappe_push_lead_file` tool reads this frontmatter directly, so the better you fill it in during research, the cleaner the CRM record.

```yaml
---
# Core
title: Acme Corp — Lead Profile
type: lead
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: new|prospect|contacted|qualified|nurturing|closed
priority: urgent|high|medium|low
icp_score: 8              # 1-10 scale — auto-mapped to Frappe 0-100
tags: [saas, mid-market]
source: manual|bulk-discovery|csv-import
discovery_batch: YYYY-MM-DD-[topic]

# Company (Frappe mapping)
company_name: Acme Corporation
website: https://acme.com
industry: SaaS
city: San Francisco
state: CA
country: USA
no_of_employees: "51-200"     # Frappe band: 1-10|11-50|51-200|201-500|501-1000|1000+
tech_stack: React, Node, AWS
company_linkedin: https://linkedin.com/company/acme

# Primary contact (Frappe mapping)
first_name: Jane
last_name: Doe
job_title: VP Engineering
email_id: jane@acme.com
mobile_no: +1-555-0100
contact1_linkedin: https://linkedin.com/in/janedoe
---
```

**Field mapping to Frappe `Lead` DocType:**

| Workspace frontmatter | Frappe field | Notes |
|---|---|---|
| `company_name` | `company_name` | Required for push |
| `website` | `website` | |
| `industry` | `industry` | |
| `city` / `state` / `country` | same | |
| `no_of_employees` | `no_of_employees` | Must match Frappe band enum |
| `tech_stack` | `tech_stack` | |
| `company_linkedin` | `company_linkedin` | |
| `first_name` / `last_name` | same | Falls back to first word of `company_name` if missing |
| `job_title` | `job_title` | |
| `email_id` | `email_id` | |
| `mobile_no` | `mobile_no` | |
| `contact1_linkedin` | `contact1_linkedin` | |
| `icp_score` (1-10) | `lead_score` (0-100) | Multiplied by 10 |
| `priority` | `qualification_status` | high/urgent → Qualified, medium → In Process, low → Unqualified |
| `status` (workspace) | `status` (Frappe) | new→Lead, contacted→Open, qualified→Interested, nurturing→Replied, closed→Converted |
| `source` | `source` | manual→Website, bulk-discovery→Campaign, csv-import→Mass Mailing, etc. |
| Body section `## Pain Points` | `pain_points` | First 4000 chars |
| `icp_score` + `priority` + `source` | `automation_notes` | Concatenated for traceability |

## Auto-Tracked Files

- `documents/activity-log.md` — auto-logged on every Write/Edit — **do not edit manually**
- `research/search-log.md` — auto-logged on every search — **do not edit manually**
- `notes/daily/YYYY-MM-DD-brief.md` — auto-written on session start — **do not edit manually**

## SerpAPI Usage

For all company/market/contact web research, use the SerpAPI MCP search tool. **Two engines are first-class and both matter — pick based on the lead type:**

1. **Google Web Search** (`engine: "google"`) — default for everything digital: SaaS, B2B, funded startups, remote companies, news/funding/people lookups, LinkedIn URL discovery.
2. **Google Maps Local Business** (`engine: "google_maps"`, with `type: "search"` and a `ll` lat/long or location query) — **required** for any brick-and-mortar / local ICP: clinics, gyms, restaurants, salons, auto shops, contractors, retail, local service businesses. Returns place name, address, phone, website, rating, review count, category, hours — all high-signal for lead profiles. Never try to scrape these off Google SERPs; use the Maps engine directly.

**Rules:**
- If the user's ICP is location-bound ("dentists in Austin", "gyms in Dubai"), start with `google_maps`. If it's not ("B2B SaaS in fintech"), start with `google`.
- A single discovery sweep may use *both* engines — e.g. `google_maps` to enumerate local businesses, then `google` on each name to find owner/website/news.
- Always pass `q` (and `ll`/`location` for maps). Always cite result URLs (or Google Maps place URLs) in lead profiles and research documents.
- Prefer SerpAPI over generic web tools for any business research.
