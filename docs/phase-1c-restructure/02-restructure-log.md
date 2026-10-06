# 02. Restructure Log

Running record of the migration in [01D section 9](../phase-1b-deep-map/01D-restructure-plan.md#9-ordered-migration-steps).
Decision and comment standard: [01-restructure-decision.md](01-restructure-decision.md), [../guides/CODE-COMMENTS.md](../guides/CODE-COMMENTS.md).

Branch: `refactor/feature-based-structure` from step 3 on (steps 0 to 2 were on `refactor/option-a-structure`, merged in PR #4). Steps 3 to 5 were merged into `main` in PR #15 and step 6 in PR #16. The fixes for issues #25 and #26 were merged in PR #33 (their own branch); step 8 continues from that merge. Nothing here is pushed by the agent; Raiki pushes and opens the pull requests.

---

## Status

| # | Step | Status | Move commit | Comment commit | Typecheck errors | Date |
|---|---|---|---|---|---|---|
| A | Part A: decision and comment standard | Done | `fbaa777`, `1cfb784` | n/a (docs) | n/a | 2026-09-26 |
| 0 | Safety net first (01C tier 1, code parts) | Done | `324dfda` | n/a (see note 1) | n/a (step 1 adds it) | 2026-09-26 |
| 1 | Add `tsconfig.json` and a `typecheck` script | Done | `e5a13ef1` | n/a (see note 2) | **114 (baseline)** | 2026-09-26 |
| 2 | Quarantine dead code into `legacy/analytics-v1/` | Done | `5b68bb6b` | n/a (see note 3) | **98** (from 114) | 2026-09-26 |
| 3 | Create `shared/`, move enums and the lab list | Done | `e88ae11b` | `58840373` | **98** (unchanged) | 2026-09-30 |
| 4 | Introduce `web/api/client.ts`, convert loans | Done | `a4c1b417` | `88eea586` | **98** (unchanged) | 2026-10-01 |
| 5 | Convert the remaining features to the API client | Done | `5389d51b` to `497d0c30` (9 commits, see detail) | `6488407b` | **98** (unchanged, same errors) | 2026-10-02 |
| 6 | Split `context.tsx`, delete localStorage-only actions | Done (hand checks passed, PR #16) | `9d1b62a9`, `b35a67e1` (behavior changes), `20cd4fdd` (move), `8dcd6120` (types) | `f8f43435` | **93** (from 98, see detail) | 2026-10-03 |
| 7 | Delete `prismaClient.ts` | Done (hand checks passed) | `6e08e469` (behavior change) | n/a (see note 4) | **93** (unchanged, same errors) | 2026-10-04 |
| 8 | Move the frontend to `web/` with feature folders (part 1: everything except `ITSDashboard.tsx`; part 2: split it) | Part 1 done (hand checks pending); part 2 not started | `edcb9162` to `6d9facc2` (14 commits, see detail) | `ffa05a38` | **93** (unchanged, same errors) | 2026-10-06 |
| 9 | Merge ITS and TSG into `/staff/*` | Not started | | | | |
| 10 | Create the `server/` skeleton | Not started | | | | |
| 11 | Extract one backend feature end to end (loans) | Not started | | | | |
| 12 | Extract the remaining backend features | Not started | | | | |
| 13 | Add `errorHandler` and `requireAuth` | Not started | | | | |
| 14 | Baseline the migrations | Not started | | | | |

Steps 6, 7, 9, and 13 change behavior on purpose. Every other step is a move or an addition.

---

## Step 0 detail

**What changed in the code:**

- `server.ts` `performDatabaseBackup()`: the `users` table is no longer read, and the destination is `process.env.BACKUP_DIR` with **no default**. If `BACKUP_DIR` is unset the backup is skipped with a warning, and if it resolves to a path inside the repository the backup is skipped as well. Previously it wrote to `scratch/backups/` on startup and every 6 hours (C-01, C-03).
- `.gitignore`: added `scratch/backups/` and `pending_registrations.json` (M-19).
- `.env.example`: created, variable **names** only, including the new `BACKUP_DIR` (C-07).
- Untracked with `git rm --cached`: 113 files under `scratch/backups/` and `pending_registrations.json`. **The files remain on disk**, they are only removed from git tracking.

**Verified:** `npm run build` passes. `npx tsx server.ts` starts and listens on port 4000. No new backup file was written during that run (the folder still holds the same 113 files).

**Not verified:** the "Backup skipped" log line was not observed at runtime, because `assertDefaultCustodianExists()` runs before the backup in the startup callback and hangs without database access from this machine. The guard is the first statement in the function, before any Prisma call, and no file was written, which is the outcome that matters.

---

## Step 1 detail

**What changed:** `tsconfig.json` created at the root, and a `typecheck` script (`tsc --noEmit`) added to `package.json`. Nothing moved and no application code changed.

**Config choices worth knowing:**

- `strict: false` for now, as 01D step 1 specifies. Turning it on is a separate, later decision; it would add a large number of errors at once.
- Path aliases: `@/*` (the existing Vite alias, kept so nothing breaks), plus `@server/*`, `@web/*`, and `@shared/*` ready for steps 3, 8, and 10. Pointing an alias at a folder that does not exist yet is harmless.
- No `baseUrl`. TypeScript 6 deprecates it and errors on it; `paths` resolves relative to this file without it.
- `allowImportingTsExtensions: true`, because [src/main.tsx:2](../../src/main.tsx#L2) imports `./app/App.tsx` with the extension. Vite supports that, so without this option the typecheck reported a false positive.
- `skipLibCheck: true`, standard practice, and it keeps `@types/react` v19 against the React 18 runtime (L-03) from filling the output with noise. That mismatch is still there and is not fixed here.
- Excluded: `node_modules`, `dist`, `scratch` (27 one-off scripts that are not part of the running app), and `legacy` (does not exist until step 2, and 01D says it stays out of the build).

**Baseline: 114 errors.** Keep this number from growing. By file:

| Count | File |
|---|---|
| 34 | `src/app/components/DirectorAnalyticsView.tsx` |
| 14 | `src/app/components/NotificationCenter.tsx` |
| 8 | `src/app/components/RoleAnalyticsModule.tsx` (quarantined in step 2) |
| 8 | `src/app/components/LabHeadAnalyticsView.tsx` |
| 8 | `src/app/components/AdRICDirectorDashboard.tsx` |
| 8 | `server.ts` |
| 7 | `src/app/components/AssetDetailModal.tsx` |
| 5 | `src/app/components/ITSDashboard.tsx` |
| 4 | `src/app/components/TSGAnalyticsView.tsx` |
| 4 | `src/app/components/ReportsAnalyticsDashboard.tsx` (quarantined in step 2) |
| 3 | `src/app/components/StudentAnalyticsView.tsx` (quarantined in step 2) |
| 3 | `src/app/components/AssetImagePlaceholder.tsx` |
| 3 | `src/app/components/AccountDetailsPage.tsx` |
| 2 | `src/app/components/LabHeadDashboard.tsx` |
| 1 | `test-user.ts`, `src/app/components/CustodianPortal.tsx`, `src/app/components/AssetCatalog.tsx` (last one quarantined in step 2) |

Most common codes: 49 of TS2339 (property does not exist), 37 of TS2322 (type not assignable, mostly `motion` animation `ease` strings), 10 of TS2367 (comparison that is always false), 9 of TS2551 (property misspelled, "did you mean").

**Step 2 should reduce this to about 98**, because 16 of the 114 are in the four files being quarantined and `legacy` is excluded from the typecheck.

**The typecheck independently confirms H-13.** It flags the exact lines 01B names: `ITSDashboard.tsx(1943)` `first_name` ("did you mean `firstName`"), `ITSDashboard.tsx(1973)` and `CustodianPortal.tsx(341)` `user_id` ("did you mean `userId`"). `test-user.ts(11)` confirms L-04. These are real, live bugs writing wrong data, and they were invisible before this step.

**Verified:** `npm run typecheck` completes and prints a list. `npm run build` still passes.

---

## Step 2 detail

**What moved:** 7 files, 2,672 lines, from `src/app/components/` and `src/app/lib/` into `legacy/analytics-v1/`. Git recorded all seven as `R100`, pure renames with no content change. `legacy/analytics-v1/README.md` was added.

| File | Lines |
|---|---|
| `RoleAnalyticsModule.tsx` | 722 |
| `ReportsAnalyticsDashboard.tsx` | 523 |
| `AnalyticsDashboard.tsx` | 498 |
| `AssetCatalog.tsx` | 403 |
| `StudentAnalyticsView.tsx` | 291 |
| `analyticsReasoning.ts` | 214 |
| `AnalyticsModule.tsx` | 21 |

**Behavior change:** none. Verified before moving that the only references to any of these files are among themselves: `AnalyticsModule.tsx` imports `RoleAnalyticsModule` and `ReportsAnalyticsDashboard`, and nothing imports `AnalyticsModule`. `routes.tsx` imports only the nine live screens. So the set is one closed cluster with no live entry point.

**Side effect:** `src/app/lib/` is now empty, since `analyticsReasoning.ts` was its only file.

**11 backend endpoints now have no caller at all.** They are listed in the README with the component each belonged to. They are still mounted and still unauthenticated, so they remain attack surface (01C section 4.4). Deleting them is a separate decision tied to the open question below.

**Two endpoints these files used are still live** and were deliberately not touched: `GET /api/analytics/location-status` (also called by `TSGAnalyticsView.tsx`) and `GET /api/assets`. Checked by grepping live `src/` after the move.

**Typecheck: 114 to 98.** The drop of 16 is exactly the errors that were in `RoleAnalyticsModule` (8), `ReportsAnalyticsDashboard` (4), `StudentAnalyticsView` (3), and `AssetCatalog` (1), which `tsconfig.json` now excludes. This was the predicted number.

**Verified:** `npm run typecheck` reports 98. `npm run build` passes.

**Still open, and this step does not settle it:** whether `/api/analytics/dashboard` and `AnalyticsDashboard.tsx` are re-attached or stay quarantined (01D section 6, open question 5). Quarantining keeps both options available. The README says what to do in either direction.

**Decided 2026-10-04:** the 11 endpoints are deleted when the analytics backend is extracted in step 12, and the screen code stays in `legacy/analytics-v1/`. The README's "Open decision" section was updated to match.

---

## Step 3 detail

**What moved:**

| Value | From | To |
|---|---|---|
| `DLSU_LABS` and `LabOption` (the whole file) | `src/app/constants/labs.ts` (moved with `git mv`) | `shared/constants/labs.ts` |
| Condition list (`PERFECT` to `CRITICAL_DEFECT`) | `server.ts` `ASSET_CONDITIONS`, `ReturnForm.tsx` `CONDITIONS`, an inline array in `ITSDashboard.tsx` (edit dialog) | `shared/enums/assetCondition.ts` as `ASSET_CONDITIONS` |
| Category list (20 values) | `server.ts` `VALID_CATEGORIES`, `ITSDashboard.tsx` `category` | `shared/enums/assetCategory.ts` as `ASSET_CATEGORIES` |
| App role type `Role` | `src/app/context.tsx` | `shared/enums/role.ts` |

Every copy that was replaced held exactly the same values in the same order, checked against `prisma/schema.prisma` (`assets_category`, `asset_records_asset_condition`). So dropdowns and validation see identical lists.

**Import changes:** `server.ts`, `context.tsx`, `ITSDashboard.tsx`, `ReturnForm.tsx`, `Register.tsx`, `Login.tsx`, `NotificationCenter.tsx`, `Sidebar.tsx` now import from `@shared/...`. There is no re-export left in `context.tsx`: the three files that took `Role` from it import it from `shared/` directly.

**Config:** `vite.config.ts` gained the `@shared` alias (the "alias" is a short name for a folder, so imports do not need `../../`). `tsconfig.json` already had it from step 1. The server needed no change: `tsx` reads the aliases from `tsconfig.json`.

**Behavior change:** none.

**Deliberately left in place** (see notes): the database role names used in login (`ADRIC_DIRECTOR`, `TSG_STAFF`, `LAB_HEAD`), `LAGUNA_LABS`, the per-screen condition colour maps, and the analytics `CATEGORY_OPTIONS` list.

**Verified:** `npm run typecheck` reports 98, same as before. `npm run build` passes. `npx tsx server.ts` starts and listens on port 4000, which also confirms the server resolves `@shared` at runtime.

---

## Step 4 detail

**What was added:**

- `web/api/client.ts`: the one place that knows the backend address. It reads `VITE_API_URL` and falls back to `http://localhost:4000`, the address every screen used before. It exposes `apiGet`, `apiPost`, and `apiPut`.
- `web/api/loans.api.ts`: the three loan calls, `requestLoan`, `listLoans`, and `decideLoan`.
- `vite.config.ts`: the `@web` alias. `.env.example`: the `VITE_API_URL` name (optional).

These two files are created directly at their final location in `web/`, so step 8 does not have to move them. The rest of the frontend is still in `src/` until then.

**What was converted:** all six loan `fetch` calls, in four files.

| File | Call | Now uses |
|---|---|---|
| `LoanForm.tsx` | `POST /api/assets/:tag/borrow` | `loansApi.requestLoan` |
| `LabHeadDashboard.tsx` | `GET /api/asset_loans` | `loansApi.listLoans` |
| `LabHeadDashboard.tsx` | `PUT /api/asset_loans/:id/decision` | `loansApi.decideLoan` |
| `LabHeadAnalyticsView.tsx` | `PUT /api/asset_loans/:id/decision` | `loansApi.decideLoan` |
| `context.tsx` (initial load) | `GET /api/asset_loans` | `loansApi.listLoans` |
| `context.tsx` (`authorizeLoan`) | `PUT /api/asset_loans/:id/decision` | `loansApi.decideLoan` |

After this step, a search for `asset_loans` or `/borrow` in `src/` and `web/` finds URLs only in `web/api/loans.api.ts`.

**Behavior change:** none intended. The client sends the same method, the same `Content-Type` header, and the same JSON body as each old call, and returns the parsed JSON body whatever the HTTP status is. That matches the old code, where every call site read `success` from the body and none looked at the status. Making the client throw typed errors is deliberately left for step 13, when the server gets its `errorHandler`.

**Verified (database unreachable on 2026-10-01, so no end-to-end run):** `npm run typecheck` reports 98. `npm run build` passes. `npx tsx server.ts` starts and listens on port 4000, and `PUT /api/asset_loans/abc/decision` answers with the expected "Invalid loan id" JSON.

**Hand checks: passed.** Raiki ran the step 3 and step 4 hand checks against the database on 2026-10-02 and all passed. The list is kept for the record:

1. As a Custodian, open an available asset and submit a borrow request. Expect the success screen, and a new `pending` row in `asset_loans`.
2. Submit a borrow request with a field left empty or for a bad asset. Expect the error message under the form, not a blank screen.
3. As a Lab Head, open the Custody tab. The loan requests list loads.
4. Approve one loan and decline another from the Custody tab. Each row's status changes in `asset_loans`, and the list refreshes.
5. As a Lab Head, approve a loan from the notification bell (the bell only offers approve for loans). The bell entry updates and the row changes in `asset_loans`.
6. With the server stopped, open the Custody tab. Expect the "Failed to load loan requests" style error, not a crash.

---

## Step 5 detail

**What was converted:** the remaining 55 `fetch` calls, one feature per commit. With the 6 loan calls from step 4, all 61 now go through `web/api/`. A search of `src/` finds no `fetch(` call and no `localhost:4000` any more.

| Commit | Feature | New file | Calls | Files touched |
|---|---|---|---|---|
| `5389d51b` | (client) | `client.ts` gains `apiDelete`, `apiGetRaw`, `apiPostRaw`, `apiPutRaw` | 0 | 1 |
| `2493aaf9` | Assets | `web/api/assets.api.ts` | 11 | `AdRICDirectorDashboard`, `CustodianPortal`, `ITSDashboard`, `LabHeadDashboard`, `TSGAnalyticsView`, `AssetDetailModal`, `context.tsx` |
| `c9ab19f9` | Transfers | `web/api/transfers.api.ts` | 5 | `TransferForm`, `LabHeadDashboard`, `LabHeadAnalyticsView`, `context.tsx` |
| `6ead3da0` | Returns | `web/api/returns.api.ts` | 1 | `ReturnForm` |
| `2ebe1429` | Repairs | `web/api/repairs.api.ts` | 9 | `RepairForm`, `ReturnForm`, `ITSDashboard`, `TSGAnalyticsView`, `context.tsx` |
| `ef04dc97` | Disposals | `web/api/disposals.api.ts` | 4 | `ITSDashboard`, `AdRICDirectorDashboard`, `context.tsx` |
| `306c205b` | Inspections | `web/api/inspections.api.ts` | 4 | `CustodianPortal`, `ITSDashboard`, `context.tsx` |
| `2d470773` | Auth and registrations | `web/api/auth.api.ts` | 9 | `Login`, `Register`, `AccountDetailsPage`, `context.tsx` |
| `497d0c30` | Analytics | `web/api/analytics.api.ts` | 12 | `DirectorAnalyticsView`, `LabHeadAnalyticsView`, `TSGAnalyticsView` |

Registration calls live in `auth.api.ts` because their URLs are under `/api/auth/` and 01D lists no separate web API file for them. The four `API_BASE` constants (in `LabHeadDashboard`, `TransferForm`, `RepairForm`, `ReturnForm`) were removed when their last use went.

**The rule that kept this behavior-neutral.** Not every call site handled the answer the same way, so the client now has two kinds of call:

- A site that parsed the JSON straight away and read `success` uses a plain function (`apiGet`, `apiPost`, `apiPut`, `apiDelete`), which returns the parsed body.
- A site that did anything else with the answer uses a `Raw` function, which returns the untouched `Response` (the browser's object for a server answer), and keeps its own handling exactly as it was. That covers three cases: sites that check the HTTP status or content type themselves (asset create and edit in `ITSDashboard`, `Register`, 11 analytics reads and the `TSGAnalyticsView` asset list, which check `res.ok`), and sites that send a request and never read the answer (both inspection submits, three repair writes in `context.tsx`, and reject-registration).

15 of the 40 API functions are `Raw`. They are a temporary bridge: step 13 makes the plain calls throw typed errors, and the `Raw` calls can then go.

Query strings for the three dashboard endpoints are still built at the call sites and passed in as text, because the sites build them in two different ways and merging those would not be a pure move.

**Behavior change:** none intended.

**Verified:**

- `npm run typecheck` reports 98 after every commit, and a line-by-line comparison shows the same 98 errors as before the step.
- `npm run build` passes after every commit.
- `npx tsx server.ts` starts and listens on port 4000.
- Every one of the 40 functions in `web/api/` was called once with `fetch` replaced by a recorder, and the method, URL, headers, and body of each request were compared with the original `fetch` literal. All 40 match. This checks the API files themselves, not the screens.

**Not verified:** nothing was clicked in a browser and no request reached the database in this session.

**Hand checks: passed.** Raiki ran the ten checks below against the database and all passed (reported 2026-10-03). Step 5 was merged into `main` in PR #15. The list is kept for the record:

1. *Assets.* Log in as each role and open the inventory. The asset list loads. Open one asset and check the custodian history loads. As Staff, register a new asset, edit it, then delete it.
2. *Assets, error path.* Stop the server and try to register an asset. The form shows an error message, not a blank screen.
3. *Transfers.* As a Custodian, file a transfer. As a Lab Head, see it in the Custody tab, approve one and decline another. Check `asset_transfers`.
4. *Returns.* Finalize a return from the return form. A reference number appears, and a row lands in `asset_returns`.
5. *Repairs.* File a repair from the repair form and from the return form's "flag for repair". As Staff, acknowledge a ticket, move it through its statuses in the repair dialog, and move one from the analytics board. Check `asset_repairs` and the asset's status after each.
6. *Disposals.* As Staff, file a disposal. As Director, see it, approve one and reject another. Check `asset_disposals`.
7. *Inspections.* As a Custodian, submit a condition report. As Staff, finalize a single-item inspection. Both appear in the Staff report list and in `asset_reports`.
8. *Auth.* Log in and log out as each role. Reload the page while logged in and stay logged in. Change name and picture on the account page and reload.
9. *Registrations.* Submit a sign-up. As a Lab Head, see it, approve one and reject another.
10. *Analytics.* Open the Director, Lab Head, and Staff analytics views. Charts load with real data. Change the lab and date filters on each.

---

## Step 6 detail

**This step changes behavior on purpose.** It is split into four commits so that each one has a single purpose, plus the comment commit.

| Commit | Kind | What it does |
|---|---|---|
| `9d1b62a9` | Behavior change | The notification bell's transfer and disposal buttons call the real API (H-01) |
| `b35a67e1` | Behavior change | The rest of the fake browser database is removed from `context.tsx` |
| `20cd4fdd` | Move | `context.tsx` is split into three files under `web/state/` and deleted |
| `8dcd6120` | Types only | Two declared types are corrected to match the code |
| `f8f43435` | Comments | File headers, TSDoc, inline comments |

**A decision was asked for first.** The session's instruction was to stop and ask before deleting any localStorage-only action whose feature has no database replacement. Three were found. Raiki's answer (2026-10-03): **keep all three, isolated, with no behavior change; the team decides the real fix later.** They are recorded as open team decisions in the notes below.

**The team accepted all three changes that went beyond the plan (2026-10-04):** bell transfer buttons for the Lab Head only (item 3 below), the removal of `toggleClearanceHold` (item 7), and the two temporary state files `serverData.tsx` and `browserOnly.tsx`.

### What changed in behavior

1. **Bell approvals now save (H-01).** Approve and Decline on a transfer card call `transfersApi.decideTransfer`. Authorize and Reject on a disposal card call `disposalsApi.decideDisposal`. Both then reload from the server. Before, they changed only the browser's fake database.
2. **The bell lists pending disposals only.** It used to list approved and rejected ones too, because the list was never filtered by status. Without this, a disposal decided from the bell would never leave it. The Director analytics "pending disposals" fallback count uses the same list, so it is now a count of pending ones as well.
3. **Transfer buttons in the bell show for the Lab Head only.** Staff and the receiving custodian used to see them too. Those buttons did nothing real before; making them real for those roles would have let a recipient approve their own transfer, which no dashboard allows and which contradicts the recorded decision (Lab Head approval, no recipient step). Their cards still appear and still link to the transfers tab. This is a judgment call and is one line to reverse (`role === "LabHead"` in `NotificationCenter.tsx`).
4. **No second copy of anything is written to the browser.** `addAsset`, `removeAsset`, `updateAsset`, and `addTransferRequest` are gone. Each used to run after the real API call and then reload from the server. The call site now does the reload itself (`syncFromDb()`), in the same place, so screens refresh as they did.
5. **No fake fallback data.** If `GET /api/assets` fails, the asset list keeps what it showed before instead of switching to the browser's fake copy. The bell, the Director audit trail, and the Director transfer chart no longer fall back to the fake transfer list (which also held a fake "transfer" row for every loan request). Old `ems_pending_disposals` values are no longer read.
6. **No fake user fallback in the session.** If `/api/auth/me` does not know the email in the session cookie, the person is logged out. Before, the fake user table was tried first. Saving a profile no longer writes a second copy to the fake user table. For a real account whose numeric id happened to match one of the 11 fake users, that second write also triggered a full data reload and overwrote the lab shown in memory with the form's value; neither happens now.
7. **Dead actions removed:** `disposeAsset`, `addInspectionSchedule`, `resolveMaintenanceItem`, `resetInspectionCycle`, `toggleClearanceHold`, and the `inspectionSchedules` and `maintenanceQueue` lists. No screen called any of them (H-18, F-37). The bell's "Inspection Scheduled" reminders, which could only ever show schedules created by those uncalled actions, are removed with them.

### What stayed the same, on purpose

The three browser-only lists work exactly as before on screen. They now live in one clearly labelled file, `web/state/browserOnly.tsx`:

| List | localStorage key | Still does |
|---|---|---|
| Custodian return requests | `ems_returns` | Custodian submits a request, Staff see it in Pending Returns (same browser only), Staff finalize it |
| Staff inspection log | `ems_inspections` | Every submitted report is added to the log table on the Staff inspections tab |
| Manual clearance holds | `ems_manual_clearance_holds` | Any hold already saved in a browser still shows in the bell |

`finalizeReturn` and `addInspectionReport` keep their browser list and lose only their write to the fake database, which nothing reads any more. The one piece that could not be kept is `toggleClearanceHold`: it looked the person up in the fake user table that step 7 deletes, and no screen called it, so there is no way to create a hold today and there was none before.

### The split, and how it differs from 01D

`context.tsx` (1,161 lines) is gone. `useApp()` is replaced by three hooks, and all 19 files that used it were updated.

| File | Hook | Holds |
|---|---|---|
| `web/state/session.tsx` | `useSession()` | Role, current user, profile save, theme, cycle mode, sidebar, cookie helpers, `roleToSlug`, `roleDefaultPath` |
| `web/state/serverData.tsx` | `useServerData()` | The lists several screens share, loaded through `web/api`: assets, repairs, loans, transfers, reports, pending disposals, pending registrations, and their actions |
| `web/state/browserOnly.tsx` | `useBrowserOnly()` | The three browser-only lists above |

**Difference from 01D section 2,** which lists only `session.tsx` under `web/state/`:

- `serverData.tsx` is not in 01D. 01D has every page load its own data through `web/api`. Today 16 files read the shared lists (the asset list alone is read by 9 of them, and the notification bell fetches nothing itself). Giving each of them its own loading is a rewrite of every dashboard, which is step 8's job (the dashboards are split into pages there) and the bell rewrite's job (01D section 8). So the shared lists get a temporary home that only calls `web/api` and never touches localStorage. It should shrink in step 8 and disappear when the bell is rewritten.
- `browserOnly.tsx` is not in 01D either. It exists because of the decision above. 01D expected these lists to be deleted.

The intent of 01D is kept: session state is alone in its file, no URL appears outside `web/api`, and the fake database is no longer mixed into shared state.

`getDescriptiveCondition` moved into `AssetDetailModal.tsx`, its only user. One timing difference: the browser-only lists are read when the page loads, and again on every server reload as before, where they used to wait for the first reload to finish.

### Typecheck: 98 to 93

| Change | Errors | Why |
|---|---|---|
| `b35a67e1` | 98 to 97 | The error was inside the deleted `addAsset` call (`image_url` is not on `Asset`) |
| `8dcd6120` | 97 to 93 | `updateProfile` is declared with its fourth argument (3 errors in `AccountDetailsPage`), and `approveRegistration` is declared to take a registration or an id (1 error in `LabHeadDashboard`) |

No new error appeared. 14 messages now name the type `SessionUser` where they said `User`, because the session user type no longer comes from the fake database file. They are the same H-13 errors on the same lines.

### Verified

- `npm run typecheck` and `npm run build` after every commit: counts as above, build passes each time.
- Server: a server was already running on port 4000 during the session, so no second one was started. `GET /api/auth/me` with no email answered with the expected "Email query param required" JSON. `server.ts` is unchanged in this step.
- The three providers were rendered together outside a browser: each hook returns the expected members, preferences are read from cookies, the return list is read from localStorage, and using a hook outside its provider throws a clear error.
- One reload was run with `fetch` replaced by a recorder: it requests the same six endpoints in the same order as before the step (`assets`, `asset_transfers`, `asset_reports`, `asset_loans`, `asset_disposals`, `asset_repairs`).
- Comment commit: the compiled output of the three state files is identical before and after.
- After `b35a67e1`, the only file that imports `prismaClient.ts` is `Login.tsx`.

**Not verified:** nothing was clicked in a browser, and no approval was sent to the database in this session.

**Known gap until step 7:** `Login.tsx` still falls back to the fake users. Someone who logs in that way now gets a Custodian screen with no profile, and is logged out on reload. Step 7 removes the fallback. (Closed by step 7, `6e08e469`.)

### Hand checks: passed

Raiki ran the eleven checks below against the database and all passed. Step 6 was merged into `main` in PR #16. The list is kept for the record.

Two bugs were found while running them. Both exist on `main` before step 6 and are not caused by it, so they are fixed on their own branch after step 7, not in the restructure:

- Custodians can submit duplicate requests on the same asset (H-05, issue #25).
- My Assets shows disposed assets, because `CustodianPortal.tsx` does not filter the list by status (issue #26).

1. *Bell, transfer.* As a Custodian, file a transfer for a **CITe4D** asset (the bell only shows a Lab Head transfers tagged CITe4D, see notes). As a Lab Head, open the bell and press Approve Transfer. Expect `asset_transfers.status` to become `approved`, a new `asset_records` row for the new custodian, and the card to leave the bell. Repeat with Decline on a second transfer: status `declined`, no new record row.
2. *Bell, disposal.* As Staff, file a disposal. As Director, open the bell and press Authorize Disposal. Expect `asset_disposals.status` to become `approved`, the asset to show as Disposed, and the card to leave the bell. Repeat with Reject on a second one.
3. *Bell, other roles.* As Staff, and as the receiving custodian, a pending transfer card shows with no Approve or Decline button. Clicking the card opens the transfers tab.
4. *Bell, decided disposals.* A disposal approved or rejected earlier does not appear in anyone's bell.
5. *Assets.* As Staff, register an asset, edit it, delete it. The inventory refreshes after each, as before.
6. *Loans and transfers.* As a Custodian, submit a borrow request and a transfer request. Each shows its success screen, and the custodian's bell lists the new request.
7. *Returns (must be unchanged).* As a Custodian, submit a return request. In the same browser, log in as Staff: Pending Returns lists it. Press Evaluate and Finalize and finish the form. A row lands in `asset_returns`, a reference number shows, and the request leaves the pending list.
8. *Inspection log (must be unchanged).* As a Custodian, submit a condition report. In the same browser, as Staff, open Inspections: the log table lists it and View Report opens it. Finalize a single-item inspection as Staff: it joins the log and a row lands in `asset_reports`.
9. *Session.* Log in as each role, reload, and stay logged in with the right dashboard. Log out and land on the login page. Change name and picture on the account page, reload, and see them kept.
10. *Preferences.* Change the theme, collapse the sidebar, switch the cycle mode. Reload. All three are remembered.
11. *Server stopped.* With the server stopped, reload while logged in. Expect the login page, not a crash.

---

## Step 7 detail

**This step changes behavior on purpose.** One commit, `6e08e469`.

**What changed:**

- `src/app/prismaClient.ts` is deleted (583 lines). It was the fake database in the browser: 11 demo accounts with their passwords, and imitation tables saved under the localStorage key `dlsu_equipment_ms_db_v2`.
- `Login.tsx` no longer imports it. It was the last file that did (after step 6).

**What changed in behavior:** before, when the server said no, `Login.tsx` looked the email and password up in the fake database. If a demo account matched, the person was let in as a Custodian. That happened in three cases: the server refused the login (401), the server failed (500, for example the database was down), or the server could not be reached at all. Now all three show the error and stop:

| Case | Message shown (same text as before) |
|---|---|
| Wrong email or password (401) | The server's message: "Invalid institutional email address or password." |
| Server error (500) | The server's message (H-16: this is the raw database error text) |
| Server unreachable | "Invalid institutional email address or password." |

Someone using a real account sees no difference. A demo account that also exists in the database with the same password still logs in, through the server, which is correct. One more effect: just loading the login page used to write the fake database, passwords included, into the browser's localStorage. That no longer happens, and the demo passwords are no longer in the code every visitor downloads (C-03, 01C section 2.2).

**How the fallback was removed without changing anything else:** the server always sends a `role` when `success` is true, so the success path is exactly the old one. The two error paths keep their old messages word for word. They now return straight away instead of trying the fake lookup first.

**Not changed, logged instead:** the "server unreachable" case says "Invalid ... password", which is misleading when the real problem is the network. That was the old message too, so it stays until step 13 gives the client typed errors (see notes).

**Typecheck: 93, unchanged.** A line-by-line comparison shows the same 93 errors as before the step. Neither deleted nor edited file had any.

### Verified

- `npm run typecheck`: 93, the same list.
- `npm run build` passes. The built bundle in `dist/` no longer contains `dlsu_equipment_ms_db_v2`.
- A search of `src/`, `web/`, `shared/`, and `legacy/` finds no `prismaClient` import and no use of the fake database's storage key.
- `npx tsx server.ts` starts and listens on port 4000. The database was reachable: `POST /api/auth/login` with an empty body answered 400 "Please enter your email and password.", and with an unknown account answered 401 "Invalid institutional email address or password.", which is the message the form now shows for that case.

**Not verified in the agent session:** nothing was clicked in a browser, and no real account was logged in. The hand checks below cover that.

### Hand checks: passed

Raiki ran the five checks below against the database and all passed (reported 2026-10-05): real logins work for each role, the old demo accounts are refused, a wrong password is refused, a login with the server stopped stays on the login page with an error, and the `dlsu_equipment_ms_db_v2` key does not come back. The list is kept for the record.

1. *Real accounts.* Log in as Staff (ITS and TSG), Lab Head, Custodian, and Director. Each lands on its own dashboard, and a reload keeps you logged in.
2. *Old demo accounts.* Try two or three of the 11 accounts that were in the fake database (the list is in `git show fbfcccda:src/app/prismaClient.ts`, around line 200). Each is refused with "Invalid institutional email address or password." unless that same email and password also exist in the real database, in which case it logs in normally.
3. *Wrong password.* A real email with a wrong password is refused with the same message.
4. *Server stopped.* Stop the server and try to log in. The form shows the error and stays on the login page.
5. *No fake database in the browser.* In the browser's developer tools (Application, then Local Storage), delete `dlsu_equipment_ms_db_v2` if it is there from an older version, reload the login page, and log in. The key does not come back.

---

## Step 8 detail

Step 8 runs in two sessions (decided 2026-10-06). **Part 1, done here:** move everything except `ITSDashboard.tsx` into `web/`. **Part 2, next session:** split `ITSDashboard.tsx` into `web/pages/staff/`, move inspection scheduling to `legacy/`, and point the inspection log at the database.

### Part 1: what moved

14 move commits, one feature per commit. Every file moved unchanged except for its import lines. Git records all 45 as renames: 26 are identical (100%), and the rest differ only in import lines (the lowest, 62%, is the three-line `tailwind.css`).

| Commit | Feature | From `src/app/` | To `web/` |
|---|---|---|---|
| `edcb9162` | UI primitives (18 files) | `components/ui/*` | `components/ui/*` |
| `66602a09` | Assets | `components/AssetDetailModal.tsx`, `AssetImagePlaceholder.tsx` | `features/assets/` |
| `bd145b39` | Loans | `components/LoanForm.tsx` | `features/loans/` |
| `14e19c6d` | Transfers | `components/TransferForm.tsx` | `features/transfers/` |
| `1dab9d32` | Returns | `components/ReturnForm.tsx` | `features/returns/` |
| `308f01d2` | Repairs | `components/RepairForm.tsx` | `features/repairs/` |
| `fb8c2ee7` | Notifications | `components/NotificationCenter.tsx` | `features/notifications/` |
| `3da6ad01` | Analytics | `components/DirectorAnalyticsView.tsx`, `LabHeadAnalyticsView.tsx`, `TSGAnalyticsView.tsx` | `features/analytics/director/`, `labHead/`, `staff/` |
| `9f457103` | Auth screens | `components/Login.tsx`, `Register.tsx` | `pages/auth/` |
| `7ad78626` | Custodian screen | `components/CustodianPortal.tsx` | `pages/custodian/` |
| `ce741d17` | Lab Head screen | `components/LabHeadDashboard.tsx` | `pages/lab-head/` |
| `70ba9cea` | Director screen | `components/AdRICDirectorDashboard.tsx` | `pages/director/` |
| `757c1c25` | Shared screens | `components/AccountDetailsPage.tsx`, `NotFound.tsx` | `pages/` |
| `6d9facc2` | App shell | `src/main.tsx`, `App.tsx`, `routes.tsx`, `layouts/RootLayout.tsx`, `components/Sidebar.tsx`, `src/styles/*` | `main.tsx`, `app/`, `app/layouts/` (Sidebar too, per 01D), `styles/` |

**What stays in `src/`:** only `src/app/components/ITSDashboard.tsx`. The router reaches it through the `@/` alias (`@/app/components/ITSDashboard`), and it imports everything else from `web/` through `@web`.

**How imports were written.** A file importing something in another folder uses the `@web/...` alias, as the code already did for `web/api` and `web/state`. Files in the same folder keep `./`. An alias import does not change when the importing file moves, so each import line changed at most once in the step, and no relative `../../` paths were added.

**Config changes, all in the commit of the move that needed them:**

- `index.html` loads `/web/main.tsx` instead of `/src/main.tsx`.
- `tailwind.css` lists the folders Tailwind scans for class names. It scanned only `src/` before; it now scans `web/` (where it lives) and `src/` (for `ITSDashboard.tsx`). Without this, the moved components would have lost their styles.
- `vite.config.ts` and `tsconfig.json` did not change: the `@web` alias existed since step 4, and the `@` alias and `src` entry are still needed for `ITSDashboard.tsx`.

**Behavior change:** none. The strongest evidence: the production build (`dist/assets/index-*.css` and `index-*.js`) is **byte-identical** after every one of the 14 move commits and after the comment commit, with the same SHA-256 hashes as before the step. The build does not contain file paths, so moving a file without changing its code produces the same output, and any accidental code change would have changed the hash.

### Part 1: differences from 01D, and why

- **The three role dashboards moved whole.** 01D section 7 has `LabHeadDashboard`, `CustodianPortal`, and `AdRICDirectorDashboard` become one page per tab. Each is one component today, with the tab picked by an `activeTab` prop from `routes.tsx`. Splitting them means rewriting their state and changing the routes, which is not "files only". They now sit in their role's `web/pages/` folder as one file each. The per-tab split can go with step 9 (the routes change) or later.
- **Login and Register are pages, not `features/auth`.** 01D lists them under `web/features/auth/`. This session's instruction was to move the auth screens as pages, so they are in `web/pages/auth/`. `useSession` (also listed under `features/auth` in 01D) has lived in `web/state/session.tsx` since step 6.
- **No `features/qr`, `features/registrations`, `features/inspections`, or `features/disposals` folder yet.** The code for those lives inside the dashboards (the QR scanner in `CustodianPortal`, sign-up approval in `LabHeadDashboard`, inspections and disposals in `ITSDashboard` and the Director screen). The folders appear when that code is pulled out.
- **The analytics views kept their names**, including `TSGAnalyticsView` in `analytics/staff/`. Renaming TSG to Staff belongs with step 9.

### Comment commit `ffa05a38`

File headers and TSDoc on all 45 moved files (the four stylesheets get a header only). TODOs with finding IDs mark known defects at their lines. Three older comments were not true and are corrected: `ReturnForm` said finalizing a return closes the loan (it does not, H-04), and `LabHeadDashboard` referred to a mock context list that no longer exists and said the custody trail is scoped to CITe4D (it is scoped to the Lab Head's own branch). A history clause was trimmed from the condition colour map comment in two files. The F-28 TODO in `web/state/browserOnly.tsx` (not moved) now records the decision. The comment commit is comments only: the build output is byte-identical to before.

### Typecheck: 93, unchanged

Same 93 errors, compared by file name, position, and message after each commit. After the shell move, TypeScript prints two `server.ts` error messages with the fields of a type in a different order (`user_id` listed earlier or later), because files are now checked in a different order; same errors, same positions. After the comment commit the line numbers shift by the comment lines, and the messages are the same.

### Verified

- `npm run typecheck` and `npm run build` after every commit, with the results above.
- A Vite dev server on a spare port (5199) served `index.html` pointing at `/web/main.tsx`, and every moved module plus `ITSDashboard.tsx` was requested from it: all answered 200, which means every import resolved. The dev log showed no errors.
- The API server already running on port 4000 answered `GET /api/auth/me` with the expected "Email query param required." `server.ts` is not touched by this step.

**Not verified in the agent session:** nothing was clicked in a browser. The hand checks below cover that.

### Hand checks: part 1

**Restart the dev server first** (`npm run dev` or `npm run dev:all`). A server started before this step was watching the old paths.

1. *Every route loads.* As each role (ITS, TSG, Lab Head, Custodian, Director), open every sidebar tab once and the account page. Each screen looks and behaves as before. Also open `/login`, `/register`, and a made-up URL such as `/nope` (the not-found page).
2. *Styling.* Buttons, badges, dialogs, dropdowns, tables, and the sidebar look as before, in both themes (Settings, Interface Theme). A missing style would show as unstyled grey or black elements.
3. *Asset modal and forms.* As a Custodian, open an asset and open each request form it offers (loan, transfer, repair, return). As Staff, open an asset and the return form from Pending Returns. Each form opens; submitting one is enough.
4. *Bell.* Open the notification bell as each role.
5. *Analytics.* Open the Director analytics tab, the Lab Head health tab, and the Staff health tab. Charts load.
6. *QR scan.* As a Custodian, open QR Scan. The camera prompt or the upload button works as before.
7. *Build.* `npm run build` passes on your machine.

---

## Bug fix: issues #25 and #26 (not a restructure step)

Branch `fix/issues-25-26`, from `main` after PR #27. Both bugs were found during the step 6 hand checks and exist on `main` independently of the restructure. One commit per fix. **Merged into `main` in PR #33**, after both rounds of hand checks; the restructure branch continues from that merge (`1bc85da4`).

| Commit | Issue | What it does |
|---|---|---|
| `bc041acb` | #25 (H-05) | `POST /api/assets/:tag/borrow` and `POST /api/assets/:tag/transfer` refuse a new request with 409 when the asset already has a pending loan or transfer, or when its status does not allow it. The custodian's detail modal shows a disabled "Request Pending" tile in place of the request button |
| `95290115` | #26 | The custodian's My Assets list leaves out Disposed assets |
| D2 follow-up (after the first hand checks) | #25 | The pending tile says whose request it is: "Your request is pending" for the requester, "Requested by another user" for any other custodian, with no name (panel comment D2). Staff and Lab Heads see the requester's name. `GET /api/asset_transfers` now also sends `fromCustodianId` |

### #25: what the server now checks

Both endpoints call one helper in `server.ts`, `findCustodyRequestConflict`, after the "asset exists" check and before anything is written. It refuses the request if:

1. the asset has a pending loan (either endpoint), or
2. the asset has a pending transfer (either endpoint), or
3. the asset's latest `asset_records` status is not allowed: a **loan needs `ACTIVE`**; a **transfer accepts `ACTIVE` or `ON_LOAN`**.

A pending request of either kind blocks both kinds, because approving a loan and a transfer on the same item gives it two custodians, the same as two loans.

**Why transfers accept `ON_LOAN`, which differs from the issue text.** The issue asked for "not Active" to be refused for both. The detail modal only offers Custodianship Transfer on an asset that is *not* Active (the On Loan branch), and an approved transfer itself sets the status to `ON_LOAN`. Refusing `ON_LOAN` would have made every transfer impossible. Maintenance and Disposed are still refused, which is what H-05 asks for. If the team wants Active-only transfers, that is the `["ACTIVE", "ON_LOAN"]` argument in the transfer handler, and the modal would need to offer the button on Active assets.

Status is read with the same ordering `GET /api/assets` uses (`date_logged`, then `asset_record_id`), so the guard agrees with the badge on screen. An asset with no record yet shows as Active, so it is treated as `ACTIVE`.

### #25: what the custodian sees

`AssetDetailModal.tsx` reads `dbLoans` and `dbTransfers` from `useServerData()`. If either holds a pending row for the asset's tag, the Custodian sees a greyed tile where Request Loan (Active asset) or Custodianship Transfer (On Loan asset) would be. Request Repair and Return Asset are unchanged. The forms already show the server's `error` text, so a request that slips past a stale list (another custodian filed one after this page loaded) shows the 409 message under the form.

**Who sees what (D2 follow-up).** The first version showed every custodian the same "Request Pending" tile, which hand check 3 found confusing for a custodian who had filed nothing. The tile now depends on who filed the request:

| Viewer | Sees |
|---|---|
| The custodian who filed it | "Your request is pending" |
| Any other custodian | "Requested by another user", no name (panel comment D2) |
| Staff (ITS, TSG) and Lab Heads | A line under "Asset Actions": "Pending loan request from <name>" (or transfer). Their buttons are unchanged |

"Who filed it" is the loan's `borrower_id`, or the transfer's `from_custodian_id`, compared with the logged-in user's id. Transfers did not send that id to the browser, so `GET /api/asset_transfers` gained one field, `fromCustodianId`. Ids are compared rather than names because two people can share a name.

### #26

`CustodianPortal.tsx` `custodianAssets` now also requires `status !== "Disposed"`. A disposal writes a `DISPOSED` record that keeps the last custodian, which is why the name match alone listed them. The same list feeds the condition report's asset picker, which no longer offers disposed assets either.

### Typecheck: 93, unchanged

A line-by-line comparison shows the same 93 errors after each commit. `npm run build` passes after each commit.

### Verified

- `npx tsx server.ts` starts, and the database was reachable. The guard was exercised through `POST /transfer` with a recipient email that does not exist, so a request that passes the guard stops at the recipient lookup (404) and nothing is written. One asset per case, found with a read-only query:

  | Asset | State | Answer |
  |---|---|---|
  | `CITe4D-0008` | pending loan `LOAN-22` | 409 "already has a pending loan request (LOAN-22)" |
  | `CITe4D-0012` | pending transfer `TRF-19` | 409 "already has a pending transfer request (TRF-19)" |
  | `CITe4D-0009` | `MAINTENANCE` | 409 "is under maintenance" |
  | `CIVI-0001` | `DISPOSED` | 409 "is disposed" |
  | `CeLT-0001` | `ON_LOAN`, nothing pending | passes the guard (404 on the made-up recipient) |
  | `Bio-0001` | `ACTIVE`, nothing pending | passes the guard (404 on the made-up recipient) |

- `POST /borrow` on `CITe4D-0008` and `CITe4D-0009` (both already shown to be blocked) answered the same 409 messages.
- The read-only query also found no asset holding more than one pending request today, so no existing data is left in a state the guard would have refused.

**Not verified in the agent session:** nothing was clicked in a browser, and no request was allowed through to create a row. The hand checks below cover that.

**D2 follow-up, verified:** typecheck 93 with the same errors, build passes. A copy of the server on port 4001 (port 4000 was taken by a server started before the change) answered `GET /api/asset_transfers` with `fromCustodianId` on all 21 rows. The two pending requests at the time, `TRF-21` (`CITe4D-0013`) and `LOAN-24` (`CITe4D-0008`), both belong to user 4, A. Dela Cruz. Nothing was clicked in a browser.

### Hand checks: first round

Raiki ran the first round on 2026-10-06:

- 1, 2, 4, 5, 6, 8, 9: passed.
- 7: skipped. A Custodian cannot reach a Maintenance or Disposed asset's request buttons in the UI, and the server test above already covers the refusal.
- 3: worked as built, but a custodian who had filed nothing saw "Request Pending" with no context. That led to the D2 follow-up.

The list is kept for the record:

1. *Loan, happy path.* As a Custodian, open an Active asset with nothing pending and submit a borrow request. Expect the success screen and a new `pending` row in `asset_loans`.
2. *Loan, second request.* Close the modal and open the same asset again. Expect a greyed "Request Pending" tile instead of Request Loan.
3. *Loan, another custodian.* Log in as a different Custodian, open the same asset. Expect "Request Pending" there too.
4. *Server refusal.* Open an Active asset in two browser tabs as a Custodian. Submit a borrow request in the first. In the second (not reloaded), submit another. Expect the 409 message under the form ("... already has a pending loan request (LOAN-n)."), and no second row in `asset_loans`.
5. *Transfer.* As a Custodian holding an On Loan asset, file a transfer. Reopen the asset: "Request Pending" replaces Custodianship Transfer, while Request Repair and Return Asset are still there.
6. *Decision clears it.* As a Lab Head, approve or decline the pending loan from step 1. As the Custodian, reload and open the asset: the request button is back (Request Loan if declined; if approved the asset is On Loan and shows the On Loan buttons).
7. *Blocked statuses.* Open an asset under Maintenance and one that is Disposed. No request button is offered (unchanged), and the server would refuse one anyway.
8. *My Assets (#26).* As a Custodian who was the last custodian of a disposed asset, open My Assets in list and grid views. The disposed asset is not listed. Their other assets still are, with due dates and overdue banners as before.
9. *Condition report (#26 side effect).* On the report tab, the asset picker does not offer the disposed asset.

### Hand checks: D2 follow-up

**Restart the server first.** A server started before this change does not send `fromCustodianId`. Without it, the requester's own transfer shows "Requested by another user".

1. *Own loan.* As the Custodian who filed a pending loan (today: A. Dela Cruz, `LOAN-24` on `CITe4D-0008`), open the asset. The tile reads "Your request is pending".
2. *Own transfer.* As the Custodian who filed a pending transfer (today: A. Dela Cruz, `TRF-21` on `CITe4D-0013`), open the asset. The tile reads "Your request is pending" where Custodianship Transfer would be.
3. *Another custodian.* As a different Custodian, open both assets. Each tile reads "Requested by another user", and no name appears anywhere in the modal, including the hover text.
4. *Staff.* As ITS and as TSG, open both assets. A line under "Asset Actions" reads "Pending loan request from A. Dela Cruz" (or "transfer"). The QR tag and Send to Maintenance are unchanged.
5. *Lab Head.* As a Lab Head, open both assets. The same line shows above Custodian History.
6. *Nothing pending.* Open an asset with no pending request, in each role. No line and no tile: the normal buttons show as before.

---

## Notes: noticed, deliberately not fixed

Kept here instead of being fixed, per 01D section 11 ("scope creep into Phase 3").

| Note | Finding | Where it belongs |
|---|---|---|
| The backup still covers only 4 of 15 tables (no `asset_records`, the table that holds custody state), so it could not actually restore the system. It is a partial export, not a backup. Deciding whether to keep it at all belongs with `server/jobs/backup.ts` | F-39 in 01A | Step 10, or delete the job |
| `pending_registrations.json` is now untracked but still the live store for pending sign-ups, holding a plaintext password per record | H-17 | Phase 3 (becomes a table) |
| `prisma.ts` still carries hardcoded connection fallbacks including a password. Step 0 did not touch them, because removing them without `server/config/env.ts` would break every teammate's setup with no replacement | C-07 | Step 10 (`server/config/env.ts`) |
| `npm ci` reports 11 vulnerabilities (3 moderate, 8 high) and 2 packages have install scripts not covered by `allowScripts` (`@prisma/engines`, `prisma`) | 01C section 7, tier 3 item 22 | Separate dependency pass |
| `node_modules` was absent in this working copy, so `npm ci` and `npm run prisma:generate` were run before anything could be verified. Worth knowing for the next session | n/a | n/a |
| `LabHeadDashboard.tsx` does call `GET /api/assets` (line 165, via a template string), so 01D's list of callers is correct. Recorded because an earlier quick grep suggested otherwise | n/a | n/a |
| 114 type errors now have names and line numbers, and none are fixed. The three worth fixing first are the H-13 ones, because they write wrong data today: two in `ITSDashboard.tsx`, one in `CustodianPortal.tsx` | H-13 | Its own `fix/h13-*` branch, not the restructure |
| 37 of the 114 errors are `motion` animation props (`ease: string` where the library wants a union). Cosmetic and safe, but they are more than a third of the count, so fixing them makes the real errors easier to see | n/a | Separate chore commit |
| `TSGAnalyticsView.tsx` `CATEGORY_OPTIONS` filters by `WORKSTATION`, `ROBOTICS`, `SENSOR`, `NETWORKING`, `ACCESSORY`, none of which exist in `assets_category`. Picking one of those can only ever match nothing. Not replaced with `ASSET_CATEGORIES` in step 3, because that would change what the filter offers | n/a (new) | Step 12 (analytics) or a small fix branch |
| Database role names (`ADRIC_DIRECTOR`, `TSG_STAFF`, `LAB_HEAD`, and the rest of `roles_role_name`) are string literals inside the login, `/me`, and registration handlers in `server.ts`, alongside the mapping to app roles. That is logic, not a list, so it moves with `features/auth` | n/a | Steps 9 and 12 (auth) |
| `LAGUNA_LABS` in `server.ts` and `LAB_OPTIONS` in `TSGAnalyticsView.tsx` are two more lab lists, using short codes, which do not match the full names in `shared/constants/labs.ts`. 01D says campus should come from `research_centers.location` instead | M-03 | Phase 3, or step 12 (assets) |
| The condition text and colour maps (`CONDITION_TEXT_CLASS` and similar) are repeated in `ITSDashboard`, `LabHeadDashboard`, `CustodianPortal`, and `ReturnForm`. They are UI styling, so they belong in `web/features/assets/`, not `shared/`. **Not done in step 8 part 1**, which moved files without changing their code; merging four copies into one is a code change | n/a | Step 8 part 2, when `ITSDashboard` is split |
| `prismaClient.ts` has its own `RoleName` type, which is missing `ITS_STAFF` and `CUSTODIAN`. Left alone, since the file is deleted in step 7. **Gone with the file in step 7** (`6e08e469`) | H-01 | Done |
| `LabHeadAnalyticsView.tsx` `handleLoanDecision` is defined but nothing calls it, so it is dead code. It would also fail if wired up: it sends `"reject"`, and the server only accepts `"approve"` or `"decline"` (400). Converted to the client anyway so no loan URL is left outside `web/api/`; `decideLoan` takes a plain string for that reason | n/a (new) | Small fix branch, or step 11 (loans validation) |
| Most call sites check only `success` in the body, not the HTTP status. A minority check the status or content type, or never read the answer at all (corrected in step 5: the step 4 version of this note said no site checks the status, which was true for loans only). The client keeps both styles for now, through plain and `Raw` calls, so steps 4 and 5 stay behavior-neutral | H-16 | Step 13 (`errorHandler`), then remove the `Raw` calls from `web/api/client.ts` |
| `web/api/*.api.ts` return a loose `ApiResult` (any extra fields). The real request and response shapes belong in `shared/types/` | H-13 | Steps 11 and 12, as each backend feature is extracted |
| `docs/reference/AdRIC_DB_Schema.sql` does not match the live database. The live database has different Lab Head accounts (`labhead.bio`, `labhead.car`, and so on, with no `labhead.cite4d`) and different seed passwords, and the Director already holds `ADRIC_DIRECTOR`. Logging in with the credentials from the file fails and silently falls back to the mock login. Reported by Raiki on 2026-10-02. Not part of the restructure, not fixed. **Step 14 should baseline from the live schema, not from this file** | H-23, H-22 (H-22 is already fixed in the live data) | Step 14 |
| Five endpoints put the asset tag into the URL without encoding it (`custodian-history`, `transfer`, `return`, `repair`, `inspection`), while five others encode it (`borrow`, `disposal`, and asset create, edit, delete). Harmless with tags like `EQ-2024-001`; a tag containing `/`, `?`, or `#` would break the unencoded ones. Each API function keeps what its call site did | n/a (new) | Step 12, with each feature's extraction |
| The pending disposals list (now in `web/state/serverData.tsx`) is built from the API without `lastCustodian`, `breakdownReasons`, and `disposalPathway`, which the `PendingDisposal` type requires, so the variable stays annotated `any`. Step 6 moved the block but did not fix it: making the type truthful means changing the bell, which reads two of those fields and so shows "undefined" in every disposal card | H-13, M-13 | The bell rewrite (01D section 8) |
| `approveRegistration` returns the server's answer and accepts an object, but its declared type said it takes a string and returns nothing. **Fixed in step 6** (`8dcd6120`): the declared type now matches and the `any` is gone | H-13 | Done |
| `handleTransferDecision` in `LabHeadAnalyticsView.tsx` is dead code like `handleLoanDecision`, and also sends `"reject"` where the server only accepts `"decline"`. Disposals are the opposite: the server wants `"reject"`. Three workflows, two words for the same decision. **Still there after step 8 part 1** (deleting code is not a move); an inline comment now marks them | n/a (new) | Step 12; delete the two dead handlers in step 8 part 2 or with analytics in step 12 |
| The lab-head analytics endpoint is fetched five separate times by five widgets on the same screen, four of them with an identical query. `TODO(M-01)` on `LabHeadAnalyticsView` since step 8 part 1 | M-01 (same family) | Step 12 (analytics), or when the analytics view is split |
| **Open team decision 1: custodian return requests.** A request is saved only in the browser that made it (`ems_returns`), so Staff on another machine never see it. Worse, the Pending Returns list is the only place Staff can open the finalize form, so on another machine a return cannot be finalized in the app at all. The database cannot hold a pending return today: `asset_returns` has no status column. Kept as is in `web/state/browserOnly.tsx` (Raiki, 2026-10-03). **Direction agreed 2026-10-04:** `asset_returns` already stores finalized returns, so only the request stage is missing. Phase 3 most likely adds `status`, `requested_by`, `requested_at`, and `loan_id` columns to `asset_returns` instead of a new table; the loan link also addresses H-04 | H-02, H-04 | Phase 3 |
| **Team decision 2: Staff inspection log. Decided 2026-10-06.** The log table on the Staff inspections tab reads the browser's own copy (`ems_inspections`). The real reports are saved to `asset_reports`, and the dashboard already fetches them (`dbReports` in `ITSDashboard.tsx`) but never shows them. Kept as is until the decision (Raiki, 2026-10-03). **Decision:** point the table at the database reports (`dbReports`) instead of the browser copy, as its own labelled behavior-change commit when the inspections tab is split. The cycle type column (Annual or Trimestral) is dropped, because `asset_reports` does not store it. **It may come back:** that needs a cycle type column on `asset_reports`, and a cycle setting shared by everyone instead of the per-browser `pref_cycle_mode` cookie (F-38). Tracked in issue #34 | F-28, F-38 in 01A | Step 8 part 2; the cycle type column with issue #34 |
| **Open team decision 3: manual clearance holds.** Holds are stored only in the browser (`ems_manual_clearance_holds`) and no screen can create one: the Director dashboard imported `toggleClearanceHold` but never called it. The list is kept readable for the bell (Raiki, 2026-10-03). The action was removed in step 6 because it looked people up in the fake user table. `AdRICDirectorDashboard.tsx` still has two unused state variables left from a holds screen (`selectedHoldAffiliate`, `overrideNotes`). A real hold feature is panel comment D2. **Still open on 2026-10-06, waiting on the team.** Step 8 moves this code as is, with no behavior change, and does not wait for the decision | F-37 in 01A | Team decision, then Phase 3 |
| **Users are identified by display name in several places (issue #32).** For example the borrow form's typed name decides the loan's `borrower_id` (H-10, row below), and My Assets and the notification bell decide which assets are "mine" by comparing the asset's custodian name with the logged-in user's name (`CustodianPortal.tsx` `custodianAssets`, several checks in `NotificationCenter.tsx`). Two people can share a name. The fix is to use the user id from the session | H-10, issue #32 | Steps 11 to 13, as each backend feature is extracted and `requireAuth` gives the server the acting user |
| `web/state/serverData.tsx` is a temporary home for the lists several screens share. 01D has no such file: each page should load its own data. Unchanged by step 8 part 1, which moved the screens without changing how they load data | n/a | Shrinks as pages are split (step 8 part 2 and later), goes with the bell rewrite |
| The bell decides which transfers a Lab Head sees by the literal text "CITe4D", not by the Lab Head's own lab. Now that the bell's buttons are real, any Lab Head can approve a CITe4D transfer from the bell, and a Lab Head of another lab sees no transfers there. The Custody tab scopes by branch correctly (in the browser only, M-02). The server checks nothing either way (C-02). Since 2026-10-04 transfers are to be replaced by a custodianship queue (issue #22), so step 12 moves the transfer code without adding an approval rule | F-31 in 01A, M-02 | The bell rewrite, and the custodianship queue (issue #22) |
| A failed approve, decline, or reject from the bell is written to the browser console only. The card stays and nothing tells the user why. The loan button already behaved this way | H-16 family | Step 13, then the bell rewrite |
| Custodian condition report: if the server cannot be reached, the form saves the browser copy and still shows "Report Archived". The request's answer is never read, so a server-side refusal looks like success too | n/a (new) | Step 13 (typed errors), or with open team decision 2 |
| `updateProfile` swallows a failed save and the account page shows its success tick anyway | n/a (new) | Step 13 |
| `addRepairRequest` is unchanged, so `RepairForm` still posts each ticket twice and relies on the server's 8-second guard. 01D section 7 removes each form's second write when the forms move. **The forms moved in step 8 part 1 without this change**, because that session moved files only and removing the second post changes what reaches the server. `TODO(M-07)` marks the line | M-07 | Step 8 part 2, as its own labelled behavior-change commit (or later) |
| Two pre-existing bugs found during the step 6 hand checks: duplicate custodian requests on one asset (issue #25), and My Assets listing disposed assets because `CustodianPortal.tsx` has no status filter (issue #26). **Fixed on `fix/issues-25-26`** (`bc041acb`, `95290115`), see "Bug fix: issues #25 and #26" above | H-05 (#25), n/a (#26) | Done |
| H-05 is only partly closed by #25. `POST /disposal` still checks only that the asset exists, so an asset that is on loan or already has a pending disposal can be put up for disposal. The loan and transfer guard is also check-then-insert, so two requests in the same instant can both pass (`TODO(H-05)` in `server.ts`) | H-05 | Disposal guard: its own fix, or step 12 (disposals). The race: Phase 3 database triggers |
| Hiding the requester's name from other custodians (D2) happens only on screen. `GET /api/asset_loans` and `GET /api/asset_transfers` still send every requester's name to anyone who calls them, logged in or not. Real privacy needs the server to filter by role | C-02, D2 | Step 13 (`requireAuth`), then a role check on the two list endpoints |
| A loan's requester is the `borrower_id`, which the server resolves from the name typed in the borrow form and otherwise sets to `DEFAULT_CUSTODIAN_ID` (user 1, ITS Admin). The form fills in the custodian's own name, so this normally matches. If they type a different name, their own request shows them "Requested by another user", and Staff see that other name | H-10 | Phase 3 (borrower from the session) |
| `GET /api/asset_loans` seeds a pending loan with id 9 on the first asset whenever no pending loan exists (H-08). With the #25 guard, that seeded row now also blocks new requests on that asset until someone decides it. On the current database loan 9 already exists, so the seed's insert fails silently and nothing changes; it matters only on a fresh database | H-08 | Delete the seed block (H-08), its own fix |
| **Transfers superseded (2026-10-04).** Custodian-to-custodian transfers will become a custodianship queue: the custodian releases to Staff, Staff assign the next custodian. Design not final. Today's transfer behavior is kept, and step 12 moves the code without the Lab Head approval rule the earlier decision asked for | Question 1 | Issue #22, after the restructure with the Phase 3 tables |
| **Inspection photos (2026-10-04):** at most 3 per report, stored high resolution and deleted after 2 weeks (whether to keep one compressed copy as audit evidence is still being confirmed). Asset registry pictures are compressed and kept | M-17 | Phase 3 |
| **Repository visibility (2026-10-04):** the repo will be made private. Git history stays as is, no rewrite. The account passwords in it are test data and will be rotated later | C-01 | Issue #9, team action |
| When the server cannot be reached, the login form says "Invalid institutional email address or password.", which sends the user looking for a typo when the real problem is the network. Same message as before step 7, so it was kept | H-16 family | Step 13 (typed errors), or a small fix with `Login.tsx` in step 8 |
| Browsers that opened the app before step 7 still hold `dlsu_equipment_ms_db_v2` in localStorage, with the demo passwords inside. Nothing reads it any more and nothing writes it, but nothing clears it either. The same is true of `ems_pending_disposals` from step 6. Harmless to the app; worth a line in the team announcement ("clear site data once") | C-03 | Team announcement, no code |
| The Phase 1 and 1B documents (01A, 01B, 01C, 01E, and others) still link to `src/app/prismaClient.ts`, which no longer exists. They are dated records of the code at the time and are not edited. The file can still be read with `git show fbfcccda:src/app/prismaClient.ts` | n/a | No action |
| `strict: false` is a deliberate starting point. Turning strict on is worth doing once the count is near zero, not during the move | H-13 | After step 9 |
| **Three analytics endpoints are reached only from widgets nothing renders.** Seven exported analytics widgets are not used by any view or page: `GrantReadinessIndex`, `ComplianceWidget`, `AuditDiscrepancyWidget`, `DisposalActionList` (Director), `IdleTimeAnalyzer`, `IdleTimeDurationFrequencyWidget`, `LoanRecommenderList` (Lab Head). The last three are the only callers of `GET /api/analytics/advanced/idle-time`, `idle-frequency`, and `loan-recommender`. Those three are **not** among the 11 no-caller endpoints the 2026-10-04 decision deletes, so they stay mounted unless the team extends the decision. Each widget's TSDoc says it is not rendered | 01C section 4.4 (same family) | Team decision, then step 12 (analytics) |
| `AssetImagePlaceholder` picks its icon from display names ("Computing Array" and others) that the database categories (`DEV_KIT`, `MONITOR`, ...) never match, so every asset without a picture shows the computing icon and the label "ASSET" | n/a (new) | Small fix branch |
| The success screens of the loan, transfer, and repair forms show a reference number made up in the browser (`LOAN-123456`, `TRF-...`, `MNT-...`), not the id the database gave the request (`LOAN-22`). The return form falls back to a made-up `CLR-` number when the server call fails. A user who quotes that number to Staff gives them a number nothing records | n/a (new) | Step 13 (typed responses), or a small fix branch |
| `LocationStatusWidget` (Staff analytics) shows invented figures when its endpoint fails: fixed shares of the asset count (60% available, 30% on loan, and so on), with nothing on screen saying they are estimates. Same family as the server's invented series. `TODO(H-09)` marks it | H-09 | Step 12 (analytics) |
| The Director's audit trail and CSV export use the database reports (`asset_reports`) for an asset, and fall back to this browser's own copies (`ems_inspections`) when the asset has none. Decision 2 covers the Staff log only; this second reader of the browser copy should be settled in the same commit | F-28 | Step 8 part 2, with the inspection log switch |
| `avatar.tsx` and `checkbox.tsx` in `web/components/ui/` are imported by no file. Kept, since primitives are cheap and a later screen may use them | n/a | No action, or remove in a cleanup |
| The sidebar sets a 150 ms tooltip delay (`TooltipProvider delayDuration={150}`), but the shadcn `Tooltip` wraps itself in its own provider with delay 0, and the nearest provider wins. So the 150 ms has no effect and tooltips show at once | n/a (new) | Cosmetic, small fix |
| Left for step 8 part 2, once `ITSDashboard.tsx` leaves `src/`: remove the `@` alias (`vite.config.ts`, `tsconfig.json` `@/*`), the `src` entry in `tsconfig.json` `include`, the temporary `src/` line in `web/styles/tailwind.css`, and the `src/` line in the root `README.md`. The `figma:asset` resolver in `vite.config.ts` points at `src/assets/`, which does not exist, and nothing imports `figma:asset/...`; it can be removed or repointed then | n/a | Step 8 part 2 |

**Note 1 (step 0):** no comment commit. `server.ts` is excluded from the comment pass because it is about to be split, and `.gitignore` and `.env.example` carry their own inline explanations.

**Note 2 (step 1):** no comment commit. The step created only `tsconfig.json` and edited `package.json`, both JSON, where TSDoc and file headers do not apply. The reasoning lives in this log instead.

**Note 3 (step 2):** no comment commit, by design. Per the prompt, files quarantined into `legacy/` get only their README, not per-file headers or TSDoc. Commenting dead code would imply it is maintained.

**Note 4 (step 7):** no comment commit. The step created and moved no files: it deleted one and edited `Login.tsx`. `Login.tsx` moves to `web/` in step 8 and gets its file header and TSDoc there, per the rule "comment code at its destination, when it lands".
