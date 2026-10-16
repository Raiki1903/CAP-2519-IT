# Database migrations: a guide for the team

How the database is built from files since restructure step 14 (2026-10-16), how to make a local copy with demo data, how to write a Phase 3 change, and the rules for CCS Cloud.

Every command is given twice: for **PowerShell** in VS Code (use `npx.cmd` and `npm.cmd`: plain `npx` and `npm` are blocked there by the execution policy) and for **Git Bash**. Run them from the repository root.

---

## The words

- A **migration** is a file of SQL in `prisma/migrations/<name>/migration.sql` that changes the database's structure: a new column, a new table, a renamed key. Migrations are kept in git and reviewed like code.
- `prisma migrate deploy` applies, in name order, every migration a database has not had yet, and records each one in a table it keeps in that database, `_prisma_migrations`. The app never reads that table.
- The **baseline** is the first migration, `prisma/migrations/0_init`: the whole structure as it was on 2026-10-16 (15 tables). Every later migration builds on it.
- `prisma/schema.prisma` describes the structure the migrations build. The two must always agree: `npm test` stops if they do not (see "Writing a Phase 3 change").
- The **seed** (`npm run seed`, `prisma/seed.ts`) fills an empty local database with demo data.

## Which database a Prisma command acts on

**Prisma commands do not read `.env`.** `prisma.config.ts` takes the database from one variable, `PRISMA_TARGET_URL`, which `.env` does not set and must never set. You set it in the shell, for the one command that needs it, then remove it. A command that needs a database and is given none stops before connecting anywhere, with one of these:

```
Error: The datasource.url property is required in your Prisma config file when using prisma migrate deploy.
Error: P4003  No URL defined in the configured datasource          (prisma migrate diff)
```

That is the safety net: a forgotten setting fails instead of reaching CCS Cloud. (Before step 14, Prisma took `DATABASE_URL` from `.env`, which is CCS Cloud, so a bare `prisma migrate` command would have gone there. `DATABASE_URL` is no longer read by anything.)

`npm run prisma:generate` needs no database and works with nothing set. The app (`npm run dev:all`, `npm run server`) does not use `prisma.config.ts` at all: it reads the five `DATABASE_*` variables from `.env`, as before.

**Windows: write a local database's name in lower case** in `PRISMA_TARGET_URL` (`adric_db_test`, not `AdRIC_DB_test`). MySQL on Windows stores the name in lower case, and with the mixed-case name Prisma does not see the existing foreign keys, so a `migrate diff` would wrongly add all 20 of them again. The commands below do this for you.

To set it without typing a password (it reads one value from your `.env` and never shows it):

PowerShell:
```
$env:PRISMA_TARGET_URL = node -e "const u = new URL(require('dotenv').parse(require('fs').readFileSync('.env')).TEST_DATABASE_URL); u.pathname = u.pathname.toLowerCase(); process.stdout.write(u.href)"
# ... the Prisma command ...
Remove-Item Env:PRISMA_TARGET_URL
```

Git Bash (the variable then lives for that one command only):
```
PRISMA_TARGET_URL="$(node -e "const u = new URL(require('dotenv').parse(require('fs').readFileSync('.env')).TEST_DATABASE_URL); u.pathname = u.pathname.toLowerCase(); process.stdout.write(u.href)")" npx prisma <command>
```

---

## A fresh local database with demo data

For clicking through the app on your own machine without touching CCS Cloud. Needs MySQL 8.0 running locally ([tests/README.md](../../tests/README.md), "One-time setup", step 1).

**1. Create an empty database**, the same way as the test database ([tests/README.md](../../tests/README.md), step 2), with another name, for example:

```sql
CREATE DATABASE AdRIC_DB_dev;
```

Do not use `AdRIC_DB_test` for this: `npm test` drops and rebuilds that one on every run.

**2. Build the tables from the migrations.** Replace `<password>` with your local MySQL password.

PowerShell:
```
$env:PRISMA_TARGET_URL = "mysql://root:<password>@localhost:3306/adric_db_dev"
npx.cmd prisma migrate deploy
Remove-Item Env:PRISMA_TARGET_URL
```

Git Bash:
```
PRISMA_TARGET_URL="mysql://root:<password>@localhost:3306/adric_db_dev" npx prisma migrate deploy
```

It ends with "All migrations have been successfully applied."

