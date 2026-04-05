---
description: Research and qualify a company as a B2B lead. Use when user says "research [company] as a lead", "find leads in [industry]", "qualify this prospect", "build a lead profile for [company]", "research [company]".
---

Research $ARGUMENTS as a potential B2B lead.

Delegate to the **research** agent with the full context of: "$ARGUMENTS"

The research agent will:
1. Scrape the company website with `scrape_company_intel` (HTTP + cheerio first; Playwright MCP if bot-blocked)
2. Find emails and contacts with `find_contacts`
3. Search for news, funding, leadership, and pain points via SerpAPI
4. Score the lead 1-10 against ICP criteria
5. Build a full lead profile with contacts table, outreach strategy, and all sources
6. Save to `documents/leads/YYYY-MM-DD-[company-name].md`

After the research agent completes, confirm to the user:
- Lead profile saved location
- ICP score and top qualification reason
- Recommended next action (e.g., "Ready for outreach — say 'draft outreach for [company]' to create an email sequence")
