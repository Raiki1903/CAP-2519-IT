# Module 6 brief: users, labs and Heads, activity log, tickets (IT Admin)

**Branch:** `feat/module-6-it-admin` from the latest `main` (`2d62c7a0` or newer), in `C:\dev\CAP-2519-IT`.
**Issue:** #158. PR title: `feat(it-admin): users, lab Heads, activity log and tickets (#158)`. The PR also closes Aryan's #142 by hand, as "included in #<PR>".
**Owner:** Raiki's agent (server and screens). Aryan's Users page (#142, `origin/feat/it-admin-users-mock`) is the starting point for the Users screen and keeps his commits.
**Deadline:** PR ready **Sat Nov 7, 15:00**, merged before the **feature freeze, Sat 18:00**. It ships in Sunday's fresh deploy.
**Source of intent:** frozen Chapter 1, 1.6.2.6 (accounts, RBAC, activity log, ticketing, privacy), CAP1DEF comment 2 (Data Privacy Act: Anonymize), plan 0a and 0b. **The contract already plans every route:** `docs/contracts/lifecycle.md` section 4 ("Sign-up and account", "Ticket"), section 6, "Common objects" (`User`, `Ticket`, `ActivityEntry`), 7.7 and 7.8. This brief wins where they differ (section 3), and the contract is updated to match.

**No browser tools.** Don't use Playwright or any browser MCP in any stop. Raiki runs the hand checks himself.

---

## 1. Goal

The IT Admin can manage accounts after sign-up: find any account, change its role and labs, set a lab's Head, deactivate and reactivate, and anonymize a departed person (Data Privacy Act). The IT Admin can read the activity log. Any signed-in person can file a system-support ticket and see its answer; the IT Admin works the tickets. Asset problems still go through Maintenance (1.6.2.6.4).

No schema change. Every table exists since Batch 1: `users` (`account_status`, `anonymized_at`, nullable `id_number`), `user_roles`, `user_centers`, `research_centers.head_user_id` (unique), `activity_log` (all 17 event types already in the enum), `user_tickets`.

## 2. Decisions already made (Raiki, Nov 6)

| # | Decision |
|---|---|
| D1 | We build all of module 6 ourselves. Our branch **merges `origin/feat/it-admin-users-mock` first** (merge commit), so Aryan's commits stay. On a conflict in `web/app/layouts/Sidebar.tsx` or `web/app/routes.tsx`, **keep `main`'s version** of the file and add back only Aryan's Users nav entry and route (his branch reformatted the whole nav table and predates Batches 3 and 5). Any other conflict: stop and ask. |
| D2 | Contract routes and shapes as written in 7.7 and 7.8, with section 3's changes. Five layers each; the acting user from the session; IT Admin routes use `requireAuth, requireActive, requireItAdmin`. |
| D3 | **Deactivate (Q1, decided: A, Nov 7):** the IT Admin cannot deactivate an account while it has any open loan, including a request still waiting: Pending Approval, Pending Release, On Loan or Return Requested. The answer is 409 with a plain message. |
| D4 | Cut order if late (plan 0a), screens only: 1) the Tickets screens shrink to a list plus a status change; 2) the Activity Log page becomes a plain table; 3) the Users page keeps only deactivate and role change. The server routes all ship. |

## 3. Rules the contract doesn't spell out (adaptations; write them in the Decision Log)

