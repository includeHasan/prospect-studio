---
description: Generate weekly status report from workspace activity. Optionally export as PowerPoint. Use when user says "weekly report", "week in review", "what did I accomplish this week", "status update", "export weekly status as PowerPoint".
---

Generate a weekly status report. $ARGUMENTS

**Process:**

1. Read `documents/activity-log.md` — filter entries from the past 7 days
2. Read `research/search-log.md` — filter entries from the past 7 days
3. Read all files in `documents/tasks/active/` and `documents/tasks/completed/` — identify tasks completed, in-progress, or newly created this week
4. Read all files in `documents/leads/` — identify leads that changed status this week (check `updated:` frontmatter)

**Structure the report:**

```markdown
---
title: Weekly Report — Week of [date range]
type: note
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active
---

# Weekly Report — Week of [Mon date] – [Fri date]

## Accomplishments
- [Completed tasks and closed/advanced leads]

## Lead Activity
| Company | Previous Stage | Current Stage | Action Taken |
|---------|---------------|---------------|--------------|

## Research & Analysis
- [Reports written, competitive analyses, market research]

## In Progress
- [Ongoing work with expected completion]

## Next Week Priorities
1. [Top priority]
2. [Second priority]
3. [Third priority]
```

**Save to:** `documents/projects/weekly-report-YYYY-MM-DD.md`

**If the user asked for PowerPoint export:**
Generate and run a Python script using `python-pptx` that creates a professional PPTX:
- Slide 1: Title slide "Weekly Report — [date range]"
- Slide 2: Accomplishments (1 bullet per achievement)
- Slide 3: Lead Pipeline (table of status changes)
- Slide 4: Next Week Priorities

Run with the Bash tool. Save to `exports/weekly-report-YYYY-MM-DD.pptx`.

Note: Requires `pip install python-pptx` if not already installed. Check by running `python3 -c "import pptx"` first; if it fails, run `pip install python-pptx` before generating.
