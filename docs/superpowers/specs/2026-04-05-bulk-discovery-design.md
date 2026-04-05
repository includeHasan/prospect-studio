# Bulk Lead Discovery — Design Spec
**Date**: 2026-04-05  
**Status**: Approved  
**Author**: HasanKhan  
**Version**: 1.1.0

---

## Context

prospect-studio v1.0.0 requires users to know a specific company name before researching it. Every workflow starts with "Research Acme Corp" or "Draft outreach for Stripe." There is no way to say "Find me 30 healthcare startups that might need our mobile app development services" and get a batch of qualified leads back.

**What prompted this**: Users need to discover potential customers in bulk without knowing company names upfront. The plugin should work for any business type — IT services, SaaS products, D2C brands, B2B consulting — not just a specific vertical.

**Intended outcome**: A conversational discovery flow where the agent asks 2-3 questions about what the user sells and who they sell to, then searches for matching companies in bulk, quick-scores them, presents a summary, and deep-dives only the ones the user selects.

---

## Architecture

### Two-Stage Funnel

```
Stage 1: Discover + Quick-Score (15-50 companies)
  → SerpAPI search queries OR CSV import
  → Quick-scrape homepage (scrape_url, HTTP only)
  → Score 1-10 against user's stated ICP
  → Present summary table

User picks winners (by number or score threshold)

Stage 2: Deep-Dive (existing research agent)
  → Full scrape_company_intel
  → SerpAPI deep research (news, funding, leadership)
  → Full lead profile with contacts, outreach strategy
  → Save to documents/leads/ with bulk-discovery tags
```

### Entry Points (4)

1. **Industry/vertical filter** — "Find SaaS companies in healthcare"
2. **ICP criteria** — "Companies with 50-200 employees, raised Series A, in North America"
3. **Competitor lookalike** — "Find companies similar to [competitor]'s clients"
4. **CSV import** — "Import leads from this spreadsheet" with flexible column mapping

All four entry points converge into the same two-stage funnel.

---

## Components

### 1. Discovery Agent — `agents/discovery.md`

New agent. Conversational prospecting specialist that finds potential customers for any business.

**Frontmatter:**
```yaml
name: discovery
description: Bulk lead discovery and prospecting specialist. Use for finding potential customers, bulk lead generation, prospect discovery, and company list building. Invoke when user says "find me leads", "discover companies in [industry]", "bulk lead discovery", "find prospects for my business", "who should I sell to"
model: sonnet
effort: high
maxTurns: 50
disallowedTools: Bash
```

**Conversational Discovery Flow:**

The agent asks 2-3 questions before searching:

1. **"What does your business offer?"** — Product or service description. Examples: "We build custom mobile apps", "We sell HR analytics SaaS", "We manufacture organic skincare products"
2. **"Who's your ideal buyer?"** — Target industry/domain, company type, size range. Examples: "Healthcare and fintech startups, 20-200 employees", "Mid-market retailers with e-commerce presence", "Enterprise companies with 1000+ employees"
3. **"Any geographic or budget preferences?"** — Region, funding stage, revenue signals. Examples: "US only, Series A or later", "Europe, any size", "No preference"

If the user's initial message already answers some questions (e.g., "find me healthcare leads in the US"), the agent skips those and only asks what's missing.

**Search Query Construction:**

From the gathered criteria, the agent builds 3-6 targeted SerpAPI queries. Examples for an IT services firm targeting healthcare:
- "healthcare startups Series A USA 2025 2026"
- "digital health companies raised funding"
- "healthcare companies hiring developers" (signal: they need tech help)
- "hospital software modernization" (signal: potential IT services buyer)
- "telemedicine companies growing" (domain-specific)

The agent adapts query strategy based on what the user sells — looking for buying signals specific to that offering.

**Competitor Lookalike Mode:**

When the user mentions a competitor or says "find companies like [X]'s clients", the agent:
1. Searches for the competitor's customer case studies, testimonials, and partner pages
2. Identifies the industries, sizes, and types of companies that buy from the competitor
3. Builds search queries targeting similar companies that aren't already the competitor's customers
4. Proceeds through the same quick-score pipeline

**Quick-Score Pipeline (per company):**

1. `scrape_url` on homepage — extract company description, size signals, tech indicators
2. Score 1-10 against the ICP criteria from the conversation:
   - Industry fit (does their domain match?)
   - Size fit (employee count / revenue signals)
   - Buying signals (hiring, funding, growth, pain points matching what the user sells)
   - Geography fit
   - Budget signals (funding stage, pricing page, job postings)
