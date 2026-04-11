---
description: First-run workspace initializer. Creates the full workspace directory structure and deploys CLAUDE.md. Run once after installing the plugin in your workspace directory. Trigger: "/prospect-studio:setup"
---

Initialize the prospect-studio workspace in the current directory.

**Step 1 — Create workspace directories:**

Run the following Bash commands to create the full directory structure:

```bash
mkdir -p documents/leads documents/projects/battlecards documents/templates documents/archive
mkdir -p research notes/daily notes/meetings notes/quick exports
```

**Step 2 — Deploy workspace instructions:**

Read the file at `${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md` and write its full contents to `./CLAUDE.md` in the current directory. Do not summarize or modify — copy verbatim.

**Step 3 — Confirm success:**

Tell the user:
- ✅ Which directories were created
- ✅ CLAUDE.md has been deployed to the workspace root
- "Your workspace is ready. Try these to get started:"
  - `"Research [company name]"` — research a single lead
  - `"Find me leads"` — bulk prospect discovery
  - `"Good morning"` — get your daily pipeline briefing
  - `"Draft outreach for [company]"` — build a 4-touch email sequence

Do not create any sample documents, placeholder files, or example leads.
