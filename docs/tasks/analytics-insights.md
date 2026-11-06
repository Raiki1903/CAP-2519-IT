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
| 2026-11-06 | Alternatives text (replaced) | Alternatives are from Macy's plan section 5; COND-05 has none there, so its two are ours. They are other actions the person could take, not caveats. This replaces the agent's own draft in the line above. |
| 2026-11-06 | Screens: where the panel goes | Full panel at the top of `StaffAnalyticsView`, `LabHeadAnalyticsView` and `DirectorAnalyticsView` (above the filters and charts). Top 3 on Staff System Overview, Director Overview and the top of `LabHeadLoanRequests` (the Lab Head Requests page). "See all in Analytics" goes to `/staff/health`, `/lab-head/health` and `/adric-director/analytics` by `roleToSlug`. |
| 2026-11-06 | Screens: lab filter | The Director's existing lab filter picks the lab for the panel (its `centerId` from the lab list). The Staff view has a lab filter made of fixed names with no lab ids, so its panel always shows every lab. A Lab Head sends no lab. |
| 2026-11-06 | Screens: related chart line | A card names its chart only when that chart is on the page: Staff "Warranties Ending in 90 Days" (warranty) and "Repair Operations Kanban Board" (repairs); Lab Head "Overdue Loans" (overdueLoans). The condition and lifecycle charts do not exist on any page, so those cards show no chart line. The home previews show none. |
| 2026-11-06 | Screens: states | Loading is a small skeleton and the charts load beside it. The Analytics page says "No insights right now." inside an empty tab and "Insights are currently unavailable." on an error. A home preview is hidden when there is nothing to show, and shows the error line on an error. Dismiss is component state: it lasts until the page reloads or the person leaves the screen, and nothing is saved. |
| 2026-11-06 | Screens: colours | One map in `insightPriorityStyles.ts` using theme colours: High is `destructive`, Medium is `chart-5` with normal text, Planning is `primary`. |
| 2026-11-06 | Stop 3: route and guard | `GET /api/analytics/utilization?weeks=12&centerId=` has the same guard (Staff, Lab Head, Director) and the same lab scope as insights. The scope check moved to `analytics.scope.ts` (a refactor commit, no behavior change) so both routes share it; its 403 messages still say "insights". The route is allowed for TSG Staff and the Secretary too because section 7 says "same scope rules as section 4", though only the Director and Lab Head pages show the chart. |
| 2026-11-06 | Stop 3: answer shape | `{ success, asOfDate, weekCount, scope, total, labs }` with no `data` wrapper, like insights. `total` adds every lab in scope together and is what the chart draws; `labs` has the same figures per home lab (a lab with no loan in the weeks shown is left out). The brief did not fix the shape. |
| 2026-11-06 | Stop 3: what counts | Only loans with `released_at` set count. Days are local days (`serverToday(d)`), weeks run Monday to Sunday, and a loan still open runs to today. A loan out on any day of a week counts in that week, so one loan can count in several weeks. The home lab is the asset's, never the destination lab. |
| 2026-11-06 | Stop 3: average and busiest weeks | The average is over loans closed within the weeks shown (the brief did not say all time or the window), whole days from release day to closing day, one decimal, `null` with none. Busiest weeks are the three with most loans out, newer first on a tie, none when all are zero. |
| 2026-11-06 | Stop 3: no share-of-time figure | The planned `timeOnLoanShare` in the contract (share of time on loan per lab) is not in section 7 and was not built; its contract bullet is gone. The old `averageLoanDays` bullet (open loans counted to now) is replaced by the closed-loans-only rule in section 7. |
| 2026-11-06 | Stop 3: chart | `LoansPerWeekChart` is a bar chart of loans out per week, the busiest weeks in `primary` and the others in `secondary`, with the busiest weeks and the average loan length written under it. It is on Director Analytics (the existing lab filter picks the lab through its `centerId`, as for insights) and Lab Head Analytics (own lab), after the existing charts of the Director page and under the operational section of the Lab Head page. It has its own loading, error ("Loans per week are currently unavailable.") and empty ("No loans have been handed over in the last 12 weeks.") states. |
| 2026-11-06 | After the hand checks: two changes to Macy's plan (Raiki) | H1 to H9 all passed on the first layout. Raiki then changed two items from Macy's plan: the landing preview (FR-06) is dropped, and the Operational and Strategic tabs (FR-05) are replaced by priority sections. This reverses the "top 3 on the home screens" part of section 6 of this brief and the "Screens: where the panel goes" row above. The server and the API are unchanged. |
| 2026-11-06 | Rework 1: Insights only on Analytics | The top 3 and its "See all in Analytics" link are removed from Staff System Overview, the Director Overview and the Lab Head Requests page. The preview code that only they used is deleted: the panel's `variant`, `analyticsPath` and `className` props, the preview branch, and the router link. The three home screens are back to their code from before this work. Done as `git revert` of the home-screen commit plus the panel clean-up, in one refactor commit. |
| 2026-11-06 | Rework 2: Insights block | A header row (title, the count of notes not dismissed, and a Hide or Show button) over one wide card with three sections side by side: High, Medium, Planning, each with its count. Shown by default; Hide collapses it to the header row. Hide and Dismiss are component state only, so a reload brings everything back. The sections stack on a screen narrower than 1024 px (the `lg` breakpoint). |
| 2026-11-06 | Rework 2: tabs dropped, sections scroll | The Operational and Strategic tabs are gone: Planning is the strategic one, so the "view" of a note no longer shows on screen (the server still sends it, and `?view=` still works). Each section has a fixed height of 31rem, which fits three cards at a 1440 px window (a card is about 155 px there), and scrolls for the rest. An empty section says "None"; when all three are empty the card says "No insights right now." Loading and error states are as before (the skeleton and "Insights are currently unavailable." under the header, with the charts still showing). Why, Dismiss and the related-chart line are kept. |
| 2026-11-06 | Rework 2: compact card | `InsightCard` is now a plain bordered box with the same left accent and priority badge, smaller type and padding, and the Why and Dismiss buttons on one row. It no longer uses the `Card` component, whose padding and gap could not be made compact. |
| 2026-11-06 | Rework 3: Lab Head loan requests table | On Lab Head Analytics the "Equipment Loan Requests" table has a fixed height of 20rem and scrolls inside its card, with the header row kept in view (sticky). The table's own sideways scroll moved to the same box. |

