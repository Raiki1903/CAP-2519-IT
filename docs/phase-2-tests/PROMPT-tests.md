# Agent Prompt: Phase 2, API Tests Against a Local Test Database

> How to run this: open the repo in VS Code with Claude Code, in manual or edit-auto permission
> mode. Do not use plan mode, it blocks file writes. Follow `docs/guides/GIT-WORKFLOW.md`.
>
> Run this in sessions. Each session does only the part named in the first message.
>
> Before each session: `git switch main`, `git pull`, then create or switch to the branch named
> under Constraints. Stop `npm run dev:all` before running tests.
>
> Suggested first message (change the part each session):
> `Read docs/phase-2-tests/PROMPT-tests.md and follow it. Do Part A.`
>
> Session plan: Part A (setup and one smoke test), then B1, B2, B3, B4 (one session each).
> Suggested effort: High for Part A, Medium or High for Part B.

---

# Role (R)
You are a Senior Software Engineer who writes reliable automated tests for an existing system
before it is refactored. You test what the system does today, not what it should do. You keep
test data fake, tests independent of each other, and the shared database untouched. You explain
what you did in plain language, because not every teammate has written tests before.

# Task (T)
Build an automated API test suite for our capstone, "Asset Management System for DLSU CCS AdRIC"
(CAP-2519-IT), that runs against a **local** test database, so the backend split in restructure
steps 10 to 12 can be checked by one command (`npm test`) instead of long hand checks.

**Part A. Setup (one session).**
1. Add Vitest as the test runner (dev dependency only).
2. Build the test harness in `tests/setup/`:
   - a safety guard that refuses to run unless the database is local and its name ends in `_test`;
   - loading the table structure from `prisma/schema.prisma` into the test database;
   - resetting and seeding fake data before each test file;
   - starting the real server (`server.ts`) as a child process pointed at the test database, and
     stopping it afterwards.
3. Write one smoke test (`tests/api/smoke.test.ts`): the server answers, the seeded assets come back,
   and a seeded account can log in.
4. Write the test plan `docs/phase-2-tests/01-test-plan.md`: every endpoint, grouped by feature,
   with its callers, what will be tested, in which session, and which endpoints are skipped and why.
5. Write `tests/README.md`: how a teammate installs MySQL 8.0, creates the test database, sets
   `TEST_DATABASE_URL`, and runs the tests.
6. Stop and report.

**Part B. Tests per feature (one session each).** Write the tests the plan assigns to the named session:
- **B1:** auth (login, `/me`, account update, registration reads and decisions; see the registration
  note in Context) and assets (list, detail, create, edit, delete, custodian history).
- **B2:** loans (borrow, list, decision), returns, transfers (request, list, decision, accept).
- **B3:** repairs (create, list, update, status), inspections and reports, disposals (request, list, decision).
- **B4:** the analytics endpoints that have a live caller (see Context). Not the ones that step 12 deletes.

Stop after each session and report.

# Context (C)
- **Read first:** `docs/README.md`, the last two entries of `docs/HANDOFF.md`,
  `docs/phase-1c-restructure/PROMPT-2-restructure.md` (decisions table),
  `docs/phase-1c-restructure/02-restructure-log.md` (notes table), and
  `docs/phase-1b-deep-map/01B-findings-register.md` for finding IDs. Skim `01A-system-trace.md`
  sections 3 and 4 for how each workflow moves through the server.
