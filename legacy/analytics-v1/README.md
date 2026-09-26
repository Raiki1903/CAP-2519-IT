# legacy/analytics-v1

**Do not import anything from this folder. Do not study it as an example of how the project works.**

Seven files, 2,672 lines, moved here on 2026-09-26 by step 2 of the restructure ([01D section 9](../../docs/phase-1b-deep-map/01D-restructure-plan.md#9-ordered-migration-steps)). They are an earlier, more complete analytics and reporting layer that was never wired into the router. Nothing in the live app imported any of them, which is why moving them was safe and changed no behavior.

They are kept rather than deleted because the team asked to keep them, flagged (01D section 1). Some of them look **more** finished than the screens we actually ship, which is exactly why it matters to know they are dead.

- Excluded from the TypeScript check and the Vite build: `tsconfig.json` lists `legacy` under `exclude`, and nothing imports these files, so the bundler never reaches them.
- **Their relative imports are broken now** (they still point at `../../components/ui/...` and similar from their old location). That is expected. Fix the imports only if a file is brought back.

---

## What is here

| File | Lines | What it was | Importers |
|---|---|---|---|
| `AnalyticsDashboard.tsx` | 498 | The only consumer of `GET /api/analytics/dashboard`, the largest analytics endpoint in the backend | none, ever |
| `RoleAnalyticsModule.tsx` | 722 | Per-role analytics over the six `stakeholder/*` endpoints | `AnalyticsModule.tsx` only |
| `ReportsAnalyticsDashboard.tsx` | 523 | Compliance, delinquency, and health-trend reporting | `AnalyticsModule.tsx` only |
| `AssetCatalog.tsx` | 403 | A whole parallel asset browser, separate from the live inventory screens | none, ever |
| `StudentAnalyticsView.tsx` | 291 | A student-facing stewardship view. Calls `stewardship-score` with a **hardcoded** user id of 1 | none, ever |
| `analyticsReasoning.ts` | 214 | Helper library for generating written explanations of chart data | none, ever |
| `AnalyticsModule.tsx` | 21 | Thin wrapper around `RoleAnalyticsModule` and `ReportsAnalyticsDashboard`. Itself never imported | none, ever |

`AnalyticsModule.tsx` is the only link between any two of these files, and nothing imports it, so the whole set is one closed cluster.

## Backend endpoints that now have no caller at all

These 11 endpoints in `server.ts` existed **only** for the files above. After this move, nothing in the app calls them. They are still mounted and still unauthenticated, so they remain attack surface that returns institutional equipment and finance data to anyone who asks ([01C section 4.4](../../docs/phase-1b-deep-map/01C-security-map.md#44-analytics-routes-30)).

| Endpoint | Was called by |
|---|---|
| `GET /api/analytics/dashboard` | `AnalyticsDashboard.tsx` |
| `GET /api/analytics/compliance` | `ReportsAnalyticsDashboard.tsx` |
| `GET /api/analytics/delinquencies` | `ReportsAnalyticsDashboard.tsx` |
| `GET /api/analytics/health-trends` | `ReportsAnalyticsDashboard.tsx` |
| `GET /api/analytics/stakeholder/utilization` | `RoleAnalyticsModule.tsx` |
| `GET /api/analytics/stakeholder/audit-discrepancies` | `RoleAnalyticsModule.tsx` |
| `GET /api/analytics/stakeholder/degradation-tracker` | `RoleAnalyticsModule.tsx` |
| `GET /api/analytics/stakeholder/disposal-prescriptions` | `RoleAnalyticsModule.tsx` |
| `GET /api/analytics/stakeholder/preventative-schedule` | `RoleAnalyticsModule.tsx` |
| `GET /api/analytics/stakeholder/accountability-bottlenecks` | `RoleAnalyticsModule.tsx` |
| `GET /api/analytics/advanced/stewardship-score/:userId` | `StudentAnalyticsView.tsx` |

**Two endpoints these files used are still live and must not be touched:**

- `GET /api/analytics/location-status`, also called by `TSGAnalyticsView.tsx` (the live Staff health tab).
- `GET /api/assets`, the backbone of every live screen.

## Notes worth keeping

- `GET /api/analytics/compliance` reads `asset_monetary.is_documented`, a column that exists in no schema and not in the live database, so it always reported zero (H-12).
- `GET /api/analytics/dashboard` substitutes hardcoded demo series when the real data is empty, which is one of the sources of the invented charts (H-09).
- `StudentAnalyticsView.tsx` requests `stewardship-score/1`, a hardcoded user, so it never showed the signed-in person's own record. That endpoint is also a direct object reference: changing the number in the URL reads someone else's borrowing history (01C section 4.4).

## Open decision

**Whether `/api/analytics/dashboard` and `AnalyticsDashboard.tsx` are re-attached or stay quarantined is not decided** (01D section 6, open question 5 in [01A section 10](../../docs/phase-1b-deep-map/01A-system-trace.md#10-open-questions-and-uncertainties)). This move does not settle it: quarantining keeps the option open in both directions.

If the team decides to **re-attach** a file: move it back into the feature structure (`web/features/analytics/`), fix its imports, point it at `web/api/analytics.api.ts` instead of a raw `fetch`, and give it the file header and TSDoc required by [CODE-COMMENTS.md](../../docs/guides/CODE-COMMENTS.md).

If the team decides to **delete**: delete the 11 endpoints above at the same time, in the same pull request, so no unauthenticated reporting route outlives its only caller.
