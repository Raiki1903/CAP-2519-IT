# Agent Prompt: Restructure, Option A (Feature Folders, One Package)

> How to run this: open the repo in VS Code with Claude Code, in manual or edit-auto permission
> mode. Do not use plan mode, it blocks file writes. Follow the git workflow in
> `docs/guides/GIT-WORKFLOW.md` if it exists: start from an up-to-date `main` and work on the branch
> named below, never on `main`.
>
> Run this in sessions. Each session does only the steps named in the first message.
>
> Before each session: `git switch main`, `git pull`, then create or switch to the branch named
> under Constraints. Tell the team not to edit `src/` or `server.ts` while a session runs.
>
> Suggested first message (change the step numbers each session):
> `Read docs/phase-1c-restructure/PROMPT-2-restructure.md and docs/phase-1c-restructure/02-restructure-log.md. Continue Part B with steps 3 to 5.`
>
> Session plan: steps 3 to 5, then 6 to 7 (behavior changes), then 8 part 1, then 8 part 2, then 9,
> then Phase 2 tests (separate prompt), then 10 to 12, then 13 to 14.
>
> History: Part A and steps 0 to 2 were done on `refactor/option-a-structure` and merged in PR #4.
> Steps 3 to 5 were merged in PR #15 and step 6 in PR #16, all on `refactor/feature-based-structure`.
> The fixes for issues #25 and #26 were merged in PR #33 (branch `fix/issues-25-26`).
> Step 8 part 1 was merged in PR #45 and step 8 part 2 in PR #46. Step 9 was done on 2026-10-08 on the same branch.

---

# Role (R)
You are a Senior Software Engineer carrying out a careful, incremental refactor of our capstone project, "Asset Management System for DLSU CCS AdRIC" (CAP-2519-IT). You move code in small, reversible steps. You never mix moving code with changing behavior. You explain what you did in plain language, because not every teammate is comfortable with backend architecture.

# Task (T)
**Part A. Record the decision and the comment standard.**
1. Write a short addendum confirming that we are keeping Option A from `01D-restructure-plan.md` exactly as written (one package, `server/` and `web/` trees with mirrored feature folders, role-based `web/pages/`, and `shared/`), and explaining why the page-first and hybrid alternatives were rejected.
2. Write the team's code comment standard (`docs/guides/CODE-COMMENTS.md`) from the rules in the Context section, so teammates follow the same format as you.

**Part B. Execute the migration.** Carry out the ordered migration steps in `01D-restructure-plan.md` section 9, **only the steps I name in my message**, one step at a time. After each step, verify it, commit it, **add documentation comments to every file the step created or moved** (in a separate commit), update the log, and stop for my review.

# Context (C)
- **Read first:** `docs/phase-1b-deep-map/01D-restructure-plan.md` in full. Then `01A-system-trace.md` sections 3 and 4, `01B-findings-register.md` for finding IDs, and `01C-security-map.md` section 9 (Tier 1).
- **Stack:** React + TypeScript (Vite, Tailwind, shadcn) frontend in `src/`, Express + TypeScript backend in one `server.ts` (about 4,760 lines), Prisma ORM, MariaDB/MySQL. One `package.json`. Scripts: `dev`, `build`, `server`, `server:watch`, `dev:all`, `typecheck`, `seed` (broken), `prisma:generate`, `prisma:pull`. `tsconfig.json` exists since step 1 (`strict: false`, aliases `@server`, `@web`, `@shared`). Typecheck count after step 2: **98**. No tests yet (M-18). If `node_modules` is missing, run `npm install` then `npm run prisma:generate` before verifying anything.
- **We are following 01D Option A as written. It is not a hybrid.** Option A has role-based `web/pages/` and process-based `features/` folders; that two-layer shape is part of the original design. The "hybrid" named below is a different layout (server and web subfolders inside each feature folder) that was considered and rejected. Do not build it.
- **The target structure (Option A, as agreed):**
  - `shared/` holds enums, types, and constants used by both sides. It never imports from `server/` or `web/`.
  - `web/pages/<role>/` (staff, lab-head, custodian, director) holds screens only. Pages arrange feature components and do not fetch data.
  - `web/features/<process>/` (assets, loans, returns, transfers, repairs, inspections, disposals, qr, notifications, analytics, auth) holds forms, lists, and dialogs.
  - `web/api/<process>.api.ts` is the only place a URL appears.
  - `server/features/<process>/` holds five files per process: `routes`, `validation`, `controller`, `service`, `repository`. Only repository files call Prisma.
  - `server/shared/` holds middleware (`requireAuth`, `requireRole`, `errorHandler`), services (`mailer`, `assetState`), and utils.
