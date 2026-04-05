---
description: First-run workspace initializer. Creates the full workspace directory structure and deploys CLAUDE.md. Run once after installing the plugin in your workspace directory. Trigger: "/lead-agent:setup"
---

Initialize the lead-agent workspace in the current directory.

**Step 1 — Create workspace directories:**

Run the following Bash commands to create the full directory structure:

```bash
mkdir -p documents/leads documents/prd documents/frd
mkdir -p documents/tasks/active documents/tasks/completed documents/tasks/backlog
mkdir -p "documents/goals/$(date +%Y)/q1" "documents/goals/$(date +%Y)/q2" "documents/goals/$(date +%Y)/q3" "documents/goals/$(date +%Y)/q4"
mkdir -p documents/goals/annual documents/projects/battlecards documents/templates documents/archive
mkdir -p research notes/daily notes/meetings notes/ideas notes/quick exports
```

**Step 2 — Deploy workspace instructions:**

Read the file at `${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md` and write its full contents to `./CLAUDE.md` in the current directory. Do not summarize or modify — copy verbatim.

**Step 3 — Confirm success:**

Tell the user:
- ✅ Which directories were created
- ✅ CLAUDE.md has been deployed to the workspace root
- "Your workspace is ready. Try these to get started:"
  - `"Research [company name]"` — research a lead
  - `"Good morning"` — get your daily briefing
  - `"Create task: [description]"` — add a task
  - `"Set Q2 OKRs"` — start goal tracking

Do not create any sample documents, placeholder files, or example leads.
