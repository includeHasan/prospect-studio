---
description: Discover and qualify potential customers in bulk. Use when user says "find me leads", "bulk lead discovery", "find prospects", "discover companies", "who should I sell to", "find customers for my business", "prospect for [industry]", "find [type] companies", "discover [industry] leads"
---

Discover potential customers matching the user's business and ideal customer profile. $ARGUMENTS

Delegate to the **discovery** agent with the full context of: "$ARGUMENTS"

The discovery agent will:
1. Ask 2-3 questions to understand what the user sells and who they sell to
2. Build targeted search queries from the answers
3. Discover 15-50 matching companies via SerpAPI
4. Quick-scrape and score each company (1-10)
5. Present a summary table for the user to review
6. Deep-dive selected companies using the research agent
7. Save full profiles to documents/leads/ with source: bulk-discovery tag

After the discovery agent completes, confirm:
- How many companies discovered and scored
- How many deep-dived into full profiles
- Recommended next action (e.g., "Say 'draft outreach for [company]' to create email sequences")
