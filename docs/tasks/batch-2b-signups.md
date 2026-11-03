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
