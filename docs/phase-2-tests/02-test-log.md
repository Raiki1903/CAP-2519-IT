# 02. Test Log

Running record of [PROMPT-tests.md](PROMPT-tests.md). The plan is [01-test-plan.md](01-test-plan.md); setup and running are in [tests/README.md](../../tests/README.md).

Branch: `test/phase-2-api-tests`, from `main` after PR #50 (`a02786c8` adds the prompt). Nothing here is pushed by the agent; Raiki pushes and opens the pull requests.

---

## Status

| Part | What | Status | Commits | Tests | Date |
|---|---|---|---|---|---|
| A | Vitest, harness, smoke test, test plan, README | Done | `0e9d308e` (Vitest), `ec738f0b` (PORT), `f2058aef` (harness and smoke test), `225770e9` (README and plan), docs housekeeping | 10 (3 smoke, 7 guard) | 2026-10-08 |
| B1 | Auth, assets | Done | `212b69df` (auth and registration), `4fae5b46` (assets), docs housekeeping | 88 (33 auth, 22 registration, 33 assets) | 2026-10-08 |
| B2 | Loans, returns, transfers | Done | `78987f8e` (loans), `43a06080` (returns), `ccd47c25` (transfers), docs housekeeping | 79 (31 loans, 16 returns, 32 transfers) | 2026-10-08 |
| B3 | Repairs, inspections and reports, disposals | Done | `ab494e76` (repairs), `0e81e87b` (inspections and reports), `13edf79d` (disposals), docs housekeeping | 90 (36 repairs, 29 inspections and reports, 25 disposals) | 2026-10-08 |
| B4 | Analytics with a live caller | Not started | | | |

---

## Part A detail

### What was added

- **Vitest 4.1.11** as a dev dependency (`0e9d308e`). It accepts Vite `^6`, so npm reused the installed Vite 6.4.3 (no second copy), and it supports Node 20 and later. Vitest 5 also accepts Vite 6.4 but needs Node 22.12 or later, which a teammate may not have. No other dependency changed; Prisma is untouched.
- **One app-code change** (`ec738f0b`), behavior-neutral: `server.ts` reads its port from `PORT`, default 4000. With `PORT` unset nothing changes.
- **The harness** in `tests/setup/` and the smoke test (`f2058aef`):

