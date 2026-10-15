# 02. Restructure Log

Running record of the migration in [01D section 9](../phase-1b-deep-map/01D-restructure-plan.md#9-ordered-migration-steps).
Decision and comment standard: [01-restructure-decision.md](01-restructure-decision.md), [../guides/CODE-COMMENTS.md](../guides/CODE-COMMENTS.md).

Branch: `refactor/feature-based-structure` from step 3 on (steps 0 to 2 were on `refactor/option-a-structure`, merged in PR #4). Steps 3 to 5 were merged into `main` in PR #15 and step 6 in PR #16. The fixes for issues #25 and #26 were merged in PR #33 (their own branch); step 8 continues from that merge. Step 8 part 1 was merged in PR #45, and part 2 continues from that merge (`9db4a4d7`). Step 8 part 2 was merged in PR #46, and step 9 continues from that merge (`8db5a88f`). Step 9 was merged in PR #50 and the Phase 2 API tests in PR #52; step 10 starts from that merge (`dd6db809`), on a fresh `refactor/feature-based-structure`. Step 10 was merged in PR #56; step 11 starts from that merge (`2256e0ad`), again on a fresh `refactor/feature-based-structure`. Step 11 was merged in PR #58; step 12 starts from that merge (`6cf95b29`), again on a fresh `refactor/feature-based-structure`, and runs in batches (batch 1: returns, transfers, disposals). Batch 1 was merged in PR #61; batch 2 (repairs, inspections) starts from that merge (`d571d697`), again on a fresh `refactor/feature-based-structure`. Batch 2 was merged in PR #64; batch 3 (auth, assets, and the borrowed reads) starts from that merge (`e3ac3e3f`), again on a fresh `refactor/feature-based-structure`. Batch 3 was merged in PR #77; batch 4 (analytics, the last batch) starts from that merge (`c407a232`), again on a fresh `refactor/feature-based-structure`. Batch 4 was merged in PR #90; step 13 runs in three parts (13a, 13b, 13c), each its own session and pull request, and 13a starts from that merge (`c8f50cfb`), again on a fresh `refactor/feature-based-structure`. 13a was merged in PR #91; 13b starts from that merge (`2c107afc`), again on a fresh `refactor/feature-based-structure`. From step 10 on, `npm test` runs after every commit and must stay at 305 passed; from step 13a on, at 309 (4 errorHandler tests added). Nothing here is pushed by the agent; Raiki pushes and opens the pull requests.

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
| 11 | Extract one backend feature end to end (loans) | Done (all 8 hand checks passed), merged in PR #58 | `0ba5feda`, `b3212304`, `2261a0dd` (moves and types) | `4a51c67a` | **71** (unchanged, same errors); `npm test` **305 passed** after every commit | 2026-10-09 |
| 12 | Extract the remaining backend features | Batch 1 done (returns, transfers, disposals; all 9 hand checks passed), merged in PR #61. Batch 2 done (repairs, inspections; all 9 hand checks passed), merged in PR #64. Batch 3 done (auth with registrations, assets, and the borrowed reads folded; all 11 hand checks passed, 1 and 2 without their reload part, blocked by issue #49), merged in PR #77. Batch 4 done (analytics, the startup check, two folds, the backup job; `remainingRoutes.ts` deleted; all 10 hand checks passed, 2026-10-13), merged in PR #90. **Step 12 complete** | Batch 1: `86d166ee` (email lookups), `02147897` (returns), `574ded38` (transfers), `9e81ffc6` (disposals). Batch 2: `d4a473d6` (repairs), `3d8d4547` (inspections). Batch 3: `5b94aa9b` (auth), `c6cf958f` (assets), `569a175d` (borrowed reads). Batch 4: `9265911f` (analytics), `c5ff5d27` (behavior change: 22 old endpoints to legacy, unregistered), `94374139` (startup check), `13c33c2c` (two folds), `1a3b3bbd` (behavior change: backup job deleted, F-39) | Batch 1: `5dc2f47a`. Batch 2: `e30282a5`, `edad3003` (issue #53). Batch 3: `39bc37eb`; the hand checks and issue numbers recorded in a later docs commit. Batch 4: `1c83c84d`; the hand checks recorded in a later docs commit | Batches 1 to 3: **71** (unchanged, same errors). Batch 4: **68** (the three `is_documented` errors moved into `legacy/`, see detail); `npm test` **305 passed** after every commit | 2026-10-09, 2026-10-10, 2026-10-11 |
| 13 | Add `errorHandler` and `requireAuth` (in three parts: 13a `errorHandler`, 13b session and roles, 13c the session user) | 13a done (merged in PR #91); 13b done 2026-10-15; hand checks 1 to 5 passed on CCS Cloud, then two fixes; 6 to 13 passed on the local test database after a third fix (9 failed first); 2 and 5 re-run on CCS Cloud after the two fixes and passed, so all 13 hand checks passed and none are left; 13c not started | 13a: `9c462ac9` (behavior change: body parser errors answer JSON), `62350584` to `7f56a1f8` (9 behavior changes, one per feature: generic 500s, H-16); docs `4f7bd647` (decisions). 13b: `fab7825a` to `680cd60a`, and `a984ffb2` (15 labelled behavior changes, among them the issue #49 fix and nine per-feature enforcement commits; see detail), tests `076490b7` and `68b5e20b`; docs `50889595`, `b4c83a76` (role table); after the hand checks, `128896fb` and `4c6bbc83` (2 more behavior changes), and after hand check 9, `4b5386d8` (1 more) | 13a: `b72cf6c3`. 13b: `50f33ac3` | 13a: **68** (unchanged, same errors); `npm test` **309 passed** (305 plus 4 new errorHandler tests) from `9c462ac9` on. 13b: **68** (unchanged, same errors); **309**, then **372** from `68b5e20b` (63 new tests), **375** from `128896fb` (3 cache tests) | 2026-10-14, 2026-10-15 |
| 14 | Baseline the migrations | Not started | | | | |

Steps 6, 7, 9, and 13 change behavior on purpose, and so do step 8 part 2 in five labelled commits (team decisions H-18 and F-28, and M-07) and step 10 in one (C-07, the database fallbacks that 01D section 6 deletes). Every other step is a move or an addition. Step 11 has no behavior change, and neither have step 12 batches 1, 2, and 3. Step 12 batch 4 has two labelled behavior-change commits, both team decisions: the 22 old analytics endpoints answer 404 (`c5ff5d27`, 2026-10-08), and the backup job is deleted (`1a3b3bbd`, F-39, 2026-10-09). Step 13a has ten, all part of the step 13 decisions (2026-10-13): a body the parsers cannot read answers JSON (`9c462ac9`), and each feature's 500s answer a generic message instead of the raw error text (H-16, one commit per feature). Step 13b has eighteen, all from the 13b decisions (2026-10-13 and 2026-10-15): the session cookie, logout, CORS, the web changes, the issue #49 fix, one enforcement commit per feature, the per-login token, and, after the hand checks, the 60-second session lookup cache, a restore that survives a slow server, and the "session ended" notice in a tab logged out from another tab.

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

## Step 11 detail

Started from the PR #56 merge (`2256e0ad`), on a fresh `refactor/feature-based-structure`. The three loan routes are the first backend feature split into the five layers of [01D section 4](../phase-1b-deep-map/01D-restructure-plan.md#4-the-layered-split-explained-plainly). **No behavior change.**

| Commit | Kind | What it does |
|---|---|---|
| `0ba5feda` | Move | Three helpers the loan routes share with routes that stay behind go to `server/shared/`: `DEFAULT_CUSTODIAN_ID`, `campusForLab` (with `LAGUNA_LABS`), and the H-05 guard `findCustodyRequestConflict`. Code unchanged |
| `b3212304` | Move | The three loan routes leave `remainingRoutes.ts` for `server/features/loans/` (five files). Adds `server/shared/errors/AppError.ts` and `shared/types/loans.ts`. `app.ts` mounts the loans router |
| `2261a0dd` | Types only | `web/api/loans.api.ts` takes `LoanRequestInput` from `shared/types/loans.ts` |
| `4a51c67a` | Comments | Headers, TSDoc, TODOs; stale mentions of `remainingRoutes.ts` and "steps 11 and 12"; the root README; this log |

### Where the loan code is now

| File | Layer | Holds |
|---|---|---|
| `server/features/loans/loans.routes.ts` | routes | `GET /api/asset_loans`, `POST /api/assets/:assetTag/borrow`, `PUT /api/asset_loans/:loanId/decision` |
| `server/features/loans/loans.validation.ts` | validation | The required-field check (borrower, purpose, due date) and the loan id and decision word checks |
| `server/features/loans/loans.controller.ts` | controller | Reads the request, prints the same log lines, calls validation and the service, writes the JSON answer |
| `server/features/loans/loans.service.ts` | service | The rules: asset exists, the H-05 guard, borrower by typed name, destination lab in the purpose, the H-08 seed, the list mapping, the custody handoff on approval |
| `server/features/loans/loans.repository.ts` | repository | Every Prisma call of the three routes, including the decision transaction |
| `server/shared/errors/AppError.ts` | shared | An error with an HTTP status (400, 404, 409), so the service can refuse without knowing about HTTP |
| `server/shared/services/custodyRequestGuard.ts` | shared service | `findCustodyRequestConflict` (H-05), used by borrow and by the transfer request still in `remainingRoutes.ts` |
| `server/shared/utils/campus.ts` | shared | `campusForLab`, used by the loan and transfer decisions |
| `server/shared/constants/defaultCustodian.ts` | shared | `DEFAULT_CUSTODIAN_ID`, used by loans and by six other workflows |
| `shared/types/loans.ts` | shared (both sides) | `LoanRequestInput`, `LoanDecision`, `LoanListItem` |

`remainingRoutes.ts` now holds 59 routes.

### How the behavior stayed the same

- **Same checks, same order, same answers.** Each refusal the old handler wrote directly (400, 404, 409) is now an `AppError` thrown by validation or the service, and the controller answers it with the same status and `{ success: false, error }` body. Anything else is still a 500 with the raw message, logged with the same "❌ MySQL Loan ..." line.
- **Same log lines.** The controller prints "🚀 Server received ..." before the checks, as before, so a refused request still shows in the server terminal. That is why validation is called by the controller rather than as route middleware (01D section 5 shows it as middleware).
- **Same transaction.** The decision still updates the loan and, on approval, reads the latest record and appends the ON_LOAN record in one transaction, in the same order. The service supplies the rule for the new record (`handoverRecord`), the repository runs the writes.
- **Same routing.** No loan path overlaps a path left in `remainingRoutes.ts`, so mounting the loans router first changes nothing; an unknown path still gets Express's 404.

### Differences from 01D, and why

- **01D section 5 shows the fixed version** (borrower from the session, `assetState`, a real destination column, `requireAuth` and `requireRole`, errors through `errorHandler`). It says itself that those fixes depend on later work. Step 11 moves the code as it is; each fix now has its place, marked with a `TODO` (H-10, H-19, C-02, H-16).
- **`AppError` exists already.** 01D lists `server/shared/errors/AppError.ts` as new; it is created now because the service needs a way to refuse. Until step 13's `errorHandler`, each controller catches it itself.
- **The H-05 guard reads the database itself.** It needs the latest asset record, pending loans, and pending transfers. The assets and transfers repositories do not exist until step 12, so `custodyRequestGuard.ts` keeps its three Prisma reads (a stated exception to "only repositories call Prisma"). 01D's `assetState.ts` was not created: merging the six "latest record" readers into one changes which record wins in a tie (M-09).
- **`loans.repository.ts` reads other tables** (`assets`, `users`, `user_centers`) for the same reason. They move to the assets and auth repositories in step 12.
- **`DEFAULT_CUSTODIAN_ID` and `LAGUNA_LABS` moved, not deleted.** 01D deletes both, but only once the session gives the acting user (step 13) and campus comes from `research_centers` (Phase 3).
- **`shared/types/loans.ts` is used for the request only on the web side.** Typing the web responses would turn existing mismatches into new type errors (see notes), so `listLoans` and `decideLoan` still return `ApiResult`.
- **Issue #32 (identify users by id) is not applied to loans.** The decisions table schedules it for "steps 11 to 13". For a loan request, the only id the server could use today is one the browser sends, which it would have to trust as blindly as the name; the real fix is the session user from `requireAuth` (step 13). The Phase 2 tests also pin the typed-name lookup (three tests), so changing it here would change the 305. **Decided 2026-10-09:** step 13 switches to the session user for loans and for every feature step 12 extracts, and updates the three Phase 2 tests in the same commit.

### Typecheck: 71, unchanged

Compared after every commit, by file and message: the same 71 errors. None of the eight in `remainingRoutes.ts` was in loan code.

### Verified

- After **every** commit: `npm run typecheck` (71, same list), `npm run build` (passes; the production CSS and JS have the same SHA-256 as `main` every time, including after the web types commit), and `npm test`: **12 files, 305 tests passed**. The 31 tests in `tests/api/loans.test.ts` drive all three routes over HTTP.
- **Old against new, side by side.** `main` (in a temporary worktree) and `b3212304` were started against the test database and sent the same 18 requests: the loan list, borrow refused for an unknown tag, a missing field, a pending loan, and the On Loan, Maintenance, and Disposed assets, borrow with no body, decisions with a bad id, a `LOAN-2` id, "reject", no decision, an unknown loan, an already decided loan, and no body, plus `GET /api/assets`, an unknown path, and a GET on the borrow URL. **Every answer was byte-identical** (status, content type, body). The loan log lines were the same; only the stack trace lines of the two 500s name the new files.
- `npx tsx server/main.ts` with the real `.env` on a spare port: the same banner, "Default custodian check passed", "Backup skipped"; `GET /api/assets` 200; the loans router answered `PUT /api/asset_loans/abc/decision` and an empty borrow with their 400s (both refused before any database access). `GET /api/asset_loans` was not called on the shared database, because of its H-08 seed write.
- The comment commit changes comments only: every changed code line is a comment.

**Not verified in the agent session:** nothing was clicked in a browser, and no loan was requested or decided on the shared database. The hand checks below cover that.

### Hand checks: passed

Raiki ran all eight checks below and all passed (reported 2026-10-09). During checks 5 to 7 a pre-existing refresh gap between the bell and the Custody tab was found: a loan decided in one does not update the other until a reload. It is not caused by step 11 (the web bundle is identical to `main`) and is filed as issue #57, to be fixed with #55 (see notes). The list is kept for the record.

**Stop any running server and restart** (`npm run dev:all`). A server started before this step still runs the old loan code.

1. *Request.* As a Custodian, open an Active asset with nothing pending, press Request Loan, pick a destination lab, and submit. The success screen shows. In `asset_loans` there is a new `pending` row whose purpose starts with "Destination Lab: <lab>". The server terminal shows "🚀 Server received loan request ..." and "✅ Loan request logged in MySQL successfully".
2. *Pending tile.* Reopen the asset: "Your request is pending" replaces Request Loan. As a different Custodian: "Requested by another user".
3. *Refusal.* As a Custodian, open another Active asset in two browser tabs. Submit a loan in the first; submit one in the second without reloading. The second shows the 409 message under the form ("... already has a pending loan request (LOAN-n).").
4. *List.* As the Lab Head of that asset's lab, open the Custody tab. The loan requests list loads and shows the new request.
5. *Approve.* Approve it from the Custody tab. The row becomes `approved`, a new `asset_records` row is `ON_LOAN` under the borrower, and its `current_location` names the destination lab and its campus. The asset shows On Loan under the borrower.
6. *Decline.* File a second request on another asset and decline it. The row becomes `declined`, no new `asset_records` row, the asset stays Active.
7. *Bell.* File one more request, and as the Lab Head approve it from the notification bell. Same result in the database as check 5, and the bell entry updates.
8. *Tests.* `npm test` passes on your machine: 305 tests.

---

## Step 12 detail

Step 12 runs in batches. **Batch 1 (2026-10-09): returns, transfers, disposals**, in the order 01D section 9 gives, on a fresh `refactor/feature-based-structure` from the PR #58 merge (`6cf95b29`). Each feature is split into the five layers the way loans was in step 11: the same `AppError`, the same controller shape, one move commit per feature. **No behavior change.**

| Commit | Kind | What it does |
|---|---|---|
| `86d166ee` | Move | `getUserEmail` and `getRoleEmails` (who to email) go to `server/features/auth/auth.repository.ts`, where 01D section 6 puts them. Their only callers are the transfer and disposal routes. Code unchanged |
| `02147897` | Move | The two return routes leave `remainingRoutes.ts` for `server/features/returns/` (five files). Adds `shared/types/returns.ts`; `web/api/returns.api.ts` takes its request type from there |
| `574ded38` | Move | The four transfer routes (including `/accept`) leave for `server/features/transfers/`. Adds `shared/types/transfers.ts`; `web/api/transfers.api.ts` takes its request type from there |
| `9e81ffc6` | Move | The three disposal routes leave for `server/features/disposals/`. Adds `shared/types/disposals.ts`; `web/api/disposals.api.ts` takes its request type from there. `remainingRoutes.ts` no longer sends email |
| `5dc2f47a` | Comments | Headers, TSDoc, TODOs on the 19 new files; stale headers in `app.ts`, `config/prisma.ts`, `remainingRoutes.ts`, `AppError.ts`, `custodyRequestGuard.ts`, `campus.ts`, `defaultCustodian.ts`, `mailer.ts`, `assetCondition.ts`, the three web API files, and the disposal form's TODO; this log, issue #57 in the step 11 note |

### Where the code is now

| Feature | Endpoints | What each layer holds |
|---|---|---|
| `server/features/returns/` | `POST /api/assets/:assetTag/return`, `GET /api/asset_returns` | validation: the condition is present and one of `ASSET_CONDITIONS`. service: asset exists, returner by typed name, the `CLR-` reference, the ACTIVE record under user 1 (the pool). repository: the transaction (return row, then the record) |
| `server/features/transfers/` | `POST /api/assets/:assetTag/transfer`, `GET /api/asset_transfers`, `PUT /api/asset_transfers/:transferId/decision`, `PUT /api/asset_transfers/:transferId/accept` | validation: recipient email and reason present; id and decision word. service: asset exists, the H-05 guard, from-custodian from the latest record, recipient by email, destination lab in the justification, the list mapping, the ON_LOAN handoff on approval, `/accept`, and the two emails. repository: the decision transaction |
| `server/features/disposals/` | `POST /api/assets/:assetTag/disposal`, `GET /api/asset_disposals`, `PUT /api/asset_disposals/:disposalId/decision` | validation: justification and pathway present; id and decision word ("reject", not "decline"). service: asset exists, requester by typed name, the packed reason text, the list mapping, the DISPOSED record on approval, and the two emails. repository: the decision transaction |
| `server/features/auth/auth.repository.ts` | none yet | `getUserEmail`, `getRoleEmails`. The rest of auth joins it in a later batch |
| `shared/types/returns.ts`, `transfers.ts`, `disposals.ts` | | The request bodies, the decision words, and the list rows. The web side uses the request types only, as with loans |

`remainingRoutes.ts` now holds 50 routes (59 before; 2 return, 4 transfer, and 3 disposal routes left). It no longer imports the mailer, `campusForLab`, or the custody request guard.

### How the behavior stayed the same

- **Same checks, same order, same answers.** Each refusal the old handlers wrote directly (400, 404, 409) is an `AppError` thrown by validation or the service, and the controller answers it with the same status and body. Anything else is still a 500 with the raw message, with the same "❌ MySQL ..." log line. `/accept` keeps its own shape: no log line, 404 "Transfer request not found.", and a 500 with the raw message (no fallback text), as before.
- **Same log lines,** printed before the checks, as in step 11.
- **Emails still go after the answer, not awaited.** The controller sends the JSON answer first and then calls the service's `notify...` function without waiting, exactly where the old handler called `sendEmail` or the email lookup. The subjects, recipients, and HTML are unchanged.
- **Same transactions, same order.** A return writes the return row, then reads the latest record, then appends the ACTIVE record. Transfer and disposal decisions update the status, then read the latest record and append the new one, as in step 11's `saveDecision`.
- **Known defects kept, as decided:** a return is accepted whatever the asset's status (issue #51), a disposal has no status or duplicate guard (issue #54), `/accept` moves a transfer from any status to one the decision refuses (M-12), and no Lab Head approval rule is added to transfers (question 1, superseded 2026-10-04: issue #22). The name lookups are moved unchanged; step 13 switches them to the session user (issue #32). Each has a `TODO` at its line.
- **Same routing.** None of the new paths overlaps another or a path left in `remainingRoutes.ts` (checked method by method), so mounting the three routers before it changes nothing; an unknown path still gets Express's 404.

### Differences from 01D, and why

- **01D section 6 lists fixes for these features** (close the loan on return, H-04; destination and effective date as columns, H-19; disposal fields as columns, M-13; `/accept` deleted, M-12). Each is a behavior or schema change, so none is made here; each has a `TODO` at its line.
- **`auth.repository.ts` exists before the auth feature is extracted.** It holds only the two email lookups, which 01D sends there, so that transfers and disposals do not each keep a copy.
- **The cross-table reads stay in each feature's repository** (`findAssetByTag` in all three, `findUserByName` in returns and disposals, `findUserByEmail` and `findLatestRecord` in transfers), as in step 11, until the assets and auth repositories are extracted. That leaves three copies of the asset lookup and the name lookup (with loans); the name lookups go in step 13.
- **The custody request guard still reads pending transfers itself,** although `transfers.repository.ts` now exists: its three reads move together when assets is extracted.

### Typecheck: 71, unchanged

Compared after every commit, by file and message: the same 71 errors. None of the eight in `remainingRoutes.ts` was in return, transfer, or disposal code.

### Verified

- After **every** commit: `npm run typecheck` (71, same list), `npm run build` (passes; the production CSS and JS have the same SHA-256 as `main` every time, including after the three web type changes), and `npm test`: **12 files, 305 tests passed**. 73 of them drive the nine moved routes over HTTP (returns 16, transfers 32, disposals 25).
- **Old against new, side by side, after each feature commit.** `main` (in a temporary worktree) and the commit were each started against a freshly seeded test database and sent the same 60 requests: every refusal path of the nine routes (no body, empty body, bad condition, unknown tag, unknown email, the 409s, bad ids, wrong decision words, unknown and already decided ids, `/accept` with a bad id, an unknown id, a declined transfer, and no body), successful requests and decisions in each feature, the issue #51 and #54 cases, the three lists before and after, `GET /api/assets`, `GET /api/asset_loans`, an unknown path, and GETs on the POST URLs. Compared: every answer (status, content type, body), the log and email lines, and the rows of `asset_records`, `asset_returns`, `asset_transfers`, `asset_disposals`, and `asset_loans` afterwards. **All identical.** Normalized first: timestamps, the time-based `CLR-` reference, the port, and the source location and code snippet inside Prisma's raw 500 text (H-16), which now names the repository file. Write bursts start on a fresh second, because rows tied on a one-second `DATETIME` column otherwise come back in an order that varies from run to run (M-09); `main` against itself showed the same.
- The comment commit changes comments only: each of the 32 changed code files compiles to the same JavaScript with comments removed, before and after.

**Not verified in the agent session:** nothing was clicked in a browser, and nothing was written to the shared database. The hand checks below cover that.

### Hand checks: passed

Raiki ran all nine checks below and all passed (reported 2026-10-09). Two pre-existing gaps were found while running them, neither caused by step 12 (the web bundle is identical to `main`): the return form shows a random `CLR-` placeholder before finalizing (issue #59), and the issue #57 refresh gap between the bell and the Custody tab also affects transfers (added to #57). Both are in the notes. The list is kept for the record.

**Stop any running server and restart** (`npm run dev:all`). A server started before this step still runs the old code.

1. *Return.* As a Custodian, submit a return request for an asset you hold. In the same browser, as Staff, open Pending Returns, press Evaluate and Finalize, and finish the form. A reference number (`CLR-...`) shows. In `asset_returns` there is a new row; in `asset_records` a new ACTIVE record for the asset, under user 1, with the condition you picked. The server terminal shows "🚀 Server received return finalization ..." and "✅ Return finalized in MySQL successfully".
2. *Transfer request.* As a Custodian, open an asset that is On Loan to you, press Custodianship Transfer, enter another custodian's email, pick a destination lab, and submit. The success screen shows. In `asset_transfers` there is a new `pending` row whose justification starts with "Destination Lab: <lab>". The terminal shows the two transfer lines, and an email line ("Sent ..." or "Mailgun not configured — skipping email ...").
3. *Transfer refusals.* On another On Loan asset, submit a transfer to an email no account has: the form shows "No user found with email ...". Submit a second transfer on the asset from check 2: the form shows "... already has a pending transfer request (TRF-n)."
4. *Transfer decisions.* As the Lab Head of that asset's lab, open the Custody tab: the transfer from check 2 is listed. Approve it: the row becomes `approved`, and a new ON_LOAN record puts the asset under the recipient with `current_location` "<Campus> — <Lab>". File another and decline it: `declined`, no new record. If the bell or the tab shows the old state until a reload, that is the same pre-existing gap as issue #57.
5. *Transfer from the bell.* File a transfer for a **CITe4D** asset (the bell only shows those to a Lab Head, F-31). As a Lab Head, press Approve Transfer in the bell. Same result as check 4.
6. *Disposal.* As Staff, open Decommission Asset on an asset and commit it. In `asset_disposals` there is a new `pending` row with the pathway, last custodian, date, and justification as labelled lines. The terminal shows the disposal lines and an email line for the Director.
7. *Disposal decisions.* As Director, open Approvals & Holds (or the bell) and approve the disposal from check 6: the row becomes `approved`, the asset shows Disposed, and its new record says "Decommissioned via Disposal #DISP-n". File another and reject it: `rejected`, no new record, the asset keeps its status.
8. *Every role.* Log in as Staff, Lab Head, Custodian, and Director, and open each tab once. Everything loads as before.
9. *Tests.* `npm test` passes on your machine: 305 tests.

### Batch 2: repairs and inspections (2026-10-10)

On a fresh `refactor/feature-based-structure` from the PR #61 merge (`d571d697`). Same pattern as batch 1: five layers per feature, the same `AppError`, one move commit per feature, then one comment commit. **No behavior change.** Nothing in this batch sends email, so no "who to email" lookup was needed (`server/features/auth/auth.repository.ts` is unchanged).

| Commit | Kind | What it does |
|---|---|---|
| `d4a473d6` | Move | The four repair routes leave `remainingRoutes.ts` for `server/features/repairs/` (five files). Adds `shared/types/repairs.ts`; `web/api/repairs.api.ts` takes its two request types from there |
| `3d8d4547` | Move | The three inspection routes leave for `server/features/inspections/`. Adds `shared/types/inspections.ts`; `web/api/inspections.api.ts` takes its request type from there |
| `e30282a5` | Comments | Headers, TSDoc, TODOs on the 12 new files; stale headers in `app.ts`, `config/prisma.ts`, `remainingRoutes.ts`, `AppError.ts`, `defaultCustodian.ts`, `assetCondition.ts`; the H-06 and L-07 TODOs in the two web API files and `useRepairTickets.ts`, which promised a merge in step 12; this log, `docs/README.md`, `docs/HANDOFF.md`, and the prompt's history line |
| `edad3003` | Comments | Issue #53 named at the inspection condition fallback (`TODO(H-07)` in `inspections.validation.ts`, `fileReport`'s TSDoc), once Raiki confirmed what it covers; the docs to match. Compiles to the same JavaScript |

#### Where the code is now

| Feature | Endpoints | What each layer holds |
|---|---|---|
| `server/features/repairs/` | `POST /api/assets/:assetTag/repair`, `GET /api/asset_repairs`, `PUT /api/asset_repairs/:repairId`, `PUT /api/asset_repairs/:repairId/status` | validation: the description check; the id and status checks of the main update; the presence-only check of `/status`. service: the 8-second duplicate guard, asset exists, reporter by typed name, the list mapping, and the progress rules (MAINTENANCE at the TSG Office, the restore and report on "Fixed & Completed"). repository: every Prisma call, including the progress transaction |
| `server/features/inspections/` | `POST /api/assets/:assetTag/inspection`, `GET /api/asset_reports`, `GET /api/asset-reports` | validation: reads the stored condition, remarks, and image from the body (see differences). service: asset by tag, else by numeric id; reporter by email, else `reportedById`, else user 1; the record sync; the two list mappings. repository: every Prisma call, including the report transaction |
| `shared/types/repairs.ts`, `inspections.ts` | | The request bodies and the list rows (both report shapes). The web side uses the request types only, as before |

`remainingRoutes.ts` now holds 43 routes (50 before). `GET /api/analytics/advanced/inspection-progress` stays there for the analytics batch: it reads asset records, not reports.

#### How the behavior stayed the same

- **Same checks, same order, same answers,** through `AppError` as in batch 1. The repair duplicate guard still runs before the tag lookup (an unknown tag sent twice still answers 409), and still prints "🛑 Duplicate repair request blocked" before refusing. `/status` keeps its own shape: no "received" line, no id check, and a 500 with the raw message and no fallback text. Each report list keeps its own error shape (`/api/asset_reports` prints nothing on failure).
- **Same order of reading the body.** The inspection route first reads the body after the asset lookup, as before, so a request with no body still answers 404 for an unknown tag and 500 otherwise.
- **Same transactions, same order.** A repair update writes the ticket, then reads the records (before maintenance, then newest) and appends the record and the report; an inspection writes the report, reads the newest report, then the newest record, then updates or creates it. The rules (which record, with which values) are in the services and handed to the repositories as builders, as in batch 1's decisions.
- **Kept as they are, as instructed:** the in-memory duplicate guard (M-07), both repair status endpoints (H-06), both report listings (L-07), and the known inspection defects (see the TODOs): an unknown condition saved as PERFECT with 200 (issue #53), the newest record changed in place (H-14), a bad `reportedById` answering 500 with the raw error (H-16), and the invented "DLSU Campus" record. Name and email lookups moved unchanged; step 13 switches them to the session user (issue #32).
- **Same routing.** No new path overlaps another or a path left in `remainingRoutes.ts` (checked method by method).

#### Proposals for separate commits (not done, as instructed)

01D section 6 asks for three changes here. Each changes behavior, so each was left as is, with a `TODO` at its line, and is proposed as its own commit:

1. **Delete the repair duplicate guard (M-07).** RepairForm posts once since step 8 part 2 (`5d26ed8e`). Effects: a real double post would file two tickets; an unknown tag sent twice answers 404, not 409. Updates two of the four duplicate guard tests in `tests/api/repairs.test.ts` (the 409 within 8 seconds, and the unknown tag answering 409); the two "accepts" tests still hold.
2. **Merge the two repair status endpoints (H-06).** Point `updateRepairStatus` (Staff analytics board) at `PUT /api/asset_repairs/:repairId` and remove `/status`. Effects: moving a ticket on the board would then move the asset into or out of MAINTENANCE and file a report on "Fixed & Completed", and a blank status or a bad id would answer 400 instead of being saved or answering 500. Updates the `/status` tests. Worth pairing with the status enum (H-07).
3. **Merge the two report listings (L-07).** One endpoint and one shape for `useInspectionReports` and `state/serverData.tsx`. Effects: the screens that read `RPT-n`, `asset_tag`, or `condition` need changing, and the reporter's email should leave the list (01C section 4.2). Updates the list tests in `tests/api/inspections.test.ts`.

#### Differences from 01D, and why

- **`inspections.validation.ts` refuses nothing.** The inspection route has no check that answers 400: every field has a fallback. Its validation file reads the body into the three stored values (the condition name map, the field fallbacks, the 255-character cut), and the service calls it at the point where the old handler read them, after the lookups. Calling it from the controller, before the asset lookup, would have turned a no-body request for an unknown tag from 404 into 500.
- **Cross-table reads stay in each repository,** as in batch 1: `findAssetByTag` in both, `findUserByName` in repairs, `findAssetById` and `findUserByEmail` in inspections. The repair update also writes `asset_reports` and `asset_records` inside its own transaction.
- **01D's other repair items** (status enum, H-07; warranty routing; storing the forward-to unit) are schema or behavior changes, so none is made here.

#### Typecheck: 71, unchanged

Compared after every commit, by file and message: the same 71 errors. None of the eight in `remainingRoutes.ts` was in repair or inspection code.

#### Verified

- After **every** commit: `npm run typecheck` (71, same list), `npm run build` (passes; the production CSS and JS have the same SHA-256 as `main` every time, including after the two web type changes), and `npm test`: **12 files, 305 tests passed**. 65 of them drive the seven moved routes over HTTP (repairs 36, inspections and reports 29).
- **Old against new, side by side, after each feature commit.** `main` (in a temporary worktree) and the commit were each started against a freshly seeded test database and sent the same requests: **44 for repairs** (no body, empty and blank descriptions, an unknown tag twice, the duplicate within 8 seconds, reporters by "Dr." name, unknown name, and none, an immediate ticket, a disposed asset, every update path: bad id, no status, blank status, unknown id, no body, the three maintenance statuses, other text, "Fixed & Completed" with a condition, a bad condition, none, on a ticket never in maintenance, and with 300-character remarks; on `/status`: completion, a maintenance status, spaces, empty, no body, a bad id, an unknown id, a number; the lists, `GET /api/assets`, both report lists, and unknown paths) and **29 for inspections** (unknown tag with and without a body, no body, an unknown numeric id, an empty body, reporter by email, an unknown email with a valid id, by id, a bad id, every condition spelling including lower case and "MINOR DRIFT", a numeric tag, 300-character remarks, the two image aliases, an asset with no records twice, both lists before and after, `GET /api/assets`, the custodian history, inspection progress, and unknown paths). Compared: every answer (status, content type, body), the log lines each request printed, and the rows of `asset_repairs`, `asset_records`, `asset_reports`, and `asset_loans` afterwards. **All identical** after normalizing timestamps and the source location Prisma prints inside its raw 500 text (H-16). For one repairs request (`/status` with id `abc`), Prisma also reprints the failed call indented to its column in the source file, so the indentation inside that error text differs; it is the same text otherwise. Write requests started on a fresh second (M-09).
- The comment commit changes comments only: each of the 21 changed code files compiles to the same JavaScript with comments removed, before and after.

**Not verified in the agent session:** nothing was clicked in a browser, and nothing was written to the shared database. The hand checks below cover the browser.

#### Hand checks: passed

Raiki ran all nine checks below and all passed (reported 2026-10-10). Notes from the run, by check number:

- **Check 6:** one `asset_reports` row per custodian report (row 34). It first looked as if the report saved twice; the second write is the asset's newest `asset_records` row being updated with the report's condition, which is the route's design (H-14 is about that update being in place).
- **Check 7:** passed, but the Staff "Submit & Finalize Inspection" button saved the same report twice (`asset_reports` rows 35 and 36, one second apart). Pre-existing: the button's handler waits for `syncFromDb()` before posting and does not lock the button meanwhile, so a second click posts again. Not caused by the batch: `web/features/inspections/InspectionQueue.tsx` is unchanged and the web bundle is identical to `main`. Issue #63.
- **During the checks:** the browser console warned of a duplicate React key `MNT-0001` in `InspectionQueue.tsx`. The queue's ticket ids strip the leading letters from the asset tag, so assets with the same number in different labs get the same id. Pre-existing. Issue #62.

Both issues are in the notes. The list is kept for the record.

**Stop any running server and restart** (`npm run dev:all`). A server started before this batch still runs the old code.

1. *Repair request.* As a Custodian, open an asset you hold, choose Request Repair, and submit a description. The success screen shows. In `asset_repairs` there is a new row with "Pending TSG Review" (or "Awaiting Immediate Dispatch" if you marked it urgent). The asset's status does not change. The terminal shows "🚀 Server received repair request ..." and "✅ Repair request logged in MySQL successfully".
2. *Repair from a return.* As Staff, finalize a return with "Flag for Repair Assessment" on. A new ticket appears in the Repairs tab.
3. *Acknowledge.* As Staff, open Repairs and acknowledge the ticket from check 1. Its status becomes "Inspection Phase", the asset shows Maintenance, and `asset_records` has a new MAINTENANCE row at "Manila — TSG Office". Move it to another in-progress status in the repair dialog: no second MAINTENANCE row.
4. *Complete.* In the repair dialog, choose "Fixed & Completed", pick a condition, and finalize. The asset goes back to the status and custodian it had before (Active, or On Loan under the same custodian), with the condition you picked; `asset_reports` has a new row for it.
5. *Analytics board (must be unchanged).* As Staff, move a ticket on the analytics repair board. Only `asset_repairs.progress_status` changes; the asset's status does not (H-06, as before).
6. *Condition report.* As a Custodian, submit a condition report. A new `asset_reports` row, and the asset's newest record takes the new condition. The terminal shows "📋 Server received inspection report ..." and "✅ Inspection report saved under asset_reports in DB".
7. *Staff finalize and the log.* As Staff, finalize a single-item inspection (Submit & Finalize Inspection). It joins the inspection log with the custodian's report from check 6. As Director, the audit trail shows them.
8. *Every role.* Log in as Staff, Lab Head, Custodian, and Director, and open each tab once. Everything loads as before.
9. *Tests.* `npm test` passes on your machine: 305 tests.

### Batch 3: auth and assets, and the borrowed reads (2026-10-11)

On a fresh `refactor/feature-based-structure` from the PR #64 merge (`e3ac3e3f`). Same pattern as batches 1 and 2: five layers per feature, the same `AppError`, one move commit per feature, then one comment commit. **No behavior change.** All eight `/api/auth/*` routes, registrations included, go to `server/features/auth/` (as instructed; 01D lists registrations as a feature of their own). Analytics stays for batch 4.

| Commit | Kind | What it does |
|---|---|---|
| `5b94aa9b` | Move | The eight auth routes leave `remainingRoutes.ts` for `server/features/auth/` (five files), extending the existing `auth.repository.ts`. `pending_registrations.json` is read and written there, unchanged. Adds `shared/types/auth.ts`; `web/api/auth.api.ts` takes `AccountUpdateInput` and the two sign-up request types from there |
| `c6cf958f` | Move | The five asset routes leave for `server/features/assets/`. Adds `shared/types/assets.ts`; `web/api/assets.api.ts` takes its two request types from there. `remainingRoutes.ts` now holds only analytics |
| `569a175d` | Move | The borrowed reads go to their owners: the six asset-by-tag lookups to `assets.repository.ts`, the five typed-name and two email user lookups to `auth.repository.ts`, and the H-05 guard's three reads to the assets, loans, and transfers repositories, so `custodyRequestGuard.ts` no longer imports `config/prisma` |
| `39bc37eb` | Comments | Headers, TSDoc, TODOs on the 12 new files and the extended `auth.repository.ts`; stale headers in `app.ts`, `config/prisma.ts`, `remainingRoutes.ts`, `AppError.ts`, `custodyRequestGuard.ts`, `defaultCustodian.ts`, the six feature services, the loans and transfers repositories, the three shared enums, the two web API files, and the root README; two TODOs that promised work "in step 12 (assets)"; this log, `docs/README.md`, `docs/HANDOFF.md`, and the prompt's history line |

#### Where the code is now

| Feature | Endpoints | What each layer holds |
|---|---|---|
| `server/features/auth/` | `POST /api/auth/register`, `GET /api/auth/pending-registrations`, `POST /api/auth/register-request`, `POST /api/auth/approve-registration`, `POST /api/auth/login`, `POST /api/auth/reject-registration`, `GET /api/auth/me`, `PUT /api/auth/account` | validation: the required-field checks. service: the duplicate email and id number checks, the sign-up defaults, the approval's role mapping and lab lookup, the login and `/me` role mapping (one function, `appRoleFor`; the two copies were identical), and the account update with its three email lookups. repository: every Prisma call, the user lookups other features need, and the sign-up file |
| `server/features/assets/` | `GET /api/assets`, `GET /api/assets/:assetTag/custodian-history`, `POST /api/assets`, `PUT /api/assets/:assetTag`, `DELETE /api/assets/:assetTag` | validation: the name and category check, and the image check. service: the list mapping and the history loop (copied unchanged), the tag generation, the edit rules, the delete lookup. repository: every Prisma call, including the registration, edit, and delete transactions, the asset lookup by tag every workflow uses, and the guard's newest-record read |
| `shared/types/auth.ts`, `assets.ts` | | The request bodies, the pending sign-up row, the user shapes, the asset list row, and the custodian history. The web side uses the request types only, as before |

`remainingRoutes.ts` now holds 30 routes, all `/api/analytics/*`, and the default custodian startup check (43 before: 8 auth and 5 asset routes left).

#### How the behavior stayed the same

- **Same checks, same order, same answers,** through `AppError` as before. Each controller reads `req.body` in the same single destructuring statement as the old handler, because Express 5 leaves `req.body` undefined when no JSON body is sent: the TypeError text in the 500 answer then stays the same. Expressions that can throw on a bad body keep their variable names (`email.trim()`, `imageVal.slice`, `data.status?.toUpperCase()`), for the same reason.
- **`pending_registrations.json` unchanged:** same file name, same path (`process.cwd()`, the server's working folder), read once when the module loads into an in-memory list, and the whole list written back after each change, with the same error logging. The list is now loaded when `auth.repository.ts` is first imported, which is at startup, slightly earlier in the import order than before; only the position of an "Error loading pending_registrations.json" line could differ. The file was never opened or printed in this session; the side-by-side runs compared the copies each server wrote in its own temporary folder.
- **Same transactions, same order.** Registration: the assets row, the monetary row, the first record. Edit: the assets fields (only those sent), the monetary upsert, the newest record read, its update (or a first record), then the report, the newest report read, and the record update; the rules are handed to the repository as a builder, as in batch 2. Delete: the seven child tables, then the asset. User creation (direct and approved): the user, the role link, the lab link.
- **Same queries after the fold.** Only identical queries were merged (same `where`, order, tie-breaks, and `select`). Not merged, because the ordering differs (M-09): `transfers.repository.ts` `findLatestRecord` (by `date_logged` only) stays apart from the guard's reader in `assets.repository.ts` (with the `asset_record_id` tie-break). The guard still runs its three reads together, in the same order.
- **Kept as they are, as instructed:** plain-text passwords, compared inside the query (C-03, issue #10); registration accepting the same email more than once (issue #14); the edit queries (the newest record overwritten, H-14, and read with no tie-break, M-09; and the edit transaction that can expire on the slow CCS Cloud link, issue #8); the approval body fallback (C-05); passwords in the pending list and in the sign-up and approval answers (C-04, 01C 4.1); the account update's MANILA_CAMPUS create that always fails, and its CITe4D answer; the dead `POST /api/auth/register`; the nine-table asset list (M-01); the tag read outside the transaction (H-11); the hard delete that skips `asset_reports` (H-03); the email and id number in the custodian history (01C 4.2). Name lookups moved unchanged with `TODO(H-10)` (issue #32, step 13). Each has a `TODO` or a comment at its line.
- **Same routing.** No new path overlaps another or a path left in `remainingRoutes.ts` (checked method by method). The assets router is mounted after the other features and before the analytics routes, which is where the asset routes were before.

#### Proposals for separate commits (not done, as instructed)

01D section 6 asks for these changes to auth and assets. Each changes behavior, so each was left as is, with a `TODO` at its line, and is proposed as its own commit. **Each is now a GitHub issue (2026-10-11),** named in the `TODO` at its line:

1. **Issue #70. Delete `POST /api/auth/register`** (no caller; superseded by request and approve). Effect: it answers 404. Updates the direct registration tests in `tests/api/registration.test.ts`.
2. **Issue #71. Delete the approval body fallback (C-05).** An unknown request id would always answer 404. Updates the C-05 test. **Corrected after the hand checks:** the web app sends a request id, but in the tab that filed the sign-up it is the Register page's own id (`REG-<timestamp>`), not the server's, so today those approvals succeed only through the fallback (hand check 5, issue #68). #71 needs #68 fixed first.
3. **Issue #72. Stop sending passwords** in the pending list (C-04), the sign-up answer, and the approval answer (01C 4.1). No screen reads them (no `.password` in `web/`). Updates the tests that pin them.
4. **Issue #73. Account update:** answer the account's real lab, and refuse (or map) a lab code with no research center instead of the MANILA_CAMPUS create that always fails; the same question for the approval, which creates a research center for any unknown lab name. Updates the two B1 tests that pin them.
5. **Issue #74. Asset edit:** append a record instead of overwriting the newest (H-14), read it with the tie-break (M-09), and save the acquisition value (M-16). Changes the asset history screens; updates the edit tests in `tests/api/assets.test.ts`.
6. **Issue #69. Asset delete:** "retire" as a status change (H-03), or at least clear `asset_reports`. Updates the delete tests. Hand check 8 hit it on the shared database.
7. **Issue #72 (with proposal 3). Custodian history:** drop the custodian's email and id number (01C 4.2), with step 13; check what the detail modal shows first.
8. **Issue #75. Registration tag in the transaction (H-11):** no visible change except under concurrent registrations.
9. **Issue #76. Rewrite `GET /api/assets`** as targeted queries (M-01; 01D says "rewrite, do not move"). The largest; worth its own branch with the screens.

Belong to later steps, not to a commit here: hashing and rate limiting (C-03, issue #10; Phase 3 and 01C tier 2), the session user for `/me`, the account update, and the name lookups (step 13, C-06, issue #32), and the sign-up table (H-17, Phase 3).

**Two small folds, planned for batch 4 as their own move commit** (decided 2026-10-11; behavior-neutral): `inspections.repository.ts` `findAssetById` runs the same query as `assets.repository.ts` `findById`; and `transfers.repository.ts` `findLatestRecord` moves to the assets repository as a function of its own (not merged with the guard's reader, M-09). Each feature's list lookups still read `assets` and `users` wholesale (M-01), and loans keeps the two H-08 seed reads.

#### Differences from 01D, and why

- **Registrations are in `features/auth/`,** not in a `features/registrations/` folder (01D section 2), as instructed for this batch.
- **01D's `assetState.ts` was not created.** The guard's newest-record read is a repository function (`findLatestRecordStatus`); merging the other "latest record" readers into one rule would change which record wins a tie (M-09).
- **01D section 8 says to rewrite `GET /api/assets`, not move it.** It was moved unchanged, because this batch is behavior-neutral; the rewrite is proposal 9.

#### Typecheck: 71, unchanged

Compared after every commit, by file and message: the same 71 errors. Five moved with their code and kept their messages: the `MANILA_CAMPUS` error to `auth.service.ts`, and the four in the asset list (three condition comparisons and `rUser?.role`) to `assets.service.ts`. Three remain in `remainingRoutes.ts` (analytics).

#### Verified

- After **every** commit: `npm run typecheck` (71, same list), `npm run build` (passes; the production CSS and JS have the same SHA-256 as `main` every time, including after the web type changes), and `npm test`: **12 files, 305 tests passed**.
- **Old against new, side by side, after each move commit.** `main` (in a temporary worktree) and the commit were each started against a freshly seeded test database and sent the same **126 requests**: every auth route (no body, empty and text bodies, missing fields, duplicates, each seeded role through login and `/me`, a password in another case, sign-ups with and without defaults, approvals by id, by body fallback, with a taken email, rejections, account updates by padded and upper-case email, with a known, unknown, and "Not Affiliated" lab, and a number as a name), every asset route (the list before and after, history by tag, by id, and unknown, registrations full, minimal, with a custodian, a bad date, a bad custodian, a bad and a non-text image, edits of every kind including status, condition, picture removal, 300-character remarks, a value only, and an empty body, deletes of an unknown, a plain, and an inspected asset), and the requests that use the folded reads (borrow, transfer, return, disposal, repair, and inspection, including the guard's refusals and unknown names and emails), plus the six lists and the Lab Head analytics. Compared: every answer (status, content type, body), the log lines each request printed, the rows of 13 tables, and the sign-up file each server wrote in its temporary folder. **All identical**, apart from stack frames in logged errors (the new files add frames) and the indentation of Prisma's raw 500 text, which reprints the failed call at its column in the source (as in batch 2). `main` against itself was identical. Write requests started on a fresh second (M-09).
- The comment commit changes comments only: each of the 33 changed code files compiles to the same JavaScript with comments removed, before and after.

**Not verified in the agent session:** nothing was clicked in a browser, nothing was written to the shared database, and `pending_registrations.json` in the repository was not opened. The hand checks below cover the browser.

#### Hand checks: passed

Raiki ran all 11 checks below and all passed (reported 2026-10-11). Notes from the run, by check number:

- **Check 1:** login works for every role, and a wrong password shows the message. The reload part could not be checked: a reload logs you out, which is issue #49 (pre-existing, see the step 9 hand checks), not batch 3. `/me` itself answers.
- **Check 2:** the name and picture save, and the terminal shows the update line. The reload part is blocked by issue #49, as in check 1.
- **Checks 3 and 4:** passed, but the approval worked only through the C-05 body fallback; see check 5.
- **Check 5:** the first run failed, for a pre-existing reason, now issue #68. After a sign-up, `Register.tsx` adds its own copy to the list with its own id (`REG-<timestamp>`), while the server saved `REG-<6 digits>`. Approving or rejecting in that same tab therefore sends the wrong id: the approval creates the user through the C-05 fallback and leaves the request in the file; the rejection removes nothing on the server. After a restart the list came from the server and showed all three requests. Rejecting them from that list, then restarting, removed all three: the file is read and written correctly when the id matches. Passed.
- **Checks 6 and 7:** passed.
- **Check 8:** the first run deleted an asset that had an `asset_reports` row: 500, "Foreign key constraint violated on the fields: (`asset_id`)" at `tx.assets.delete` (H-03, now issue #69). The transaction rolled back, so nothing was deleted. Redone with a freshly registered, unedited asset: deleted. Passed.
- **Checks 9, 10, and 11:** passed (`npm test`: 305 passed on Raiki's machine).

None of this was caused by batch 3: the web bundle is identical to `main`, and the side-by-side runs found no difference in the server. Issues #68 and #69 are in the notes. The list is kept for the record.

**Stop any running server and restart** (`npm run dev:all`). A server started before this batch still runs the old code.

1. *Login.* Log in as Staff (ITS and TSG), Lab Head, Custodian, and Director. Each lands on its own dashboard; a reload keeps you logged in (that is `/me`). A wrong password shows "Invalid institutional email address or password."
2. *Account page.* Change your name and picture, save, reload: both kept. The terminal shows "👤 Updated user credentials in MySQL DB: ...".
3. *Sign-up.* Submit a sign-up on the Register page. The terminal shows "📝 Registration request created for ... (Pending Lab Head Approval)". As a Lab Head, the request is listed.
4. *Approve.* Approve it. The terminal shows "✅ Lab Head Approved User Registration! ...", the request leaves the list, and the new account can log in with the password it signed up with.
5. *Reject, and the file.* Submit two more sign-ups; reject one. Restart the server (`npm run dev:all` again) and open the Lab Head's list: the other request is still there and the rejected one is not. This checks the file is read at startup and written after each change, without opening it.
6. *Register an asset.* As Staff, register an asset in a lab. It gets the next tag of that lab (`<lab>-000n`), shows in the inventory, and the terminal shows "🚀 Server received raw payload" and "✅ Asset saved to MySQL successfully".
7. *Edit an asset.* Change its name, category, and condition, with a remark. Saved; the inventory shows the change, and `asset_reports` has a new row for it. The newest `asset_records` row is changed in place, as before (H-14).
8. *History and delete.* Open the asset's detail: the custodian history loads. Delete an asset that has never been inspected: it leaves the inventory.
9. *The folded reads.* As a Custodian, request a loan on an asset that already has a pending request (two tabs, as in step 11 check 3): the second shows "... already has a pending loan request (LOAN-n)." File a repair and a transfer: each lands under the right person, as before.
10. *Every role.* Log in as Staff, Lab Head, Custodian, and Director, and open each tab once. Everything loads as before.
11. *Tests.* `npm test` passes on your machine: 305 tests.

### Batch 4: analytics, the startup check, two folds, and the backup job (2026-10-11)

On a fresh `refactor/feature-based-structure` from the PR #77 merge (`c407a232`). The last batch of step 12. Same pattern as batches 1 to 3: five layers, the same controller shape, one commit per move, then one comment commit. **Two commits change behavior on purpose, both decided by the team and labelled as such** (`!` in the commit title): the 22 old analytics endpoints stop answering, and the backup job is deleted. Every other commit is behavior-neutral.

| Commit | Kind | What it does |
|---|---|---|
| `9265911f` | Move | The 8 live analytics routes leave `remainingRoutes.ts` for `server/features/analytics/` (five files). Adds `shared/types/analytics.ts` (the response data of the eight) |
| `c5ff5d27` | **Behavior change** (decided 2026-10-08) | The 22 old analytics routes (Phase 2 test plan sections 3.1 and 3.2) move, unchanged and unregistered, to `legacy/analytics-endpoints/analyticsEndpoints.ts`, with a README. Each now answers 404 |
| `94374139` | Move | `assertDefaultCustodianExists` moves to `server/shared/services/defaultCustodianCheck.ts`, still called by `main.ts` at the same point; its query is now `auth.repository.ts` `findUserById`. `remainingRoutes.ts`, now empty, is deleted with its mount in `app.ts` |
| `13c33c2c` | Move | The two folds planned in batch 3: `inspections.repository.ts` `findAssetById` is deleted (the service calls `assets.repository.ts` `findById`, the same query), and `transfers.repository.ts` `findLatestRecord` moves to `assets.repository.ts` as its own function, not merged with `findLatestRecordStatus` (M-09) |
| `1a3b3bbd` | **Behavior change** (F-39, decided 2026-10-09) | The backup job is deleted: `server/jobs/backup.ts`, the 6-hour timer and the startup call in `main.ts`, `backupDir` in `config/env.ts`, and `BACKUP_DIR` in `.env.example`. `tests/` is left as it is, as instructed |
| `1c83c84d` | Comments | `docs(step 12): add file headers and TSDoc`: headers, TSDoc, and TODOs on the 7 new files; stale headers in `app.ts`, `main.ts`, `config/env.ts`, `config/prisma.ts`, `defaultCustodian.ts`, the assets and auth repositories, `shared/constants/labs.ts`, `web/api/analytics.api.ts`, the root README, and the two sibling legacy READMEs; six `TODO(M-09)` lines that promised work "later in step 12" now say Phase 3; this log, `docs/README.md`, `docs/HANDOFF.md`, and the prompt's history line |

**Step 12 is complete with this batch.** `server/remainingRoutes.ts` no longer exists: every route is in a feature router, and only the nine repositories in `server/features/` import `config/prisma` (checked by search; outside `server/`, the root `test-user.ts` still does, see the notes).

#### Where the code is now

| File | Layer | Holds |
|---|---|---|
| `server/features/analytics/analytics.routes.ts` | routes | `GET /api/analytics/director`, `/lab-head`, `/tsg`, `/location-status`, `/advanced/inspection-progress`, and the three kept on 2026-10-07 (`/advanced/idle-time`, `/advanced/idle-frequency`, `/advanced/loan-recommender`), in their old order |
| `server/features/analytics/analytics.validation.ts` | validation | Reads the `lab`, `labPrefix`, `category`, and date query values with the old expressions. Refuses nothing: none of the eight routes ever answered 400 |
| `server/features/analytics/analytics.controller.ts` | controller | `{ success: true, data }`, or 500 with the raw message. The Director, Lab Head, and TSG routes keep their error log lines; the other five log nothing, as before |
| `server/features/analytics/analytics.service.ts` | service | The computations, copied unchanged, including the Lab Head "fetched N filtered loans" log line at the same point |
| `server/features/analytics/analytics.repository.ts` | repository | Every Prisma call of the eight routes, in the same order, with the same `where` clauses; the only analytics file that imports `config/prisma` |
| `server/shared/services/defaultCustodianCheck.ts` | shared service | The startup check, unchanged apart from calling `auth.repository.ts` `findUserById` (same query) |
| `shared/types/analytics.ts` | shared (both sides) | The `data` of each of the eight routes. The web side does not use it yet: it builds its query strings at the call sites and sends no body, so `web/api/analytics.api.ts` is unchanged apart from two comments |
| `legacy/analytics-endpoints/` | legacy | `analyticsEndpoints.ts` (the 22 handlers, byte-identical to the 1,409 lines removed, behind the original imports and a router nothing mounts) and a README: each endpoint's method, path, what it computed, the tables it read, its group, why it is there, and what it takes to bring one back |

#### How the behavior stayed the same (the four move commits)

- **Same answers, same order of reads.** Each query runs in the same sequence as in the old handler (the dashboards awaited their queries one by one, and still do). The query values are read inside the `try`, so a repeated value (an array, for example `?labPrefix=a&labPrefix=b`) still answers 500 with the same TypeError text: the variable names those messages carry (`labParam.trim`, `lab.toLowerCase`) are kept.
- **No AppError.** None of the eight routes refused anything with 400 or 404, so none throws one; the controllers have no AppError branch (as `listAssets` in batch 3).
- **Same routing.** No analytics path overlapped another; the analytics router is mounted where `remainingRoutes.ts` was, last. With the empty router gone, an unknown path still gets Express's 404.
- **Same startup.** The banner, then the default custodian check (passed or failed, word for word), then, until `1a3b3bbd`, the backup line.
- **Known defects kept, as instructed** (each has a `TODO` or a "Known defect, kept" comment at its line): the Director lab filter narrows only the location chart, not the value, funding, and pending disposal figures beside it; labs are matched by text (the Director's Laguna check finds "CAR" anywhere; location status takes the first code of a fixed list, and a lab missing from it counts as CITe4D, M-03); the Lab Head overdue list counts pending requests past their due date and loans returned through the return route (H-04); inspection progress reads no report (it counts every record of a center's projects, ACTIVE ones as inspected, and 100% for a center with no projects); the demo series and invented values (H-09); `Pending_approver` (M-12); any lab prefix accepted (C-02, M-14); the newest record by date alone in location status and the idle charts (M-09); the loan recommender listing every ACTIVE record, history included; and Prisma's raw text in the 500s (H-16).

#### The two behavior changes

1. **`c5ff5d27`: the 22 old analytics endpoints answer 404.** Express's own not found page (`Cannot GET /api/analytics/dashboard`, or `Cannot POST` for `project-closure-recall`), as for any unknown path. No live screen and no test called any of them (`web/` and `tests/` checked by search; only one-off scripts in `scratch/` name them). This closes the unauthenticated finance and borrower data they served (01C section 4.4) without deleting the code (team decision 2026-10-08). Typecheck 71 to 68: the three `is_documented` errors (H-12) of `compliance` and `audit-discrepancies` are in the excluded legacy file now.
2. **`1a3b3bbd`: no backup.** The server no longer runs `performDatabaseBackup` (after the startup check, then every 6 hours). With `BACKUP_DIR` unset, which is every machine known to the team and the tests, the only visible change is that the "Backup skipped: BACKUP_DIR is not set" line no longer prints. With it set, no `backup-<timestamp>.json` is written any more. A `BACKUP_DIR` left in a `.env` is ignored. Deleted because it exported 4 of 15 tables, not `asset_records`, and so could not restore anything (F-39). `tests/setup/testServer.ts` still blanks `BACKUP_DIR` and `tests/setup/guard.test.ts` still checks it; that no longer affects the server and still passes.

#### Proposals for separate commits (not done, as instructed)

01D section 6 ("hardcoded demo series deleted, H-09") and the Phase 2 test log send these to "step 12 (analytics)". Each changes what a chart shows, so each was moved as it is, and is proposed as its own commit:

1. **Apply the Director lab filter to every figure** (portfolio value, funding breakdown, pending disposals), not only the location chart. Needs a rule for disposals and values without a record location. Updates the Director test that pins "narrows only the location counts".
2. **Delete the invented values (H-09):** the Director's fixed audit series when no report is in range (an empty chart instead), the Lab Head project allocation's 250,000 per asset (the real acquisition values instead), and the defaults for an asset with no record (PERFECT and "Unassigned" on the Staff dashboard, Active at Manila, CITe4D in location status, idle for 0 days). Updates the H-09 tests of the Director, Staff, and location status.
3. **Lab Head overdue list: leave out pending requests** (nothing was handed over), and, with H-04 (loans closed on return, Phase 3), loans returned through the return route. Updates the two tests that pin both.
4. **Inspection progress from `asset_reports`:** one entry per asset (its newest report in the cycle), and 0% or "no assets" for a center with no projects. Better after issue #34 (cycle type). Updates the two inspection progress tests.
5. **Labs from data, not text (M-03):** the Director's campus from `research_centers.location`, location status per lab from a lab column or the project's center, and `?lab` matched exactly. Needs a Phase 3 schema decision first. Updates the M-03 tests.
6. **The newest record with the `asset_record_id` tie-break (M-09)** in location status and the idle charts, and the loan recommender from each asset's current record only. Not testable reliably (same-second ties), as the test log says.
7. **Rename `GET /api/analytics/tsg` to `/api/analytics/staff`,** with `getTsgAnalyticsRaw` in `web/api/analytics.api.ts` and the Staff tests in the same commit (a URL change, so not a move).
8. **Refuse bad input:** an unknown `?category` on the loan recommender answers 400 instead of 500 with Prisma's text (H-16), and an unknown lab prefix answers 404 or 400 instead of empty data (M-14). With step 13's `errorHandler`, and the Lab Head's lab from the session (C-02).

Belong elsewhere, not to a commit here: `Pending_approver` (with M-12, transfers), who may read which lab (step 13), the per-dashboard service split (below), and the web-side analytics notes (see the notes table: they stay for a web fix or the analytics view split).

#### Differences from 01D, and why

- **One service file, not three.** 01D section 2 lists `director.service.ts`, `labHead.service.ts`, `tsg.service.ts`, and an `analytics/shared/` folder. This batch uses the same five files as every other feature, as instructed. The three dashboards share one query (the newest record per asset) only loosely, so splitting by dashboard is a later readability change, not needed for the move.
- **Analytics reads every table directly.** Its repository queries `assets`, `asset_records`, `asset_loans`, and the rest itself, rather than calling the other features' repositories: analytics is a read model across all tables (01D's "read models for the three live dashboards"), and its queries (includes, group by, aggregates) are its own.
- **The default custodian check moved, not deleted.** 01D deletes it with `DEFAULT_CUSTODIAN_ID`, which needs the session user (step 13). It moved to `server/shared/services/`, next to the custody request guard, which also calls feature repositories.
- **The startup check's query is in `auth.repository.ts`,** the owner of `users`, so the rule "only repositories import `config/prisma`" holds for the whole of `server/`.

#### Typecheck: 71 to 68

Compared after every commit, by file and message. `9265911f`: 71, the same list (the three errors left in `remainingRoutes.ts` were in old analytics code). `c5ff5d27`: **68**. The three removed errors are the three TS2339 "Property 'is_documented' does not exist" errors in `compliance` (two) and `audit-discrepancies` (one), H-12; they moved with their code into `legacy/`, which `tsconfig.json` excludes. No error was fixed and none added. `94374139`, `13c33c2c`, `1a3b3bbd`, and the comment commit: 68, the same list.

#### Verified

- After **every** commit: `npm run typecheck` (as above), `npm run build` (passes), and `npm test`: **12 files, 305 tests passed**. The 38 tests in `tests/api/analytics.test.ts` drive the eight live routes over HTTP.
- **Old against new, side by side.** `main` (in a temporary worktree) and each commit were started against the test database, seeded the same way plus extra rows (a Laguna center with no projects, a project, assets at `CITe4D`, `CAR`, the `EQ-` pool, a Manila room containing "CAR", and one with no record; warranties expired, within 90 days, and later; overdue approved and pending loans with a destination lab, returned and declined loans; a `pending_approver` transfer; a return; reports in two months; a repair with an empty status; a disposal spelled `PENDING`), and sent the same **62 requests**: every live route with its filters (no filter, "All Labs", "All Laboratories (DLSU Combined)", a lab, date ranges, unparseable dates, repeated values, `labPrefix` before `lab`, `ALL`, a padded prefix, an unknown prefix, an unknown category), all 22 old routes, `GET /api/assets`, `GET /api/asset_transfers`, and two unknown paths. Compared: status, content type, body, and the log lines each request printed.
  - `9265911f`: **60 of 62 identical**. The other two are Prisma's raw 500 text (H-16) for a repeated `lab` and an unknown `category`, which prints the source file, line, and code of the failed call; it now names `analytics.repository.ts`. Same message otherwise.
  - `c5ff5d27`: the same, except that the 22 old routes now answer 404 (`Cannot GET ...`, `text/html`), as decided.
  - `94374139` and `1a3b3bbd`: all 62 identical to the commit before. The startup lines were compared too, with the users table seeded and empty: the same "check passed" and "check failed" text as `main`. After `1a3b3bbd` the "Backup skipped" line is gone, as intended.
  - `13c33c2c` (the folds): 10 requests on `main` and on the commit (a transfer request, the same again (409), one to an unknown email, the transfer list, inspection reports by numeric id, by an unknown id, and by tag, both report lists, and the asset list): **all identical**, apart from the timestamps of the rows written. Writes started on a fresh second (M-09).
- `legacy/analytics-endpoints/analyticsEndpoints.ts` holds exactly the 1,409 lines removed from `remainingRoutes.ts` (compared line by line), behind 5 header lines.
- The comment commit changes comments only: each of the 21 changed code files compiles to the same JavaScript with comments removed (TypeScript's `removeComments`), before and after.
- `pending_registrations.json` and `.env` were not opened. The side-by-side servers ran from temporary folders on the test database.

**Not verified in the agent session:** nothing was clicked in a browser, and nothing was sent to the shared database. The hand checks below cover the browser.

#### Hand checks: passed

Raiki ran all 10 checks below and all passed (reported 2026-10-13). Notes from the run, by check number:

- **Check 6:** run in full: the transfer request and the Lab Head's approval both worked.
- **Check 9:** Raiki removed `BACKUP_DIR` from their own `.env`. **Teammates still need to do the same after pulling** (it is ignored, so leaving it does no harm, but `.env.example` no longer lists it).
- **During the checks,** two pre-existing bugs were found, neither caused by batch 4 (it changed `web/` only in two comments in `web/api/analytics.api.ts`):
  - **Issue #89:** the asset detail modal shows an old status until a reload. After a Lab Head approved a loan, My Assets showed `CITe4D-0001` as On Loan, but its modal showed Active with Request Loan. `AssetDetailModal.tsx` (line 98) prefers the shared `web/state/serverData.tsx` list, and `CustodianPortal.tsx` refreshes only its own list (`fetchDbAssets`), not `syncFromDb`. Same family as issue #57.
  - **Issue #88:** Send Inspection Report lists the custodian's assets that are under maintenance (`custodianAssets` hides only Disposed), falls back to every asset when the custodian holds none, and the server accepts a report for an asset in any status.

Both are in the notes. The list is kept for the record.

**Stop any running server and restart** (`npm run dev:all`). A server started before this batch still runs the old code (and the backup timer).

1. *Startup.* `npm run server` prints the banner and "✅ Default custodian check passed: ...", and **no** "Backup skipped" line (behavior change, F-39). If your `.env` has a `BACKUP_DIR`, no new `backup-*.json` appears in that folder; you can delete the line.
2. *Director analytics.* As Director, open the analytics view. The value, funding, location, and audit charts load with real data. Change the lab and the date range: the location chart changes; the value, funding, and pending disposal figures do not (the known defect, as before).
3. *Lab Head analytics.* As a Lab Head, open the analytics view. Loans, transfers, utilization, categories, project allocation, and the overdue list, scatter, and heatmap load. Change the lab and the dates. The terminal shows "📡 [Prisma/MySQL] /api/analytics/lab-head (prefix: ...) fetched N filtered loans from DB." each time.
4. *Staff analytics.* As Staff, open the analytics and health views. The repair board, condition summary, warranties, location distribution, status counts, and inspection progress load as before.
5. *Old endpoints gone (behavior change).* In the browser, open `http://localhost:4000/api/analytics/dashboard`: the page says "Cannot GET /api/analytics/dashboard". Open `http://localhost:4000/api/analytics/location-status`: JSON with `"success":true`.
6. *Transfer request (folded read).* As a Custodian, file a transfer on an asset On Loan to you. In `asset_transfers` the new `pending` row has your user id as `from_custodian_id`. Approve it as the Lab Head: a new ON_LOAN record under the recipient.
7. *Condition report (folded read).* As a Custodian, submit a condition report. A new `asset_reports` row, and the asset's newest record takes the condition, as before.
8. *Every role.* Log in as Staff, Lab Head, Custodian, and Director, and open each tab once. Everything loads as before.
9. *Each teammate's `.env`.* After pulling, a `BACKUP_DIR` line is ignored; remove it (`.env.example` no longer lists it).
10. *Tests.* `npm test` passes on your machine: 305 tests.

---

## Step 13 detail

Step 13 runs in three parts, each its own session, its own run on a fresh `refactor/feature-based-structure`, its own hand checks, and its own pull request (decided 2026-10-13; see the decisions table and the "Step 13 plan" paragraph in [PROMPT-2-restructure.md](PROMPT-2-restructure.md)):

- **13a:** `errorHandler` only (H-16). Done, below.
- **13b:** a real session (a signed cookie) plus `requireAuth` and `requireRole` (C-02, C-06, 01C tier 2 items 9, 10, 12). Its first commit is a route-by-route role table for Raiki to approve. Role table approved 2026-10-15 and built the same day (below); hand checks next.
- **13c:** the session user replaces the typed-name and email lookups (issue #32, H-10), `/me` stops trusting `?email=` (C-06), and `DEFAULT_CUSTODIAN_ID` goes (01C tier 2 item 11). Also, decided 2026-10-15: the server stops sending other people's names to a Custodian in the asset, loan, and transfer lists (D2; answer 1 of the 13b questions). Not started.

Password hashing (issue #10, C-03) is not part of step 13; it gets its own security branch afterward.

### 13a: errorHandler (2026-10-14)

On a fresh `refactor/feature-based-structure` from the PR #90 merge (`c8f50cfb`). Every code commit changes behavior on purpose and is labelled with `!` in its title.

| Commit | Kind | What it does |
|---|---|---|
| `4f7bd647` | Docs | The step 13 decisions in the PROMPT-2 table, and the "Step 13 plan" paragraph |
| `9c462ac9` | **Behavior change** | Adds `server/shared/middleware/errorHandler.ts` (01D section 2) and mounts it last in `server/app.ts`. A request body the parsers cannot read answers JSON instead of Express's HTML page. Adds `tests/api/errorHandler.test.ts` (4 tests) |
| `62350584` | **Behavior change** | Loans: 3 handlers stop catching their own errors |
| `45b8f107` | **Behavior change** | Returns: 2 handlers |
| `41bd744b` | **Behavior change** | Transfers: 4 handlers; 1 test updated |
| `2be1025c` | **Behavior change** | Disposals: 3 handlers |
| `9ffbb4b6` | **Behavior change** | Repairs: 4 handlers; 2 tests updated |
| `332fff11` | **Behavior change** | Inspections: 3 handlers; 1 test updated |
| `d378809d` | **Behavior change** | Auth: 7 handlers (`listPendingRegistrations` never caught anything) |
| `91baedc8` | **Behavior change** | Assets: 5 handlers; 1 test updated |
| `7f56a1f8` | **Behavior change** | Analytics: 8 handlers |
| `b72cf6c3` | Comments | `docs(step 13a): add file headers and TSDoc`: the errorHandler header and TSDoc; `AppError.ts`, `app.ts`, and the nine controller headers say errorHandler answers errors now; the nine `TODO(H-16)` lines removed; two TODOs that also named a missing check rewritten to name only the check |
| (this commit) | Docs | This log, `docs/README.md`, `docs/HANDOFF.md`, and the prompt's history line |

#### Before the first code commit: messages meant for the user

As instructed, every place where a non-AppError message reached the browser on purpose was listed before any code changed:

- **A plain `Error` thrown with a message for the user:** none on the request path. The only two are in `server/config/env.ts` and stop the server at startup.
- **AppError statuses:** only 400 (29 places), 401 (1), 404 (18), and 409 (3). None is 500.
- **Text written for the user in a 500 branch:** 25 of the 39 branches sent `error.message ||` a fallback, used only when the error's message was empty, which Prisma errors and TypeErrors never are. Nine texts: "Database execution failed." (17 places), "Registration failed.", "Failed to submit registration request.", "Failed to approve registration.", "Authentication error.", "Failed to fetch user profile.", "Failed to update account details.", "Failed to fetch custodian history.", and "Failed to save inspection report.".

The session stopped and asked. **Decided 2026-10-14 (Raiki): the generic message replaces them,** and they went with their branches. (The question in chat said 26 places; the recount is 25.)

#### What errorHandler answers

In this order:

1. **The answer is already sent** (only possible if something throws after `res.json`, such as the email sends that are not awaited): handed to Express, which closes the connection. No request in the checks reached it.
2. **An `AppError`:** its status with `{ success: false, error: message }`, as each controller wrote it before. No 400, 401, 404, or 409 changed.
3. **A body the parsers could not read** (`express.json` or `express.urlencoded`, which tag their errors with a `type`): the same status as before (400 malformed JSON, 413 over the 50 MB limit, 415 an unsupported charset) with `{ success: false, error: "The request body could not be read.", code: "BAD_REQUEST" }`. The terminal gets one line with the parser's error type and message, and not the body, which can hold a password.
4. **Express's own client errors** (an error with a 4xx status that is not a body error, for example a path parameter that cannot be decoded, `GET /api/assets/%E0%A4%A/custodian-history`, 400): handed back to Express, so they answer exactly as before. Not in the brief; handling them as "anything else" would have turned a 400 into a 500.
5. **Anything else:** `❌ <METHOD> <URL> failed:` and the whole error (Prisma's full text, or the TypeError, with its stack) in the server's terminal, and 500 with `{ success: false, error: "Something went wrong on the server. Please try again.", code: "SERVER_ERROR" }`. No database or Prisma text, no stack, no file path.

Unknown paths never reach it: they keep Express's own 404 ("Cannot GET ..."). No not-found handler was added.

#### What changed in behavior

- **Every 500 answer.** The 39 `status(500)` branches are gone; any error that is not an AppError now answers the generic body. The side-by-side runs forced 32 different 500s, at least one per feature: the TypeErrors of a request with no JSON body (20 routes, for example "Cannot destructure property 'decision' of 'req.body' as it is undefined." or "Cannot read properties of undefined (reading 'borrower')"), the TypeErrors of a repeated query value (`?lab=a&lab=b` on location status and idle time, `?labPrefix=` on the Lab Head view, `?email=` on `/me`), and Prisma's text with the server's file path and source lines (transfer accept with `TRF-1`, repair status with an unknown or non-number id, an inspection with a `reportedById` that is no account, an approval with a taken email, deleting an inspected asset (issue #69), an unknown `?category` on the loan recommender, and a repeated `?lab` on the Director view).
- **A body that cannot be read** answers JSON (400, 413, 415) instead of Express's HTML page, which showed the error's stack with the server's file paths.
- **Terminal lines.** The success lines (`🚀`, `✅`, `📋`, `📝`, `👤`, `🔧`, and the Lab Head "fetched N filtered loans") are unchanged. These feature lines are gone, replaced by errorHandler's one line, which carries the same error and its stack:

  | Feature | Lines removed |
  |---|---|
  | Loans | `❌ MySQL Loan Insertion Failed:`, `❌ MySQL Loan Decision Failed:` |
  | Returns | `❌ MySQL Return Insertion Failed:`, `❌ Failed to fetch returns:` |
  | Transfers | `❌ MySQL Transfer Insertion Failed:`, `❌ Failed to fetch transfers:`, `❌ MySQL Transfer Decision Failed:` |
  | Disposals | `❌ MySQL Disposal Insertion Failed:`, `❌ Failed to fetch disposals:`, `❌ MySQL Disposal Decision Failed:` |
  | Repairs | `❌ MySQL Repair Insertion Failed:`, `❌ Failed to fetch repairs:`, `❌ MySQL Repair Update Failed:`, `❌ Repair status update error:` |
  | Inspections | `❌ Failed to save inspection report:`, `❌ Failed to fetch asset reports:` |
  | Auth | `❌ Registration error:`, `❌ Register request error:`, `❌ Approve registration error:`, `❌ Login authentication error:`, `❌ Fetch profile error:`, `❌ Update account error:` |
  | Assets | `❌ Failed to fetch assets:`, `❌ Fetch custodian history error:`, `❌ MySQL Insertion Failed:`, `❌ MySQL Update Failed:`, `❌ MySQL Deletion Failed:` |
  | Analytics | `❌ Director analytics error:`, `❌ Lab Head analytics error:`, `❌ TSG analytics error:` |

  Nine handlers printed nothing on a failure before and now print errorHandler's line: `listLoans`, `acceptTransfer`, `listReportSummaries`, `rejectRegistration`, and the analytics idle time, idle frequency, loan recommender, location status, and inspection progress.
- **What the screens show.** No `web/` file changed. Screens that display the answer's `error` (the delete dialog, the loan, transfer, repair, return, and disposal forms, the Lab Head lists and decisions, the Director's disposal decisions, login, sign-up, and the approval alert) now show "Something went wrong on the server. Please try again." where a server failure showed the raw text. Refusals (400, 404, 409) show the same messages as before.

**Tests:** exactly five pinned the raw 500 text, the five named in the brief, recounted by search: `transfers.test.ts` (TRF-1 accept), `repairs.test.ts` (unknown id, id that is not a number), `inspections.test.ts` (unknown `reportedById`), and `assets.test.ts` (inspected asset delete). None pins a 500 body through a helper, and no test sends a repeated analytics query value or an auth request without a body. Each of the five was renamed "... a generic message and no database text ... (H-16 fixed)" and now checks the status, the generic error and code, and that the body holds no "prisma", no "Invalid `", and no file path, in the same commit as its feature. The inspection and delete tests still check that nothing was written.

#### What stayed the same, on purpose

- Every answer other than a 500 or a body error: same status, content type, and body, checked request by request (below). Unknown paths and the undecodable parameter keep Express's HTML pages.
- Each controller keeps its order: the `🚀` line is still printed before the checks, so a refused request still shows in the terminal.
- **Known defects kept** (each has a comment or `TODO` at its line, or a note below): a request with no JSON body answers 500 (now generic) rather than 400; an unknown `?category` and an unknown `reportedById` answer 500 rather than 400; deleting an inspected asset still fails (H-03, issue #69); the email lookups after a transfer or disposal answer are still not caught (an existing comment in each service).
- `web/` is untouched; the `Raw` calls in `web/api/client.ts` stay (see the notes).

#### Typecheck: 68, unchanged

Compared after every commit, by file and message: the same 68 errors. `errorHandler.ts` adds none.

#### Verified

- After **every** commit: `npm run typecheck` (68, same list), `npm run build` (passes), and `npm test`: **12 files, 305 tests passed** before `9c462ac9`, then **13 files, 309 tests passed** (the 4 errorHandler tests added) after it and every later commit.
- **Old against new, side by side.** `main` (`c8f50cfb`, in a temporary worktree) and each code commit were started against a freshly seeded local `AdRIC_DB_test` and sent the same **112 requests**: every route of the nine features with good input, refusals (400, 401, 404, 409), and forced 500s (at least one per feature, 32 in all); four bodies the parsers cannot read (malformed JSON twice, 51 MB, an unknown charset); a form-encoded login; two unknown paths (one an old analytics route); and the undecodable parameter. Compared: status, content type, body, the terminal lines each request printed, and the startup lines. Every write started on a fresh second: in one early run, two loans written in the same second came back from the Lab Head view in the other order, with the same content (M-09, a tie in `ORDER BY requested_on`). `main` against itself: identical.
  - After `9c462ac9`: the 4 body errors answer JSON with their old status; everything else identical, including the 32 raw 500s (apart from the file path in Prisma's text, worktree against repository).
  - After each feature commit: only that feature's 500s changed, cumulatively 2, 3, 7, 9, 14, 16, 24, 27, and 32. For each one, the terminal showed `❌ <METHOD> <URL> failed:` with the first line of the old answer's error text and a stack.
  - After the comment commit: **76 answers identical, 32 generic 500s, 4 JSON body errors, startup identical.** No answer with status 500 contains "prisma", "Invalid `", a drive path, or a stack frame.
- The comment commit changes comments only: each of its 15 files compiles to the same JavaScript with comments removed, before and after.
- `.env` and `pending_registrations.json` were not opened. The side-by-side servers ran from temporary folders on the test database; nothing was sent to the shared database.

**Not verified in the agent session:** nothing was clicked in a browser. The hand checks below cover it.

#### Hand checks: passed

Raiki ran all 9 checks below and all passed (reported 2026-10-15). Check 2 was run on an asset with an inspection report: the dialog showed the generic message, the asset stayed, and the terminal showed the full Prisma error. The list is kept for the record.

**Stop any running server and restart** (`npm run dev:all`). A server started before this branch still runs the old code.

1. *Startup.* `npm run server` prints the banner and "✅ Default custodian check passed: ...", as before.
2. *A forced 500: delete an inspected asset (issue #69).* As Staff, open an asset that has an inspection report (one a Custodian has sent a condition report for), choose Delete, then Permanently Delete. **Screen:** the dialog stays open and shows "⚠️ Something went wrong on the server. Please try again."; the asset is still in the inventory. Before this branch it showed Prisma's text ("Invalid `tx.assets.delete()` invocation in C:\...", "Foreign key constraint violated"). **Terminal:** "🚀 Server received delete request for <tag>", then "❌ DELETE /api/assets/<tag> failed:" followed by Prisma's full text (the `tx.assets.delete()` call, the foreign key) and a stack. The old "❌ MySQL Deletion Failed:" line no longer appears. **Optional:** in DevTools, Network tab, the request answers 500 with `{"success":false,"error":"Something went wrong on the server. Please try again.","code":"SERVER_ERROR"}`.
3. *A forced 500 from the address bar.* Open `http://localhost:4000/api/analytics/location-status?lab=a&lab=b`. **Screen:** the same JSON as in check 2. **Terminal:** "❌ GET /api/analytics/location-status?lab=a&lab=b failed: TypeError: lab.toLowerCase is not a function" and a stack.
4. *Refusals unchanged.* Log in with a wrong password: "Invalid institutional email address or password." As a Custodian, request a loan on an asset that already has a pending request (two tabs, as in step 11): "... already has a pending loan request (LOAN-n)."
5. *Success unchanged.* As a Custodian, request a loan on a free asset: the success screen; the terminal shows "🚀 Server received loan request for ..." and "✅ Loan request logged in MySQL successfully: ...". As the Lab Head, approve it: "✅ Loan #n approved successfully."
6. *A body that cannot be read (behavior change).* With the app open, open DevTools, Console, and run: `fetch("http://localhost:4000/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad" }).then(async r => console.log(r.status, await r.text()))`. **Expect** `400 {"success":false,"error":"The request body could not be read.","code":"BAD_REQUEST"}`; before this branch it was an HTML page with a stack. **Terminal:** "⚠️ POST /api/auth/login: request body could not be read (entity.parse.failed): ...".
7. *Unknown path unchanged.* Open `http://localhost:4000/api/nope`: the page says "Cannot GET /api/nope", as before.
8. *Every role.* Log in as Staff, Lab Head, Custodian, and Director, and open each tab once. Everything loads as before.
9. *Tests.* `npm test` passes on your machine: **309 tests** (305 plus the 4 errorHandler tests).

#### Left for 13b, 13c, and later

- **13b** can refuse with `AppError(401)` or `AppError(403)` from `requireAuth` and `requireRole`: errorHandler already answers any AppError, so no new error path is needed.
- **13c** is unaffected by 13a.
- **Not in 13b or 13c; noted for later; when is not decided yet:** the web side of H-16 (typed errors in `web/api/client.ts`, then removing the `Raw` calls), a 400 for a missing body, and JSON for Express's own 404 and 400 pages. See the notes.

### 13b: session, requireAuth, requireRole

**Stop 1 of 2: the route role table, proposed and approved 2026-10-15.** On a fresh `refactor/feature-based-structure` from the PR #91 merge (`2c107afc`). Stop 1 wrote no code (`50889595`). Raiki answered the twelve questions the same day; the table below shows the **approved** roles, and each answer is recorded under its question. Stop 2 builds it.

What 13b does (decided 2026-10-13, PROMPT-2 decisions table): login issues a signed cookie holding the user id and an expiry (HMAC from Node's built-in `crypto`, `HttpOnly`, `SameSite=Lax`, no `Secure` until HTTPS, 8 hours); a new `POST /api/auth/logout` clears it and keeps it on an in-memory "logged out" list until it would have expired; every route except the three public ones needs a session; CORS answers only `WEB_ORIGIN`, with credentials; `requireAuth` and `requireRole` throw `AppError(401)` and `AppError(403)`, which 13a's errorHandler already answers. New `.env` variables: `SESSION_SECRET` (required) and `WEB_ORIGIN` (default `http://localhost:5173`). No cookie-parser (dependencies are frozen): a small helper of ours reads the `Cookie` header.

**Not in 13b (13c):** the session user replacing typed names (issue #32, H-10), `/me` no longer trusting `?email=` (C-06), and `DEFAULT_CUSTODIAN_ID`. **In 13b, `GET /api/auth/me` needs a session but still reads `?email=`**, so a signed-in person can still read another account's profile by changing the email in the URL until 13c. Likewise `PUT /api/auth/account` still updates the account named by the email in the body. Password hashing (issue #10) is not in step 13. The `session_user_email` cookie the web writes today stays until 13c, for display only; the server never reads it.

#### How the checks work (accepted 2026-10-15 as proposed)

- **Roles are app roles.** `requireRole` checks the app role (`Staff`, `LabHead`, `Custodian`, `AdRICDirector`), worked out from the account's database roles by the same `appRoleFor` mapping login and `/me` use today. So `ADMIN`, `ADRIC_SECRETARY`, `ITS_STAFF`, and `TSG_STAFF` accounts all pass a `Staff` check (question 4).
- **The role is read from the database, not kept in the cookie.** The cookie holds only the user id and the expiry, as decided. `requireAuth` reads that account and its roles by id. As first built, that was one more query on every request; after the hand checks the lookup is kept per cookie for 60 seconds (`128896fb`), so a removed account or a changed role takes effect within 60 seconds. The signature, expiry, and logged-out checks still run on every request.
- **Route by route, not app-wide.** `requireAuth` and `requireRole` go on each route in its feature's `routes.ts` (`router.get(path, requireAuth, requireRole(...), handler)`), not as one `app.use`. Because all nine routers are mounted at the root, an app-wide or router-wide check would also answer 401 for unknown paths and for login itself. Route by route, an unknown path keeps Express's 404, and the two answers that come before any route middleware keep coming first: a body the parsers cannot read (400, 413, 415, the app-level `express.json`) and a path parameter that cannot be decoded (400, during route matching).
- **Role only, no record checks.** Where 01C section 4 says "own lab only", "of the asset's lab", "as themselves", "current custodian only", or "participants", 13b checks the role and nothing more. Those need the session user (13c) or lab scoping (01C tier 3 item 21). Question 11 asks to confirm.

#### Route role table

All 40 registered routes (`server/features/*/*.routes.ts`, read 2026-10-15), plus the new logout route. Roles: **S** Staff, **L** Lab Head, **C** Custodian, **D** Director, **Any** all four. **Public** marks the three routes that need no session. "Screen callers" means 01C section 4 says nothing for the route, or says less than what live screens need; every such row is also a question below.

Two callers reach most lists for every role: `web/state/serverData.tsx` loads assets, transfers, report summaries, loans, disposals, and repairs once when the app starts (and on every `syncFromDb()`), and pending sign-ups once; the bell (`web/features/notifications/NotificationCenter.tsx`, every signed-in screen) reads those lists for all four roles.

| # | Method | Path | `web/` callers (file: screen, role) | Proposed | Source |
|---|---|---|---|---|---|
| 1 | POST | `/api/auth/login` | `pages/auth/Login.tsx`: login page, a visitor | **Public** | 01C 4.1 |
| 2 | POST | `/api/auth/register-request` | `pages/auth/Register.tsx`: sign-up page, a visitor | **Public** | 01C 4.1 |
| 3 | GET | `/api/auth/pending-registrations` | `state/serverData.tsx` (loaded at app start for everyone); read by `pages/lab-head/LabHeadDashboard.tsx`: Approvals tab, L | L | 01C 4.1 (own lab: not in 13b) |
| 4 | POST | `/api/auth/approve-registration` | `state/serverData.tsx` `approveRegistration`, from `LabHeadDashboard.tsx`: Approvals tab, L | L | 01C 4.1 (own lab: not in 13b) |
| 5 | POST | `/api/auth/reject-registration` | `state/serverData.tsx` `rejectRegistration`, from `LabHeadDashboard.tsx`: Approvals tab, L | L | 01C 4.1 (own lab: not in 13b) |
| 6 | GET | `/api/auth/me` | `state/session.tsx`: every page load with the display cookies, and after login, all roles; `pages/AccountDetailsPage.tsx`: Account page, all roles | Any (still reads `?email=` until 13c) | 01C 4.1 |
| 7 | PUT | `/api/auth/account` | `state/session.tsx` `updateProfile`, from `AccountDetailsPage.tsx`: Account page, all roles | Any (still trusts the body's email until 13c) | 01C 4.1 |
| 8 | POST | `/api/auth/register` | none (issue #70) | L (answer 5: stays registered until issue #70 deletes it) | 01C 4.1 says n/a (dead); L by analogy with row 4 |
| 9 | GET | `/api/assets` | `state/serverData.tsx` (all roles, every reload); `features/assets/useStaffAssets.ts`: Staff Overview, Inventory, Inspections, Returns, QR Tags, S; `features/analytics/staff/StaffAnalyticsView.tsx`: Staff Health, S; `pages/custodian/CustodianPortal.tsx`: My Assets, Available, Report, C; `LabHeadDashboard.tsx`: Inventory, L; `pages/director/AdRICDirectorDashboard.tsx`: Director tabs, D | Any | 01C 4.2 |
| 10 | GET | `/api/assets/:assetTag/custodian-history` | `features/assets/AssetDetailModal.tsx`, when it opens and from the Lab Head's Custodian History button: Staff Inventory (S), Custodian My Assets and Available (C), Lab Head Inventory (L) | Any | 01C 4.2 |
| 11 | POST | `/api/assets` | `features/assets/IntakeWizard.tsx`: Staff Register, S | S | 01C 4.2 (ITS, TSG) |
| 12 | PUT | `/api/assets/:assetTag` | `features/assets/EditAssetDialog.tsx`: Staff Inventory, S | S | 01C 4.2 (ITS, TSG) |
| 13 | DELETE | `/api/assets/:assetTag` | `features/assets/DeleteAssetDialog.tsx`: Staff Inventory, S | S (answer 8: any Staff account until issue #41 is decided) | 01C 4.2 says "ITS only, arguably nobody"; screen callers |
| 14 | POST | `/api/assets/:assetTag/disposal` | `features/disposals/DisposalFormDialog.tsx`: Staff Inventory, S | S | 01C 4.3 (ITS, TSG) |
| 15 | GET | `/api/asset_disposals` | `state/serverData.tsx` (all roles); bell disposal cards for D, S, L; `features/analytics/director/DirectorAnalyticsView.tsx`: Director Analytics, D; `AdRICDirectorDashboard.tsx`: Clearance and Disposal, D | S, D, L (answer 6) | 01C 4.3 (Director, ITS, TSG); L from screen callers |
| 16 | PUT | `/api/asset_disposals/:disposalId/decision` | `AdRICDirectorDashboard.tsx`: Clearance and Disposal, D; bell Authorize and Reject, D only | D | 01C 4.3 |
| 17 | POST | `/api/assets/:assetTag/inspection` | `CustodianPortal.tsx`: Report tab, C; `features/inspections/InspectionQueue.tsx`: Staff Inspections, S | C, S | 01C 4.2 (Custodian, ITS, TSG) |
| 18 | GET | `/api/asset_reports` | `state/serverData.tsx` (all roles); read only by `DirectorAnalyticsView.tsx`: Director Analytics (audit compliance), D | S, D (answer 6) | 01C 4.2 (ITS, TSG); D from screen callers |
| 19 | GET | `/api/asset-reports` | `features/inspections/useInspectionReports.ts`: Staff Inspections (the log), S | S | 01C 4.2 (ITS, TSG) |
| 20 | GET | `/api/asset_loans` | `state/serverData.tsx` (all roles); bell loan cards for all four; `AssetDetailModal.tsx` pending-request tile, C, S, L; `DirectorAnalyticsView.tsx`, D; `LabHeadDashboard.tsx`: Custody, L | Any (answer 1) | 01C 4.3 (Lab Head, ITS, TSG); C and D from screen callers |
| 21 | POST | `/api/assets/:assetTag/borrow` | `features/loans/LoanForm.tsx`, from the asset modal: Custodian, C | C | 01C 4.3 ("as themselves": 13c) |
| 22 | PUT | `/api/asset_loans/:loanId/decision` | `LabHeadDashboard.tsx`: Custody, L; `features/analytics/labHead/LabHeadAnalyticsView.tsx`: Lab Head Health, L; `state/serverData.tsx` `authorizeLoan`, from the bell's Approve, **L and S** | L (answer 7: the bell's Approve is hidden for Staff) | 01C 4.3 ("of the asset's lab": not in 13b) |
| 23 | POST | `/api/assets/:assetTag/repair` | `features/repairs/RepairForm.tsx`: asset modal, C; `features/returns/ReturnForm.tsx` "flag for repair": asset modal, C; `state/serverData.tsx` `addRepairRequest`, from `AssetDetailModal.tsx` Send to Maintenance (S) and the `CustodianPortal.tsx` condition report (C) | C, L, S | 01C 4.3 (Custodian, Lab Head, TSG, ITS) |
| 24 | GET | `/api/asset_repairs` | `state/serverData.tsx` (all roles); bell repair cards for S, D, and the Custodian's own; Sidebar unacknowledged count; `LabHeadDashboard.tsx` branch repairs, L; `AdRICDirectorDashboard.tsx` asset audit, D; `features/repairs/useRepairTickets.ts`: Staff Overview and Repairs, S | Any (answer 6) | 01C 4.3 (TSG, ITS); L, C, D from screen callers |
| 25 | PUT | `/api/asset_repairs/:repairId` | `useRepairTickets.ts`: Staff Overview and Repairs, S; `state/serverData.tsx` `acknowledgeRepair` and `updateRepairStatus`, from the bell (S only) and the repair dialog, S | S | 01C 4.3 (TSG, ITS) |
| 26 | PUT | `/api/asset_repairs/:repairId/status` | `StaffAnalyticsView.tsx`: Staff Health (repair board), S | S | 01C 4.3 (TSG, ITS) |
| 27 | POST | `/api/assets/:assetTag/return` | `ReturnForm.tsx`, Staff branch: Staff Returns, S | S | 01C 4.3 (TSG, ITS) |
| 28 | GET | `/api/asset_returns` | none | S | 01C 4.3 (TSG, ITS; dead) |
| 29 | POST | `/api/assets/:assetTag/transfer` | `features/transfers/TransferForm.tsx`, from the asset modal: Custodian, C | C | 01C 4.3 ("current custodian only": 13c) |
| 30 | GET | `/api/asset_transfers` | `state/serverData.tsx` (all roles); bell transfer cards for all four; `AssetDetailModal.tsx` pending-request tile, C, S, L; `DirectorAnalyticsView.tsx` transfer chart, D; `LabHeadDashboard.tsx`: Custody, L | Any (answer 1) | 01C 4.3 (Lab Head, participants); S and D from screen callers |
| 31 | PUT | `/api/asset_transfers/:transferId/decision` | `LabHeadDashboard.tsx`: Custody, L; `LabHeadAnalyticsView.tsx`: Lab Head Health, L; bell Approve and Decline, L only | L | 01C 4.3 says "recipient, or Lab Head (undecided)"; the 2026-10-04 transfer decision keeps today's behavior, where only the Lab Head decides |
| 32 | PUT | `/api/asset_transfers/:transferId/accept` | none (dead, M-12) | C (answer 9) | 01C 4.3 (recipient) |
| 33 | GET | `/api/analytics/director` | `DirectorAnalyticsView.tsx`: Director Analytics, D | D | 01C 4.4 (role dashboards: the matching role) |
| 34 | GET | `/api/analytics/lab-head` | `LabHeadAnalyticsView.tsx` (five widgets): Lab Head Health, L | L | 01C 4.4 (the matching role; the lab still comes from the query) |
| 35 | GET | `/api/analytics/tsg` | `StaffAnalyticsView.tsx`: Staff Health, S | S | 01C 4.4 (the matching role) |
| 36 | GET | `/api/analytics/location-status` | `StaffAnalyticsView.tsx`: Staff Health, S | S (answer 3) | Narrower than 01C 4.4 ("everything else: signed-in roles"), matches the callers |
| 37 | GET | `/api/analytics/advanced/inspection-progress` | `StaffAnalyticsView.tsx`: Staff Health, S | S (answer 3) | Narrower than 01C 4.4 (signed-in roles), matches the callers |
| 38 | GET | `/api/analytics/advanced/idle-time` | none live (only `legacy/analytics-widgets/LabHeadWidgets.tsx`) | L (answer 3; still registered, 2026-10-07 decision) | Narrower than 01C 4.4 (signed-in roles), matches the callers |
| 39 | GET | `/api/analytics/advanced/idle-frequency` | none live (only `legacy/analytics-widgets/`) | L (answer 3; still registered) | Narrower than 01C 4.4 (signed-in roles), matches the callers |
| 40 | GET | `/api/analytics/advanced/loan-recommender` | none live (only `legacy/analytics-widgets/`) | L (answer 3; still registered) | Narrower than 01C 4.4 (signed-in roles), matches the callers |
| new | POST | `/api/auth/logout` | `state/session.tsx` `setRole(null)`, from the Sidebar's logout button (after the stop 2 web change), all roles | **Public** | 2026-10-13 decision |

**Routes per role, as approved:** Staff 23, Lab Head 19, Custodian 12, Director 11; 7 of them open to any signed-in role (rows 6, 7, 9, 10, 20, 24, 30). Public: 3 (login, the sign-up request, logout). The other 38 of today's 40 routes need a session.

**Where the proposal is wider than 01C, and why.** Rows 15, 18, 20, 24, and 30 give a list to a role 01C leaves out, because a live screen of that role reads the list today (mostly the bell and `serverData.tsx`). Following 01C exactly would turn those screens empty or wrong without telling anyone; narrowing them is a web change too (answer 6 kept the screen callers). **Narrower than 01C:** rows 36 to 40, where 01C says "signed-in roles": 36 and 37 go to Staff, their only callers (Staff Health), and 38 to 40 to the Lab Head, the role of the legacy widgets that call them (answer 3).

**Where the table changes a screen.** Row 22: the bell offers Staff an Approve button on loan cards. With L only, Staff pressing it would get a 403 and the card would stay, so the stop 2 web commit hides that button for Staff (answer 7, a labelled behavior change).

#### Questions for Raiki, and the answers (2026-10-15)

1. **`GET /api/assets`, `GET /api/asset_loans`, `GET /api/asset_transfers` (D2).** All three send other people's names to whoever calls them: loans send each borrower's name, transfers each from and to name, and the asset list each asset's custodian, every record's custodian, every transfer's from and to, every report's reporter, and who decommissioned it. Every role's screens read them (the bell's own-request cards and the Custodian's "Your request is pending" tile need loans and transfers). Options: (a) any signed-in role, names as today (proposed for 13b: only anonymous callers lose access); (b) any signed-in role, but the server removes other people's names for a Custodian, which needs the session user and fits 13c; (c) 01C's narrow lists (Lab Head and Staff, plus participants), which needs a new "my requests" source for the Custodian's bell and tile. **Recommendation: (a) now, (b) in 13c.** The same question for row 10, the custodian history, which sends every holder's email and id number (issue #72): proposed any signed-in role, per 01C.
   **Answer:** (a) for 13b, names as today; (b) goes to 13c (recorded in the 13c line at the top of the step 13 detail). Row 10: any signed-in role.
2. **Sign-ups (rows 3 to 5).** Proposed: Lab Head only, as 01C says. Should the Director, Staff, or the future Admin role also list, approve, or reject? "Own lab only" is not checked in 13b: the pending list is a file, and scoping it needs the session user's lab (13c or later). `requireRole` limits who receives the list; it does not stop the list sending each applicant's password (C-04, issue #72).
   **Answer:** Lab Head only.
3. **Analytics, route by route.** Proposed: `director` Director only; `lab-head` Lab Head only (it sends every borrower's name and email for the lab in the query; should the Director read it too?); `tsg` Staff only; `location-status` and `inspection-progress` any signed-in role per 01C, though only Staff Health calls them (Staff only instead?); `idle-time`, `idle-frequency`, `loan-recommender` any signed-in role per 01C, though nothing live calls them (Lab Head only, the role of their legacy widgets? or keep them for a later unregister decision?).
   **Answer:** `director` Director only; `lab-head` Lab Head only; `tsg`, `location-status`, `inspection-progress` Staff only (their only callers are Staff Health); `idle-time`, `idle-frequency`, `loan-recommender` Lab Head only, still registered (2026-10-07 decision).
4. **`ADMIN` and `ADRIC_SECRETARY` accounts.** Both map to `Staff` today (`appRoleFor`, with unit ITS) and reach the Staff dashboard. Proposed for 13b: they pass every `Staff` check and nothing else, exactly what their screens allow today, with no new role. The Admin app role comes after step 13; the Secretary gets the Director view on the ITS removal branch (whether it may approve and sign off is still open). Confirm that 13b changes neither.
   **Answer:** confirmed. They pass Staff checks only; no new role in 13b.
5. **`POST /api/auth/register` (issue #70).** Nothing calls it, and it creates an account with no approval. Options: (a) keep it registered, Lab Head only (proposed in the table, the same right as approving a sign-up), and delete it with #70 later; (b) delete it with #70 in its own commit before the enforcement commit (it answers 404; `tests/api/registration.test.ts` loses its direct-registration tests). Which?
   **Answer:** (a). It stays registered, Lab Head only, until issue #70 deletes it.
6. **Lists 01C gives to fewer roles than the screens use.** `GET /api/asset_repairs` (01C: Staff; read by all four), `GET /api/asset_disposals` (01C: Director and Staff; the Lab Head's bell shows disposal cards), `GET /api/asset_reports` (01C: Staff; only the Director's analytics reads it, and no Staff screen). Proposed: the screen callers, so no screen changes. Confirm, or name the ones to narrow (each narrowing also removes or hides what that role's screen shows).
   **Answer:** confirmed. Rows 15, 18, 20, 24, 30 follow the screen callers, so no screen changes.
7. **Loan decisions by Staff (row 22).** The bell shows Approve on loan cards for the Lab Head and for Staff; 01C says Lab Head. Proposed: Lab Head only, and the stop 2 web commit hides the bell button for Staff (a labelled behavior change). Or allow Staff too?
   **Answer:** Lab Head only; the web commit hides the bell's loan Approve button for Staff (labelled behavior change).
8. **Deleting an asset (row 13).** 01C: "ITS only, arguably nobody". ITS is being removed and issue #41 (TSG or Admin) is open. Proposed: any Staff account, as the screens allow today, until #41 is decided.
   **Answer:** any Staff account, until issue #41 (which Staff unit, or a future Admin, may delete) is decided.
9. **The two dead routes.** `PUT /api/asset_transfers/:id/accept` would stall a transfer for good (M-12); proposed Custodian per 01C (any Custodian, since "the recipient" needs 13c). `GET /api/asset_returns`: proposed Staff. Or leave both for a later unregister decision, as with the analytics ones?
   **Answer:** as proposed (accept: Custodian; `GET /api/asset_returns`: Staff). Unregistering them waits for issue #70 or later.
10. **Calls made before login** (next section). Proposed: none of them becomes public; the shared lists load after login instead (a web change). Confirm.
    **Answer:** confirmed. No new public routes; the shared lists load after login.
11. **Record-level checks.** Confirm that 13b checks roles only, and that "own lab", "of the asset's lab", "as themselves", "current custodian", and "participants" wait for 13c (the session user) or later (01C tier 3 item 21).
    **Answer:** confirmed. Role checks only in 13b.
12. **Issue #49** (see "Web changes"): fix it inside 13b's web commit, or keep it on its own branch?
    **Answer:** fix it inside 13b, as its own commit right after the web changes commit: a "restoring" state in `session.tsx` that `RootLayout` waits for instead of redirecting.

#### Pages and API calls before login

**Pages that work before login** (`web/app/routes.tsx`): `/login` (`Login`) and `/register` (`Register`) sit outside `RootLayout`, as does the not-found page (`*`). `/its/*` and `/tsg/*` only redirect to `/staff/...`, where `RootLayout` sends anyone without a role to `/login`. Every other page is inside `RootLayout`.

**API calls reachable before login:**

| Call | Where | Public? |
|---|---|---|
| `POST /api/auth/login` | `Login.tsx`, the sign-in button | Yes |
| `POST /api/auth/register-request` | `Register.tsx`, the sign-up button | Yes |
| `GET /api/assets`, `/api/asset_transfers`, `/api/asset_reports`, `/api/asset_loans`, `/api/asset_disposals`, `/api/asset_repairs` | `state/serverData.tsx` `syncFromDb()`, once when the app first mounts. `ServerDataProvider` wraps the whole router (`web/app/App.tsx`), so these six run on `/login`, `/register`, and the not-found page too, logged in or not | **No: question 10** |
| `GET /api/auth/pending-registrations` | `state/serverData.tsx`, once when the app first mounts, same as above | **No: question 10** |
| `GET /api/auth/me?email=` | `state/session.tsx`, on a page load when the three display cookies are present (a returning user). This is the session check itself: with 13b it answers 401 when the session cookie is missing or expired, and the page treats that as logged out | No, by design |

Nothing else: `Register.tsx`'s `addPendingRegistration` only adds to the in-memory list, and `state/browserOnly.tsx` reads localStorage.

**Why the first-mount loads matter beyond privacy.** `Login.tsx` never calls `syncFromDb()`. After login, every dashboard shows the lists loaded on the login page (before 13b, the real data, because the server checked nothing). With 13b those first-mount requests answer 401, each list stays empty, and nothing reloads them until some form is saved. So moving the loads after login is required for the app to work, not only to keep data private.

#### Tests that will need a session

**Counted, not estimated:** the suite was run once (309 passed) with a scratch setup file kept outside the repository that recorded every request each test sent, and each request was matched against the 40 routes. **281 of the 309 tests call a route that will need a session.**

| File | Tests | Call a route that will need a session | Do not |
|---|---|---|---|
| `tests/api/analytics.test.ts` | 38 | 38 | 0 |
| `tests/api/assets.test.ts` | 33 | 33 | 0 |
| `tests/api/auth.test.ts` | 33 | 20 | 13 (login only) |
| `tests/api/disposals.test.ts` | 25 | 25 | 0 |
| `tests/api/errorHandler.test.ts` | 4 | 2 (see below) | 2 (a bad body to login; an unknown path) |
| `tests/api/inspections.test.ts` | 29 | 29 | 0 |
| `tests/api/loans.test.ts` | 31 | 31 | 0 |
| `tests/api/registration.test.ts` | 22 | 17 | 5 (sign-up request only) |
| `tests/api/repairs.test.ts` | 36 | 36 | 0 |
| `tests/api/returns.test.ts` | 16 | 16 | 0 |
| `tests/api/smoke.test.ts` | 3 | 2 | 1 (login only) |
| `tests/api/transfers.test.ts` | 32 | 32 | 0 |
| `tests/setup/guard.test.ts` | 7 | 0 | 7 (no request) |
| **Total** | **309** | **281** | **28** |

The two errorHandler tests counted (a 51 MB body to `POST /api/assets`, and the undecodable parameter on the custodian history) get their answer before any route middleware runs (above), so they will pass without a cookie. They stay without one on purpose, as a check of that order. That leaves **279 tests to change**. The harness's startup probe (`GET /api/auth/me`, 39 requests in the run, outside any test) will answer 401 instead of 400; it waits for any answer, so it keeps working, and its comment is updated.

**The harness login helper (planned).**

- **Where:** `tests/setup/harness.ts`. `useApiHarness()` keeps `api` exactly as it is, sending no cookie (for the 28 tests above and the new 401 tests), and gains `as(user)`, which returns an `ApiClient` with the same `get`, `post`, `put`, and `delete` that sends that user's session.
- **How it logs in:** on the first request through `as(user)` in a file, it sends `POST /api/auth/login` with the fixture's email and password, as the web app does, and keeps the cookie from the answer's `Set-Cookie` header (`response.headers.getSetCookie()`, only the `name=value` part). One login per user per file, cached for the file; each file starts its own server, so a cookie never crosses files.
- **How the cookie is sent:** Node's `fetch` keeps no cookies, so the client adds a `Cookie: <name>=<value>` header to each request by hand.
- **Fixture account per role** (all already in `tests/setup/fixtures.ts`): Staff `USERS.staffTsg` (`TSG_STAFF`, since Staff will be TSG only); Lab Head `USERS.labHead`; Custodian `USERS.custodianA`, and `USERS.custodianB` where a test needs a second custodian; Director `USERS.director`. `USERS.admin`, `USERS.staffIts`, and `USERS.secretary` only in the tests about those accounts (each passes a Staff check).
- **Which account each request uses:** the role the approved table gives that route. Each test file names its clients once at the top (for example `const asStaff = as(USERS.staffTsg)`), and each call uses the right one. Request bodies do not change: the typed names still decide who did what until 13c, so the three tests that pin the typed-name lookup stay as they are.
- **Environment:** `buildServerEnv` (`tests/setup/testServer.ts`) sets `SESSION_SECRET` to a test-only value made once per run, and `WEB_ORIGIN`. The new session tests use the same value to sign an expired cookie and to tamper with one. `tests/setup/guard.test.ts` checks the two variables are set.

#### Web changes 13b needs

1. **`web/api/client.ts`: `credentials: "include"`** on its four `fetch` calls (`apiGet`, `sendRaw`, `apiDelete`, `apiGetRaw`; the other functions go through these). Without it the browser neither sends the cookie nor stores the one login sets, because the API is on another origin (port 4000).
2. **Logout calls the server.** `web/api/auth.api.ts` gains `logout()` (`POST /api/auth/logout`). `state/session.tsx` `setRole(null)`, which the Sidebar's logout button reaches through `RootLayout`, calls it first (a failure does not stop the local logout), then clears the display cookies as today.
3. **What the app does on a 401.** `client.ts` tells the session when any answer is 401, Raw calls included, **except the login call**, which answers 401 for a wrong password and must keep showing its message. The session then clears the role, the user, and the display cookies, and `RootLayout` sends the person to `/login` (optionally with "Your session has ended. Please log in again."). A **403** logs no one out: the answer still carries `{ success: false, error }`, and screens show it where they show errors today.
4. **The shared lists load after login.** `state/serverData.tsx` stops loading on first mount: it loads when a role is set (after login, and after a page load restores the session), reloads when the role changes, and empties its lists on logout, so the next person in the same tab never sees the last person's lists. Pending sign-ups load only for a role allowed to read them. `serverData.tsx` also skips the lists the role may not read (report summaries for a Lab Head or Custodian, disposals for a Custodian), instead of collecting 403s.
5. **Session restore treats a 401 as logged out.** `state/session.tsx` still decides whether to call `/me?email=` from the display cookies (13c changes that). A 401 now means the server session is gone or expired: the display cookies are cleared (today they are left in place). The client's own 24-hour and 30-day checks stay as they are; the server's 8 hours ends a session first.
6. **The bell's loan Approve for Staff** is hidden (answer 7, a labelled behavior change).
7. **Comments:** the `TODO(C-02)` in `RootLayout.tsx` and the `TODO(C-06)` lines in `Login.tsx` and `session.tsx` are rewritten to say what is true after 13b: the server now checks the session and the role; the email cookie is for display and `/me?email=` waits for 13c.

**One thing to know when testing by hand:** open the web app at `http://localhost:5173`, the same host name as the API's `http://localhost:4000`. `localhost` on two ports is one site, so the `SameSite=Lax` cookie is sent; `127.0.0.1:5173` against `localhost:4000` is a different site, the cookie is not sent, and its origin also fails the CORS check.

**Issue #49 and the new cookie.** The cause of #49 is in the web app: `RootLayout` sends anyone whose role is `null` to `/login`, and after a reload or a typed URL the role is `null` until `session.tsx`'s `/me` call answers, so the redirect always wins. The new cookie does not cause or fix that: it is `HttpOnly` with an 8-hour lifetime, so it survives a reload and a typed URL and the server would accept the `/me` call, but the page has already moved to `/login`. Logging in again issues a second cookie; the first stays valid until it expires (it was never logged out). What 13b changes is that the fix is now worth making: a "restoring" state in `session.tsx` that `RootLayout` waits for, instead of redirecting, is a small web change, and with a signed cookie behind it a restored session is a real one. Without that fix, 13b's hand checks still cannot check "a reload keeps you logged in", only "logging in again works" and "a 401 sends you to login". **Decided (answer 12): 13b fixes #49, in its own commit after the web changes.**

#### Stop 2 plan

The commits after approval, in order. **One change from the suggested order, and why:** CORS and the web changes come before the enforcement commit instead of after it. Today's `cors()` answers every origin with `*`, and a browser refuses a credentialed answer that says `*`; so `credentials: "include"` must land with or after CORS for `WEB_ORIGIN`. And with the web changes in place first, every commit leaves the app usable in a browser: the enforcement commit is the only one that turns refusals on, and a hand check or a bisect works at any commit. The new tests stay after enforcement, as suggested.

`npm run typecheck` (68), `npm run build`, and `npm test` after every commit.

1. **`feat(step 13b)!`: the session helper and the two `.env` variables.** `server/shared/session.ts` (sign and verify with HMAC, read the `Cookie` header, the logged-out list) and `server/config/env.ts`: `SESSION_SECRET` required (the server stops at startup without it, like the `DATABASE_` ones), `WEB_ORIGIN` defaulting to `http://localhost:5173`. `.env.example` gains both names. The harness sets both. Labelled a behavior change because a server without `SESSION_SECRET` no longer starts. **Human step before pulling:** add `SESSION_SECRET` to `.env` (a long random value; the stop 2 report gives a one-line command to make one).
2. **`feat(step 13b)!`: login issues the cookie; `POST /api/auth/logout`.** The login answer's body is unchanged; it gains the `Set-Cookie` header (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=28800`, no `Secure`). Logout is public, clears the cookie, and lists it until it would have expired. Nothing is enforced.
3. **`test(step 13b)`: the harness login helper, every test logging in.** `as(user)` as described above; the 279 tests send the session of the role the approved table gives each route. All 309 still pass; nothing is enforced yet.
4. **`feat(step 13b)!`: CORS for `WEB_ORIGIN`, with credentials.** `cors({ origin: WEB_ORIGIN, credentials: true })` in `server/app.ts`. Another origin's browser requests get no CORS headers; requests with no `Origin` (curl, the tests) are unaffected.
5. **`feat(step 13b)!`: the web changes** (list above): credentials, logout, the 401 handling, the shared lists after login, the restore, and the bell's Staff loan button. Still nothing enforced, so the app works as before.
6. **`fix(step 13b)!`: a reload or typed URL keeps you logged in (issue #49).** A "restoring" state in `session.tsx` that `RootLayout` waits for instead of redirecting. Closes #49.
7. **`feat(step 13b)!`: `requireAuth` and `requireRole` on every route, per the approved table.** First a commit adding the two middleware files (`server/shared/middleware/requireAuth.ts`, `requireRole.ts`), used by nothing yet; then one commit per feature, nine in all, as 13a did with errorHandler, so each feature's routes can be checked against its rows and reverted alone. All 309 still pass after each.
8. **`test(step 13b)`: the new tests.** 401 with no cookie, a tampered cookie, an expired cookie, and a cookie after logout; 403 for a role a route does not allow; the CORS answer for `WEB_ORIGIN` and for another origin; the cookie's attributes on login; logout working without a session; and the server refusing to start without `SESSION_SECRET`. The 401 and 403 checks run over every protected route from the table, so the count is given in the stop 2 report.
9. **`docs(step 13b)`: file headers and TSDoc** for the new files, and the `TODO(C-02)` and `TODO(C-06)` lines rewritten to match.
10. **`docs(step 13b)`: the log and housekeeping:** this log, `docs/README.md`, `docs/HANDOFF.md`, the prompt's history line, and the hand checks list.

#### Stop 2: what was built (2026-10-15)

On the same branch, after Raiki's approval. Every code commit that changes behavior has `!` in its title.

| Commit | Kind | What it does |
|---|---|---|
| `b4c83a76` | Docs | The approved role table and the twelve answers |
| `fab7825a` | **Behavior change** | `server/shared/services/session.ts` (sign and check the token, read the Cookie header, the Set-Cookie values, the logged-out list); `SESSION_SECRET` required (at least 32 characters) and `WEB_ORIGIN` (default `http://localhost:5173`) in `server/config/env.ts` and `.env.example`; the test harness gives each test server its own secret |
| `e3309f04` | **Behavior change** | Login also answers `Set-Cookie: adric_session=...; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`; new public `POST /api/auth/logout` |
| `076490b7` | Tests | `as(user)` in the harness; every test request to a protected route sends a role the table allows (all 309 pass, nothing enforced) |
| `b8dac95c` | **Behavior change** | CORS answers only `WEB_ORIGIN`, with credentials |
| `3f10cb28` | **Behavior change** | Web: `credentials: "include"`, logout on the server, a 401 logs the person out (with a notice on the login page), the shared lists load after login and only for the roles that may read them, the bell's Authorize Loan hidden for Staff |
| `8965f432` | **Behavior change** | Issue #49 fixed: a reload or typed URL keeps you logged in |
| `de4fff7c` | Addition | `requireAuth` and `requireRole`, mounted nowhere yet |
| `15814e51`, `0210a0ed`, `9c7d348d`, `230e4a6e`, `c686cff4`, `45f4b78e`, `7e76edb3`, `4fe82233`, `680cd60a` | **Behavior change** (9) | One feature per commit, in 13a's order (loans, returns, transfers, disposals, repairs, inspections, auth, assets, analytics): every route gets `requireAuth`, and `requireRole` where the table names roles |
| `a984ffb2` | **Behavior change** | Every login gets its own token (a random nonce), found by the new tests: see "Differences from the plan" |
| `68b5e20b` | Tests | `tests/api/session.test.ts` (62 tests) and one guard test: 372 |
| `50f33ac3` | Comments | `docs(step 13b): add file headers and TSDoc` |
| (this commit) | Docs | This log, `docs/README.md`, `docs/HANDOFF.md`, the prompt's history line and session decision row, `tests/README.md` |

#### Differences from the plan, and why

1. **Order:** CORS and the web changes before enforcement, as approved, and the issue #49 fix right after the web changes, as asked.
2. **A fix commit the plan did not have (`a984ffb2`).** The first version of the token was `<user id>.<expiry second>.<signature>`. The new logout tests failed: two logins of the same user in the same second got the identical token, so logging out and straight back in got back the token logout had just listed (401 at once), and logging out in one tab ended a second tab's session from that same second. The token now carries 16 random bytes: `<user id>.<expiry>.<nonce>.<signature>`. Its own labelled commit, before the tests that pin it. The 2026-10-13 decision ("a signed cookie holding the user id and an expiry") still holds; the nonce is an addition, recorded in the PROMPT-2 decision row.
3. **`SESSION_SECRET` must be at least 32 characters.** Not in the decision: a short secret can be guessed, and a guessed secret signs a session for any account, the Director's included. The startup message gives the command to make one.
4. **The enforcement commits changed no test.** After `076490b7` every test already sent an allowed role, so each feature's commit left all 309 passing with no edit, as required.
5. **A notice on the login page** ("Your session has ended. Please log in again.") after any 401: the plan said "optionally"; it is a few lines and tells the person why they are on the login page.
6. **The bell:** only the Authorize Loan button is hidden for Staff. The loan card still shows, and still counts toward the Staff badge as "needs action", as Staff transfer cards already did with no button. Changing the badge was not asked; noted below.
7. **The tests use `USERS.custodianA` for the Custodian role.** `USERS.custodianB` appears in the new session tests (a second session of one user, a role change), not in the 279 rewritten tests: the typed names, not the session, still decide who did what until 13c.
8. **Two auth test titles** said "with no session"; they now say "for any signed-in user", which is what they send (`076490b7`). Same expectations.

#### What changed in behavior

- **Every route except login, the sign-up request, and logout needs a session.** No `adric_session` cookie answers 401 `{ success: false, error: "Please log in to continue." }`; a tampered, expired, logged-out, or other-secret cookie, or one whose account no longer exists, answers 401 "Your session has ended. Please log in again.". A role the table does not list answers 403 "Your role is not allowed to do this.". Routes per role: Staff 23, Lab Head 19, Custodian 12, Director 11. `ADMIN`, `ITS_STAFF`, and `ADRIC_SECRETARY` accounts pass Staff checks and nothing more.
- **The role is read from the database**, at most once a minute per cookie since `128896fb`: a changed role or a deleted account takes effect within 60 seconds for a cookie in use, and at once for a new login.
- **Answered before any session check, as before:** a body that cannot be read (400, 413, 415), an undecodable path parameter (400), and an unknown path (Express's 404, the 22 old analytics routes included).
- **Login** sets the cookie; **logout** refuses it until it would have expired and deletes it. Each login has its own cookie, so logging out ends only that one.
- **CORS** answers only `WEB_ORIGIN`. The app must be opened at `http://localhost:5173`, not `http://127.0.0.1:5173`.
- **The server stops at startup** without `SESSION_SECRET`, or with one shorter than 32 characters.
- **Web:** `/login` and `/register` make no API calls any more (before, every first page load sent seven); the lists load after login, only those the role may read; logout calls the server; a 401 logs the person out and the login page says why; a reload or typed URL keeps you logged in (issue #49 closed); the old `/its/...` and `/tsg/...` links work again for Staff; Staff no longer see Authorize Loan in the bell.

#### What stayed the same, on purpose

- **13c, not 13b:** the typed names still decide the borrower, returner, requester, and reporter (issue #32, H-10); `GET /api/auth/me` answers for whatever `?email=` it is sent and `PUT /api/auth/account` updates whatever email the body names (C-06); `DEFAULT_CUSTODIAN_ID` stays; the Custodian still receives other people's names in the asset, loan, and transfer lists (D2, answer 1). Lab and ownership checks (whose lab, whose asset) are not made (answer 11).
- The `session_user_email`, `session_last_activity`, and `session_created` cookies stay, for display and for the `/me` lookup; the server never reads them. The web's own 24-hour and 30-day checks stay; the server's 8 hours ends a session first.
- Passwords are still compared as plain text (issue #10). The pending sign-up list still sends each applicant's password, now to the Lab Head only (issue #72).
- No `web/api` function changed its name or answer: the `Raw` calls stay (the web side of H-16).

#### Typecheck: 68, unchanged

The same 68 errors after every commit.

#### Verified

- **After every commit:** `npm run typecheck` (68), `npm run build` (passes), `npm test`: **309 passed** after every commit up to `a984ffb2`, then **372** (309 plus 63) from `68b5e20b` on.
- **Every request of a full test run recorded** (432 requests, by a scratch setup file outside the repository): after `076490b7`, the only requests to protected routes without a cookie are the two errorHandler ones answered before any route middleware.
- **A probe of the whole table** after each enforcement commit, against a server on the local `AdRIC_DB_test` (reseeded each time): every route as a visitor and as each of the four roles, with ids and tags that do not exist. After each commit, exactly that feature's routes changed; after the last, all 38 protected routes answer 401 with no session, 403 for each role not listed, and let each listed role reach its handler (200, 400, or 404, never 500).
- **In a real browser:** headless Chrome, driven over its DevTools protocol, against the Vite dev server and a server on the local test database (the four role accounts' emails changed to `@dlsu.edu.ph` there, because the login page accepts only those). Checked: `/login` and `/register` make no API call; login sets an `HttpOnly`, `SameSite=Lax`, non-`Secure` cookie that every later call carries; each role loads only its lists; **every tab of Staff, Lab Head, Custodian, Director, and the ADMIN and Secretary accounts** (42 tab visits, the bell opened on each) got no 401 and no 403; logout answers 200 and the cookie is gone; a reload and a typed URL keep the session; another role's URL goes to the role's own page; `/its/repairs` and `/tsg/inventory` reach the Staff tabs; a tampered cookie lands on `/login` with the notice and the display cookies cleared; the bell shows Staff the loan card without Authorize Loan.
- **Startup:** with `SESSION_SECRET` unset, and with a 9-character one, the server stops before listening with the messages above (also pinned by two tests).
- **A mutation check:** adding Staff to the loan decision makes the row 22 test fail.
- **The comment commit** changes comments only: each of its 32 files compiles to the same JavaScript, comments removed, before and after.
- `.env` and `pending_registrations.json` were not opened. Nothing was sent to the shared database.

**Not verified in the agent session:** the real app on CCS Cloud data. The hand checks below cover it.

#### What every teammate must do

1. **Add `SESSION_SECRET` to `.env`** before running the server, or it stops at startup. Make one (any machine with Node):

   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

   Paste the 64 characters after `SESSION_SECRET=`. Use your own; do not share it or commit it. Changing it later logs everyone out of that server.
2. `WEB_ORIGIN` is optional. Leave it out unless the web app runs somewhere other than `http://localhost:5173`.
3. **Open the app at `http://localhost:5173`**, not `127.0.0.1`: from `127.0.0.1` the login fails (and, a known defect, says the password is wrong).
4. Restart `npm run dev:all` after pulling, and log in again once.
5. `npm test` needs nothing new: the tests set their own secret.
6. **A browser holds one login at a time.** Every tab shares the same `adric_session` cookie, so logging in as another role in a second tab replaces the first tab's login. To test two roles at once, use two browsers, or a normal window and a private (incognito) window.

#### Hand checks

Against CCS Cloud with `npm run dev:all`, after adding `SESSION_SECRET` and restarting. **Nothing below changes shared data except check 4**, which only files one loan request and declines it (a request's status, no custody change). Refusals are read-only requests. DevTools means the browser's developer tools (F12): the Application tab lists cookies, the Network tab lists requests, the Console runs commands.

**Raiki on the real app (5):**

1. **Login and logout, every role.** Log in as a Staff, a Lab Head, a Custodian, and a Director account, one at a time, at `http://localhost:5173/login`. Each lands on its own dashboard. DevTools, Application, Cookies, `http://localhost:5173`: `adric_session` is there with HttpOnly ticked and an expiry 8 hours ahead. Press Log Out in the sidebar: the login page opens, `adric_session` is gone, and the Network tab shows `POST /api/auth/logout` 200.
2. **A reload keeps you logged in (issue #49).** As the Lab Head, open Inventory and press F5: you stay on Inventory (a short "Restoring your session..." first). Type `http://localhost:5173/lab-head/health` in the address bar: Health opens. Type `http://localhost:5173/staff/overview`: you are sent to `/lab-head/custody`. Log out, then type `http://localhost:5173/lab-head/custody`: the login page.
3. **One refusal.** Log in as a Custodian. DevTools, Console, run: `fetch("http://localhost:4000/api/analytics/director", { credentials: "include" }).then(async r => console.log(r.status, await r.text()))`. **Expect** `403 {"success":false,"error":"Your role is not allowed to do this."}`. Log out and run it again: `401 {"success":false,"error":"Please log in to continue."}`. Both are reads; nothing is changed.
4. **One Lab Head decision.** As a Custodian, open an available asset (Available Assets) and request a loan. As Staff, open the bell: the loan card is listed with **no** Authorize Loan button. As the Lab Head of that asset's lab, open Custody: the request is listed; press **Decline**. It shows as Declined, and the bell card goes. (Decline goes through the same route and role check as Authorize; declining changes only the request's status. If you prefer to check Authorize, use an asset the team keeps for testing.)
5. **Every role, every tab.** Logged in as each role in turn, open each sidebar tab once and the bell once: Staff (Overview, Register, Inventory, Repairs, Inspections, Returns, QR Tags, Health, Account), Lab Head (Custody, Inventory, Health, Approvals, Account), Custodian (My Assets, Available, Scan, Report, Account), Director (Overview, Analytics, Clearance and Disposal, Reports, Account). Everything loads as before. Do not submit any form. If anything shows empty, open the Network tab and look for a 401 or 403.

**May be run later in a browser against the local test database (or on the real app, read-only):**

6. **Startup.** `npm run server` prints the banner and "✅ Default custodian check passed" as before. With `SESSION_SECRET` removed from `.env`, it stops with "Missing required environment variable(s): SESSION_SECRET"; put it back.
7. **Before login.** Fresh tab, DevTools Network open, go to `/login`, then `/register`: no request to `/api/`.
8. **A session the server no longer accepts.** Log in as any role. DevTools, Application, Cookies: change the first number of `adric_session`'s value (the user id) and reload. **Expect** the login page with "Your session has ended. Please log in again." above the form.
9. **Logout in another tab.** Log in, open a second tab on the same dashboard, log out in the first, then click any tab in the second: the second ends on the login page with the same notice.
10. **Old Staff links.** As Staff, type `/its/repairs` and `/tsg/inventory`: they open Repairs and Inventory under `/staff/` (step 9 hand check 4, blocked until now by issue #49).
11. **Lists per role.** DevTools Network, filter `/api/`: after a Lab Head login, `pending-registrations` is requested and `asset_reports` is not; after a Custodian login, neither `asset_reports` nor `asset_disposals` is requested; after a Staff or Director login, `asset_reports` is.
12. **The ADMIN account**, if you have its password: it reaches the Staff dashboard, and Approvals data is refused (in the Console, `fetch("http://localhost:4000/api/auth/pending-registrations", { credentials: "include" }).then(r => console.log(r.status))` prints 403).
13. **Tests.** `npm test` passes on your machine: **375 tests** (372 when this list was written; 3 cache tests added after the hand checks).

#### Hand checks: results (2026-10-15)

Raiki ran checks 1 to 5 on CCS Cloud (`npm run dev:all`), from off the DLSU network. **All five passed for what they test.**

- **4:** the Decline worked, and the request showed as Declined on Custody. The bell was too slow to show the change (the bell and Custody tab not updating each other is issue #57).
- **What they found besides:** dashboards took 10 to 90 seconds, several lists answered 500, and the server terminal showed Prisma's P2039 "pool timeout: failed to retrieve a connection from pool after 10001ms (pool connections: active=8 idle=0 limit=20)" on `GET /api/asset_loans` and `GET /api/asset_disposals`. And after a reload or a typed URL, a valid `adric_session` cookie (8 hours, not logged out, one browser, one tab) was often sent to the login page. CCS Cloud is slow on and off the DLSU network (issue #8); the two fixes below reduce what 13b added, they do not fix the link:
  - `128896fb` **fix(step 13b)!: remember the session lookup for 60 seconds.** `requireAuth` had added one query to every request; the lookup is now kept per cookie for 60 seconds.
  - `4c6bbc83` **fix(step 13b)!: a slow or failing server no longer logs you out on reload.** The page load treated a 500 or no answer from `/me` as logged out; now only a 401 does, and anything else is retried.
- **Checks 6 to 13:** run later the same day in a browser on the local test database; see "Hand checks 6 to 13: results" below (9 failed first, then a fix, then all passed). **Checks 2 and 5** were re-run by Raiki on CCS Cloud (`npm run dev:all`) after `128896fb` and `4c6bbc83`: **both passed**. A slow load showed "Restoring your session..." and then the dashboard, never the login page.

#### After the hand checks: the two fixes

| Commit | Kind | What it does |
|---|---|---|
| `128896fb` | **Behavior change** | New `server/shared/services/sessionCache.ts`: `sessionIdentityFor` keeps each cookie's identity (user id, app role, Staff unit) for 60 seconds. The signature, expiry, and logged-out checks still run on every request without the database, so a logout or a tampered or expired cookie is refused at once; logout also drops that cookie's entry; a failed lookup is not kept. **A role change or a removed account now takes effect within 60 seconds** for a cookie already in use; a new login is looked up at once. Two tests changed in the same commit: "gives a session the new role at its next request after the account's role changes" became "keeps a cookie's role for up to 60 seconds after the account's role changes, while a new login gets the new role at once", and "refuses the cookie of an account deleted after login" became "keeps accepting the cookie of an account deleted after login for up to 60 seconds (the lookup cache), and a new login fails". The server's cache runs in its own process, so those two show it through a second login; 3 new tests check the cache module itself with a test clock (kept for 59.999 seconds, gone at 60; logout forgets one cookie only; old entries dropped). **375 tests** |
| `4c6bbc83` | **Behavior change** | `web/state/session.tsx`: on a page load, only a 401 from `/me` ends the session (the 401 handler, as before); a 400 or 404, where the server answered that it does not know the email, still logs out as before. A 5xx, no answer within 20 seconds, or a network error is retried: up to 3 tries, 3 seconds apart, on the "Restoring your session..." screen ("The server is slow to answer. Still trying (2 of 3)." from the second). If all fail, `RootLayout` shows "Can't reach the server right now." with Retry, keeps the display cookies, and does not go to `/login`. `web/api/auth.api.ts` gains `getMeRaw` (the restore needs the status) |

**How fix 2 was checked without CCS Cloud:** headless Chrome against the Vite dev server and a server on the local test database, with a small proxy in between that passes everything through but can make `GET /api/auth/me` fail. Results: 500 every time: 3 tries, 3 seconds apart, the failure screen after 6 seconds, the path and both cookies kept; then, with the server back, Retry restored the dashboard on the same path. 500 twice, then an answer: logged in on the same path. A dropped connection: the failure screen, cookies kept (Chrome itself re-sends a request on a dropped connection, so the proxy saw more requests than the 3 the app made). No answer at all: the failure screen after 66 seconds (3 tries of 20 seconds, plus 2 waits). A tampered cookie: one request, a 401, and `/login` with the notice at once, no retry.

**Checks after both fixes:** typecheck **68**, same errors; build passes; `npm test` **375**.

#### Hand checks 6 to 13: results (2026-10-15, local test database)

Run by the agent, **not on CCS Cloud**: a real browser (Chrome, driven by the Playwright MCP) against the Vite dev server (`npm run dev`, opened at `http://localhost:5173`) and `server/main.ts` on port 4000 against the local `AdRIC_DB_test`, logged in with the fixture accounts from `tests/setup/fixtures.ts`. A start script outside the repository used the test harness (the guard, `resetDatabase`, the seed, `buildServerEnv`) to empty and seed the database, then started the server from a temporary working folder with `WEB_ORIGIN` `http://localhost:5173`, so `pending_registrations.json` in the repository was never touched. **One change to the fixture data:** the login page accepts only `@dlsu.edu.ph`, so after seeding the script changed the eight fixture emails from `@example.test` to `@dlsu.edu.ph` in `AdRIC_DB_test` (passwords as in the fixtures). `.env` and `pending_registrations.json` were not opened; nothing was sent to CCS Cloud.

Screenshots are kept outside the repository, on the agent's machine (`%TEMP%\adric-13b-handchecks\screenshots\`). On the browser ones, the green (or red) box in a corner is an overlay the checker added, listing the requests and cookies at that moment; it is not part of the app.

**Check 9 failed on the first run. Fixed in `4b5386d8`; then checks 8 and 9 were re-run and 10 to 13 run: all of 6 to 13 passed.**

| Check | Result | What was seen | Screenshots |
|---|---|---|---|
| 6. Startup | Passed | Through the start script, with every variable passed in (the server runs from a temporary folder, so it reads no `.env`). With the test secret: the banner and "Default custodian check passed: user_id 1 (Test Admin)". Without `SESSION_SECRET`: stops before listening with "Missing required environment variable(s): SESSION_SECRET. Copy .env.example to .env and fill them in." With a 9-character secret: "SESSION_SECRET must be at least 32 characters. Make one with: ..." (answer 1) | `check06-startup-terminal.png` |
| 7. Before login | Passed | No cookies. `/login`, then Register New Account to `/register`, then `/register` loaded directly: no request to `http://localhost:4000`. (The page loads its own `web/api/*.ts` source files from Vite; those are not API calls) | `check07-login-no-api.png`, `check07-register-no-api.png` |
| 8. A session the server no longer accepts | Passed (first run, and again after `4b5386d8`) | Lab Head, on `/lab-head/custody`; `adric_session` HttpOnly, SameSite Lax, not Secure, 8 hours. User id in the cookie changed from 5 to 6, then reload: one `GET /api/auth/me` answering 401, `/login` with "Your session has ended. Please log in again.", the display cookies cleared. The notice sits inside the form, between the password field and the sign-in button | `check08-1-logged-in-labhead.png`, `check08-2-tampered-cookie-login-notice.png`, `check08-rerun-tampered-cookie-login-notice.png` |
| 9. Logout in another tab | **Failed**, then passed after `4b5386d8` | First run: Custodian A in two tabs; Sign Out in the first (`POST /api/auth/logout` 200, no cookies left); Available Equipment in the second: `GET /api/assets` 401 and `/login`, but **no notice**. Re-run after the fix: the same steps; the second tab shows the notice; the first tab, logged out by its own button, shows none. Also checked: on a freshly loaded `/login` with nobody logged in, a 401 through the app's API client shows no notice | first run: `check09-1-second-tab-logged-in.png`, `check09-2-first-tab-logged-out.png`, `check09-3-second-tab-login-no-notice-FAILED.png`; re-run: `check09-rerun-1-second-tab-logged-in.png`, `check09-rerun-2-first-tab-logged-out.png`, `check09-rerun-3-second-tab-login-notice.png`, `check09-rerun-4-logged-out-tab-401-no-notice.png` |
| 10. Old Staff links | Passed | Staff TSG. Typed `/its/repairs`: Repair Operations Manager at `/staff/repairs`. Typed `/tsg/inventory`: Asset Inventory at `/staff/inventory`. Both full page loads, so the restore (issue #49) ran first | `check10-1-its-repairs-to-staff-repairs.png`, `check10-2-tsg-inventory-to-staff-inventory.png` |
| 11. Lists per role | Passed | Requests from the login click on, about 5 seconds. Lab Head: `pending-registrations` requested (200), `asset_reports` not. Custodian A: neither `asset_reports` nor `asset_disposals` (only `/me`, `assets`, `asset_transfers`, `asset_loans`, `asset_repairs`). Staff TSG: `asset_reports` 200. Director: `asset_reports` 200. Every answer 200; no 401 or 403 | `check11-1-labhead-requests.png`, `check11-2-custodian-requests.png`, `check11-3-staff-requests.png`, `check11-4-director-requests.png` |
| 12. The ADMIN account | Passed | Fixture ADMIN (user 1): lands on `/staff/overview` (System Overview), sidebar "Staff (ITS)". The Console `fetch` from the check prints `403`; the body is `{"success":false,"error":"Your role is not allowed to do this."}` | `check12-admin-staff-dashboard-403.png` |
| 13. Tests | Passed | `npm test` after the browser run, with the start script and Vite stopped: 14 files, **375 passed** | `check13-npm-test-375.png` |

**Why check 9 failed.** The 401 handler in `web/state/session.tsx` showed the notice only while the `session_user_email` cookie was still there. Every tab of a browser shares that cookie, and the logout in the first tab had already erased it, so the second tab was sent to `/login` (the logout itself worked) without saying why. It failed the same way every time, for every role.

**The fix:** `4b5386d8` **fix(step 13b)!: the "session ended" notice shows in every tab that was logged in.** Behavior change. The handler now shows the notice when this tab had a session to lose: a role or a current user in memory, **or a page load restoring one**. That last part is added to the rule Raiki gave: on a reload (check 8) the 401 comes from the restore's `/me` call, before any role is in memory, and without it check 8 would lose its notice. The value is read through a ref, because the handler is registered once at mount. A 401 on a tab where nobody was logged in (the login page) still shows no notice. After the fix: typecheck **68**, same errors; build passes; `npm test` **375**.

**Seen besides:** the Lab Head and Director dashboards ask for the same lists several times right after login (the Director: 39 GET requests in about 5 seconds, `assets` and `asset_disposals` 9 times each). Each request costs a database round trip on CCS Cloud (issue #8). **Read from the code afterwards: not caused by 13b.** Login goes to `/adric-director`, whose index route redirects to `/overview`; `RootLayout` keys its page wrapper by the path inside `AnimatePresence mode="wait"`, and the leaving wrapper's `<Outlet />` already renders the new route, so the dashboard mounts twice (once in the leaving wrapper, once in the new one). Each mount runs two effects (`[]` and `[activeTab]`), and each effect calls `fetchDbAssets()`, `fetchDbDisposals()`, and `syncFromDb()`, which asks for both lists again: 2 x 2 x 2 = 8 of each. The ninth is `serverData.tsx`'s load when the role is set, the 13b replacement for `main`'s load at app start (`2c107afc` sent it on `/login`, before login). So `main` sent 9 of each per Director login too, one of them earlier. The Lab Head's 3, 5, and 5 (assets, loans, transfers) follow the same pattern. None of these files changed in 13b except `serverData.tsx`'s one moved load. Filed as issue #92.

#### Questions for Raiki (stop 2)

1. **How long `SESSION_SECRET` must be.** The secret is the password the server signs every login cookie with; anyone who knows it can make a cookie for any account, the Director's included. It affects every teammate's `.env` once, not any screen or role. (a) Keep the rule added in `fab7825a`: the server refuses to start with a secret shorter than 32 characters, and its message gives the one-line command that makes one. (b) Drop the rule and accept any non-empty secret, as the decision literally said. **Recommendation: (a)**, because a short secret like "adric" can be guessed, and then the session protects nothing.
   **Answer (2026-10-15):** (a). The 32-character minimum stays.
2. **The Staff badge in the notification bell.** The bell (the round button at the bottom right of every dashboard) counts the cards that need the user's action. For Staff it still counts pending loan requests, although Staff no longer get the Authorize Loan button (answer 7); pending transfers were already counted for Staff with no button. (a) Leave both as they are until the bell is rewritten (01D section 8): Staff see a badge number they cannot act on. (b) A small fix now, in its own commit: loan and transfer cards stay visible to Staff but no longer count toward their badge. **Recommendation: (a)**, because the bell rewrite replaces this logic anyway, and the count misleads only Staff, who can still open each card.
   **Answer (2026-10-15):** (a). Left until the bell rewrite, with issues #55 (bell cards that open a 404) and #57 (the bell and the Custody tab not updating each other).

#### Left for 13c and later

- **13c:** the session user replaces the typed names (issue #32, H-10) and `/me?email=` and the account update's body email (C-06); `DEFAULT_CUSTODIAN_ID` goes; and (answer 1) the server stops sending other people's names to a Custodian in the asset, loan, and transfer lists. `req.sessionUser` is ready for all of it.
- **Later:** lab and ownership checks (01C tier 3 item 21); `Secure` cookies with HTTPS (01C tier 3 item 17); unregistering `/api/auth/register` (issue #70), transfer `/accept`, and `GET /api/asset_returns`; issue #41 (who may delete).

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
| The backup still covers only 4 of 15 tables (no `asset_records`, the table that holds custody state), so it could not actually restore the system. It is a partial export, not a backup. Deciding whether to keep it at all belongs with `server/jobs/backup.ts`. **Step 10 moved it there unchanged** (`7a40911b`); `TODO(F-39)` marks it. Keep, extend, or delete is still a team decision. **Decided 2026-10-09: delete it**, because it copies 4 of 15 tables and cannot restore anything. In its own labelled behavior-change commit, in step 12 or later, not in step 10. **Done in step 12 batch 4** (`1a3b3bbd`): the job, its timer and startup call, `backupDir`, and `BACKUP_DIR` in `.env.example` are gone; `tests/` still blanks `BACKUP_DIR`, which is now harmless | F-39 in 01A | Done |
| `pending_registrations.json` is now untracked but still the live store for pending sign-ups, holding a plaintext password per record. **Step 12 batch 3:** its file access is in `server/features/auth/auth.repository.ts`, unchanged (same file, same path, same reads and writes) | H-17 | Phase 3 (becomes a table) |
| `prisma.ts` still carries hardcoded connection fallbacks including a password. Step 0 did not touch them, because removing them without `server/config/env.ts` would break every teammate's setup with no replacement. **Done in step 10** (`bd242d15`): `env.ts` requires the five variables and the fallbacks are gone. The values stay in git history (no rewrite, C-01), so rotating that password is still the team action from step 0 | C-07 | Done (password rotation: team action) |
| `npm ci` reports 11 vulnerabilities (3 moderate, 8 high) and 2 packages have install scripts not covered by `allowScripts` (`@prisma/engines`, `prisma`) | 01C section 7, tier 3 item 22 | Separate dependency pass |
| `node_modules` was absent in this working copy, so `npm ci` and `npm run prisma:generate` were run before anything could be verified. Worth knowing for the next session | n/a | n/a |
| `LabHeadDashboard.tsx` does call `GET /api/assets` (line 165, via a template string), so 01D's list of callers is correct. Recorded because an earlier quick grep suggested otherwise | n/a | n/a |
| 114 type errors now have names and line numbers, and none are fixed. The three worth fixing first are the H-13 ones, because they write wrong data today: two in `ITSDashboard.tsx`, one in `CustodianPortal.tsx` | H-13 | Its own `fix/h13-*` branch, not the restructure |
| 37 of the 114 errors are `motion` animation props (`ease: string` where the library wants a union). Cosmetic and safe, but they are more than a third of the count, so fixing them makes the real errors easier to see | n/a | Separate chore commit |
| `TSGAnalyticsView.tsx` `CATEGORY_OPTIONS` filters by `WORKSTATION`, `ROBOTICS`, `SENSOR`, `NETWORKING`, `ACCESSORY`, none of which exist in `assets_category`. Picking one of those can only ever match nothing. Not replaced with `ASSET_CATEGORIES` in step 3, because that would change what the filter offers. **Not done in step 12 batch 4,** which moved server code only | n/a (new) | A small web fix branch |
| Database role names (`ADRIC_DIRECTOR`, `TSG_STAFF`, `LAB_HEAD`, and the rest of `roles_role_name`) are string literals inside the login, `/me`, and registration handlers in `server.ts`, alongside the mapping to app roles. That is logic, not a list, so it moves with `features/auth`. Step 9 changed the app-role side (ITS and TSG are now `Staff` plus a `staffUnit`) and added `ITS_STAFF`; the mapping itself is still inline in both handlers. **Done in step 12 batch 3** (`5b94aa9b`): one function, `appRoleFor` in `auth.service.ts`, for login and `/me` (the two copies were identical); the approval's own mapping (requested role text to database role) stays in `approveRegistration` | n/a | Done |
| `LAGUNA_LABS` in `server.ts` and `LAB_OPTIONS` in `TSGAnalyticsView.tsx` are two more lab lists, using short codes, which do not match the full names in `shared/constants/labs.ts`. 01D says campus should come from `research_centers.location` instead. **Not done in step 12 batch 3:** the assets move is behavior-neutral; `LAGUNA_LABS` is in `server/shared/utils/campus.ts` since step 11 | M-03 | Phase 3 |
| The condition text and colour maps (`CONDITION_TEXT_CLASS` and similar) are repeated in `ITSDashboard`, `LabHeadDashboard`, `CustodianPortal`, and `ReturnForm`. They are UI styling, so they belong in `web/features/assets/`, not `shared/`. **Not done in step 8 part 1**, which moved files without changing their code. **Step 8 part 2** moved the `ITSDashboard` copy to `web/features/assets/assetBadges.tsx`; the other three copies remain, since merging them changes three more files | n/a | A later cleanup, or with each dashboard's split |
| `prismaClient.ts` has its own `RoleName` type, which is missing `ITS_STAFF` and `CUSTODIAN`. Left alone, since the file is deleted in step 7. **Gone with the file in step 7** (`6e08e469`) | H-01 | Done |
| `LabHeadAnalyticsView.tsx` `handleLoanDecision` is defined but nothing calls it, so it is dead code. It would also fail if wired up: it sends `"reject"`, and the server only accepts `"approve"` or `"decline"` (400). Converted to the client anyway so no loan URL is left outside `web/api/`; `decideLoan` takes a plain string for that reason. **Not done in step 11**, which moved the server side only; `shared/types/loans.ts` now has `LoanDecision`, which `decideLoan` can take once the dead handler is gone. **Not done in step 12 batch 4,** which moved server code only | n/a (new) | Small web fix branch, with `handleTransferDecision`, or when the analytics view is split |
| Most call sites check only `success` in the body, not the HTTP status. A minority check the status or content type, or never read the answer at all (corrected in step 5: the step 4 version of this note said no site checks the status, which was true for loans only). The client keeps both styles for now, through plain and `Raw` calls, so steps 4 and 5 stay behavior-neutral. **Step 13a** did the server half: every failure now answers JSON with `success: false` (a 500 with `code: "SERVER_ERROR"` and a generic message, a body that cannot be read with `code: "BAD_REQUEST"`), and refusals keep their status and message. `web/` was not changed, as instructed: the 15 `Raw` functions stay (`web/api/analytics.api.ts` 7, `assets.api.ts` 3, `auth.api.ts` 2, `repairs.api.ts` 2, `inspections.api.ts` 1, over `apiGetRaw`, `apiPostRaw`, and `apiPutRaw` in `client.ts`) | H-16 | Server side done (13a). Left: typed errors in `web/api/client.ts`, then remove the `Raw` calls. Not part of 13b or 13c; noted for later; when is not decided yet (most likely a web branch after step 13) |
| `web/api/*.api.ts` return a loose `ApiResult` (any extra fields). The real request and response shapes belong in `shared/types/`. **Step 11:** `shared/types/loans.ts` holds the loan shapes and the server uses them; the web side uses the request type only (see the step 11 note below). **Step 12 batch 1:** the same for returns, transfers, and disposals. **Batches 2 and 3:** repairs, inspections, auth, and assets. **Batch 4:** `shared/types/analytics.ts` holds the response data of the eight live analytics routes, used by the server; the web side builds query strings and sends no body, so it uses none yet | H-13 | Done on the server side; the web responses with step 13 (typed client) |
| `docs/reference/AdRIC_DB_Schema.sql` does not match the live database. The live database has different Lab Head accounts (`labhead.bio`, `labhead.car`, and so on, with no `labhead.cite4d`) and different seed passwords, and the Director already holds `ADRIC_DIRECTOR`. Logging in with the credentials from the file fails and silently falls back to the mock login. Reported by Raiki on 2026-10-02. Not part of the restructure, not fixed. **Step 14 should baseline from the live schema, not from this file** | H-23, H-22 (H-22 is already fixed in the live data) | Step 14 |
| Five endpoints put the asset tag into the URL without encoding it (`custodian-history`, `transfer`, `return`, `repair`, `inspection`), while five others encode it (`borrow`, `disposal`, and asset create, edit, delete). Harmless with tags like `EQ-2024-001`; a tag containing `/`, `?`, or `#` would break the unencoded ones. Each API function keeps what its call site did. **Step 12 batch 1** left `return` and `transfer` unencoded: encoding changes which URL such a tag reaches, so it is a behavior change on the web side, not part of a backend move | n/a (new) | A small web fix, one commit for all five |
| The pending disposals list (now in `web/state/serverData.tsx`) is built from the API without `lastCustodian`, `breakdownReasons`, and `disposalPathway`, which the `PendingDisposal` type requires, so the variable stays annotated `any`. Step 6 moved the block but did not fix it: making the type truthful means changing the bell, which reads two of those fields and so shows "undefined" in every disposal card | H-13, M-13 | The bell rewrite (01D section 8) |
| `approveRegistration` returns the server's answer and accepts an object, but its declared type said it takes a string and returns nothing. **Fixed in step 6** (`8dcd6120`): the declared type now matches and the `any` is gone | H-13 | Done |
| `handleTransferDecision` in `LabHeadAnalyticsView.tsx` is dead code like `handleLoanDecision`, and also sends `"reject"` where the server only accepts `"decline"`. Disposals are the opposite: the server wants `"reject"`. Three workflows, two words for the same decision. **Still there after step 8 part 1** (deleting code is not a move); an inline comment now marks them. Not done in step 8 part 2 or step 12 batch 4 (server code only) | n/a (new) | Small web fix branch, with the two dead handlers |
| The lab-head analytics endpoint is fetched five separate times by five widgets on the same screen, four of them with an identical query. `TODO(M-01)` on `LabHeadAnalyticsView` since step 8 part 1. Not done in step 12 batch 4 (server code only; the endpoint itself is unchanged) | M-01 (same family) | When the analytics view is split, or a small web fix |
| **Open team decision 1: custodian return requests.** A request is saved only in the browser that made it (`ems_returns`), so Staff on another machine never see it. Worse, the Pending Returns list is the only place Staff can open the finalize form, so on another machine a return cannot be finalized in the app at all. The database cannot hold a pending return today: `asset_returns` has no status column. Kept as is in `web/state/browserOnly.tsx` (Raiki, 2026-10-03). **Direction agreed 2026-10-04:** `asset_returns` already stores finalized returns, so only the request stage is missing. Phase 3 most likely adds `status`, `requested_by`, `requested_at`, and `loan_id` columns to `asset_returns` instead of a new table; the loan link also addresses H-04 | H-02, H-04 | Phase 3 |
| **Team decision 2: Staff inspection log. Decided 2026-10-06.** The log table on the Staff inspections tab reads the browser's own copy (`ems_inspections`). The real reports are saved to `asset_reports`, and the dashboard already fetches them (`dbReports` in `ITSDashboard.tsx`) but never shows them. Kept as is until the decision (Raiki, 2026-10-03). **Decision:** point the table at the database reports (`dbReports`) instead of the browser copy, as its own labelled behavior-change commit when the inspections tab is split. The cycle type column (Annual or Trimestral) is dropped, because `asset_reports` does not store it. **It may come back:** that needs a cycle type column on `asset_reports`, and a cycle setting shared by everyone instead of the per-browser `pref_cycle_mode` cookie (F-38). Tracked in issue #34. **Done in step 8 part 2** (`82bc2e8e`, and `c5936be0` stops writing the unread browser copy) | F-28, F-38 in 01A | Done; the cycle type column with issue #34 |
| **Open team decision 3: manual clearance holds.** Holds are stored only in the browser (`ems_manual_clearance_holds`) and no screen can create one: the Director dashboard imported `toggleClearanceHold` but never called it. The list is kept readable for the bell (Raiki, 2026-10-03). The action was removed in step 6 because it looked people up in the fake user table. `AdRICDirectorDashboard.tsx` still has two unused state variables left from a holds screen (`selectedHoldAffiliate`, `overrideNotes`). A real hold feature is panel comment D2. **Still open on 2026-10-06, waiting on the team.** Step 8 moves this code as is, with no behavior change, and does not wait for the decision | F-37 in 01A | Team decision, then Phase 3 |
| **Users are identified by display name in several places (issue #32).** For example the borrow form's typed name decides the loan's `borrower_id` (H-10, row below), and My Assets and the notification bell decide which assets are "mine" by comparing the asset's custodian name with the logged-in user's name (`CustodianPortal.tsx` `custodianAssets`, several checks in `NotificationCenter.tsx`). Two people can share a name. The fix is to use the user id from the session. **Step 11 did not apply it to loans:** the server has no acting user until `requireAuth`, and the Phase 2 tests pin the typed-name lookup (step 11 detail, "Differences from 01D"). **Decided 2026-10-09:** step 13 switches to the session user for loans and for every feature step 12 extracts (step 12 moves the name lookups unchanged), and updates the three Phase 2 tests that pin the typed-name lookup in the same commit | H-10, issue #32 | Step 13 (loans and every step 12 feature, with the three tests) |
| `web/state/serverData.tsx` is a temporary home for the lists several screens share. 01D has no such file: each page should load its own data. Unchanged by step 8 part 1 and part 2. Since part 2 the Staff pages load their own lists through feature hooks, but serverData still feeds the bell, the asset fallback, and `syncFromDb()` | n/a | Shrinks as pages are split (step 8 part 2 and later), goes with the bell rewrite |
| The bell decides which transfers a Lab Head sees by the literal text "CITe4D", not by the Lab Head's own lab. Now that the bell's buttons are real, any Lab Head can approve a CITe4D transfer from the bell, and a Lab Head of another lab sees no transfers there. The Custody tab scopes by branch correctly (in the browser only, M-02). The server checks nothing either way (C-02). Since 2026-10-04 transfers are to be replaced by a custodianship queue (issue #22), so step 12 moves the transfer code without adding an approval rule. **Done that way in step 12 batch 1** (`574ded38`) | F-31 in 01A, M-02 | The bell rewrite, and the custodianship queue (issue #22) |
| A failed approve, decline, or reject from the bell is written to the browser console only. The card stays and nothing tells the user why. The loan button already behaved this way. **Step 13a:** a server failure now answers the generic message, but the bell still only logs it | H-16 family | The web side (typed errors), then the bell rewrite; noted for later; when is not decided yet |
| Custodian condition report: if the server cannot be reached, the form saves the browser copy and still shows "Report Archived". The request's answer is never read, so a server-side refusal looks like success too. **Step 13a** changed the answer to a failure (a generic 500), not the form, which still does not read it | n/a (new) | The web side (typed errors), or with open team decision 2; noted for later; when is not decided yet |
| `updateProfile` swallows a failed save and the account page shows its success tick anyway. **Step 13a** changed only the server's answer to a failure (a generic 500) | n/a (new) | The web side (typed errors); noted for later; when is not decided yet |
| `addRepairRequest` is unchanged, so `RepairForm` still posts each ticket twice and relies on the server's 8-second guard. 01D section 7 removes each form's second write when the forms move. **The forms moved in step 8 part 1 without this change**, because that session moved files only and removing the second post changes what reaches the server. `TODO(M-07)` marks the line. **Fixed in step 8 part 2** (`5d26ed8e`): RepairForm posts once, then calls `syncFromDb()`. The server's guard stays until step 12. **Step 12 batch 2 kept the guard as it is** (instructed), now in `repairs.service.ts` with `TODO(M-07)`; deleting it is proposed as its own commit (batch 2 detail, proposals). Also noticed: the guard's map is never emptied, so it grows by one entry per distinct tag and description until the server restarts | M-07 | Done (form). Server guard: its own commit, if the team agrees |
| Two pre-existing bugs found during the step 6 hand checks: duplicate custodian requests on one asset (issue #25), and My Assets listing disposed assets because `CustodianPortal.tsx` has no status filter (issue #26). **Fixed on `fix/issues-25-26`** (`bc041acb`, `95290115`), see "Bug fix: issues #25 and #26" above | H-05 (#25), n/a (#26) | Done |
| Two pre-existing bugs found during the step 8 part 1 hand checks, not caused by the move: Classic Dark darkens only a few components because many screens hardcode light colours, and the bell has no Decline button for loan requests | n/a | GitHub issues #43 and #44, their own fix branch |
| H-05 is only partly closed by #25. `POST /disposal` still checks only that the asset exists, so an asset that is on loan or already has a pending disposal can be put up for disposal. The loan and transfer guard is also check-then-insert, so two requests in the same instant can both pass (`TODO(H-05)` in `server.ts`). **Step 12 batch 1** moved disposals without a guard, as decided (issue #54, pinned by `tests/api/disposals.test.ts`) | H-05 | Disposal guard: issue #54, its own fix. The race: Phase 3 database triggers |
| Hiding the requester's name from other custodians (D2) happens only on screen. `GET /api/asset_loans` and `GET /api/asset_transfers` still send every requester's name to anyone who calls them, logged in or not. Real privacy needs the server to filter by role. **Step 13b:** a session is needed now, but every signed-in role still gets the names (answer 1, 2026-10-15) | C-02, D2 | Session: done in 13b. The names filtered for Custodians: 13c |
| A loan's requester is the `borrower_id`, which the server resolves from the name typed in the borrow form and otherwise sets to `DEFAULT_CUSTODIAN_ID` (user 1, ITS Admin). The form fills in the custodian's own name, so this normally matches. If they type a different name, their own request shows them "Requested by another user", and Staff see that other name | H-10 | Phase 3 (borrower from the session) |
| `GET /api/asset_loans` seeds a pending loan with id 9 on the first asset whenever no pending loan exists (H-08). With the #25 guard, that seeded row now also blocks new requests on that asset until someone decides it. On the current database loan 9 already exists, so the seed's insert fails silently and nothing changes; it matters only on a fresh database | H-08 | Delete the seed block (H-08), its own fix |
| **Transfers superseded (2026-10-04).** Custodian-to-custodian transfers will become a custodianship queue: the custodian releases to Staff, Staff assign the next custodian. Design not final. Today's transfer behavior is kept, and step 12 moves the code without the Lab Head approval rule the earlier decision asked for. **Moved that way in step 12 batch 1** (`574ded38`) | Question 1 | Issue #22, after the restructure with the Phase 3 tables |
| **Inspection photos (2026-10-04):** at most 3 per report, stored high resolution and deleted after 2 weeks (whether to keep one compressed copy as audit evidence is still being confirmed). Asset registry pictures are compressed and kept | M-17 | Phase 3 |
| **Repository visibility (2026-10-04):** the repo will be made private. Git history stays as is, no rewrite. The account passwords in it are test data and will be rotated later | C-01 | Issue #9, team action |
| When the server cannot be reached, the login form says "Invalid institutional email address or password.", which sends the user looking for a typo when the real problem is the network. Same message as before step 7, so it was kept. **Step 13a:** not affected (no answer arrives); a server failure during login now shows "Something went wrong on the server. Please try again." | H-16 family | The web side (typed errors), or a small fix with `Login.tsx`; noted for later; when is not decided yet |
| Browsers that opened the app before step 7 still hold `dlsu_equipment_ms_db_v2` in localStorage, with the demo passwords inside. Nothing reads it any more and nothing writes it, but nothing clears it either. The same is true of `ems_pending_disposals` from step 6 and `ems_inspections` from step 8 part 2. Harmless to the app; worth a line in the team announcement ("clear site data once") | C-03 | Team announcement, no code |
| The Phase 1 and 1B documents (01A, 01B, 01C, 01E, and others) still link to `src/app/prismaClient.ts`, which no longer exists. They are dated records of the code at the time and are not edited. The file can still be read with `git show fbfcccda:src/app/prismaClient.ts` | n/a | No action |
| `strict: false` is a deliberate starting point. Turning strict on is worth doing once the count is near zero, not during the move | H-13 | After step 9 |
| **Three analytics endpoints are reached only from widgets nothing renders.** Seven exported analytics widgets are not used by any view or page: `GrantReadinessIndex`, `ComplianceWidget`, `AuditDiscrepancyWidget`, `DisposalActionList` (Director), `IdleTimeAnalyzer`, `IdleTimeDurationFrequencyWidget`, `LoanRecommenderList` (Lab Head). The last three are the only callers of `GET /api/analytics/advanced/idle-time`, `idle-frequency`, and `loan-recommender`. Those three are **not** among the 11 no-caller endpoints the 2026-10-04 decision deletes, so they stay mounted unless the team extends the decision. **Decided 2026-10-07:** keep the widget code and the three endpoints for now; the widgets moved to `legacy/analytics-widgets/` (`99eb7191`). The three endpoints are **not** part of the step 12 deletion. They stay unauthenticated until step 13. **Step 12 batch 4** (`9265911f`): the three are live in `server/features/analytics/`, with the five other live analytics endpoints | 01C section 4.4 (same family) | Done (moved); endpoints: a later team decision |
| `AssetImagePlaceholder` picks its icon from display names ("Computing Array" and others) that the database categories (`DEV_KIT`, `MONITOR`, ...) never match, so every asset without a picture shows the computing icon and the label "ASSET" | n/a (new) | Small fix branch |
| The success screens of the loan, transfer, and repair forms show a reference number made up in the browser (`LOAN-123456`, `TRF-...`, `MNT-...`), not the id the database gave the request (`LOAN-22`). The return form falls back to a made-up `CLR-` number when the server call fails. A user who quotes that number to Staff gives them a number nothing records. **Step 13a** changed no screen | n/a (new) | The web side (typed responses), or a small fix branch; noted for later; when is not decided yet |
| `LocationStatusWidget` (Staff analytics) shows invented figures when its endpoint fails: fixed shares of the asset count (60% available, 30% on loan, and so on), with nothing on screen saying they are estimates. Same family as the server's invented series. `TODO(H-09)` marks it. Not done in step 12 batch 4 (server code only); the server's own invented values are batch 4 proposal 2 | H-09 | A web fix, with batch 4 proposal 2 |
| The Director's audit trail and CSV export use the database reports (`asset_reports`) for an asset, and fall back to this browser's own copies (`ems_inspections`) when the asset has none. Decision 2 covers the Staff log only; this second reader of the browser copy should be settled in the same commit. **Done in step 8 part 2** (`82bc2e8e`): the audit shows only database reports | F-28 | Done |
| `avatar.tsx` and `checkbox.tsx` in `web/components/ui/` are imported by no file. Kept, since primitives are cheap and a later screen may use them | n/a | No action, or remove in a cleanup |
| The sidebar sets a 150 ms tooltip delay (`TooltipProvider delayDuration={150}`), but the shadcn `Tooltip` wraps itself in its own provider with delay 0, and the nearest provider wins. So the 150 ms has no effect and tooltips show at once | n/a (new) | Cosmetic, small fix |
| Left for step 8 part 2, once `ITSDashboard.tsx` leaves `src/`: remove the `@` alias (`vite.config.ts`, `tsconfig.json` `@/*`), the `src` entry in `tsconfig.json` `include`, the temporary `src/` line in `web/styles/tailwind.css`, and the `src/` line in the root `README.md`. The `figma:asset` resolver in `vite.config.ts` points at `src/assets/`, which does not exist, and nothing imports `figma:asset/...`; it can be removed or repointed then. **Done in step 8 part 2** (`7ca707c5`): all removed, including the resolver (L-06) | n/a, L-06 | Done |
| **Step 8 part 2, new:** the intake wizard's serial is generated once, when the module loads. After a successful registration, and every time the Register tab opens, the form offers the same serial again until the page is reloaded, so two registrations in one session get the same serial unless Staff change it. True before the split too. **Decided 2026-10-08:** a bug, fixed after the restructure (issue #47) | n/a (new) | Issue #47, after the restructure |
| **Step 8 part 2, new:** the finalize dialog's Inspector Role (TSG Staff, ITS Staff, Lab Head, Custodian) was stored only in the browser copy of the report. Since that copy is gone it reaches nowhere; the database records the reporter's account. The field could be removed, or stored with the report. **Decided 2026-10-08:** keep the field; it will be stored with the report in Phase 3 (issue #48) | F-28 | Phase 3 (issue #48) |
| **Step 8 part 2, new:** the Inspections queue's "Last Inspected" column shows the procurement date (or the literal "Jan 15, 2024"), not the newest report. `TODO(F-28)` marks it | F-28 | Phase 3, or a small fix using the reports the page already loads |
| **Step 8 part 2, new:** `RepairAlertCard` is rendered by no page, before or after the split. It moved to `web/features/repairs/` so `ITSDashboard.tsx` could go; its TSDoc says it is unused. Same question as the analytics widgets: keep, quarantine, or delete. **Decided 2026-10-08:** move it to `legacy/`. **Done** (`89d2212c`, `legacy/repair-alert-card/` with a README) | n/a | Done |
| **Step 8 part 2, new:** `EditAssetDialog` has its own inline category list (the same 20 values as `ASSET_CATEGORIES`) and defaults a missing category to "IT Equipment", which is not a category. Step 3 replaced the intake copy but not this one. **Not done in step 12 batch 3,** which moved server code only (the server stores DEV_KIT for "IT Equipment") | n/a | Small web fix |
| **Step 8 part 2, new:** the Custodian report banner still says "SCHEDULED BY TSG" and names the cycle, though nothing schedules inspections any more. The cycle comes from each browser's own setting (F-38). **Step 9** (`d9d95f18`) changed the text to "SCHEDULED BY STAFF", as asked; the banner still implies a schedule that nothing sets | F-38, H-18 | With issue #34 |
| **Step 8 part 2, new:** invented figures on Staff screens, all pre-existing: the Overview "System Operational Index" is a fixed 97.8%, and the Health benchmark grid has no data source, so its table is empty and its four summary numbers are fixed text. `TODO(H-09)` marks both. Not done in step 12 batch 4 (server code only) | H-09 | A web fix (remove the grid or give it data), with batch 4 proposal 2 |
| **Step 8 part 2, new:** the QR print window pastes asset names and labs into its HTML unescaped. `TODO(H-20)` marks it | H-20 | Step 13 (shared escaping) |
| **Step 9, new: the rest of M-11 is still open.** Step 9 fixed only `ITS_STAFF`. Still true: `ADRIC_SECRETARY` gets the Staff dashboard (and unit ITS), which was already so; an account with several roles gets only the first match; the mapping is written out twice in `server.ts` (login and `/me`); and sign-up approval maps a requested "ITS" to `ADMIN`, so no `ITS_STAFF` account can be created through the app (the sign-up form only ever requests Custodian, so this is reachable only through the C-05 fallback). The live database has no `ITS_STAFF` or `ADRIC_SECRETARY` account today. **Step 12 batch 3:** the login and `/me` mapping is one function now (`appRoleFor`); the rest is unchanged, with `TODO(M-11)`. **Decided 2026-10-08:** the Secretary gets the Director view, on the ITS removal branch (whether it can approve and sign off is still open); `ADMIN` gets its own Admin role after step 13; the `ITS_STAFF` fix is verified by code reading only and gets a Phase 2 test on the local test database | M-11, C-05 | ITS removal branch, step 12 (auth, one mapping table), Phase 2 (test), after step 13 (Admin) |
| **Step 9, new: `staffUnit` protects nothing by itself.** The session carries the unit for issue #41, but the session is an unsigned email cookie (C-06) and the server checks no role on any write (C-02). Different edit and delete rights for ITS and TSG only mean something once the server enforces them. **Update 2026-10-08:** ITS is being removed, so #41 becomes "TSG or Admin gets the edit or delete right for assets with no history", still open and related to issue #19; `staffUnit` goes with the ITS removal branch | C-02, C-06, issues #41, #19 | Team decision on #41; enforcement after step 13 |
| **Step 9, new:** a ticket's forwarding unit (`forwardedTo`: TSG, ITS, Both) is chosen in the repair form and set by Send to Maintenance, but the server never stores it, so "Dispatched To" always shows a dash. Pre-existing; `useRepairTickets.ts` already says so. Step 9 kept the per-unit value for when it is stored. **Not done in step 12 batch 2:** storing it needs a column (schema) and a server change, and the batch moved code only | n/a | Phase 3 (a column), or with the ITS removal branch |
| **Step 9, new:** the Staff analytics endpoint is still `GET /api/analytics/tsg`, called by `getTsgAnalyticsRaw` in `web/api/analytics.api.ts`. Renaming the URL is a backend change. **Step 12 batch 4 moved it as it is** (a URL change is not a move); the rename is batch 4 proposal 7 | n/a | Batch 4 proposal 7, its own commit |
| **Step 9, new:** `roleConfig` in `Sidebar.tsx` gives each role a `label` and `subtitle` that nothing renders (only `nav` is used). Step 9 gave Staff plain values. Cosmetic | n/a | Cleanup, no hurry |
| **Step 10, new:** 17 one-off scripts in `scratch/` import `../prisma` or `../mailer`, which no longer exist at the root, so they fail with "module not found". They are not part of the app, excluded from the typecheck, and 01D moves `scratch/` to `scripts/` later. Fixing an import is one line (`../server/config/prisma`), and with step 10 they also need the five `DATABASE_*` variables | n/a | When `scratch/` becomes `scripts/` (01D section 7) |
| **Step 10, new:** `server/app.ts` keeps `cors()` open to every origin and the 50 MB body limit. 01D section 6 lists an origin allowlist and a lower limit for `app.ts`; both change behavior. `TODO(C-02)` and `TODO(M-17)` mark the lines | C-02, M-17 | CORS: done in 13b (`b8dac95c`, `WEB_ORIGIN` only, with credentials). The limit: Phase 3, with the image storage |
| **Step 10, new:** the backup job's "inside the repository" guard takes the working folder as the repository, so it holds only when the server is started from the repository root (which every npm script does). Started from elsewhere, a `BACKUP_DIR` inside the repository would pass. Pre-existing since step 0; a comment says so. **Gone with the job in step 12 batch 4** (`1a3b3bbd`) | C-01 | Done |
| **Step 10 hand checks, new (2026-10-09):** bell cards open a not-found page (404) for most roles, because a card links to a tab that does not exist under the viewer's own route tree. For example, a Lab Head's Return Request card goes to `/lab-head/returns`. Pre-existing in the original code, not caused by step 10. Issue #55 | n/a (new) | Issue #55; the bell rewrite (01D section 8) |
| **Old analytics changed (2026-10-08).** The 2026-10-04 decision to delete the 11 no-caller analytics endpoints in step 12 is replaced: none of the 22 untested analytics endpoints is deleted (the 11 from `legacy/analytics-v1/` and the 11 that never had a caller). In step 12 their handler code moves to `legacy/analytics-endpoints/` with a README, and their routes are unregistered. The three endpoints kept on 2026-10-07 (`idle-time`, `idle-frequency`, `loan-recommender`) are not among the 22 and stay mounted. Earlier lines in this log that say "deleted" or "the step 12 deletion" are kept as dated records. **Done in step 12 batch 4** (`c5ff5d27`, labelled behavior change): the 22 handlers are in `legacy/analytics-endpoints/` with a README, unregistered, and answer 404 | 01A 6.11, M-06 | Done |
| **Step 11, new:** `server/shared/services/custodyRequestGuard.ts` calls Prisma itself (latest asset record, pending loan, pending transfer), an exception to "only repositories call Prisma", because the assets and transfers repositories do not exist yet. `loans.repository.ts` likewise reads `assets`, `users`, and `user_centers`. **Step 12 batch 1:** `transfers.repository.ts` exists now, but the guard keeps all three reads until the assets repository exists, so they move together. **Done in step 12 batch 3** (`569a175d`): the guard calls `assets.repository.ts` `findLatestRecordStatus`, `loans.repository.ts` `findPendingLoanId`, and `transfers.repository.ts` `findPendingTransferId`, and no longer imports `config/prisma`; the loans repository's asset and name lookups moved too (its two H-08 seed reads and its list lookups stay) | n/a | Done |
| **Step 11, new:** the web loan responses are not typed. Typing them would add type errors at existing mismatches: `DirectorAnalyticsView.tsx` compares loans by an `asset_tag` field the list never sends (the match works through `assetId`, so those comparisons are dead), and `LabHeadAnalyticsView.tsx`'s unused handler sends "reject". Not done in step 12 batch 4 (server code only) | H-13 | A web fix, with the dead handlers |
| **Step 11, new:** a borrow request's due date is checked for presence only, not that it is a date or in the future (01D section 5 lists the minimum date) | n/a | Phase 3, or a small fix with the loans validation |
| **Step 11, new:** the loan approval reads the asset's latest record by `date_logged` only, while the H-05 guard and `GET /api/assets` also tie-break on `asset_record_id`. Two records in the same second could hand the approval the wrong condition or location. `TODO(M-09)` marks it in `loans.repository.ts`. **Step 12 batch 1:** the return, the transfer request and approval, and the disposal approval read the latest record the same way; `TODO(M-09)` marks each in its repository. The transfer and disposal lists also order by one-second columns with no tie-break, so rows filed in the same second come back in no fixed order. **Step 12 batch 2:** the same in the repair progress update (its record reads), the inspection report (the record read; the report read does tie-break on `report_id`), the repair list, and both report lists. **Step 12 batch 4:** the same in location status and the idle charts; the Director, Lab Head, and Staff dashboards do tie-break. Step 12 changed none of them (behavior-neutral), so the `TODO(M-09)` lines now say Phase 3 | M-09 | Phase 3, with the shared asset state rule (batch 4 proposal 6) |
| **Step 11 hand checks, new (2026-10-09):** the bell and the Custody tab do not refresh each other. A loan decided on the Custody tab does not update the bell until a page reload, and a loan decided from the bell does not update the Custody tab while it is open. The bell reads `dbLoans` in `web/state/serverData.tsx`, loaded once at login; the Custody tab keeps its own `loanRequests` list. Pre-existing, not caused by step 11 (the web bundle is identical to `main`). Filed by Raiki as issue #57 | n/a (new) | Issue #57, fixed with #55 on a bell fix branch; the bell rewrite (01D section 8) |
| **Step 12 batch 1, new:** the transfer and disposal emails are sent after the answer and not awaited. `sendEmail` catches its own send failures, but nothing catches the email lookup before it (`getUserEmail`, `getRoleEmails`): if that database read fails, the promise rejection is unhandled, and Node stops the server process by default. Pre-existing; the move kept it exactly. A comment marks both places. Filed as issue #60 | n/a (new) | Issue #60: a small fix (catch and log), outside the restructure |
| **Step 12 batch 1, new:** the transfer emails say the recipient decides ("Please review and accept or decline", "The recipient has accepted"), but no screen lets the recipient decide: the Lab Head does, and the server checks nobody (C-02). The disposal request email sends the Director to "the Clearance & Disposal tab", which the sidebar calls "Approvals & Holds" | n/a (new) | Transfers: with the custodianship queue (issue #22). Disposal wording: a small fix |
| **Step 12 batch 1, new:** `GET /api/asset_returns` has no caller in the web app; only the Phase 2 tests call it. It moved with returns, unchanged | n/a | Keep for the return requests of Phase 3 (H-02), or remove with a team decision |
| **Step 12 batch 1, new:** a return's reference number is `CLR-` plus the current time in milliseconds (base 36), and `reference_number` is unique, so two returns finalized in the same millisecond would collide and the second would fail with a 500. Unlikely with one Staff member finalizing at a time | n/a (new) | Phase 3, with the return requests (H-02) |
| **Step 12 batch 1, new:** the asset lookup by tag now has four copies (the loans, returns, transfers, and disposals repositories) and the typed-name lookup three (loans, returns, disposals), each reading another feature's table. They are the same one-line queries, kept per feature as in step 11. **Step 12 batch 2:** six copies of the asset lookup (repairs and inspections added) and four of the typed-name lookup (repairs added); inspections also has its own user-by-email lookup, like transfers. **Done in step 12 batch 3** (`569a175d`): one asset lookup (`assets.repository.ts` `findByTag`), one typed-name lookup and one email lookup (`auth.repository.ts`), each the same query as the copies it replaced. Still apart: `inspections.repository.ts` `findAssetById` (the same query as `assets.repository.ts` `findById`), `transfers.repository.ts` `findLatestRecord` (different ordering, M-09), and each feature's list lookups. **Both folds done in step 12 batch 4** (`13c33c2c`): `findAssetById` is gone, and `findLatestRecord` is its own function in `assets.repository.ts`. Each feature's list lookups still read `assets` and `users` wholesale (M-01) | n/a | Done. The name lookups go in step 13 (issue #32) |
| **Step 12 batch 1 hand checks, new (2026-10-09):** before a return is finalized, the return form's "Clearance Certificate ID" field shows a random `CLR-` placeholder (`Math.random()` in `web/features/returns/ReturnForm.tsx`, `displayCertId`) that changes on every render. After finalizing, the real number from the server replaces it. Pre-existing, not caused by step 12. Issue #59 | n/a (new) | Issue #59, a small web fix |
| **Step 12 batch 1 hand checks, new (2026-10-09):** the issue #57 gap also affects transfers. A transfer approved on the Custody tab still shows Approve and Decline in the bell until a full page reload. A second decision from the bell is refused by the server (400, "already approved"), so no data changes, but the bell only logs the refusal to the browser console and the card stays (same family as the H-16 note on bell failures). Pre-existing, not caused by step 12. Added to issue #57 | n/a (new) | Issue #57, fixed with #55 on a bell fix branch; the bell rewrite (01D section 8) |
| **Step 12 batch 2, new: three 01D changes proposed, not made.** Deleting the repair duplicate guard (M-07), merging the two repair status endpoints (H-06), and merging the two report listings (L-07) all change behavior, so batch 2 moved them as they are (instructed). Effects and the tests each would update are in the batch 2 detail ("Proposals for separate commits"). The web TODOs that promised the merges "in step 12" now say so | M-07, H-06, L-07 | Its own commit each, if the team agrees |
| **Step 12 batch 2, new:** the Phase 2 test log sent several inspection and repair findings to "step 12 (inspections)" or "step 12 (repairs)": an unknown condition saved as PERFECT (issue #53, see its note below), a bad `reportedById` answering 500 with Prisma's raw text, the image stored without the asset image check, the invented "DLSU Campus" record, `/status` saving a status of only spaces, and the duplicate guard answering 409 for an unknown tag. Each changes behavior and is pinned by a test, so none was fixed in the move; each has a `TODO` or a comment at its line. **Step 13a:** the bad `reportedById` now answers the generic 500 with no Prisma text (its test updated); it still answers 500, not 400 or 404 | H-07 family, H-16, H-10, H-09 family, H-06 family, M-07 family | The unknown condition: issue #53. H-16: done in 13a, apart from a check for the id (its own fix). H-10: 13c. The rest: their own fixes and the proposals above |
| **Step 12 batch 2, new:** a completed repair writes a record and a report, and a maintenance status writes a record, but none of them sets `asset_records.repair_id`, so the history cannot link a record to its ticket | n/a (from the Phase 2 test plan) | Phase 3, with the repair status enum (H-07) |
| **Step 12 batch 2, new:** `GET /api/asset_repairs` sends the reporter's name as `custodian`, and screens label it that way, but the reporter is not necessarily who holds the asset (a Lab Head or Staff can report someone else's equipment) | n/a | With the repairs screens, or the H-06 merge |
| **Issue #53 (confirmed by Raiki, 2026-10-10):** `POST /api/assets/:assetTag/inspection` saves any condition it does not recognize (a typo, lower case, or the stored spelling "MINOR DRIFT") as PERFECT, writes it onto the asset, and answers 200. Expected: answer 400 for an unknown condition and write nothing, as the return route does with `ASSET_CONDITIONS`. Pinned by `tests/api/inspections.test.ts`. Step 12 batch 2 moved it unchanged; `TODO(H-07)` at the condition fallback in `server/features/inspections/inspections.validation.ts` names #53 | H-07 family | Issue #53, its own fix (updates the pinned tests) |
| **Step 12 batch 2 hand checks, new (2026-10-10):** the Staff "Submit & Finalize Inspection" button can save the same report twice (seen as `asset_reports` rows 35 and 36, one second apart). Its handler in `web/features/inspections/InspectionQueue.tsx` awaits `syncFromDb()` before posting and does not disable the button while it waits. Pre-existing, not caused by step 12 (the file is unchanged, the web bundle identical to `main`). Issue #63 | n/a (new; same family as M-07) | Issue #63, a small web fix (lock the button, or post before the reload) |
| **Step 12 batch 2 hand checks, new (2026-10-10):** React warns of a duplicate key `MNT-0001` in `InspectionQueue.tsx`. The queue builds each ticket id from the asset tag with its leading letters stripped, so assets with the same number in different labs collide. Pre-existing. Issue #62 | n/a (new) | Issue #62, a small web fix (use the full tag or the asset id) |
| **Step 12 batch 2, for Phase 3:** `asset_reports` holds three kinds of report (the custodian condition report, the Staff inspection, and the report a completed repair files) with no column saying which, and two listings read it (L-07). A report type column would let the log and the audit tell them apart; it fits with the L-07 merge | L-07 | Phase 3 (a column), with the L-07 merge |
| **Step 12 batch 3, new: nine 01D changes proposed, not made.** For auth: delete `POST /api/auth/register` (#70), delete the approval body fallback (C-05, #71, after #68), stop sending passwords (C-04, 01C 4.1, #72), and fix the account update's lab handling (#73). For assets: append on edit (H-14, M-09, M-16, #74), retire instead of delete (H-03, #69), drop the email and id number from the custodian history (01C 4.2, #72), the tag inside the transaction (H-11, #75), and the list rewrite (M-01, #76). Effects and the tests each would update are in the batch 3 detail ("Proposals for separate commits"); each issue is named in the `TODO` at its line | C-05, C-04, H-14, M-09, M-16, H-03, H-11, M-01 | Issues #69 to #76, its own commit each |
| **Step 12 batch 3, new:** registrations live in `server/features/auth/`, not in a `features/registrations/` folder as 01D section 2 lists, as instructed for the batch. The web side already had them in `web/api/auth.api.ts` (step 5) | n/a | No action |
| **Step 12 batch 3, new (issue #14, confirmed 2026-10-11: registration accepts the same email more than once):** the sign-up email check looks at accounts only, not at pending sign-ups, so one email can be requested twice; approving the second then fails with a 500 (Prisma's unique constraint text). Kept as is, as instructed; a comment in `auth.service.ts` names the issue | issue #14 | Issue #14, its own fix |
| **Step 12 batch 3, new:** a sign-up's id is "REG-" and six random digits. Two requests can draw the same id; approving or rejecting one then removes both from the list (the removal filters by id) | n/a (new) | Phase 3, with the sign-up table (H-17) |
| **Step 12 batch 3, new:** `GET /api/assets` reads the whole `projects` table and never uses it, and its `reporterRole` reads a `role` field users does not have, so it is always "Inspection Inspector" (one of the four type errors that moved with the list) | M-01, H-13 | The list rewrite (proposal 9), or a small fix |
| **Step 12 batch 3, new:** with no JSON body, each of the six auth routes that read one answers 500 with a TypeError text ("Cannot destructure property ... of 'req.body' as it is undefined"), not 400, because Express 5 leaves `req.body` undefined. Pre-existing; the move kept it exactly. **Step 13a:** the answer is now the generic 500, with the TypeError in the terminal. The same holds for routes of loans, returns, transfers, disposals, repairs, inspections, and assets: 20 routes in all in the side-by-side runs. A `TODO` in `auth.controller.ts` | H-16 family | `errorHandler` done (13a). Left: a body check that answers 400, its own fix; noted for later; when is not decided yet |
| **Step 12 batch 3 hand checks, new (2026-10-11):** after a sign-up, `web/pages/auth/Register.tsx` adds its own copy of the request to the in-memory list, with its own id (`REG-<timestamp>`), while the server stored the request as `REG-<6 digits>`. In that tab, approving sends the wrong id, so the account is created through the C-05 body fallback and the request stays in the file; rejecting removes nothing on the server. After a reload or restart the list comes from the server and the ids match. Pre-existing. Issue #68; removing the C-05 fallback (#71) needs it fixed first | C-05 family (new) | Issue #68, a small web fix (use the id the server answers with) |
| **Step 12 batch 3 hand checks (2026-10-11):** deleting an asset that has an `asset_reports` row answers 500 ("Foreign key constraint violated on the fields: (`asset_id`)" at `tx.assets.delete`) and the transaction rolls back, as H-03 says. Seen on the shared database in hand check 8. Issue #69 (proposal 6) | H-03 | Issue #69 |
| **Issue #8 (confirmed 2026-10-11):** an asset edit can fail with Prisma's interactive transaction timeout (P2028, "expired transaction") on the slow CCS Cloud link: the edit runs several round trips inside one transaction (`assets.repository.ts` `saveEdit`, named there). Not changed by batch 3. Note: the `c6cf958f` commit message pairs issue #8 with H-14; #8 is this timeout, and H-14 is the overwrite (#74) | n/a | Issue #8, its own fix (fewer round trips, or a longer timeout) |
| **Step 12 batch 4, new: eight analytics changes proposed, not made.** The Director lab filter on every figure, deleting the invented values (H-09), the Lab Head overdue list without pending requests (H-04), inspection progress from reports, labs from data instead of text (M-03), the M-09 tie-break and current records only, renaming `/api/analytics/tsg`, and refusing bad input (H-16, M-14). Each changes what a chart shows and is pinned by a Phase 2 test; effects and tests in the batch 4 detail ("Proposals for separate commits"). **Step 13a** removed Prisma's text from the unknown-category 500 (now generic); proposal 8 itself (a 400, and the M-14 prefix check) is still open | H-09, H-04, M-03, M-09, H-16, M-14 | Its own commit each, if the team agrees; the Lab Head's lab from the session with 13b or 13c |
| **Step 12 batch 4, new:** `test-user.ts` at the root (`npm run seed`, already broken, L-04) is the one file outside `server/features/*/` repositories that still imports `config/prisma`. It is not part of the server. 01D replaces it with `prisma/seed.ts` in step 14. `legacy/analytics-endpoints/analyticsEndpoints.ts` also names it, through an import path that no longer resolves | L-04 | Step 14 (`prisma/seed.ts`) |
| **Step 12 batch 4, new:** the one-off scripts in `scratch/` (`test_endpoints.ts`, `test-fetch.js`, the `replace-analytics` scripts, and two old copies of `server.ts`) call or contain the 22 old analytics endpoints. They are not part of the app; those calls now get 404 | n/a | When `scratch/` becomes `scripts/` (01D section 7) |
| **Step 12 batch 4, new:** the loan recommender lists every ACTIVE record of `asset_records`, history included, so an asset on loan today is suggested once per earlier ACTIVE record, and the asking lab's own assets are not left out. No live caller | M-09 family (new) | Batch 4 proposal 6, if the widget comes back |
| **Step 12 batch 4, new:** analytics answers `{ success: true, data }` with every borrower's name and email (Lab Head) and asset values (Director) to anyone who calls it, as before (C-02) | C-02, 01C 4.4 | Roles: done in 13b (the Lab Head figures go to Lab Heads only, the Director's to the Director only). The Lab Head's lab from the session: 13c or later |
| **Step 12 batch 4 hand checks, new (2026-10-13):** the asset detail modal shows an old status until a reload. After a Lab Head approved a loan, My Assets showed `CITe4D-0001` as On Loan, but its modal showed Active with Request Loan. `web/features/assets/AssetDetailModal.tsx` (line 98) prefers the asset from the shared `web/state/serverData.tsx` list, and `web/pages/custodian/CustodianPortal.tsx` refreshes only its own list (`fetchDbAssets`), not `syncFromDb`, so the two disagree until a reload. Pre-existing, not caused by batch 4 (it changed `web/` only in two comments). Issue #89 | n/a (new; same family as issue #57) | Issue #89, a small web fix (one list, or refresh both); the bell rewrite (01D section 8) |
| **Step 12 batch 4 hand checks, new (2026-10-13):** Send Inspection Report lists the custodian's assets that are under maintenance (`custodianAssets` in `CustodianPortal.tsx` hides only Disposed), falls back to every asset when the custodian holds none, and the server accepts a report for an asset in any status (`POST /api/assets/:assetTag/inspection` checks no state). Pre-existing, not caused by batch 4. Issue #88 | n/a (new; H-05 family on the server side) | Issue #88: the web list, and a status check on the inspection route (its own commit, updates the inspection tests) |
| **Step 13a, new:** Express's own error pages are still HTML: the 404 for an unknown path, and the 400 for a path parameter that cannot be decoded (`/api/assets/%E0%A4%A/custodian-history`). Outside production (`NODE_ENV` not `production`, which is every machine today) that 400 page shows the error's stack with the server's file paths. Kept, because 13a had to leave every answer other than a 500 the same, and the brief said to keep the 404 | H-16 family | A small follow-up: JSON for both in errorHandler (and a not-found handler, if the team wants one), or `NODE_ENV=production` on the deployed server |
| **Step 13a, new:** errorHandler prints the whole error of an unexpected failure. For Prisma errors that is the same text the old `❌` lines printed (the call, the source lines, the message); it does not print the request body. The `🚀` lines before the checks still print whole bodies, passwords and base64 pictures included, as before (M-17) | n/a (new) | With 13b (the login body) or Phase 3 (pictures) |
| **Step 13b, new:** the logged-out list lives in the server's memory. A restart forgets it, so a cookie logged out before a restart works again until its 8 hours end. Accepted in the 2026-10-13 decision | C-06 | Accepted; a sessions table later, if the team wants one |
| **Step 13b, new:** `requireAuth` reads the account and its roles from the database on every request (accepted 2026-10-15): one more query per request on the CCS Cloud link, whose slowness is issue #8. **After the hand checks:** it showed, as P2039 pool timeouts on CCS Cloud | n/a | Done: kept per cookie for 60 seconds (`128896fb`) |
| **Step 13b hand checks, new:** on CCS Cloud, dashboards took 10 to 90 seconds and lists answered 500 with Prisma's P2039 pool timeout (8 active connections, none idle, after 10 seconds) on `GET /api/asset_loans` and `GET /api/asset_disposals`. The Director's dashboard alone sends about 140 list requests (row above, M-01). 13b's extra query is now cached; the link itself and the repeated requests are not changed | issue #8, M-01 | Issue #8 (the link); page-level loading (01D) and issue #76 (the repeats) |
| **Step 13b hand checks, new:** a page load treated a slow or failing `/me` as logged out, so a valid session was sent to `/login` | n/a | Done: only a 401 logs out; anything else is retried, then offers Retry (`4c6bbc83`) |
| **Step 13b, new:** the server checks the role, not the lab. Any Lab Head may decide any lab's loan, and any Lab Head can read any lab's analytics through `?labPrefix=`. `TODO(M-02)` in `loans.routes.ts`, `TODO(C-02)` in `analytics.validation.ts` | M-02, C-02 | 13c or later (01C tier 3 item 21) |
| **Step 13b, new:** the bell still lists loan cards for Staff as needing action and counts them in the badge, although Staff no longer have the Authorize Loan button (Staff transfer cards were already like this) | n/a | The bell rewrite (01D section 8), or a one-line change if the team wants it sooner |
| **Step 13b, new:** opened at `http://127.0.0.1:5173`, the app cannot log in (another origin for CORS, and another site for the cookie), and the login form says the password is wrong (the network message in the H-16 row above). `.env.example` says to use `localhost` | H-16 family | The message: the web side of H-16 |
| **Step 13b, new:** in the browser check, one pass over the Director's five tabs sent about 140 list requests, many of them repeats (`GET /api/assets` and `GET /api/asset_disposals` several times per tab); each now also costs the session query | M-01 | Page-level loading (01D) and the asset list rewrite (issue #76) |

**Note 1 (step 0):** no comment commit. `server.ts` is excluded from the comment pass because it is about to be split, and `.gitignore` and `.env.example` carry their own inline explanations.

**Note 2 (step 1):** no comment commit. The step created only `tsconfig.json` and edited `package.json`, both JSON, where TSDoc and file headers do not apply. The reasoning lives in this log instead.

**Note 3 (step 2):** no comment commit, by design. Per the prompt, files quarantined into `legacy/` get only their README, not per-file headers or TSDoc. Commenting dead code would imply it is maintained.

**Note 4 (step 7):** no comment commit. The step created and moved no files: it deleted one and edited `Login.tsx`. `Login.tsx` moves to `web/` in step 8 and gets its file header and TSDoc there, per the rule "comment code at its destination, when it lands".
