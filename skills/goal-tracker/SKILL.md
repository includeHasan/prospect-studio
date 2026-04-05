---
description: Set and track goals with OKRs, quarterly planning, and progress reviews. Use when user says "set Q1/Q2/Q3/Q4 OKRs", "review my goals", "update progress on [goal]", "show my OKRs", "annual goals", "how am I tracking against goals".
---

Manage goals based on: $ARGUMENTS

---

**For "set [quarter] OKRs"** (e.g., "set Q2 OKRs") — Create `documents/goals/YYYY/qN/YYYY-QN-okrs.md`:

```markdown
---
title: Q[N] [YYYY] OKRs
type: goal
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active
priority: high
tags: [okr, quarterly]
---

# Q[N] [YYYY] OKRs

## Objective 1: [Inspiring, directional objective]

| Key Result | Target | Current | Confidence | Status |
|-----------|--------|---------|-----------|--------|
| KR1.1: [Measurable outcome with number + date] | [target] | 0 | 60% | 🟡 On Track |
| KR1.2: [Measurable outcome with number + date] | [target] | 0 | 60% | 🟡 On Track |
```

Ask: "What's the most important thing to achieve this quarter? What would make it a great quarter vs. an okay quarter?"

Rules to enforce:
- Objectives: inspiring, directional, not "do more X"
- Key Results: outcomes (not activities), specific number + date
- 2-5 KRs per objective
- 60-70% confidence = good stretch target

---

**For "review my goals"** — Read all OKR files in `documents/goals/`. For each KR:
- Ask for current progress update
- Calculate % to target
- Flag KRs at risk: < 30% complete with < 50% of quarter remaining
- Suggest corrective actions for at-risk KRs

Display a summary table, then specific recommendations.

---

**For "update progress on [goal]"** — Find the relevant OKR file. Read it. Update the specific KR's `Current` value in the table. Update `updated:` frontmatter to today. Write back.
