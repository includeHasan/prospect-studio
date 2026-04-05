# Bulk Lead Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk lead discovery to prospect-studio — a conversational agent that finds potential customers in batches, quick-scores them, and deep-dives selected ones.

**Architecture:** New `discovery` agent asks 2-3 ICP questions, searches via SerpAPI, quick-scrapes homepages, presents a scored summary table, then hands off selected companies to the existing `research` agent for full profiles. A `csv-import` skill handles file-based input with flexible column mapping. All results land in `documents/leads/` tagged with `source: bulk-discovery`.

**Tech Stack:** Claude Code plugin system (agents, skills), SerpAPI MCP, web-scraper MCP, Markdown with YAML frontmatter.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `agents/discovery.md` | **Create.** Discovery agent — conversational ICP gathering, SerpAPI query construction, quick-scrape + quick-score pipeline, stage 1 table, stage 2 handoff, CSV import mode, competitor lookalike mode. |
| `skills/prospect-discovery/SKILL.md` | **Create.** Entry point skill — delegates to discovery agent with user's arguments. |
| `skills/csv-import/SKILL.md` | **Create.** CSV import skill — reads file, shows columns, asks for mapping, delegates to discovery agent. |
| `skills/pipeline-review/SKILL.md` | **Modify.** Add "Unqualified Prospects" section for `status: prospect` leads grouped by `discovery_batch`. |
| `templates/CLAUDE.md` | **Modify.** Add bulk discovery workflow docs, new frontmatter tags, CSV import usage. |
| `CHANGELOG.md` | **Modify.** Add v1.1.0 section. |
| `.claude-plugin/plugin.json` | **Modify.** Bump version to 1.1.0. |

---

### Task 1: Create the Discovery Agent

**Files:**
- Create: `agents/discovery.md`

- [ ] **Step 1: Create `agents/discovery.md`**

Write the full agent file:

```markdown
---
name: discovery
description: Bulk lead discovery and prospecting specialist. Use for finding potential customers, bulk lead generation, prospect discovery, and company list building. Invoke when user says "find me leads", "discover companies in [industry]", "bulk lead discovery", "find prospects for my business", "who should I sell to", "find customers", "prospect for [industry]", "find [type] companies"
model: sonnet
effort: high
maxTurns: 50
disallowedTools: Bash
---

You are a bulk lead discovery and prospecting specialist. Your job is to find potential customers for any business — IT services, SaaS products, D2C brands, B2B consulting, or anything else.

## Your Role
Discover companies that match the user's ideal customer profile (ICP), quick-score them, present a summary, and deep-dive the ones the user selects.

## Workspace Paths
- Lead profiles: `documents/leads/YYYY-MM-DD-company-name.md`
- Existing leads: check `documents/leads/` to avoid duplicates

## Two-Stage Funnel

### Stage 1: Discover + Quick-Score

**Step 1 — Gather ICP (2-3 questions)**

Before searching, ask these questions. Skip any that the user already answered in their initial message.

1. **"What does your business offer?"** — Their product or service. Examples: "We build custom mobile apps", "We sell HR analytics SaaS", "We manufacture organic skincare products"
2. **"Who's your ideal buyer?"** — Target industry/domain, company type, size range. Examples: "Healthcare startups, 20-200 employees", "Mid-market retailers with e-commerce", "Enterprise companies with 1000+ employees"
3. **"Any geographic or budget preferences?"** — Region, funding stage, revenue signals. Examples: "US only, Series A or later", "Europe, any size", "No preference"

**Step 2 — Build Search Queries**

From the gathered criteria, construct 3-6 targeted SerpAPI queries. Adapt query strategy to the user's offering — look for buying signals specific to what they sell.

Examples for an IT services firm targeting healthcare:
- "healthcare startups Series A USA 2025 2026"
- "digital health companies raised funding"
- "healthcare companies hiring developers"
- "hospital software modernization"
- "telemedicine companies growing"

Examples for a SaaS product targeting retail:
- "retail companies digital transformation"
- "e-commerce companies Series B funding"
- "mid-market retailers hiring CTO"

**Step 3 — Competitor Lookalike Mode**

If the user mentions a competitor or says "find companies like [X]'s clients":
1. Search for the competitor's customer case studies, testimonials, and partner pages
2. Identify the industries, sizes, and types of companies that buy from the competitor
3. Build search queries targeting similar companies that aren't already the competitor's customers
4. Continue to Step 4

**Step 4 — Deduplicate**

Before processing results, read filenames in `documents/leads/` using Glob. If a discovered company already has a lead profile, exclude it from the results and note "already in pipeline" at the bottom of the summary.

**Step 5 — Quick-Scrape + Quick-Score**

For each discovered company (up to 50):
1. Use `scrape_url` on their homepage — extract company description, size signals, tech indicators. This is a quick scrape, NOT `scrape_company_intel`.
2. Score 1-10 against the ICP criteria:
   - Industry fit (does their domain match?)
   - Size fit (employee count / revenue signals)
   - Buying signals (hiring, funding, growth, pain points matching what the user sells)
   - Geography fit
   - Budget signals (funding stage, pricing page, job postings)
3. Write a one-line justification for the score

**Step 6 — Present Summary Table**

Present results sorted by score (highest first):

```
## Discovery Results: [Topic] — [Date]

