# Analytics insights brief (rule-based advice notes, plus loans per week)

**Branch:** `feat/analytics-insights` from `main` `15d4e36`, in its own worktree `C:\dev\cap-analytics`.
**Issue:** #155 (Raiki creates it first). PR title: `feat(analytics): rule-based insights and loans per week (#155)`.
**Owner:** Raiki's agent (server and screens). Joel is in class.
**Deadline:** PR ready **Sat Nov 7, 10:00**; merged and deployed by noon (Doc Joel's Director UAT ~3 pm). **Feature freeze Sat 18:00.**
**Source of intent:** Macy's bundle `AdRIC_AMS_Actionable_Analytics_Implementation_Plan.md` (v2.1, Nov 3). This brief adapts it to the real repo and **wins where they differ**. Repo rules: `AGENTS.md`, `CLAUDE.md`, `docs/contracts/lifecycle.md`.

---

## 1. Goal

When a TSG staff member, the Secretary, the Director or a Lab Head opens Analytics, they see short, read-only advice notes ("insights") that say what needs attention and a suggested next step, each with a "Why" section showing the records behind it. The top 2 or 3 also show on the home screen. A note appears only when the data supports it; otherwise nothing is shown. No AI, no email, no writes, no buttons that start a workflow.

Also (P2, cut first): a **loans per week** chart for CAP1DEF comment 8 ("time element for utilization").

## 2. Decisions already made (Raiki, Nov 6)

| # | Decision |
|---|---|
| D1 | **Plain Prisma queries** in `server/features/analytics/` (repository, service). **No stored procedures, views or triggers** (plan 0b). Stored procedures go to Recommendations (Macy writes it). |
| D2 | **Five rules: WAR-01, LOAN-02, REP-03, LIFE-04, COND-05.** COND-05 replaces DEMAND-05 (Macy's documented fallback). **DEMAND-05 (cross-lab borrowing) goes to Recommendations** (Macy agreed). |
| D3 | **LIFE-04 age limits are demo-only**: MONITOR 60, ROUTER 60, DEV_KIT 48 months. Other categories never trigger. The note says "review point, not policy". |
| D4 | On-request evaluation, nothing stored, no scheduler. |
| D5 | CAP1DEF 8 chart is **P2**: built only after P1 is done and checked; skipped if it doesn't fit or goes badly. |

## 3. Rules (P1)

`asOf` is today's date in Asia/Manila, taken once per request on the server (the server runs with `TZ=Asia/Manila`). The service takes `asOf` as a parameter so tests can fix it; **the route never reads it from the query**. Every rule skips **Retired** assets and anything outside the caller's scope (section 4). Day counts are whole calendar days.

| Rule | Fires when | Priority | View | Title |
|---|---|---|---|---|
| **WAR-01** warranty | `warranty_expiry` set and `0 <= days(asOf to expiry) <= 90` | HIGH 0 to 30, MEDIUM 31 to 90 | Operational | "Warranty ending soon" |
| **LOAN-02** overdue | loan status `ON_LOAN` or `RETURN_REQUESTED` (the contract's overdue rule) and `days(return_by to asOf) > 7` | HIGH over 14, MEDIUM 8 to 14 | Operational | "Loan well past its return date" |
| **REP-03** repeat repairs | 3 or more `asset_maintenance` tickets on the asset with `reported_at` in the last 180 days, **any type, status not `CANCELLED`** | HIGH if a ticket is still open (not Resolved, Beyond Repair or Cancelled) or the current condition is Critical Defect, else MEDIUM | Operational | "Repeated repairs" |
| **LIFE-04** age | `procurement_date` set, not in the future, category in D3, whole months since purchase >= the category's limit | PLANNING | Strategic | "Due for a lifecycle review" |
| **COND-05** condition dropping | the asset's two latest **TSG** inspections (every type except `SELF_REPORT`) are on different days and the latest condition is worse. Order: Perfect < Operational < Minor Drift < Degraded < Critical Defect | HIGH if the latest is Critical Defect, else MEDIUM | Operational | "Condition dropping" |

Notes on the adaptations (write them in the Decision Log, section 9):
- LOAN-02 counts Return Requested too, because the asset is still the borrower's until TSG receives it (contract overdue rule). Macy's draft had only On Loan.
- REP-03 counts every ticket type, not only TSG Maintenance: our server allows only one open ticket per asset, so duplicate borrower reports can't inflate the count, and a borrower report or a damaged return is a real repair incident.
- Use `COUNT(DISTINCT ...)` or group before joining, so joins never multiply rows.

**Text per role** (template strings in one file; `{asset}` is "Name (TAG)"). Issue line + preferred action; neutral words, never "must", "unusable", "warranty eligible", "buy".

| Rule | Issue | Lab Head action | TSG / Secretary action | Director action |
|---|---|---|---|---|
| WAR-01 | "The warranty for {asset} ends in {N} days ({date})." | "Consider asking TSG for a condition check before it ends." | "Consider an inspection before the warranty ends." | "Review assets whose warranty ends soon." |
| LOAN-02 | "{asset} is {N} days past its return date." | "Consider following up with the borrower and TSG." | "Check where it is and follow up on the return." | "Review labs with loans well past their return date." |
| REP-03 | "{asset} had {N} repair tickets in the last 180 days." | "Consider asking TSG to look at the repeated problems." | "Review its repair and inspection history for a repeating fault." | "Consider maintenance or replacement planning for it." |
| LIFE-04 | "{asset} was bought {N} months ago, past this category's review point ({L} months, a review point, not policy)." | "Review whether it still suits the lab's work." | "Check its condition if a review is due." | "Review replacement planning. This is not a disposal approval." |
| COND-05 | "{asset}'s condition went from {prev} to {latest} between its last two TSG inspections." | "Consider asking TSG why the condition dropped." | "Review the inspection history and decide if it needs work." | "Review assets whose condition is dropping." |

Each insight also carries 1 or 2 **alternatives** (Macy's section 5 lists) and **evidence** rows, for example: warranty date; return-by date and borrower name (the borrower's name only, as on the loan screens); ticket ids with dates; purchase date and category; the two inspection dates and conditions.

## 4. Who sees what (server-side scope)

| Caller | Scope |
|---|---|
| Lab Head (the view, same check as `GET /api/analytics/lab-head`) | Only assets whose `assets.center_id` is the lab they head (`research_centers.head_user_id`). Loans by the **asset's** home lab. No lab filter; a `centerId` for another lab answers 403 |
| TSG Staff and the Secretary (Staff view, same check as `GET /api/analytics/tsg`) | Every lab; optional `centerId` (must exist, else 400) |
| Director | Every lab; optional `centerId` |
| Researcher, IT Admin | 403 |

Scope by `assets.center_id`, **not** by tag prefix (the old Lab Head code uses a prefix: don't copy that). Insights never include another lab's asset details for a Lab Head.

## 5. API (P1)

`GET /api/analytics/insights?view=operational|strategic|all&centerId=<optional>` (default `all`). Five layers as usual; route guards like the existing analytics routes plus one that lets the three views in. Answer:

```json
{ "success": true,
  "asOfDate": "2026-11-07",
  "scope": { "type": "lab", "centerId": 3, "code": "CITe4D" },
  "summary": { "high": 1, "medium": 2, "planning": 1 },
  "insights": [
    { "id": "WAR-01:CITe4D-0007", "ruleId": "WAR-01", "view": "operational", "priority": "HIGH",
      "assetTag": "CITe4D-0007", "assetName": "...", "labCode": "CITe4D",
      "title": "Warranty ending soon", "issue": "...", "preferredAction": "...",
      "evidence": [{ "label": "Warranty ends", "value": "2026-11-20" }],
      "alternatives": [{ "rank": 1, "text": "..." }],
      "chartKey": "warranty" } ] }
```

`scope.type` is `lab` or `all`. Sorted HIGH, MEDIUM, PLANNING, then the most urgent number (fewest warranty days, most overdue days, most tickets, oldest), then `id`. `summary` counts the cards returned. Put the shared types in `shared/types/analytics.ts` (or the existing analytics types file). Document the route in `docs/contracts/lifecycle.md`.

## 6. Screens (P1)

- **One component** `web/features/analytics/insights/InsightsPanel.tsx` (plus a small card component), calls through `web/api/analytics.api.ts` only. Uses the app's existing UI parts and theme colours (no hard-coded emerald or amber; follow `loanStatusStyles.ts` style of one shared map for priority colours).
- **Analytics pages** (`StaffAnalyticsView`, `LabHeadAnalyticsView`, `DirectorAnalyticsView`): an **Insights** section at the top with tabs **Operational** and **Strategic**. Each card: priority badge, title, issue line, preferred action; a **Why** toggle shows evidence and alternatives; **Dismiss** hides it until the page reloads (component state only, nothing saved). Each card names the chart it relates to (from `chartKey`) when that chart is on the page.
- **Home screens:** the top 3 cards (no tabs, "See all in Analytics" link) on Staff **System Overview**, Director **Overview**, and the top of the Lab Head **Requests** page. Hidden entirely when there are none.
- States: loading (small skeleton, never blocks the charts); none ("No insights right now." on Analytics only; never "everything is fine"); error ("Insights are currently unavailable." and the charts still show).
- No action buttons (no approve, flag, request, buy). Opening the asset is not required.

## 7. Loans per week, CAP1DEF 8 (P2, only after P1 passes its checks)

- `GET /api/analytics/utilization?weeks=12&centerId=<optional>`, same scope rules as section 4.
- Per lab (the asset's home lab), per week (Monday start, Manila), last N weeks including this one: **loans out** (released loans whose `released_at` to `closed_at`, or to now if still open, overlaps the week), **loans released** that week. Plus per lab: **average loan length in days** (released loans with `closed_at`) and the **3 busiest weeks** (most loans out; none if all are zero).
- Chart on Director Analytics (all labs, or one lab by an existing lab filter if there is one) and Lab Head Analytics (own lab): recharts bar or line, title "Loans out per week", busiest weeks marked, average loan length shown under it. Empty state when there are no released loans.
- If this slips past Sat 08:00 or the numbers can't be checked, stop and report; it stays out.

## 8. Tests (Vitest, local test database)

Unit tests on the pure rule functions with a fixed `asOf`:
- WAR-01: 90 days in, 91 out, 0 in, -1 out, null out, Retired out; 30 HIGH, 31 MEDIUM.
- LOAN-02: 7 days late out, 8 in (MEDIUM), 15 HIGH; Returned, Cancelled, Ended by Maintenance out; Return Requested in.
- REP-03: 2 out, 3 in; one older than 180 days drops it to 2; Cancelled not counted; open ticket makes HIGH.
- LIFE-04: exactly the limit in, one month less out, unmapped category out, future or null purchase date out.
- COND-05: Operational to Degraded in; same condition out; better out; only one TSG inspection out; a Self Report never counts; two on the same day out.

API tests: Lab Head of lab A gets only lab A's insights and 403 for lab B's `centerId`; Researcher and IT Admin 403; TSG with and without `centerId`; unknown `centerId` 400; answer has no email or ID number; the route writes nothing (row counts unchanged). P2: one week-overlap test and the average length.

Typecheck must stay 25 or lower; build passes; all tests pass.

## 9. Docs

- `docs/tasks/analytics-insights.md` = this brief (commit 1), with a **Decision Log** table at the end (date, item, what changed and why), starting with D1 to D5 and the two adaptations in section 3.
- Contract: the new route(s).
- AGENTS.md test count.
- A short "For Macy" note in the task file: what shipped, the rule thresholds, and the Recommendations items (stored procedures or views with an EXECUTE-only reporting account if data grows; DEMAND-05 cross-lab borrowing review; category age limits set by policy; persistent insight history).

## 10. Stops

- **Stop 0 (plan, short):** confirm the repo facts this brief relies on (role checks the analytics routes use, how the Lab Head's lab is found, `released_at`/`closed_at`, condition enum order, where analytics types live), list files, ask only blocking questions in the AGENTS.md format. Commit 1 (the brief) only.
- **Stop 1:** server P1 (rules, route, tests, contract). Report counts.
- **Stop 2:** screens P1 (panel, three home previews). Typecheck, build, tests.
- **Stop 3:** P2 utilization, only if Raiki says go.
- **Stop 4:** hand checks with Playwright on local `adric_uat_check` (start script, ports 4000 and 5173 free), one per role at least, a qualifying and a suppressed case per rule where the data allows (create data through the app or API on the local copy only), then docs and the PR text. Never CCS Cloud.

## 11. Not in this work

Stored procedures, DEMAND-05, admin-editable thresholds, saved dismissals or insight history, email or bell notifications, any action button, new packages, schema changes, the Sankey (gone already), changes to existing charts beyond adding the panel and the P2 chart.

---

## Decision Log

| Date | Item | What changed and why |
|---|---|---|
| 2026-11-06 | D1 | Plain Prisma queries in `server/features/analytics/` (repository, service). No stored procedures, views or triggers. Stored procedures go to Recommendations. |
| 2026-11-06 | D2 | Five rules: WAR-01, LOAN-02, REP-03, LIFE-04, COND-05. COND-05 replaces DEMAND-05 (Macy's documented fallback). DEMAND-05 (cross-lab borrowing) goes to Recommendations. |
| 2026-11-06 | D3 | LIFE-04 age limits are demo-only: Monitor 60, Router 60, Dev Kit 48 months. Other categories never fire. The note says "review point, not policy". |
| 2026-11-06 | D4 | Evaluated on request. Nothing stored, no scheduler. |
| 2026-11-06 | D5 | The loans per week chart (CAP1DEF 8) is P2: built only after P1 is done and checked. |
| 2026-11-06 | LOAN-02 adaptation | Counts Return Requested as well as On Loan, because the asset is still the borrower's until TSG receives it (the contract's overdue rule). Macy's draft had only On Loan. |
| 2026-11-06 | REP-03 adaptation | Counts every ticket type, not only TSG Maintenance. The server allows one open ticket per asset, so duplicate borrower reports cannot inflate the count, and a borrower report or a damaged return is a real repair incident. Tickets are read one row each, so no join multiplies rows. |
| 2026-11-06 | "Today" (Raiki, Q1 = B) | `asOf` comes from `serverToday()` in `assetState.ts`, the server's local day, so LOAN-02 agrees with the overdue flag, the warranty check at receipt and the reminders. The deploy starts the API with `TZ=Asia/Manila` under pm2. DATE columns (`warranty_expiry`, `procurement_date`, `return_by`) are compared as their UTC yyyy-mm-dd, like `dateOnly()` in `assetState.ts`. DateTime columns (`reported_at`, `inspected_at`) use the local day, `serverToday(d)`, as `notifications.service.ts` does. The service still takes `asOf` as a parameter for tests. A fix for `serverToday()` on a UTC host comes after Nov 9. |
| 2026-11-06 | Route answer shape | The fields sit next to `success: true` with no `data` wrapper, as the brief's section 5 shows. The other analytics routes use `{ success, data }`. |
| 2026-11-06 | Contract row | The planned "Insights" row in `lifecycle.md` section 7.9 (replace soon, most requested, loans per week) is replaced by the section 5 shape. The snapshot and inventory report rows are untouched. The loan-length bullets under the table stay for the loans per week route (P2). |
| 2026-11-06 | Rule details the brief left open | REP-03: a ticket reported exactly 180 days back counts, 181 does not. LIFE-04: whole months follow the calendar day (bought on the 8th, a month is complete on the 8th). COND-05: "the two latest" means the two newest TSG inspections; if they fall on the same day the rule does not look further back. |
| 2026-11-06 | Sort order | HIGH, MEDIUM, PLANNING, then a per-rule urgency number (fewest warranty days, most days late, most tickets, most months old, biggest condition drop), then `id`. The brief names no number for COND-05, so the size of the drop is used. Numbers from different rules are compared as they are, which is only a tie-break inside one priority. |
| 2026-11-06 | Alternatives text | Macy's plan file (`AdRIC_AMS_Actionable_Analytics_Implementation_Plan.md`) was not available to the agent. The one or two alternatives per rule in `insights.text.ts` are written by the agent in neutral words, for Macy to replace or confirm. |