- **Never on yourself.** The IT Admin can't change their own role or labs, deactivate or anonymize their own account (400 "You can't change your own account here."). This also keeps the last IT Admin from locking everyone out.
- **Role change:** only for an Active or Inactive account (409 for Pending, Rejected or anonymized: Pending goes through Approvals). One role, as at approval. Refused (409 "Change the lab's Head first.") when the account heads a lab and the new role isn't RESEARCHER, because a lab's Head is a Researcher office account (section 6). Writes ROLE_CHANGED (details `From <key> to <key>`).
- **Change labs:** a Researcher keeps at least one lab (400, as at approval); unknown lab 400; removing the lab they head 409 (contract). Writes LABS_CHANGED (details: the new codes, or `none`).
- **Change a lab's Head:** locks the lab row (`lockCenter`) and the new Head's account (`lockUser`). The new Head must be Active, have the RESEARCHER role, and be in that lab (400 otherwise); heading another lab 409 (contract). `{ userId: null }` leaves the lab with no Head. Replaces the old Head in the same transaction. Writes HEAD_CHANGED, with the new Head as target (or the old Head when cleared), details `<code>: <old name or none> to <new name or none>`.
- **Deactivate:** 409 not Active, heads a lab (contract), plus the Q1 rule. Writes USER_DEACTIVATED.
- **Reactivate:** 409 not Inactive, or anonymized. Writes USER_REACTIVATED.
- **Anonymize:** Inactive or Rejected and cleared (contract section 5: no loan in Pending Release, On Loan or Return Requested), otherwise 409. Fields as in the contract table, **plus `user_img` cleared** (a photo is personal data). Password cleared means the column gets an empty string (it is NOT NULL); confirm `verifyPassword` answers false for it without throwing, and add a login test. Removes the account's `user_centers` rows (labs are personal data too; history stays). Anonymizing an already anonymized account answers 409. Writes USER_ANONYMIZED.
- **Every user change** locks the account row first (`lockUser`, as approve and reject do) and runs in one transaction with its activity row. A change takes effect on the person's open sessions within the session cache time (`SESSION_CACHE_SECONDS`, 60 s); say so in the contract.
- **Users list:** `GET /api/users?status=&role=&centerId=&q=`. `status` any of the four (one value), `role` one database role, `centerId` a lab that exists, `q` matches name, email or ID number (contains, case-insensitive). No filter = every account except Pending is fine **only if** the Approvals page still gets its list from `?status=PENDING` unchanged (keep that shape and order). Order: last name, first name. Sends the `User` shape only (no password, no photo).
- **Activity log:** newest first, 50 per page, `page` from 1, `pageCount` at least 1. `from` and `to` are `yyyy-mm-dd` days, inclusive, compared in server local time (`serverToday(d)`), 400 when `from` is after `to`. `assetTag` unknown = no rows (not 404). `eventLabel` from one label map in `shared/` (plain words, for example "Login failed", "Role changed"). `actor` and `targetUser` as `{ userId, name }` or null; never an email.
- **Tickets:** `title` trimmed, 1 to 150 characters; `description` trimmed, 1 to 2000; `type` one of the four. Status moves exactly as the contract table, `resolutionRemarks` trimmed 1 to 1000 and required for Resolved and Rejected; the IT Admin who sets Resolved or Rejected is `resolved_by` with the time. Each change writes TICKET_STATUS_CHANGED (actor the IT Admin, target the ticket's creator, details `#<id> <from> to <to>`). Filing a ticket writes no log row (there is no event for it). Lock the ticket row while changing it, so two changes at once give one 200 and one 409. `GET /api/tickets/mine` is for any Active account, newest first; `GET /api/tickets` IT Admin, newest first, `status` and `type` filters (one value each). `createdBy` and `resolvedBy` as `{ userId, name }`.

## 4. Screens (IT Admin view, plus one section for everyone)

- **Users** (`/it-admin/users`, Aryan's page, title stays `PAGE_TITLES.administration` unless a better existing title fits): replace `MOCK_USERS` with `web/api/users.api.ts` calls; delete `mockUsers.ts`. Keep his tabs (All, Active, Inactive, Rejected), search (sent as `q`), the Anonymize confirm dialog and "Change the lab's Head first." Actions per row as the server allows: Change role (dialog with the role select), Change labs (dialog with lab ticks from lookups), Deactivate, Reactivate, Anonymize. Server errors show in the page's notice, not a browser alert. After each action, reload the list from the server (no local edits of the row).
- **Labs tab on the Users page:** the 10 labs with their Head (or "No Head") and a "Change Head" dialog that lists the lab's Active Researcher members, plus "No Head".
- **Activity Log** (`/it-admin/activity-log`, new nav item): a table (time, event, actor, target, asset tag, details), filters for event type, dates and asset tag, and Previous / Next pages.
- **Tickets** (`/it-admin/tickets`, new nav item): the list with status and type filters; a ticket opens a dialog with its details and a status change with remarks (only the allowed moves offered).
- **Support tickets for everyone:** a "Support tickets" section on the existing **Account Details** page (`AccountDetailsPage`, already in every view at `.../account`): a short form (type, title, description) and the person's own tickets with status, remarks and dates. The IT Admin's own Account page shows it too (no harm).
- Existing UI parts and theme only (no hard-coded emerald; the old `bg-emerald-50` notice in Aryan's page moves to the theme's colours). Every call through `web/api/`. Option lists from `shared/`.

## 5. Tests (Vitest, local test database)

- Each route: IT Admin 200; any other role 403; not logged in 401.
- Users list filters (status, role, centerId, q) and that Pending still works for Approvals; no `password` or `user_img` in any answer.
- Role: each 409 (Pending, Rejected, anonymized, heads a lab to a non-Researcher role), self 400, log row written.
- Labs: Researcher with none 400, unknown lab 400, removing the lab they head 409, log row.
- Head: not in the lab 400, not a Researcher 400, Inactive 400, heads another lab 409, replace old Head, clear Head, log row. **`Promise.all`:** the same person set as Head of two labs at once: one 200, one 409, never 500.
- Deactivate and reactivate: each 409; an Inactive account's next request gets 403 (clear the session cache in the test); login refused with the Inactive message.
- Anonymize: each field as in the contract plus photo and labs cleared; loans and log rows kept; not cleared 409; Active 409; login afterwards fails; log row.
- Activity log: filters, paging, `from` after `to` 400, no email in any row.
- Tickets: create 400s; mine shows only own; each allowed move and each refused move (409); remarks required (400); resolver and time set; `Promise.all` on two status changes: one 200, one 409.

Typecheck must stay 25 or lower; build passes; all tests pass.

## 6. Docs

- `docs/tasks/module-6-it-admin.md` = this brief (commit 1), with a **Decision Log** table at the end, starting with D1 to D4 and the section 3 adaptations.
- Contract: mark the 7.7 and 7.8 rows live (module 6), with the section 3 rules in short; section 4 Anonymize table gains the photo and labs lines; the session cache line.
- AGENTS.md test count.
- A short "For Macy" note in the task file: what shipped per manuscript function (1.6.2.6.1 accounts, 1.6.2.6.3 logs, 1.6.2.6.4 tickets, 1.6.2.6.5 privacy), what is not built (direct account creation by the IT Admin, automatic anonymization after graduation: both Recommendations).

## 7. Stops

- **Stop 0 (plan, short):** confirm the facts this brief relies on (the contract rows, `lockUser` and `lockCenter`, how Approvals reads `GET /api/users`, `verifyPassword` with an empty string, `AccountDetailsPage` in every view, the session cache), do a **dry run of the merge** of `origin/feat/it-admin-users-mock` (`git merge --no-commit --no-ff`, list conflicts, then `git merge --abort`), list files, ask only blocking questions in the AGENTS.md format. Commit 1 (the brief) only. No tests.
- **Stop 1:** server, users and labs (list, role, labs, Head, deactivate, reactivate, anonymize), tests, contract. Report counts.
- **Stop 2:** server, activity log and tickets, tests, contract. Report counts.
- **Stop 3:** merge Aryan's branch (D1), then the screens (section 4). Typecheck, build, tests.
- **Stop 4:** write hand checks H1 and up in the task file for Raiki to run on local `adric_uat_check` (AGENTS.md format): IT Admin each Users action and one refusal each, Labs tab Head change, Activity Log filters, Tickets status change; a Researcher files a ticket and sees the answer; a deactivated account can't log in. Don't run them. Then the docs. **No PR text: the advisor writes it.** Never CCS Cloud.

## 8. Not in this work

Schema changes, new packages, direct account creation by the IT Admin, password reset by the IT Admin, email or bell notifications for tickets, ticket attachments, editing the activity log, automatic anonymization, changes to Approvals beyond keeping it working, any asset action for the IT Admin.

## Decision Log

| Date | Item | What changed and why |
|---|---|---|
| 2026-11-06 | D1 | Our branch merges `origin/feat/it-admin-users-mock` first, as a merge commit, so Aryan's commits stay. A conflict in `Sidebar.tsx` or `routes.tsx` keeps `main`'s file plus Aryan's Users nav entry and route only. Any other conflict: stop and ask. |
| 2026-11-06 | D2 | Contract routes and shapes from 7.7 and 7.8, with the section 3 changes. Five layers; the acting user from the session; IT Admin routes use `requireAuth, requireActive, requireItAdmin`. |
| 2026-11-07 | D3 | Deactivate is refused (409, plain message) while the account has any open loan, including a request still waiting: Pending Approval, Pending Release, On Loan or Return Requested. Raiki's answer to Q1 (option A): an account with a loan still in progress should not lose its login halfway through. |
| 2026-11-06 | D4 | Cut order if late, screens only: 1) Tickets shrink to a list plus a status change; 2) Activity Log becomes a plain table; 3) Users keeps only deactivate and role change. The server routes all ship. |
| 2026-11-06 | A1 | Never on yourself: the IT Admin cannot change their own role or labs, or deactivate or anonymize their own account (400). This keeps the last IT Admin from locking everyone out. |
| 2026-11-06 | A2 | Role change only for an Active or Inactive account (409 otherwise). One role. 409 "Change the lab's Head first." when the account heads a lab and the new role is not RESEARCHER. Writes ROLE_CHANGED. |
| 2026-11-06 | A3 | Change labs: a Researcher keeps at least one lab (400); unknown lab 400; removing the lab they head 409. Writes LABS_CHANGED. |
| 2026-11-06 | A4 | Change a lab's Head: locks the lab and the new Head's account. The new Head is Active, a Researcher, and in that lab (400 otherwise); heading another lab 409; `{ userId: null }` clears the Head. Writes HEAD_CHANGED. |
| 2026-11-06 | A5 | Deactivate: 409 when not Active, when the account heads a lab, or under D3. Reactivate: 409 when not Inactive, or anonymized. Each writes its log row. |
| 2026-11-06 | A6 | Anonymize: Inactive or Rejected and cleared, otherwise 409; already anonymized 409. Besides the contract fields, the photo (`user_img`) and the account's labs (`user_centers`) are cleared, because both are personal data. The password becomes an empty string, which never verifies. Writes USER_ANONYMIZED. |
| 2026-11-06 | A7 | Every user change locks the account row first and runs in one transaction with its log row. Open sessions see the change within the session cache time (60 s). |
| 2026-11-06 | A8 | Users list filters `status`, `role`, `centerId`, `q`; ordered by last name, first name; `?status=PENDING` keeps the shape and order the Approvals page uses. No password or photo in any answer. |
| 2026-11-06 | A9 | Activity log: newest first, 50 per page, `from` and `to` inclusive days in server time (400 when `from` is after `to`), unknown asset tag gives no rows, labels from `shared/`, people as `{ userId, name }`, never an email. |
| 2026-11-06 | A10 | Tickets: field limits as in section 3; status moves as the contract table; remarks required for Resolved and Rejected; the resolver and time are stored; each status change writes TICKET_STATUS_CHANGED; filing writes no log row; the ticket row is locked while it changes. |
| 2026-11-07 | D5 | Stop 0, Q2 answer A: Raiki ran the merge of `origin/feat/it-admin-users-mock` himself and kept `main`'s `Sidebar.tsx`. The Users nav line comes back in Stop 3 as its own commit. |
| 2026-11-07 | A11 | Stop 0 defaults Raiki accepted: Change labs works only on an Active or Inactive account (409 otherwise), as Change role does. The D3 message is "This account still has an open loan or loan request." |
| 2026-11-07 | A12 | `GET /api/users?status=PENDING` alone keeps the shape and order (by user id) the Approvals page and `pendingSignUps.tsx` use. The last name, first name order applies when another filter is used or no status is given. |
| 2026-11-07 | A13 | Deactivate and reactivate also set `status_decided_by_id` and `status_decided_at`, so the columns say who set the status the account has now. The history stays in the activity log. |
| 2026-11-07 | A14 | The "Inactive account's next request gets 403" test signs a fresh session cookie instead of clearing the session cache: the test server runs in its own process, so a test cannot clear its cache. A cookie the server has never seen acts as an open session does once the 60 seconds have passed. |
| 2026-11-07 | D6 | Stop 1, Q3 answer A: the account shape (`User`) gains `anonymizedAt` (a date, or null), so the Users page knows which accounts are already anonymized. It is the first commit of Stop 3; the Pending list gets the field too (null), and its pinned test adds it. |
| 2026-11-07 | A15 | Change role to RESEARCHER is refused (400 "Choose at least one lab for a Researcher.") for an account with no lab, as Change labs and approval already are. Raiki asked for it after Stop 1. |
| 2026-11-07 | A16 | Activity log: `from` and `to` become the local midnight at the start of `from` and the local midnight after `to`, so a row counts on the day `serverToday()` gives for its time. A page past the last one answers no rows with `pageCount` as usual. An unknown filter, or one sent twice, is 400. An unknown actor or target id gives no rows, like an unknown asset tag. |
| 2026-11-07 | A17 | Tickets: In Progress takes no resolution remarks (400 if non-empty remarks are sent), so remarks always mean an answer. POST /api/tickets answers 201, like the other creates. My tickets needs an Active account (section 3), where the contract said "logged in"; the contract now says Active. |
| 2026-11-07 | A18 | Two shared additions, not label maps: `shared/constants/tickets.ts` gains the field limits, `TICKET_STATUS_MOVES` and `TICKET_CLOSING_STATUSES` (the server checks moves with them and the Tickets dialog offers only those moves); `server/shared/services/rowLocks.ts` gains `lockTicket`, next to the other row locks. |
| 2026-11-07 | A19 | Stop 3a, Users page: the tabs send the status and the search is sent as `q` after 300 ms; the list is read again from the server after every step. Row buttons show only what the server would accept: nothing on the IT Admin's own account or an anonymized one; Change role and Deactivate are greyed with "Change the lab's Head first." for a lab's Head (Aryan's tooltip); Change labs, Change role and Anonymize by status as the server decides. Whether an account has an open loan is not known to the page, so that 409 shows in the notice. |
| 2026-11-07 | A20 | Server sentences: a step with its own dialog (role, labs, Head, anonymize) shows the sentence inside the dialog, as the Approve and Reject dialogs do, so what was typed is kept; Deactivate and Reactivate, which have no dialog, show it in the page notice. The notice uses the theme tokens (`primary` for done, `destructive` for refused). Aryan's amber Deactivate button colour is left as it was. |
| 2026-11-07 | A21 | Labs tab: no new server route. The Heads and the members a Head can be picked from come from one `GET /api/users?status=ACTIVE&role=RESEARCHER`, because the lookups' `headUserId` is loaded once per page load and goes stale after a Head change. A member who already heads another lab is listed but disabled. |
| 2026-11-07 | A22 | Aryan's Anonymize dialog is moved into `features/users/AnonymizeUserDialog.tsx` so it can call the server; its text no longer cites "Contract 4" and now says the photo and labs are removed too and the email and ID number are free again. |
| 2026-11-07 | A23 | Stop 3b, Activity Log page: times show in the browser's time zone while `from` and `to` are days in the server's local time (the same machine in this project). A start day after the end day is stopped on the page with the server's sentence and nothing is sent. An empty actor, target, asset tag or details shows "None". The asset tag is sent after 300 ms. If the log shrinks under a high page, the page goes to the last one. Nav labels come from `PAGE_TITLES`, icons are ScrollText and LifeBuoy, and the nav items are in the IT Admin nav only. |
| 2026-11-07 | A24 | Tickets page: each row has an Open button (the row itself is not a click target, so a keyboard can reach it). The dialog offers only the moves in `TICKET_STATUS_MOVES`; a closed ticket is read-only. Remarks show a count of the trimmed text and are not cut at the limit, as in the Reject dialog. Server sentences show inside the dialog; a done change shows in a page notice. |
| 2026-11-07 | A25 | Support tickets section: sits below the profile form on the Account page (outside its `<form>`, which cannot nest), and the type starts on Question. Title and description are counted as trimmed text and not cut. The line above the form says asset problems go through Report an issue. The rest of the Account page, including its hard-coded colours, is not touched. |
| 2026-11-07 | A26 | `features/tickets/TicketStatusBadge.tsx` holds the status badge and the `ticketTime` format that the Tickets page, the ticket dialog and the Support tickets section share. |
| 2026-11-07 | A27 | Stop 4 hand checks: the Pending demo applicant is the account that is changed, deactivated and anonymized, after Approvals approves it (H1), so the other demo accounts stay as seeded; only the lab Heads move, and H12 sets them back. The checks need a fresh demo seed and cannot be run twice on one database, because anonymize cannot be undone. Two checks paste one console command to show the server refuses what the buttons already block; the paging check (H20) adds 60 filler log rows on `adric_uat_check` only and gives the command that removes them. |