| File | Job |
|---|---|
| `testDatabase.ts` | The guard. Reads `TEST_DATABASE_URL` (environment first, else only that key from `.env`) and refuses it unless it is `mysql://`, on `localhost` or `127.0.0.1`, has a user and a password, and names a database ending in `_test` |
| `globalSetup.ts` | Once per run: empties the test database, then `prisma db push` (no flags) with `DATABASE_URL` set for that one command |
| `db.ts` | Prisma on the test database only (it does not import the app's `prisma.ts`), and the reset: checks `SELECT DATABASE()` again, empties every table, restarts ids at 1 |
| `fixtures.ts`, `seed.ts` | The fake data: 8 accounts, lab `TEST`, assets `TEST-0001` to `TEST-0006` in six states, two loans, a repair, a disposal, a report |
| `testServer.ts` | Starts `server.ts` with `node --import tsx` (one process, so stopping it leaves nothing behind), on a free port, from a new temporary folder, with all five `DATABASE_*`, `BACKUP_DIR`, and `MAILGUN_*` set explicitly and `TSX_TSCONFIG_PATH` pointing at the repo's `tsconfig.json` |
| `harness.ts` | `useApiHarness()`: per test file, reset, seed, start the server; stop it afterwards. Returns `api` (fetch) and `db` (Prisma) |
| `guard.test.ts` | Tests the guard and the child environment |

- `package.json` gained `"test": "vitest run"`. `vitest.config.ts` turns off file parallelism. `tsconfig.json` now includes `tests` and `vitest.config.ts`, so the test files are typechecked by `npm run typecheck`.

### Safety, verified on 2026-10-08

- **Guard, both sides.** With `TEST_DATABASE_URL` set to a non-local host, and separately to a local database named `AdRIC_DB` (no `_test`), `npx vitest run` stopped in global setup with "Test database refused" before any test file or database connection. With the real local URL it runs. `guard.test.ts` covers the same rules plus a missing password, a non-MySQL URL, and that no message contains the password or host.
- **The child's database settings.** `guard.test.ts` checks that the child gets all five `DATABASE_*` values from the test URL, that an inherited `DATABASE_HOST` or `DATABASE_URL` is dropped, and that `BACKUP_DIR` and `MAILGUN_*` are empty strings.
- **Path aliases from a temporary folder.** Started from a temporary folder **without** `TSX_TSCONFIG_PATH`, `server.ts` fails on its `@shared/...` import. With it (as the harness does), the server starts and answers. So registration writes are safe to test in B1.
- **Sign-ups stay out of the repository.** A `POST /api/auth/register-request` through the harness wrote `pending_registrations.json` in the temporary folder; the folder was deleted when the server stopped; the repository's `pending_registrations.json` kept its modified time (its contents were not opened).
- **No server left running** after a run (checked for node processes listening on a port).

### Checks

- `npm test`: 2 files, 10 tests passed, run twice in a row.
- `npm run build`: passes.
- `npm run typecheck`: **71**, unchanged; zero errors in `tests/` or `vitest.config.ts` (confirmed those files are in the check).

---

## Part B1 detail

### What was added

Three test files, all against the HTTP API only. They use the shared seed unchanged; the few extra rows a test needs (a second lab, an asset with no records, an old loan, repair, transfer, and return on the asset being deleted) are created inside that test.

| File | Endpoints | Tests | What they pin |
|---|---|---|---|
| `tests/api/auth.test.ts` | `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/account` | 33 | The role and staff unit for 7 seeded database roles, through both login and `/me` (ADMIN, ADRIC_SECRETARY, and ITS_STAFF to Staff/ITS, the M-11 check the team asked for; TSG_STAFF to Staff/TSG; ADRIC_DIRECTOR, LAB_HEAD, CUSTODIAN); the `CITe4D` fallback lab; 400, 401, 404; C-03 (the password in another letter case logs in); C-06 (`/me` answers any email); C-02 (the account update renames whoever the body names); lab link moves; two new findings (notes below) |
| `tests/api/registration.test.ts` | `POST /api/auth/register-request`, `GET /api/auth/pending-registrations`, `POST /api/auth/approve-registration`, `POST /api/auth/reject-registration`, `POST /api/auth/register` | 22 | The request goes to `pending_registrations.json` in the server's **temporary** folder, not the database (H-17); defaults (Custodian, CITe4D, STUDENT, `password123` for C-03); newest first; C-04 (passwords in the list); role mapping on approval (Custodian, Lab Head, TSG, and ITS to ADMIN for M-11); 01C 4.1 (password echoed); C-05 (an unknown id plus body details creates an ADMIN); rejecting an unknown id answers 200; direct registration with and without a lab; one new finding |
| `tests/api/assets.test.ts` | `GET /api/assets`, `GET /api/assets/:tag/custodian-history`, `POST /api/assets`, `PUT /api/assets/:tag`, `DELETE /api/assets/:tag` | 33 | Every seeded state as listed (Active; On Loan with 30 days left; Overdue once the due date passes; Maintenance at the TSG Office; Disposed with the M-13 details), condition numbers, nested records newest first, the M-09 id tie-break; history oldest first with 01C 4.2 (email and id number) and the invented entry (H-09 family); intake tag `TEST-0007`, `CITe4D-0001` with no lab, category clean-up, H-10, image check; edit with H-14, H-10, M-16, and one new finding; delete of the whole history, and H-03 with H-16 (an inspected asset answers 500 with the raw foreign key error, and nothing is deleted) |

A **characterization test** records what the API does today, defects included, so an accidental change fails it. Each file that changes data says in its header which seeded rows it changes, and runs its read tests first. A test that changes a seeded row only for itself (the overdue loan, the M-09 tie, the asset with no records) puts it back in a `finally` block.

### Checks

- `npm test`: 5 files, **98 tests** passed (10 from Part A, 88 new), run twice in a row, about 9 seconds each.
- `npm run build`: passes.
- `npm run typecheck`: **71**, unchanged; zero errors in `tests/`.
- The repository's `pending_registrations.json` kept its modified time across both runs (its contents were not opened).

### Team decision recorded this session

**The 22 untested analytics endpoints (decided 2026-10-08).** None of the 22 analytics endpoints in sections 3.1 and 3.2 of the test plan is deleted; this replaces the 2026-10-04 decision to delete the 11 in section 3.1. In step 12 the handler code of all 22 moves to `legacy/analytics-endpoints/` with a README (one line per endpoint: path, method, what it computed, which tables it read, and its group, 3.1 or 3.2), and their routes are no longer registered, so calling them answers not found. No tests for them in Phase 2, so B4 does not give the section 3.2 group a "responds with 200" test. `server.ts` is not changed for this now. Also recorded in the plan (sections 3.1 and 3.2) and in the "Old analytics" row of the [PROMPT-2-restructure.md](../phase-1c-restructure/PROMPT-2-restructure.md) decisions table.

---

## Part B2 detail

### What was added

Three test files and one setup helper, all against the HTTP API only.

**Why a helper.** A borrow, return, or transfer changes the asset's state, and the issue #25 guard then refuses the next request on it. If every test used the six seeded assets, each test would depend on what the one before it did. So each write test adds an asset of its own with `tests/setup/extraAssets.ts` (`addExtraAsset`: an asset, its monetary row, and one record in the state the test asks for, tags `TEST-0101` onward). The seeded assets are still used where their state is the point: the seeded pending loan (LOAN-2), the asset on loan (LOAN-1, for H-04), and the Maintenance and Disposed assets (for the 409 answers). No seeded row is left changed.

| File | Endpoints | Tests | What they pin |
|---|---|---|---|
| `tests/api/loans.test.ts` | `GET /api/asset_loans`, `POST /api/assets/:tag/borrow`, `PUT /api/asset_loans/:id/decision` | 31 | The list newest first with the lab line moved out of the purpose; H-08 (with no loan pending, the GET inserts LOAN-9 for the first asset and the first student, names its asset "ASUS TUF Gaming A15", and does it only once); the borrow request leaves custody alone; a leading "Dr." is dropped from the typed name; H-10; the issue #25 guard on both sides (first request 200, second 409, and 409 for a pending loan, a pending transfer, On Loan, Maintenance, Disposed); approve adds an ON_LOAN record at the destination lab (Laguna for CeLT, Manila otherwise, the current location when no lab was sent); decline adds nothing; after approval a new request answers 409, after decline 200; 400 for a decided loan, for `"reject"` (the restructure log note), for `"approved"`, for no decision, and for the `LOAN-n` id the list shows; 404 |
| `tests/api/returns.test.ts` | `GET /api/asset_returns`, `POST /api/assets/:tag/return` | 16 | The list (empty, then newest first); the return puts the asset back as ACTIVE with the reported condition, under user 1, at its home lab, comment as remarks; H-04 (LOAN-1 stays `approved`, and the asset list shows the asset Active with no due date); MINOR_DRIFT and CRITICAL_DEFECT save (H-21 cannot be reproduced here); earlier remarks kept without a comment; `inspection` used as the comment; H-10 for an unknown and a missing name; H-05 (a disposed asset is accepted and becomes ACTIVE); 400 for no condition, an unknown one, lower case, and the stored spelling with a space; 404 |
| `tests/api/transfers.test.ts` | `GET /api/asset_transfers`, `POST /api/assets/:tag/transfer`, `PUT /api/asset_transfers/:id/decision`, `PUT /api/asset_transfers/:id/accept` | 32 | The list (empty, then newest first, all four statuses); 01C 4.3 (the recipient's email); M-12 (`pending_approver` shows as Pending); the request from the current custodian to the recipient found by email; H-19 (the lab packed into the justification, the effective date stored nowhere); 400, 404 for an unknown tag and an unknown email; the issue #25 guard on both sides (an asset on loan is accepted); approve and decline as for loans; 400 for a decided transfer, for `"reject"`, `"accept"`, no decision, and the `TRF-n` id; accept appends the remarks; M-12 (the decision then answers 400); two new findings and H-16 (notes below) |

### Checks

- `npm test`: 8 files, **177 tests** passed (98 before, 79 new), run twice in a row, about 15 seconds each.
- `npm run build`: passes.
- `npm run typecheck`: **71**, unchanged; zero errors in `tests/`.
- The repository's `pending_registrations.json` kept its modified time across both runs (its contents were not opened).
- No test is skipped, and none needed a retry.

---

## Part B3 detail

### What was added

Three test files, all against the HTTP API only. No new setup file: the write tests use `addExtraAsset` from B2 (tags `TEST-0401` onward for repairs, `TEST-0501` for inspections, `TEST-0601` for disposals), so each test that changes an asset has one of its own. The one exception is deliberate: a repairs test completes the seeded ticket MNT-1, which brings TEST-0003 out of maintenance; the list tests run before it.

| File | Endpoints | Tests | What they pin |
|---|---|---|---|
| `tests/api/repairs.test.ts` | `POST /api/assets/:tag/repair`, `GET /api/asset_repairs`, `PUT /api/asset_repairs/:id`, `PUT /api/asset_repairs/:id/status` | 36 | The list newest first (`MNT-n`, `acknowledged` false only for the two starting statuses, `Critical` for an immediate ticket; `custodian` is the reporter, see notes); the request opens "Pending TSG Review" or "Awaiting Immediate Dispatch" and leaves the asset alone; the reporter by typed name, "Dr." dropped, H-10; H-05 (a disposed asset takes a repair); M-07 on both sides (same tag and description within 8 seconds answers 409; another description, or another asset, answers 200) and the B1 note (an unknown tag sent twice answers 409, not 404); the three maintenance statuses add one MAINTENANCE record at the TSG Office, and none when already in maintenance; "Fixed & Completed" restores the status, custodian, and location from before maintenance with the new condition and files a report (default remarks and kept condition when none is sent; also on a ticket that never went into maintenance; also on the seeded ticket); H-07 (any text is saved, and "Pending TSG Review" does not take the asset out of maintenance); 400 and 404; on `/status`, H-06 and H-07 (only the ticket changes, even for "Fixed & Completed"), a status of only spaces is accepted, and H-16 (an unknown id, or one that is not a number, answers 500 with the raw Prisma message) |
| `tests/api/inspections.test.ts` | `POST /api/assets/:tag/inspection`, `GET /api/asset-reports`, `GET /api/asset_reports` | 29 | Both lists newest first and L-07 (the hyphen list has `reportId` as a number, the email and the image; the underscore list has `RPT-n` and neither); 01C 4.2 (the reporter's email); the report under the reporter by email, else `reportedById`, else user 1 (H-10, and an unknown email wins over a valid `reportedById`); H-16 (a `reportedById` that is no account answers 500 with the raw foreign key error, and the transaction writes nothing); H-14 (the newest record keeps its id and date and takes the new condition and remarks); the condition names it maps, and PERFECT for anything else (lower case and the stored spelling "MINOR DRIFT" included); `assetCondition` as a fallback; default remarks; remarks cut to 255; any image text stored; a numeric tag as an asset id; an asset with no records gets one at "DLSU Campus"; 404 |
| `tests/api/disposals.test.ts` | `POST /api/assets/:tag/disposal`, `GET /api/asset_disposals`, `PUT /api/asset_disposals/:id/decision` | 25 | The list newest first, any status other than approved or rejected shown as Pending (H-07 family); the request files a pending disposal and leaves the asset alone; M-13 (pathway, last custodian, target date, and justification in one text, lines left out when not sent); H-10; H-05 (an asset on loan, in maintenance, or disposed is accepted; a second pending disposal on one asset is accepted, and approving both writes two DISPOSED records); approve adds a DISPOSED record carrying the disposal id, the last custodian, the condition, and no current location, and the asset list reads the details back out of the text; an asset on loan is disposed under its borrower; reject changes nothing on the asset; 400 for a decided disposal, for `"decline"`, `"approved"`, no decision, and the `DISP-n` id; 404 |

### Checks

- `npm test`: 11 files, **267 tests** passed (177 before, 90 new), run twice in a row, about 21 seconds each.
- `npm run build`: passes.
- `npm run typecheck`: **71**, unchanged; zero errors in `tests/`.
- The repository's `pending_registrations.json` kept its modified time across both runs (its contents were not opened). No test server was left listening.
- No test is skipped, and none needed a retry.

---

## Notes: noticed, not fixed

| Note | Finding | Where it belongs |
|---|---|---|
| **Prisma refuses `db push --force-reset` from an AI agent.** The first version of `globalSetup.ts` ran `prisma db push --force-reset --accept-data-loss`. Prisma 7.9 detected Claude Code and refused, asking for the user's explicit consent. That consent was not sought: the harness was changed so the flag is not needed. It now empties the tables itself (guarded, as the prompt asks for each file) and runs a plain `db push`, which on empty tables only creates or alters them. Teammates running `npm test` are not affected either way | n/a | Done (design change in Part A) |
| **MySQL on Windows stores database names in lower case** (`lower_case_table_names = 1`), so `AdRIC_DB_test` is stored as `adric_db_test`. Two effects: `SELECT DATABASE()` answers in lower case (the reset's check compares without case), and `prisma db push` given the mixed-case name could not find the existing foreign keys and failed on the second run ("Duplicate foreign key constraint name"). The harness passes `db push` the name as MySQL stores it. Worth knowing for step 14 if migrations are run on a Windows machine | n/a (new) | Done in the harness; step 14 |
| **The test database is built from `prisma/schema.prisma`, not from the live database.** Where the two differ, the tests describe `schema.prisma`. Known case: `asset_returns.condition` has no spaces in `schema.prisma`, so H-21 cannot be reproduced locally. `docs/reference/AdRIC_DB_Schema.sql` is already known not to match the live database | H-21, H-23 | Step 14 (baseline from the live database) |
| **11 analytics endpoints have never had a caller** and are neither in the step 12 deletion nor kept by the 2026-10-07 decision (`funding-valuation`, `campus-transfer-flow`, `grant-readiness-index`, `project-allocation`, `warranty-calendar`, `vendor-reliability`, `equipment-calendar`, `stakeholder/degradation`, `chain-of-custody/:assetId`, `stewardship-guidelines/:category`, `project-closure-recall`). Skipped in the plan, section 3.2. **Decided 2026-10-08:** like the 11 in section 3.1, moved to `legacy/analytics-endpoints/` and unregistered in step 12; no tests in Phase 2 | 01A 6.11, M-06 | Step 12 |
| `PUT /api/auth/account` with a lab code that has no research center tries to create one with location `MANILA_CAMPUS`, which is not a value of `research_centers_location`. The create fails inside a `catch {}`, the account keeps its old lab, and the answer still says the new lab | n/a (new) | B1 pins it; fix with step 12 (auth) |
| `POST /api/assets/:tag/repair` records the duplicate guard before it looks up the tag, so a second request for an unknown tag within 8 seconds answers 409, not 404 | M-07 family | B3 pins it; step 12 (repairs) |
| `GET /api/analytics/advanced/inspection-progress` reports 100% for a research center with no projects. `GET /api/analytics/director` counts a record as Laguna when its location contains "CAR", "HXIL", "CELT", "CIVI", or "MECH" anywhere | n/a (new) | B4 pins them; step 12 (analytics) |
| `server.ts` listens on every network interface (`app.listen(PORT)` with no host), so the test server is reachable from the network while a test file runs, with fake data only. On first run Windows may ask to let Node.js through the firewall; denying is fine. The same is true of the dev server on port 4000 | C-02 family | Step 10 (`server/config/env.ts`), if the team wants a host setting |
| When global setup fails (for example the guard refuses), Vitest prints "No test files found, exiting with code 1" above the real error. Misleading, but it is Vitest's own message. The README explains it | n/a | No action |
| The prompt's session note says to stop `npm run dev:all` before testing, because both used port 4000. With `PORT`, the tests pick a free port and the dev server can stay up. The README says so | n/a | No action |
| `npm install` still reports the existing audit findings and the two packages not covered by `allowScripts` (`@prisma/engines`, `prisma`). Unchanged by Vitest; not acted on (`npm audit fix` is not allowed) | 01C tier 3 item 22 | Separate dependency pass (restructure log note) |
| `PUT /api/auth/account` answers `labAffiliation: "CITe4D"` when the request sends no lab, whatever the account's lab is. `web/state/session.tsx` copies that answer into the session, so the account page shows CITe4D until the next reload. The database link is not changed | n/a (new) | B1 pins it; fix with step 12 (auth) |
| `POST /api/auth/approve-registration` with a lab name it does not find creates a new research center (location MANILA) from that name and links the account to it. A sign-up's default lab is `CITe4D`, so on a database without that code (the test database) every default approval creates one. On CCS Cloud, a typo in a lab name would add a lab | C-05 family (new) | B1 pins it; step 12 (auth), or Phase 3 with a fixed lab list |
| `PUT /api/assets/:tag` with an acquisition value but no funding source resets the funding source to "Unspecified", while the value itself is ignored (M-16) | M-16 family (new) | B1 pins it; fix with M-16 |
| **C-03 confirmed on the test database:** login with the password in upper case succeeds, because the comparison happens in SQL and the `users.password` column's collation, `utf8mb4_unicode_ci` (read from `information_schema` on the test database), ignores case. **Checked on CCS Cloud by Raiki (2026-10-08):** there `users.password` is `utf8mb4_0900_ai_ci`, which also ignores case and accents, so the same case- and accent-insensitive login happens on the live database (an accented letter in a password matches the plain one). The two collations differ in name but behave the same for this. It goes away when passwords are hashed, because the check then compares hashes in code, not text in SQL | C-03 | Phase 3 (hashed passwords) |
| The 2026-10-08 analytics decision leaves older text that still describes the 2026-10-04 deletion: `PROMPT-tests.md` (the B4 line and "Endpoints to skip"), `legacy/analytics-v1/README.md`, `legacy/analytics-widgets/README.md`, and the restructure log. **Done in the B2 docs commit (2026-10-08):** the prompt and both READMEs now describe the 22 endpoints kept in `legacy/analytics-endpoints/` and unregistered in step 12; the restructure log got dated notes (under step 2 and in its notes table) and its old lines were kept | n/a | Done |
| `PUT /api/asset_transfers/:id/accept` checks only that the transfer exists, so it moves a transfer in **any** status to `pending_approver`, even one already approved (custody has moved) or declined. That transfer can then never be decided again (M-12) | M-12 family (new) | B2 pins it; step 12 (transfers): delete the route or finish the handshake, as M-12 says |
| The issue #25 guard (`findCustodyRequestConflict`) counts only transfers with status `pending`. After `/accept`, a transfer is `pending_approver`, so the asset takes a second transfer request while the first transfer is still open (by the same check it would take a loan request too; only the transfer case is tested). No screen calls `/accept` today, so this needs a direct API call | M-12 family, issue #25 (new) | B2 pins it; step 12 (transfers), with M-12 |
| `PUT /api/asset_transfers/:id/accept` with an id that is not a number answers 500 with Prisma's full message, which includes the path of `server.ts` on the server's disk and several of its source lines. `/decision` checks the id first and answers 400 | H-16 | B2 pins it; step 12 (transfers) or step 13 (error middleware) |
| `POST /api/assets/:tag/return` checks no state: an asset that is not on loan is accepted, and a **disposed** asset comes back as ACTIVE under user 1, so it reappears in the pool. The loan, if any, stays open (H-04) | H-05 (new case) | B2 pins it; step 12 (returns), or Phase 3 triggers |
| `GET /api/asset_loans` (H-08) inserts LOAN-9 on the first asset in the table. With the issue #25 guard, that row then blocks borrow and transfer requests on that asset until someone decides it. The B2 test puts the database back afterwards. Already noted in the restructure log for the live database | H-08 | Step 12 (loans): delete the block |
| The loan list shows `LOAN-n` and the transfer list `TRF-n`, but both decision routes need the bare number: `/api/asset_loans/LOAN-2/decision` answers 400. The web app sends the bare number (`decideLoan` and `decideTransfer` take it without the prefix), so nothing is broken; noted because a script or a later screen could trip on it | n/a | No action, or step 12 if the API is cleaned up |
| `PUT /api/asset_repairs/:id/status` checks only that `progressStatus` is present, so a status of only spaces is saved. `PUT /api/asset_repairs/:id` trims it and answers 400 | H-06 family (new) | B3 pins it; step 12 (repairs), when the two routes become one |
| Neither repair route sets `asset_records.repair_id` on the MAINTENANCE record or the record that restores the asset, although the column exists. The disposal decision does set `disposal_id`. So a maintenance record cannot be traced to its ticket | n/a (new) | B3 pins it (`repair_id: null`); step 12 (repairs) or Phase 3 |
| `"Fixed & Completed"` adds a restore record and an `asset_reports` row whenever it is sent, even for a ticket that never went into maintenance | H-07 family (new) | B3 pins it; Phase 3 (status as an enum with allowed moves) |
| The repair list's `custodian` field is the **reporter**, not the asset's custodian (the same value as `reportedBy`). `RepairProgressDialog` shows it as "Submitted By", so the screen is right; noted so step 12 does not "correct" it into the asset's custodian | n/a | No action |
| `POST /api/assets/:tag/inspection` with a condition it does not know (a typo, lower case, or the stored spelling "MINOR DRIFT") saves PERFECT and writes PERFECT onto the asset, with 200. The return route answers 400 for the same input | H-07 family (new) | B3 pins it; step 12 (inspections), with the shared condition enum |
| `POST /api/assets/:tag/inspection` with a `reportedById` that is no account answers 500 with Prisma's full message (the server's file path, source lines, and "Foreign key constraint violated"). The transaction writes nothing. An unknown `reporterEmail` instead falls back to user 1, even when a valid `reportedById` is also sent | H-16, H-10 | B3 pins both; step 12 (inspections) or step 13 (error middleware) |
| `POST /api/assets/:tag/inspection` stores `reportImg` as sent; the image check that `PUT /api/assets/:tag` applies (400 for a non-image) is not used here | n/a (new) | B3 pins it; step 12 (inspections), reuse the asset image check |
| `POST /api/assets/:tag/inspection` on an asset with no `asset_records` row creates one at location "DLSU Campus" with no current location, under the reporter. Like the custodian history's invented first entry, it is a made-up value | H-09 family | B3 pins it; step 12 (inspections) |
| The disposal form's "Last Custodian" is saved inside the reason text and never shown again: the asset list's `disposalDetails.lastCustodian` is the record's custodian | M-13 family (new) | B3 pins it; Phase 3 (columns for the disposal details) |
| Disposals have no issue #25 style guard: a second pending disposal on the same asset is accepted, and approving both writes two DISPOSED records. An asset on loan or in maintenance is also accepted, and approval disposes it under its borrower | H-05 (new cases) | B3 pins it; step 12 (disposals), or Phase 3 triggers |
| `PUT /api/asset_repairs/:id`, the inspection route, and the disposal decision read the asset's newest record by `date_logged` alone (M-09). The B3 tests never give one asset two records in the same second where the server's choice would matter, so they do not depend on that tie; the tie itself is timing and is not tested | M-09 | Step 12 (use the `asset_record_id` tie-break everywhere) |