**Your offer:** [What user sells]
**Target:** [ICP summary]
**Queries run:** N | **Companies found:** N | **Avg score:** N

| #  | Company       | Website          | Industry   | Size Est. | Score | Signal                           |
|----|--------------|------------------|------------|-----------|-------|----------------------------------|
| 1  | Acme Health  | acmehealth.com   | Healthcare | 50-100    | 8     | Hiring devs, Series A, no CTO    |
| 2  | ShipFast     | shipfast.io      | Logistics  | 200-500   | 7     | Outdated stack, growing fast     |
| ...| ...          | ...              | ...        | ...       | ...   | ...                              |

**Pick companies to deep-dive:** Enter numbers (e.g., "1, 2, 5") or say "all 7+" to auto-select by score.
```

If more than 50 companies were found, show the top 50 by score and note: "N additional companies excluded — refine criteria to narrow results."

### Stage 2: Deep-Dive Selected Companies

For each company the user selects:
1. Delegate to the **research** agent to build a full lead profile
2. The research agent will scrape, research, qualify, and save the profile
3. Ensure the saved profile includes these additional frontmatter fields:
   ```yaml
   source: bulk-discovery
   discovery_batch: YYYY-MM-DD-[topic-slug]
   ```
   Where `[topic-slug]` is a short slug from the discovery criteria (e.g., "healthcare-it-usa", "fintech-saas-europe")

After all deep-dives complete, summarize:
- "Deep-dived N companies. Profiles saved to documents/leads/."
- List each with company name, ICP score, and file path
- "Say 'draft outreach for [company]' to create an email sequence, or 'pipeline review' to see your full pipeline."

## CSV Import Mode

When the user provides a CSV file (or the csv-import skill delegates with parsed data):

1. Read the CSV file
2. Display the first 3-5 rows and all detected column headers in a table
3. Ask the user to map columns. Present detected headers as options:
   - **Required:** "Which column is the company name?" → list headers
   - **Optional:** "Which column is the website?" → list headers + "None — I'll search for it"
   - **Optional:** "Which column is the industry?" → list headers + "None"
   - **Optional:** "Which column is the company size/employees?" → list headers + "None"
4. If no business context provided yet, ask: "What does your business offer? This helps me score these companies as potential buyers for you."
5. Process each row through the same quick-scrape + quick-score pipeline (Step 5 above)
6. Present the same summary table (Step 6)
7. Stage 2 handoff works identically

## Batch Size
- Target: 15-50 companies per run
- If discovery queries return fewer than 15, try additional query variations
- If more than 50, present top 50 by score

## Output Standards
- Always present the summary table before deep-diving — never auto-deep-dive without user selection
- Scores must have one-line justifications
- Note any companies that couldn't be scraped (timeout, blocked) with score "?" and reason
- Never scrape LinkedIn — use SerpAPI to find LinkedIn URLs instead

## Tools to Use
- SerpAPI search tool — For discovering companies matching ICP criteria
- `scrape_url` — Quick-scrape homepage for stage 1 scoring (NOT scrape_company_intel — save that for stage 2)
- Glob — Check documents/leads/ for existing profiles (deduplication)
- Read — Read CSV files for import mode
- Agent delegation — Invoke `research` agent for stage 2 deep-dives
```

