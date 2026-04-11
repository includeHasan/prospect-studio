---
description: Talk to the core sales strategist — the orchestrator agent who thinks, plans, judges, and delegates like a senior sales lead. Use when the user's request is open-ended or strategic rather than task-shaped. Trigger: "/prospect-studio:sales", "help me hit quota", "what should I work on today", "run a campaign into [market]", "what's worth my time", "judge these leads", "build me a sales plan", "take this list and make it produce", "where should I focus".
---

Delegate this request to the `sales` agent. $ARGUMENTS

The sales agent is the strategic entry point for any open-ended sales request. It:
- Reads the current pipeline state from the workspace
- Clarifies the goal (if needed — at most one question)
- Produces a short, numbered plan with delegations and rough effort
- Gets the user's nod on the plan
- Executes by delegating to `research`, `discovery`, `outreach`, `analyst`, and `coach`
- Judges results after each step (qualify / kill / park / escalate)
- Ends with a crisp recommendation, not a data dump

**Do not do the work yourself in the main conversation — invoke the `sales` agent via the Agent tool.** Pass the user's raw request as context so the agent can interpret it with sales judgment.

If the user's request is already task-shaped (e.g. "research Acme", "draft outreach for Beta", "find me 20 fintech leads"), route directly to the specialist agent instead (`research`, `outreach`, `discovery`) — skip the sales agent for clerical single-step asks.
