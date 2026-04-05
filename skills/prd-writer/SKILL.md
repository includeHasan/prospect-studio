---
description: Create PRDs and FRDs with proper structure, user stories, and acceptance criteria. Use when user says "create a PRD for [feature]", "write FRD for [feature]", "add requirements to [document]", "define requirements for [feature]", "write product spec for [x]".
---

Create a Product Requirements Document for: $ARGUMENTS

Delegate to the **planning** agent with the full context of: "$ARGUMENTS"

The planning agent will:
1. Ask clarifying questions if scope is unclear: "Who are the users?", "What problem does this solve?", "What does success look like?"
2. Create a complete PRD at `documents/prd/YYYY-MM-DD-[feature-name]-prd.md` with all required sections:
   - Executive Summary, Problem Statement, Goals & Success Metrics
   - User Personas, MoSCoW Requirements, User Stories
   - Out of Scope, Dependencies & Risks, Timeline/Milestones, Changelog
3. For FRD requests: create `documents/frd/YYYY-MM-DD-[feature-name]-frd.md` referencing the parent PRD

After the planning agent completes, confirm:
- Document saved location
- "Say 'coach, review this PRD' to get expert feedback before sharing with stakeholders"
