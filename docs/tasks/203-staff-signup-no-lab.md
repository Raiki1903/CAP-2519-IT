# Staff sign up without a lab (#203)

**Owner:** Raiki (Claude Code agent). **Reviewer:** the advisor (lean). **Save as:** `docs/tasks/203-staff-signup-no-lab.md` (first commit; replace 203 with the 203 number everywhere in this file first).
**Branch:** `feat/203-staff-signup-no-lab` from a fresh `main`.
**Rules:** `AGENTS.md` and `CLAUDE.md`. No change in `prisma/`, `package.json` or `package-lock.json`. No migration. No em dashes. Typecheck stays at 19, build passes, tests: the count on `main` plus yours, all passing.
**Due:** merged by **Thu Nov 19, 3 pm** (Thu deploy).

## Why

Sign-up has no role field: the applicant picks a user type (Student, Faculty, Staff) and at least one lab, and the IT Admin picks the role at approval. Labs are already optional at approval for every role but Researcher. So TSG Staff, the Director, the Secretary and the IT Admin must pick a lab they don't belong to, and the IT Admin unticks it. After the clean start these are the first real sign-ups.

## The rule

- **User type Staff:** labs optional. A missing `centerIds` or `[]` means no labs. If labs are sent, the same checks as today apply (whole positive numbers, each lab exists, duplicates once).
- **Student and Faculty:** unchanged, at least one lab.
- **Approval:** unchanged. A Researcher needs at least one lab; other roles zero or more. A Staff sign-up with no labs approved as Researcher is refused with the existing message, so the IT Admin adds the lab in the same dialog.

## What to change

**Server**
- `server/features/auth/auth.validation.ts`, `readSignUpRequest`: apply the lab rule above. Check `userType` before the labs (it already is). A `centerIds` that is present but not an array, or has a bad id, is still 400 for every user type.
- `shared/constants/signUp.ts`: `NO_LAB_MESSAGE` becomes `"Choose at least one lab. Only Staff may leave it empty."` (it is shared by the server and the Register screen).
- `server/features/auth/auth.service.ts` and `auth.repository.ts`: check that an empty list works as is (`countLabs([])` gives 0, and `user_centers.createMany` with no rows). If either needs a guard, add the smallest one and say so.
- Update the TSDoc and file headers that say "at least one lab".

**Web**
- `web/pages/auth/Register.tsx`:
  - The browser check skips the lab check when the user type is Staff.
  - The labs label reads "Institutional Labs (choose at least one)" for Student and Faculty and "Institutional Labs (optional for Staff)" for Staff.
  - Wherever the screen shows the chosen labs back (the summary or confirm step), no labs shows "None. The IT Admin assigns them." instead of a blank.
  - Changing the user type back to Student or Faculty with no lab chosen must block submit again.
- Check the IT Admin's Approvals list and the Approve dialog with a sign-up that has no labs (blank cells, `user.labs` empty). Fix only a real break, and say what.

**Docs**
- `docs/contracts/lifecycle.md`, 7.7 "Sign up" row: "at least one lab that exists" becomes "at least one lab that exists for Student and Faculty; zero or more for Staff". Section 4 "Sign-up and account": one line with the rule.
- `AGENTS.md`: the test count.

## Commits, in order

1. `docs(auth): task file for staff sign-up without a lab (#203)`. **Raiki commits it before the agent starts.**
2. `feat(auth): staff may sign up without a lab (#203)`: server, shared message, tests.
3. `feat(web): the Register screen lets Staff leave the labs empty (#203)`.
4. `docs(contracts): sign-up labs are optional for Staff (#203)`.
5. `docs(agents): update the test count (#203)`.

## Tests (`tests/api/registration.test.ts`, plus `users.test.ts` for approval if that is where approval lives)

- The existing "no labs" and "no lab list" cases stay 400 for a Student (they pin the new message text; update the text in the same commit and say so). Add the same two for Faculty.
- Staff with `centerIds: []`: 201, Pending, no role, no `user_centers` rows.
- Staff with no `centerIds` at all: 201, same.
- Staff with a lab: 201 with that lab (unchanged behavior).
- Staff with `["1"]` or an unknown lab: still 400 with today's messages.
- Approve a no-lab Staff sign-up as TSG Staff with no labs: 200, Active, no labs. As Researcher with no labs: 400 "Choose at least one lab for a Researcher.".

## Hand checks (local demo database only, never CCS Cloud)

- S-H1. Register: user type Staff, no lab, submit. It goes through with the "waiting for IT Admin approval" message.
- S-H2. Register: user type Student, no lab. Blocked with the new message. Switch to Staff: the label says optional and submit works; switch back to Student: blocked again.
- S-H3. IT Admin, Approvals: the no-lab Staff sign-up shows with no labs. Approve as Researcher with no lab: the button waits (or the server refuses). Approve as TSG Staff with no lab: works; log in as it: the Staff view opens.
- S-H4. Nearby behavior: a Student sign-up with one lab still works and shows its lab in Approvals.

## Report (to Raiki, not the PR)

The AGENTS.md format: what changed commit by commit, the three check results (say the new test count and why), the hand checks, questions, anything not done. Don't write the PR description: the advisor writes it.
