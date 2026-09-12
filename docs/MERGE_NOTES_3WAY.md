# Three-way merge notes (Backend + Frontend + Analytics)

Three branches of the same project were combined into this one tree. All three
descended from the earlier combined project, then diverged. Each contributed unique
work, and several files existed in conflicting versions.

## What each branch actually contained

Analysis of the three zips (node_modules excluded, line endings normalized first -
the Analytics branch used CRLF, which made every file look "different" until
normalized):

- **Backend branch** - the most complete tree. Improved transaction handling, added a
  full disposal workflow (3 new endpoints), added `mailer.ts` (Mailgun notifications),
  and was the only branch carrying `generated/prisma/`. 19 `fetch()` calls in `src/`.
- **Analytics branch** - added the reporting feature: `AnalyticsDashboard.tsx`, a new
  `GET /api/analytics/dashboard` aggregation endpoint, React Query wiring in `App.tsx`,
  and `recharts` charts. 17 `fetch()` calls in `src/`.
- **Frontend branch** - UI/UX work only: mobile-responsive navigation, an expanded
  context/mock layer, and a new `AssetCatalog.tsx`. **Zero `fetch()` calls** - this
  branch was entirely mock/localStorage-backed, had no `server.ts`, no `.env`, and its
  `prisma/schema.prisma` was byte-identical to the stale design-reference schema.

## The central conflict

The Frontend branch was not API-wired. Taking its component versions wholesale would
have silently reverted the live backend integration that the other two branches had.
That made a straight "newest file wins" merge impossible.

The resolution was to split the frontend by concern:

- Components that **talk to the API** were taken from Backend/Analytics.
- Components that are **pure UI** (verified: zero `fetch()` in every branch) were taken
  from Frontend, but only after proving they were compatible with the Backend context.

## Verification that made the Frontend UI safe to take

`src/app/context.tsx` is the shared state contract every component consumes. Comparing
the `AppContextType` interfaces showed the Frontend version is a **strict superset** of
the Backend one - it provides every field Backend has, plus five new ones
(`inspectionSchedules`, `addInspectionSchedule`, `resetInspectionCycle`,
`maintenanceQueue`, `resolveMaintenanceItem`). All 33 context fields used by the
Backend's API-wired components are present in it.

Same result for `prismaClient.ts`: the Frontend version exports everything the Backend
version does, plus `InspectionSchedule` and `MaintenanceQueueItem`, which the Frontend
context imports. So the two were taken together as a matched pair.

## File-by-file resolution

Taken from **Backend** (base of the merge):
- `server.ts` (see below), `mailer.ts`, `prisma.ts`, `prisma.config.ts`,
  `prisma/schema.prisma`, `generated/prisma/`, `test-user.ts`, `.env`, `docs/`
- API-wired components: `ITSDashboard`, `LabHeadDashboard`, `CustodianPortal`,
  `LoanForm`, `RepairForm`, `ReturnForm`, `TransferForm`

Taken from **Analytics**:
- `src/app/components/AnalyticsDashboard.tsx` (new feature)
- `src/app/components/AnalyticsModule.tsx` (rewritten to delegate to the dashboard)
- `src/app/App.tsx` (adds the React Query provider the dashboard needs)
- `scratch/test-db.ts`, `scratch/test-fetch.js` (connection diagnostics)

Taken from **Frontend** (UI layer, all verified zero-`fetch`):
- `src/app/context.tsx`, `src/app/prismaClient.ts` (superset pair, see above)
- `src/app/layouts/RootLayout.tsx` (mobile top bar and drawer)
- `src/app/components/Sidebar.tsx` (mobile-responsive; required by the new RootLayout,
  which passes it `isMobileOpen` / `onCloseMobile` - the Backend Sidebar had no such props)
- `src/app/components/AssetDetailModal.tsx`, `NotificationCenter.tsx`,
  `AccountDetailsPage.tsx`
- `src/app/components/AssetCatalog.tsx` - see "known loose ends"

### `server.ts` - merged, not picked

The two backend versions had **different route sets**, so neither could simply win:

- Backend had the disposal workflow (`POST /api/assets/:assetTag/disposal`,
  `GET /api/asset_disposals`, `PUT /api/asset_disposals/:disposalId/decision`) and
  email notifications, but no loan-decision route - that branch deliberately changed
  loans to approve immediately at borrow time, moving custody in the same transaction.
- Analytics still had the older two-step loan approval
  (`PUT /api/asset_loans/:loanId/decision`) and added `GET /api/analytics/dashboard`.

Resolution: the Backend version is the base (its auto-approve loan flow is the newer
design), and the Analytics aggregation endpoint was ported into it as section 18.5.
The result has all 18 routes. The older loan-decision route was intentionally not
restored, since the Backend branch's borrow flow supersedes it.

### `AdRICDirectorDashboard.tsx` - hand-merged

Both branches changed this file for different reasons: Backend added the disposal
approvals queue (2 `fetch` calls), Analytics replaced the analytics tab with the new
dashboard. Neither version alone was correct.

The Backend version was kept as the base, and its ~111-line inline `renderAnalytics`
chart block was replaced with Analytics' one-line delegation to `<AnalyticsDashboard />`,
plus the import. Disposal integration is preserved intact.

### `package.json`
Merged: Backend's `form-data` + `mailgun.js` (email), Analytics' `@tanstack/react-query`
+ `recharts` (dashboard), and Analytics' `allowScripts` block. 30 dependencies total.

### Dropped
- The Frontend branch's `prisma/schema.prisma` - the stale design schema, already kept
  at `docs/schema.fe-design.reference.prisma`. The Backend and Analytics schemas were
  byte-identical, so that one was used.
- The Frontend branch's `dist/` - a build of the mock-only UI. Shipping it would serve a
  frontend with no backend integration. Rebuild with `npm run build`.
- `package-lock.json` - the Backend branch's lockfile predates `@tanstack/react-query`
  and `recharts`, so it is stale. Parked at
  `docs/reference/package-lock.backend-branch.json`; `npm install` regenerates a correct one.
- All three branch `package.json` files are preserved under `docs/reference/` for traceability.

## Post-merge verification

Checks run against the merged tree, all passing:
- Every relative import in `src/` and in the backend files resolves.
- Every context field consumed by any component is provided by the merged context.
- Every symbol the context imports from `prismaClient` exists.
- Every `fetch()` URL in the frontend maps to a route defined in `server.ts`, and vice
  versa (calls written as `${API_BASE}/api/...` and as absolute URLs both check out).

## Known loose ends (carried over, not introduced here)

- `AssetCatalog.tsx` came from the Frontend branch but **nothing imports it** - it was
  already an orphan there. It is included so the work is not lost, but it is not wired
  into any route or dashboard yet.
- API base URLs are still hardcoded as `http://localhost:4000` in the components (some
  via an `API_BASE` constant, some inline). The deployment guide's find-and-replace to
  relative `/api` still applies.
- Mailgun credentials sit in `.env` alongside the DB password. Keep that file out of
  version control.
- The frontend still mixes two data sources: live API calls in the dashboards and forms,
  and the localStorage mock in `context.tsx` / `prismaClient.ts` for the rest. That split
  predates this merge.