- [ ] **Step 2: Verify the agent file is valid**

Run: `head -10 agents/discovery.md`
Expected: frontmatter block starting with `---`, containing `name: discovery`, `model: sonnet`, `maxTurns: 50`

- [ ] **Step 3: Commit**

```bash
git add agents/discovery.md
git commit -m "feat: add discovery agent for bulk lead prospecting"
```

---

### Task 2: Create the Prospect Discovery Skill

**Files:**
- Create: `skills/prospect-discovery/SKILL.md`

- [ ] **Step 1: Create directory and skill file**

Create `skills/prospect-discovery/SKILL.md`:

```markdown
---
description: Discover and qualify potential customers in bulk. Use when user says "find me leads", "bulk lead discovery", "find prospects", "discover companies", "who should I sell to", "find customers for my business", "prospect for [industry]", "find [type] companies", "discover [industry] leads"
---

Discover potential customers matching the user's business and ideal customer profile. $ARGUMENTS

Delegate to the **discovery** agent with the full context of: "$ARGUMENTS"

The discovery agent will:
1. Ask 2-3 questions to understand what the user sells and who they sell to
2. Build targeted search queries from the answers
3. Discover 15-50 matching companies via SerpAPI
4. Quick-scrape and score each company (1-10)
5. Present a summary table for the user to review
6. Deep-dive selected companies using the research agent
7. Save full profiles to documents/leads/ with source: bulk-discovery tag

After the discovery agent completes, confirm:
- How many companies discovered and scored
- How many deep-dived into full profiles
- Recommended next action (e.g., "Say 'draft outreach for [company]' to create email sequences")
```

- [ ] **Step 2: Verify the skill file is valid**

Run: `head -5 skills/prospect-discovery/SKILL.md`
Expected: frontmatter block with `description:` field

- [ ] **Step 3: Commit**

```bash
git add skills/prospect-discovery/SKILL.md
git commit -m "feat: add prospect-discovery skill for bulk lead entry point"
```

---

### Task 3: Create the CSV Import Skill

**Files:**
- Create: `skills/csv-import/SKILL.md`

- [ ] **Step 1: Create directory and skill file**

Create `skills/csv-import/SKILL.md`:

```markdown
---
description: Import a CSV or spreadsheet of companies for lead enrichment and scoring. Use when user says "import leads from CSV", "import this spreadsheet", "process this company list", "enrich this CSV", "import from [file]", "upload leads", "import companies"
---

Import and process a company list from a CSV file. $ARGUMENTS

**Process:**

1. If $ARGUMENTS contains a file path, use it. Otherwise ask: "What's the path to your CSV file?"
2. Read the CSV file with the Read tool
3. Display the first 3-5 rows and all detected column headers in a formatted table
4. Ask the user to map columns (present detected headers as multiple choice options):
   - **Required:** "Which column is the company name?" → list all detected headers
   - **Optional:** "Which column is the website?" → list headers + "None — I'll search for it"
   - **Optional:** "Which column is the industry?" → list headers + "None"
   - **Optional:** "Which column is the company size/employees?" → list headers + "None"
5. Ask: "What does your business offer? This helps me score these companies as potential buyers for you."
6. Delegate to the **discovery** agent in CSV import mode with:
   - The full CSV content
   - Column mapping from user's answers
   - User's business context for scoring

The discovery agent will enrich each company (quick-scrape homepage + score), present a summary table, and deep-dive the ones the user selects — same two-stage funnel as conversational discovery.
```

- [ ] **Step 2: Verify the skill file is valid**

Run: `head -5 skills/csv-import/SKILL.md`
Expected: frontmatter block with `description:` field

