---
description: Morning briefing from workspace state. Use when user says "good morning", "brief me", "daily standup", "catch me up", "what's on my plate today", "what do I have today", or similar morning/status check phrases.
---

Generate a full morning briefing from the workspace state. $ARGUMENTS

**Process:**

1. Check if `notes/daily/YYYY-MM-DD-brief.md` exists (today's date). If it does, read it.

2. Synthesize the brief contents into a clear, actionable morning briefing covering:
   - **⚠️ Urgent**: Overdue tasks, blocked work, stale leads needing follow-up
   - **📋 Today**: Tasks due today
   - **🔄 In Progress**: Active work underway
   - **📅 This Week**: Upcoming deadlines in the next 7 days
   - **🔄 Lead Pipeline**: Stage counts and which contacts need follow-up

3. If no brief exists for today, scan the workspace directly:
   - Read all `*.md` files in `documents/tasks/active/` — parse `due:`, `status:`, `priority:` frontmatter
   - Read all `*.md` files in `documents/leads/` — count by `status:` field, flag leads with `updated:` more than 7 days ago whose status is `contacted`, `qualified`, or `nurturing`
   - Identify overdue items: due date before today

4. Format as a crisp morning standup — not a wall of text. Lead with what needs action first.

5. Priority icons: 🔴 urgent | 🟠 high | 🟡 medium | ⚪ low

6. End with: **"What would you like to tackle first?"**