- **Why page-first and the hybrid were rejected (for Part A):**
  - One backend endpoint serves many pages. For example, `GET /api/assets` is called from `ITSDashboard.tsx`, `LabHeadDashboard.tsx`, `CustodianPortal.tsx`, `AdRICDirectorDashboard.tsx`, and `context.tsx`.
  - Workflows cross roles. A loan is requested by a Custodian and approved by a Lab Head. A disposal is filed by Staff and decided by the Director. Page folders would have to import each other's backend code or duplicate it.
  - Authorization is enforced per API action, not per page.
  - Mirrored feature names on both sides (`server/features/loans`, `web/features/loans`) already give one obvious place per process. The role-based `web/pages/` layer keeps the page view the team is used to.
  - A hybrid (each feature holding its own `server/` and `web/` subfolders) was also considered. It was not chosen because it needs extra tooling to stop server code importing browser code, still needs top-level folders for server-only and web-only code, and makes the later upgrade to npm workspaces harder.
- **Comment standard.** The rule: the code shows *how*, the name shows *what*, the comment explains *why*. Three kinds of comments, nothing else:
  1. **File header** (every file you create or move): a `/** */` block with one line on the file's purpose, its layer (page, feature component, api, routes, validation, controller, service, repository, shared), what calls it, what it calls, and which role or workflow uses it.
  2. **TSDoc on every exported function, component, and type**: one-line summary; a short *why* for any rule that is not obvious; `@param`, `@returns`, `@throws` where they apply. React components list their key props and which api function they call.
  3. **Inline comments only for a non-obvious why**: a business rule, a workaround, an ordering that matters, a known defect. End with the finding ID in parentheses when one applies, for example `(H-11)`. Known defects that are not fixed in this step use `// TODO(<finding ID>): <what is wrong>. <which phase fixes it>.`
  Do not write: comments that restate the code; history comments ("moved from server.ts L934", "edited by"), because git and the log hold that; commented-out code; any comment that describes a fix as done when it is not. Comments describe what the code does **now**.
- **Decisions already made.** Apply each one in the step named. Do not reopen them.

  | Decision | Applies in |
  |---|---|
  | ITS and TSG become one app role, `Staff`, at `/staff/*`. The database keeps both roles | Step 9 |
  | Dead analytics code stays quarantined in `legacy/analytics-v1/` with a README, not deleted | Done (step 2) |
  | **Old analytics (decided 2026-10-04):** the 11 endpoints with no caller are **deleted** when the analytics backend is extracted. The old screen code stays in `legacy/analytics-v1/` and is not re-attached. `GET /api/analytics/location-status` and `GET /api/assets` are live and stay. **Not** deleted either: the three `/api/analytics/advanced/*` endpoints below | Step 12 |