3. One-line justification per score

**Stage 1 Output — Summary Table:**

```markdown
## Discovery Results: [Topic] — [Date]

**Criteria:** [Summary of what user is looking for]
**Queries run:** N | **Companies found:** N | **Avg score:** N

| #  | Company       | Website          | Industry   | Size Est. | Score | Signal                           |
|----|--------------|------------------|------------|-----------|-------|----------------------------------|
| 1  | Acme Health  | acmehealth.com   | Healthcare | 50-100    | 8     | Hiring devs, Series A, no CTO    |
| 2  | ShipFast     | shipfast.io      | Logistics  | 200-500   | 7     | Outdated stack, growing fast     |
| 3  | RetailCo     | retailco.com     | E-commerce | 20-50     | 4     | Too small, no buying signals     |

**Pick companies to deep-dive:** Enter numbers (e.g., "1, 2, 5") or say "all 7+" to auto-select by score.
```

**Stage 2 Handoff:**

For each selected company, the discovery agent invokes the existing `research` agent to build a full lead profile. The research agent writes to `documents/leads/YYYY-MM-DD-company-name.md` as usual.

Additional frontmatter fields added to stage 2 profiles:
```yaml
source: bulk-discovery
discovery_batch: YYYY-MM-DD-[topic-slug]
```

**CSV Import Mode:**

When triggered with a file path, the agent:
1. Reads the CSV file
2. Displays first 3-5 rows and detected column headers
3. Asks the user to map columns via multiple choice: "Which column is the company name?" → presents detected headers as options. Repeats for: website (optional), industry (optional), size (optional).
4. Processes each row through the same quick-scrape + quick-score pipeline
5. Presents the same stage 1 summary table
6. Stage 2 handoff works identically

**Batch Size:** 15-50 companies per run. If discovery returns more than 50, the agent presents the top 50 by score and notes how many were excluded.

**Deduplication:** The agent checks `documents/leads/` for existing profiles before including a company in the summary table. If a company already has a lead profile, it's noted as "already in pipeline" and excluded from the table.

---

### 2. Prospect Discovery Skill — `skills/prospect-discovery/SKILL.md`

New skill. Entry point for conversational bulk discovery.

**Frontmatter:**
```yaml
description: Discover and qualify potential customers in bulk. Use when user says "find me leads", "bulk lead discovery", "find prospects", "discover companies", "who should I sell to", "find customers for my business", "prospect for [industry]", "find [type] companies"
```

**Body:**
```
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

---

### 3. CSV Import Skill — `skills/csv-import/SKILL.md`

New skill. Entry point for importing external company lists.

**Frontmatter:**
```yaml
description: Import a CSV or spreadsheet of companies for lead enrichment and scoring. Use when user says "import leads from CSV", "import this spreadsheet", "process this company list", "enrich this CSV", "import from [file]", "upload leads"
```

**Body:**
```
Import and process a company list from a CSV file. $ARGUMENTS

Process:
1. If $ARGUMENTS contains a file path, use it. Otherwise ask: "What's the path to your CSV file?"
2. Read the CSV file with the Read tool
3. Display the first 3-5 rows and all detected column headers
4. Ask the user to map columns (present as multiple choice from detected headers):
   - **Required:** "Which column is the company name?"
   - **Optional:** "Which column is the website?" (if not provided, agent will search for it)
   - **Optional:** "Which column is the industry?"
   - **Optional:** "Which column is the company size/employees?"
5. Ask: "What does your business offer? This helps me score these companies as potential buyers for you."
6. Delegate to the **discovery** agent in CSV import mode with:
   - Parsed company data
   - Column mapping
   - User's business context for scoring

The discovery agent will enrich, score, and present results in the same two-stage funnel as conversational discovery.
```

---

### 4. Modified: Pipeline Review Skill

**File:** `skills/pipeline-review/SKILL.md`

Add a new section between the existing "Pipeline Summary" and "Hot Leads" sections:

```markdown
3. **Unqualified Prospects** — leads with `source: bulk-discovery` and `status: prospect`.
   Group by `discovery_batch`. Show:
   - Batch name, date, count
   - Top 3 by icp_score that haven't been deep-dived
   - Suggest: "You have N unreviewed prospects from [batch]. Say 'deep-dive [company]' to research them."