---

## For Macy

**What shipped (issue #155).**

- `GET /api/analytics/insights`: five rule-based advice notes, read-only, worked out on each request with plain Prisma queries. No stored procedures, views, triggers, AI, email or writes. Each note has a priority, an issue line, a preferred action worded for the viewer's role (Lab Head, TSG Staff and Secretary, Director), a "Why" section with the evidence rows and your section 5 alternatives, and a chart key.
- The notes show in an Insights block at the top of the Staff, Lab Head and Director Analytics pages: one wide card with High, Medium and Planning side by side, a Hide or Show button, and a scrolling list in each section. Raiki dropped the landing preview (FR-06) and the Operational and Strategic tabs (FR-05) from your plan after the hand checks. A Lab Head sees only the lab they head. Dismiss and Hide last until the page reloads and save nothing.
- `GET /api/analytics/utilization` and the "Loans out per week" chart (CAP1DEF 8) on Director Analytics (with its lab filter) and Lab Head Analytics: loans out and released per week for the last 12 weeks, the three busiest weeks, and the average loan length.

**Rule thresholds.**

| Rule | Fires when | Priority |
|---|---|---|
| WAR-01 | warranty ends in 0 to 90 days | HIGH up to 30 days, else MEDIUM |
| LOAN-02 | On Loan or Return Requested, more than 7 days past the return date | HIGH over 14 days, else MEDIUM |
| REP-03 | 3 or more tickets of any type, not Cancelled, reported in the last 180 days | HIGH if a ticket is open or the condition is Critical Defect, else MEDIUM |
| LIFE-04 | months since purchase reach Monitor 60, Router 60, Dev Kit 48 (demo values, a review point and not policy) | PLANNING |
| COND-05 | the two newest TSG inspections are on different days and the newest condition is worse | HIGH if Critical Defect, else MEDIUM |

COND-05 replaces DEMAND-05. The alternatives for COND-05 are ours, because your section 5 has none for it.

**Recommendations items.**

1. Stored procedures or views with an EXECUTE-only reporting account, if the data grows. The inspection rule reads every TSG inspection and keeps the two newest per asset in the service, which is fine at today's size.
2. DEMAND-05, the cross-lab borrowing review.
3. Category age limits set by policy, instead of the demo values in `LIFECYCLE_LIMIT_MONTHS`.
4. Persistent insight history, saved dismissals and admin-editable thresholds (none exist: each request starts fresh).
5. A share-of-time-on-loan figure per lab (the planned `timeOnLoanShare`), which is not built.

---

## Stop 4 browser checks

Done by the agent with Playwright on the local `adric_uat_check` copy only (never CCS Cloud), on 2026-11-06, started with `C:\dev\uat-data\start-local-uat.ps1`. Raiki ran `C:\dev\uat-data\uat-insights-setup.sql` first. Its screenshots were deleted after the rework. This is the first layout (home previews and tabs); the reworked layout is checked below.

- **TSG (UAT Staff One):** System Overview shows the top 3 (UATI-005 and UATI-011 High loans, UATI-001 High warranty) and "See all in Analytics". Analytics shows 15 Operational and 1 Strategic. Every qualifying case appears with the right priority. UATI-003 (warranty 91 days) and UATI-006 (loan 7 days late) are absent. Why shows the evidence rows and "Other options", Dismiss lowers the tab count, the Strategic tab shows UATI-008, and the related-chart line shows on a warranty card ("Warranties Ending in 90 Days") and a repair card ("Repair Operations Kanban Board").
- **Secretary:** not checked in the browser, because the UAT account list has no Secretary account. The Secretary is app role Staff, the same guard and the same panel as TSG, and the API test calls the route as the Secretary. UAT Staff Two (also TSG) was not opened.
- **Lab Head of CITe4D (UAT LabHead CITe4D):** the Requests page shows the top 3 and only CITe4D notes. Analytics shows 9 notes, all CITe4D. The chart counts only CITe4D (busiest weeks Nov 2 with 9, Oct 26 and Oct 12 with 6; average 2.9 days). A `centerId` for another lab answers 403 on both routes.
- **Director (UAT Director One):** the Overview preview shows the top 3. Analytics shows 15 and 1 for All Laboratories. Picking CAR in the lab filter changes both the panel (3 Operational, 0 Strategic, only CAR) and the chart (busiest Oct 26, Oct 19, Oct 12 with 2 each; average 5.3 days). Picking CITe4D gives the same figures as the Lab Head.
- **Researcher (UAT Custodian One):** no Insights panel on any page, both routes answer 403, and `/staff/health` shows "You don't have access to this page".
- **Colours:** the High badge is red, Medium is amber (`chart-5` with dark text), Planning is green (`primary`). The chart bars resolve `var(--primary)` to rgb(0, 90, 54) for the busiest weeks and `var(--secondary)` to rgb(16, 185, 129) for the rest, so the fills work in an SVG attribute. Nothing rendered wrong, so no fix commit was needed.
- **States:** with both routes answered by the browser as 500, the panel shows "Insights are currently unavailable.", the chart shows "Loans per week are currently unavailable.", and the other charts still load. With both routes answered as empty, the Analytics panel shows "No insights right now.", the chart shows its empty text, and the home preview is hidden. These two used browser-side fake answers, not the server.
- **Console:** the only errors were `favicon.ico` 404 (not part of this work) and the 403 answers of the agent's own probes of other labs.

## Stop 4 hand checks

For Raiki. Database: the **local `adric_uat_check` copy only**, with the test data of `C:\dev\uat-data\uat-insights-setup.sql`. Never CCS Cloud. Start the app with `C:\dev\uat-data\start-local-uat.ps1`. Passwords are in `C:\dev\uat-data\uat-passwords.txt`.

**Run these on the same day you ran the setup.** The warranty of UATI-003 is set to 91 days away and the loan of UATI-006 to 7 days late, so a day later they are 90 days and 8 days and the two notes start to appear. After the checks, run `C:\dev\uat-data\uat-insights-cleanup.sql`. The demo data has its own notes too (CITe4D-0122, GAME-0001 and others), so the totals below are the totals on 2026-11-06; look for the UATI tags.

| # | Role and screen | Clicks | What you should see |
|---|---|---|---|
| H1 | TSG Staff (`uat.staff1`), **System Overview** | Log in. | An "Insights" block under the title with 3 cards, High first: UATI-005 and UATI-011 (Loan well past its return date), then UATI-001 (Warranty ending soon). A "See all in Analytics" link at the right. |
| H2 | TSG Staff, **Analytics** | Click "See all in Analytics". | Tabs "Operational (15)" and "Strategic (1)". On Operational: High for UATI-001, UATI-005, UATI-010, UATI-011. Medium for UATI-002 (warranty 60 days), UATI-004 (loan 10 days late), UATI-007 (Repeated repairs), UATI-009 (Condition dropping). UATI-003 (warranty 91 days) and UATI-006 (loan 7 days late) are **not** listed. |
| H3 | TSG Staff, **Analytics** | On the UATI-007 card click **Why**. Click **Dismiss** on the first card. Click the **Strategic** tab. Reload the page. | Why lists MNT ticket ids with dates, then "Other options" with 2 lines. The card shows "Related chart on this page: Repair Operations Kanban Board". After Dismiss the card is gone and the tab count drops by 1. Strategic shows UATI-008 (Planning, "Due for a lifecycle review"). After the reload the dismissed card is back. |
| H4 | Lab Head of CITe4D (`uat.labhead.cite4d1`), **Requests** | Log in. | The Insights block is at the top of the page with 3 cards, all CITe4D (UATI-005, UATI-001, UATI-004). The suggested step is worded for a Lab Head ("Consider ..."). No CAR cards (UATI-010, UATI-011). |
| H5 | Lab Head of CITe4D, **Analytics** | Click **Analytics**. Scroll to "Loans out per week". | Insights: 9 notes, every one labelled CITe4D. The chart has 12 bars, the busiest weeks darker. Under it: "Busiest weeks: week of Nov 2 (9 out), week of Oct 26 (6 out), week of Oct 12 (6 out)" and "Average loan length: 2.9 days". |
| H6 | Director (`uat.director1`), **Overview** | Log in. | The Insights block with 3 cards and "See all in Analytics". The suggested step is worded for the Director ("Review ..."). |
| H7 | Director, **Analytics** | Click **See all in Analytics**. Choose **CAR** in "Lab Filter". Then **CITe4D**. Then "All Laboratories". | All: "Operational (15)", "Strategic (1)", chart average 3.4 days. CAR: "Operational (3)", "Strategic (0)", only CAR cards, chart average 5.3 days. CITe4D: "Operational (9)", "Strategic (1)", chart average 2.9 days, the same as H5. The panel and the chart change together. |
| H8 | Researcher (`uat.custodian1`), every screen | Log in. Open My Loans, Available Equipment, QR Scan, Send Inspection Report. Then type `/staff/health` after the address. | No "Insights" block and no loans per week chart anywhere (asset names that contain "UAT insights" are only names). `/staff/health` shows "You don't have access to this page". |
| H9 | Nearby behavior, TSG Staff and Director, **Analytics** | Scroll below the Insights block and the loans chart. | The charts that were there before still load: on the Staff page the repair board, location status and warranty charts; on the Director page "Value by Funding Source" and "Asset Use". Nothing is blank or pushed off the page. |

## Stop 4 hand checks: results

| # | Result (pass or fail) | Notes |
|---|---|---|
| H1 | Pass | Raiki: passed on the first layout. Describes the home-screen preview, removed after the rework. |
| H2 | Pass | Raiki: passed on the first layout. Describes the Operational and Strategic tabs, replaced after the rework. |
| H3 | Pass | Raiki: passed on the first layout. Describes the Operational and Strategic tabs, replaced after the rework. |
| H4 | Pass | Raiki: passed on the first layout. Describes the home-screen preview, removed after the rework. |
| H5 | Pass | Raiki: passed on the first layout. Describes the Operational and Strategic tabs, replaced after the rework. |
| H6 | Pass | Raiki: passed on the first layout. Describes the home-screen preview, removed after the rework. |
| H7 | Pass | Raiki: passed on the first layout. Describes the Operational and Strategic tabs, replaced after the rework. |
| H8 | Pass | Raiki: passed on the first layout. |
| H9 | Pass | Raiki: passed on the first layout. |

## Stop 4 browser checks: reworked layout

Done by the agent with Playwright on the local `adric_uat_check` copy only, on 2026-11-06, with the same test data and a 1440 px window unless said. The app was started with `C:\dev\uat-data\start-local-uat.ps1` (a leftover app of Raiki's was already on ports 4000 and 5173, so the agent stopped it first and started its own). Screenshots are in `%TEMP%\insights-checks\` (`v2-01` to `v2-16`); the screenshots of the first layout were deleted. The agent signed in with a session cookie made by a script outside the repo, so no password was typed into the browser tool.

- **Home screens:** Staff System Overview, the Lab Head Requests page and the Director Overview have no Insights block and no "See all in Analytics" link.
- **Staff Analytics:** header "Insights (16)" with Hide. Three sections side by side: High 4, Medium 11, Planning 1. The Medium section scrolls (1870 px of cards in a 496 px box). Hide leaves only the header row with the count and a Show button; Show brings the block back. Dismiss lowers the section count and the total (High 4 to 3, total 16 to 15). Why on a warranty card shows the date and the two other options, and the card names "Warranties Ending in 90 Days".
- **Lab Head Analytics (CITe4D):** total 10, High 2, Medium 7, Planning 1, every card CITe4D. The Equipment Loan Requests table is 318 px tall with 31 rows, scrolls, and keeps its header row at the top.
- **Director Analytics:** All Laboratories 16 (4, 11, 1). CAR gives 3 (2, 1, 0): the Planning section says "None" and the loans chart average is 5.3 days. CITe4D gives 10 (2, 7, 1) and 2.9 days. The panel and the chart still follow the lab filter.
- **Narrow window (420 px):** High, Medium and Planning stack one under the other, and the page does not scroll sideways.
- **Console:** only the `favicon.ico` 404.

## Stop 4 hand checks: reworked layout

For Raiki, after the rework. H1 to H9 above were run on the first layout; H1, H4 and H6 describe the home-screen preview that was removed, and H2, H3, H5 and H7 describe the tabs. H10 and up replace them. Database: the **local `adric_uat_check` copy only**, with the test data of `C:\dev\uat-data\uat-insights-setup.sql` (run the checks on the day you ran the setup, or UATI-003 and UATI-006 start to show). Never CCS Cloud. Start the app with `C:\dev\uat-data\start-local-uat.ps1`. The totals are the totals on 2026-11-06, with the demo data's own notes in them.

| # | Role and screen | Clicks | What you should see |
|---|---|---|---|
| H10 | TSG Staff (`uat.staff1`), **System Overview** | Log in. | No Insights block and no "See all in Analytics" link: the page starts with the three count cards. |
| H11 | Lab Head of CITe4D (`uat.labhead.cite4d1`), **Requests**, and Director (`uat.director1`), **Overview** | Log in as each. | No Insights block on either page. The Requests page starts with the "Loan Requests" title. |
| H12 | TSG Staff, **Analytics** | Click **Analytics** in the menu. | A header row "Insights (16)" with a **Hide** button, over one wide card with three sections side by side: High 4, Medium 11, Planning 1. No Operational or Strategic tabs. Each section is the same height. High has UATI-001, UATI-005, UATI-010 and UATI-011; Medium has UATI-002, UATI-004, UATI-007 and UATI-009; Planning has UATI-008. UATI-003 and UATI-006 are not there. |
| H13 | TSG Staff, **Analytics** | Scroll inside the Medium section with the mouse wheel. Then click **Hide**. Then **Show**. Then reload the page. | The Medium section scrolls on its own while the page stays put. Hide leaves only the "Insights (16)" row with a **Show** button; Show brings the block back. After the reload the block is shown. |
| H14 | TSG Staff, **Analytics** | On the UATI-001 card (High) click **Why**. Then click **Dismiss** on the first High card. Reload. | Why shows "Warranty ends 2026-11-26" and two "Other options"; the card also says "Related chart on this page: Warranties Ending in 90 Days". After Dismiss the High count drops from 4 to 3 and the header from 16 to 15. After the reload they are 4 and 16 again. |
| H15 | Lab Head of CITe4D, **Analytics** | Click **Analytics**. Scroll to "Equipment Loan Requests". | "Insights (10)": High 2, Medium 7, Planning 1, every card labelled CITe4D and none from CAR (UATI-010, UATI-011). The loan requests table is about 320 px tall, shows its first rows and a scroll bar, and the header row stays at the top while you scroll to the last loan. "Loans out per week" is below, as before. |
| H16 | Director, **Analytics** | Click **Analytics**. Choose **CAR** in "Lab Filter". Then **CITe4D**. Then "All Laboratories". | All: "Insights (16)" with 4, 11, 1. CAR: "Insights (3)" with 2, 1, 0, only CAR cards, the Planning section says "None", and the loans chart average is 5.3 days. CITe4D: "Insights (10)" with 2, 7, 1 and 2.9 days. The block and the chart change together. |
| H17 | Director, **Analytics**, narrow window | Make the browser window about 420 px wide (or press F12 and pick a phone size). | High, Medium and Planning are stacked one under the other, each with its own scroll. The page does not scroll sideways. |
| H18 | Researcher (`uat.custodian1`), and nearby behavior on Staff and Director **Analytics** | Log in as the Researcher and open My Loans. Then, as TSG Staff and as Director, scroll below the Insights block on **Analytics**. | The Researcher has no Insights anywhere. On Staff and Director Analytics the charts that were there before still load (repair board, location status and warranty charts; "Value by Funding Source", "Asset Use" and "Loans out per week"). |

## Stop 4 hand checks: reworked layout, results

| # | Result (pass or fail) | Notes |
|---|---|---|
| H10 | Pass | Raiki: passed. |
| H11 | Pass | Raiki: passed. |
| H12 | Pass | Raiki: passed. |
| H13 | Pass | Raiki: passed. |
| H14 | Pass | Raiki: passed. |
| H15 | Pass | Raiki: passed. |
| H16 | Pass | Raiki: passed. |
| H17 | Pass | Raiki: passed. |
| H18 | Pass | Raiki: passed. |