- **Where the project is:** restructure steps 0 to 9 are merged (PR #50). The frontend lives in
  `web/` and `shared/`. The backend is still **one file, `server.ts`** (about 4,830 lines, 62
  endpoints). Steps 10 to 12 will split it into `server/features/<process>/`. These tests must be
  written against the HTTP API only, so they keep working unchanged after the split.
- **Stack:** Express 5 + TypeScript run with `tsx`, Prisma 7.9 with `@prisma/adapter-mariadb`,
  one `package.json`, `"type": "module"`, TypeScript 6 with `strict: false` and aliases
  `@server/*`, `@web/*`, `@shared/*`. Typecheck count on main: **71**. No tests exist yet (M-18).
- **The database is MySQL 8.0, not MariaDB.** CCS Cloud reports `8.0.46-0ubuntu0.22.04.4`. Earlier
  docs say "local MariaDB" for the test database; that was wrong. Each developer installs
  **MySQL Server 8.0.46** locally (Windows MySQL Installer, Development Computer, port 3306, firewall
  port not opened). The MariaDB driver adapter works with MySQL, which is why the app runs today.
- **The test database:** `AdRIC_DB_test` on the developer's own machine, reached through
  `TEST_DATABASE_URL` in `.env`, format `mysql://root:<password>@localhost:3306/AdRIC_DB_test`.
  It is empty until the harness loads the schema. **Never the shared CCS Cloud database.**
- **How the server connects (important for the harness):**
  - `prisma.ts` reads `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`,
    `DATABASE_NAME`. **If any is missing it falls back to CCS Cloud** (C-07). So the child process
    must receive all five explicitly, parsed from `TEST_DATABASE_URL`.
  - `prisma.config.ts` reads `DATABASE_URL`, used only by Prisma CLI commands.
  - `prisma.ts`, `server.ts`, and `prisma.config.ts` import `dotenv/config`, which loads `.env` from
    the **current working directory** but never overrides a variable that is already set, even to
    an empty string.
- **What the server does on startup and while running:**
  - It listens on a **hardcoded port 4000** (`const PORT = 4000`), so it clashes with a running dev server.
  - On listen it calls `assertDefaultCustodianExists()` (user id 1, `DEFAULT_CUSTODIAN_ID`) and
    `performDatabaseBackup()`, and repeats the backup every 6 hours. The backup is off when
    `BACKUP_DIR` is empty.
  - It sends email through Mailgun when `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` are set
    (`mailer.ts`), and silently skips mail when they are empty.
  - Sign-up requests are stored in `pending_registrations.json` in **`process.cwd()`** (H-17). On a
    developer machine that is the repo root, holding real pending sign-ups.
  - `GET /api/asset_loans` inserts a pending loan with id 9 when none is pending (H-08).
- **Endpoints to skip:** the 11 analytics endpoints with no caller that step 12 deletes (see the
  2026-10-04 decision in PROMPT-2 and 01C section 4.4). Find the exact list in the docs; do not
  guess. The three `/api/analytics/advanced/*` endpoints kept on 2026-10-07 get at most a
  "responds with 200" test. List every skipped endpoint in the plan with the reason.
- **Characterization tests.** The goal is to pin down what the API does **today**, so a later step
  that changes it by accident fails a test. So:
  - Assert the current status code, the response shape (the fields screens rely on), and the
    database effect (the rows created or changed, read back through Prisma or a follow-up request).
  - Where today's behavior is a known defect, assert it as it is and name the test after it, for
    example `it("finalizing a return leaves the loan open (known defect H-04)", ...)`. Do not fix it.
    When a later step fixes that defect on purpose, that step updates the test in the same commit.
  - Where a guard exists, test both sides: the duplicate custodian request returns 409 (issue #25,
    `findCustodyRequestConflict`), and the first request succeeds.
  - Do not assert exact timestamps, generated ids, or text that includes the current date.
- **Decisions already made.** Do not reopen them.

  | Decision | Applies |
  |---|---|
  | Tests live in a root `tests/` folder: `tests/setup/`, `tests/api/`, `tests/db/` (only if a test needs direct database checks that do not fit `tests/api/`) | Now |
  | Test database is local MySQL 8.0 (`AdRIC_DB_test`) through `TEST_DATABASE_URL`, never CCS Cloud | Now |
  | Restructure steps 10 to 12 run after these tests and must keep them passing | After Phase 2 |
  | ITS is being removed (Staff = TSG only) on its own branch later. Today the server still returns `staffUnit` "ITS" or "TSG". Test today's behavior | Later branch |
  | Reloading the page logs the user out (issue #49). Frontend only, not in scope | Its own fix |

# Examples (E)
**Good test**
```ts
it("rejects a second custodian request on the same asset with 409 (issue #25)", async () => {
  const first = await api.post(`/api/assets/${TAG_AVAILABLE}/borrow`, borrowBody(CUSTODIAN_A));
  expect(first.status).toBe(200);

  const second = await api.post(`/api/assets/${TAG_AVAILABLE}/borrow`, borrowBody(CUSTODIAN_B));
  expect(second.status).toBe(409);

  const pending = await db.asset_loans.count({ where: { asset_id: AVAILABLE_ID, status: "pending" } });
  expect(pending).toBe(1);
});
```
(The values above are illustrative. Use the real field names, statuses, and status codes you
find in `server.ts`.)

**Bad test**
```ts
it("works", async () => {
  const res = await fetch("http://localhost:4000/api/assets");
  expect(res).toBeTruthy();
});
```
(Vague name, hits whatever server is running on 4000, checks nothing.)

**Good fixture data:** `Test Custodian A`, `custodian.a@example.test`, asset tag `TEST-0001`.
**Bad fixture data:** a real name, a real DLSU email, anything copied from CCS Cloud or `scratch/backups/`.

**Good session report (in chat)**
> **Part A done: test setup and smoke test.**
> *Added:* Vitest x.y.z (dev dependency). `tests/setup/` (guard, schema load, seed, server start).
> `tests/api/smoke.test.ts` (3 tests). `tests/README.md`. `docs/phase-2-tests/01-test-plan.md`.
> *App code changed:* one line in `server.ts`, port from `PORT` with 4000 as default. Commit `<hash>`.
> *Checks:* `npm test` 3 passed. Build passes. Typecheck 71, unchanged.
> *Safety:* guard refuses a non-local host or a name not ending in `_test` (tested both).
> *Please check:* run `npm test` on your machine with the dev server stopped.
> *Next:* B1, auth and assets. Waiting for your go-ahead.

# Constraints (C)
- **Branch:** `test/phase-2-api-tests`, from an up-to-date `main`. If it exists, continue on it.
  Never commit to `main`. Never push, merge, rebase, force-push, or rewrite history. Raiki pushes.
- **Database safety, before anything else:**
  - Every test command must go through the guard. The guard parses `TEST_DATABASE_URL` and stops
    with a clear message unless the host is `localhost` or `127.0.0.1` **and** the database name
    ends in `_test`. If `TEST_DATABASE_URL` is missing, stop and ask me.
  - The server child process gets **all five** `DATABASE_*` variables from `TEST_DATABASE_URL`, plus
    `BACKUP_DIR=""`, `MAILGUN_API_KEY=""`, `MAILGUN_DOMAIN=""`, `MAILGUN_FROM=""` set explicitly, so
    nothing in `.env` can point it at CCS Cloud, send real email, or write backups.
  - Run the child process with its working directory set to a **temporary folder**, so
    `pending_registrations.json` is written there, never in the repo root. Confirm that `tsx` still
    resolves the path aliases from there (for example with `TSX_TSCONFIG_PATH`); if it does not,
    stop and tell me, and do not test registration writes.
  - Loading the schema into the test database (for example `prisma db push` with `DATABASE_URL`
    set to `TEST_DATABASE_URL` **for that one command only**) is allowed. `prisma migrate` is not
    (that is step 14). Never run any Prisma CLI command against CCS Cloud.
  - Never connect to CCS Cloud, not even to read. Never read or print `.env` or any connection URL
    or password. Never copy data from CCS Cloud, `scratch/backups/`, or `pending_registrations.json`.
- **Dependencies:** this phase **may** add a test runner, unlike the restructure. Add **Vitest only**,
  as a dev dependency, in a version that works with the installed Vite 6 **without changing Vite**.
  Use Node's built-in `fetch` for HTTP calls (no supertest). Do not change any other dependency
  version. Prisma (`prisma`, `@prisma/client`, `@prisma/adapter-mariadb`) must stay exactly as it
  is. Never run `npm install prisma` or `npm audit fix`. The dependency change is its own commit,
  and the report names the version. If anything else seems needed, stop and ask.
- **App code:** tests must not change how the app behaves. The **only** allowed app-code change is
  in `server.ts`: read the port from `process.env.PORT`, defaulting to 4000. With `PORT` unset the
  server behaves exactly as before. Make it its own commit, labelled behavior-neutral. Anything
  else the tests reveal (a bug, an awkward spot) is **logged, not fixed**.
- **Test quality:**
  - Tests run one file at a time against one server (turn off file parallelism), and each file
    starts from a fresh seed, so no test depends on another file's leftovers.
  - Every test name says what it checks. Known defects are named with their finding ID.
  - No skipped or commented-out tests left without a note in the log. No retries to hide flakiness:
    if a test is flaky, find out why or remove it and log it.
  - The test files typecheck with zero errors, and `npm run typecheck` stays at 71 or lower.
- **Scope:** only the part named in my message. Stop after it, even if I named several.
- **Comments:** follow `docs/guides/CODE-COMMENTS.md`. File header on every test and setup file
  (what it covers, which workflow, which fixtures). No comments restating the code.
- **Verify every session:** `npm test` passes, `npm run build` passes, `npm run typecheck` count
  reported. Never commit a failing suite, except a test explicitly marked as a known defect that
  asserts today's behavior (which passes).
- **No em dashes** in anything you write. Plain language. Explain a testing term the first time you use it.

# Docs housekeeping (do this last, every session)
- Create `docs/phase-2-tests/` in Part A. Keep a log there, `02-test-log.md`: a status table
  (part, status, commits, number of tests, date) and a notes table for anything noticed and not
  fixed, with finding IDs.
- `docs/README.md`: point the Phase 2 row of the status board at this prompt, with status and date,
  and update "Where we are now".
- `docs/phase-1-codebase-map/PROMPT-db-revisions.md`: add one line at the top of its Phase 2 part
  saying it is superseded by `docs/phase-2-tests/PROMPT-tests.md`. Do not edit the rest.
- `docs/phase-1c-restructure/PROMPT-2-restructure.md`: in the decisions table, correct the test
  database row from "local MariaDB" to "local MySQL 8.0 (CCS Cloud runs MySQL 8.0.46)". In Part A only.
- `.env.example`: add `TEST_DATABASE_URL=` with a comment (name only, never a value). In Part A only.
- `docs/HANDOFF.md`: add a dated entry (prompt followed, what was produced, findings, open questions).

# Output Format (O)
1. **Part A commits, in this order:** the Vitest dependency; the `PORT` line; the harness and smoke
   test; `tests/README.md` and the test plan; docs housekeeping.
2. **Part B commits:** one commit per feature (for example `test(B2): loans`), then docs housekeeping.
3. **`01-test-plan.md`:** a table per feature: endpoint, method, called from (web file), what the
   tests check, session (B1 to B4), and known defects pinned. Then a "Skipped" table with the reason.
4. **In chat after each session:** a report in the format from the example, then stop.