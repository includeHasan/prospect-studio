---
description: Create, organize, and track tasks and projects with deadlines and priorities. Use when user says "create task: [description]", "show my tasks", "show tasks for today", "update project status", "mark task complete", "what tasks do I have".
---

Manage tasks based on: $ARGUMENTS

---

**For "create task: [description]"** — Create `documents/tasks/active/YYYY-MM-DD-[task-title].md`:

```markdown
---
title: [Task Title]
type: task
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active
priority: medium
due: YYYY-MM-DD
project: —
tags: []
---

## Description
[What needs to be done and why]

## Acceptance Criteria
- [ ] [Specific, testable criterion]
```

Ask for due date and priority if not provided.

---

**For "show my tasks" or "show tasks for today"** — Read all `*.md` files in `documents/tasks/active/`. Parse frontmatter. Display grouped by:
1. 🔴 Overdue (due date before today)
2. 📋 Due Today
3. 📅 Due This Week
4. 🔄 In Progress (status = in-progress)
5. 📥 Other Active

Priority icons: 🔴 urgent | 🟠 high | 🟡 medium | ⚪ low

---

**For "mark task complete: [task]"** — Find the task file in `documents/tasks/active/` (search by title keyword). Read it, update `status: completed` and `updated:` to today, then write to `documents/tasks/completed/` with the same filename.

---

**For "update project status"** — Ask which project. Read all task files where `project:` frontmatter matches. Summarize: total tasks, completed (in completed/), in-progress, blocked, upcoming. Present as a progress table.
