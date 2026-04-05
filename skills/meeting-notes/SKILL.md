---
description: Capture structured meeting notes with auto-extracted action items and optional task creation. Use when user says "take meeting notes", "log this meeting with [person/company]", "convert these notes into tasks", or provides meeting content to document.
---

Capture structured meeting notes for: $ARGUMENTS

**If meeting content has not been provided yet, ask:**
1. "Who was in the meeting?" (names and companies)
2. "What did you discuss?" (user can paste raw notes or speak them freely)
3. "Any decisions made or action items?"

**Once you have the content, structure the notes:**

```markdown
---
title: Meeting — [Company/Person] — [Date]
type: note
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active
priority: medium
tags: [meeting, company-name]
---

# Meeting — [Company/Person]
**Date**: YYYY-MM-DD
**Attendees**: [list with titles/companies]
**Duration**: [if known]

## Discussion
[Structured notes — use bullets for key points, not a transcript]

## Decisions
- [Decision 1]
- [Decision 2]

## Action Items
- [ ] [Action] — Owner: [Name] — Due: YYYY-MM-DD
- [ ] [Action] — Owner: [Name] — Due: YYYY-MM-DD
```

**Save to:** `notes/meetings/YYYY-MM-DD-[company-name]-meeting.md`

**After saving, ask:** "Should I create task files for any of the action items assigned to you?"

If yes, for each action item, create a task file at `documents/tasks/active/YYYY-MM-DD-[action-title].md` with proper frontmatter (title, type: task, created, updated, status: active, priority, due, project).