**3. Seed it.** `SEED_PASSWORD` is the password every demo account gets: choose one, at least 8 characters. It is not stored anywhere but in the database (as plain text, like every password until issue #10).

PowerShell:
```
$env:SEED_DATABASE_URL = "mysql://root:<password>@localhost:3306/AdRIC_DB_dev"
$env:SEED_PASSWORD = "<a demo password>"
npm.cmd run seed
Remove-Item Env:SEED_DATABASE_URL, Env:SEED_PASSWORD
```

Git Bash:
```
SEED_DATABASE_URL="mysql://root:<password>@localhost:3306/AdRIC_DB_dev" SEED_PASSWORD="<a demo password>" npm run seed
```

It prints `[seed] Done: 7 roles, 10 labs, 8 demo accounts, 100 demo assets held by nobody.`

What it writes: the 7 roles; the 10 research centers; 8 demo accounts, first name "Demo", password `SEED_PASSWORD`:

| Email | Role | Lab |
|---|---|---|
| `demo.admin@dlsu.edu.ph` | Admin (user 1, the "nobody holds it" placeholder; Staff dashboard) | none |
| `demo.director@dlsu.edu.ph` | AdRIC Director | none |
| `demo.tsg@dlsu.edu.ph` | TSG Staff | none |
| `demo.labhead.cite4d@dlsu.edu.ph` | Lab Head | CITe4D |
| `demo.labhead.car@dlsu.edu.ph` | Lab Head | CAR |
| `demo.custodian.a@dlsu.edu.ph`, `demo.custodian.b@dlsu.edu.ph` | Custodian | CITe4D |
| `demo.custodian.c@dlsu.edu.ph` | Custodian | CAR |

and 100 demo assets, 10 per lab, all Active and held by nobody. No loans, repairs, reports, transfers, or disposals. (Known: the first time the loan list is loaded, the server itself inserts a pending loan with id 9 on the first asset, H-08.)

**The seed refuses, and writes nothing,** when `SEED_DATABASE_URL` or `SEED_PASSWORD` is missing, when the host is not `localhost` or `127.0.0.1` (it cannot reach CCS Cloud), when the tables do not exist yet (run step 2), or when the database already has users, roles, labs, or assets. It never reads `.env` and never prints the passwords.

**4. Run the app against it.** The server reads `.env`, but a variable already set in the shell wins, so set the five `DATABASE_*` values in this one terminal:

PowerShell:
```
$env:DATABASE_HOST = "localhost"; $env:DATABASE_PORT = "3306"; $env:DATABASE_USER = "root"
$env:DATABASE_PASSWORD = "<password>"; $env:DATABASE_NAME = "AdRIC_DB_dev"
npm.cmd run dev:all
```

Git Bash:
```
DATABASE_HOST=localhost DATABASE_PORT=3306 DATABASE_USER=root DATABASE_PASSWORD="<password>" DATABASE_NAME=AdRIC_DB_dev npm run dev:all
```

The server prints `Pool custodian check passed: user_id 1 (Demo Admin) ...`: that name tells you it is on the demo database. Close the terminal when done (PowerShell keeps the variables until then); a new terminal is back on `.env`.

To start over: drop and create the database again (step 1), then steps 2 and 3.

---

## Writing a Phase 3 change

Every structure change is a migration, tested on your local test database before it is merged. Nobody changes CCS Cloud by hand.

1. **Start from a test database at the latest migration:** `npm.cmd test` (PowerShell) or `npm test` (Git Bash). It rebuilds `AdRIC_DB_test` from every migration.
2. **Change `prisma/schema.prisma`.** If you run `npm test` now, it stops before any test with "prisma/schema.prisma has changes that no migration in prisma/migrations contains", and prints the SQL that is missing.
3. **Generate the migration** from the test database to your edited schema. Name the folder with the date and time and a short description: `YYYYMMDDHHMMSS_what_it_does`.

   PowerShell:
   ```
   $env:PRISMA_TARGET_URL = node -e "const u = new URL(require('dotenv').parse(require('fs').readFileSync('.env')).TEST_DATABASE_URL); u.pathname = u.pathname.toLowerCase(); process.stdout.write(u.href)"
   npx.cmd prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output prisma/migrations/20261101120000_nullable_custodian/migration.sql
   Remove-Item Env:PRISMA_TARGET_URL
   ```

   Git Bash:
   ```
   PRISMA_TARGET_URL="$(node -e "const u = new URL(require('dotenv').parse(require('fs').readFileSync('.env')).TEST_DATABASE_URL); u.pathname = u.pathname.toLowerCase(); process.stdout.write(u.href)")" npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output prisma/migrations/20261101120000_nullable_custodian/migration.sql
   ```

   `--output` writes the file (and its folder) directly, which avoids PowerShell's own file encoding. `migrate diff` only reads the test database.
4. **Read the SQL.** It is what will run on CCS Cloud one day. Check especially anything that drops a column or a table, or changes a column's type: data in it can be lost. If the change needs data moved (for example filling a new column from an old one), add that SQL by hand to the same file.
5. **`npm test` again.** It drops the test tables, applies every migration including yours, checks that the result matches `schema.prisma`, then runs every test. Fix the tests your change breaks in the same branch.
6. **Commit `schema.prisma` and the migration folder together**, and open a pull request. Never edit a migration that is already merged: write a new one.

Do not use `prisma migrate dev`: it creates and drops a second, temporary database, and when it finds a difference it offers to reset the database it is pointed at, which deletes all data. Do not use `prisma db push` or `prisma db pull` outside the test setup either.

---

## CCS Cloud

**Today (2026-10-16) CCS Cloud has no migration record.** Its structure matches the baseline (Raiki's read-only check on 2026-10-16, after one foreign key name was aligned in `schema.prisma`), but `prisma migrate deploy` there is refused ("The database schema is not empty", P3005), so no migration can reach it by accident.

**Marking it as "already at the baseline" is a team decision**, not done yet. It is one command, run once, by one person:

PowerShell (takes CCS Cloud's URL from the `DATABASE_URL` line still in your `.env`, without showing it):
```
$env:PRISMA_TARGET_URL = node -e "process.stdout.write(require('dotenv').parse(require('fs').readFileSync('.env')).DATABASE_URL)"
npx.cmd prisma migrate resolve --applied 0_init
Remove-Item Env:PRISMA_TARGET_URL
```

Git Bash:
```
PRISMA_TARGET_URL="$(node -e "process.stdout.write(require('dotenv').parse(require('fs').readFileSync('.env')).DATABASE_URL)")" npx prisma migrate resolve --applied 0_init
```

It creates `_prisma_migrations` on CCS Cloud with one row saying `0_init` is applied. It runs none of `0_init`'s SQL and touches no other table or row. Before it:

1. The read-only check below prints "This is an empty migration" **that day**.
2. A real backup of CCS Cloud, structure and data, kept outside the repository. There is none today (the backup job was deleted on 2026-10-09, F-39).
3. The CCS Cloud database account may create a table.
4. An agreed date (UAT starts 2026-10-21).

To undo it, drop `_prisma_migrations` on CCS Cloud, as long as no later migration was deployed.

**After marking, CCS Cloud changes only through `prisma migrate deploy`**, run by one person, with migrations that passed `npm test` and were merged, after a backup. Never `prisma migrate dev`, `prisma db push`, `prisma db pull`, or an ALTER by hand.

**The read-only check** (compares CCS Cloud with `schema.prisma`, writes nothing, prints SQL only):

PowerShell:
```
$env:PRISMA_TARGET_URL = node -e "process.stdout.write(require('dotenv').parse(require('fs').readFileSync('.env')).DATABASE_URL)"
npx.cmd prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
Remove-Item Env:PRISMA_TARGET_URL
```

Git Bash:
```
PRISMA_TARGET_URL="$(node -e "process.stdout.write(require('dotenv').parse(require('fs').readFileSync('.env')).DATABASE_URL)")" npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

"This is an empty migration" means they match. CCS Cloud's database name is used as written: the check of 2026-10-16 worked that way, so the lower-case rule above does not apply to it.

---

## Where things are

| Path | What |
|---|---|
| `prisma/schema.prisma` | The structure, as Prisma describes it; the Prisma client is generated from it |
| `prisma/migrations/0_init/migration.sql` | The baseline, generated by Prisma, never edited |
| `prisma/migrations/migration_lock.toml` | Says the migrations are for MySQL |
| `prisma/seed.ts`, `seedTarget.ts`, `seedData.ts` | The demo seed, its safety checks, and its data |
| `prisma.config.ts` | Where Prisma finds the schema and the migrations, and `PRISMA_TARGET_URL` |
| `tests/setup/globalSetup.ts` | Builds the test database from the migrations before every `npm test` |
| `docs/reference/AdRIC_DB_Schema.sql` | An old record of the structure and demo data. Builds nothing; do not run it |
