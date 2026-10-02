# 02. Restructure Log

Running record of the migration in [01D section 9](../phase-1b-deep-map/01D-restructure-plan.md#9-ordered-migration-steps).
Decision and comment standard: [01-restructure-decision.md](01-restructure-decision.md), [../guides/CODE-COMMENTS.md](../guides/CODE-COMMENTS.md).

Branch: `refactor/feature-based-structure` from step 3 on (steps 0 to 2 were on `refactor/option-a-structure`, merged in PR #4). Nothing here is pushed by the agent; Raiki pushes and opens the pull requests.

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
| 5 | Convert the remaining features to the API client | Done, hand checks pending | `5389d51b` to `497d0c30` (9 commits, see detail) | `docs(step 5)` commit (hash recorded next step) | **98** (unchanged, same errors) | 2026-10-02 |
| 6 | Split `context.tsx`, delete localStorage-only actions | Not started | | | | |
| 7 | Delete `prismaClient.ts` | Not started | | | | |
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

**Hand checks owed** (each needs the server and the database):

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
| `prismaClient.ts` has its own `RoleName` type, which is missing `ITS_STAFF` and `CUSTODIAN`. Left alone, since the file is deleted in step 7 | H-01 | Step 7 |
| `LabHeadAnalyticsView.tsx` `handleLoanDecision` is defined but nothing calls it, so it is dead code. It would also fail if wired up: it sends `"reject"`, and the server only accepts `"approve"` or `"decline"` (400). Converted to the client anyway so no loan URL is left outside `web/api/`; `decideLoan` takes a plain string for that reason | n/a (new) | Small fix branch, or step 11 (loans validation) |
| Most call sites check only `success` in the body, not the HTTP status. A minority check the status or content type, or never read the answer at all (corrected in step 5: the step 4 version of this note said no site checks the status, which was true for loans only). The client keeps both styles for now, through plain and `Raw` calls, so steps 4 and 5 stay behavior-neutral | H-16 | Step 13 (`errorHandler`), then remove the `Raw` calls from `web/api/client.ts` |
| `web/api/*.api.ts` return a loose `ApiResult` (any extra fields). The real request and response shapes belong in `shared/types/` | H-13 | Steps 11 and 12, as each backend feature is extracted |
| `docs/reference/AdRIC_DB_Schema.sql` does not match the live database. The live database has different Lab Head accounts (`labhead.bio`, `labhead.car`, and so on, with no `labhead.cite4d`) and different seed passwords, and the Director already holds `ADRIC_DIRECTOR`. Logging in with the credentials from the file fails and silently falls back to the mock login. Reported by Raiki on 2026-10-02. Not part of the restructure, not fixed. **Step 14 should baseline from the live schema, not from this file** | H-23, H-22 (H-22 is already fixed in the live data) | Step 14 |
| Five endpoints put the asset tag into the URL without encoding it (`custodian-history`, `transfer`, `return`, `repair`, `inspection`), while five others encode it (`borrow`, `disposal`, and asset create, edit, delete). Harmless with tags like `EQ-2024-001`; a tag containing `/`, `?`, or `#` would break the unencoded ones. Each API function keeps what its call site did | n/a (new) | Step 12, with each feature's extraction |
| `context.tsx` builds the pending disposals list from the API without `lastCustodian`, `breakdownReasons`, and `disposalPathway`, which the `PendingDisposal` type requires. The typed API result exposed this as a new type error, so that one variable is annotated `any`, as it effectively was before | H-13 | Step 6 (the block is rewritten when `context.tsx` is split) |
| `approveRegistration` in `context.tsx` returns the server's answer and accepts an object, but its declared type says it takes a string and returns nothing. Same treatment: one variable annotated `any` | H-13 | Step 6 |
| `handleTransferDecision` in `LabHeadAnalyticsView.tsx` is dead code like `handleLoanDecision`, and also sends `"reject"` where the server only accepts `"decline"`. Disposals are the opposite: the server wants `"reject"`. Three workflows, two words for the same decision | n/a (new) | Step 12; delete the two dead handlers in step 8 |
| The lab-head analytics endpoint is fetched five separate times by five widgets on the same screen, four of them with an identical query | M-01 (same family) | Step 8, when the analytics view is split |
| `strict: false` is a deliberate starting point. Turning strict on is worth doing once the count is near zero, not during the move | H-13 | After step 9 |

**Note 1 (step 0):** no comment commit. `server.ts` is excluded from the comment pass because it is about to be split, and `.gitignore` and `.env.example` carry their own inline explanations.

**Note 2 (step 1):** no comment commit. The step created only `tsconfig.json` and edited `package.json`, both JSON, where TSDoc and file headers do not apply. The reasoning lives in this log instead.

**Note 3 (step 2):** no comment commit, by design. Per the prompt, files quarantined into `legacy/` get only their README, not per-file headers or TSDoc. Commenting dead code would imply it is maintained.
