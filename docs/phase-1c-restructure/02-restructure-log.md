# 02. Restructure Log

Running record of the migration in [01D section 9](../phase-1b-deep-map/01D-restructure-plan.md#9-ordered-migration-steps).
Decision and comment standard: [01-restructure-decision.md](01-restructure-decision.md), [../guides/CODE-COMMENTS.md](../guides/CODE-COMMENTS.md).

Branch: `refactor/feature-based-structure` from step 3 on (steps 0 to 2 were on `refactor/option-a-structure`, merged in PR #4). Steps 3 to 5 were merged into `main` in PR #15 and step 6 in PR #16. The fixes for issues #25 and #26 were merged in PR #33 (their own branch); step 8 continues from that merge. Step 8 part 1 was merged in PR #45, and part 2 continues from that merge (`9db4a4d7`). Step 8 part 2 was merged in PR #46, and step 9 continues from that merge (`8db5a88f`). Step 9 was merged in PR #50 and the Phase 2 API tests in PR #52; step 10 starts from that merge (`dd6db809`), on a fresh `refactor/feature-based-structure`. From step 10 on, `npm test` runs after every commit and must stay at 305 passed. Nothing here is pushed by the agent; Raiki pushes and opens the pull requests.

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
| 8 | Move the frontend to `web/` with feature folders (part 1: everything except `ITSDashboard.tsx`; part 2: split it) | Part 1 done (hand checks passed, PR #45). Part 2 done (hand checks passed, PR #46) | Part 1: `edcb9162` to `6d9facc2` (14 commits). Part 2: `5d26ed8e` to `7ca707c5` (19 commits, 5 of them labelled behavior changes, see detail) | Part 1: `ffa05a38`. Part 2: `caca57a9` | Part 1: **93**. Part 2: **71** (from 93; every removed error is accounted for, none added) | 2026-10-06, 2026-10-07 |
| 9 | Merge ITS and TSG into `/staff/*` | Done, merged in PR #50 (hand checks partly run: 4 and 6 blocked by issue #49, 5 and 7 partly checked, see detail) | `d37d2233`, `44d9d729`, `d9d95f18` (behavior changes), `af1c641c`, `5e1a0f80` (renames); `89d2212c` (step 8 follow-up move) | `223e2060`, `4101aa1b` | **71** (unchanged, same errors) | 2026-10-08 |
| 10 | Create the `server/` skeleton | Done (hand checks passed; 4 skipped, no Mailgun; 6 a team action) | `584d0c5f`, `7a40911b`, `5fd47ff0` (moves); `bd242d15` (behavior change, C-07) | `77f68fa7` | **71** (unchanged, same errors); `npm test` **305 passed** after every commit | 2026-10-09 |
| 11 | Extract one backend feature end to end (loans) | Not started | | | | |
| 12 | Extract the remaining backend features | Not started | | | | |
| 13 | Add `errorHandler` and `requireAuth` | Not started | | | | |
| 14 | Baseline the migrations | Not started | | | | |

Steps 6, 7, 9, and 13 change behavior on purpose, and so do step 8 part 2 in five labelled commits (team decisions H-18 and F-28, and M-07) and step 10 in one (C-07, the database fallbacks that 01D section 6 deletes). Every other step is a move or an addition.

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

**Changed 2026-10-08:** the 11 endpoints are no longer deleted. In step 12 their handler code moves to `legacy/analytics-endpoints/`, with the 11 analytics endpoints that never had a caller (22 in all), and their routes are no longer registered, so calling them answers not found. See the "Old analytics" row of the [PROMPT-2-restructure.md](PROMPT-2-restructure.md) decisions table and section 3 of the [Phase 2 test plan](../phase-2-tests/01-test-plan.md). The line above is kept as the record of the earlier decision.

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

Step 8 runs in two sessions (decided 2026-10-06). **Part 1 (2026-10-06):** move everything except `ITSDashboard.tsx` into `web/`. **Part 2 (2026-10-07, further down):** split `ITSDashboard.tsx` into `web/pages/staff/`, move inspection scheduling to `legacy/`, and point the inspection log at the database.

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
- **The analytics views kept their names**, including `TSGAnalyticsView` in `analytics/staff/`. Renaming TSG to Staff belongs with step 9. (Done in step 9, `af1c641c`: now `StaffAnalyticsView.tsx`.)

### Comment commit `ffa05a38`

File headers and TSDoc on all 45 moved files (the four stylesheets get a header only). TODOs with finding IDs mark known defects at their lines. Three older comments were not true and are corrected: `ReturnForm` said finalizing a return closes the loan (it does not, H-04), and `LabHeadDashboard` referred to a mock context list that no longer exists and said the custody trail is scoped to CITe4D (it is scoped to the Lab Head's own branch). A history clause was trimmed from the condition colour map comment in two files. The F-28 TODO in `web/state/browserOnly.tsx` (not moved) now records the decision. The comment commit is comments only: the build output is byte-identical to before.

### Typecheck: 93, unchanged

Same 93 errors, compared by file name, position, and message after each commit. After the shell move, TypeScript prints two `server.ts` error messages with the fields of a type in a different order (`user_id` listed earlier or later), because files are now checked in a different order; same errors, same positions. After the comment commit the line numbers shift by the comment lines, and the messages are the same.

### Verified

- `npm run typecheck` and `npm run build` after every commit, with the results above.
- A Vite dev server on a spare port (5199) served `index.html` pointing at `/web/main.tsx`, and every moved module plus `ITSDashboard.tsx` was requested from it: all answered 200, which means every import resolved. The dev log showed no errors.
- The API server already running on port 4000 answered `GET /api/auth/me` with the expected "Email query param required." `server.ts` is not touched by this step.

**Not verified in the agent session:** nothing was clicked in a browser. The hand checks below cover that.

### Hand checks: part 1, passed

Raiki ran the seven checks below and all passed (reported 2026-10-07). Step 8 part 1 was merged into `main` in PR #45. The list is kept for the record.

Two bugs were found while running them. Both exist before step 8 and are not caused by the move, so they are tracked as GitHub issues #43 and #44 and are not fixed in the restructure:

- The Classic Dark theme darkens only a few components. Many screens use hardcoded light colours (`bg-white`, `bg-emerald-50`, and similar) instead of the theme's colour variables, so they stay light.
- The notification bell offers Approve for a loan request but no Decline button. A Lab Head can decline a loan only from the Custody tab.

**Restart the dev server first** (`npm run dev` or `npm run dev:all`). A server started before this step was watching the old paths.

1. *Every route loads.* As each role (ITS, TSG, Lab Head, Custodian, Director), open every sidebar tab once and the account page. Each screen looks and behaves as before. Also open `/login`, `/register`, and a made-up URL such as `/nope` (the not-found page).
2. *Styling.* Buttons, badges, dialogs, dropdowns, tables, and the sidebar look as before, in both themes (Settings, Interface Theme). A missing style would show as unstyled grey or black elements.
3. *Asset modal and forms.* As a Custodian, open an asset and open each request form it offers (loan, transfer, repair, return). As Staff, open an asset and the return form from Pending Returns. Each form opens; submitting one is enough.
4. *Bell.* Open the notification bell as each role.
5. *Analytics.* Open the Director analytics tab, the Lab Head health tab, and the Staff health tab. Charts load.
6. *QR scan.* As a Custodian, open QR Scan. The camera prompt or the upload button works as before.
7. *Build.* `npm run build` passes on your machine.

### Part 2: commits

Part 2 started from the PR #45 merge (`9db4a4d7`). The behavior changes come first, made while the code was still in one file so each diff is small; the split that follows is moves only.

| Commit | Kind | What it does |
|---|---|---|
| `2c3532d8` | Docs | Records the part 1 hand checks, PR #45, and issues #43 and #44 |
| `5d26ed8e` | **Behavior change** (M-07) | RepairForm posts each ticket once |
| `993f48e3` | **Behavior change** (H-18) | Inspection scheduling leaves the Staff Inspections tab for `legacy/inspection-scheduling/` |
| `82bc2e8e` | **Behavior change** (F-28) | The Staff inspection log and the Director audit show the database reports |
| `c5936be0` | **Behavior change** (F-28), nothing visible | The browser copy of inspection reports (`ems_inspections`) is no longer written |
| `99eb7191` | Move | Seven unrendered analytics widgets to `legacy/analytics-widgets/` |
| `0bb2e95c` | **Behavior change**, small | Each Staff tab starts fresh instead of reusing the previous tab's component |
| `92305257` | Move | `EditAssetDialog` and the asset badge styles to `web/features/assets/` |
| `c514e30e` | Move | `DisposalFormDialog` to `web/features/disposals/` |
| `cfad18e3` | Move | `RepairProgressDialog` and `RepairAlertCard` to `web/features/repairs/` |
| `efd8fe07` | Move | The three data loaders into hooks: `useStaffAssets`, `useRepairTickets`, `useInspectionReports` |
| `c85dea7e` to `14d44320` | Move, one tab per commit | Overview, Register, Inventory, Repairs, Inspections, Returns, QR Tags, Health into `web/pages/staff/` (8 commits). The last one moves what remained of `ITSDashboard.tsx` with `git mv` and deletes `src/` |
| `7ca707c5` | Config | Removes the `@` alias, the `src` entries, and the dead `figma:asset` resolver (L-06) |
| `caca57a9` | Comments | File headers, TSDoc, TODOs |

### Part 2: what changed in behavior

1. **One repair post, not two (M-07).** RepairForm used to post the ticket and then call `addRepairRequest`, which posted it again; the server's 8-second guard dropped the second. It now posts once and reloads the shared lists with `syncFromDb()`. The two other callers of `addRepairRequest` (Send to Maintenance, the custodian condition report) always posted once and are unchanged. The server guard stays until repairs is extracted (step 12).
2. **Inspection scheduling moved to `legacy/` (H-18, question 15).** Gone from the Staff Inspections tab: Schedule Inspection Cycle / View Schedule and its dialog, Reset Inspection Queue, the Inspection Frequency Engine card, and the per-group status badge with Mark Group Completed. None of them saved anything. **What stays live:** the lab group tabs with Inspect / Log Report per asset, the finalize dialog that posts the report to the database, the inspection log, and the custodian condition report. A row now shows "Inspected" only after its own report is submitted. The cycle setting (Annual or Trimestral) is still in the sidebar Settings panel. Two descriptions that advertised scheduling (the tab subtitle and the Overview quick action) now say what the tab does. My reading of "move the scheduling tab to legacy" was "move the scheduling controls and keep the tab", because the same decision keeps single-item finalize live and that lives on this tab; if the team meant the whole tab, it is one route and one sidebar entry. **Confirmed by the team on 2026-10-08:** keeping the tab with only the scheduling moved is correct.
3. **Inspection log from the database (F-28, decision 2).** The Staff log lists the reports in `asset_reports` (from `GET /api/asset-reports`), newest first, from every machine and every reporter. The Cycle Type column is gone (issue #34). The reporter column is "Reported By", report ids are the database ids (`RPT-<n>`), the heading reads "Inspection Report Log". **The Director audit** (trail and CSV) now shows only the asset's database reports; it used to fall back to the browser's copies. Both screens now read the same table, through two endpoints (L-07, to merge in step 12).
4. **No more browser copy of reports.** With no reader left, the custodian report and the Staff finalize dialog stop writing `ems_inspections`. Every report still reaches the database exactly as before. This also removes the only use of the H-13 `first_name`/`last_name` bug ("undefined undefined" inspector), which lived only in that copy. `web/state/browserOnly.tsx` now holds two lists.
5. **Each Staff tab starts fresh.** Every Staff route rendered `<ITSDashboard>` in the same place, and React Router does not key the matched route, so switching tabs reused one component and kept its state. Now leaving a tab resets it: inventory search, filters, sort, view and sub-tab; QR selection; the register wizard's step and fields; the Health toggle; the Inspections group tab and "Inspected" badges. In exchange each tab loads its data when opened, so a report or repair filed elsewhere shows without a page reload. One page per tab (01D section 7) would do this anyway; it was made its own commit so the split itself could be pure moves.

**Network only, nothing on screen:** each page loads only the lists it shows, once. `ITSDashboard` requested the assets twice on every tab and the repairs twice on three tabs. Register and Health load no asset list; Inventory, Repairs, and Overview no longer load the reports; Inventory no longer loads the repairs.

### Part 2: where the code went

| From `ITSDashboard.tsx` | To |
|---|---|
| Overview, Register, Inventory, Repairs, Inspections, Returns, QR Tags, Health tabs | `web/pages/staff/OverviewPage.tsx`, `RegisterPage.tsx`, `InventoryPage.tsx`, `RepairsPage.tsx`, `InspectionsPage.tsx`, `ReturnsPage.tsx`, `QrTagsPage.tsx`, `HealthPage.tsx` |
| Intake wizard card, form state, serial generator, create-asset submit | `web/features/assets/IntakeWizard.tsx` |
| `EditAssetDialog`, `AssetGalleryCard`, delete confirmation, status and condition styles, funding list, asset loading | `web/features/assets/EditAssetDialog.tsx`, `AssetGalleryCard.tsx`, `DeleteAssetDialog.tsx`, `assetBadges.tsx`, `assetFields.ts`, `useStaffAssets.ts` |
| `DisposalFormDialog` | `web/features/disposals/DisposalFormDialog.tsx` |
| `RepairProgressDialog`, `RepairAlertCard`, ticket loading and actions | `web/features/repairs/RepairProgressDialog.tsx`, `RepairAlertCard.tsx`, `useRepairTickets.ts` |
| Lab group queue and finalize dialog; report log and its dialog; report loading | `web/features/inspections/InspectionQueue.tsx`, `InspectionLog.tsx`, `useInspectionReports.ts` |
| Scheduling controls, `maintenanceQueues` | `legacy/inspection-scheduling/` (with README) |

Code moved verbatim apart from indentation, with these named exceptions, each in its commit message: the delete dialog takes `onClose` and `onDeleted` props in place of the parent's setters; the finalize dialog calls an `onReportSaved` prop in place of the two reloads; three lines in the wizard that did nothing on the Register tab (`showModal`, which was never true, and the reload of a list it does not show); the inventory tab's copy of `RepairProgressDialog`, which no longer could open there; the Repairs page's reload of an asset list it does not show; and unused leftovers (`MINT`, `expandedTicketId`, unused imports). `routes.tsx` points each `/its/*` and `/tsg/*` tab at its page.

From the live analytics views, verbatim: `GrantReadinessIndex`, `ComplianceWidget`, `AuditDiscrepancyWidget`, `DisposalActionList` (Director) and `IdleTimeAnalyzer`, `IdleTimeDurationFrequencyWidget`, `LoanRecommenderList` (Lab Head) to `legacy/analytics-widgets/`, a sibling of `analytics-v1` (three names exist in both, as different code). **Team decision (2026-10-07): keep the widget code and keep `/api/analytics/advanced/idle-time`, `idle-frequency`, and `loan-recommender` for now; they are not part of the step 12 deletion.** Their three functions stay in `web/api/analytics.api.ts`. No view rendered any of the seven: the production JavaScript was byte-identical before and after that commit.

### Part 2: differences from 01D, and why

- **Pages hold presentation; only code that calls the API or is shared went to `features/`.** The QR tag sheet stays in `QrTagsPage.tsx` (01D names `features/qr/QrTagSheet`), the pending returns table stays in `ReturnsPage.tsx` (01D: `PendingReturnsTable`), and the repair table stays in `RepairsPage.tsx` (01D: `RepairBoard`). None of them calls the API, so pages still do not fetch data. They can move when a second screen needs them.
- **The finalize dialog lives in `InspectionQueue.tsx`**, not a separate `InspectionForm`. The queue's Inspect button and the dialog share six pieces of form state; separating them means rewriting that state, not moving it.
- **`useRepairTickets` still has two fallback branches** into `serverData`'s repair actions that can never run (every ticket comes from the database). Removing them is a code change; the comment says so.
- **`web/state/serverData.tsx` is unchanged.** The Staff pages load their own lists through the new hooks, but serverData still feeds the bell, the asset fallback, and `syncFromDb()`.

### Part 2: typecheck, 93 to 71

| Commit | Errors | Why |
|---|---|---|
| `993f48e3` | 93 to 92 | The schedule dialog's `g.assets` (TS2339) moved to `legacy/` |
| `82bc2e8e` | 92 to 90 | Two repeats of the Director's `asset_reports` TS2339 went with the fallback code |
| `c5936be0` | 90 to 88 | The H-13 `first_name` and `last_name` errors went with the browser copy |
| `99eb7191` | 88 to 71 | The 17 errors inside the seven widgets moved to `legacy/` (14 Director, 3 Lab Head) |

Compared error by error after every commit, by file and message. No error was added. In the moves an error follows its code to the new file (the H-13 `user_id` error is now in `InspectionQueue.tsx`), and TypeScript sometimes prints a type's members in a different order because files are checked in a different order.

### Part 2: verified

- `npm run typecheck` and `npm run build` after every commit, with the counts above.
- **Every one of the 20 commits of this session builds on its own**, checked afterwards by checking each one out in a temporary worktree and running `vite build`. This caught nothing, but it was run because one commit (`14d44320`) first went in without its edits (the staging command stopped when `src/` no longer existed); it was amended before anything else was committed.
- The config commit and the comment commit leave the production build byte-identical to the commit before each (same SHA-256 for the CSS and the JS).
- A Vite dev server on port 5199 served all 35 new and changed modules (the eight pages, the new features, routes, state, the analytics views, the Director and Custodian screens) with status 200 and no errors in its log.
- `npx tsx server.ts` starts and listens. `GET /api/asset-reports` returned 23 reports with the fields the new log reads (`reportId`, `assetId`, `assetName`, `reportedBy`, `reportDate`, `reportCondition`, `reportRemarks`, `reportImg`); every condition present has a label in the log's map. `server.ts` is not changed in this part.

**Not verified in the agent session:** nothing was clicked in a browser, and nothing was written to the database. The hand checks below cover that.

### Part 2: hand checks, passed

Raiki ran the thirteen checks below and all passed (reported 2026-10-08). Step 8 part 2 was merged into `main` in PR #46. The team's decisions on the part 2 notes are recorded in the notes table (Inspector Role, `RepairAlertCard`, the repeating intake serial) and in behavior change 2 above (the Inspections tab). The list is kept for the record.

**Restart the dev server first** (`npm run dev:all`); `vite.config.ts` and `tsconfig.json` changed. Log in as ITS and as TSG; every check applies to both unless it says otherwise.

1. *Every Staff tab loads.* Open Overview, Register, Inventory, Repairs, Inspections, Returns, QR Tags, Health. Each looks as before, except the two changes below. The Overview quick links open the right tab, inside `/its` or `/tsg`.
2. *Inspections, scheduling gone.* No Schedule Inspection Cycle, View Schedule, Reset Inspection Queue, Inspection Frequency Engine, group status badge, or Mark Group Completed. The group tabs (A to D) and their asset tables are there, each row with Inspect / Log Report. The cycle switch is still in Settings (sidebar).
3. *Inspections, finalize.* Inspect one asset and submit. The row shows "Inspected", and the report appears at the top of the log with an `RPT-<n>` id, your name under Reported By, and the condition you chose. A new row in `asset_reports`.
4. *Inspection log from the database.* The log lists reports made from other machines and by custodians, with no Cycle Type column. View Report shows the remarks and the photo if one was attached. In a fresh browser (or after clearing site data) the log is the same.
5. *Custodian report.* As a Custodian, submit a condition report. As Staff, open Inspections: it is in the log without a page reload (opening the tab is enough).
6. *Director audit.* As Director, Audit Generator: pick an asset with inspection reports. The trail and the CSV list the same reports the Staff log shows for that asset. An asset with none shows "No physical routine inspections logged."
7. *Repair once (M-07).* As a Custodian, Request Repair on an asset and submit. Exactly one new row in `asset_repairs`, and the server terminal shows one "Server received repair request" line and no "Duplicate repair request blocked" line (before this fix it showed both). Staff see it on Repairs.
8. *Inventory.* Search, filter, sort, gallery and table views, Active and Decommissioned sub-tabs. Edit an asset (save), request a disposal, delete a test asset. Each dialog works and the list refreshes.
9. *Register.* Register a test asset through all three steps. The wizard returns to step 1. (Its serial field repeats the previous serial; that was true before, see notes.)
10. *Repairs.* Acknowledge a ticket and move one through Manage Request to Fixed & Completed with a condition. The asset's status changes as before.
11. *Returns and QR.* Finalize a pending return (same browser as the request, H-02). On QR Tags select two assets and print: both tags appear on the sheet.
12. *Tabs start fresh.* Type a search on Inventory, go to Repairs, come back: the search is empty. This is expected now.
13. *Analytics.* Director analytics and Lab Head health tab look as before (the seven moved widgets were never on screen).

---

## Step 9 detail

**This step changes behavior on purpose.** It started from the PR #46 merge (`8db5a88f`). Three commits change behavior and say so in their message; the rest are moves, renames, or comments.

| Commit | Kind | What it does |
|---|---|---|
| `4511de94` | Docs | Records the step 8 part 2 hand checks, PR #46, and the team's decisions on the part 2 notes |
| `89d2212c` | Move (step 8 follow-up) | `RepairAlertCard` to `legacy/repair-alert-card/` with a README (team decision 2026-10-08). Nothing imported it: the production build is byte-identical |
| `d37d2233` | **Behavior change** | ITS and TSG become one app role, `Staff`, at `/staff/*`, with redirects from `/its/*` and `/tsg/*`. The session keeps the unit |
| `44d9d729` | **Behavior change** (M-11) | `ITS_STAFF` accounts get the Staff dashboard instead of the Custodian portal |
| `af1c641c` | Rename | `TSGAnalyticsView.tsx` to `StaffAnalyticsView.tsx` (file and component) |
| `5e1a0f80` | Rename | `TSGTechnicalMaintenanceSection` to `StaffTechnicalMaintenanceSection` |
| `d9d95f18` | **Behavior change**, text only | Wording that named ITS or TSG as the staff now says Staff |
| `223e2060` | Comments | Headers, TSDoc, TODOs |
| `4101aa1b` | Comments | Corrects two of those comments: the server does not store a ticket's forwarding unit, only its text does |

### What changed in behavior

1. **One Staff role and one route tree.** The app role type is `"Staff" | "LabHead" | "Custodian" | "AdRICDirector"`. The server's login and `/me` answer `role: "Staff"` for every account they used to call ITS (`ADMIN`, `ADRIC_SECRETARY`) or TSG (`TSG_STAFF`). `/staff/*` replaces both trees, with the same eight tabs and the account page. Staff land on `/staff/overview` after login, as both did before; the fallback page (opening `/` or another role's URL) was `/tsg/repairs` for TSG and is now `/staff/overview` for both. The database is unchanged: both roles stay.
2. **Old URLs redirect.** `/its/<tab>` and `/tsg/<tab>` go to `/staff/<tab>`, keeping the query string and hash, case-insensitively. `/its` alone goes to `/staff`, which opens Overview. Look-alike paths (`/itsy/...`) are not caught and show the not-found page, as before. The redirect runs before the signed-in frame, so a Staff user lands on the tab they asked for, a different role is then sent to their own dashboard, and a visitor who is not logged in goes to the login page.
3. **The session keeps the unit.** The login and `/me` answers carry `user.staffUnit`: `"ITS"` for `ADMIN`, `ADRIC_SECRETARY`, and (since `44d9d729`) `ITS_STAFF`; `"TSG"` for `TSG_STAFF`; `null` for everyone else. The session stores it on `currentUser.staffUnit`, and the shared type `StaffUnit` names it. Issue #41 will use it for different edit and delete rights; **#41 is not implemented**. Today the unit is used in two places. Send to Maintenance (in the asset modal) fills in the account's own unit, exactly as before: in the ticket text ("... servicing by ITS."), which is saved as `asset_repairs.issue_description`, and in the ticket's `forwardedTo` field, which the server does not store (a pre-existing gap: "Dispatched To" on the Repairs page always shows a dash). And the sidebar's session card reads "Staff (ITS)" or "Staff (TSG)", so anyone can see which unit the session holds.
4. **Same screens and buttons for ITS and TSG.** Every `role === "ITS" || role === "TSG"` check became `role === "Staff"` (the bell, the asset modal, the account page). **One difference was dropped:** the bell's degraded-asset reminder used to be marked "action needed" only for TSG; it now is for every Staff account. Keeping it TSG-only would have been the one place the dashboards differed. It is one condition in `NotificationCenter.tsx` if the team wants it back through `staffUnit`.
5. **Labels.** The sidebar, the mobile header badge, and the account page show "Staff" where they showed "ITS Admin", "TSG Staff", "ITS", or "TSG".
6. **M-11, `ITS_STAFF` (`44d9d729`).** An `ITS_STAFF` account fell through every branch of the mapping and got the Custodian portal. It now gets Staff with unit ITS. The new branch sits after `ADRIC_DIRECTOR` and before `TSG_STAFF`, so an account holding both staff roles is ITS. Both copies of the mapping (login and `/me`) changed the same way. The rest of M-11 is not part of this step (see notes).
7. **Wording (`d9d95f18`).** Text that named ITS or TSG as the people using the Staff screens now says Staff, for example "SCHEDULED BY TSG" is "SCHEDULED BY STAFF", "TSG ALERT DISPATCHED" is "STAFF ALERT DISPATCHED", "hand over the physical device to TSG" is "to Staff", "couldn't reach the ITS database" is "couldn't reach the database", the remarks labels say "Staff Comments & Remarks", and the Health heading says "Staff Maintenance & Workflows Dashboard". Fallback names shown when a record has no person ("TSG Technical Staff", "ITS/TSG staff", "ITS Staff") are "Staff", on screen and in the four `server.ts` answers and the disposal email that send them.

**Kept on purpose, because they name a department as data or a choice, not the app role:** the repair forwarding choice (TSG, ITS, Both) and its badges, "ITS Central Override" in the repair pipeline, the ITS and TSG property tags on the Director screens, the Inspector Role options (issue #48), the separate TSG and ITS remarks fields of the finalize dialog, stored values (`"Pending TSG Review"`, `"Manila — TSG Office"`), place names used as fallbacks ("ITS Warehouse", "ITS Main Warehouse"), and the `/api/analytics/tsg` URL with its `getTsgAnalyticsRaw` function. Comments in `server.ts` are not edited (it is about to be split).

### Renames

Only one file name no longer matched its folder or role: `web/features/analytics/staff/TSGAnalyticsView.tsx`, now `StaffAnalyticsView.tsx` (git records it as a rename). Its second TSG-named export got its own commit. Every other file in `web/` already matches: the three role dashboards are named after their role, and the Staff pages and features carry no unit name. The `tsg-...` React Query cache keys inside the view were left alone: they are internal strings, not names anyone imports.

### Differences from 01D

- 01D step 9 names `routes.tsx` and `Sidebar.tsx`. The role check sat in eight more files (the session maps, the layout, the bell, the asset modal, the account page, the Overview page, the shared role type, and the server mapping), so they changed too.
- 01D says ITS and TSG get "the same permissions". They do today; the only difference left is the unit written into a Send to Maintenance ticket (item 3). Issue #41 changes this later on purpose.
- 01D section 7 splits the other role dashboards into one page per tab "with step 9 (the routes change) or later". Not done here: step 9 only merged the Staff trees. The Lab Head, Custodian, and Director screens still pick their tab with `activeTab`.

### Typecheck: 71, unchanged

Compared error by error after every commit, by file and message. No error was added or removed. Two messages changed text with the code: the four `motion` errors in the analytics view now name `StaffAnalyticsView.tsx`, and the existing TS2367 in `AssetDetailModal.tsx` now names `"Staff"` where it named `"ITS" | "TSG"`.

### Verified

- `npm run typecheck` (71) and `npm run build` after every commit.
- **Every commit of this session builds on its own**, each checked out in a temporary worktree and built with Vite. The production JavaScript is byte-identical where no browser code changed: `89d2212c` against its parent, `44d9d729` (server only) and both renames against the commit before, and the two comment commits against the wording commit.
- React Router's own matcher (`matchRoutes`, version 7.18.1) was run on the new route table: `/its`, `/its/`, `/tsg/repairs`, `/ITS/overview`, and `/its/repairs?x=1` reach the redirect and become the matching `/staff` path; `/itsy/overview` and `/tsgfoo` reach not found; `/staff` and `/staff/overview` reach the Staff tree.
- `npx tsx server.ts` starts and listens. **Read-only** check against the database: for every account holding `ADMIN`, `ADRIC_SECRETARY`, `ITS_STAFF`, or `TSG_STAFF`, `GET /api/auth/me` was called and only the role names and the answer were printed. Result: 1 `ADMIN` account answers `role=Staff staffUnit=ITS`, 1 `TSG_STAFF` account answers `role=Staff staffUnit=TSG`. `GET /api/asset-reports` answers 25 reports.
- A Vite dev server on port 5199 served all 37 changed modules with status 200 and no errors in its log.

**Not verified in the agent session:** nothing was clicked in a browser, and no login was made (that needs a password). **The database has no `ITS_STAFF` account and no `ADRIC_SECRETARY` account**, so the M-11 branch was checked by reading and by the typecheck only; testing it needs an account with that role, which is a database write and the team's call (hand check 8).

### Hand checks: partly run

Step 9 was merged into `main` in PR #50. Raiki reported the results on 2026-10-09, in this list's numbering:

- **Passed:** 1, 2, 3, 9, 10, 11, and 12 (build).
- **4, blocked** by issue #49 (a typed URL logs you out; pre-existing, not caused by step 9). The `/its` and `/tsg` redirects were **not checked by hand**. The evidence for them is the agent's check with React Router's own matcher (`matchRoutes`), under "Verified" above.
- **5, partly checked:** logged out, `/tsg/repairs` ends on the login page (passed). As a Custodian, `/its/repairs` was blocked by #49.
- **6, failed** because of #49 (a reload logs you out). Pre-existing, not caused by step 9.
- **7, not confirmed:** `progress_status` showed "Pending TSG Review" (expected), but `issue_description` ("... servicing by ITS." or "by TSG.") was not checked.
- **8:** dropped earlier (team decision 7 below).

**Restart both servers first** (`npm run dev:all`). A server started before this step still answers `ITS` or `TSG` as the role, and the new web app does not know those names: the sidebar would be empty.

1. *ITS login.* Log in with the `ADMIN` account (ITS). You land on `/staff/overview`. The sidebar card under your name reads "Staff (ITS)", and the mobile header badge (narrow window) reads "Staff". The sidebar lists the same eight tabs as before.
2. *TSG login.* Log in with the `TSG_STAFF` account. Same landing page, same eight tabs, and the card reads "Staff (TSG)". The two dashboards are identical.
3. *Every Staff tab.* As either account, open all eight tabs and the account page (click your name in the sidebar). The URL is `/staff/<tab>` each time, and each screen loads as before. The account page's role field reads "Staff" and shows no lab affiliation field (as for ITS and TSG before).
4. *Old URLs.* While logged in as Staff, type `/its/repairs` into the address bar: you land on `/staff/repairs`. Try `/tsg/inventory` (lands on `/staff/inventory`) and `/its` (lands on `/staff/overview`).
5. *Old URLs, other roles.* Logged in as a Custodian, open `/its/repairs`: you end on your own My Assets page. Logged out, open `/tsg/repairs`: you end on the login page.
6. *Reload.* As Staff, reload on any tab: you stay logged in, on that tab, with the same label.
7. *Send to Maintenance keeps the unit.* As the ITS account, open an Active asset and press Send to Maintenance. In `asset_repairs`, the new row's `issue_description` ends "servicing by ITS." Repeat as TSG on another asset: "by TSG." (Same as before the step. "Dispatched To" on Repairs shows a dash, also as before.)
8. *M-11: dropped (team decision 7 below).* No account is created; a Phase 2 test on the local test database covers it instead.
9. *Bell.* As Staff, open the bell. Repair tickets, returns, and reminders show as before, with Acknowledge on repair cards. A degraded-asset reminder now says action is needed for both ITS and TSG (it was TSG only).
10. *Wording.* As a Custodian, open Send Inspection Report: the banner reads "SCHEDULED BY STAFF" and the page says "for Staff inspection compliance"; picking Critical shows "Staff alert on submit". On Staff Inventory, open Edit on an asset: "Staff Comments & Remarks". On Health, the heading reads "Staff Maintenance & Workflows Dashboard".
11. *Lab Head and Director unchanged.* Log in as each, open every tab once. Nothing changed for them except "Staff" wording (Director: "decommissioning by Staff" on Approvals & Holds).
12. *Build.* `npm run build` passes on your machine.

### Team decisions on step 9 (2026-10-08)

Recorded in the PROMPT-2 decisions table too. No code changed for them in step 9.

1. **ITS is removed from the system.** Staff will be TSG only, and repair forwarding goes to TSG only. The one ITS account (the `ADMIN` account) stays for now. The goal is no difference between ITS and TSG anywhere in the app. The differences step 9 left in place (the "Staff (ITS)" sidebar label, "by ITS." in Send to Maintenance tickets, the forward-to options TSG, ITS, Both) are removed later on their own branch, not in the restructure. So `staffUnit` is expected to go away with that branch.
2. **Admin app role, planned.** A separate `Admin` app role for the developers (`ADMIN` database role), with access to every section. Built after step 13, when `requireAuth` and `requireRole` exist. Until then `ADMIN` accounts keep the Staff dashboard as built.
3. **Issue #41 is open.** With ITS removed, the team still has to decide who gets the "edit or delete assets with no history" right: TSG or Admin. Related to issue #19.
4. **Accepted:** the bell's degraded-asset reminder marks every Staff account "action needed" (behavior change 4 above), because of decision 1.
5. **Accepted:** every Staff account lands on Overview, including the fallback that used to be `/tsg/repairs` for TSG.
6. **`ADRIC_SECRETARY` gets the Director view.** A change from today, where it maps to Staff with unit ITS. Not changed in step 9; it goes with the ITS removal branch. No account holds this role right now. **Still open:** whether the Secretary can approve and sign off like the Director, or only view.
7. **M-11 stays verified by code reading only.** Nothing is written to the shared database to test it. Hand check 8 is dropped; a test for the `ITS_STAFF` mapping is added in Phase 2, on the local test database (`AdRIC_DB_test`).

---

## Step 10 detail

Started from the PR #52 merge (`dd6db809`), after the Phase 2 API tests. `server.ts`, `prisma.ts`, and `mailer.ts` are gone from the root; the backend now lives in `server/`. Four commits move code, one changes behavior, one adds comments.

| Commit | Kind | What it does |
|---|---|---|
| `584d0c5f` | Move | `prisma.ts` to `server/config/prisma.ts`, `mailer.ts` to `server/shared/services/mailer.ts`, both unchanged (git: 100% renames) |
| `7a40911b` | Move | `server.ts` split into `server/main.ts`, `server/app.ts`, `server/jobs/backup.ts`, and `server/remainingRoutes.ts` (the rest, `git mv`). Scripts and the test harness point at `server/main.ts` |
| `5fd47ff0` | Move | `server/config/env.ts` reads `PORT`, the three `MAILGUN_*` variables, and `BACKUP_DIR` with the same defaults as before |
| `bd242d15` | **Behavior change** (C-07) | The five `DATABASE_*` variables are required; the hardcoded CCS Cloud fallbacks are deleted |
| `77f68fa7` | Comments | File headers, TSDoc, TODOs; stale mentions of `server.ts` in comments and READMEs; this log |

### The new `server/` tree

| File | Holds | From |
|---|---|---|
| `server/main.ts` | Starts the 6-hour backup timer, `app.listen`, the startup banner, the default custodian check, the first backup | the end of `server.ts` |
| `server/app.ts` | The Express app: `cors()`, the two body parsers (50 MB), then the routes | the top of `server.ts` |
| `server/remainingRoutes.ts` | All 62 routes and their helpers, unchanged, registered on an exported `express.Router()` | the rest of `server.ts` |
| `server/config/env.ts` | Loads `.env` and checks every variable the server reads | new |
| `server/config/prisma.ts` | The Prisma client | root `prisma.ts` |
| `server/shared/services/mailer.ts` | `sendEmail`, `emailTemplate` | root `mailer.ts` |
| `server/jobs/backup.ts` | `performDatabaseBackup` | `server.ts` |

**How the routes stayed unchanged.** Every route line now reads `router.get(...)` (or `post`, `put`, `delete`) where it read `app.get(...)`; nothing else in a handler changed. A router (Express's object for a group of routes) matches paths exactly as the app does, with the same defaults, and `app.ts` mounts it after the same three middleware lines in the same order, so every request meets the same code. `git show 7a40911b -M --word-diff` shows the edits to the moved file: the imports, the removed setup and startup code, and `app` becoming `router` on 62 lines.

**Startup order is the same:** the backup timer is set, the server listens, prints the same banner, runs the default custodian check, then the first backup. Module loading also runs in the same order (dotenv, then the mailer, then Prisma).

### What changed in behavior: database variables are required (C-07)

Before, `prisma.ts` replaced any missing or empty `DATABASE_*` variable with a hardcoded value: the CCS Cloud host, port, account, password, and database name. A machine with an incomplete `.env` therefore connected to the shared database, using credentials written in the code, without saying so.

Now `server/config/env.ts` requires all five. If one is missing or empty, the server stops before it connects or listens, with:

```
Error: Missing required environment variable(s): DATABASE_PORT, DATABASE_USER, ... Copy .env.example to .env and fill them in.
```

A `DATABASE_PORT` that is not a whole number stops it too. **With a complete `.env` nothing changes.** The credentials are no longer in the code, but they stay in git history (team decision: no rewrite, C-01). `.env.example` now says the five are required. `prisma.config.ts` (Prisma CLI only, reads `DATABASE_URL`) is not touched.

This is the "Fallbacks deleted" item of 01D section 6 for `prisma.ts`, and the note that put C-07 in step 10.

### Differences from 01D

- **`server/remainingRoutes.ts` is not in 01D.** 01D step 10 says "mount the existing `server.ts` routes unchanged". Keeping a root file named `server.ts` that no longer starts a server would mislead anyone who runs `npx tsx server.ts` (it would load and exit silently), so the routes moved into `server/` under a name that says what they are. Steps 11 and 12 move them out one feature at a time; the file is deleted when it is empty.
- **The mailer and the backup job moved now**, though 01D step 10 names only `main.ts`, `app.ts`, and `config/`. Both were part of the old startup path (the backup runs from the listener), and `remainingRoutes.ts` would otherwise import from the repository root. Both moved unchanged apart from reading their settings from `env.ts`.
- **`app.ts` keeps CORS open and the 50 MB limit.** 01D section 6 lists an origin allowlist, a lower body limit, and `errorHandler` for `app.ts`. Those change behavior and belong to 01C tier 2 and step 13; `TODO(C-02)` and `TODO(M-17)` mark the lines.
- **The default custodian check stays**, in `remainingRoutes.ts` (exported for `main.ts`), because `DEFAULT_CUSTODIAN_ID` is still used by the routes. 01D deletes it with `DEFAULT_CUSTODIAN_ID`.
- **The backup job was moved, not deleted.** Whether to keep it is still open (F-39, notes).

### Typecheck: 71, unchanged

Compared after every commit, by file and message. The eight `server.ts` errors are the same eight in `server/remainingRoutes.ts`, at new line numbers (the removed setup lines and, after the comment commit, the file header). TypeScript again prints some type members in a different order. No error added or removed.

### Verified

- After **every** commit: `npm run typecheck` (71), `npm run build` (passes; the production CSS and JS were compared with `main` after `584d0c5f`, `7a40911b`, and the comment changes, and were byte-identical each time; `5fd47ff0` and `bd242d15` touch no browser code), and `npm test`: **12 files, 305 tests passed**, every time. The tests start `server/main.ts` from commit `7a40911b` on, so the whole Phase 2 suite ran against the new startup path.
- `npm run server` on a spare port (4123) with the real `.env`: the same banner, "Default custodian check passed", "Backup skipped: BACKUP_DIR is not set", `GET /api/assets` answered 200 with the asset list, `GET /api/auth/me` answered its usual 400, and an unknown path answered 404. Only GET requests were sent. Checked after `7a40911b` and again after `bd242d15`, so the real `.env` has all five database variables.
- The fail-fast check, run from an empty folder so no `.env` was loaded: with only `DATABASE_HOST` set, the server stopped with exit code 1 and named the other four; with `DATABASE_PORT=abc`, it stopped with the port message. Neither run connected to anything.
- The comment commit changes comments only: every changed line is a comment, apart from a final newline added to `prisma.ts`.

**Not verified in the agent session:** nothing was clicked in a browser, and no email was sent (the tests run with mail off, and the `.env` check above did not trigger one).

### Hand checks: passed, one skipped

Raiki ran them on 2026-10-09:

- **Passed:** 1, 2, 3, 5, and 7 (`npm test`: 305 passed on Raiki's machine).
- **4, skipped:** Mailgun is not set up yet, so no email path was exercised by hand (the tests run with mail off too).
- **6, a team action:** announced in the PR description; each teammate checks their own `.env` after pulling.

During check 2 a pre-existing bug was found: bell cards open a not-found page for most roles (issue #55, see notes). It is in the original code, not caused by step 10. The list is kept for the record.

**Stop any running server and restart** (`npm run dev:all`). A server started before this step is still the old `server.ts` process.

1. *Start.* `npm run server` prints the same banner as before ("Mini-Backend API is actively listening!", "Route Ready: http://localhost:4000/api/assets") and the default custodian line.
2. *Every role.* Log in as Staff, Lab Head, Custodian, and Director, and open each sidebar tab once. Everything loads as before.
3. *One write per workflow you can spare.* For example, as a Custodian, submit a borrow request; as a Lab Head, decline it. Both work as before. (`npm test` already covers every endpoint on the test database.)
4. *Email, only if your `.env` has Mailgun set.* Do one action that sends mail (a disposal request, for example). The server terminal shows "Sent ..." as before.
5. *Watch mode.* `npm run server:watch`, then save any file in `server/`: the server restarts.
6. *Each teammate's `.env`.* After pulling, each teammate runs `npm run server` once. If it stops with "Missing required environment variable(s)", they add the named variables to their `.env`. This is the intended effect of the change.
7. *Tests.* `npm test` passes on your machine: 305 tests.

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
| The backup still covers only 4 of 15 tables (no `asset_records`, the table that holds custody state), so it could not actually restore the system. It is a partial export, not a backup. Deciding whether to keep it at all belongs with `server/jobs/backup.ts`. **Step 10 moved it there unchanged** (`7a40911b`); `TODO(F-39)` marks it. Keep, extend, or delete is still a team decision. **Decided 2026-10-09: delete it**, because it copies 4 of 15 tables and cannot restore anything. In its own labelled behavior-change commit, in step 12 or later, not in step 10 | F-39 in 01A | Step 12 or later (delete, own commit) |
| `pending_registrations.json` is now untracked but still the live store for pending sign-ups, holding a plaintext password per record | H-17 | Phase 3 (becomes a table) |
| `prisma.ts` still carries hardcoded connection fallbacks including a password. Step 0 did not touch them, because removing them without `server/config/env.ts` would break every teammate's setup with no replacement. **Done in step 10** (`bd242d15`): `env.ts` requires the five variables and the fallbacks are gone. The values stay in git history (no rewrite, C-01), so rotating that password is still the team action from step 0 | C-07 | Done (password rotation: team action) |
| `npm ci` reports 11 vulnerabilities (3 moderate, 8 high) and 2 packages have install scripts not covered by `allowScripts` (`@prisma/engines`, `prisma`) | 01C section 7, tier 3 item 22 | Separate dependency pass |
| `node_modules` was absent in this working copy, so `npm ci` and `npm run prisma:generate` were run before anything could be verified. Worth knowing for the next session | n/a | n/a |
| `LabHeadDashboard.tsx` does call `GET /api/assets` (line 165, via a template string), so 01D's list of callers is correct. Recorded because an earlier quick grep suggested otherwise | n/a | n/a |
| 114 type errors now have names and line numbers, and none are fixed. The three worth fixing first are the H-13 ones, because they write wrong data today: two in `ITSDashboard.tsx`, one in `CustodianPortal.tsx` | H-13 | Its own `fix/h13-*` branch, not the restructure |
| 37 of the 114 errors are `motion` animation props (`ease: string` where the library wants a union). Cosmetic and safe, but they are more than a third of the count, so fixing them makes the real errors easier to see | n/a | Separate chore commit |
| `TSGAnalyticsView.tsx` `CATEGORY_OPTIONS` filters by `WORKSTATION`, `ROBOTICS`, `SENSOR`, `NETWORKING`, `ACCESSORY`, none of which exist in `assets_category`. Picking one of those can only ever match nothing. Not replaced with `ASSET_CATEGORIES` in step 3, because that would change what the filter offers | n/a (new) | Step 12 (analytics) or a small fix branch |
| Database role names (`ADRIC_DIRECTOR`, `TSG_STAFF`, `LAB_HEAD`, and the rest of `roles_role_name`) are string literals inside the login, `/me`, and registration handlers in `server.ts`, alongside the mapping to app roles. That is logic, not a list, so it moves with `features/auth`. Step 9 changed the app-role side (ITS and TSG are now `Staff` plus a `staffUnit`) and added `ITS_STAFF`; the mapping itself is still inline in both handlers | n/a | Step 12 (auth) |
| `LAGUNA_LABS` in `server.ts` and `LAB_OPTIONS` in `TSGAnalyticsView.tsx` are two more lab lists, using short codes, which do not match the full names in `shared/constants/labs.ts`. 01D says campus should come from `research_centers.location` instead | M-03 | Phase 3, or step 12 (assets) |
| The condition text and colour maps (`CONDITION_TEXT_CLASS` and similar) are repeated in `ITSDashboard`, `LabHeadDashboard`, `CustodianPortal`, and `ReturnForm`. They are UI styling, so they belong in `web/features/assets/`, not `shared/`. **Not done in step 8 part 1**, which moved files without changing their code. **Step 8 part 2** moved the `ITSDashboard` copy to `web/features/assets/assetBadges.tsx`; the other three copies remain, since merging them changes three more files | n/a | A later cleanup, or with each dashboard's split |
| `prismaClient.ts` has its own `RoleName` type, which is missing `ITS_STAFF` and `CUSTODIAN`. Left alone, since the file is deleted in step 7. **Gone with the file in step 7** (`6e08e469`) | H-01 | Done |
| `LabHeadAnalyticsView.tsx` `handleLoanDecision` is defined but nothing calls it, so it is dead code. It would also fail if wired up: it sends `"reject"`, and the server only accepts `"approve"` or `"decline"` (400). Converted to the client anyway so no loan URL is left outside `web/api/`; `decideLoan` takes a plain string for that reason | n/a (new) | Small fix branch, or step 11 (loans validation) |
| Most call sites check only `success` in the body, not the HTTP status. A minority check the status or content type, or never read the answer at all (corrected in step 5: the step 4 version of this note said no site checks the status, which was true for loans only). The client keeps both styles for now, through plain and `Raw` calls, so steps 4 and 5 stay behavior-neutral | H-16 | Step 13 (`errorHandler`), then remove the `Raw` calls from `web/api/client.ts` |
| `web/api/*.api.ts` return a loose `ApiResult` (any extra fields). The real request and response shapes belong in `shared/types/` | H-13 | Steps 11 and 12, as each backend feature is extracted |
| `docs/reference/AdRIC_DB_Schema.sql` does not match the live database. The live database has different Lab Head accounts (`labhead.bio`, `labhead.car`, and so on, with no `labhead.cite4d`) and different seed passwords, and the Director already holds `ADRIC_DIRECTOR`. Logging in with the credentials from the file fails and silently falls back to the mock login. Reported by Raiki on 2026-10-02. Not part of the restructure, not fixed. **Step 14 should baseline from the live schema, not from this file** | H-23, H-22 (H-22 is already fixed in the live data) | Step 14 |
| Five endpoints put the asset tag into the URL without encoding it (`custodian-history`, `transfer`, `return`, `repair`, `inspection`), while five others encode it (`borrow`, `disposal`, and asset create, edit, delete). Harmless with tags like `EQ-2024-001`; a tag containing `/`, `?`, or `#` would break the unencoded ones. Each API function keeps what its call site did | n/a (new) | Step 12, with each feature's extraction |
| The pending disposals list (now in `web/state/serverData.tsx`) is built from the API without `lastCustodian`, `breakdownReasons`, and `disposalPathway`, which the `PendingDisposal` type requires, so the variable stays annotated `any`. Step 6 moved the block but did not fix it: making the type truthful means changing the bell, which reads two of those fields and so shows "undefined" in every disposal card | H-13, M-13 | The bell rewrite (01D section 8) |
| `approveRegistration` returns the server's answer and accepts an object, but its declared type said it takes a string and returns nothing. **Fixed in step 6** (`8dcd6120`): the declared type now matches and the `any` is gone | H-13 | Done |
| `handleTransferDecision` in `LabHeadAnalyticsView.tsx` is dead code like `handleLoanDecision`, and also sends `"reject"` where the server only accepts `"decline"`. Disposals are the opposite: the server wants `"reject"`. Three workflows, two words for the same decision. **Still there after step 8 part 1** (deleting code is not a move); an inline comment now marks them | n/a (new) | Step 12 (analytics), with the two dead handlers. Not done in step 8 part 2, which did not cover them |
| The lab-head analytics endpoint is fetched five separate times by five widgets on the same screen, four of them with an identical query. `TODO(M-01)` on `LabHeadAnalyticsView` since step 8 part 1 | M-01 (same family) | Step 12 (analytics), or when the analytics view is split |
| **Open team decision 1: custodian return requests.** A request is saved only in the browser that made it (`ems_returns`), so Staff on another machine never see it. Worse, the Pending Returns list is the only place Staff can open the finalize form, so on another machine a return cannot be finalized in the app at all. The database cannot hold a pending return today: `asset_returns` has no status column. Kept as is in `web/state/browserOnly.tsx` (Raiki, 2026-10-03). **Direction agreed 2026-10-04:** `asset_returns` already stores finalized returns, so only the request stage is missing. Phase 3 most likely adds `status`, `requested_by`, `requested_at`, and `loan_id` columns to `asset_returns` instead of a new table; the loan link also addresses H-04 | H-02, H-04 | Phase 3 |
| **Team decision 2: Staff inspection log. Decided 2026-10-06.** The log table on the Staff inspections tab reads the browser's own copy (`ems_inspections`). The real reports are saved to `asset_reports`, and the dashboard already fetches them (`dbReports` in `ITSDashboard.tsx`) but never shows them. Kept as is until the decision (Raiki, 2026-10-03). **Decision:** point the table at the database reports (`dbReports`) instead of the browser copy, as its own labelled behavior-change commit when the inspections tab is split. The cycle type column (Annual or Trimestral) is dropped, because `asset_reports` does not store it. **It may come back:** that needs a cycle type column on `asset_reports`, and a cycle setting shared by everyone instead of the per-browser `pref_cycle_mode` cookie (F-38). Tracked in issue #34. **Done in step 8 part 2** (`82bc2e8e`, and `c5936be0` stops writing the unread browser copy) | F-28, F-38 in 01A | Done; the cycle type column with issue #34 |
| **Open team decision 3: manual clearance holds.** Holds are stored only in the browser (`ems_manual_clearance_holds`) and no screen can create one: the Director dashboard imported `toggleClearanceHold` but never called it. The list is kept readable for the bell (Raiki, 2026-10-03). The action was removed in step 6 because it looked people up in the fake user table. `AdRICDirectorDashboard.tsx` still has two unused state variables left from a holds screen (`selectedHoldAffiliate`, `overrideNotes`). A real hold feature is panel comment D2. **Still open on 2026-10-06, waiting on the team.** Step 8 moves this code as is, with no behavior change, and does not wait for the decision | F-37 in 01A | Team decision, then Phase 3 |
| **Users are identified by display name in several places (issue #32).** For example the borrow form's typed name decides the loan's `borrower_id` (H-10, row below), and My Assets and the notification bell decide which assets are "mine" by comparing the asset's custodian name with the logged-in user's name (`CustodianPortal.tsx` `custodianAssets`, several checks in `NotificationCenter.tsx`). Two people can share a name. The fix is to use the user id from the session | H-10, issue #32 | Steps 11 to 13, as each backend feature is extracted and `requireAuth` gives the server the acting user |
| `web/state/serverData.tsx` is a temporary home for the lists several screens share. 01D has no such file: each page should load its own data. Unchanged by step 8 part 1 and part 2. Since part 2 the Staff pages load their own lists through feature hooks, but serverData still feeds the bell, the asset fallback, and `syncFromDb()` | n/a | Shrinks as pages are split (step 8 part 2 and later), goes with the bell rewrite |
| The bell decides which transfers a Lab Head sees by the literal text "CITe4D", not by the Lab Head's own lab. Now that the bell's buttons are real, any Lab Head can approve a CITe4D transfer from the bell, and a Lab Head of another lab sees no transfers there. The Custody tab scopes by branch correctly (in the browser only, M-02). The server checks nothing either way (C-02). Since 2026-10-04 transfers are to be replaced by a custodianship queue (issue #22), so step 12 moves the transfer code without adding an approval rule | F-31 in 01A, M-02 | The bell rewrite, and the custodianship queue (issue #22) |
| A failed approve, decline, or reject from the bell is written to the browser console only. The card stays and nothing tells the user why. The loan button already behaved this way | H-16 family | Step 13, then the bell rewrite |
| Custodian condition report: if the server cannot be reached, the form saves the browser copy and still shows "Report Archived". The request's answer is never read, so a server-side refusal looks like success too | n/a (new) | Step 13 (typed errors), or with open team decision 2 |
| `updateProfile` swallows a failed save and the account page shows its success tick anyway | n/a (new) | Step 13 |
| `addRepairRequest` is unchanged, so `RepairForm` still posts each ticket twice and relies on the server's 8-second guard. 01D section 7 removes each form's second write when the forms move. **The forms moved in step 8 part 1 without this change**, because that session moved files only and removing the second post changes what reaches the server. `TODO(M-07)` marks the line. **Fixed in step 8 part 2** (`5d26ed8e`): RepairForm posts once, then calls `syncFromDb()`. The server's guard stays until step 12 | M-07 | Done (server guard: step 12) |
| Two pre-existing bugs found during the step 6 hand checks: duplicate custodian requests on one asset (issue #25), and My Assets listing disposed assets because `CustodianPortal.tsx` has no status filter (issue #26). **Fixed on `fix/issues-25-26`** (`bc041acb`, `95290115`), see "Bug fix: issues #25 and #26" above | H-05 (#25), n/a (#26) | Done |
| Two pre-existing bugs found during the step 8 part 1 hand checks, not caused by the move: Classic Dark darkens only a few components because many screens hardcode light colours, and the bell has no Decline button for loan requests | n/a | GitHub issues #43 and #44, their own fix branch |
| H-05 is only partly closed by #25. `POST /disposal` still checks only that the asset exists, so an asset that is on loan or already has a pending disposal can be put up for disposal. The loan and transfer guard is also check-then-insert, so two requests in the same instant can both pass (`TODO(H-05)` in `server.ts`) | H-05 | Disposal guard: its own fix, or step 12 (disposals). The race: Phase 3 database triggers |
| Hiding the requester's name from other custodians (D2) happens only on screen. `GET /api/asset_loans` and `GET /api/asset_transfers` still send every requester's name to anyone who calls them, logged in or not. Real privacy needs the server to filter by role | C-02, D2 | Step 13 (`requireAuth`), then a role check on the two list endpoints |
| A loan's requester is the `borrower_id`, which the server resolves from the name typed in the borrow form and otherwise sets to `DEFAULT_CUSTODIAN_ID` (user 1, ITS Admin). The form fills in the custodian's own name, so this normally matches. If they type a different name, their own request shows them "Requested by another user", and Staff see that other name | H-10 | Phase 3 (borrower from the session) |
| `GET /api/asset_loans` seeds a pending loan with id 9 on the first asset whenever no pending loan exists (H-08). With the #25 guard, that seeded row now also blocks new requests on that asset until someone decides it. On the current database loan 9 already exists, so the seed's insert fails silently and nothing changes; it matters only on a fresh database | H-08 | Delete the seed block (H-08), its own fix |
| **Transfers superseded (2026-10-04).** Custodian-to-custodian transfers will become a custodianship queue: the custodian releases to Staff, Staff assign the next custodian. Design not final. Today's transfer behavior is kept, and step 12 moves the code without the Lab Head approval rule the earlier decision asked for | Question 1 | Issue #22, after the restructure with the Phase 3 tables |
| **Inspection photos (2026-10-04):** at most 3 per report, stored high resolution and deleted after 2 weeks (whether to keep one compressed copy as audit evidence is still being confirmed). Asset registry pictures are compressed and kept | M-17 | Phase 3 |
| **Repository visibility (2026-10-04):** the repo will be made private. Git history stays as is, no rewrite. The account passwords in it are test data and will be rotated later | C-01 | Issue #9, team action |
| When the server cannot be reached, the login form says "Invalid institutional email address or password.", which sends the user looking for a typo when the real problem is the network. Same message as before step 7, so it was kept | H-16 family | Step 13 (typed errors), or a small fix with `Login.tsx` in step 8 |
| Browsers that opened the app before step 7 still hold `dlsu_equipment_ms_db_v2` in localStorage, with the demo passwords inside. Nothing reads it any more and nothing writes it, but nothing clears it either. The same is true of `ems_pending_disposals` from step 6 and `ems_inspections` from step 8 part 2. Harmless to the app; worth a line in the team announcement ("clear site data once") | C-03 | Team announcement, no code |
| The Phase 1 and 1B documents (01A, 01B, 01C, 01E, and others) still link to `src/app/prismaClient.ts`, which no longer exists. They are dated records of the code at the time and are not edited. The file can still be read with `git show fbfcccda:src/app/prismaClient.ts` | n/a | No action |
| `strict: false` is a deliberate starting point. Turning strict on is worth doing once the count is near zero, not during the move | H-13 | After step 9 |
| **Three analytics endpoints are reached only from widgets nothing renders.** Seven exported analytics widgets are not used by any view or page: `GrantReadinessIndex`, `ComplianceWidget`, `AuditDiscrepancyWidget`, `DisposalActionList` (Director), `IdleTimeAnalyzer`, `IdleTimeDurationFrequencyWidget`, `LoanRecommenderList` (Lab Head). The last three are the only callers of `GET /api/analytics/advanced/idle-time`, `idle-frequency`, and `loan-recommender`. Those three are **not** among the 11 no-caller endpoints the 2026-10-04 decision deletes, so they stay mounted unless the team extends the decision. **Decided 2026-10-07:** keep the widget code and the three endpoints for now; the widgets moved to `legacy/analytics-widgets/` (`99eb7191`). The three endpoints are **not** part of the step 12 deletion. They stay unauthenticated until step 13 | 01C section 4.4 (same family) | Done (moved); endpoints: a later team decision |
| `AssetImagePlaceholder` picks its icon from display names ("Computing Array" and others) that the database categories (`DEV_KIT`, `MONITOR`, ...) never match, so every asset without a picture shows the computing icon and the label "ASSET" | n/a (new) | Small fix branch |
| The success screens of the loan, transfer, and repair forms show a reference number made up in the browser (`LOAN-123456`, `TRF-...`, `MNT-...`), not the id the database gave the request (`LOAN-22`). The return form falls back to a made-up `CLR-` number when the server call fails. A user who quotes that number to Staff gives them a number nothing records | n/a (new) | Step 13 (typed responses), or a small fix branch |
| `LocationStatusWidget` (Staff analytics) shows invented figures when its endpoint fails: fixed shares of the asset count (60% available, 30% on loan, and so on), with nothing on screen saying they are estimates. Same family as the server's invented series. `TODO(H-09)` marks it | H-09 | Step 12 (analytics) |
| The Director's audit trail and CSV export use the database reports (`asset_reports`) for an asset, and fall back to this browser's own copies (`ems_inspections`) when the asset has none. Decision 2 covers the Staff log only; this second reader of the browser copy should be settled in the same commit. **Done in step 8 part 2** (`82bc2e8e`): the audit shows only database reports | F-28 | Done |
| `avatar.tsx` and `checkbox.tsx` in `web/components/ui/` are imported by no file. Kept, since primitives are cheap and a later screen may use them | n/a | No action, or remove in a cleanup |
| The sidebar sets a 150 ms tooltip delay (`TooltipProvider delayDuration={150}`), but the shadcn `Tooltip` wraps itself in its own provider with delay 0, and the nearest provider wins. So the 150 ms has no effect and tooltips show at once | n/a (new) | Cosmetic, small fix |
| Left for step 8 part 2, once `ITSDashboard.tsx` leaves `src/`: remove the `@` alias (`vite.config.ts`, `tsconfig.json` `@/*`), the `src` entry in `tsconfig.json` `include`, the temporary `src/` line in `web/styles/tailwind.css`, and the `src/` line in the root `README.md`. The `figma:asset` resolver in `vite.config.ts` points at `src/assets/`, which does not exist, and nothing imports `figma:asset/...`; it can be removed or repointed then. **Done in step 8 part 2** (`7ca707c5`): all removed, including the resolver (L-06) | n/a, L-06 | Done |
| **Step 8 part 2, new:** the intake wizard's serial is generated once, when the module loads. After a successful registration, and every time the Register tab opens, the form offers the same serial again until the page is reloaded, so two registrations in one session get the same serial unless Staff change it. True before the split too. **Decided 2026-10-08:** a bug, fixed after the restructure (issue #47) | n/a (new) | Issue #47, after the restructure |
| **Step 8 part 2, new:** the finalize dialog's Inspector Role (TSG Staff, ITS Staff, Lab Head, Custodian) was stored only in the browser copy of the report. Since that copy is gone it reaches nowhere; the database records the reporter's account. The field could be removed, or stored with the report. **Decided 2026-10-08:** keep the field; it will be stored with the report in Phase 3 (issue #48) | F-28 | Phase 3 (issue #48) |
| **Step 8 part 2, new:** the Inspections queue's "Last Inspected" column shows the procurement date (or the literal "Jan 15, 2024"), not the newest report. `TODO(F-28)` marks it | F-28 | Phase 3, or a small fix using the reports the page already loads |
| **Step 8 part 2, new:** `RepairAlertCard` is rendered by no page, before or after the split. It moved to `web/features/repairs/` so `ITSDashboard.tsx` could go; its TSDoc says it is unused. Same question as the analytics widgets: keep, quarantine, or delete. **Decided 2026-10-08:** move it to `legacy/`. **Done** (`89d2212c`, `legacy/repair-alert-card/` with a README) | n/a | Done |
| **Step 8 part 2, new:** `EditAssetDialog` has its own inline category list (the same 20 values as `ASSET_CATEGORIES`) and defaults a missing category to "IT Equipment", which is not a category. Step 3 replaced the intake copy but not this one | n/a | Small fix, or step 12 (assets) |
| **Step 8 part 2, new:** the Custodian report banner still says "SCHEDULED BY TSG" and names the cycle, though nothing schedules inspections any more. The cycle comes from each browser's own setting (F-38). **Step 9** (`d9d95f18`) changed the text to "SCHEDULED BY STAFF", as asked; the banner still implies a schedule that nothing sets | F-38, H-18 | With issue #34 |
| **Step 8 part 2, new:** invented figures on Staff screens, all pre-existing: the Overview "System Operational Index" is a fixed 97.8%, and the Health benchmark grid has no data source, so its table is empty and its four summary numbers are fixed text. `TODO(H-09)` marks both | H-09 | Step 12 (analytics), or remove the grid |
| **Step 8 part 2, new:** the QR print window pastes asset names and labs into its HTML unescaped. `TODO(H-20)` marks it | H-20 | Step 13 (shared escaping) |
| **Step 9, new: the rest of M-11 is still open.** Step 9 fixed only `ITS_STAFF`. Still true: `ADRIC_SECRETARY` gets the Staff dashboard (and unit ITS), which was already so; an account with several roles gets only the first match; the mapping is written out twice in `server.ts` (login and `/me`); and sign-up approval maps a requested "ITS" to `ADMIN`, so no `ITS_STAFF` account can be created through the app (the sign-up form only ever requests Custodian, so this is reachable only through the C-05 fallback). The live database has no `ITS_STAFF` or `ADRIC_SECRETARY` account today. **Decided 2026-10-08:** the Secretary gets the Director view, on the ITS removal branch (whether it can approve and sign off is still open); `ADMIN` gets its own Admin role after step 13; the `ITS_STAFF` fix is verified by code reading only and gets a Phase 2 test on the local test database | M-11, C-05 | ITS removal branch, step 12 (auth, one mapping table), Phase 2 (test), after step 13 (Admin) |
| **Step 9, new: `staffUnit` protects nothing by itself.** The session carries the unit for issue #41, but the session is an unsigned email cookie (C-06) and the server checks no role on any write (C-02). Different edit and delete rights for ITS and TSG only mean something once the server enforces them. **Update 2026-10-08:** ITS is being removed, so #41 becomes "TSG or Admin gets the edit or delete right for assets with no history", still open and related to issue #19; `staffUnit` goes with the ITS removal branch | C-02, C-06, issues #41, #19 | Team decision on #41; enforcement after step 13 |
| **Step 9, new:** a ticket's forwarding unit (`forwardedTo`: TSG, ITS, Both) is chosen in the repair form and set by Send to Maintenance, but the server never stores it, so "Dispatched To" always shows a dash. Pre-existing; `useRepairTickets.ts` already says so. Step 9 kept the per-unit value for when it is stored | n/a | Step 12 (repairs), or Phase 3 (a column) |
| **Step 9, new:** the Staff analytics endpoint is still `GET /api/analytics/tsg`, called by `getTsgAnalyticsRaw` in `web/api/analytics.api.ts`. Renaming the URL is a backend change | n/a | Step 12 (analytics) |
| **Step 9, new:** `roleConfig` in `Sidebar.tsx` gives each role a `label` and `subtitle` that nothing renders (only `nav` is used). Step 9 gave Staff plain values. Cosmetic | n/a | Cleanup, no hurry |
| **Step 10, new:** 17 one-off scripts in `scratch/` import `../prisma` or `../mailer`, which no longer exist at the root, so they fail with "module not found". They are not part of the app, excluded from the typecheck, and 01D moves `scratch/` to `scripts/` later. Fixing an import is one line (`../server/config/prisma`), and with step 10 they also need the five `DATABASE_*` variables | n/a | When `scratch/` becomes `scripts/` (01D section 7) |
| **Step 10, new:** `server/app.ts` keeps `cors()` open to every origin and the 50 MB body limit. 01D section 6 lists an origin allowlist and a lower limit for `app.ts`; both change behavior. `TODO(C-02)` and `TODO(M-17)` mark the lines | C-02, M-17 | 01C tier 2 with step 13 (CORS); Phase 3 with the image storage (limit) |
| **Step 10, new:** the backup job's "inside the repository" guard takes the working folder as the repository, so it holds only when the server is started from the repository root (which every npm script does). Started from elsewhere, a `BACKUP_DIR` inside the repository would pass. Pre-existing since step 0; a comment says so | C-01 | Goes with the job (F-39: delete, step 12 or later) |
| **Step 10 hand checks, new (2026-10-09):** bell cards open a not-found page (404) for most roles, because a card links to a tab that does not exist under the viewer's own route tree. For example, a Lab Head's Return Request card goes to `/lab-head/returns`. Pre-existing in the original code, not caused by step 10. Issue #55 | n/a (new) | Issue #55; the bell rewrite (01D section 8) |
| **Old analytics changed (2026-10-08).** The 2026-10-04 decision to delete the 11 no-caller analytics endpoints in step 12 is replaced: none of the 22 untested analytics endpoints is deleted (the 11 from `legacy/analytics-v1/` and the 11 that never had a caller). In step 12 their handler code moves to `legacy/analytics-endpoints/` with a README, and their routes are unregistered. The three endpoints kept on 2026-10-07 (`idle-time`, `idle-frequency`, `loan-recommender`) are not among the 22 and stay mounted. Earlier lines in this log that say "deleted" or "the step 12 deletion" are kept as dated records | 01A 6.11, M-06 | Step 12 (analytics) |

**Note 1 (step 0):** no comment commit. `server.ts` is excluded from the comment pass because it is about to be split, and `.gitignore` and `.env.example` carry their own inline explanations.

**Note 2 (step 1):** no comment commit. The step created only `tsconfig.json` and edited `package.json`, both JSON, where TSDoc and file headers do not apply. The reasoning lives in this log instead.

**Note 3 (step 2):** no comment commit, by design. Per the prompt, files quarantined into `legacy/` get only their README, not per-file headers or TSDoc. Commenting dead code would imply it is maintained.

**Note 4 (step 7):** no comment commit. The step created and moved no files: it deleted one and edited `Login.tsx`. `Login.tsx` moves to `web/` in step 8 and gets its file header and TSDoc there, per the rule "comment code at its destination, when it lands".
