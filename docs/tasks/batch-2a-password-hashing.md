# Task: Batch 2a, password hashing (issue #10, findings C-03 and H-17)

Branch: from a fresh main (886b6f9 or newer): git switch main, git pull, git switch -c fix/10-password-hashing
Plan: claude/nov9-delivery-plan.md in the Project (Batch 2, "2a contents"). Batch 2b (sign-ups as database rows, IT Admin approval) is Aryan's and comes later. Do not start it.

## Commit 1: save this brief
Save this brief, word for word, as docs/tasks/batch-2a-password-hashing.md. Add your plan to the same file under "## Plan (stop 1)". That file is the source of truth for this batch.

## Goal
No password is stored, compared, logged, or answered as plain text anywhere. Login works exactly as before for everyone who types the right password.

## What exists today (confirm each against main before planning)
- Login compares the plain password inside the database query: findUserByCredentials in server/features/auth/auth.repository.ts. The column's collation ignores case, so "PASSWORD" also logs in (C-03, the TODO in auth.service.ts login).
- Sign-up stores the request in pending_registrations.json with the plain password. A missing password becomes "password123" (C-03, auth.service.ts around line 92; auth.validation.ts says the password is not required).
- approveRegistration copies targetReq.password (or "password123") into users.password.
- The demo seed (prisma/seed.ts) and the test seed (tests/setup/seed.ts with tests/setup/fixtures.ts) write plain passwords. The test harness logs in with the fixture's plain password.
- users.password is VARCHAR(255). No hashing package is installed. PUT /api/auth/account does not change passwords (confirm).

## The contract
1. One helper module, for example server/shared/services/passwords.ts. It is the only code that hashes or checks a password.
   - hashPassword(plain): Node's built-in crypto.scrypt (async, never scryptSync), 16-byte random salt, 64-byte key, N=32768, r=8, p=1, with maxmem raised enough for those parameters.
   - Stored format: scrypt$N$r$p$<salt base64>$<key base64>. The parameters live in the string so they can change later without breaking old hashes.
   - verifyPassword(plain, stored): parses the string, recomputes with the stored parameters, compares with crypto.timingSafeEqual. Returns false for anything that isn't a valid hash string. Never throws on bad input.
   - isPasswordHash(value): true only for that format.
   - No new package. If you think one is needed, ask first (AGENTS.md).
2. Login:
   - Look the user up by email only, then verifyPassword in code.
   - Unknown email and wrong password give the same 401 with the same message. For an unknown email, still run one verify against a fixed dummy hash, so timing doesn't reveal which emails exist.
   - There is no plain-text fallback, ever.
   - Remove the C-03 TODO.
3. Sign-up:
   - A password is required, 8 or more characters, checked on the server (400 with a plain message). The "password123" default is gone.
   - Update the sign-up page's own check from 6 to 8 characters in the same commit.
   - The request stored in pending_registrations.json holds only the hash.
4. Approval:
   - Copies the stored hash into users.password.
   - A request whose stored password is not a hash (filed before this change) is refused with 409: "This request was made before passwords were protected. Decline it and ask the applicant to sign up again." Nothing is created.
   - Do not read the real pending_registrations.json to check this. Use test fixtures.
5. Seeds and fixtures:
   - The demo seed and the test seed write hashes of the same passwords as today, so every login, test, and hand check keeps working.
   - The fixtures keep the plain password only for logging in.
6. One-time upgrade script, for example scripts/hash-existing-passwords.ts, run with tsx:
   - Hashes every users.password that is not already a hash. Already-hashed values are skipped, so running it twice changes nothing.
   - Prints only counts (hashed, skipped). Never a password, hash, email, or name.
   - Takes its database only from an explicit env var (for example HASH_TARGET_URL). Same local-only guard style as prisma/seedTarget.ts.
   - A non-local URL is refused unless an explicit --allow-remote flag is given. Only Macy runs it remotely, after a backup.
   - Document how to run it in docs/guides/DATABASE-MIGRATIONS.md (or a short new guide).
7. Nothing ever answers, logs, or puts in an error message a password or a hash. Check the error handler and every console call on the auth path.