```

Renumber existing sections 3-6 to 4-7.

---

### 5. Modified: Templates/CLAUDE.md

Add to the workspace instructions template:

**New section: "Bulk Lead Discovery"**
```markdown
## Bulk Lead Discovery

### Conversational Discovery
Say "find me leads" or "discover prospects" — the discovery agent asks about your business, finds matching companies, and scores them.

### CSV Import
Say "import leads from [path]" — maps your CSV columns, enriches each company, and scores them.

### Two-Stage Process
1. **Stage 1:** Quick-score 15-50 companies (fast, light on API usage)
2. **Stage 2:** Deep-dive selected companies into full lead profiles

### Frontmatter Tags
- `source: bulk-discovery` — lead was found via bulk discovery (vs. `manual`)
- `source: csv-import` — lead was imported from a CSV file
- `discovery_batch: YYYY-MM-DD-[topic]` — groups leads from the same run
- `status: prospect` — discovered but not yet deep-dived
```

---

### 6. Version Bump

- `.claude-plugin/plugin.json` — version `"1.0.0"` → `"1.1.0"`
- `CHANGELOG.md` — add v1.1.0 section

---

## Data Flows

### Conversational Discovery
```
User: "Find me leads"
→ prospect-discovery skill triggered
→ delegates to discovery agent
→ Agent: "What does your business offer?"
→ User: "We build custom mobile apps"
→ Agent: "Who's your ideal buyer?"
→ User: "Healthcare and fintech startups, 20-200 employees"
→ Agent: "Any region or budget preference?"
→ User: "US, Series A or later"
→ Agent builds 3-6 SerpAPI queries
→ SerpAPI returns results (deduplicated)
→ Agent quick-scrapes each homepage (scrape_url)
→ Agent quick-scores each (1-10)
→ Presents stage 1 summary table (15-50 companies)
→ User: "Deep-dive 1, 3, 7"
→ For each: invokes research agent
→ Full profiles saved to documents/leads/
   with source: bulk-discovery, discovery_batch: YYYY-MM-DD-topic
→ PostToolUse hooks auto-log everything
```

### CSV Import
```
User: "Import leads from D:/exports/apollo-list.csv"
→ csv-import skill triggered
→ Reads CSV, shows first 3-5 rows + columns
→ User maps columns (multiple choice)
→ User describes their business for scoring context
→ Delegates to discovery agent in CSV mode
→ Agent enriches + quick-scores each row
→ Same stage 1 table → user picks → research agent deep-dives
```

### SerpAPI Budget per Run
- Stage 1: 3-6 searches for discovery + 0 SerpAPI per company (HTTP scrape only)
- Stage 2: 3-5 searches per deep-dive (existing research agent)
- Typical run: 30 discovered, 5 deep-dived = ~25 SerpAPI calls total

---

## What Changes from v1.0.0

| v1.0.0 | v1.1.0 |
|--------|--------|
| Single-company research only | Bulk discovery + single-company |
| Must know company name | Agent asks questions, finds companies for you |
| No CSV support | Flexible CSV import with column mapping |
| Pipeline shows leads only | Pipeline shows leads + unqualified prospects |
| No batch tracking | `discovery_batch` frontmatter groups runs |

---

## Scope: In vs Out

### In scope (v1.1.0)
- Discovery agent with conversational ICP gathering
- 4 entry points: industry, ICP criteria, competitor lookalike, CSV import
- Two-stage funnel: quick-score → user picks → deep-dive
- 15-50 companies per batch
- Flexible CSV column mapping
- Pipeline review updated for prospects
- Same folder, tagged (`source: bulk-discovery`, `status: prospect`)

### Out of scope (future versions)
- Dedicated data provider APIs (Apollo, Crunchbase, Hunter.io)
- Auto-scheduled recurring discovery runs
- Lead deduplication across batches
- Saved ICP profiles for re-running discoveries
- Discovery history / analytics dashboard

---

## Files Changed

**New (3):**
- `agents/discovery.md`
- `skills/prospect-discovery/SKILL.md`
- `skills/csv-import/SKILL.md`

**Modified (4):**
- `skills/pipeline-review/SKILL.md`
- `templates/CLAUDE.md`
- `CHANGELOG.md`
- `.claude-plugin/plugin.json`

**Unchanged:**
- All existing agents (research, planning, outreach, analyst, coach)
- All existing skills (9 skills)
- MCP server, hooks, scripts
- README.md (update optional, not in scope for v1.1.0)