## For Macy

**What shipped (issue #158), by manuscript function.**

- **1.6.2.6.1 Accounts.** The IT Admin's **Users** page lists every account after sign-up (Pending ones stay on Approvals) with tabs for All, Active, Inactive and Rejected, and a search by name, email or ID number. On it the IT Admin changes an account's role (one role, as at approval) and its labs, deactivates and reactivates it. The **Labs** tab on the same page shows the 10 labs with their Head and changes a lab's Head. The rules: the IT Admin never changes their own account; a Researcher keeps at least one lab; a lab's Head is an Active Researcher who belongs to that lab and heads one lab only, so an account that heads a lab keeps the Researcher role and its lab; deactivating is refused while the account heads a lab or has any open loan, a request still waiting included. A change reaches a person who is already logged in within 60 seconds.
- **1.6.2.6.3 Logs.** The **Activity Log** page is read only: time, event, who acted, who it was about, the asset tag and the details, newest first, 50 rows a page, with filters for the event, the days and the asset tag. Besides the logins, sign-up decisions and asset steps of earlier batches, this work writes a row for each role change, lab change, Head change, deactivation, reactivation, anonymization and ticket status change. No row holds an email, a typed login or a password.
- **1.6.2.6.4 Tickets.** Every person (every role) has a **Support tickets** section on their Account page: a type (Bug, Account Access, Question, Other), a title and a description, and below it their own tickets with the status and the IT Admin's answer. The IT Admin's **Tickets** page lists all tickets with status and type filters, and moves each one on: Open to In Progress, Resolved or Rejected; In Progress to Resolved or Rejected. Resolved and Rejected need remarks, are final, and record who closed the ticket and when. Problems with an asset do not use this: they go through Report an issue and Maintenance, as the manuscript says.
- **1.6.2.6.5 Privacy (Data Privacy Act, CAP1DEF comment 2).** **Anonymize** is a step on the Users page for an Inactive or Rejected account that is cleared (no unreturned equipment). The name becomes "Former researcher", the email `anonymized-<id>@invalid`, and the ID number, the photo and the labs are removed; the password is cleared, so the account can never log in again. The person's loans, inspections, tickets and log rows stay, under the new name. The email and ID number are free for a new sign-up. It cannot be undone, and an anonymized account can no longer be changed.

**Numbers.** The API tests grew from 759 to 888 passed. The typecheck count stays at 25 (old errors). There is no schema change.

**Recommendations items (not built).**

1. Direct account creation by the IT Admin. People still sign up, and the IT Admin approves them.
2. Automatic anonymization after graduation or after a set time. Today the IT Admin anonymizes by hand, one account at a time.

Also not part of this work: a password reset by the IT Admin, email or bell notices for tickets, ticket attachments, and any asset action for the IT Admin.

## Hand checks (Stop 4)

Written for Raiki, to run by hand. The agent did not run them, and used no browser. Every check uses **`adric_uat_check` only** (the local copy), on branch `feat/module-6-it-admin`. Nothing here touches CCS Cloud. Find this section by searching the exact heading text `Hand checks (Stop 4)` in `docs/tasks/module-6-it-admin.md`; the checks are H1 to H21. Each ends with a Pass line for you to fill in.

**Order.** Users first (H1 to H10), then Labs (H11, H12), then Tickets (H13 to H16), then who may open the IT Admin pages (H17), then the Activity Log (H18 to H20, last on purpose, so it shows every step above), then the nearby screens (H21). Each check builds on the one before it, so run them in order and in one sitting.

**Setup (before H1)**

1. Ports 4000 and 5173 must be free: no leftover `npm run dev:all`, which talks to CCS Cloud.
2. The database must be a **fresh demo seed**: "A fresh local database with demo data" in `docs/guides/DATABASE-MIGRATIONS.md` (11 demo accounts, 10 labs, 12 demo assets). These checks change it: they approve a sign-up, anonymize that account (which cannot be undone), move lab Heads, and file a ticket. To run them a second time, seed a fresh database again.
3. Start the app with `C:\dev\uat-data\start-local-uat.ps1`. The startup line must say `Database: adric_uat_check on localhost`. If it names anything else, stop.
4. Every demo account logs in with the same demo password: the `SEED_PASSWORD` you chose when you seeded the database. The agent did not read any password file. The accounts used (the app shows each as "Demo" and the name):
   - `demo.admin@dlsu.edu.ph`, "Demo IT Admin"
   - `demo.pending@dlsu.edu.ph`, "Demo Pending Applicant" (a Pending sign-up, asked for the lab CeLT)
   - `demo.labhead.cite4d@dlsu.edu.ph`, "Demo Lab Head CITe4D" (heads CITe4D)
   - `demo.labhead.car@dlsu.edu.ph`, "Demo Lab Head CAR" (heads CAR)
   - `demo.researcher.a@dlsu.edu.ph`, "Demo Researcher A" (CITe4D, holds the loaned Meta Quest 3, CITe4D-0002)
   - `demo.researcher.b@dlsu.edu.ph`, "Demo Researcher B" (CITe4D and CAR; named in H12, never logged in)
   - `demo.researcher.c@dlsu.edu.ph`, "Demo Researcher C" (HXIL)
   - `demo.tsg@dlsu.edu.ph`, "Demo TSG Staff A"
5. **Two browser windows.** Window A: a normal window at `http://localhost:5173`, logged in as Demo IT Admin the whole time. Window B: a private window for every other account, one at a time. To switch account in Window B, click the red logout button at the bottom of the sidebar first.
6. The Account page ("Account Settings") of any person opens by clicking their name in the "ACTIVE SESSION" box at the bottom of the sidebar.
7. Two checks (H3 and H15) paste one command into the browser console: open DevTools (F12), Console, on the page of Window A. The first time the browser may ask you to type `allow pasting`. The command prints the server's answer.

**H1. IT Admin approves the Pending sign-up; the sidebar has the new pages.** Role: Demo IT Admin. Screen: "Approvals". Database: `adric_uat_check` (writes: one approval, one log row).
- In Window A log in as `demo.admin@dlsu.edu.ph`. You land on Approvals.
- The sidebar has four items, in this order: Approvals, Users, Activity Log, Tickets.
- The table has one row: Demo Pending Applicant, `demo.pending@dlsu.edu.ph`, requested lab CeLT. Click Approve. The dialog "Approve sign-up" shows Role "Researcher" and CeLT ticked. Click Approve.
- Expect: the row leaves the table and the page says "No sign-ups are waiting for approval." The count on the sidebar's Approvals item is gone.
- **Pass:** [x] yes [ ] no. Notes: Sidebar order was Approvals, Users, Activity Log, Tickets. The Approve dialog showed Researcher with CeLT ticked. After Approve the table said "No sign-ups are waiting for approval." and the Approvals count was gone. Run with Playwright. The dev console shows a React warning from the dialog overlay ("Function components cannot be given refs", DialogOverlay), which is not part of the check.

**H2. Users: the list, the tabs and the search.** Role: Demo IT Admin. Screen: "Users". Database: `adric_uat_check` (read only).
- Click Users in the sidebar. The title is "System Administration"; under it a Users / Labs switch with Users selected; then the tabs "All Users", "Active", "Inactive", "Rejected" and the box "Filter by name, email, or ID...".
- All Users lists 11 accounts, by last name: the first row is Demo Director, the last is Demo TSG Staff B. Demo Pending Applicant is in the list now, as a Researcher with the lab CeLT. Demo Lab Head CITe4D shows the lab badge CITe4D and a badge "Head: CITe4D".
- Click Active: the same 11 rows. Click Inactive: "No users found matching the filter criteria." Click Rejected: the same message. Click All Users again.
- Type `researcher` in the box. After a moment only Demo Researcher A, Demo Researcher B and Demo Researcher C remain. Replace it with `demo.labhead`: two rows, the two Lab Heads (the email matches). Replace it with `zzz`: "No users found matching the filter criteria." Clear the box: 11 rows again.
- **Pass:** [x] yes [ ] no. Notes: 11 rows, first Demo Director, last Demo TSG Staff B. Demo Pending Applicant was a Researcher with CeLT. Demo Lab Head CITe4D showed CITe4D and "Head: CITe4D". Active 11 rows. Inactive and Rejected showed "No users found matching the filter criteria." Search: researcher gave 3, demo.labhead gave 2, zzz gave the message, cleared gave 11.

**H3. Users: your own row, and a Head cannot get another role or be deactivated.** Role: Demo IT Admin. Screen: "Users". Database: `adric_uat_check` (read only).
- On the Demo IT Admin row the Actions cell says "Your account" and has no buttons.
- On the Demo Lab Head CITe4D row, "Change role" and "Deactivate" are greyed. Hover over each: the tooltip says "Change the lab's Head first." "Change labs" is available.
- To see that the server refuses too (this is the refusal of a Head getting a non-Researcher role): in the Window A console paste this and press Enter. Demo Lab Head CITe4D has user id 6 in the demo seed.
  ```
  fetch('http://localhost:4000/api/users/6/role',{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'TSG_STAFF'})}).then(r=>r.json()).then(console.log)
  ```
- Expect: it prints `{success: false, error: "Change the lab's Head first."}`. On the Users page (reload it) Demo Lab Head CITe4D is still a Researcher.
- **Pass:** [x] yes [ ] no. Notes: Demo IT Admin row said "Your account" with no buttons. On Demo Lab Head CITe4D, Change role and Deactivate were disabled with the tooltip "Change the lab's Head first." and Change labs was available. The console command printed {success: false, error: "Change the lab's Head first."}. After a reload the account was still a Researcher with its Head badge.

**H4. Users: Change role.** Role: Demo IT Admin. Screen: "Users". Database: `adric_uat_check` (writes: one role change, one log row).
- On the Demo Pending Applicant row (Researcher, CeLT) click "Change role". The dialog says "Demo Pending Applicant is Researcher. Choose their new role." and its "Change role" button is greyed, because the role is the same.
- Choose "TSG Staff" and click "Change role".
- Expect: the dialog closes. A green notice says "Demo Pending Applicant is now TSG Staff." The row's Role column says TSG Staff. Click Dismiss on the notice.
- **Pass:** [x] yes [ ] no. Notes: Dialog said "Demo Pending Applicant is Researcher. Choose their new role." with Change role disabled. After choosing TSG Staff the notice "Demo Pending Applicant is now TSG Staff." was green and the row said TSG Staff.

**H5. Users: Change labs, and the Head's lab cannot be unticked.** Role: Demo IT Admin. Screen: "Users". Database: `adric_uat_check` (writes: one lab change, one log row).
- On the Demo Pending Applicant row (now TSG Staff, lab CeLT) click "Change labs". The dialog says "Labs (optional for this role)" and lists the labs with CeLT ticked. Its "Change labs" button is greyed (nothing changed yet). Tick CAR too, and click "Change labs".
- Expect: a green notice "Labs of Demo Pending Applicant changed." and the Labs column shows CAR and CeLT.
- Refusal: on the Demo Lab Head CITe4D row click "Change labs". CITe4D is ticked. Untick it. Two red lines say "Choose at least one lab for a Researcher." and "Change the lab's Head first.", and the "Change labs" button is greyed. Click Cancel. The row still shows CITe4D.
- **Pass:** [x] yes [ ] no. Notes: Added CAR: notice "Labs of Demo Pending Applicant changed." and the Labs column showed CAR and CeLT. The Change labs button was disabled before any change. Refusal on Demo Lab Head CITe4D: unticking CITe4D showed the two red lines, the button was disabled, and Cancel left CITe4D on the row. (The check text was corrected to name both red lines.)

**H6. Users: a Researcher needs a lab.** Role: Demo IT Admin. Screen: "Users". Database: `adric_uat_check` (writes: two lab changes, one role change, three log rows).
- On the Demo Pending Applicant row (TSG Staff, CAR and CeLT) click "Change labs", untick both labs, click "Change labs". A TSG Staff account may have none: the notice says the labs changed and the Labs column says "None".
- Click "Change role", choose "Researcher". Expect: a red line "A Researcher needs at least one lab. Change their labs first." and the "Change role" button greyed. Click Cancel.
- Click "Change labs", tick CeLT only, click "Change labs". Then "Change role", choose "Researcher", click "Change role".
- Expect: the notice "Demo Pending Applicant is now Researcher." and the row shows Researcher with the lab CeLT.
- **Pass:** [x] yes [ ] no. Notes: All four steps matched: labs to None, role to Researcher refused with "A Researcher needs at least one lab. Change their labs first." and the button disabled, then CeLT only, then "Demo Pending Applicant is now Researcher." with the lab CeLT.

**H7. Users: Deactivate; it survives a reload; the account cannot log in.** Role: Demo IT Admin, then Demo Pending Applicant in Window B. Screen: "Users", then the login page. Database: `adric_uat_check` (writes: one deactivation, one log row, one failed-login log row).
- On the Demo Pending Applicant row click "Deactivate". Expect: the notice "Demo Pending Applicant deactivated." and the status badge says Inactive. The row now has Change role, Change labs, Reactivate and Anonymize.
- Click the Active tab: the row is gone. Click the Inactive tab: it is there. Reload the page (F5) and open the Inactive tab: **it is still Inactive.** (The old mock page forgot every change on reload.)
- In Window B open `http://localhost:5173` and log in as `demo.pending@dlsu.edu.ph` with the demo password. Expect: you stay on the login page and it says "Error: This account is not active. Contact the IT Admin."
- **Pass:** [x] yes [ ] no. Notes: Notice "Demo Pending Applicant deactivated." and the row said Inactive with Change role, Change labs, Reactivate and Anonymize. Active tab: gone. Inactive tab: present, and still Inactive after a reload. Window B login stayed on the login page and said "Error: This account is not active. Contact the IT Admin." (The check text was corrected to include the "Error:" prefix.)

**H8. Users: Deactivate is refused while the account has an open loan.** Role: Demo IT Admin. Screen: "Users". Database: `adric_uat_check` (writes nothing: the step is refused).
- Click the All Users tab. On the Demo Researcher A row (it holds the loaned Meta Quest 3, CITe4D-0002) click "Deactivate".
- Expect: a red notice "This account still has an open loan or loan request." The row stays Active. Click Dismiss.
- **Pass:** [x] yes [ ] no. Notes: Red notice "This account still has an open loan or loan request." and Demo Researcher A stayed Active.

**H9. Users: Reactivate; the account can log in again.** Role: Demo IT Admin, then Demo Pending Applicant in Window B. Screen: "Users", then the login page. Database: `adric_uat_check` (writes: one reactivation, one login row, then one more deactivation for H10).
- Click the Inactive tab. On the Demo Pending Applicant row click "Reactivate". Expect: the notice "Demo Pending Applicant reactivated." and the row leaves the Inactive tab. The Active tab has it, Active.
- In Window B log in as `demo.pending@dlsu.edu.ph` with the demo password. Expect: the Researcher view (the name box says Researcher; the sidebar has My Loans). Log out in Window B.
- Back in Window A, on the Active tab click "Deactivate" on the Demo Pending Applicant row again (it is needed for H10). Expect the notice "Demo Pending Applicant deactivated."
- **Pass:** [x] yes [ ] no. Notes: Notice "Demo Pending Applicant reactivated.", the row left the Inactive tab and was Active on the Active tab. Window B login landed on the Researcher view (name box Researcher, sidebar has My Loans); logged out. Deactivated again in Window A with the notice "Demo Pending Applicant deactivated."

**H10. Users: Anonymize.** Role: Demo IT Admin, then the old Demo Pending Applicant in Window B. Screen: "Users", then the login page. Database: `adric_uat_check` (writes: one anonymization, one log row. It cannot be undone).
- Click the Inactive tab. On the Demo Pending Applicant row click "Anonymize". The dialog "Anonymize Account" asks "Are you sure you want to anonymize Demo Pending Applicant (demo.pending@dlsu.edu.ph)?" and says what is removed. Click Cancel: the row is unchanged.
- Click "Anonymize" again, then "Confirm Anonymization".
- Expect: the dialog closes and a green notice says "Account #11 anonymized." (the demo seed gives this account the id 11). The row now reads: name "Former researcher", email `anonymized-11@invalid`, ID Number "None", Labs "None", status Inactive. The Actions cell says "Anonymized" and **has no buttons.**
- In Window B try to log in as `demo.pending@dlsu.edu.ph` with the demo password. Expect: "Error: Invalid institutional email address or password."
- **Pass:** [x] yes [ ] no. Notes: Dialog text matched. Cancel left the row unchanged. Confirm gave "Account #11 anonymized." and the row read Former researcher, anonymized-11@invalid, ID Number None, Labs None, Inactive, Actions "Anonymized" with no buttons. Window B login said "Error: Invalid institutional email address or password." (The check text was corrected to include the "Error:" prefix.)

**H11. Labs tab: change a lab's Head; the new Head gets the Lab Head view.** Role: Demo IT Admin, then Demo Researcher A in Window B. Screen: "Users", Labs. Database: `adric_uat_check` (writes: one Head change, one log row).
- In Window A click the Labs switch. The subtitle says "Labs: see each lab's Head, and change who heads it." The table has 10 labs. CITe4D shows the Head "Demo Lab Head CITe4D", CAR shows "Demo Lab Head CAR", the other eight show "No Head".
- On the CITe4D row click "Change Head". Open the Head list: it holds "No Head", Demo Lab Head CITe4D, Demo Researcher A and Demo Researcher B (the Active Researchers of CITe4D; not Demo Researcher C, who is in HXIL). Choose Demo Researcher A and click "Change Head".
- Expect: the notice "CITe4D: Demo Researcher A is now the Head." and the CITe4D row shows Demo Researcher A.
- In Window B log in as `demo.researcher.a@dlsu.edu.ph`. Expect: the **Lab Head view**: the name box says Lab Head, the sidebar has Requests, Lab Inventory and Analytics. Log out in Window B.
- **Pass:** [x] yes [ ] no. Notes: Labs tab: subtitle and 10 labs as expected (CITe4D and CAR with Heads, eight No Head). The CITe4D list held No Head, Demo Lab Head CITe4D, Demo Researcher A and Demo Researcher B. Notice "CITe4D: Demo Researcher A is now the Head." Window B login as Demo Researcher A showed the Lab Head view (name box Lab Head, sidebar Requests, Lab Inventory, Analytics).

**H12. Labs tab: replace a Head, a Head of another lab cannot be picked, No Head, and set everything back.** Role: Demo IT Admin. Screen: "Users", Labs. Database: `adric_uat_check` (writes: four Head changes, four log rows).
- CAR row, "Change Head": the list holds Demo Lab Head CAR and Demo Researcher B (the Active Researchers of CAR). Choose Demo Researcher B, "Change Head". Expect "CAR: Demo Researcher B is now the Head." and the CAR row shows Demo Researcher B.
- CITe4D row, "Change Head": open the list. "Demo Researcher B (Head of CAR)" is greyed and cannot be chosen. Press Esc to close the list and click Cancel.
- CAR row, "Change Head", choose "No Head", "Change Head". Expect "CAR has no Head now." and the CAR row says "No Head".
- Set it back. CAR row: choose Demo Lab Head CAR. CITe4D row: choose Demo Lab Head CITe4D. Expect the table to match the start of H11 (CITe4D: Demo Lab Head CITe4D, CAR: Demo Lab Head CAR).
- Click the Users switch, then the All Users tab: Demo Lab Head CITe4D and Demo Lab Head CAR show their "Head:" badges again, and Demo Researcher A and Demo Researcher B show none.
- **Pass:** [x] yes [ ] no. Notes: The first step (CAR to Demo Researcher B) was done, and the CAR row and the log (H18) show it, but my script timed out afterwards and lost that step's notice text and the CAR list, so I did not see the sentence "CAR: Demo Researcher B is now the Head." (I read the CAR list afterwards: No Head, Demo Lab Head CAR, Demo Researcher B). Other steps matched: "Demo Researcher B (Head of CAR)" was greyed in the CITe4D list and the selection did not change; "CAR has no Head now."; both Heads set back with matching notices; Users tab showed the Head badges on the two Lab Heads and none on Demo Researcher A or B.

**H13. A Researcher files a support ticket.** Role: Demo Researcher C. Screen: "Account Settings". Database: `adric_uat_check` (writes: one ticket; a ticket writes no log row).
- In Window B log in as `demo.researcher.c@dlsu.edu.ph`. Open Account Settings (click the name in the "ACTIVE SESSION" box). Scroll below the profile form to the card "SUPPORT TICKETS".
- It says: "Ask the IT Admin about the system: a bug, trouble with your account, or a question. A problem with an asset is not a ticket: use Report an issue on the asset instead." The "Send ticket" button is greyed while the title and description are empty.
- Choose the type "Bug". Title: `Hand check: lab list is empty`. Description: `Hand check: the lab list shows nothing.` The counts under the boxes show the length. Click "Send ticket".
- Expect: the green line "Ticket sent. The IT Admin's answer will show below.", the boxes empty again, and under "YOUR TICKETS" one ticket: an Open badge, the title, "Bug", the description and "Filed" with the time.
- Leave Window B logged in as Demo Researcher C.
- **Pass:** [x] yes [ ] no. Notes: Section text, disabled Send ticket button, counts (29 / 150 and 39 / 2000), the green line "Ticket sent. The IT Admin's answer will show below.", empty boxes and one Open ticket with title, Bug, description and Filed time all matched. The type stays on Bug after sending.

**H14. The IT Admin sees the ticket and moves it to In Progress.** Role: Demo IT Admin. Screen: "Tickets". Database: `adric_uat_check` (writes: one status change, one log row).
- In Window A click Tickets. The subtitle ends "Problems with an asset go through Maintenance, not here." The table has one row: "#<number>", the title `Hand check: lab list is empty`, Bug, From Demo Researcher C, Open. **Write the number down as T1** (it is used in H15 and H18).
- Set the Status filter to Resolved: "No tickets match the filters." Set it to Open: the row is back. Set the Type filter to Question: no match. Set both filters back to All.
- Click Open on the row. The dialog "Ticket #T1" says "Bug from Demo Researcher C, filed <time>." and shows the Open badge, the title and the description. Click the "Move to" list: it offers In Progress, Resolved and Rejected, and not Open. Choose In Progress. No remarks box appears. Click "Change status".
- Expect: the notice "Ticket #T1 is now In Progress." and the row says In Progress. Open the ticket again and open "Move to": it offers only Resolved and Rejected. Leave the dialog open for H15.
- **Pass:** [x] yes [ ] no. Notes: T1 is #1. Filters: Resolved gave "No tickets match the filters.", Open gave the row, Question gave no match, back to All gave the row. The dialog opened with "Bug from Demo Researcher C", offered In Progress, Resolved and Rejected, no remarks box for In Progress. Notice "Ticket #1 is now In Progress." and reopened it offered only Resolved and Rejected.

**H15. Resolved needs remarks; the IT Admin resolves the ticket.** Role: Demo IT Admin. Screen: "Tickets". Database: `adric_uat_check` (writes: one status change, one log row).
- In the open dialog of T1 choose Resolved. A box "Remarks (required)" appears and "Change status" is greyed. Type only spaces: it stays greyed.
- To see that the server refuses too, paste this in the Window A console, with T1 in place of `<T1>`:
  ```
  fetch('http://localhost:4000/api/tickets/<T1>/status',{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'RESOLVED'})}).then(r=>r.json()).then(console.log)
  ```
  Expect: `{success: false, error: "Write resolution remarks of 1 to 1000 characters."}`, and the ticket is still In Progress.
- Type the remarks `Hand check: fixed in the settings.` and click "Change status".
- Expect: the notice "Ticket #T1 is now Resolved." and the row says Resolved. Open the ticket: it says "This ticket is closed. It can't be changed any more.", shows an "Answer" with the remarks and "Demo IT Admin" with a time, and has only a Close button. Click Close.
- **Pass:** [x] yes [ ] no. Notes: Resolved showed "Remarks (required)" and Change status stayed disabled for empty and for spaces only. The console command printed {success: false, error: "Write resolution remarks of 1 to 1000 characters."}. After the remarks the notice was "Ticket #1 is now Resolved." and the reopened ticket said "This ticket is closed. It can't be changed any more." with the Answer, Demo IT Admin and a time. It has a Close button (plus the corner X).

**H16. The Researcher sees the answer.** Role: Demo Researcher C. Screen: "Account Settings". Database: `adric_uat_check` (read only).
- In Window B (still logged in as Demo Researcher C) reload Account Settings and scroll to "YOUR TICKETS".
- Expect: the ticket now has a Resolved badge, and under it an "Answer" with `Hand check: fixed in the settings.` and "Demo IT Admin" with a time. It also shows "Filed ..." and "Updated ...".
- **Pass:** [x] yes [ ] no. Notes: Resolved badge, Answer "Hand check: fixed in the settings." with Demo IT Admin and a time, and Filed and Updated times.

**H17. Only the IT Admin opens the IT Admin pages.** Role: Demo Researcher C (Window B, still logged in). Screen: the address bar. Database: `adric_uat_check` (read only).
- In Window B change the address to `http://localhost:5173/it-admin/users`. Expect: a page that says "You don't have access to this page". Do the same for `/it-admin/tickets` and `/it-admin/activity-log`: the same page each time. The Researcher's sidebar has no IT Admin items.
- **Pass:** [x] yes [ ] no. Notes: All three addresses showed a page that says "You don't have access to this page" and "You are signed in as Researcher". The Researcher sidebar had no IT Admin items. (The check text was corrected: it had called the page "No Access".)

**H18. Activity Log: every step above is a row.** Role: Demo IT Admin. Screen: "Activity Log". Database: `adric_uat_check` (read only).
- In Window A click Activity Log. The title is "Activity Log"; the table columns are Time, Event, Actor, Target, Asset Tag, Details; the newest row is first. Names in the log are the current names, so every row about the anonymized account says "Former researcher".
- Find these rows. The Actor is Demo IT Admin on all of them except the two login lines at the end of the list:
  - "Ticket status changed", target Demo Researcher C, details `#T1 IN_PROGRESS to RESOLVED` (this is the top row), and below it `#T1 OPEN to IN_PROGRESS`.
  - "Lab Head changed", five rows, with details `CITe4D: Demo Lab Head CITe4D to Demo Researcher A`, `CAR: Demo Lab Head CAR to Demo Researcher B`, `CAR: Demo Researcher B to none`, `CAR: none to Demo Lab Head CAR` and `CITe4D: Demo Researcher A to Demo Lab Head CITe4D`.
  - "Account anonymized" (target Former researcher), "Account deactivated" twice, "Account reactivated" once.
  - "Role changed", details `From RESEARCHER to TSG_STAFF` and `From TSG_STAFF to RESEARCHER`.
  - "Labs changed", details `CAR, CeLT`, `none` and `CeLT`.
  - "Sign-up approved", details `Role: RESEARCHER; labs: CeLT`.
  - "Login failed", Actor "None", target Former researcher, details `Account inactive` (the login of H7).
  - "Logged in" rows for the accounts you logged in with.
- There is **no** "Account deactivated" row for Demo Researcher A (H8 was refused). No cell in the table contains an email address.
- **Pass:** [x] yes [ ] no. Notes: 24 rows, newest first, columns Time, Event, Actor, Target, Asset Tag, Details. Every row listed in the check was there with the expected actor, target and details, including the five Lab Head rows, two Account deactivated, one reactivated, one anonymized, the Login failed row (Actor None, Account inactive), the two ticket rows on top and the Logged in rows. No Account deactivated row for Demo Researcher A. No cell holds an email address. The two oldest rows are the seed's Logged in (Demo TSG Staff A) and Marked missing rows.

**H19. Activity Log: the filters.** Role: Demo IT Admin. Screen: "Activity Log". Database: `adric_uat_check` (read only).
- Event: choose "Account deactivated". Only those rows remain (two), and a "Clear filters" button appears. Choose "All events".
- From and To: pick today's date in both. The rows of this session are listed, "Account anonymized" among them. Clear the To box and set From to tomorrow's date: the table says "No entries match the filters." and the page line says "Page 1 of 1". Now set To to today: with From tomorrow and To today a red line says "The start day must be on or before the end day." and nothing new is sent, so the table keeps what it showed before. Click "Clear filters": the full list is back.
- Asset tag: type `CITe4D-0004`. After a moment exactly one row remains: "Marked missing", Actor Demo TSG Staff A, Asset Tag CITe4D-0004, details "Demo: not found at the routine count." (the row the seed wrote). Replace the tag with `NOPE-9999`: "No entries match the filters." Click "Clear filters".
- **Pass:** [x] yes [ ] no. Notes: Event filter, From and To today, the red line text, Clear filters, and the asset tag steps (CITe4D-0004 one row, NOPE-9999 none) all matched. First run: with From and To both today, setting From to tomorrow showed the red line "The start day must be on or before the end day." and kept the 24 old rows, because nothing is sent while the start day is after the end day (Decision Log A23). With To empty and From tomorrow the table said "No entries match the filters." and "Page 1 of 1". Raiki decided (Q1, option A) that the page is right and the check wording was wrong, so the check text was corrected and this check counts as passed.

**H20. Activity Log: Previous and Next.** Role: Demo IT Admin. Screen: "Activity Log". Database: `adric_uat_check` (writes: 60 filler log rows, removed again at the end of this check).
- The log holds fewer than 50 rows, so first make more. In PowerShell it asks for the MySQL root password; this adds 60 rows older than everything else, event "Found", details "Hand check filler 1" to "Hand check filler 60":
  ```
  & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p adric_uat_check -e "INSERT INTO activity_log (event_type, details, created_at) WITH RECURSIVE n (i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 60) SELECT 'ASSET_FOUND', CONCAT('Hand check filler ', i), '2026-01-01 00:00:00' + INTERVAL i MINUTE FROM n"
  ```
- Reload the Activity Log. Expect: 50 rows, "Page 1 of 2" (it says 2 while the log holds 100 rows or fewer), Previous greyed, Next available. Click Next: "Page 2 of 2", Next greyed, and the last row is "Hand check filler 1". Click Previous: back on "Page 1 of 2".
- Choose the event "Found": 60 rows, "Page 1 of 2". Click Next: 10 rows. Choose "All events": the page goes back to "Page 1".
- Clean up: the same command with this in place of the `INSERT`:
  ```
  & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p adric_uat_check -e "DELETE FROM activity_log WHERE details LIKE 'Hand check filler %'"
  ```
  Reload: the filler rows are gone and the page line says "Page 1 of 1".
- **Pass:** [x] yes [ ] no. Notes: Run with Playwright; the filler rows were added and removed by Raiki. With 84 rows: page 1 had 50 rows, "Page 1 of 2", Previous greyed. Next gave "Page 2 of 2" with 34 rows, Next greyed, last row "Hand check filler 1". Previous went back to "Page 1 of 2". Event Found: 60 rows, "Page 1 of 2"; Next gave 10 rows; All events went back to "Page 1". After Raiki ran the cleanup the page said "Page 1 of 1" with 24 rows and no filler row. (The check says the log holds fewer than 50 rows before the filler; it held 24, so this matches.)

**H21. Nearby: the Lab Head and Staff views still load, and every Account page has the new section.** Role: Demo Lab Head CITe4D, then Demo TSG Staff A. Screens: the Lab Head view, the Staff view, "Account Settings". Database: `adric_uat_check` (writes only logins).
- In Window B log out, then log in as `demo.labhead.cite4d@dlsu.edu.ph`. Expect the Lab Head view (Requests, Lab Inventory, Analytics). Click each: every page loads with no error message. Log out.
- Log in as `demo.tsg@dlsu.edu.ph`. Expect the Staff view (System Overview, Register Equipment, Asset Inventory, and the rest). Open System Overview and Asset Inventory: both load.
- Open Account Settings. The profile form is as before (names, picture, the locked role and ID number, "Save Credentials"), and below it is the "SUPPORT TICKETS" card with "You have not sent any tickets." (Do not save or file anything.)
- **Pass:** [x] yes [ ] no. Notes: Lab Head view for Demo Lab Head CITe4D: Requests (Loan Requests), Lab Inventory (CITe4D) and Analytics (CITe4D) all loaded with no error message. Staff view for Demo TSG Staff A: nav System Overview, Register Equipment, Asset Inventory, Repairs, Inspections, Asset Loans, QR Tags, Analytics; System Overview and Asset Inventory loaded. Account Settings: profile form with Save Credentials as before, and below it the SUPPORT TICKETS card with "You have not sent any tickets." Nothing was saved or filed. No browser console errors during these pages.
