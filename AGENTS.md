# AGENTS.md

Rules for any AI agent or chat AI working on CAP-2519-IT, "Asset Management System for DLSU CCS AdRIC". People follow the same rules. Read this first, every time.

## The project in one paragraph

A web app for DLSU CCS AdRIC (research labs) to register, tag, lend, transfer, return, repair, inspect, and dispose of assets. React 18 + TypeScript + Vite in `web/`, Express 5 + TypeScript in `server/`, Prisma 7 with MySQL 8 in `prisma/`, code used by both sides in `shared/`. The shared team database is MySQL on CCS Cloud. Roles: Staff, Lab Head, Custodian, Director.

## Where things are

| Path | What lives there |
|---|---|
| `server/features/<feature>/` | One folder per workflow (loans, returns, transfers, disposals, repairs, inspections, auth, assets, analytics), five layers each: `routes`, `validation`, `controller`, `service`, `repository` |
| `server/shared/` | `errors/AppError.ts`, `middleware/` (`requireAuth`, `requireRole`, `errorHandler`), `services/` (session, mailer, guards), `constants/`, `utils/` |
| `web/pages/<role>/` | Screens per role (staff, lab-head, custodian, director, auth) |
| `web/features/<feature>/` | Forms, dialogs, and parts used by the screens |
| `web/api/` | Every call to the server. Screens never call `fetch` directly |
| `web/state/` | `session.tsx`, `serverData.tsx` (shared lists), `browserOnly.tsx` (temporary, do not add to it) |
| `shared/` | `enums/`, `constants/`, `types/` used by web and server |
| `prisma/` | `schema.prisma`, `migrations/` (`0_init` is the baseline), `seed.ts` |
| `tests/` | API tests (Vitest), run against a local MySQL test database |
| `legacy/` | Old code kept for reference. Not built, not imported. Do not edit |
| `docs/guides/` | `GIT-WORKFLOW.md`, `CODE-COMMENTS.md`, `DATABASE-MIGRATIONS.md` |

## Commands

| Command | What it does |
|---|---|
| `npm install`, then `npm run prisma:generate` | Setup after cloning or pulling |
| `npm run dev:all` | Web on port 5173 and API on port 4000. Uses the database in `.env` (CCS Cloud) |
| `npm run typecheck` | TypeScript check. **Today: 50 errors** (old ones). The count must not go up |
| `npm run build` | Production build. Must pass |
| `npm test` | API tests on the local test database. **Today: 422 passed** |

Run typecheck, build, and test before every pull request, and report the three results.

## Never

- Never read, edit, print, or commit `.env` or `pending_registrations.json`. Never put a password, key, email, or ID number in code, logs, tests, or examples.
- Never change `package.json` or `package-lock.json`, and never install a package, without asking first.
- Never change `prisma/schema.prisma` or `prisma/migrations/` without asking first. A schema change is always a new migration file, never an edit to an old one. Read `docs/guides/DATABASE-MIGRATIONS.md` first.
- Never run `prisma migrate dev`, `prisma db push`, or `prisma db pull`. Prisma commands take their database only from `PRISMA_TARGET_URL`.
- Never write to CCS Cloud for testing, and never change it by hand. Tests and click-throughs use a local database.
- Never commit to `main` or push to it. Never rewrite history, rebase, or force-push.
- Never edit `legacy/`.

## How we work

1. **One issue per branch,** from a fresh `main`: `git switch main`, `git pull`, `git switch -c fix/<issue>-<short-name>`.
2. **One change per commit.** A commit either moves code or changes behavior, never both.
3. **Commit message:** `type(scope): what changed (#issue)`. Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `db`. Example: `fix(inspections): give each queue row a unique ticket ID (#62)`.
4. **Only change what the issue needs.** If another file must change, say which and why, and wait.
5. **If a test pins the old behavior,** update that test in the same commit and say so.
6. **Before the pull request:** pull `main` into the branch (`git pull origin main`, merge, not rebase). On a conflict, stop and ask Raiki.
7. **Pull request:** fill `.github/pull_request_template.md`. Write `Closes #<issue>`. Raiki reviews and merges.

## Code rules

- **Five layers.** Routes: URL, `requireAuth`, `requireRole`. Validation: checks the body. Controller: reads the acting user with `sessionUserOf(req)` and calls the service. Service: business rules, throws `AppError(status, message)`. Repository: the only file that calls Prisma.
- **The acting user comes from the session,** never from a name, email, or id in the request body.
- **People are matched by user id,** never by display name.
- **Send only what the screen needs.** No passwords. No emails or ID numbers unless the screen shows them.
- **Errors:** throw `AppError` for 400, 401, 403, 404, 409. Anything else goes to `errorHandler`, which answers a generic 500.
- **Option lists** (labs, categories, conditions, statuses) come from `shared/` or the server, not a new hardcoded list in a page.
- **Comments** follow `docs/guides/CODE-COMMENTS.md`: a file header, TSDoc on every export, inline comments only for a non-obvious why, `TODO(<finding ID>)` for known defects. No history comments, no commented-out code, no `console.log` left behind.

## Writing

- Plain, simple words in code comments, commit messages, PR text, and reports.
- **No em dashes anywhere.** Use commas, colons, or periods.

## When unsure

Ask instead of guessing. Do not invent function names, imports, file paths, or behavior you have not seen. Write each question so it can be answered without opening files: one plain sentence on what it is, which screen and role it affects, lettered options with what each does, and your recommendation with a one-line reason.

## Working in steps (agents)

Agents that can read the repo and run commands work in steps and stop after each one for the person to review:

1. **Plan:** read the issue and its files, explain the cause and the fix in plain words, list the files you will change, ask your questions. Stop.
2. **Build** (after "go"): make the change on the branch, one change per commit. Commit, never push.
3. **Checks:** run `npm run typecheck`, `npm run build`, `npm test`, and report the three results.
4. **Hand checks:** write them (format below) so the person can run them. Do not run them yourself, and do not use browser or MCP tools, unless your prompt explicitly asks for it. Never against CCS Cloud.
5. **Report** (below), then stop.

`npm run dev:all` connects to CCS Cloud through `.env`. For any click-through, start the app on the local demo database instead (`docs/guides/DATABASE-MIGRATIONS.md`, "A fresh local database with demo data", step 4), and stop any other server on ports 4000 and 5173 first.

## Reporting

At the end of a task (or a step), report:

- **What changed:** files and why, commit by commit.
- **Checks:** typecheck count, build result, tests count. If a count changed, say why.
- **Hand checks,** numbered H1, H2, and so on. Each one: the role to log in as, the screen (by its name in the app), the exact clicks, what you should see, and which database it uses (local demo only). Include at least one check that the old bug is gone and one that nearby behavior still works.
- **Questions,** in the format under "When unsure".
- **Not done:** anything you skipped or could not check, and why.

## More

- Status and history: `docs/README.md`
- Findings (C-, H-, M-, L- IDs): `docs/phase-1b-deep-map/01B-findings-register.md`
- Local database with demo data: `docs/guides/DATABASE-MIGRATIONS.md`, "A fresh local database with demo data"
- Test setup: `tests/README.md`