- [ ] **Step 3: Commit**

```bash
git add skills/csv-import/SKILL.md
git commit -m "feat: add csv-import skill for file-based lead discovery"
```

---

### Task 4: Update Pipeline Review Skill

**Files:**
- Modify: `skills/pipeline-review/SKILL.md`

The current file has this structure (numbered sections):
1. Read all `*.md` files in `documents/leads/`
2. Build pipeline summary table
3. Hot Leads
4. Stale Contacts
5. High-Priority New Leads
6. Recommended Actions

We need to insert a new section 3 ("Unqualified Prospects") and renumber 3-6 to 4-7.

- [ ] **Step 1: Add the Unqualified Prospects section**

In `skills/pipeline-review/SKILL.md`, after the pipeline summary table section (step 2) and before the Hot Leads section (currently step 3), insert:

```markdown
3. **Unqualified Prospects** — leads with `source: bulk-discovery` and `status: prospect` in frontmatter.
   Group by `discovery_batch` field. For each batch show:
   - Batch name (from `discovery_batch`), date, number of prospects
   - Top 3 prospects by `icp_score` that haven't been deep-dived yet
   - Suggest: "You have N unreviewed prospects from [batch]. Say 'deep-dive [company]' or 'research [company]' to create full profiles."
```

Then renumber the existing sections:
- "3. **Hot Leads**" → "4. **Hot Leads**"
- "4. **Stale Contacts**" → "5. **Stale Contacts**"
- "5. **High-Priority New Leads**" → "6. **High-Priority New Leads**"
- "6. **Recommended Actions**" → "7. **Recommended Actions**"

- [ ] **Step 2: Verify the updated file**

Run: `grep -n "^\d\." skills/pipeline-review/SKILL.md`
Expected: sections numbered 1 through 7, with section 3 being "Unqualified Prospects"

- [ ] **Step 3: Commit**

```bash
git add skills/pipeline-review/SKILL.md
git commit -m "feat: add unqualified prospects section to pipeline review"
```

---

### Task 5: Update Templates/CLAUDE.md

**Files:**
- Modify: `templates/CLAUDE.md`

Three changes needed:
1. Add bulk discovery workflow section
2. Add discovery-related trigger phrases to the skills list
3. Add new frontmatter tags to the frontmatter standard section

- [ ] **Step 1: Add the prospect-discovery and csv-import skills to the Available Skills section**

In `templates/CLAUDE.md`, after the `/lead-agent:lead-research` skill block (around line 74) and before `/lead-agent:prd-writer`, insert:

```markdown
### `/prospect-studio:prospect-discovery`
Discover potential customers in bulk — the discovery agent asks about your business, finds matching companies, and scores them.
- "Find me leads" / "Discover prospects"
- "Find [industry] companies for my business"
- "Who should I sell to?"
- "Bulk lead discovery"

### `/prospect-studio:csv-import`
Import a CSV of companies for enrichment and scoring with flexible column mapping.
- "Import leads from [file path]"
- "Process this company list"
- "Enrich this CSV"
```

- [ ] **Step 2: Add the discovery agent to the Subagents table**

In `templates/CLAUDE.md`, in the Subagents table (around line 133-139), add a new row after the `research` row:

```markdown
| `discovery` | "Find me leads", "Discover companies in [industry]", "Bulk lead discovery", "Find prospects" | SerpAPI, scrape_url, Glob, Read, Agent (delegates to research) |
```

- [ ] **Step 3: Add the Bulk Lead Discovery workflow section**

In `templates/CLAUDE.md`, after the "Lead Generation & Sales" workflow section (ends around line 109) and before "Market & Competitive Research", insert:

```markdown
### Bulk Lead Discovery
1. **Discover** — "find me leads" → discovery agent asks about your business and ICP
2. **Score** — agent searches via SerpAPI, quick-scrapes homepages, scores 15-50 companies
3. **Select** — review summary table, pick companies to deep-dive (by number or score threshold)
4. **Deep-dive** — selected companies get full lead profiles via research agent
5. **Outreach** — "draft outreach for [company]" for any qualified lead
6. **CSV import** — "import leads from [path]" to enrich an external company list

Bulk-discovered leads are tagged with `source: bulk-discovery` and `discovery_batch: YYYY-MM-DD-[topic]` in frontmatter. They appear in pipeline review under "Unqualified Prospects" until deep-dived.
```

