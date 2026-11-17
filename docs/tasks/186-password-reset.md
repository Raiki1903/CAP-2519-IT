# Aryan: password reset by the IT Admin, and change own password (#186)

**Owner:** Aryan. **Reviewer:** Raiki, then the advisor (it touches passwords). **Save as:** `docs/tasks/186-password-reset.md` (first commit).
**Agent:** your usual agent on its strongest model, high effort. Give it this file and `AGENTS.md`. Work in stops: plan first, wait for "go", then build.
**Branch:** `feat/186-password-reset` **from Raiki's `origin/feat/194-reference-data` after he pushes its migration commit** (`db(reference): asset categories table`). That migration already adds the `PASSWORD_CHANGED` log type, so this PR has **no migration**. Raiki merges #194 before this PR. Until the push, do the plan step only. Run `npm run prisma:generate` after switching to the branch.
**Rules:** `AGENTS.md`. **No change in `prisma/`** or `package.json`. No new package. No em dashes. Typecheck stays at 19, build passes, tests: the count on #194 plus yours, all passing.
**Due:** PR by **Thu Nov 19, 12 noon**. Same gate as the import: in the Nov 20 deploy only if merged and green by Thu 3 pm. If it isn't merged and green by then, it waits for after the turnover.

**Scope:** parts 1 and 2 of #186, small version. The IT Admin sets a temporary password and gives it to the user in person; the user then changes it in Account Details. **Not in scope** (stay in #186 and go to Recommendations): forcing a change at the next login (needs a new column), a "forgot password" email link (no email provider), and logging out the user's other open sessions (sessions are signed cookies and last up to 8 hours).

---

## Commits, in order

1. `docs(auth): task file for the password reset (#186)`: this file. **Commit it yourself before the agent starts.**
2. `refactor(auth): one reader for a new password (#186)`: move the length check in `server/features/auth/auth.validation.ts` (the sign-up password, `MIN_PASSWORD_LENGTH` and `MAX_PASSWORD_LENGTH` from `shared/constants/passwords.ts`) into `readNewPassword(value)` in `server/shared/validation/fields.ts`, and have sign-up call it. Moves code only; the sign-up tests pass unchanged.
3. `feat(users): the IT Admin resets a user's password (#186)`: server route, service, tests.
4. `feat(auth): change your own password (#186)`: server route, service, tests.
5. `feat(web): Reset password on the Users page (#186)`.
6. `feat(web): Change password in Account Details (#186)`.
7. `docs(agents): update the test count (#186)`.

## Points to get right (read these twice)

- **The acting user comes from the session**, never from the body. In change-own-password, there is no user id in the body at all.
- **The current password is checked with `verifyPassword`**, never by comparing hashes or text yourself. A wrong current password changes nothing.
- **Hash with `hashPassword`** before saving. Never store, log, return or put in an error message any password or hash. Not in `details` either.
- **The update and the log row are one transaction.** If the log row fails, the password does not change.
- **Use the existing pieces:** `refuseOwnAccount`, `requireItAdmin`, `requireActive`, `AppError`, the users and auth repositories. Don't write new versions of them.
- **Only change what this brief lists.** If another file must change, say which and why in the report.
- **Every rule below has a test.** Write the test, see it fail, then make it pass.

## Server

**IT Admin reset:** `PUT /api/users/:userId/password`, `requireAuth, requireActive, requireItAdmin` (in `users.routes.ts`, next to the others). Body `{ newPassword }`.
- `readNewPassword` checks the length (400 with its sentence).
- The account must be Active or Inactive and not anonymized (`anonymized_at` set). Pending, Rejected or anonymized: 409 "Only an active or deactivated account can get a new password."
- The IT Admin's own account: refused with the existing `refuseOwnAccount` in `users.service.ts` (the IT Admin changes their own password in Account Details, where the current password is asked).
- Hash with `hashPassword` (`server/shared/services/passwords.ts`), save, and in the same transaction log `PASSWORD_CHANGED` with the IT Admin as actor, the user as target, details "Reset by the IT Admin".
- Answer 200 with the usual User shape (no password, no hash), like the other user routes.

**Change own password:** `PUT /api/auth/password`, `requireAuth, requireActive` (in `auth.routes.ts`). Body `{ currentPassword, newPassword }`. The user comes from the session, never the body.
- `verifyPassword` on the current one. Wrong: 400 "Your current password is not right."
- `readNewPassword` on the new one. The same as the current one: 400 "Choose a new password that is different from the current one."
- Hash, save, log `PASSWORD_CHANGED` with the user as actor and target, details "Changed by the user". Answer 200 `{ success: true }`.

**Never** put a password or a hash in a response, a log row, a console line or an error. Extend `tests/api/passwordLeak.test.ts` to cover both routes.

## Tests

New file `tests/api/passwordChange.test.ts`, at least:
- The IT Admin resets an Active user's password: the user logs in with the new one, and the old one fails. One `PASSWORD_CHANGED` row, details "Reset by the IT Admin", no password in it.
- A deactivated account can be reset (and still can't log in until reactivated).
- Pending, Rejected and anonymized accounts: 409. The IT Admin's own account: refused like the other own-account actions. Unknown user: 404.
- TSG, the Secretary, the Director, a Lab Head and a Researcher: 403.
- Too short and too long: 400 with the length sentence.
- Change own: a wrong current password gives 400 and changes nothing; the same password gives 400; success lets the user log in with the new one only, with one `PASSWORD_CHANGED` row "Changed by the user".
- Not logged in: 401 on both routes.

## Web

- `web/api/users.api.ts`: `resetUserPassword(userId, newPassword)`. `web/api/auth.api.ts`: `changeOwnPassword(currentPassword, newPassword)`. Use `readResult`.
- **Users page (IT Admin):** a "Reset password" action on each Active or Inactive row, next to the existing actions. A dialog: new password and confirm (show or hide toggle), "At least 8 characters", the two must match before the button turns on. Success: "Password reset. Give the new password to the user in person." Errors: the server's sentence.
- **Account Details (every role):** a "Change password" card: current, new, confirm. Success: "Password changed." and clear the fields. Errors: the server's sentence.
- The Activity Log filter shows "Password changed" by itself (it reads `ACTIVITY_EVENT_LABELS`).

## Hand checks (local UAT copy)

- P-H1. IT Admin, Users: reset a Researcher's password. Log out, log in as that Researcher with the new password (works) and the old one (fails).
- P-H2. As that Researcher, Account Details, Change password: a wrong current password shows the error; the right one changes it; log in again with the newest password.
- P-H3. IT Admin, Activity Log, filter "Password changed": two rows, "Reset by the IT Admin" and "Changed by the user", with no password anywhere.
- P-H4. IT Admin, Users: no Reset password on Pending or Rejected rows; resetting your own account is refused.
- P-H5. typecheck 19, build passes, tests all pass (say the new count).

## Report (to Raiki, not the PR)

At the end, report in the AGENTS.md format: what changed commit by commit, the three check results, the hand checks, questions, anything not done. **Don't write the PR description:** Raiki sends the report to the advisor, who writes it.
