# Business Document & Research Workspace

Personal workspace for lead generation, product planning, task management, and goal tracking — powered by the lead-agent Claude Code plugin.

## Directory Structure

```
documents/           # Main document storage
  |- leads/          # Lead profiles and research
  |- prd/            # Product Requirements Documents
  |- frd/            # Functional Requirements Documents
  |- tasks/          # Task tracking
  |   |- active/
  |   |- completed/
  |   |- backlog/
  |- goals/          # Goals and OKRs
  |   |- YYYY/
  |   |   |- q1/ q2/ q3/ q4/
  |   |- annual/
  |- projects/       # Project documents
  |   |- battlecards/
  |- templates/      # Document templates
  |- archive/        # Archived documents
  |- activity-log.md # Auto-tracked document activity (do not edit)

research/            # Market & lead research outputs
  |- search-log.md   # Auto-tracked web search history (do not edit)

notes/               # Quick notes and captures
  |- daily/          # Daily briefs (auto-generated on session start)
  |- meetings/       # Meeting notes
  |- ideas/          # Ideas and concepts
  |- quick/          # Quick captures

exports/             # Exported documents (DOCX, PPTX, XLSX, CSV)
```

## Available Skills

### `/lead-agent:daily-briefing`
Morning briefing from workspace state — tasks due, overdue items, goal progress, lead pipeline.
- "Good morning" / "Brief me" / "What's on my plate today?"
- "Daily standup" / "Catch me up"

### `/lead-agent:meeting-notes`
Capture structured meeting notes with auto-extracted action items and optional task creation.
- "Take meeting notes"
- "Log this meeting with [person/company]"
- "Convert these notes into tasks"

### `/lead-agent:pipeline-review`
Full lead pipeline view — status distribution, stale contacts, hot leads, recommended next actions.
- "Review my pipeline"
- "Who should I follow up with?"
- "Pipeline report"

### `/lead-agent:competitive-intel`
Research competitors, build comparison matrices, identify market gaps, generate battlecards.
- "Competitive analysis for [market]"
- "Battlecard for [competitor]"
- "Who are the players in [space]?"

### `/lead-agent:weekly-report`
Generate weekly status report from workspace activity — optionally export as PPTX.
- "Weekly report" / "Week in review"
- "What did I accomplish this week?"
- "Export weekly status as PowerPoint"

### `/lead-agent:lead-research`
Research and qualify leads, gather company information, find contacts, build lead profiles.
- "Research [company] as a lead"
- "Find leads in [industry]"
- "Qualify this prospect"

### `/lead-agent:prd-writer`
Create PRDs and FRDs with proper structure, user stories, and acceptance criteria.
- "Create a PRD for [feature]"
- "Write FRD for [feature]"
- "Add requirements to [document]"

### `/lead-agent:task-manager`
Create, organize, and track tasks and projects with deadlines and progress.
- "Create task: [description]"
- "Show my tasks for today"
- "Mark task complete: [task name]"
- "Update project status"

### `/lead-agent:goal-tracker`
Set and track goals with OKRs, quarterly planning, and progress reviews.
- "Set Q2 OKRs"
- "Review my goals"
- "Update progress on [goal]"

## Workflows

### Daily Co-worker Routine
1. Session opens → `deadline-monitor` auto-scans tasks + leads → writes `notes/daily/YYYY-MM-DD-brief.md`
2. Say "good morning" or "brief me" → `daily-briefing` skill reads workspace state → full morning briefing
3. Work through tasks, leads, and goals throughout the day
4. End of day: "weekly report" → `weekly-report` skill generates a status summary

### Lead Generation & Sales
1. **Enrich** with `scrape_company_intel` → gets emails, tech stack, social profiles directly from company site
2. **Research** with research agent → SerpAPI for news, funding, pain points
3. **Build lead profile** → saved to `documents/leads/YYYY-MM-DD-company-name.md`
4. **Review pipeline** with `pipeline-review` skill
5. **Draft outreach** with outreach agent → personalized 4-touch email sequence
6. **Log responses** as meeting notes with `meeting-notes` skill
7. **Track stage**: `new` → `contacted` → `qualified` → `nurturing` → `closed`

