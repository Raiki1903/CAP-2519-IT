# Database migrations: a guide for the team

How the database is built from files since restructure step 14 (2026-10-16), how to make a local copy with demo data, how to write a Phase 3 change, and the rules for CCS Cloud.

Every command is given twice: for **PowerShell** in VS Code (use `npx.cmd` and `npm.cmd`: plain `npx` and `npm` are blocked there by the execution policy) and for **Git Bash**. Run them from the repository root.

---

## The words

- A **migration** is a file of SQL in `prisma/migrations/<name>/migration.sql` that changes the database's structure: a new column, a new table, a renamed key. Migrations are kept in git and reviewed like code.
- `prisma migrate deploy` applies, in name order, every migration a database has not had yet, and records each one in a table it keeps in that database, `_prisma_migrations`. The app never reads that table.
- The **baseline** is the first migration, `prisma/migrations/0_init`: the whole structure as it was on 2026-10-16 (15 tables). Every later migration builds on it ("The migrations so far" lists them).
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
$env:PRISMA_TARGET_URL = "mysql://root:<password>@localhost:3306/AdRIC_DB_dev"
npx.cmd prisma migrate deploy
Remove-Item Env:PRISMA_TARGET_URL
```

Git Bash:
```
PRISMA_TARGET_URL="mysql://root:<password>@localhost:3306/AdRIC_DB_dev" npx prisma migrate deploy
```

It ends with "All migrations have been successfully applied."

**3. Seed it.** `SEED_PASSWORD` is the password every demo account gets: choose one, at least 8 characters. It is not stored anywhere: the database holds only its hash.

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

It prints `[seed] Done: 5 roles, 10 labs, 11 demo accounts, 12 demo assets, one in each status.` and the emails to log in with.

What it writes: the 5 roles; the 10 research centers, each on its campus (TE3D and GAME at Laguna, HXIL at McKinley, the rest at Manila); the funding sources, issue types, and metric definitions the forms offer (the ones the migrations wrote are kept); and 11 demo accounts, first name "Demo", who log in with `SEED_PASSWORD`:

| Email | Role | Labs |
|---|---|---|
| `demo.admin@dlsu.edu.ph` | IT Admin | none |
| `demo.director@dlsu.edu.ph` | AdRIC Director | none |
| `demo.secretary@dlsu.edu.ph` | AdRIC Secretary | none |
| `demo.tsg@dlsu.edu.ph`, `demo.tsg.b@dlsu.edu.ph` | TSG Staff | none |
| `demo.labhead.cite4d@dlsu.edu.ph` | Researcher, heads CITe4D (the Lab Head view) | CITe4D |
| `demo.labhead.car@dlsu.edu.ph` | Researcher, heads CAR (the Lab Head view) | CAR |
| `demo.researcher.a@dlsu.edu.ph` | Researcher | CITe4D |
| `demo.researcher.b@dlsu.edu.ph` | Researcher | CITe4D and CAR |
| `demo.researcher.c@dlsu.edu.ph` | Researcher | HXIL |
| `demo.pending@dlsu.edu.ph` | none (a Pending sign-up: cannot log in) | CeLT |

and 12 demo assets in four labs (CITe4D, CAR, HXIL, TE3D), with home rooms: at least one in each of the six statuses (Available, On Loan, Maintenance, Pending Retirement, Retired, Missing), each with an Initial inspection, plus the loan, maintenance ticket, retirements, and log row behind the ones that are not Available.

**The seed refuses, and writes nothing,** when `SEED_DATABASE_URL` or `SEED_PASSWORD` is missing, when the host is not `localhost` or `127.0.0.1` (it cannot reach CCS Cloud), when the tables do not exist yet (run step 2), or when the database already has users, roles, labs, or assets. It never reads `.env` and never prints the passwords.

**4. Run the app against it.** The server reads `.env`, but a variable already set in the shell wins, so set the five `DATABASE_*` values in this one terminal.

**`DATABASE_PASSWORD` is your local MySQL root password** (the one in `TEST_DATABASE_URL`), **not `SEED_PASSWORD`**. `SEED_PASSWORD` is only what the demo accounts log in with. To copy the root password from `TEST_DATABASE_URL` in your `.env` without typing or showing it, use the first line of each form below instead of typing it.

PowerShell:
```
$env:DATABASE_PASSWORD = node -e "process.stdout.write(decodeURIComponent(new URL(require('dotenv').parse(require('fs').readFileSync('.env')).TEST_DATABASE_URL).password))"
$env:DATABASE_HOST = "localhost"; $env:DATABASE_PORT = "3306"; $env:DATABASE_USER = "root"; $env:DATABASE_NAME = "AdRIC_DB_dev"
npm.cmd run dev:all
```

Git Bash:
```
DATABASE_PASSWORD="$(node -e "process.stdout.write(decodeURIComponent(new URL(require('dotenv').parse(require('fs').readFileSync('.env')).TEST_DATABASE_URL).password))")" DATABASE_HOST=localhost DATABASE_PORT=3306 DATABASE_USER=root DATABASE_NAME=AdRIC_DB_dev npm run dev:all
```

The server prints `Database: AdRIC_DB_dev on localhost` when it starts: that line tells you it is on the demo database. Close the terminal when done (PowerShell keeps the variables until then); a new terminal is back on `.env`.

If login fails, read that line first: any other name or host means the server is on another database (for example CCS Cloud, through `.env`), where the demo accounts do not exist.

**Use a private browser window for the demo database, or log out before switching.** The login cookie holds only your user id (and when it expires), not which database it came from. A browser logged in while the server ran on one database stays logged in as the same user id after the server is switched to another: for example, demo user 3 (Demo TSG Staff) becomes CCS Cloud's user 3, whoever that is, until the cookie expires (8 hours) or you log out. A private window keeps the demo login apart and forgets it when closed.

To start over: drop and create the database again (step 1), then steps 2 and 3.

---

## Hashing the passwords of existing data

Since issue #10, login checks a hash and has no plain-text fallback, so an account whose password is still plain text cannot log in. `prisma/hashExistingPasswords.ts` hashes every `users.password` that is not a hash yet. The password each person types stays the same. Already-hashed rows are skipped, so running it twice changes nothing. It prints only the two counts, `[hash] hashed: 8, skipped: 0`, and never a password, a hash, an email, or a name.

It takes its database only from `HASH_TARGET_URL`, never from `.env`, and refuses any host but `localhost` or `127.0.0.1` unless `--allow-remote` is given.

**Nothing runs against CCS Cloud before the Nov 8 deploy.** The deployed UAT site runs the frozen old code against CCS Cloud, and the UAT sessions use it. Running the script there would lock everyone out of that site. Merging this change is safe, because `main` is not deployed until then. After the merge, `main` run against CCS Cloud refuses every login, so use a local copy.

**Local copies** (anyone's): after pulling `main`, run the script on the local copy. Run it again after every `uat-reset.sql` load, because that file puts plain passwords back. In PowerShell, as one line, with `<your local database>` replaced by your copy's name (for example `adric_uat_local`). It asks for your local MySQL root password without showing it, encodes it for the URL, and keeps it out of the shell history:

```
$s = Read-Host "Local MySQL root password" -AsSecureString; $p = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)); $env:HASH_TARGET_URL = "mysql://root:$([uri]::EscapeDataString($p))@localhost:3306/<your local database>"; npx.cmd tsx prisma/hashExistingPasswords.ts; Remove-Item Env:HASH_TARGET_URL; Remove-Variable p, s
```

**Nov 8 deploy, recommended path:** a fresh database from the migrations plus the seed ("A fresh local database with demo data" shows both commands). The seed writes hashes, so the script is not needed.

**Nov 8, only if Macy upgrades the existing UAT data instead:**

1. Back up first. The backup holds plain passwords, so it is never committed, posted, or shared.
2. Deploy the new code.
3. Run the script straight away, with `--allow-remote` after the file name. It is the same command as above, with the deployed database's user, host, and name in the URL.
4. A sign-up request made before the change sits in `pending_registrations.json`, which the app no longer reads (see "Sign-ups since Batch 2b"). The applicant signs up again.

---

## Sign-ups since Batch 2b

A sign-up is a row in `users` with status PENDING and no role, plus `user_centers` rows for the labs it asked for. The IT Admin approves it with a role and labs, or rejects it, on the Approvals page (`/it-admin/approvals`). Nothing reads or writes `pending_registrations.json` any more, and the old Lab Head sign-up routes answer 404. The demo seed has one Pending sign-up (`demo.pending@dlsu.edu.ph`), so Approvals is not empty on a fresh database.

**After pulling Batch 2b, move or delete `pending_registrations.json`** in your repository folder. The app ignores it. It holds personal data and old requests, so it is never committed or shared (its `.gitignore` line stays). The requests still in it are not carried over: those applicants sign up again, and their email and ID number are free, because no account exists for them. In PowerShell, from the repository root, either keeps it outside the repository for reference, or throws it away:

```
Move-Item pending_registrations.json C:\dev\uat-data\
Remove-Item pending_registrations.json
```

**A rejected sign-up keeps its email and ID number.** The account is Rejected, not deleted, so the same person gets 409 "An account with this email or ID number already exists. Ask the IT Admin." when they sign up again. To free the email and ID number, the IT Admin anonymizes the account (contract section 4: the name, email and ID number are replaced, and the history stays). Anonymize is a step on the IT Admin's Users page, and nobody changes the database by hand.

**Failed logins** are counted in the server's memory: 5 failures for one email from one address within 15 minutes block that pair for 15 minutes (429). A server restart clears the count. On a local copy, restart the app (`start-local-uat.ps1`) to try again at once.

## Resetting a local UAT copy after Batch 1

`uat-reset.sql` holds the UAT data in the **old** tables (the structure of `0_init`), so it no longer loads into an up-to-date database. Load it into the baseline, then let the migrations bring it forward. Run each line in PowerShell from the repository root, in order, on **your local copy only** (here `<db>`, for example `adric_uat_local`; write the name in lower case). Each line asks for the MySQL root password without showing it (`mysql -p` asks by itself) and keeps it out of the shell history; nothing is typed into a URL by hand.

1. **Drop and create the copy** (this deletes the copy, only the copy):
   ```
   & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p -e "DROP DATABASE IF EXISTS <db>; CREATE DATABASE <db>;"
   ```
2. **Build the baseline tables:**
   ```
   $s = Read-Host "Local MySQL root password" -AsSecureString; $p = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)); $env:PRISMA_TARGET_URL = "mysql://root:$([uri]::EscapeDataString($p))@localhost:3306/<db>"; npx.cmd prisma db execute --file prisma/migrations/0_init/migration.sql; Remove-Item Env:PRISMA_TARGET_URL; Remove-Variable p, s
   ```
3. **Mark the baseline as applied** (same line with `npx.cmd prisma migrate resolve --applied 0_init` in place of the `db execute`).
4. **Load the UAT data** into the old tables. MySQL reads the file itself (`source`, with forward slashes), so PowerShell never re-encodes it and characters such as the dash in the old location text arrive intact:
   ```
   & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p --default-character-set=utf8mb4 <db> -e "source C:/path/to/uat-reset.sql"
   ```
5. **Bring it forward:** the same line as step 2 with `npx.cmd prisma migrate deploy` in place of the `db execute`. It ends with "All migrations have been successfully applied." If the foundation migration stops, it names what it could not place (for example a tag prefix that matches no lab); stop there and ask Raiki.
6. **Hash the passwords** `uat-reset.sql` put back: the one-line command in "Hashing the passwords of existing data", with `<db>`.

Then start the app on the copy ("A fresh local database with demo data", step 4, with `DATABASE_NAME` set to `<db>`) and check the startup line says `Database: <db> on localhost`.

## Backup dry run

- `Dump20261021.sql` is a CCS Cloud copy from 2026-10-21 23:32, taken before the UAT reset. It is only read, never restored.
- A CCS Cloud dump starts with `CREATE DATABASE AdRIC_DB` and `USE AdRIC_DB`. Loading it as-is goes into a local `AdRIC_DB` (`adric_db` on Windows), not the target. Strip the first two lines first. This line writes `Dump20261021-nodb.sql` next to the dump (UTF-8 without a BOM) and leaves the dump unchanged:
  ```
  $dump = "C:\dev\uat-data\Dump20261021.sql"; [IO.File]::WriteAllLines(($dump -replace '\.sql$', '-nodb.sql'), (Get-Content $dump -Encoding UTF8 | Select-Object -Skip 2))
  ```
- The dry run on it stops at the expand migration: CCS Cloud's tables are `utf8mb4_0900_ai_ci` and ours are `utf8mb4_unicode_ci` (error 1267). It also has 5 July test assets with `EQ-2026-` tags and 2 `is_immediate` rows. These are known limits of upgrading old data, not defects, because the Nov 8 deploy starts from a fresh database.

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

## The migrations so far

Applied in this order by `prisma migrate deploy`. Never edit one that is merged: write a new one.

| Migration | What it does |
|---|---|
| `0_init` | The baseline: the 15 tables as CCS Cloud had them on 2026-10-16 |
| `20261103090000_rename_tables_columns_roles` | Batch 1. Renames by hand, with no data lost: `asset_repairs` to `asset_maintenance`, `asset_disposals` to `asset_retirements`, `asset_reports` to `asset_inspections`, and their columns; the loan's `requested_at` and `return_by`; the project code columns; the roles `CUSTODIAN` and `ADMIN` to `RESEARCHER` and `IT_ADMIN`, and `ITS_STAFF` removed |
| `20261103120000_foundation_expand_backfill` | Batch 1. Adds the lookup tables (funding sources, issue types, metric definitions and the metrics of each category), `user_tickets`, `activity_log`, and `asset_inspection_metrics`; stores the asset's status, home lab, room, project, funding, and tags on `assets`; turns the loan, maintenance, retirement, and inspection statuses and types into enums; adds the new process columns; copies each return onto its loan; sets campuses (McKinley added) and the Lab Heads; removes `LAB_HEAD`; adds the CHECK constraints. Every backfill stops with the list of what it could not place |
| `20261103180000_drop_replaced_tables_columns` | Batch 1. Drops what the foundation migration replaced: `asset_records`, `asset_monetary`, `asset_returns`, `asset_transfers`, `asset_maintenance.is_immediate`, and `projects.funding_agency` |

## Where things are

| Path | What |
|---|---|
| `prisma/schema.prisma` | The structure, as Prisma describes it; the Prisma client is generated from it |
| `prisma/migrations/0_init/migration.sql` | The baseline, generated by Prisma, never edited |
| `prisma/migrations/migration_lock.toml` | Says the migrations are for MySQL |
| `prisma/seed.ts`, `seedTarget.ts`, `seedData.ts` | The demo seed, its safety checks, and its data |
| `prisma/hashExistingPasswords.ts`, `hashTarget.ts` | Hashes the plain passwords of older data, local copies only unless told otherwise |
| `prisma.config.ts` | Where Prisma finds the schema and the migrations, and `PRISMA_TARGET_URL` |
| `tests/setup/globalSetup.ts` | Builds the test database from the migrations before every `npm test` |
| `docs/reference/AdRIC_DB_Schema.sql` | An old record of the structure and demo data. Builds nothing; do not run it |
