# 02. Test Log

Running record of [PROMPT-tests.md](PROMPT-tests.md). The plan is [01-test-plan.md](01-test-plan.md); setup and running are in [tests/README.md](../../tests/README.md).

Branch: `test/phase-2-api-tests`, from `main` after PR #50 (`a02786c8` adds the prompt). Nothing here is pushed by the agent; Raiki pushes and opens the pull requests.

---

## Status

| Part | What | Status | Commits | Tests | Date |
|---|---|---|---|---|---|
| A | Vitest, harness, smoke test, test plan, README | Done | `0e9d308e` (Vitest), `ec738f0b` (PORT), `f2058aef` (harness and smoke test), `225770e9` (README and plan), docs housekeeping | 10 (3 smoke, 7 guard) | 2026-10-08 |
| B1 | Auth, assets | Done | `212b69df` (auth and registration), `4fae5b46` (assets), docs housekeeping | 88 (33 auth, 22 registration, 33 assets) | 2026-10-08 |
| B2 | Loans, returns, transfers | Not started | | | |
| B3 | Repairs, inspections and reports, disposals | Not started | | | |
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
| **C-03 confirmed on the test database:** login with the password in upper case succeeds, because the comparison happens in SQL and the `users.password` column's collation, `utf8mb4_unicode_ci` (read from `information_schema` on the test database), ignores case. Whether CCS Cloud uses the same collation was not checked (no connection to CCS Cloud) | C-03 | Phase 3 (hashed passwords) |
| The 2026-10-08 analytics decision leaves older text that still describes the 2026-10-04 deletion: `PROMPT-tests.md` (the B4 line and "Endpoints to skip"), `legacy/analytics-v1/README.md`, `legacy/analytics-widgets/README.md`, and the restructure log. Not edited in this session: the decision named the files to update | n/a | Step 12, when `legacy/analytics-endpoints/` is created |