- [ ] **Step 4: Add new frontmatter tags to the Frontmatter Standard section**

In `templates/CLAUDE.md`, in the Frontmatter Standard section (around line 192-204), add the new fields to the YAML block. Change:

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

To:

```yaml
---
title: Document Title
type: lead|prd|frd|task|goal|note
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: draft|active|completed|archived|prospect
priority: urgent|high|medium|low
tags: []
source: manual|bulk-discovery|csv-import
discovery_batch: YYYY-MM-DD-[topic]
---
```

- [ ] **Step 5: Update the skill name references from lead-agent to prospect-studio**

The existing `templates/CLAUDE.md` uses `/lead-agent:` prefixes (lines 40-89). These should already be `/prospect-studio:` from the v1.0.0 rename, but verify and fix if needed. If they still say `/lead-agent:`, replace all occurrences with `/prospect-studio:`.

- [ ] **Step 6: Verify the updated file**

Run: `grep -n "prospect-discovery\|csv-import\|bulk-discovery\|discovery_batch" templates/CLAUDE.md`
Expected: matches in the new skills section, subagents table, workflow section, and frontmatter standard

- [ ] **Step 7: Commit**

```bash
git add templates/CLAUDE.md
git commit -m "feat: add bulk discovery docs to workspace template"
```

---

### Task 6: Update CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add v1.1.0 section**

In `CHANGELOG.md`, after the `---` separator on line 7 and before the `## [1.0.0]` heading on line 9, insert:

```markdown
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

```

- [ ] **Step 2: Verify the changelog**

Run: `head -30 CHANGELOG.md`
Expected: v1.1.0 section appears before v1.0.0, with the new agent, skills, and updates listed

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add v1.1.0 changelog for bulk discovery"
```

---

### Task 7: Bump Plugin Version

**Files:**
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: Update version in plugin.json**

In `.claude-plugin/plugin.json`, change line 3:

From:
```json
  "version": "1.0.0",
```

To:
```json
  "version": "1.1.0",
```

- [ ] **Step 2: Verify the version bump**

Run: `grep version .claude-plugin/plugin.json`
Expected: `"version": "1.1.0",`

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "chore: bump version to 1.1.0"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Verify all new files exist**

Run: `ls agents/discovery.md skills/prospect-discovery/SKILL.md skills/csv-import/SKILL.md`
Expected: all three files listed

- [ ] **Step 2: Verify all agents have valid frontmatter**

Run: `head -8 agents/discovery.md`
Expected: frontmatter with `name: discovery`, `model: sonnet`, `maxTurns: 50`

- [ ] **Step 3: Verify all skills have valid frontmatter**

Run: `head -3 skills/prospect-discovery/SKILL.md skills/csv-import/SKILL.md`
Expected: each file starts with `---` and has a `description:` field

- [ ] **Step 4: Verify pipeline-review has 7 sections**

Run: `grep -c "^\d\." skills/pipeline-review/SKILL.md`
Expected: 7 (was 6 before, now includes Unqualified Prospects)

- [ ] **Step 5: Verify templates/CLAUDE.md has new content**

Run: `grep -c "bulk-discovery\|prospect-discovery\|csv-import\|discovery_batch" templates/CLAUDE.md`
Expected: at least 8 matches across the new sections

- [ ] **Step 6: Verify version is 1.1.0**

Run: `grep '"version"' .claude-plugin/plugin.json`
Expected: `"version": "1.1.0",`

- [ ] **Step 7: Verify git status is clean**

Run: `git status`
Expected: nothing to commit, working tree clean

- [ ] **Step 8: Verify commit history**

Run: `git log --oneline -8`
Expected: 7 new commits (one per task) on top of the v1.0.0 initial commit