### Market & Competitive Research
1. "Competitive analysis for [market]" → analyst agent
2. Builds comparison matrix + battlecards
3. Saved to `research/` folder
4. "Coach, review this battlecard" → coach agent gives feedback

### Product Planning
1. `prd-writer` skill → PRD saved to `documents/prd/`
2. "Coach, review this PRD" → coach agent grades and gives feedback
3. Break down into FRD → tasks in `documents/tasks/active/`
4. Track deadlines via `deadline-monitor`

### Task & Goal Management
1. Create tasks with `task-manager` skill with `due:` dates
2. `deadline-monitor` alerts on overdue/upcoming at every session start
3. Set quarterly OKRs with `goal-tracker`
4. Weekly review via `weekly-report` skill → export as PPTX for stakeholders

## Subagents

Delegate to these specialized subagents for focused work:

| Subagent | Trigger With | Key Tools |
|----------|-------------|-----------|
| `research` | "Research [company]", "Find contacts at [company]", "Qualify this lead" | scrape_company_intel, find_contacts, SerpAPI, WebFetch, Write, Edit |
| `planning` | "Create a PRD for...", "Write FRD for...", "Define requirements for..." | Write, Edit |
| `outreach` | "Draft outreach for [lead]", "Write follow-up email", "Create email sequence" | Write, Edit, SerpAPI, WebFetch |
| `analyst` | "Competitive analysis", "Market research", "Who are competitors in [space]", "Battlecard for [company]" | SerpAPI, WebFetch, Write |
| `coach` | "Review this", "Give me feedback on...", "Is this good?", "Coach me on this email/PRD/strategy" | Read, Edit (read-only reviewer — cannot Write) |

## Web Scraper Usage

**Always use `scrape_company_intel` before web search for lead enrichment** — it gets emails and tech stack from the company website in one call.

### HTTP first → Playwright MCP fallback
1. `scrape_company_intel` / `scrape_url` → HTTP fetch + cheerio (fast, no browser)
2. If response flags "Playwright MCP needed" → use Playwright MCP:
   - `navigate_page` → URL
   - Wait for content to load
   - `take_snapshot` or extract text
3. **Never scrape LinkedIn** — use SerpAPI to find LinkedIn URLs instead

### Tool Reference
| Tool | Use For |
|------|---------|
| `scrape_url` | Deep-read a single page |
| `scrape_company_intel` | Auto-scrape home/about/pricing/team/contact pages |
| `find_contacts` | Extract emails, phones, social links from any domain |
| `batch_scrape` | Scrape 2–20 URLs at once (modes: summary, full, contacts-only) |

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
- PRDs: `YYYY-MM-DD-feature-name-prd.md`
- FRDs: `YYYY-MM-DD-feature-name-frd.md`
- Tasks: `YYYY-MM-DD-task-title.md`
- Goals: `YYYY-QX-okrs.md`
- Meetings: `YYYY-MM-DD-company-name-meeting.md`
- Research: `YYYY-MM-DD-topic-analysis.md`

## Frontmatter Standard

All documents include:
```yaml
---
title: Document Title
type: lead|prd|frd|task|goal|note
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: draft|active|completed|archived
priority: urgent|high|medium|low
tags: []
---
```

## Auto-Tracked Files

- `documents/activity-log.md` — auto-logged on every Write/Edit — **do not edit manually**
- `research/search-log.md` — auto-logged on every search — **do not edit manually**
- `notes/daily/YYYY-MM-DD-brief.md` — auto-written on session start — **do not edit manually**

## SerpAPI Usage

For all company/market/contact web research, use the SerpAPI MCP search tool.
- Pass `q` as the search query parameter
- Prefer it over generic web tools for business research
- Always cite result URLs in lead profiles and research documents
