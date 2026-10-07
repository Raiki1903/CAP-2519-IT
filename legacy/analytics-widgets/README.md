# legacy/analytics-widgets

**Do not import anything from this folder. Do not study it as an example of how the project works.**

Seven analytics widgets, moved here on 2026-10-07 by step 8 part 2 of the restructure. They were exported from the live analytics views, but no view or page rendered them, so nobody ever saw them. Moving them changed no behavior.

This is a sibling of [`analytics-v1/`](../analytics-v1/README.md), not part of it. `analytics-v1` is an older analytics layer that was never wired in; these widgets come from the views that are live today. Three names exist in both folders (`ComplianceWidget`, `AuditDiscrepancyWidget`, `DisposalActionList`), but they are different code.

- Excluded from the TypeScript check and the Vite build: `tsconfig.json` lists `legacy` under `exclude`, and nothing imports these files.
- Each file is the widget code cut verbatim from its view, with the imports it needs and the view's `cardAnimation` constant on top. The imports use the `@web/...` aliases, so they still resolve.

---

## What is here

| File | Widget | Came from | Data | Notes |
|---|---|---|---|---|
| `DirectorWidgets.tsx` | `GrantReadinessIndex` | `DirectorAnalyticsView.tsx` | Shared asset list (`useServerData`) | Groups assets by `projectName`, a field `GET /api/assets` does not send, so every asset lands in one made-up "AdRIC Research Project" |
| `DirectorWidgets.tsx` | `ComplianceWidget` | `DirectorAnalyticsView.tsx` | Shared asset list | Counts an asset as "documented" if it is Active, or has any report or remark |
| `DirectorWidgets.tsx` | `AuditDiscrepancyWidget` | `DirectorAnalyticsView.tsx` | Shared asset list | Shows two invented rows (DOST-PCIEERD, CHED Grant) when it finds no gap (H-09 family) |
| `DirectorWidgets.tsx` | `DisposalActionList` | `DirectorAnalyticsView.tsx` | Shared asset list | Alternates "Ready for Disposal" and "Pending Agency Approval" by list position, and invents each asset's age |
| `LabHeadWidgets.tsx` | `IdleTimeAnalyzer` | `LabHeadAnalyticsView.tsx` | `GET /api/analytics/advanced/idle-time` | Falls back to an invented histogram when the request fails |
| `LabHeadWidgets.tsx` | `IdleTimeDurationFrequencyWidget` | `LabHeadAnalyticsView.tsx` | `GET /api/analytics/advanced/idle-frequency`, plus the shared asset list | Invented fallback; each asset's "days idle" is made up from its list position; the "6 Units" and "3 Units" badges are fixed text |
| `LabHeadWidgets.tsx` | `LoanRecommenderList` | `LabHeadAnalyticsView.tsx` | `GET /api/analytics/advanced/loan-recommender` | Invented fallback; "Request Inter-Lab Transfer" only changes the button, it sends nothing |

Together they held 17 of the typecheck errors (14 in the Director widgets, 3 in the Lab Head ones), which is why the count drops when they leave the live tree.

## Backend endpoints: kept, not deleted (team decision, 2026-10-07)

The three Lab Head widgets were the only callers of these endpoints. After this move nothing in the live app calls them:

| Endpoint | Was called by | API function (kept) |
|---|---|---|
| `GET /api/analytics/advanced/idle-time` | `IdleTimeAnalyzer` | `getIdleTimeRaw` in `web/api/analytics.api.ts` |
| `GET /api/analytics/advanced/idle-frequency` | `IdleTimeDurationFrequencyWidget` | `getIdleFrequencyRaw` |
| `GET /api/analytics/advanced/loan-recommender` | `LoanRecommenderList` | `getLoanRecommenderRaw` |

**The team decided to keep the widget code and these three endpoints for now.** They are **not** part of the step 12 deletion, which covers only the 11 endpoints listed in [`analytics-v1/README.md`](../analytics-v1/README.md). They stay mounted and, until step 13, unauthenticated, so they remain attack surface (01C section 4.4); deleting them later needs a new team decision. The four Director widgets used no endpoint of their own.

## Bringing a widget back

Move it into the view it came from (or a new file in `web/features/analytics/`), render it from that view, and give it the file header and TSDoc required by [CODE-COMMENTS.md](../../docs/guides/CODE-COMMENTS.md). Replace its invented fallback data first: a chart that shows made-up numbers when its request fails is the H-09 problem.
