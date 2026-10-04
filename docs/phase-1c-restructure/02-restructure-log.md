# 02. Restructure Log

Running record of the migration in [01D section 9](../phase-1b-deep-map/01D-restructure-plan.md#9-ordered-migration-steps).
Decision and comment standard: [01-restructure-decision.md](01-restructure-decision.md), [../guides/CODE-COMMENTS.md](../guides/CODE-COMMENTS.md).

Branch: `refactor/feature-based-structure` from step 3 on (steps 0 to 2 were on `refactor/option-a-structure`, merged in PR #4). Steps 3 to 5 were merged into `main` in PR #15 and step 6 in PR #16; the branch continues from the PR #16 merge. Nothing here is pushed by the agent; Raiki pushes and opens the pull requests.

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
| 7 | Delete `prismaClient.ts` | Done, hand checks pending | `6e08e469` (behavior change) | n/a (see note 4) | **93** (unchanged, same errors) | 2026-10-04 |
| 8 | Move the frontend to `web/` with feature folders | Not started | | | | |
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

**Not verified:** nothing was clicked in a browser, and no real account was logged in during this session.

### Hand checks owed

Each needs the server and the database.

1. *Real accounts.* Log in as Staff (ITS and TSG), Lab Head, Custodian, and Director. Each lands on its own dashboard, and a reload keeps you logged in.
2. *Old demo accounts.* Try two or three of the 11 accounts that were in the fake database (the list is in `git show fbfcccda:src/app/prismaClient.ts`, around line 200). Each is refused with "Invalid institutional email address or password." unless that same email and password also exist in the real database, in which case it logs in normally.
3. *Wrong password.* A real email with a wrong password is refused with the same message.
4. *Server stopped.* Stop the server and try to log in. The form shows the error and stays on the login page.
5. *No fake database in the browser.* In the browser's developer tools (Application, then Local Storage), delete `dlsu_equipment_ms_db_v2` if it is there from an older version, reload the login page, and log in. The key does not come back.

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
| The condition text and colour maps (`CONDITION_TEXT_CLASS` and similar) are repeated in `ITSDashboard`, `LabHeadDashboard`, `CustodianPortal`, and `ReturnForm`. They are UI styling, so they belong in `web/features/assets/`, not `shared/` | n/a | Step 8 |
| `prismaClient.ts` has its own `RoleName` type, which is missing `ITS_STAFF` and `CUSTODIAN`. Left alone, since the file is deleted in step 7. **Gone with the file in step 7** (`6e08e469`) | H-01 | Done |
| `LabHeadAnalyticsView.tsx` `handleLoanDecision` is defined but nothing calls it, so it is dead code. It would also fail if wired up: it sends `"reject"`, and the server only accepts `"approve"` or `"decline"` (400). Converted to the client anyway so no loan URL is left outside `web/api/`; `decideLoan` takes a plain string for that reason | n/a (new) | Small fix branch, or step 11 (loans validation) |
| Most call sites check only `success` in the body, not the HTTP status. A minority check the status or content type, or never read the answer at all (corrected in step 5: the step 4 version of this note said no site checks the status, which was true for loans only). The client keeps both styles for now, through plain and `Raw` calls, so steps 4 and 5 stay behavior-neutral | H-16 | Step 13 (`errorHandler`), then remove the `Raw` calls from `web/api/client.ts` |
| `web/api/*.api.ts` return a loose `ApiResult` (any extra fields). The real request and response shapes belong in `shared/types/` | H-13 | Steps 11 and 12, as each backend feature is extracted |
| `docs/reference/AdRIC_DB_Schema.sql` does not match the live database. The live database has different Lab Head accounts (`labhead.bio`, `labhead.car`, and so on, with no `labhead.cite4d`) and different seed passwords, and the Director already holds `ADRIC_DIRECTOR`. Logging in with the credentials from the file fails and silently falls back to the mock login. Reported by Raiki on 2026-10-02. Not part of the restructure, not fixed. **Step 14 should baseline from the live schema, not from this file** | H-23, H-22 (H-22 is already fixed in the live data) | Step 14 |
| Five endpoints put the asset tag into the URL without encoding it (`custodian-history`, `transfer`, `return`, `repair`, `inspection`), while five others encode it (`borrow`, `disposal`, and asset create, edit, delete). Harmless with tags like `EQ-2024-001`; a tag containing `/`, `?`, or `#` would break the unencoded ones. Each API function keeps what its call site did | n/a (new) | Step 12, with each feature's extraction |
| The pending disposals list (now in `web/state/serverData.tsx`) is built from the API without `lastCustodian`, `breakdownReasons`, and `disposalPathway`, which the `PendingDisposal` type requires, so the variable stays annotated `any`. Step 6 moved the block but did not fix it: making the type truthful means changing the bell, which reads two of those fields and so shows "undefined" in every disposal card | H-13, M-13 | The bell rewrite (01D section 8) |
| `approveRegistration` returns the server's answer and accepts an object, but its declared type said it takes a string and returns nothing. **Fixed in step 6** (`8dcd6120`): the declared type now matches and the `any` is gone | H-13 | Done |
| `handleTransferDecision` in `LabHeadAnalyticsView.tsx` is dead code like `handleLoanDecision`, and also sends `"reject"` where the server only accepts `"decline"`. Disposals are the opposite: the server wants `"reject"`. Three workflows, two words for the same decision | n/a (new) | Step 12; delete the two dead handlers in step 8 |
| The lab-head analytics endpoint is fetched five separate times by five widgets on the same screen, four of them with an identical query | M-01 (same family) | Step 8, when the analytics view is split |
| **Open team decision 1: custodian return requests.** A request is saved only in the browser that made it (`ems_returns`), so Staff on another machine never see it. Worse, the Pending Returns list is the only place Staff can open the finalize form, so on another machine a return cannot be finalized in the app at all. The database cannot hold a pending return today: `asset_returns` has no status column. Kept as is in `web/state/browserOnly.tsx` (Raiki, 2026-10-03). **Direction agreed 2026-10-04:** `asset_returns` already stores finalized returns, so only the request stage is missing. Phase 3 most likely adds `status`, `requested_by`, `requested_at`, and `loan_id` columns to `asset_returns` instead of a new table; the loan link also addresses H-04 | H-02, H-04 | Phase 3 |
| **Open team decision 2: Staff inspection log.** The log table on the Staff inspections tab reads the browser's own copy (`ems_inspections`). The real reports are saved to `asset_reports`, and the dashboard already fetches them (`dbReports` in `ITSDashboard.tsx`) but never shows them. Kept as is (Raiki, 2026-10-03). Options: point the table at the fetched database list (the cycle type column would go, the database does not store it), or drop the table when the tab is split | F-28 in 01A | Team decision, then step 8 |
| **Open team decision 3: manual clearance holds.** Holds are stored only in the browser (`ems_manual_clearance_holds`) and no screen can create one: the Director dashboard imported `toggleClearanceHold` but never called it. The list is kept readable for the bell (Raiki, 2026-10-03). The action was removed in step 6 because it looked people up in the fake user table. `AdRICDirectorDashboard.tsx` still has two unused state variables left from a holds screen (`selectedHoldAffiliate`, `overrideNotes`). A real hold feature is panel comment D2. **Still open on 2026-10-04, waiting on the team** | F-37 in 01A | Team decision, then Phase 3 |
| `web/state/serverData.tsx` is a temporary home for the lists several screens share. 01D has no such file: each page should load its own data | n/a | Shrinks in step 8, goes with the bell rewrite |
| The bell decides which transfers a Lab Head sees by the literal text "CITe4D", not by the Lab Head's own lab. Now that the bell's buttons are real, any Lab Head can approve a CITe4D transfer from the bell, and a Lab Head of another lab sees no transfers there. The Custody tab scopes by branch correctly (in the browser only, M-02). The server checks nothing either way (C-02). Since 2026-10-04 transfers are to be replaced by a custodianship queue (issue #22), so step 12 moves the transfer code without adding an approval rule | F-31 in 01A, M-02 | The bell rewrite, and the custodianship queue (issue #22) |
| A failed approve, decline, or reject from the bell is written to the browser console only. The card stays and nothing tells the user why. The loan button already behaved this way | H-16 family | Step 13, then the bell rewrite |
| Custodian condition report: if the server cannot be reached, the form saves the browser copy and still shows "Report Archived". The request's answer is never read, so a server-side refusal looks like success too | n/a (new) | Step 13 (typed errors), or with open team decision 2 |
| `updateProfile` swallows a failed save and the account page shows its success tick anyway | n/a (new) | Step 13 |
| `addRepairRequest` is unchanged, so `RepairForm` still posts each ticket twice and relies on the server's 8-second guard. 01D section 7 removes each form's second write when the forms move | M-07 | Step 8 |
| Two pre-existing bugs found during the step 6 hand checks: duplicate custodian requests on one asset (issue #25), and My Assets listing disposed assets because `CustodianPortal.tsx` has no status filter (issue #26) | H-05 (#25), n/a (#26) | Own fix branch, after step 7 |
| **Transfers superseded (2026-10-04).** Custodian-to-custodian transfers will become a custodianship queue: the custodian releases to Staff, Staff assign the next custodian. Design not final. Today's transfer behavior is kept, and step 12 moves the code without the Lab Head approval rule the earlier decision asked for | Question 1 | Issue #22, after the restructure with the Phase 3 tables |
| **Inspection photos (2026-10-04):** at most 3 per report, stored high resolution and deleted after 2 weeks (whether to keep one compressed copy as audit evidence is still being confirmed). Asset registry pictures are compressed and kept | M-17 | Phase 3 |
| **Repository visibility (2026-10-04):** the repo will be made private. Git history stays as is, no rewrite. The account passwords in it are test data and will be rotated later | C-01 | Issue #9, team action |
| When the server cannot be reached, the login form says "Invalid institutional email address or password.", which sends the user looking for a typo when the real problem is the network. Same message as before step 7, so it was kept | H-16 family | Step 13 (typed errors), or a small fix with `Login.tsx` in step 8 |
| Browsers that opened the app before step 7 still hold `dlsu_equipment_ms_db_v2` in localStorage, with the demo passwords inside. Nothing reads it any more and nothing writes it, but nothing clears it either. The same is true of `ems_pending_disposals` from step 6. Harmless to the app; worth a line in the team announcement ("clear site data once") | C-03 | Team announcement, no code |
| The Phase 1 and 1B documents (01A, 01B, 01C, 01E, and others) still link to `src/app/prismaClient.ts`, which no longer exists. They are dated records of the code at the time and are not edited. The file can still be read with `git show fbfcccda:src/app/prismaClient.ts` | n/a | No action |
| `strict: false` is a deliberate starting point. Turning strict on is worth doing once the count is near zero, not during the move | H-13 | After step 9 |

**Note 1 (step 0):** no comment commit. `server.ts` is excluded from the comment pass because it is about to be split, and `.gitignore` and `.env.example` carry their own inline explanations.

**Note 2 (step 1):** no comment commit. The step created only `tsconfig.json` and edited `package.json`, both JSON, where TSDoc and file headers do not apply. The reasoning lives in this log instead.

**Note 3 (step 2):** no comment commit, by design. Per the prompt, files quarantined into `legacy/` get only their README, not per-file headers or TSDoc. Commenting dead code would imply it is maintained.

**Note 4 (step 7):** no comment commit. The step created and moved no files: it deleted one and edited `Login.tsx`. `Login.tsx` moves to `web/` in step 8 and gets its file header and TSDoc there, per the rule "comment code at its destination, when it lands".
