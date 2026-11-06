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
