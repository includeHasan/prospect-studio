---
description: Research competitors, build comparison matrices, identify market gaps, generate battlecards. Use when user says "competitive analysis for [market]", "battlecard for [competitor]", "who are the players in [space]", "research competitors", "compare us to [competitor]".
---

Conduct competitive intelligence research for: $ARGUMENTS

Delegate to the **analyst** agent with the full context of: "$ARGUMENTS"

The analyst agent will:
1. Identify 3-5 main competitors in the space using SerpAPI
2. For each competitor, research: pricing, positioning, funding, team size, customer reviews (G2/Capterra/Reddit)
3. Build a comparison matrix: features | pricing | target market | strengths | weaknesses
4. Identify market gaps and opportunities
5. Generate sales battlecards with "we win when / they win when" framing
6. Save analysis to `research/YYYY-MM-DD-[market]-competitive-intel.md`
7. Save individual battlecards to `documents/projects/battlecards/[competitor].md`

After the analyst completes, confirm:
- Where the analysis was saved
- Top 2-3 market insights
- "Say 'coach, review this battlecard' to get feedback on any battlecard"
