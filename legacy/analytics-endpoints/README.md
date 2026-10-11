# legacy/analytics-endpoints

**Do not import anything from this folder. Do not mount its router. Do not study it as an example of how the project works.**

`analyticsEndpoints.ts` holds the handler code of 22 analytics endpoints, moved here on 2026-10-11 by step 12 (batch 4) of the restructure, unchanged and in their original order. **None of them is registered any more**: the server never loads this file, so a request to any of the 22 paths now answers Express's not found (404). That is the decided change (team decision 2026-10-08, the "Old analytics" row of the [PROMPT-2-restructure.md](../../docs/phase-1c-restructure/PROMPT-2-restructure.md) decisions table). They were kept rather than deleted so the team can read them without digging through git history.

- The file is excluded from the TypeScript check and the build: `tsconfig.json` lists `legacy` under `exclude`, and nothing imports it.
- **Its import of the Prisma client is broken on purpose.** It still reads `./config/prisma.js`, as it did in `server/remainingRoutes.ts`, and that path does not exist from this folder. Do not fix it here: an endpoint that comes back is split into the five layers (below), and its database calls go into a repository file.
- The three type errors of `compliance` and `audit-discrepancies` (`is_documented`, H-12) are in this file now. That is why the typecheck count dropped from 71 to 68 in this batch.
- Nothing outside `legacy/` may import this file. The live analytics endpoints are in [`server/features/analytics/`](../../server/features/analytics/).

