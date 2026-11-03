# Batch 2b: sign-ups in the database, IT Admin approvals, login limit

**Owner:** Raiki (Claude Code agent). **Branch:** `feat/batch-2b-signups`, from `main` **after Batch 1 (PR #139) merges**.
**Target:** merged Wed Nov 4 (plan 0c: 2b right after Batch 1, then Batch 3).
**Source of truth:** this file. Contract: `docs/contracts/lifecycle.md` sections 4 ("Sign-up and account"), 6, 7.1 and 7.7. Where this brief and the contract differ, this brief wins and commit 9 updates the contract.
**Closes:** #136 (login rate limit). Folds in the 2a follow-ups and Stop 4 answer V.

Read first, fully: `AGENTS.md`, `CLAUDE.md`, `docs/contracts/lifecycle.md`, `docs/guides/DATABASE-MIGRATIONS.md`, `docs/guides/CODE-COMMENTS.md`, `tests/README.md`, `docs/tasks/batch-2a-password-hashing.md` (the password helper and its rules), then this brief.

---

## 1. Why

Today a sign-up is a row in `pending_registrations.json` in the server's working folder, and a Lab Head approves it from the Lab Head view. The frozen manuscript and plan 0c say the IT Admin approves accounts with a role and the person's labs. Batch 1 already added `users.account_status` (PENDING, ACTIVE, INACTIVE, REJECTED), `status_decided_at`, `status_decided_by_id`, the activity log and `requireItAdmin`. 2b uses them: a sign-up becomes a `users` row with status PENDING, and the IT Admin approves or rejects it on a new IT Admin view.

## 2. Hard rules

1. **No schema change.** Every column this batch needs exists after Batch 1. If you find one missing, stop and ask.
2. **Passwords only through `server/shared/services/passwords.ts`** (2a). No plain password is stored, logged or sent. No `maxLength` on password boxes.
3. **No new package** (no `express-rate-limit`). The login limit is a small in-memory helper.
4. **Logs:** no emojis, no request bodies, no emails, no ID numbers, no passwords or hashes in any server log line. Activity log rows never hold an email or a typed login name (contract 7.7).
5. **The acting user comes from the session.** Approve and reject read the IT Admin from `sessionUserOf(req)`.
6. Never read `.env` or `pending_registrations.json`. Never touch CCS Cloud. Never run `prisma migrate dev`, `db push` or `db pull`. No em dashes.

## 3. Server

### 3.1 Sign-up (`POST /api/auth/register-request`, anyone)

Body: `{ firstName, lastName, email, idNumber, userType, password, centerIds: [] }`.

Checks (400 with a plain message each):
- names, email, ID number and password present; password 8 to 128 characters (2a limits);
- email ends with `@dlsu.edu.ph` (case-insensitive), stored lowercased;
- ID number is 8 digits;
- `userType` is STUDENT, FACULTY or STAFF (fixes the 2a follow-up: an invalid type used to pass sign-up and fail approval with a 500);
- `centerIds` has at least one lab, and every id is a real lab.

Then, in one transaction: hash the password (hash first, outside the transaction is fine), insert the `users` row with `account_status` PENDING and no role, and insert `user_centers` rows for the requested labs. A taken email or ID number answers **409** "An account with this email or ID number already exists. Ask the IT Admin." Catch the unique-key error (Prisma P2002) for this, so two sign-ups at the same moment give one 201 and one 409 (keeps #14 and #81 fixed). Answer `{ success: true, message }`.

A REJECTED account still holds its email and ID number. To free them, the IT Admin anonymizes it later (module 6). Write that in the guide, not in code.

### 3.2 IT Admin endpoints (all `requireAuth`, `requireActive`, `requireItAdmin`)

New feature folder `server/features/users/` with the five layers.

| Meaning | Method and path | Body | Answer | Errors |
|---|---|---|---|---|
| Pending sign-ups | `GET /api/users?status=PENDING` | | `{ users: User[] }`, oldest first | 403 |
| Approve | `PUT /api/users/:userId/approve` | `{ role, centerIds: [] }` | `{ user: User }` | 400; 403; 404; 409 not Pending |
| Reject | `PUT /api/users/:userId/reject` | `{ remarks? }` | `{ user: User }` | 403; 404; 409 not Pending |

- `GET /api/users` in 2b answers only `status=PENDING`. Any other query answers 400 "Only status=PENDING is available for now." Module 6 (Aryan) widens it.
- `User` is the contract shape (section 7, "Common objects"). It goes only to the IT Admin.
- **Approve:** `role` is one of RESEARCHER, TSG_STAFF, ADRIC_DIRECTOR, ADRIC_SECRETARY, IT_ADMIN (there is no Lab Head role; heading a lab is set in module 6). `centerIds`: **at least one lab for RESEARCHER; zero or more for the other roles** (the seed's IT Admin, Director and Secretary have no lab). This clarifies the contract's "one or more labs"; commit 9 updates the contract. In one transaction, with the user row locked (`SELECT ... FOR UPDATE`) so two approvals can't both pass the Pending check: set `account_status` ACTIVE, `status_decided_at` now, `status_decided_by_id` the IT Admin; add the `user_roles` row; replace `user_centers` with `centerIds`; write SIGNUP_APPROVED (actor the IT Admin, target the user, details: the role key and lab codes).
- **Reject:** same lock and Pending check; `account_status` REJECTED, decided at and by; `user_centers` rows removed; SIGNUP_REJECTED with the remarks in `details` (trimmed, at most 500 characters).

### 3.3 Login

- Messages by status, shown only after the password matched (so they reveal nothing to a stranger): PENDING 403 "Your sign-up is waiting for IT Admin approval."; REJECTED 403 "Your sign-up was not approved. Contact the IT Admin."; INACTIVE keeps today's message.
- **Activity log:** LOGIN_SUCCESS with the user as actor. LOGIN_FAILURE only when the email matches an account (actor null, target that account), never with the typed email. A failed login for an unknown email writes nothing.
- **Rate limit (#136):** new `server/shared/services/loginLimiter.ts`. Key: the lowercased email plus `req.ip`. 5 failed logins for a key within 15 minutes block that key for 15 minutes: **429** "Too many failed logins. Try again in 15 minutes." The block is checked before the password is verified (no hashing while blocked). It counts failures for unknown emails too, and the 429 is the same either way. A successful login clears the key. Expired keys are pruned; the map holds at most 10,000 keys (drop the oldest). In memory only, so a restart clears it (note for Recommendations).
- **Client IP behind nginx:** the deployed site runs behind nginx on the same server, which sends `X-Forwarded-For`. `server/app.ts` has no `trust proxy`, so today `req.ip` is `127.0.0.1` for everyone there. Add `app.set('trust proxy', 'loopback')`: Express then reads the forwarded address only when the request comes from nginx on the same machine, and a direct request can't fake it. Locally nothing changes.

### 3.4 Session role for the IT Admin

Today `appRoleFor` makes IT_ADMIN and ADRIC_SECRETARY accounts "Staff". Change it so an IT_ADMIN account gets the new app role **"ITAdmin"** (label "IT Admin"). The Secretary stays "Staff" for now (contract section 6). Effects:
- The IT Admin no longer passes `requireRole('Staff')`, so every asset route answers 403 for them, as contract section 6 says.
- Check every `requireRole(...)` and every web role switch (`web/state/session.tsx`, `web/app/routes.tsx`, layouts, the bell) for the new key. Add "ITAdmin" to the shared role enum and labels.

### 3.5 Remove

- `/api/auth/pending-registrations`, `/api/auth/approve-registration`, `/api/auth/reject-registration` (answer 404 after, like other removed routes).
- Everything that reads or writes `pending_registrations.json` (`auth.repository.ts` load and save, the service's list, approve and reject). Keep the `.gitignore` line. Do not open or delete the file itself; Raiki moves it.
- Types only used by those (`PendingRegistration`, `PendingRegistrationView`, `ApproveRegistrationInput` and the like).

### 3.6 Logs across the server (2a follow-up, widened)

Every `console.log`, `console.warn` and `console.error` in `server/`: no emoji; no request body or part of one (for example `loans.controller.ts` logs the whole loan request); no email (`auth.controller.ts` sign-up and account update, `mailer.ts` recipients); no ID number. Keep a short plain line with ids only where it helps (for example "Loan 17 approved by user 6"). Remove lines that only say a request arrived. `errorHandler.ts` keeps its 500 log through `hidePasswordHashes`, without the emoji. Add a unit test like `tests/unit/noTransferCalls.test.ts` that fails if any `server/` file has an emoji on a `console.` line.

## 4. Web

### 4.1 IT Admin view

- New route group `/it-admin` with its own layout and nav, like the other views. The IT Admin lands on `/it-admin/approvals` after login. Other roles opening `/it-admin/*` see `NoAccess`. The IT Admin opening another view's URL sees `NoAccess`.
- Nav for now: **Approvals** (with the count of pending sign-ups) and Account. Aryan's Users, Activity Log and Tickets pages join this nav in module 6; put pages in `web/pages/it-admin/` so his work slots in.
- **Approvals page** (`web/pages/it-admin/ApprovalsPage.tsx`), page title from the shared page titles: a table of pending sign-ups (name, email, ID number, user type, requested labs, requested on), oldest first.
  - **Approve** opens a dialog: Role (select, labels from shared constants), Labs (multi-select from `GET /api/lookups`, prefilled with the requested labs; required for Researcher), Approve. On success the row leaves the list.
  - **Reject** opens a dialog with optional remarks and Confirm.
  - Errors show the server's sentence through `readResult` (`web/api/client.ts`).
  - Calls go through a new `web/api/users.api.ts`.

### 4.2 Sign-up page (`web/pages/auth/Register.tsx`)

- Labs: a multi-select of labs from `GET /api/lookups` (replaces the single lab text or select). User type: a select of the three types. No `maxLength` on the password box; keep the 2a length checks with messages.
- Errors through `readResult`, so the raw "Server returned HTML response instead of JSON" text is gone (Stop 4 answer V).
- Success text: "Your sign-up was sent. The IT Admin will review it. You can log in once it is approved."

### 4.3 Remove

- The Lab Head view's "Account Approvals" tab: its route (`lab-head/approvals`), nav entry, the `approvals` branch of `LabHeadDashboard.tsx`, and `branchPendingRegistrations`.
- In `web/state/serverData.tsx`: `pendingRegistrations`, `addPendingRegistration`, `approveRegistration`, `rejectRegistration`, the `PendingRegistration` type, the stale `TODO(C-04)` note, and the unused `password?` field (2a follow-ups). The matching functions in `web/api/auth.api.ts`.

## 5. Seed

`prisma/seedData.ts` already has an IT Admin (user 1) and a Secretary (user 3). Keep them. Add one PENDING sign-up to the seed (a Student with one lab) so the Approvals page is not empty on a fresh database. Its password goes through the hash helper like the others.

## 6. Tests

Update tests that pin the old behavior in the same commit (AGENTS rule 5). New tests at least:
- Sign-up: 201 and a PENDING row with labs; 400 for each bad field (non-DLSU email, ID not 8 digits, bad `userType`, no labs, unknown lab, password 7 and 129); 409 taken email; 409 taken ID number; two same-email sign-ups with `Promise.all`: one 201, one 409.
- Login: PENDING 403 and REJECTED 403 with their messages; the 6th failed try within 15 minutes is 429 and checks no password; a success clears the count; another email from the same IP is not blocked; LOGIN_SUCCESS and LOGIN_FAILURE rows have no email.
- Approve and reject: 401 signed out; 403 for Staff, Secretary, Director, Lab Head, Researcher; 404 unknown user; 409 not Pending; 400 bad role, Researcher with no labs, unknown lab; approve then log in with the right role and labs; IT Admin with no labs approved fine; reject then login 403; two approvals with `Promise.all`: one 200, one 409; activity rows written.
- `GET /api/users?status=PENDING` lists only Pending, no password field; any other query 400.
- The three old routes answer 404.
- The IT Admin gets 403 on an asset route (for example `PUT /api/assets/:assetTag`).
- Unit: no emoji on a `console.` line in `server/`.

## 7. Commits and stops

**Stop 0 (no commit):** read everything above; report what the auth code does today (routes, files, where the JSON file is read), every place that uses the "Staff" app role for IT Admin or Secretary, the web role switches that need "ITAdmin", the log lines you will change (count per file), and your plan per commit with expected test counts. Questions in the "When unsure" format. Wait for go.

| # | Commit | What |
|---|---|---|
| 1 | `docs(tasks): save the 2b brief` | This file as `docs/tasks/batch-2b-signups.md` |
| 2 | `fix(server): plain log lines with no bodies, emails or emojis` | Section 3.6 and its unit test. No behavior change otherwise |
| 3 | `feat(auth): sign-ups are stored as pending users` | Section 3.1 and its tests |
| 4 | `feat(users): IT Admin approves or rejects sign-ups` | Section 3.2, the "ITAdmin" app role (3.4) and their tests |
| 5 | `feat(auth): login messages by status, login log and a failed-login limit (#136)` | Section 3.3 and its tests |
| 6 | `refactor(auth): remove the pending_registrations.json flow` | Section 3.5; the old routes answer 404 |

**Stop 1** after commit 6: checks, test counts per commit and why they moved, and anything that surprised you.

| # | Commit | What |
|---|---|---|
| 7 | `feat(web): IT Admin view with the Approvals page` | Section 4.1 |
| 8 | `feat(web): sign-up page sends labs and shows the server's message` | Section 4.2, 4.3 removals, section 5 seed |
| 9 | `docs: 2b contract, guide and counts` | Contract 7.7 marks live, the "zero or more labs for non-Researchers" rule, the login messages, 429; AGENTS.md counts; the guide (moving or deleting `pending_registrations.json` after pulling, freeing a rejected email by anonymizing later); the results in this task file |

**Stop 2** after commit 9: checks, then hand checks 2b-H1 onward (section 8), then the report.

Report typecheck, build and tests after every commit that changes code. Typecheck must stay at 32 or lower.

## 8. Hand checks (for Raiki, `adric_uat_check` only)

Under the heading **"Batch 2b hand checks"** in `docs/tasks/batch-2b-signups.md`, each with role, screen, clicks, expected result and database. Before them, Raiki moves `pending_registrations.json` out of the repo folder to `C:\dev\uat-data\`, then starts the app through `C:\dev\uat-data\start-local-uat.ps1` (ports 4000 and 5173 free). At least:
- **2b-H1** Signed out, Sign Up: a new Student with two labs. The success text shows; the database has a PENDING row with those two labs.
- **2b-H2** Sign Up again with the same email: the 409 sentence, no raw text. A non-DLSU email: the 400 sentence.
- **2b-H3** Log in as the new account: "Your sign-up is waiting for IT Admin approval."
- **2b-H4** As the IT Admin (user 10, "UAT Custodian Two"): lands on Approvals; the sign-up is listed with its labs. Approve as Researcher with one of the two labs: the row leaves the list.
- **2b-H5** Log in as the new account: the Researcher view; Account shows the one lab.
- **2b-H6** Sign up a second account; as the IT Admin, Reject it with a remark. Log in as it: "Your sign-up was not approved. Contact the IT Admin."
- **2b-H7** As UAT LabHead CITe4D One: no Account Approvals tab. As UAT Staff One, open `http://localhost:5173/it-admin/approvals`: No Access. As the IT Admin, open `/staff/inventory`: No Access.
- **2b-H8** Wrong password 6 times for UAT Custodian One: the 6th shows "Too many failed logins..."; UAT Staff One still logs in from the same browser.
- **2b-H9** Nearby: UAT Staff One registers nothing new but opens Inventory and Repairs fine; a Researcher's loan request still works.
- **2b-H10** During all of the above, the server terminal shows no emoji, no email and no request body.

## 9. Not in 2b

- Users page, role and lab changes, Head changes, deactivate, reactivate, anonymize, activity log page, tickets (module 6, Aryan).
- Email notifications (Recommendations: Mailgun). An in-app bell entry for new sign-ups (the count on the nav is enough for now).
- Moving the Secretary to the oversight view (Joel, Batch 6 area).
## Decisions

Made by Raiki before and at Stop 0 (2026-11-03). Where they differ from the sections above, these win.

**Before Stop 0:**

- **A.** The IT Admin gets its own view at `/it-admin`.
- **B.** Labs at approval are required only for Researchers (zero or more for the other roles).
- **C.** Sign-up accepts only `@dlsu.edu.ph` emails and 8-digit ID numbers.
- **Counts on main after #96:** typecheck 25, tests 524. Typecheck must stay at 25 or lower (the "32" in section 7 is out of date).

**Stop 0 answers:**

- **Q1: A.** Pending sign-ups are sorted by `user_id`, oldest first. The Approvals table has no "Requested on" column, because `users` has no creation date and this batch changes no schema. Module 6 follow-up: a sign-up date.
- **Q2: A.** Reject remarks are trimmed and at most 255 characters (the size of `activity_log.details`). Longer gets 400 "Remarks must be at most 255 characters." The Reject dialog (commit 7) uses the same 255 limit.
- **Q3: A.** The right password on a PENDING, REJECTED or INACTIVE account writes LOGIN_FAILURE (actor null, target the account) with a short reason in `details`: "Account pending", "Account rejected", "Account inactive". A wrong password for a known account writes "Wrong password". Such a status refusal neither counts toward the login limit nor clears it. Never an email in `details`.
- **Q4: A.** The asset, loan and maintenance reads stay open to any Active account on the server (contract 7.2). The web does not load those lists for ITAdmin, and the bell is hidden for ITAdmin.
- **Q5: A.** The ID number is 8 digits, not starting with 0 (`id_number` is a number column, so a leading 0 would be lost). Message: "Enter your 8-digit DLSU ID number."
- **Also accepted:** no separate IT Admin layout file (a new `roleConfig` entry in `Sidebar.tsx`, under `RootLayout`); no seed change (seed user 11, `demo.pending@dlsu.edu.ph`, is already the Pending sign-up); tests that cannot pass after commit 3 are deleted in that commit (AGENTS.md rule 5); the web types the old flow uses stay until commit 8.
- **Commit 5 addition:** `loginLimiter.ts` exports a reset function for tests, so existing login tests do not trip the limit. Failed tries are spread across accounts only where a test truly needs it.

## Results at Stop 1 and Stop 2

Branch `feat/batch-2b-signups`, from `main` at `d758e726`. Nothing pushed. No schema change, no new package, nothing run against CCS Cloud.

| # | Commit | Hash | Typecheck | Tests (total) | Why the tests moved |
|---|---|---|---|---|---|
| 1 | `docs(tasks): save the 2b brief` | `3ab8b684` | 25 | 524 | Docs only |
| 2 | `fix(server): plain log lines with no bodies, emails or emojis` | `5519a9c2` | 25 | 525 | +1: the no-emoji test (`tests/unit/noEmojiLogs.test.ts`) |
| 3 | `feat(auth): sign-ups are stored as pending users` | `1b684ecf` | 25 | 522 | -3: 28 new sign-up tests replace the old ones that needed the file; one `passwordLeak` test (approval failing on a bad user type) is gone, since sign-up now answers 400 for it |
| 4 | `feat(users): IT Admin approves or rejects sign-ups` | `7299fedc` | 25 | 556 | +34: `users.test.ts` +30, three session table rows, one IT Admin asset-route row |
| 5 | `feat(auth): login messages by status, login log and a failed-login limit (#136)` | `15935ae9` | 25 | 578 | +22: `loginLimit.test.ts` +13, `loginLimiter.test.ts` +8, one Pending-login test |
| 6 | `refactor(auth): remove the pending_registrations.json flow` | `eb97a204` | 25 | 569 | -9: the old-request test file (-4), the pending-file log tests (-2), the old session table rows (-3) |
| 6a | `fix(server): log only the error name for disposal emails` | `2d753723` | 25 | 569 | Unchanged |
| 7 | `feat(web): IT Admin view with the Approvals page` | `df16c265` | 25 | 569 | Unchanged (web only) |
| 8 | `feat(web): sign-up page sends labs and shows the server's message` | `2e5b16c5` | 25 | 569 | Unchanged (web only) |
| 9 | `docs: 2b contract, guide and counts` | this commit | 25 | 569 | Unchanged (docs only) |

Build passes after every code commit. Typecheck stayed at 25 (the same 25 errors as `main`). `AGENTS.md` now says 569 tests.

**Section 5 (seed):** no change. Seed user 11 (`demo.pending@dlsu.edu.ph`, a Student in CeLT) already is the Pending sign-up.

**Where the build differs from the brief or went beyond it:**

- Sign-up answers **201**, as the brief says. The sign-up page reads it through `readResult`.
- `users` has no creation date, so the Approvals table has no "Requested on" column and the list is ordered by user id (Q1).
- Reject remarks are limited to 255 characters, the size of `activity_log.details` (Q2). The Reject dialog does not cut the text: the count turns red, a message shows, and Confirm waits.
- A right password on a Pending, Rejected or Inactive account writes LOGIN_FAILURE with a reason, and neither counts toward the limit nor clears it (Q3). A wrong password for a known account writes "Wrong password".
- The row for a wrong password is awaited, so a known email's refusal is a few milliseconds slower than an unknown email's (see Recommendations notes).
- The bell is hidden for the IT Admin, and its screens load no asset, loan or maintenance list (Q4). The server still answers those reads to any Active account.
- An ID number cannot start with 0 (Q5). The sign-up page sends the ID number as typed, so a leading 0 is refused instead of lost.
- The sign-up page no longer shows "Requested System Role" (the IT Admin picks the role) and shows a labs multi-select and three user types.
- `loginLimiter.ts` exports `resetLoginLimiter()`, used by its unit tests. The API tests run the server as a separate process, so each test file's own fresh server starts with an empty limit (Stop 1, Q1: A).
- `web/state/pendingSignUps.tsx` (new) holds the IT Admin's list, so the sidebar count and the Approvals page share it. `web/state/serverData.tsx` only lost code.
- `scratch/test_registration_approval.ts` still calls the removed routes. `scratch/` is not built, so it was left.

## Recommendations notes

For the Recommendations document, from Batch 2b:

- **The login limit is in memory.** A server restart clears every count, and two server processes would each keep their own. That is enough for one server behind nginx; a shared store (or a table) is the step up if the site ever runs more than one process.
- **A known email's refusal is a few milliseconds slower** than an unknown email's, because the known one writes its LOGIN_FAILURE row before answering. The 5-try limit keeps that from being measured often. Writing the row without waiting would remove the difference, at the cost of a race with anything that deletes the account (module 6 anonymizes instead of deleting).
- **Users have no sign-up date.** `users` has no creation column, so Approvals cannot show "Requested on" and sorts by user id. Module 6 can add `created_at` in its own migration.
- **A rejected sign-up keeps its email and ID number** until the IT Admin anonymizes the account (module 6, Users page).
- **The read-only asset, loan and maintenance lists are open to the IT Admin on the server.** Only the web hides them. If the team wants the server to refuse them too, that changes four routes and contract 7.2.
- **`id_number` is a number column**, so it cannot hold a leading 0. Sign-up refuses one; a text column would be the other way.

## Batch 2b hand checks

Written for Raiki, to run by hand. The agent did not run them. Every check uses **`adric_uat_check` only** (the local copy), started through `C:\dev\uat-data\start-local-uat.ps1`. Nothing here touches CCS Cloud. Find this section by searching the exact heading text `Batch 2b hand checks` in `docs/tasks/batch-2b-signups.md`; each check below names its number.

**Before the checks**

1. Move `pending_registrations.json` out of the repository folder, to `C:\dev\uat-data\` (from the repository root: `Move-Item pending_registrations.json C:\dev\uat-data\`). The app no longer reads it.
2. Make sure ports 4000 and 5173 are free (no leftover `npm run dev:all`, which talks to CCS Cloud).
3. `adric_uat_check` must be at the latest migrations with hashed passwords (the guide's "Resetting a local UAT copy after Batch 1", step 6).
4. Start the app with `C:\dev\uat-data\start-local-uat.ps1` on branch `feat/batch-2b-signups`. Use a private window per account, or log out between accounts. Accounts and passwords are in `C:\dev\uat-data\uat-passwords.txt` (do not copy them anywhere).
5. Made-up applicants: the emails below end in `@dlsu.edu.ph` and are invented; ID numbers start at 99000001. Pick the labs from the list (two labs, for example CITe4D and the first other lab).
6. **To read the database**, SELECT only, never the `password` column. PowerShell, it asks for the root password: `& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p adric_uat_check -e "<SELECT>"`.
7. These checks leave accounts and activity rows in `adric_uat_check`. The next `uat-reset.sql` load removes them.

**2b-H1. A new Student signs up with two labs.** Database: `adric_uat_check` (writes one account).
- Signed out, open `http://localhost:5173/register`. Fill: first name `Batch2b`, last name `One`, email `batch2b-h1@dlsu.edu.ph`, ID number `99000001`, user type Student, tick two labs, a password of 8 or more characters in both boxes. Click "Submit Registration Request for Approval".
- Expect: the screen "Sign-up Sent" with "Your sign-up was sent. The IT Admin will review it. You can log in once it is approved."
- Database (SELECT): `SELECT user_id, account_status FROM users WHERE email='batch2b-h1@dlsu.edu.ph'` shows PENDING. With that id: `SELECT center_id FROM user_centers WHERE user_id=<id>` shows the two labs, and `SELECT COUNT(*) FROM user_roles WHERE user_id=<id>` shows 0.

**2b-H2. Refusals on the sign-up page, with the server's sentences.** Database: `adric_uat_check` (writes nothing).
- On `/register`, fill the same email `batch2b-h1@dlsu.edu.ph` with a new ID `99000002` and the rest of the form filled in correctly, then submit. Expect "An account with this email or ID number already exists. Ask the IT Admin." and no "Server returned HTML" text.
- Change the email to `batch2b-h2@example.com`. Expect "Use your @dlsu.edu.ph email address."
- Use an ID number `01234567`, then `1234567`. Expect "Enter your 8-digit DLSU ID number." each time.
- Untick every lab. Expect "Choose at least one lab."
- The password box takes more than 8 characters when you type them (no cut-off).

**2b-H3. The new account cannot log in yet.** Database: `adric_uat_check` (writes one activity row).
- Log in at `/login` as `batch2b-h1@dlsu.edu.ph` with its password. Expect "Your sign-up is waiting for IT Admin approval." and you stay on the login page.

**2b-H4. The IT Admin approves it.** Database: `adric_uat_check` (writes the account, its role and labs, one activity row).
- Log in as the IT Admin (user 10, "UAT Custodian Two"). Expect to land on `/it-admin/approvals`, titled "System Administration", with the nav entry "Approvals" showing a count. If you land somewhere else, that account does not hold the IT Admin role in the copy: stop and report.
- Expect the table columns Name, Email, ID Number, User Type, Requested Labs, Action, and **no** "Requested on" column. `Batch2b One` is listed with "Student" and the two lab codes.
- Click Approve. The dialog opens with Role "Researcher" and both requested labs ticked. Choose Role "TSG Staff" and untick both labs: Approve stays enabled. Choose "Researcher" again with no lab: Approve is disabled and the dialog says "Choose at least one lab for a Researcher."
- Tick one of the two labs only, Role "Researcher", click Approve. Expect the row to leave the list and the nav count to drop by one.
- The bell icon is not shown anywhere on the IT Admin's screens, and the IT Admin's Account page has no "Lab" line.

**2b-H5. The approved account logs in as a Researcher.** Database: `adric_uat_check` (writes one activity row).
- Log out, then log in as `batch2b-h1@dlsu.edu.ph`. Expect the Researcher view (`/custodian/myassets`). Open Account: it shows only the one lab you ticked.
- Database (SELECT): `SELECT event_type, details FROM activity_log WHERE target_user_id=<id> ORDER BY log_id` shows SIGNUP_APPROVED with `Role: RESEARCHER; labs: <that lab's code>`, and no email in `details`.

**2b-H6. A rejected sign-up.** Database: `adric_uat_check` (writes one account and two activity rows).
- Sign up a second account: `Batch2b Six`, `batch2b-h6@dlsu.edu.ph`, ID `99000003`, one lab. As the IT Admin, click Reject on its row, type the remark `Test remark: not a member of this lab.` and click Confirm. Expect the row to leave the list.
- Log in as `batch2b-h6@dlsu.edu.ph`: expect "Your sign-up was not approved. Contact the IT Admin."
- Sign up again with the same email: expect the 409 sentence from 2b-H2 (a rejected account keeps its email).
- Database (SELECT): the SIGNUP_REJECTED row's `details` is the remark.

**2b-H7. Each role sees the right views.** Database: `adric_uat_check` (writes only login rows).
- As UAT LabHead CITe4D One: the nav shows no "Account Approvals" tab. Open `http://localhost:5173/lab-head/approvals`: expect the Not Found page.
- As UAT Staff One: open `http://localhost:5173/it-admin/approvals`. Expect "You don't have access to this page".
- As the IT Admin: open `http://localhost:5173/staff/inventory`. Expect "You don't have access to this page".

**2b-H8. The failed-login limit.** Database: `adric_uat_check` (writes login rows). Run it last among the checks that use UAT Custodian One, or restart the app afterwards (a restart clears the count).
- On `/login`, enter UAT Custodian One's email with a wrong password, 6 times. Tries 1 to 5 show "Invalid institutional email address or password." The 6th shows "Too many failed logins. Try again in 15 minutes."
- Try the right password: still "Too many failed logins. Try again in 15 minutes."
- In the same browser, log in as UAT Staff One with the right password: it works.

**2b-H9. Nearby behavior still works.** Database: `adric_uat_check` (the loan request writes one loan).
- As UAT Staff One: open Asset Inventory and Repairs. Both load with no error.
- As UAT Custodian One (restart the app first if H8 blocked it): open Available Equipment, pick an Available asset, and send a borrow request with a purpose and a return date. Expect the success message and no error.

**2b-H10. The server terminal is clean.** Database: `adric_uat_check` (reads nothing).
- Across all of the above, look at the terminal where the server runs. Expect short plain lines (for example "Sign-up filed: user 21 is pending", "Sign-up of user 21 approved by user 10"), and **no** emoji, **no** email address, **no** password, **no** request body, and no mention of `pending_registrations.json`.

**2b-H11. A Reject remark over 255 characters is refused.** Database: `adric_uat_check` (writes one account and, at the end, one activity row).
- Sign up a third account: `Batch2b Eleven`, `batch2b-h11@dlsu.edu.ph`, ID `99000004`, one lab. Put 256 characters on the clipboard: `'x' * 256 | Set-Clipboard`.
- As the IT Admin, click Reject on its row and paste into the remarks box. Expect the count "256 / 255" in red, the sentence "Remarks must be at most 255 characters.", and Confirm disabled. The text is not cut.
- Delete one character. Expect "255 / 255", no red, and Confirm enabled. Click Confirm: the row leaves the list.
- Database (SELECT): `SELECT LENGTH(details) FROM activity_log WHERE target_user_id=<id> AND event_type='SIGNUP_REJECTED'` shows 255.

## Batch 2b hand checks: results

Run by Raiki on 2026-11-04, on `adric_uat_check` (local) only, started through `start-local-uat.ps1`. Nothing was run against CCS Cloud. All checks passed.

| Check | Result | Seen |
|---|---|---|
| 2b-H1 | Passed | New Student sign-up with two labs |
| 2b-H2 | Passed | The 409 sentence and the 400 sentences, with no raw text |
| 2b-H3 | Passed | Login of the Pending account refused with its message |
| 2b-H4 | Passed | IT Admin on Approvals; the sign-up approved and its row left the list |
| 2b-H5 | Passed | The approved account logged in to the Researcher view |
| 2b-H6 | Passed | Reject with a remark; login refused with its message |
| 2b-H7 | Passed | `/lab-head/approvals` shows Not Found; a TSG account on another role's page shows No Access (expected difference) |
| 2b-H8 | Passed | The 6th failed login refused; another account unaffected |
| 2b-H9 | Passed | Staff Inventory and Repairs load; a Researcher loan request (loan 18) worked |
| 2b-H10 | Passed | The server terminal showed only plain lines with user ids |
| 2b-H11 | Passed | 256 characters refused (red count, Confirm disabled); 255 accepted and the row left the list |
| Extra: ID and labs | Passed | ID `01234567` and `1234567` refused with the ID sentence; no labs refused with the lab sentence |
| Extra: repeat sign-up | Passed | Re-sign-up with the rejected email got the 409 sentence |
| Extra: Approvals page | Passed | No "Requested on" column and no bell; Approve enabled for TSG Staff with or without labs, disabled for Researcher with no lab; the IT Admin's Account page has no Lab line |
| Extra: database | Passed | User 13 ACTIVE with one lab (Bio); user 14 REJECTED with no labs. Activity rows: LOGIN_FAILURE "Account pending", SIGNUP_APPROVED "Role: RESEARCHER; labs: Bio", SIGNUP_REJECTED with the remark, LOGIN_FAILURE "Account rejected", LOGIN_SUCCESS with actor 13. No email in any `details` |

Users 13 and 14 and their activity rows stay in `adric_uat_check` until the next `uat-reset.sql` load.
