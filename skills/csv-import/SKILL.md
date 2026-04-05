---
description: Import a CSV or spreadsheet of companies for lead enrichment and scoring. Use when user says "import leads from CSV", "import this spreadsheet", "process this company list", "enrich this CSV", "import from [file]", "upload leads", "import companies"
---

Import and process a company list from a CSV file. $ARGUMENTS

**Process:**

1. If $ARGUMENTS contains a file path, use it. Otherwise ask: "What's the path to your CSV file?"
2. Read the CSV file with the Read tool
3. Display the first 3-5 rows and all detected column headers in a formatted table
4. Ask the user to map columns (present detected headers as multiple choice options):
   - **Required:** "Which column is the company name?" → list all detected headers
   - **Optional:** "Which column is the website?" → list headers + "None — I'll search for it"
   - **Optional:** "Which column is the industry?" → list headers + "None"
   - **Optional:** "Which column is the company size/employees?" → list headers + "None"
5. Ask: "What does your business offer? This helps me score these companies as potential buyers for you."
6. Delegate to the **discovery** agent in CSV import mode with:
   - The full CSV content
   - Column mapping from user's answers
   - User's business context for scoring

The discovery agent will enrich each company (quick-scrape homepage + score), present a summary table, and deep-dive the ones the user selects — same two-stage funnel as conversational discovery.