None of the 22 had a caller in the live app, and none has a Phase 2 test ([test plan section 3](../../docs/phase-2-tests/01-test-plan.md#3-skipped-endpoints)). Before the move they were mounted with no login check, so anyone who could reach the server could read institutional equipment and finance data through them ([01C section 4.4](../../docs/phase-1b-deep-map/01C-security-map.md#44-analytics-routes-30)).

---

## Group 3.1: their only callers are in `legacy/analytics-v1/` (11)

These were used only by the screens quarantined in step 2 ([`../analytics-v1/`](../analytics-v1/README.md)). With those screens out of the app, nothing calls them.

| Method | Path | What it computed | Tables it read | Was called by |
|---|---|---|---|---|
| GET | `/api/analytics/dashboard` | Nine reporting widgets: assets by funding source, lifecycle status counts, overdue loans, Manila and Laguna counts, loans per lab by borrower type, holders by role, average return condition per month, repairs per month, cumulative disposals per month. Falls back to fixed demo series when there is no data (H-09) | `assets`, `asset_monetary`, `asset_records`, `users`, `user_roles`, `roles`, `asset_loans` (approved), `asset_repairs`, `asset_disposals` (approved), `asset_returns` | `AnalyticsDashboard.tsx` |
| GET | `/api/analytics/compliance` | Share of documented assets per funding source, and an "audit ready" percentage for government funders. Optional `?lab` | `asset_monetary`, `assets`, `asset_records`, `projects` | `ReportsAnalyticsDashboard.tsx` |
| GET | `/api/analytics/delinquencies` | Loans past their due date and not returned, with the borrower's name and email and the asset's location. Optional `?lab` | `asset_loans`, `assets`, `asset_records`, `users` | `ReportsAnalyticsDashboard.tsx` |
| GET | `/api/analytics/health-trends` | Repairs per category in the last 12 months, risk alerts (two or more repairs, or procured more than three years ago), and per month the repairs and the returns. Optional `?lab` | `asset_repairs`, `assets`, `asset_records`, `asset_returns` | `ReportsAnalyticsDashboard.tsx` |
| GET | `/api/analytics/stakeholder/utilization` | The ten assets with the most loans plus transfers. Optional `?lab` | `assets`, `asset_loans`, `asset_transfers`, `asset_records` | `RoleAnalyticsModule.tsx` |
| GET | `/api/analytics/stakeholder/audit-discrepancies` | Undocumented assets and their value, per funding source and research center. Optional `?lab` | `asset_monetary`, `assets`, `asset_records`, `projects`, `research_centers` | `RoleAnalyticsModule.tsx` |
| GET | `/api/analytics/stakeholder/degradation-tracker` | Per asset: loans, repairs, and a health score (100 minus 6 per loan and 12 per repair, at least 45). Optional `?lab` | `assets`, `asset_loans`, `asset_repairs`, `asset_records` | `RoleAnalyticsModule.tsx` |
| GET | `/api/analytics/stakeholder/disposal-prescriptions` | Assets with two or more repairs or four or more years old, each with a prescribed disposal route (agency clearance for government-funded assets under five years). Optional `?lab` | `assets`, `asset_monetary`, `asset_repairs`, `asset_records` | `RoleAnalyticsModule.tsx` |
| GET | `/api/analytics/stakeholder/preventative-schedule` | Assets due for maintenance, from the newest return's condition, age (three years or more), or any repair, with an action and a priority. Optional `?lab` | `assets`, `asset_returns`, `asset_repairs`, `asset_records` | `RoleAnalyticsModule.tsx` |
| GET | `/api/analytics/stakeholder/accountability-bottlenecks` | Average days overdue per location and per borrower cohort (the first three digits of the id number), over every loan. Optional `?lab` | `asset_loans`, `assets`, `asset_records`, `asset_returns`, `users` | `RoleAnalyticsModule.tsx` |
| GET | `/api/analytics/advanced/stewardship-score/:userId` | A borrower score from 0 to 100 (overdue loans and the condition of their returns), with a tier and the checkout perks it grants | `asset_loans`, `asset_returns` | `StudentAnalyticsView.tsx` (with a hardcoded user id of 1) |

## Group 3.2: never called by anything (11)

No file has ever called these, live or legacy (checked again on 2026-10-08 across `web/`, `shared/`, and `legacy/`, and on 2026-10-11 across `web/` and `tests/`).

| Method | Path | What it computed | Tables it read |
|---|---|---|---|
| GET | `/api/analytics/advanced/funding-valuation` | Acquisition value per funding source and, inside each, per category, for assets not disposed. A missing source counts as "DOST-PCIEERD" | `asset_monetary`, `assets`, `asset_records` |
| GET | `/api/analytics/advanced/campus-transfer-flow` | Transfers counted by the campus of each custodian's first research center (Manila to Laguna, Laguna to Manila, and within each), as diagram links | `users`, `user_centers`, `research_centers`, `asset_transfers` |
| GET | `/api/analytics/advanced/grant-readiness-index` | Per project, the share of its records that are not ON_LOAN, a renewal status, and the average over all projects | `projects`, `asset_records`, `research_centers` |
| GET | `/api/analytics/advanced/project-allocation` | On-loan assets per project, for a treemap. Optional `?lab`. The live Lab Head dashboard has its own `projectAllocation` | `assets`, `asset_records`, `projects` |
| GET | `/api/analytics/advanced/warranty-calendar` | Assets whose warranty expires in the next 90 days. The live Staff dashboard reads warranties from `GET /api/analytics/tsg` and `GET /api/assets` | `assets` |
| GET | `/api/analytics/advanced/vendor-reliability` | Per manufacturer, the average days from a repair ticket to the asset's next ACTIVE record (5 days when there is none), and a rating | `asset_repairs`, `assets`, `asset_records` |
| GET | `/api/analytics/advanced/equipment-calendar` | Every loan, or one asset's with `?assetId`, as a calendar event | `asset_loans`, `assets` |
| GET | `/api/analytics/stakeholder/degradation` | Per category: transfers, and a wear index from transfers and from condition drops between returns. Optional `?lab` | `assets`, `asset_transfers`, `asset_returns`, `asset_records` |
| GET | `/api/analytics/stakeholder/chain-of-custody/:assetId` | One asset's transfers and returns as one timeline, oldest first | `asset_transfers`, `asset_returns`, `users` |
| GET | `/api/analytics/stakeholder/stewardship-guidelines/:category` | Fixed storage, handling, and calibration text for four categories, DEV_KIT for any other | none |
| POST | `/api/analytics/stakeholder/project-closure-recall` | Projects ending in the next 14 days with their on-loan assets, and a recall message. Optional `?lab`, matched on the center name. Writes nothing, although it is a POST | `projects`, `asset_records`, `research_centers` |

## Known defects, kept with the code

- `compliance` and `audit-discrepancies` read `asset_monetary.is_documented`, a column that exists in no schema and not in the live database, so `compliance` always reported zero documented assets and `audit-discrepancies` counted every asset as a gap (H-12).
- `dashboard` answers fixed demo series when the real data is empty (H-09).
- `stewardship-score/:userId` reads anyone's borrowing record by changing the number in the URL (01C section 4.4).
- Every handler that filters by `?lab` matches the text anywhere in the record's location, like the live endpoints (M-03), and takes each asset's newest record by date alone (M-09).

## Bringing one back

1. **Team decision first.** Bringing one back reverses part of the 2026-10-08 decision. Name the screen that will call it.
2. **Fix what blocks it.** For `compliance` and `audit-discrepancies`, the `is_documented` column must exist first (a schema change, Phase 3). For `stewardship-score`, the user must come from the session, not the URL (step 13, `requireAuth`). For `dashboard`, decide what to show instead of the demo series (H-09).
3. **Split it into the five layers** in [`server/features/analytics/`](../../server/features/analytics/): the Prisma calls into `analytics.repository.ts` (the only analytics file that imports `config/prisma`), the computation into `analytics.service.ts`, query reading into `analytics.validation.ts`, the answer into `analytics.controller.ts`, and one line in `analytics.routes.ts`. Add its response shape to `shared/types/analytics.ts` and a function to `web/api/analytics.api.ts`.
4. **Comment and test it.** File headers and TSDoc per [CODE-COMMENTS.md](../../docs/guides/CODE-COMMENTS.md), a test in `tests/api/analytics.test.ts`, and its row moved from section 3 to section 2.9 of the [test plan](../../docs/phase-2-tests/01-test-plan.md).
5. **Remove its handler and its row here**, and note the change in the restructure log.

Bringing a screen back from [`../analytics-v1/`](../analytics-v1/README.md) needs the same steps for each endpoint it calls.
