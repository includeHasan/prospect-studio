---
description: Full lead pipeline review and follow-up recommendations. Use when user says "review my pipeline", "who should I follow up with?", "pipeline report", "show my leads", "pipeline status", "leads overview".
---

Generate a comprehensive pipeline review. $ARGUMENTS

**Process:**

1. Read all `*.md` files in `documents/leads/`. Parse frontmatter for: `company`, `status`, `priority`, `updated`, `icp_score`.

2. Build a pipeline summary table:
   | Stage | Count |
   |-------|-------|
   | New | N |
   | Contacted | N |
   | Qualified | N |
   | Nurturing | N |
   | Closed | N |

3. **Unqualified Prospects** — leads with `source: bulk-discovery` and `status: prospect` in frontmatter.
   Group by `discovery_batch` field. For each batch show:
   - Batch name (from `discovery_batch`), date, number of prospects
   - Top 3 prospects by `icp_score` that haven't been deep-dived yet
   - Suggest: "You have N unreviewed prospects from [batch]. Say 'deep-dive [company]' or 'research [company]' to create full profiles."

4. **Hot Leads** — status = qualified or nurturing, icp_score ≥ 7, updated within 7 days. List with company name and recommended action.

5. **Stale Contacts** — status = contacted/qualified/nurturing, last `updated:` more than 7 days ago. List with days since last touch and suggested next step:
   - contacted → "Follow up with Touch 2 or 3"
   - qualified → "Schedule demo or send proposal"
   - nurturing → "Share relevant content or check in"

6. **High-Priority New Leads** — status = new, priority = high or urgent. List for immediate action.

7. **Recommended Actions** — top 3-5 specific next steps, ordered by priority.

End with: "Want me to draft follow-up messages for any of these? Just say 'draft outreach for [company]'."
