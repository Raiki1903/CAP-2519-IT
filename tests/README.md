# API tests

Automated tests for the backend API. They start the real `server.ts`, send it HTTP requests, and check the answers and what was written to the database. Their job is to tell us, with one command, whether a change to the backend (for example the split of `server.ts` in restructure steps 10 to 12) changed what the API does.

They run against a **test database on your own computer**, never the shared CCS Cloud database.

The plan of what is tested, endpoint by endpoint, is in [docs/phase-2-tests/01-test-plan.md](../docs/phase-2-tests/01-test-plan.md).

---

## One-time setup

### 1. Install MySQL Server 8.0

CCS Cloud runs MySQL 8.0.46, so we test against the same version.

1. Download the **MySQL Installer for Windows** from the MySQL website (Community edition) and run it.
2. Pick **MySQL Server 8.0.46**. If the installer offers a setup type, choose **Development Computer**.
3. Keep port **3306**. **Untick "Open Windows Firewall ports for network access"**: only your own computer needs to reach it.
4. Set a **root password** and write it down. You need it in step 3. Do not reuse a real password.
5. Let it install MySQL as a Windows service that starts automatically (the default).

To check it is running: open PowerShell and run `Get-Service MySQL80`. The status should be `Running`.

On macOS or Linux, install MySQL Server 8.0 the usual way for your system. Everything below works the same.

### 2. Create the test database

Open **MySQL 8.0 Command Line Client** (in the Start menu), type your root password, then run:

```sql
CREATE DATABASE AdRIC_DB_test;
```

That is all. The tables are created by the tests themselves.

### 3. Point the tests at it

Open the `.env` file in the repository root (copy `.env.example` to `.env` first if you have none) and add this line, with your root password in place of `<password>`:

```
TEST_DATABASE_URL=mysql://root:<password>@localhost:3306/AdRIC_DB_test
```

If your password contains `@`, `:`, `/`, or `#`, replace those characters as follows: `@` becomes `%40`, `:` becomes `%3A`, `/` becomes `%2F`, `#` becomes `%23`.

`.env` is never committed. Do not paste this line anywhere else.

---

## Running the tests

```
npm test
```

You do not need to stop `npm run dev:all`: the tests start their own copy of the server on a free port and never use port 4000. Stopping it the first time keeps the output easier to read.

A good run ends like this:

```
 Test Files  11 passed (11)
      Tests  267 passed (267)
```

The first time, Windows may ask whether to allow Node.js through the firewall. Choose **Cancel** (or deny). The tests only talk to your own computer, so they work either way.

To run one file: `npx vitest run tests/api/smoke.test.ts`.

---

## What happens when you run `npm test`

Some words first:

- A **test runner** is the program that finds the test files, runs them, and reports what passed. We use **Vitest**.
- A **test** is a small program that does one thing to the system and checks the result, for example "log in as Custodian A and expect the role Custodian".
- The **harness** is the setup code in `tests/setup/` that prepares everything a test needs: the database, the data, and the running server.
- **Seed data** (or **fixtures**) is the fake data written into the database before the tests run: fake people, one fake lab, fake assets.

In order:

1. **The guard checks `TEST_DATABASE_URL`.** It stops everything unless the host is `localhost` or `127.0.0.1` **and** the database name ends in `_test`. This is what keeps the tests away from CCS Cloud. (`tests/setup/testDatabase.ts`)
2. **The tables are loaded** from `prisma/schema.prisma` into the test database with `prisma db push`. Only `TEST_DATABASE_URL` is used for this. (`tests/setup/globalSetup.ts`)
3. **For each test file, one at a time:**
   - every table in the test database is emptied and the fake data is written in (`tests/setup/seed.ts`, values in `tests/setup/fixtures.ts`);
   - `server.ts` is started as a separate process on a free port, connected to the test database only, with email and backups switched off, and with its working folder set to a temporary folder (so `pending_registrations.json` is written there, never in the repository);
   - the tests in that file run;
   - the server is stopped and its temporary folder deleted.

Because every file starts from the same fresh data and a fresh server, no test depends on what another file did.

---

## The fake data

Defined in [setup/fixtures.ts](setup/fixtures.ts). Everything is invented. Never copy real data into it, from CCS Cloud, `scratch/backups/`, or `pending_registrations.json`.

| Accounts (all `@example.test`) | Role |
|---|---|
| `admin` (user 1, the server's default custodian) | ADMIN |
| `director` | ADRIC_DIRECTOR |
| `staff.tsg`, `staff.its` | TSG_STAFF, ITS_STAFF |
| `labhead` | LAB_HEAD |
| `custodian.a`, `custodian.b` | CUSTODIAN |
| `secretary` | ADRIC_SECRETARY |

One lab, `TEST` (Test Research Lab, Manila). Six assets, `TEST-0001` to `TEST-0006`: available, on loan (to Custodian A), in repair, disposed, with a pending loan (from Custodian B), and inspected.

---

## Writing a test file

Put API tests in `tests/api/<feature>.test.ts`. Start from [api/smoke.test.ts](api/smoke.test.ts):

```ts
import { describe, expect, it } from "vitest";
import { ASSETS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db } = useApiHarness();   // fresh data and a fresh server for this file

describe("loans", () => {
  it("refuses a second request on an asset that already has a pending loan, with 409 (issue #25)", async () => {
    const res = await api.post(`/api/assets/${ASSETS.pendingLoan.tag}/borrow`, {
      borrower: USERS.custodianA.fullName, purpose: "Test purpose", dueDate: "2030-01-01",
    });
    expect(res.status).toBe(409);
    expect(await db.asset_loans.count({ where: { asset_id: ASSETS.pendingLoan.assetId, status: "pending" } })).toBe(1);
  });
});
```

- `api.get/post/put/delete(path, body)` returns `{ status, body }`.
- `db` is Prisma on the test database, for reading back what a request wrote.
- Name each test after what it checks. If it pins a known defect, put the finding ID in the name, for example `"finalizing a return leaves the loan open (known defect H-04)"`.
- These are **characterization tests**: they record what the API does **today**, even where that is wrong, so that a later change that alters it by accident makes a test fail. Do not "fix" the expected value to what it should be.
- Do not check exact timestamps, generated ids, or text containing today's date.
- Tests inside one file share that file's data, in order. Keep each test's changes in mind for the next one, or use a different seeded asset.
- When a test changes an asset's state (a borrow, a return, a transfer, a repair, an inspection, a disposal), give it an asset of its own: `addExtraAsset(db, { tag: "TEST-0101", status: "ON_LOAN" })` from [setup/extraAssets.ts](setup/extraAssets.ts) adds one in the state you ask for. Use a tag no other test in the file uses.
- Each file gets the same fresh data, so a test file never relies on another file.

---

## When something goes wrong

| You see | It means |
|---|---|
| `Test database refused: ...` | `TEST_DATABASE_URL` is missing or does not pass the guard. The message says which rule failed. |
| `No test files found, exiting with code 1` together with an error below it | The setup failed before any test ran. The real cause is the error printed under it. |
| `Could not open localhost:3306/AdRIC_DB_test` | MySQL is not running (`Get-Service MySQL80`), the password in `TEST_DATABASE_URL` is wrong, or the database was not created (step 2). |
| `prisma db push failed` | The tables could not be created. Read the Prisma message under it. |
| `server.ts exited during startup` | The server crashed while starting. Its own output is printed under the message. |