## Commits (one change each, AGENTS.md style)
1. docs: this brief and your plan
2. feat(auth): password hashing helper, with unit tests
3. fix(auth): login checks the hash, not plain text (#10). The test seed and fixtures move to hashes in this same commit, since the login tests pin them. Say so.
4. fix(auth): sign-up requires a password and stores only its hash; approval copies the hash, refuses old plain requests (#10)
5. feat(db): one-time script to hash existing passwords (#10)
6. fix(seed): the demo seed writes hashed passwords (#10)
7. docs: log, README/HANDOFF status, AGENTS.md counts

## Tests to add or change (each new test must fail on the old code first, where that makes sense)
- The helper: the hash has the scrypt$ format; the same password hashed twice gives different strings; verify true for the right password, false for a wrong one, a different letter case, an empty string, a malformed hash, and a plain string.
- Login: the right password gives 200; the right password in a different case gives 401 (C-03 gone); a wrong password and an unknown email give the same 401 body.
- Sign-up: no password gives 400; 7 characters gives 400; 8 characters gives 200. The stored request in the test's temporary pending file holds a scrypt$ hash and not the plain password.
- Approval: the new account can log in with the original password; its users.password is a hash; a pending request with a plain password gives 409 and creates nothing.
- No answer from sign-up, approval, login, /me, account, or the pending list contains the plain password or "scrypt$".
- The upgrade script: hashes plain rows, skips hashed rows, a second run changes 0 rows, the output has no password, and a remote URL without the flag is refused.

## Stops
- Stop 1, plan: read the auth feature (routes, validation, controller, service, repository), tests/setup, prisma/seed.ts, and the sign-up page. Confirm or correct every point under "What exists today". List the files you'll change. Write the plan into the task file. Ask your questions in the AGENTS.md format. Commit the docs. Stop.
- Stop 2, build: commits 2 to 6 as above. Run typecheck and npm test after each, and build after any commit with web files. Today: typecheck 49, tests 443. Typecheck must not go up. Report each count change with the reason. Stop.
- Stop 3, hand checks (Playwright on the local UAT copy, started only through C:\dev\uat-data\start-local-uat.ps1; ports 4000 and 5173 free first; accounts from C:\dev\uat-data\uat-passwords.txt, never copied anywhere):
  - H1: run the upgrade script on adric_uat_check. Report the counts. Run it again: 0 hashed.
  - H2: SELECT only LEFT(password, 7) for all users. Every row is "scrypt$". Never print more.
  - H3: log in as Staff, Lab Head, Director, and Custodian with their usual passwords. All work.
  - H4: the Custodian's password in a different letter case is refused.
  - H5: a new sign-up with an 8+ character password. The Lab Head approves it (still the Lab Head until 2b). The new account logs in.
  - H6: the sign-up page refuses a 7-character password.
  Results go in the task file under "## Hand checks: results". Note: uat-reset.sql puts plain passwords back, so rerun the script after any reset. Stop.
- Stop 4: the docs commit, then the final report (AGENTS.md "Reporting"). Commit, never push.

## Never
- Read or print .env or pending_registrations.json.
- Run anything against CCS Cloud.
- Change prisma/schema.prisma, prisma/migrations, package.json, or package-lock.json.
- Leave a plain-text fallback in login "for old accounts". The upgrade script is the path for old accounts.

## Plan (stop 1)

Branch `fix/10-password-hashing`, from main at 886b6f9a.

### What exists today: checked against main

| Point in the brief | Result |
|---|---|
| Login compares the plain password in the query | Confirmed: `findUserByCredentials`, `auth.repository.ts:117`. The TODO is at `auth.service.ts:212`. Addition: on CCS Cloud the collation also ignores accents (HANDOFF, C-03 check), so that goes away too. |
| Sign-up stores plain text, and a missing password becomes "password123" | Confirmed: `auth.service.ts:92-93`, `auth.validation.ts:11`. |
| Approval copies the password or "password123" | Confirmed: `auth.service.ts:151`. |
| Seeds write plain passwords, and the harness logs in with the fixture's | Confirmed: `prisma/seed.ts:91` (one `SEED_PASSWORD` for every demo account), `tests/setup/seed.ts:45`, `tests/setup/harness.ts:87`. Addition: `tests/api/session.test.ts:216` creates its own account with a plain password and logs in with it, so it must move to a hash in commit 3. `registration.test.ts:272` also inserts a plain password but never logs in with it, so it stays. |
| `users.password` is VARCHAR(255) | Confirmed: `schema.prisma:146`. A hash is 130 characters, so it fits and no migration is needed. |
| No hashing package | Confirmed. Node's built-in `crypto.scrypt` is enough. One hash took about 70 ms on this PC. |
| PUT /api/auth/account does not change passwords | Confirmed: `updateAccount` writes only the names and the picture. |

### Found beyond the brief

1. **Logs can hold a password today (contract point 7).**
   - `errorHandler.ts:56` logs the JSON parser's message. On this Node version that message can quote the body. Checked: a malformed body gave `..."assword": made-up-se"... is not valid JSON`.
   - `errorHandler.ts:67` logs any other error in full. A Prisma validation error quotes the values it was given, so a request with an invalid `userType` could put the hash in the log when `createUser` fails on approval.
   - `auth.repository.ts:192` logs the parser error for a damaged pending file, which can quote the file.
   - `prisma/seed.ts` hides `SEED_PASSWORD` from its errors, but would not hide a hash.
2. **No answer sends a whole user row.** I checked every `users: true` and `prisma.users.findMany()`: the services map them to names and emails, and the transfer's `recipient` is used only for its email. I will still pin this with a test that goes beyond the brief's list: the main list screens' answers hold no "scrypt$".
3. **Sign-up has a race to protect.** Today the "already waiting" check and the add run with no `await` between them, so a double submit cannot file two requests (issues #14, #81). Hashing is async. So the order must be: account check, hash, then the waiting check and the add together. Hashing between the waiting check and the add would bring the bug back.
4. **A plain row must not answer faster than a hashed one.** `verifyPassword` returns at once for a plain string, which would reveal an existing email on a database not yet upgraded. Login therefore verifies against the dummy hash whenever the stored value is not a hash.
5. **Non-string passwords.** `{"password": 12345678}` reaches the code today. `verifyPassword` returns false (login 401), and sign-up answers 400.
6. **`tsconfig.json` does not include a `scripts/` folder,** so a script there would never be typechecked. Decision: the script goes beside the seed, as `prisma/hashExistingPasswords.ts` and `prisma/hashTarget.ts` (the brief's path was an example). No `tsconfig.json` change.

### Design

- **`server/shared/services/passwords.ts`:** `hashPassword`, `verifyPassword`, `isPasswordHash` as in the contract, plus `hidePasswordHashes(text)` for logs. It imports only `node:crypto`, not `config/env`, so the seeds and the tests can use it. `maxmem` is 64 MiB here. Node refuses these parameters at its default limit (checked). For a stored hash it is worked out from that hash's own parameters. `isPasswordHash` accepts only a power-of-two N, positive r and p, and a size limit, so a damaged row cannot ask for huge memory.
- **Dummy hash:** a module constant in valid format, made of random bytes when the module loads. No password exists behind it, so nothing secret is in the code. Login also checks that a user was found, so it can never match.
- **Login:** the repository's `findUserByCredentials` becomes `findUserForLogin(email)`, by email only, with the same roles and labs. The service runs one verify on every path, then answers the same 401.
- **Sign-up minimum:** `MIN_PASSWORD_LENGTH = 8` in a new `shared/constants/passwords.ts`, used by `auth.validation.ts` and `Register.tsx`, so the two cannot differ. Message: "Password must be at least 8 characters long." Existing accounts with shorter passwords keep working, since login has no length check.
- **Approval:** the `isPasswordHash` check runs right after the 404 check. The request stays in the list so the Lab Head can decline it. The Lab Head's screen already shows the server's message in an alert (`serverData.tsx:407`).
- **Test seed:** hashes the fixtures' passwords with `Promise.all`, about 0.3 s more per test file, so about 5 s per full run.
- **Upgrade script:** `HASH_TARGET_URL` only, never `.env`. A guard module in the style of `seedTarget.ts`, with `--allow-remote` as the only way past the local check. Reads `user_id` and `password`, updates row by row, safe to run again after a failure. Prints only `hashed: N, skipped: N`. Any error prints only its type and code.
- **Old-request test:** `startTestServer` gets an optional list of pending requests, written to its temporary folder before the server starts, since the server reads the file once at startup. The real file is never read.

### Files

| Commit | Files |
|---|---|
| 2 helper | new `server/shared/services/passwords.ts`, new `tests/unit/passwords.test.ts` |
| 3 login | `auth.repository.ts`, `auth.service.ts`, `tests/setup/seed.ts`, `tests/setup/fixtures.ts` (header comment), `tests/api/auth.test.ts`, `tests/api/session.test.ts` |
| 4 sign-up, approval | `auth.service.ts`, `auth.validation.ts`, `auth.repository.ts` (TODO wording), `auth.controller.ts` (TSDoc), `shared/types/auth.ts`, new `shared/constants/passwords.ts`, `web/pages/auth/Register.tsx`, `web/api/auth.api.ts` (comment), `tests/setup/testServer.ts`, `tests/api/registration.test.ts`, new `tests/api/registrationOldRequest.test.ts` |
| 5 script | new `prisma/hashExistingPasswords.ts`, new `prisma/hashTarget.ts`, new `tests/db/hashExistingPasswords.test.ts`, `docs/guides/DATABASE-MIGRATIONS.md` |
| 6 demo seed | `prisma/seed.ts`, `prisma/seedTarget.ts` (comment), `docs/guides/DATABASE-MIGRATIONS.md` (step 3 wording) |
| 7 docs | this file, `docs/README.md`, `docs/HANDOFF.md`, `AGENTS.md` (test count), `docs/phase-1b-deep-map/01B-findings-register.md` if it tracks status |

The log fixes in "Found beyond the brief", item 1, need a home: see question Q1. They touch `errorHandler.ts`, `auth.repository.ts`, `tests/api/errorHandler.test.ts`, and the seed's error text.

### Tests that pin old behavior and change

- `auth.test.ts:80` "logs in with the password in a different letter case (known defect C-03)" flips to 401.
- `registration.test.ts:90` "stores password123" flips to a stored hash.
- `registration.test.ts` `applicant()` gets a default password of 8 or more characters, since most of its sign-ups send none and would now get 400.

### Not changed

- `web/state/serverData.tsx:132` and `:142`, a stale C-04 TODO and an unused `password?` field. The server stopped sending it in #72. It is harmless and not this issue.
- The email logged at `auth.controller.ts:41` and `:129`. It breaks the AGENTS.md rule on emails in logs, but it is not a password or a hash.
- There is no login rate limit, and each attempt now costs about 70 ms of CPU and 32 MiB. Noted for the final report.
- An invalid `userType` on sign-up still fails at approval with a 500. Only the log text is fixed here.

## Questions (stop 1)

### Answers

Raiki accepted stop 1 with these answers and changes.

**Q1: A.** New commit 7, before docs (docs becomes commit 8): `fix(auth): logs never hold a password or a hash (#10)`.

- errorHandler body-parse log: method, URL and error type only. Drop the parser's message.
- errorHandler 500 log: pass the logged text through `hidePasswordHashes`.
- `auth.repository` pending-file load error: log only the error's name (for example SyntaxError), not its message.
- The demo seed's error text also hides hashes.
- Each fix gets a test that spies on `console.error` and checks that the output holds neither the plain password nor "scrypt$". Each test must fail on the old code.

**Q2: A.** Remove the password from the print line in `scratch/check_users.ts`, in commit 7.

**Q3: neither A nor B.** Fact not known at stop 1: the deployed UAT site runs the frozen old code against CCS Cloud, and the Nov 3 UAT sessions use it. Running the script there would lock everyone out of that site. The guide in commit 5 says:

- Nothing runs against CCS Cloud before the Nov 8 deploy. Merging this branch is safe because main isn't deployed until then. After the merge, main run against CCS Cloud refuses every login, so use a local copy.
- Local copies (adric_uat_local, adric_uat_check, anyone's): after pulling main, run the script on the local copy with HASH_TARGET_URL. Run it again after every uat-reset.sql load, because that file puts plain passwords back. The command is given as one PowerShell line.
- Nov 8 deploy, recommended path: a fresh database from migrations plus the seed. The seed writes hashes, so the script is not needed.
- Nov 8, only if Macy upgrades the existing UAT data instead: back up first. The backup holds plain passwords, so it is never committed, posted or shared. Deploy the new code, run the script with --allow-remote straight away, and decline any sign-up request made before the change (it gets 409).

**Also added:**

1. `MAX_PASSWORD_LENGTH = 128` in `shared/constants/passwords.ts`, next to the minimum, created in the first commit that needs it. The server takes bodies up to 50 MB, so an unbounded password costs CPU on every attempt.
   - Sign-up: over 128 gives 400, "Password must be at most 128 characters long."
   - Login: a non-string or over-128 password still runs one dummy verify (on a short fixed string), then gives the same 401. Nothing about the email changes the timing.
   - Tests: a 129-character sign-up gives 400; a 129-character login gives the same 401 body as a wrong password.
2. `Register.tsx`: the "Min. 6 characters" placeholder and the length check both use the constants, with maxLength on the input.
3. The script's guard reuses `parseSeedTarget` from `prisma/seedTarget.ts` for the local-host rule, adding only the --allow-remote switch. The rule is not copied into a second file. Any change to its error class or messages is reported.
4. The dummy hash uses the same N, r and p as real hashes, so a dummy verify takes the same time as a real one, pinned by a unit test that parses its parameters.

**Confirmed:**

- `prisma/hashExistingPasswords.ts` plus `prisma/hashTarget.ts`.
- The extra test that list screens never contain "scrypt$".
- Left out, and listed in the final report: the emails in `auth.controller` logs, the rate limit, and the userType 500.
- `claude/nov9-delivery-plan.md` is a Project doc, not in the repo. The brief is enough.

**Stop 2 is now commits 2 to 7.** Typecheck and `npm test` after each, build after any commit touching web files, each count change reported with its reason. Stop after commit 7.
