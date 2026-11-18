# Base setup: a clean start with no demo data (#200)

**Owner:** Raiki (Claude Code agent). **Reviewer:** the advisor (lean). **Save as:** `docs/tasks/200-base-seed.md` (first commit).
**Branch:** `feat/200-base-seed` from a fresh `main` (after #186 and #197 are merged, if they are; else from `main` as it is).
**Rules:** `AGENTS.md` and `CLAUDE.md`. **No change in `prisma/schema.prisma`, `prisma/migrations/`, `package.json` or `package-lock.json`.** No new package. No em dashes. Typecheck stays at 19, build passes, tests: the count on `main` plus yours, all passing.
**Due:** merged by **Thu Nov 19, 3 pm** so it rides the Thu deploy. If it misses, it can still be pulled onto the server before the clean start (no migration, no web change).

## Why

The live site runs on the demo seed (58 made-up assets, 30 demo accounts). Demo assets have history, so they can't be deleted. Before the handover, the team starts the live database clean: empty it, run the migrations, then add only what the app needs to start: the lookup rows, the 5 roles, the 10 AdRIC labs, and one IT Admin account. Today only the demo seed writes roles, labs and accounts, so there is no way to do this.

## What to build

`SEED_MODE=base` on the existing seed (`prisma/seed.ts`, run with `npm run seed`). No new npm script.

- **`SEED_MODE` unset or `demo`:** the demo seed, exactly as today. Its tests must pass unchanged.
- **`SEED_MODE=base`:** the base data below. **Any other value:** refuse (`SeedRefused`), write nothing.
- **Same safety checks in both modes:** `SEED_DATABASE_URL` on `localhost` or `127.0.0.1` only (`seedTarget.ts`), the connection is on the named database, every table exists, and `users`, `roles`, `research_centers`, `assets` are empty. Never reads `.env`.
- **Base mode also needs `SEED_ADMIN_EMAIL`:** trimmed, lower case, must end with `SIGN_UP_EMAIL_DOMAIN` (`shared/constants/signUp.ts`) with something before it. Missing or wrong: refuse, write nothing. `SEED_PASSWORD` is the IT Admin's first password: the seed's own check (8+) **and** the app's new-password length rule (`MIN_PASSWORD_LENGTH`, `MAX_PASSWORD_LENGTH` in `shared/constants/passwords.ts`), so the IT Admin can change it later on the same rules.

**Base data, one transaction (a failure leaves the database empty):**

| Rows | From |
|---|---|
| Categories, funding sources, issue types, metric definitions, category metrics | The same rows and the same `skipDuplicates` writes as the demo seed |
| 5 roles | The same ids and names as the demo seed |
| 10 labs | `DEMO_LABS` (the real AdRIC labs), ids 1 to 10 as in the demo seed, **no Lab Head** |
| 1 user | first name `AdRIC`, last name `IT Admin`, email `SEED_ADMIN_EMAIL`, password `hashPassword(SEED_PASSWORD)`, `id_number` null, user type `STAFF`, status `ACTIVE`, role `IT_ADMIN`, **no labs**, no decision fields |

Nothing else: no projects, assets, loans, maintenance, retirements, inspections, remarks, user tickets, `user_centers` rows or activity log rows.

**Output:** `[seed] Done (base): 5 roles, 10 labs, 20 categories, 1 IT Admin account. No demo data.` then `[seed] Log in with SEED_ADMIN_EMAIL and SEED_PASSWORD, then change the password in Account Details.` **Never print the email, the password or a hash** (the existing error handler already hides the password and URL; add the admin email to what it hides).

## Points to get right

- The lookup writes must be **shared, not copied**: move them out of `writeDemoData` into one function both modes call (its own "moves code only" commit, demo tests pass unchanged).
- Roles use the explicit ids the demo seed uses, so role ids match between a demo database and a base one.
- Hash with the server's `hashPassword`, as the demo seed does.
- Don't touch the demo data files (`seedData.ts`, `seedHistory.ts`, `seedStory.ts`, `seedImages.ts`) beyond what the shared lookup function needs.

## Commits, in order

1. `docs(seed): task file for the base setup (#200)`: this file. **Commit it yourself before the agent starts.**
2. `refactor(seed): one writer for the lookup rows (#200)`: moves code only.
3. `feat(seed): SEED_MODE=base writes the lookups, roles, labs and one IT Admin (#200)`, with its tests.
4. `docs(seed): clean start with no demo data (#200)`: a new section in `docs/guides/DATABASE-MIGRATIONS.md`, "A clean start with no demo data", with the PowerShell and the bash commands (each variable set for the one command, then removed), and one line in the "words" list for `SEED_MODE`.
5. `docs(agents): update the test count (#200)`.

## Tests

New file `tests/db/baseSeed.test.ts`, run as a child process the way `tests/db/demoSeed.test.ts` runs the seed, on the emptied test database, with a made-up password and a made-up `@dlsu.edu.ph` email. At least:

- Exactly 1 user: active, role IT Admin, the given email, no labs; `verifyPassword` accepts the password; the hash is not the password.
- 5 roles, 10 labs each with no Head, 20 categories, and the issue types, metrics and category metrics the demo seed writes.
- Zero rows in projects, assets, asset loans, maintenance, retirements, inspections, inspection metrics, remarks, user tickets, `user_centers`, activity log.
- The output has neither the password, nor a hash, nor the email.
- Refuses and writes nothing: no `SEED_ADMIN_EMAIL`; an email outside `@dlsu.edu.ph`; a password too long for the app's rule; `SEED_MODE=wrong`; a database that already has users (run base twice).

## Hand checks (local database `adric_base_check` only)

- B-H1. New local database `adric_base_check`, `prisma migrate deploy` on it, then the base seed (commands from the new guide section). It prints the Done line from "Output".
- B-H2. Start the app on `adric_base_check` (guide, "A fresh local database with demo data", step 4). Log in as the IT Admin with the first password. Account Details, Change password: works; log in again with the new one.
- B-H3. IT Admin: Users lists only that account; Approvals is empty; Activity Log shows only the logins and the password change.
- B-H4. Sign up a test account, approve it as TSG Staff with no labs, log in as it: Asset Inventory is empty; Reference Data lists 10 labs, **each with a Delete button** (nothing uses them), 20 categories; Register Asset in CITe4D gives the tag `CITe4D-0001`.
- B-H5. typecheck 19, build passes, tests all pass (say the new count). The demo seed still works on another empty local database.

## Report (to Raiki, not the PR)

The AGENTS.md format: what changed commit by commit, the three check results, the hand checks, questions, anything not done. Don't write the PR description: the advisor writes it.