| **Unused analytics widgets (decided 2026-10-07):** the seven widgets the live views exported but never rendered are kept, in `legacy/analytics-widgets/` with a README. `GET /api/analytics/advanced/idle-time`, `idle-frequency`, and `loan-recommender` (their only callers) are kept for now and are **not** part of the step 12 deletion | Done (step 8 part 2); the endpoints wait for a later team decision |
  | **Step 6 changes beyond the plan, accepted by the team (2026-10-04):** bell transfer buttons show for the Lab Head only; `toggleClearanceHold` is removed; the two temporary state files `web/state/serverData.tsx` and `web/state/browserOnly.tsx` stay until their planned removal | Done (step 6) |
  | **Two pre-existing bugs found during the step 6 checks** (not caused by step 6) are fixed on their own branch, not in the restructure: custodians can submit duplicate requests on the same asset (H-05, issue #25), and My Assets shows disposed assets because `CustodianPortal.tsx` does not filter by status (issue #26) | Done (merged in PR #33) |
  | **Step 8 runs in two sessions (2026-10-06).** Part 1: move everything except `ITSDashboard.tsx` into `web/` (app shell, routes, layouts, `components/ui`, feature components, and the Custodian, Lab Head, Director, auth, and account screens as pages), one feature per commit. Part 2: split `ITSDashboard.tsx` into `web/pages/staff/`, move inspection scheduling to `legacy/`, and switch the inspection log to the database | Step 8 |
  | **Inspection scheduling tab (H-18, question 15): move it to `legacy/`**, in its own folder with a README like `analytics-v1`. It is kept, not deleted, so the team can find it without digging through git history. Keep the real inspection reporting live (custodian report, and single-item finalize that posts to the API). The tab disappearing from the dashboard is a behavior change: its own commit, labelled as such | Done (step 8 part 2, `993f48e3`): the scheduling controls moved to `legacy/inspection-scheduling/`; the tab stays for the queue, finalize, and the log |
  | **Staff inspection log (F-28, open team decision 2), decided 2026-10-06:** point the log table at the database reports (`asset_reports`, already fetched as `dbReports`) instead of the browser copy (`ems_inspections`). This is a behavior change: its own labelled commit. The cycle type column (Annual or Trimestral) is dropped, because the database does not store it. It may come back later: that needs a cycle type column on `asset_reports` and a shared cycle setting in place of the per-browser `pref_cycle_mode` cookie (F-38). Tracked in issue #34 | Done (step 8 part 2, `82bc2e8e`), with the Director audit pointed at the same reports; the cycle column with issue #34 |
  | **Step 8 part 2 open notes, decided 2026-10-08:** keeping the Inspections tab with only the scheduling moved is correct; the finalize dialog's Inspector Role is stored with the report in Phase 3 (issue #48); `RepairAlertCard` (rendered by nothing) moves to `legacy/`; the repeating intake serial is a bug fixed after the restructure (issue #47) | `RepairAlertCard`: step 9 session. The rest: as named |
  | **Step 9: keep the ITS and TSG distinction in the session.** Both become the app role `Staff`, but the session still says which unit a Staff account belongs to, because issue #41 will give ITS and TSG different edit and delete rights. #41 itself is not part of the restructure | Step 9 (session only); #41 later |
  | **ITS is removed from the system (decided 2026-10-08).** Staff will be TSG only, and repair forwarding goes to TSG only. The one ITS account (`ADMIN`) stays for now. Goal: no difference between ITS and TSG anywhere in the app. The differences left after step 9 (the "Staff (ITS)" sidebar label, "by ITS." in Send to Maintenance tickets, the forward-to options) are removed on their own branch, not in the restructure. Accepted with it: the bell's degraded-asset reminder asks every Staff account for action, and every Staff account lands on Overview | ITS removal branch (after step 9) |
  | **`ADRIC_SECRETARY` gets the Director view (decided 2026-10-08).** A change from today (it maps to Staff). Not changed in step 9; it goes with the ITS removal branch. No account holds this role today. **Still open:** whether the Secretary can approve and sign off like the Director, or only view | ITS removal branch |
  | **Admin app role (planned 2026-10-08).** A separate `Admin` app role for the developers (`ADMIN` database role), with access to every section. Built after step 13, when `requireAuth` and `requireRole` exist. Until then `ADMIN` accounts keep the Staff dashboard as built in step 9 | After step 13 |
  | **Issue #41, still open (2026-10-08).** With ITS removed, the team must decide who gets the "edit or delete assets with no history" right: TSG or Admin. Related to issue #19 | Team decision |
  | **M-11 `ITS_STAFF` mapping:** verified by code reading only; no account is created in the shared database. A test is added in Phase 2 on the local test database | Phase 2 |
  | **Identify users by id, not display name (issue #32).** Several handlers find a person by the name typed or shown on screen | Steps 11 to 13, as each backend feature is extracted |
  | **Manual clearance holds (F-37) in step 8:** the decision itself is still open (below), but step 8 does not wait for it. The holds code moves as is: no behavior change, no new feature | Step 8 |
  | **Transfers (question 1): superseded on 2026-10-04.** The earlier decision (Custodian initiates, Lab Head of the leaving lab approves) is withdrawn. Custodian-to-custodian transfers will be replaced by a **custodianship queue**: the custodian releases the asset to Staff, and Staff assign it to the next custodian. The design is not final; it is built after the restructure, with the Phase 3 tables (issue #22). Until then, **keep transfer behavior exactly as it is today.** In step 12, move the transfer code behavior-neutral and **do not add the Lab Head approval rule** | Step 12 (move only); the queue after the restructure |
  | **Custodian return requests (H-02):** `asset_returns` already stores finalized returns; only the request stage lives in the browser (`web/state/browserOnly.tsx`). In Phase 3, store requests in the database, most likely by adding `status`, `requested_by`, `requested_at`, and `loan_id` columns to `asset_returns` rather than a new table. The loan link also addresses H-04. Keep the browser-only behavior until then | Phase 3 |
  | **Inspection photos:** at most 3 per report, stored high resolution and deleted automatically after 2 weeks (the team is still confirming whether to keep one compressed copy as audit evidence). Asset registry pictures are compressed and kept. Relates to M-17 (images stored as base64 in the database) | Phase 3 |
  | **Repository visibility (C-01):** the repo will be made private (issue #9). **Git history stays as is, it is not rewritten.** Account passwords in the history are test data and will be rotated later | Team action, not an agent step |
  | **Tests live in a root `tests/` folder** (`tests/db/`, `tests/api/`, `tests/setup/`), not beside feature code | Phase 2 (and any test added earlier) |
  | **Test database: local MariaDB on each developer's machine**, database `AdRIC_DB_test`, reached through `TEST_DATABASE_URL`. Never the shared CCS Cloud database | Step 14 and Phase 2 |

- **Still open. Stop and ask when a step reaches one of these:**
  - Manual clearance holds (F-37): what a real hold feature looks like, and what happens to the browser-only list in `web/state/browserOnly.tsx`. Waiting on the team. Step 8 moves the code as is and does not stop for this (see the table above).
  - **Never rewrite git history yourself.** The team decided not to rewrite it (see the table above), and that is not an agent's call either way.

# Examples (E)
**Good file header and TSDoc**
```ts
/**
 * Loans service: business rules for borrow requests and decisions.
 * Layer: service. Called by loans.controller.ts. Calls loans.repository.ts and shared/services/assetState.ts.
 * Used by: Custodian borrow request, Lab Head approval.
 */

/**
 * Creates a pending loan request for an asset.
 * Rejects it if the asset is not ACTIVE or already has a pending loan,
 * because two approvals would give one item two custodians. (H-05)
 *
 * @param input assetTag, borrowerId (from the session), purpose, dueDate, destinationLab
 * @returns the created loan row
 * @throws NotFoundError if the tag does not exist
 * @throws ConflictError if the asset is not available
 */
```

**Good inline comments**
```ts
// Tag is generated inside the transaction so two staff registering at once
// cannot get the same number. (H-11)

// TODO(H-04): finalizing a return does not close the loan yet. Phase 3.
```

**Bad comments**
```ts
// loop through the assets          (restates the code)
// moved from server.ts line 934    (history belongs in git and the log)
// fixed the borrower bug           (vague, no finding ID, may not be true)
```

**Good commit message**
```
refactor(step 2): quarantine dead analytics components into legacy/analytics-v1

Moves 7 files with no importers. Adds legacy/analytics-v1/README.md listing
each file and the endpoints it depended on. No behavior change.
Refs: M-06, 01D section 9 step 2
```

**Good step report (in chat, after each step)**
> **Step 2 done: quarantine dead code.**
> *What moved:* 7 files from `src/app/components/` and `src/app/lib/` into `legacy/analytics-v1/`.
> *What changed in behavior:* nothing.
> *Comments added:* `legacy/analytics-v1/README.md` only (legacy files get no per-file comments). Commit `<hash>`.
> *Checks I ran:* `npm run build` passed. `npm run typecheck` shows 212 errors, same count as before this step.
> *Please check by hand:* log in as Staff, Lab Head, Custodian, and Director, and open every tab once. Every screen should load as before.
> *Undo:* `git revert <comment hash> <move hash>`.
> *Next:* step 3, create `shared/`. Waiting for your go-ahead.

**Bad**
> "Moved some files and cleaned things up a bit."
(No file list, no checks, no undo path, and "cleaned up" hides behavior changes.)

# Constraints (C)
- **Branch:** work on `refactor/feature-based-structure`, created from an up-to-date `main`. If it already exists, continue on it. (Steps 0 to 2 used `refactor/option-a-structure`, now merged and deleted.) Update the branch line in the log to match. Never commit to `main`. Never merge, rebase, force-push, or push. I will push and open the pull request myself.
- **Two commits per step: move, then comment.** First commit the step itself. Then commit the documentation comments for every file that step created or moved, with the message `docs(step N): add file headers and TSDoc`. Keeping them apart lets git detect the moves as clean renames and lets reviewers check each separately. Adding comments never changes behavior.
- **Do not comment `server.ts` or files about to be split.** Comment code at its destination, when it lands. Files quarantined into `legacy/` get only their README, not per-file comments.
- **One step, one purpose.** One commit either moves code or changes behavior, never both. Steps 6 and 7 change behavior on purpose; say so clearly in the commit message and the report.
- **Stop after every step** and wait for me to say continue, even if I named several steps.
- **Only do the steps I name.** Do not start the next step early. Do not fix findings that are not part of the current step. Log anything you notice as a note instead (01D section 11, "scope creep into Phase 3").
- **Step 0 has human parts.** Do the code parts: stop the backup job from dumping `users` and writing into the repo, add `scratch/backups/` and `pending_registrations.json` to `.gitignore`, untrack them with `git rm --cached`, and add `.env.example` with variable names only. **List** the human parts for me instead of doing them: rotating passwords, deciding on history cleanup, and telling the team to pull.
- **Do not change the Prisma schema, run migrations, or write to the database.** Step 14 (baseline migrations) needs my explicit go-ahead in the message, and even then must only run against the local `AdRIC_DB_test` database through `TEST_DATABASE_URL`. If that variable is not set, stop and ask.
- **Do not add, remove, or upgrade dependencies.** No `npm install <package>`, no `npm audit fix`, no Prisma upgrades. `package.json` dependency versions and `package-lock.json` must not change in any step. Dependency work happens on a separate `chore/npm-audit` branch. If a step truly needs a new package, stop and ask.
- **Never read or print `.env`.** Never reproduce credentials or personal data from `scratch/backups/`, `pending_registrations.json`, or anywhere else. Refer to them by path and record count only.
- **Verify every step** with the commands available at that point: `npm run build` always, `npm run typecheck` once step 1 adds it, and starting the server once to confirm it listens. If a check fails, fix it within the same step or undo the step and report. Never commit a step that breaks the build.
- **Keep the typecheck error count from growing.** Record it after step 1 and report it after every step.
- If the code no longer matches 01D (line numbers moved, files renamed), follow the intent of 01D and report the difference.
- **No em dashes** in anything you write (docs, READMEs, commit messages). Use commas, colons, periods, or parentheses.
- Use plain language in reports. Explain any term a beginner may not know the first time you use it.

# Docs housekeeping (do this last)
- Update the status board in `docs/README.md`: set this prompt's row to **Done** (or **In progress** with the last step reached), with today's date and links to the files you created.
- Add a dated entry to the end of `docs/HANDOFF.md`: which prompt you followed, what you produced, key findings or decisions, and open questions. Keep earlier entries unchanged.
- Put new files only where this prompt says. Do not create new folders under `docs/` unless this prompt names them.

# Output Format (O)
1. **Part A:** create two files and commit each on its own before starting Part B.
   - `docs/guides/CODE-COMMENTS.md`: the comment standard from the Context section, written for teammates, with the examples above (good and bad), one example per layer (page, feature component, api file, routes, controller, service, repository), and a short "before you commit" checklist.
   - `docs/phase-1c-restructure/01-restructure-decision.md` with these sections:
   - Decision (one paragraph).
   - Options considered: a table covering Option A, page-first, and the hybrid, with columns for traceability, readability, scalability, risk, and effort.
   - Why page-first was rejected: the reasons above, each backed by a file reference you verified.
   - Three traced transactions through the target structure (asset registration, repair request and progress, disposal filing and decision), each as an indented file path from `web/pages/` down to `server/features/<process>/*.repository.ts`, noting which findings each fix belongs to.
   - What stays open (the open decisions listed above).
   (Part A is done. It was merged in PR #4. Do not redo it.)

2. **Part B:** keep a running log at `docs/phase-1c-restructure/02-restructure-log.md` with:
   - a status table: step number, name, status (not started, done, blocked), move commit hash, comment commit hash, typecheck error count, date;
   - a notes section for anything noticed but deliberately not fixed, with the finding ID if one applies.
   Update and commit the log together with each step.
3. **In chat after each step:** a report in the format from the example, then stop.
4. **At the end of each session:** do the docs housekeeping above, and commit it with the last step's comment commit.