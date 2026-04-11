---
description: Morning pipeline briefing from workspace state. Use when user says "good morning", "brief me", "daily standup", "catch me up", "what's in my pipeline", or similar morning/status check phrases.
---

Generate a full morning pipeline briefing from the workspace state. $ARGUMENTS

**Process:**

1. Check if `notes/daily/YYYY-MM-DD-brief.md` exists (today's date). If it does, read it.

2. Synthesize the brief contents into a clear, actionable morning briefing covering:
   - **⚠️ Urgent**: Stale leads needing follow-up (no touch in 7+ days)
   - **🔄 Lead Pipeline**: Stage counts across new / prospect / contacted / qualified / nurturing / closed
   - **🎯 Recommended Next Actions**: Which specific leads to contact today and why
   - **🧊 Going Cold**: Contacted/qualified/nurturing leads where `updated:` is more than 7 days old

3. If no brief exists for today, scan the workspace directly:
   - Read all `*.md` files in `documents/leads/` — count by `status:` field
   - Flag leads with `updated:` more than 7 days ago whose status is `contacted`, `qualified`, or `nurturing`
   - Group bulk-discovery prospects (`source: bulk-discovery`) by `discovery_batch` — these are unqualified and may need a deep-dive

4. Format as a crisp morning standup — not a wall of text. Lead with what needs action first.

5. End with: **"Who would you like to contact first?"**
