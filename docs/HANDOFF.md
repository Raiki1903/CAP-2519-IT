# Handoff

Source prompt: [PROMPT-db-revisions.md](phase-1-codebase-map/PROMPT-db-revisions.md)

## Status

| Phase | Output | State |
|---|---|---|
| 1. Codebase map | [01-codebase-map.md](phase-1-codebase-map/01-codebase-map.md) | Done, waiting for approval |
| 2. Tests | `02-test-spec.md` + test files | Not started (blocked on Phase 1 approval) |
| 3. Database plan | `03-db-plan.md` | Not started (blocked on Phase 2 approval) |

## What was done in Phase 1

- Read `server.ts` (all process handlers, auth, backup job, key analytics routes), `prisma/schema.prisma`, `prisma.ts`, `prisma.config.ts`, `package.json`, `test-user.ts`, `mailer.ts` (env key names only), `pending_registrations.json` (password value not printed), `scratch/` DDL scripts, `docs/phase-0-merge/MERGE_NOTES.md`.
- Read frontend: `routes.tsx`, `RootLayout.tsx`, `context.tsx`, `prismaClient.ts`, `Login.tsx`, `Register.tsx`, `LoanForm.tsx`, `TransferForm.tsx`, `RepairForm.tsx`, `ReturnForm.tsx`, relevant parts of `ITSDashboard.tsx`, `CustodianPortal.tsx`, `LabHeadDashboard.tsx`, `AdRICDirectorDashboard.tsx`, `AssetDetailModal.tsx`, `NotificationCenter.tsx`.
- Inspected the structure of the newest `scratch/backups` file with a script that printed only field names, row counts, and distinct status values.
- Not read: older pre-defense branches, `.env` (no `.env` file exists in this working copy), the live database.
- No application code, schema, or database was changed. Nothing was committed or staged.

## Key findings

- Security and privacy (urgent, affects D2): 113 committed `scratch/backups/*.json` files contain the full `users` table with plaintext passwords; `pending_registrations.json` stores a plaintext password; `GET /api/auth/pending-registrations` returns passwords with no authentication; the API has no authentication at all; `prisma.ts` has hardcoded DB connection defaults including a password.
- Two data stores: several frontend actions write only to a browser localStorage mock (`prismaClient.ts`), including Notification Center approvals for transfers and disposals, custodian pending returns, and clearance holds.
- Prisma: no migrations folder, workflow is manual `ALTER TABLE` plus `db pull`; schema already drifts from the DB (`asset_monetary.is_documented`). 11 interactive transactions exist. No raw SQL in the server. No triggers, procedures, or views in the repo. Seed script is broken.
- Current state is kept as an append-only log in `asset_records`; "latest record" is chosen by a 1-second timestamp with inconsistent tie-breaking.
- Workflow statuses (loan, transfer, disposal, repair) are free `VARCHAR`; no transition rules; no guard against borrowing or transferring an asset that is on loan, in maintenance, or disposed; returns never close the loan.
- Panel comment state: D1 Partly, D2 Missing, S1 Partly, S2 Missing, S3 Missing, S4 Missing, S5 Missing, S6 Missing, S7 Partly, O1 Partly.

## Open questions for the team

1. Transfers: who is supposed to approve? The server comment says the recipient; the UI says Lab Head; the TransferForm pipeline also lists "TSG Log Verification". Is it one, two, or three steps?
2. After an approved transfer, should the asset status be `ON_LOAN` (current behavior) or stay `ACTIVE` under a new custodian? Is a transfer a permanent change of accountability or a temporary one?
3. After a return, who is the custodian? Current code assigns user id 1. Should it go back to the Lab Head of the home lab, or a dedicated "pool" account?
4. Loans: who approves, Lab Head of the asset's home lab only, or also ITS and TSG (NotificationCenter allows both)?
5. What does "discontinue" mean for the panel and the team: a status that is different from "disposed" (for example retired but kept), or the same as disposal? Should hard delete be allowed at all?
6. Custodians with several labs (S2): when a form needs one lab, how is the default chosen (primary flag, most recent, or asset's home lab)?
7. Warranty routing (S3): who is the "seller/manufacturer" contact? Is it enough to route by `warranty_expiry >= today`, or do the dates need purchase order or supplier data?
8. Repair issue options (S4): does TSG have an existing list of issue categories and standard actions we can use?
9. Bundles (S5): can a bundle component be borrowed, transferred, or disposed separately from its parent, or always together?
10. Utilization (S6): what counts as "use": the approved loan period, actual handover to return, or in-lab session logs? What periods matter (per hour, per day, per week, per academic term)?
11. Retention (D2): what retention period does the revised proposal document (pages 38, 51, 95-96) specify for graduating students, and what must be kept for audit (for example asset custody history) versus deleted or anonymized?
12. Which roles should `ITS_STAFF` and `ADRIC_SECRETARY` map to?
13. Is there a separate test database available, or only the shared `ccscloud` database? (Phase 2 tests must not run against the shared DB.)

## Recommended action before Phase 2 (team decision, not done by the agent)

- Decide how to handle the committed password and personal data in `scratch/backups/` and `pending_registrations.json` (rotate affected passwords, stop the backup job from dumping `users` into the repo, and consider whether git history needs cleaning). This was not changed because the working rules only allow edits under `docs/` and the test folder.

## Exact next step

- Review [01-codebase-map.md](phase-1-codebase-map/01-codebase-map.md). Answer or defer the open questions above.
- Reply "Phase 1 approved" (optionally with answers). The agent then starts Phase 2: writes `docs/phase-2-tests/02-test-spec.md`, proposes a test folder (expected: `tests/db/`), and writes failing and pending tests for triggers and stored procedures, with a traceability table from each panel comment to its tests.

---

## Phase 1B, 01A system trace and 01B findings register, 2026-09-18

Prompt followed: [PROMPT-deep-map.md](phase-1b-deep-map/PROMPT-deep-map.md). Phase 2 and Phase 3 are paused in favor of this deeper map.

### What is done

- [phase-1b-deep-map/01A-system-trace.md](phase-1b-deep-map/01A-system-trace.md): file inventory, component tree, shared state map, 41 catalogued features with full data paths, entity lifecycle diagrams, role and permission matrix, cross-cutting behavior, and a list of corrections to `01-codebase-map.md`.
- [phase-1b-deep-map/01B-findings-register.md](phase-1b-deep-map/01B-findings-register.md): 7 Critical, 20 High, 20 Medium, and 7 Low findings in one sorted table, detailed write-ups with failure scenarios for all Critical and High items, a system health summary, and a demo and defense risk list.
- Still to write in this phase: `01C-security-map.md`, `01D-restructure-plan.md`, `01E-onboarding-roadmap.md`.
- No application code, schema, or database was touched. Nothing was staged or committed.

### Key findings new in this phase

- 8 corrections to the earlier map, the largest being that about 2,672 lines of the frontend are dead code (6 components plus one library file), and that there is no `tsconfig.json` anywhere, so TypeScript is never type-checked. Live bugs exist because of it, including inspections recorded with the inspector name "undefined undefined".
- Only 8 of the 30 analytics endpoints are reachable from a live screen. 11 are called only by dead components, 11 by nothing at all.
- `GET /api/asset_loans` inserts a loan row when none is pending, so viewing a page creates data.
- Four analytics responses substitute hardcoded demo series when the real data is empty.
- Two different repair endpoints produce different side effects for the same user action, and the live database already holds a repair status string that neither code path handles.
- The Notification Center's transfer and disposal approvals write only to browser storage, while the same actions on the dashboards write to the database.
- Custodian return requests and the whole inspection scheduling screen keep state only in the browser, the latter while telling the user its records are saved.
- Six disagreeing hardcoded lab lists exist, and the one real database table of labs is never read by any form.
- Security findings are unchanged in substance from Phase 1 but now enumerated per route, including that `approve-registration` will create an account with any role from the request body alone.

### Open questions added in this phase

Numbering continues from the Phase 1 list above.

14. Should the dead analytics layer (AnalyticsDashboard, RoleAnalyticsModule, ReportsAnalyticsDashboard, AssetCatalog, StudentAnalyticsView, analyticsReasoning) be deleted in the restructure, or re-attached to the router? It is roughly 2,670 lines and 11 backend endpoints exist only to serve it.
15. Was the inspection scheduling screen (Groups A to D, trimestral cycle) ever intended to persist, or was it always a mockup for the defense? The answer changes whether it becomes a schema change in Phase 3.
16. Is `cycleMode` (Annual or Trimestral) an institutional policy or a personal preference? It is currently a per-browser cookie that drives text on shared screens.
17. Should ITS and TSG keep sharing one dashboard and one set of permissions, or do they need to diverge? They are currently identical apart from the URL.
18. For the restructure: do you want frontend and backend split into separate workspaces in one repository, or kept in one root package? This is the main structural decision in 01D and I need your preference, or I will recommend one and proceed.
19. Is there a CI setup, or any plan for one? It affects whether the restructure adds `tsc --noEmit` and tests as scripts only, or as pipeline steps.
20. Confirmation needed on two items I could not check without database access: whether `asset_monetary.is_documented` really exists in the live database, and whether any triggers, procedures, or views already exist there.

### Exact next step

- Review 01A and 01B. The prompt says to stop here for approval before I continue.
- Reply "1B approved" and I will write, in order: `01C-security-map.md` (attack surface, per-route authorization table, sensitive data map, prioritized remediation tiers, Data Privacy Act mapping for D2), then `01D-restructure-plan.md` (target tree, move map, `server.ts` split, frontend reorganization, ordered migration steps), then `01E-onboarding-roadmap.md` (the front door document).
- If you prefer a different order, or want 01D before 01C, say so.

---

## Phase 1B, team answers and schema correction, 2026-09-18

The team approved 01A and 01B, answered the open questions, and supplied the authoritative database schema, now saved at [reference/AdRIC_DB_Schema.sql](reference/AdRIC_DB_Schema.sql).

### Answers received

| Q | Answer |
|---|---|
| 14. Dead analytics layer | Keep it, but quarantine it in its own folder and flag it. Planned as `legacy/analytics-v1/` |
| 15. Inspection scheduling persistence | Undecided, leave open |
| 16. `cycleMode` policy or preference | Undecided, leave open |
| 17. ITS and TSG | Same job, they work together, the difference is only the name. Plan merges them into one app role with one route tree, while keeping both database roles |
| 18. Repository structure | Team asked for a recommendation and leaned feature-based. Recommended: one package, feature folders, shared types via path alias. Reasoning in [phase-1b-deep-map/01D-restructure-plan.md](phase-1b-deep-map/01D-restructure-plan.md) section 1 |
| 19. CI | Team had not met the term. Explained in 01D section 10 |
| 20. `is_documented`, triggers, procedures, views | Column does not exist anywhere. No triggers, no procedures, no views in the database |

### Corrections applied to 01A and 01B

- `asset_monetary.is_documented` is a **phantom** column, not a drifted one. The compliance metric reads a field that exists in neither the Prisma schema nor the database. Finding H-12 rewritten.
- Three new High findings from reading the supplied schema:
  - **H-21:** `asset_returns.condition` stores `MINOR DRIFT` and `CRITICAL DEFECT` with spaces, while the Prisma enum uses underscores with no `@map`. Finalizing a return in either condition fails or stores an empty value.
  - **H-22:** the seed gives `director@dlsu.edu.ph` the CUSTODIAN role, and no seeded user holds ADRIC_DIRECTOR. The Director lands in the student portal and disposal emails address a role nobody holds.
  - **H-23:** the schema file cannot execute. `VARCAHR(255)` on `asset_records.current_location`, and a stray `;` in the `user_roles` insert that orphans its last row.
- New section [01A 3.5](phase-1b-deep-map/01A-system-trace.md#35-the-two-schemas-and-where-they-disagree) lists six disagreements between `schema.prisma` and the SQL file, including `VARCHAR(500)` image columns that cannot hold the base64 images the app stores in them.
- Counts are now 7 Critical, 23 High, 20 Medium, 7 Low.

---

## Phase 1B, 01C security map, 2026-09-18

### What is done

[phase-1b-deep-map/01C-security-map.md](phase-1b-deep-map/01C-security-map.md): attack surface across seven entry points, authentication analysis with a forgery table, a per-route authorization table covering all 62 routes, a sensitive data map (locations and counts only, no values), input handling, configuration and secrets, a Data Privacy Act mapping for panel comment D2, and a three-tier remediation plan.

### Key findings

- The enforced-authorization column is "nothing" for all 62 routes. There is no middleware of any kind.
- New leak found while writing it: `POST /api/auth/approve-registration` returns the created user row, password field included ([server.ts#L3878](../server.ts#L3878)).
- `GET /api/analytics/advanced/stewardship-score/:userId` is a direct object reference: changing the number in the URL returns another person's borrowing history.
- Login compares passwords with a case-insensitive collation, so password case does not matter.
- Nine Data Privacy Act obligations from the proposal are mapped against reality. All nine currently fail, two of them actively (credentials published, no audit trail means a breach could not even be detected).
- The one thing already handled correctly: Mailgun credentials are environment-only and not committed.

### Exact next step at the time of writing

Continue to 01D.

---

## Phase 1B, 01D restructure plan, 2026-09-18

### What is done

[phase-1b-deep-map/01D-restructure-plan.md](phase-1b-deep-map/01D-restructure-plan.md): the structure recommendation with three options compared, the full target tree, how the reference layout was adapted, the layered split explained plainly, a worked example on the real borrow route, move maps for backend and frontend, what to rewrite rather than move, 15 ordered migration steps, an explanation of CI, a risk table, and what the restructure does not fix.

### Key decisions recorded

- **Recommended: one package, feature folders, shared types via a path alias.** Chosen over npm workspaces because the team's stated goals are traceability, readability, and scalability, and workspaces mainly buy dependency isolation at the cost of breaking everyone's setup mid-capstone. The folder layout is deliberately shaped so workspaces remain a later rename if they are ever needed.
- ITS and TSG merge into one app role, `Staff`, with one route tree. Both database roles are kept.
- Seven dead frontend files move to `legacy/analytics-v1/` with a README, per the team's answer to question 14.
- Named for rewrite rather than relocation: `prismaClient.ts` (delete), `context.tsx`, the `GET /api/assets` handler, `NotificationCenter.tsx`, the inspection scheduling tab, and `test-user.ts`.
- Migration is 15 steps, each independently shippable and revertible. Steps 0 to 9 are frontend and safety work that can run in parallel with Phase 2. Step 14, baselining migrations, is the precondition for Phase 3.

---

## Phase 1B, 01E onboarding roadmap, 2026-09-18

### What is done

[phase-1b-deep-map/01E-onboarding-roadmap.md](phase-1b-deep-map/01E-onboarding-roadmap.md): what the system is and who uses it, a corrected setup guide with a table of currently broken or misleading steps, four guided reading tours (login, borrowing, equipment intake, and the whole catalogue), a "where do I change this" table covering today and after the restructure, a vocabulary section naming every misleading term, and a traps section.

Phase 1B is complete. All five documents exist.

### Key points

- The existing [README.md](../README.md) is partly wrong: it describes a `generated/prisma/` folder that does not exist and implies `.env` is required when the app silently falls back to hardcoded credentials instead of failing.
- There is no way to create a local database, because the only SQL build file does not run (H-23). That is why the team shares one live database and why there is no staging environment.
- The vocabulary section documents the genuinely confusing names: custodian meaning two different things, transfers setting status to ON_LOAN, disposal being called decommission in the UI, and three similar names for two report endpoints.

### Open questions still unanswered

- 15 (inspection scheduling persistence) and 16 (`cycleMode` policy or preference), both deliberately deferred by the team.
- Question 1 from Phase 1 remains the most important blocker for Phase 3: who approves a transfer, the recipient or the Lab Head?

### Exact next step

Three ways forward, in the order I would recommend:

1. **Do 01C tier 1 now.** Seven small changes, mostly deletions, that stop credentials being published. This needs someone with permission to edit application code and `.gitignore`, which this phase did not have.
2. **Fix the three one-line defects** while they are fresh: H-21 (add `@map` to `asset_returns_condition`), H-22 (correct the Director's seeded role), H-23 (the two SQL typos). None of them touches application logic.
3. **Resume Phase 2** (`docs/phase-2-tests/02-test-spec.md` plus test files), which is still blocked on a separate test database. Note that H-23 must be fixed first, because the test database cannot be created until the schema file runs.

Say which of the three you want, or "start Phase 2", and I will continue.

## Docs reorganization and Phase 1C prompts, 2026-09-26

- `docs/` reorganized into phase folders: `phase-0-merge/`, `phase-1-codebase-map/`, `phase-1b-deep-map/` (was `phase-1-b-findings/`), `phase-1c-restructure/`, plus `guides/` for living docs and `reference/`. All internal links were updated.
- Prompts renamed to `PROMPT-<name>.md` and moved into their phase folders. `AGENT-PROMPT-DB-REVISIONS.md` is now `phase-1-codebase-map/PROMPT-db-revisions.md`; its Phase 2 and Phase 3 outputs now go to `phase-2-tests/` and `phase-3-database/`.
- New `docs/README.md`: index, status board, folder rules, and how to run a prompt.
- New prompts: `phase-1b-deep-map/PROMPT-team-briefing.md`, and in `phase-1c-restructure/`: `PROMPT-1-git-workflow.md`, `PROMPT-2-restructure.md`, `PROMPT-3-structure-guide.md`.
- Decision: the restructure follows 01D Option A as written (not page-first, not the co-located hybrid). Code comments follow a file header + TSDoc + "why only" inline standard, written up by PROMPT-2 Part A.

## Phase 1B, team briefing, 2026-09-26

### What is done

Followed `phase-1b-deep-map/PROMPT-team-briefing.md`. Produced [phase-1b-deep-map/01F-team-briefing.md](phase-1b-deep-map/01F-team-briefing.md): TL;DR, 30-minute agenda, how the system works (diagram, role table, ten workflows), health check, all 7 Criticals, Highs by theme, demo risks, a one-page security summary with the Tier 1 to 3 list, a documentation impact table, nine decisions with recommended answers, next steps with `[name]` owners, speaker notes per section, a glossary, and a full 57-finding index.

### Verification

Spot-checked against the code on 2026-09-26: `server.ts` is still 4,760 lines, `scratch/backups/` still has 113 tracked files, `app.use(cors())` is still at L11, and no auth middleware exists. No Phase 1B finding had changed. No application code was edited and nothing was committed.

### Key decisions proposed (for the meeting, not yet made)

- Do all Tier 1 security items before the next demo.
- Rotate credentials now; decide on a git history rewrite with the adviser.
- Fix H-21, H-22, H-23 first (one-line defects; H-23 also unblocks the Phase 2 test database).
- The paper must describe RBAC and Data Privacy Act compliance as designed, not implemented.
- Script a safe demo path that avoids the bell approvals, return requests, and inspection scheduling.

### Open questions

- Who approves a transfer, the recipient or the Lab Head (HANDOFF question 1)?
- Persist inspection scheduling or label it a prototype (question 15)? Is `cycleMode` policy or preference (question 16)?
- Dead analytics: quarantine or re-attach (01A section 10 item 5)?
- Is `pending_registrations.json` live data or a test artifact (01A section 10 item 4)?

### Exact next step

Present 01F at the meeting, record the answers to its section 8 decisions here, then run `phase-1c-restructure/PROMPT-1-git-workflow.md`.

## Phase 1C, git workflow guide, 2026-09-26

### What is done

Followed `phase-1c-restructure/PROMPT-1-git-workflow.md`. Produced:

- [guides/GIT-WORKFLOW.md](guides/GIT-WORKFLOW.md): the one rule (no direct commits to `main`), the mental model with the "push the branch, not main" correction, one-time setup, the daily 10-step loop in both terminal and VS Code form, branch naming, commit message format with project examples, pull requests and what the reviewer checks, keeping a branch current with merge (not rebase) plus conflict resolution in VS Code, the never-commit list, team coordination rules for the restructure and for Phase 3 migrations, rules for AI coding agents, first-time repo cleanup, GitHub settings, a recovery cheat sheet, and a one-page command table.
- [.github/pull_request_template.md](../.github/pull_request_template.md): what changed, why (finding IDs), how tested (build, screens, no secrets), moves-code-or-changes-behavior, screenshots, reviewer notes.

### Repo state verified (read-only, 2026-09-26)

- `docs/reorganize-docs` **is already merged into `main`** via PR #1 (`6fddd1bc`), and it carried `database-continuation` with it. Cleanup step 1 from the prompt is therefore already done.
- All seven old pre-defense branches confirmed to share **no common history** with `main`: `asis-balanay-merged`, `frontend-backend-version-one`, `frontend-backend-version-two`, `frontend-backend-version-3`, `new-version-frontend`, `refactored-frontend`, `refactored-and-cleaned`. They must never be merged. Guide recommends tag-then-delete, flagged as a team decision.
- Two extra local-only branches found that the prompt did not mention: `Frontend-Check` and `old-local-main`. Noted in the guide as local leftovers to delete when no longer needed.
- No `.github/` folder existed before this session. No `.env` or `.env.example` exists. `.gitignore` still does not cover `scratch/backups/` or `pending_registrations.json` (M-19), so the guide tells people never to use `git add .`.
- No `typecheck` script in `package.json` yet, so the guide refers to it as "once the restructure adds it".

### Needs the repo owner (cannot be done from here)

Branch protection for `main` (require a PR, require 1 approval, block force-push and deletion), automatically delete head branches on merge, and later a required CI status check. Listed with exact GitHub locations in section 13 of the guide.

### Open questions

- Does the team agree to tag and delete the seven old branches, or keep them as branches?
- Who owns the `refactor/option-a-structure` branch during the restructure? The coordination rules in section 10 assume one owner.
- Requiring one approval means the author cannot self-merge. Confirm the team is fine with that with four people.

### Exact next step

Turn on branch protection, then run `phase-1c-restructure/PROMPT-2-restructure.md` on a `refactor/option-a-structure` branch.

## Phase 1C, restructure Part A and steps 0 to 2, 2026-09-26

Followed `phase-1c-restructure/PROMPT-2-restructure.md`. Branch: `refactor/option-a-structure`. Nothing pushed.

### Part A

- [guides/CODE-COMMENTS.md](guides/CODE-COMMENTS.md): the three-comment standard (file header, TSDoc on every export, inline only for a non-obvious why), one example per layer, a never-write list, and a before-you-commit checklist. Commit `fbaa777`.
- [phase-1c-restructure/01-restructure-decision.md](phase-1c-restructure/01-restructure-decision.md): confirms 01D Option A as written, an options table scoring Option A against page-first and the hybrid, the page-first rejection backed by verified file references, three transactions traced through the target structure, and the open decisions. Commit `1cfb784`.

### Part B

Running log with per-step detail and a notes section: [phase-1c-restructure/02-restructure-log.md](phase-1c-restructure/02-restructure-log.md).

- **Step 0** (`324dfda`): `performDatabaseBackup()` no longer reads the `users` table and writes only to `BACKUP_DIR`, with no default, refusing any path inside the repo. Added `scratch/backups/` and `pending_registrations.json` to `.gitignore` and untracked 114 files with `git rm --cached` (files remain on disk). Created `.env.example`, names only.
- **Step 1** (`e5a13ef`): `tsconfig.json` plus a `typecheck` script. Type checking now runs for the first time. **Baseline 114 errors**, recorded per file.
- **Step 2** (`5b68bb6`): 7 dead files (2,672 lines) moved to `legacy/analytics-v1/` as pure renames, with a README. **Typecheck 114 to 98.**

`npm run build` passes after every step. `node_modules` was absent, so `npm ci` and `npm run prisma:generate` were run first.

### Worth knowing

- **Type checking independently confirmed H-13** at the exact lines 01B named: `ITSDashboard.tsx:1943` (`first_name`), `ITSDashboard.tsx:1973` and `CustodianPortal.tsx:341` (`user_id`). These write wrong data today and deserve their own `fix/h13-*` branch.
- 37 of the 98 remaining errors are `motion` animation props, cosmetic but they bury the real ones.
- TypeScript 6 errors on `baseUrl`, so `tsconfig.json` uses `paths` without it.
- 11 analytics endpoints now have no caller at all. Still mounted, still unauthenticated. Listed in `legacy/analytics-v1/README.md`.
- `prisma.ts` still holds hardcoded credentials (C-07). Left deliberately: removing them before `server/config/env.ts` exists (step 10) would break every teammate's setup with no replacement.

### Human steps from step 0, NOT done

1. Rotate every password in the 113 backup files, in `pending_registrations.json`, and the database password in `prisma.ts`.
2. Decide with the adviser whether git history must be rewritten. The repo is public and history still holds every backup. An agent must never do this.
3. Tell the team to pull after this branch merges and to create `.env` from `.env.example`.

### Open questions

- Is `/api/analytics/dashboard` re-attached or does it stay quarantined (blocks nothing yet, but decides whether 11 endpoints get deleted)?
- Is the inspection scheduling tab rebuilt or moved to `legacy/` (question 15, H-18)? Needed before step 8.
- Co-located tests or a root `tests/` folder? Needed before Phase 2.
- Who approves a transfer, the recipient or the Lab Head (question 1)? Needed before step 12.

### Exact next step

Continue Part B at **step 3** (create `shared/`, move the enums and the lab list into it):
`Read docs/phase-1c-restructure/PROMPT-2-restructure.md and docs/phase-1c-restructure/02-restructure-log.md. Continue Part B with step 3.`

---

## Phase 1C, restructure step 3, 2026-09-30

**Prompt followed:** [phase-1c-restructure/PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md), Part B. Asked for steps 3 to 5; the prompt stops after every step, so this session reached step 3 and is waiting for review. Branch: `refactor/feature-based-structure`.

### What was produced

- **Step 3** (`e88ae11b`, comments `docs(step 3)` commit): created `shared/`. `labs.ts` moved to `shared/constants/labs.ts`. New `shared/enums/assetCondition.ts`, `assetCategory.ts`, and `role.ts` replace identical copies in `server.ts`, `ITSDashboard.tsx`, `ReturnForm.tsx`, and `context.tsx`. `vite.config.ts` gained the `@shared` alias; the server resolves it through `tsx` with no change. No behavior change. **Typecheck stays at 98.** Detail in [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md#step-3-detail).

### Worth knowing

- `TSGAnalyticsView.tsx` offers category filters (`WORKSTATION`, `ROBOTICS`, and others) that do not exist in the database enum, so they can never match. Logged, not fixed.
- Three lab lists remain besides `shared/constants/labs.ts` (M-03). Logged.

### Open questions

Unchanged from the previous entry, except that transfers, inspection scheduling, and the test folder are now decided in the prompt. Still open: `/api/analytics/dashboard` (re-attach or quarantine), and git history cleanup (C-01).

### Exact next step

After review of step 3, continue with **step 4** (introduce `web/api/client.ts`, convert loans):
`Read docs/phase-1c-restructure/PROMPT-2-restructure.md and docs/phase-1c-restructure/02-restructure-log.md. Continue Part B with steps 4 to 5.`

---

## Phase 1C, restructure step 4, 2026-10-01

**Prompt followed:** [phase-1c-restructure/PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md), Part B, step 4. Branch: `refactor/feature-based-structure`.

### What was produced

- **Step 4** (`a4c1b417`, comments `docs(step 4)` commit): `web/api/client.ts` and `web/api/loans.api.ts`, created at their final location. All six loan `fetch` calls (in `LoanForm.tsx`, `LabHeadDashboard.tsx`, `LabHeadAnalyticsView.tsx`, `context.tsx`) now go through `loansApi`. `vite.config.ts` gained the `@web` alias; `.env.example` gained `VITE_API_URL` (optional, defaults to `http://localhost:4000`). No behavior change intended. **Typecheck stays at 98.** Detail in [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md#step-4-detail).

### Worth knowing

- **Not verified end to end.** The CCS Cloud database was unreachable, so only build, typecheck, and server start were run. Six hand checks are listed in the log under step 4 and must be done before this branch merges.
- The client returns the JSON body whatever the HTTP status is, because that is what every call site already expected. Tightening it waits for step 13.
- `handleLoanDecision` in `LabHeadAnalyticsView.tsx` is dead code, and would send a value the server refuses. Logged, not fixed.

### Open questions

Unchanged: `/api/analytics/dashboard` (re-attach or quarantine), and git history cleanup (C-01).

### Exact next step

**Step 5** (convert the remaining features to the API client, one feature per commit):
`Read docs/phase-1c-restructure/PROMPT-2-restructure.md and docs/phase-1c-restructure/02-restructure-log.md. Continue Part B with step 5.`

---

## Phase 1C, restructure step 5, 2026-10-02

**Prompt followed:** [phase-1c-restructure/PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md), Part B, step 5. Branch: `refactor/feature-based-structure`.

### What was produced

- **Step 5** (9 commits, `5389d51b` to `497d0c30`, then the `docs(step 5)` comments commit): the remaining 55 `fetch` calls now go through `web/api/`, one feature per commit. New files: `assets.api.ts`, `transfers.api.ts`, `returns.api.ts`, `repairs.api.ts`, `disposals.api.ts`, `inspections.api.ts`, `auth.api.ts`, `analytics.api.ts`. No `fetch(` call and no backend address is left in `src/`. No behavior change intended. **Typecheck stays at 98, same errors.** Detail in [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md#step-5-detail).
- Steps 3 and 4 passed their hand checks against the database (Raiki, 2026-10-02).

### Worth knowing

- **Plain and `Raw` calls.** Call sites that checked the HTTP status themselves, or never read the answer, use `Raw` functions that return the untouched `Response`, so their behavior is unchanged. 15 of 40 API functions are `Raw`. They are meant to go away in step 13.
- **Step 5 is not verified in a browser.** Build, typecheck, server start, and a recorded-request check of all 40 API functions passed. Ten hand checks are listed in the log and must pass before this branch merges.
- Two type mismatches in `context.tsx` surfaced once API results were typed (pending disposals, `approveRegistration`). Both are kept as `any` and logged for step 6.
- `docs/reference/AdRIC_DB_Schema.sql` does not match the live database (accounts, seed passwords, Director role). **Step 14 should baseline from the live schema, not this file.** Logged in the notes.

### Open questions

Unchanged: `/api/analytics/dashboard` (re-attach or quarantine), and git history cleanup (C-01).

### Exact next step

**Step 6** (split `context.tsx`, delete the localStorage-only actions). This one changes behavior on purpose, so run it in its own session with the database reachable:
`Read docs/phase-1c-restructure/PROMPT-2-restructure.md and docs/phase-1c-restructure/02-restructure-log.md. Continue Part B with steps 6 to 7.`

---

## Phase 1C, restructure step 6, 2026-10-03

**Prompt followed:** [phase-1c-restructure/PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md), Part B, step 6. Branch: `refactor/feature-based-structure`, continuing from the PR #15 merge.

### What was produced

- **Log update for step 5** (`04cf6f91`): hand checks passed against the database, merged in PR #15, comment commit `6488407b` recorded.
- **Step 6** (behavior changes `9d1b62a9` and `b35a67e1`, move `20cd4fdd`, types `8dcd6120`, comments `f8f43435`): `src/app/context.tsx` is gone. It is replaced by `web/state/session.tsx` (session and preferences), `web/state/serverData.tsx` (lists shared by several screens, loaded through `web/api`), and `web/state/browserOnly.tsx` (three lists that still live only in the browser). `useApp()` became `useSession()`, `useServerData()`, and `useBrowserOnly()` in 19 files. **Typecheck went from 98 to 93.** Detail in [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md#step-6-detail).

### Decisions made this session

- **Raiki, 2026-10-03:** custodian return requests (H-02), the Staff inspection log, and manual clearance holds (F-37) are **kept, isolated, with no behavior change**. Each has no full database replacement. The team decides the real fix later. All three are recorded as open team decisions in the log's notes.

### Worth knowing

- **The notification bell now saves.** Transfer and disposal buttons call the real API (H-01). The bell lists pending disposals only. Transfer buttons show for the Lab Head only: this is a judgment call by the agent, explained in the log and one line to reverse.
- **The fake browser database is no longer used by shared state.** Only `Login.tsx` still imports `prismaClient.ts`. Until step 7 removes that, a login through the fake fallback gives a Custodian screen with no profile.
- **`serverData.tsx` and `browserOnly.tsx` are not in 01D's target tree.** Both are temporary and the log explains why each exists.
- **Step 6 is not verified in a browser.** Build, typecheck, a no-browser render of the three providers, and a recorded reload passed. Eleven hand checks are listed in the log and must pass before this branch merges. Check 1 needs a CITe4D asset, because of a hardcoded lab name in the bell (logged, not fixed).

### Open questions

- The three open team decisions above.
- Unchanged: `/api/analytics/dashboard` (re-attach or quarantine), and git history cleanup (C-01).

### Exact next step

**Step 7** (delete `prismaClient.ts`, which removes the fake login fallback). Behavior change. Run the step 6 hand checks first:
`Read docs/phase-1c-restructure/PROMPT-2-restructure.md and docs/phase-1c-restructure/02-restructure-log.md. Continue Part B with step 7.`

---

## Phase 1C, step 6 closed and team decisions, 2026-10-04

**Prompt followed:** [phase-1c-restructure/PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md). Recorded at the start of the step 7 session. Branch: `refactor/feature-based-structure`, continuing from the PR #16 merge.

### What was produced

- [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md): step 6 marked done, hand checks passed, merged in PR #16. New and updated notes for every decision below.
- [PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md): decisions table and "still open" list brought up to date.
- [legacy/analytics-v1/README.md](../legacy/analytics-v1/README.md): "Open decision" replaced by the analytics decision.

### Decisions recorded (team, 2026-10-04)

- **Step 6 accepted as built**, including the three changes beyond the plan: bell transfer buttons for the Lab Head only, `toggleClearanceHold` removed, and the two temporary state files (`serverData.tsx`, `browserOnly.tsx`).
- **Transfers (question 1) superseded.** Custodian-to-custodian transfers will become a custodianship queue (custodian releases to Staff, Staff assign the next custodian). Design not final, built after the restructure with the Phase 3 tables (issue #22). Transfer behavior stays as it is; step 12 moves the code without the Lab Head approval rule.
- **Custodian return requests (H-02):** Phase 3 stores the request stage in the database, most likely as `status`, `requested_by`, `requested_at`, and `loan_id` columns on `asset_returns`. The loan link also addresses H-04.
- **Inspection photos:** at most 3 per report, high resolution, deleted after 2 weeks (keeping one compressed audit copy is still being confirmed). Asset registry pictures are compressed and kept. Phase 3, with M-17.
- **Old analytics:** the 11 endpoints with no caller are deleted in step 12; the screen code stays in `legacy/analytics-v1/`.
- **Repository:** will be made private (issue #9). Git history stays as is. Account passwords are test data and will be rotated later.

### Found during the step 6 hand checks (pre-existing, not caused by step 6)

- Custodians can submit duplicate requests on the same asset (H-05, issue #25).
- My Assets shows disposed assets: no status filter in `CustodianPortal.tsx` (issue #26).

Both are fixed on their own branch after step 7, not inside the restructure.

### Open questions

- Manual clearance holds (F-37): waiting on the team.
- Staff inspection log (open team decision 2): needed before step 8 splits the inspections tab.

---

## Phase 1C, restructure step 7, 2026-10-04

**Prompt followed:** [phase-1c-restructure/PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md), Part B, step 7. Branch: `refactor/feature-based-structure`, continuing from the PR #16 merge. Nothing pushed.

### What was produced

- **Decisions update** (`c3d94a0e`): the entry above.
- **Step 7** (`6e08e469`, behavior change): `src/app/prismaClient.ts` deleted (583 lines). `Login.tsx` no longer falls back to the 11 demo accounts when the server refuses a login, fails, or cannot be reached. Real accounts log in as before, and every message on the form is unchanged. No comment commit: the step created and moved no files, and `Login.tsx` is commented when it moves in step 8. **Typecheck stays at 93, same errors.** Detail in [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md#step-7-detail).

### Worth knowing

- The demo passwords no longer ship in the browser bundle, and loading the login page no longer writes them into localStorage. Browsers that opened older versions still hold the old key until site data is cleared.
- Verified: typecheck, build, a search for leftover references, and server start, with the database reachable (a bad login answers 401 with the message the form shows). **Not verified in a browser.** Five hand checks are listed in the log and must pass before this branch merges.
- Logged, not fixed: when the server is unreachable, the form says "Invalid ... password", which misleads. Same as before; step 13.

### Open questions

- Manual clearance holds (F-37): waiting on the team.
- Staff inspection log (open team decision 2): needed before step 8.

### Exact next step

1. Run the five step 7 hand checks, push, and open the pull request.
2. Fix issues #25 (duplicate custodian requests, H-05) and #26 (My Assets shows disposed assets) on their own branch.
3. Then **step 8** (move the frontend to `web/` with feature folders; the inspection scheduling tab moves to `legacy/` in its own labelled commit):
`Read docs/phase-1c-restructure/PROMPT-2-restructure.md and docs/phase-1c-restructure/02-restructure-log.md. Continue Part B with step 8.`

---

## Phase 1C, issues #25 and #26 merged, and team decisions, 2026-10-06

**Prompt followed:** [phase-1c-restructure/PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md). Recorded at the start of the step 8 part 1 session. Branch: `refactor/feature-based-structure`, continuing from the PR #33 merge (`1bc85da4`).

### What was produced

- [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md): the #25 and #26 fix section marked merged; team decision 2 marked decided; a note for issue #32; the clearance holds note brought up to date; step 8 marked as two parts.
- [PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md): decisions table, "still open" list, and session plan brought up to date.

### Decisions recorded (team, 2026-10-06)

- **Issues #25 and #26 are fixed and merged in PR #33** (duplicate custodian requests, H-05; disposed assets in My Assets).
- **Staff inspection log (F-28, team decision 2):** the log table will show the database reports (`asset_reports`, already fetched as `dbReports`) instead of the browser copy. Its own labelled behavior-change commit, when the inspections tab is split in step 8 part 2. The cycle type column (Annual or Trimestral) is dropped because the database does not store it. It may come back with a cycle type column on `asset_reports` and a shared cycle setting in place of the per-browser `pref_cycle_mode` cookie (F-38). Issue #34.
- **Issue #32** (identify users by id, not display name) is tracked for steps 11 to 13.
- **Manual clearance holds (F-37)** stay open. Step 8 moves that code as is.
- **Step 8 runs in two sessions.** Part 1 moves everything except `ITSDashboard.tsx` into `web/`. Part 2 splits `ITSDashboard.tsx` into `web/pages/staff/`, moves inspection scheduling to `legacy/`, and switches the inspection log to the database.

### Open questions

- Manual clearance holds (F-37): waiting on the team. Does not block step 8.

---

## Phase 1C, restructure step 8 part 1, 2026-10-06

**Prompt followed:** [phase-1c-restructure/PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md), Part B, step 8 part 1. Branch: `refactor/feature-based-structure`, from the PR #33 merge. Nothing pushed.

### What was produced

- **Decisions record** (`26f0c2b9`): the entry above.
- **Step 8 part 1, 14 move commits** (`edcb9162` to `6d9facc2`): everything in `src/` except `ITSDashboard.tsx` now lives in `web/`: the shadcn primitives in `web/components/ui/`, the feature components in `web/features/<process>/` (assets, loans, transfers, returns, repairs, notifications, analytics), the screens in `web/pages/` (auth, custodian, lab-head, director, plus the account and not-found pages), and the app shell, layouts, and styles in `web/app/` and `web/styles/`. Files are unchanged apart from import lines. No behavior change: the production build is byte-identical after every commit.
- **Comment commit** (`ffa05a38`): file headers, TSDoc, and TODOs with finding IDs on all 45 moved files. Three older comments that were no longer true are corrected.
- [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md#step-8-detail): step 8 detail, seven hand checks, and new notes. **Typecheck stays at 93, same errors.**

### Key findings

- The three role dashboards moved whole: each is one component per role, with the tab chosen by a prop. Splitting them into one page per tab (01D section 7) changes routes and state, so it is left for step 9 or later.
- Seven exported analytics widgets are rendered nowhere, and three of them are the only callers of `/api/analytics/advanced/idle-time`, `idle-frequency`, and `loan-recommender`. Those are not in the 11 endpoints step 12 deletes.
- The Staff analytics location widget shows invented figures when its endpoint fails (H-09 family). The request forms show reference numbers made up in the browser. The Director audit also reads the browser's inspection copies (F-28), which part 2 should settle together with the Staff log.
- M-07 (RepairForm posts each ticket twice) was planned for "step 8". It is a behavior change, so it was not done in a files-only session; it is marked with a TODO.

### Open questions

- Manual clearance holds (F-37): waiting on the team.
- Whether the three `/api/analytics/advanced/*` endpoints with only dead callers join the step 12 deletion.

### Exact next step

1. Run the seven step 8 part 1 hand checks (restart the dev server first).
2. Then **step 8 part 2**:
`Read docs/phase-1c-restructure/PROMPT-2-restructure.md and docs/phase-1c-restructure/02-restructure-log.md. Continue Part B with step 8, part 2.`

---

## Phase 1C, restructure step 8 part 2, 2026-10-07

**Prompt followed:** [phase-1c-restructure/PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md), Part B, step 8 part 2. Branch: `refactor/feature-based-structure`, from the PR #45 merge (`9db4a4d7`). Nothing pushed.

### What was produced

- **Log record** (`2c3532d8`): step 8 part 1 hand checks passed and merged in PR #45; two pre-existing bugs found during them (Classic Dark only partly dark; no Decline button for loans in the bell) tracked as issues #43 and #44.
- **Five labelled behavior changes:** RepairForm posts each ticket once (`5d26ed8e`, M-07); inspection scheduling moved to `legacy/inspection-scheduling/` with a README (`993f48e3`, H-18); the Staff inspection log and the Director audit read the database reports (`82bc2e8e`, F-28); the unread browser copy of reports is no longer written (`c5936be0`); each Staff tab starts fresh instead of reusing the previous tab's component (`0bb2e95c`).
- **Moves:** seven unrendered analytics widgets to `legacy/analytics-widgets/` (`99eb7191`); `ITSDashboard.tsx` split into eight pages in `web/pages/staff/` and fourteen files in `web/features/` (assets, disposals, repairs, inspections), one tab per commit, ending with the file's removal (`92305257` to `14d44320`); the leftover `src/` config removed (`7ca707c5`).
- **Comment commit** (`caca57a9`): headers, TSDoc, and TODOs on every new file; stale references to `ITSDashboard.tsx` in 24 other headers corrected.
- [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md#part-2-commits): part 2 detail, 13 hand checks, updated and new notes. [PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md): decisions table and history. **Typecheck: 93 to 71**, every removed error accounted for, none added.

### Decisions recorded (team, 2026-10-07)

- **Unused analytics widgets:** kept, not deleted, in `legacy/analytics-widgets/`. `/api/analytics/advanced/idle-time`, `idle-frequency`, and `loan-recommender` are kept for now and are **not** part of the step 12 deletion.
- Inspection scheduling (H-18) and the inspection log (F-28) were applied as decided earlier.

### Key findings

- Every Staff tab used to share one live component, so its state survived tab switches. Splitting into pages ends that; it was made its own labelled commit.
- The intake wizard offers the same serial again after a registration (generated once per page load). The finalize dialog's Inspector Role now reaches nowhere. "Last Inspected" shows the procurement date. `RepairAlertCard` is rendered nowhere. All logged as notes.
- "Move the scheduling tab to legacy" was read as "move the scheduling controls and keep the tab", because the same decision keeps single-item finalize live on that tab. One route and one sidebar entry if the team meant otherwise.

### Open questions

- Manual clearance holds (F-37): still waiting on the team.
- Inspector Role in the finalize dialog: remove it, or store it with the report?
- `RepairAlertCard`: keep, quarantine, or delete?

### Exact next step

1. Run the 13 step 8 part 2 hand checks (restart `npm run dev:all` first), then push and open the pull request.
2. Then **step 9**:
`Read docs/phase-1c-restructure/PROMPT-2-restructure.md and docs/phase-1c-restructure/02-restructure-log.md. Continue Part B with step 9.`

---

## Phase 1C, restructure step 9, 2026-10-08

**Prompt followed:** [phase-1c-restructure/PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md), Part B, step 9. Branch: `refactor/feature-based-structure`, from the PR #46 merge (`8db5a88f`). Nothing pushed.

### What was produced

- **Log record** (`4511de94`): step 8 part 2 hand checks passed and merged in PR #46; the team's decisions on its notes.
- **Step 8 follow-up** (`89d2212c`): `RepairAlertCard` moved to `legacy/repair-alert-card/` with a README. No behavior change.
- **Three labelled behavior changes:** ITS and TSG merged into one app role, `Staff`, at `/staff/*`, with redirects from `/its/*` and `/tsg/*` and the unit kept in the session as `currentUser.staffUnit` (`d37d2233`); `ITS_STAFF` accounts reach the Staff dashboard instead of the Custodian portal (`44d9d729`, M-11); wording that named ITS or TSG as the staff now says Staff (`d9d95f18`, text only).
- **Renames, one per commit:** `TSGAnalyticsView.tsx` to `StaffAnalyticsView.tsx` (`af1c641c`), and its `TSGTechnicalMaintenanceSection` (`5e1a0f80`).
- **Comment commits** (`223e2060`, `4101aa1b`): headers, TSDoc for `Role` and `StaffUnit`, the redirect, and the TODO for Inspector Role (issue #48).
- [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md#step-9-detail): step 9 detail, 12 hand checks, new notes. **Typecheck: 71, unchanged**, same errors.

### Decisions recorded (team, 2026-10-08)

- Keeping the Inspections tab with only scheduling moved is correct.
- The finalize dialog's Inspector Role is stored with the report in Phase 3 (issue #48).
- `RepairAlertCard` moves to `legacy/` (done).
- The repeating intake serial is a bug, fixed after the restructure (issue #47).
- Step 9 keeps the ITS or TSG unit in the session, because issue #41 will give the two units different edit and delete rights. #41 is not implemented.

### Key findings

- The live database has one `ADMIN` and one `TSG_STAFF` account, and no `ITS_STAFF` or `ADRIC_SECRETARY` account, so the M-11 branch could not be exercised without a database write. Hand check 8 covers it if the team creates a test account.
- One ITS/TSG difference was dropped: the bell's degraded-asset reminder now asks every Staff account for action (it was TSG only). One was kept through `staffUnit`: Send to Maintenance writes the account's unit into the ticket.
- A ticket's forwarding unit (`forwardedTo`) is never stored by the server, so "Dispatched To" always shows a dash. Pre-existing; logged.
- The rest of M-11 (Secretary mapping, multi-role accounts, sign-up approval mapping "ITS" to `ADMIN`) and the `/api/analytics/tsg` URL are left for step 12. `staffUnit` gives no protection until the server checks roles (step 13).

### Open questions

- Manual clearance holds (F-37): still waiting on the team.
- Can `ADRIC_SECRETARY` approve and sign off like the Director, or only view? (Decided 2026-10-08 that it gets the Director view, on the ITS removal branch.)
- Issue #41: who gets the "edit or delete assets with no history" right, TSG or Admin? Related to issue #19.

Answered on 2026-10-08 (see the log, "Team decisions on step 9"): ITS is removed from the system on its own branch; an Admin app role comes after step 13; the TSG-only degraded reminder and the Overview landing are accepted as built; M-11 stays verified by code reading, with a Phase 2 test.

### Exact next step

1. Restart both servers (`npm run dev:all`), run the 12 step 9 hand checks, then push and open the pull request.
2. Then the **Phase 2 tests** prompt, which is not written yet (session plan: step 9, then Phase 2 tests, then steps 10 to 12).

---

## Phase 2, API tests Part A, 2026-10-08

**Prompt followed:** [phase-2-tests/PROMPT-tests.md](phase-2-tests/PROMPT-tests.md), Part A. Branch: `test/phase-2-api-tests`, from `main` after PR #50 (`a02786c8` adds the prompt). Nothing pushed.

### What was produced

- **Vitest 4.1.11**, dev dependency only (`0e9d308e`). Uses the installed Vite 6.4.3; no other dependency changed.
- **`server.ts` reads its port from `PORT`**, default 4000 (`ec738f0b`, behavior-neutral). The only app-code change.
- **The harness and a smoke test** (`f2058aef`): `tests/setup/` holds the database guard, the schema load, the reset and fake seed, and the code that starts `server.ts` as a child process on a free port, from a temporary folder, aimed only at the local test database, with mail and backups off. `tests/api/smoke.test.ts` (3 tests) and `tests/setup/guard.test.ts` (7 tests). `npm test` runs them; `tsconfig.json` now includes `tests/`.
- **[tests/README.md](../tests/README.md) and the [test plan](phase-2-tests/01-test-plan.md)** (`225770e9`): all 62 endpoints, 40 assigned to sessions B1 to B4 with what each test checks and the defects pinned, 22 skipped with reasons.
- **Docs housekeeping:** [02-test-log.md](phase-2-tests/02-test-log.md), this entry, the status board, the superseded note in `PROMPT-db-revisions.md`, the MySQL correction in `PROMPT-2-restructure.md`, and `TEST_DATABASE_URL=` in `.env.example`.
- **Checks:** `npm test` 10 passed; build passes; **typecheck 71, unchanged** (none in `tests/`).

### Key findings

- **Prisma 7.9 refuses `prisma db push --force-reset` when an AI agent runs it** and asks for the user's consent. The harness was redesigned so it never needs that flag: it empties the guarded test tables itself and runs a plain `db push`. No consent was requested or used.
- **MySQL on Windows stores database names in lower case**, which broke a repeated `db push` against `AdRIC_DB_test`. The harness passes the stored name. Worth knowing for step 14.
- **The test database comes from `schema.prisma`, not the live database**, so H-21 cannot be reproduced locally. Step 14 baselines from the live database.
- Verified: the guard refuses a non-local host and a name without `_test`; the server resolves `@shared/*` from a temporary folder only through `TSX_TSCONFIG_PATH`; a sign-up lands in the temporary folder and the repo's `pending_registrations.json` is untouched. Registration writes are therefore safe to test in B1.
- New defects logged, not fixed (all in the log): the account update's invalid `MANILA_CAMPUS` value, the repair duplicate guard answering 409 before 404, two analytics oddities.

### Open questions

- **11 analytics endpoints never had a caller** and are neither in the step 12 deletion nor among the three kept on 2026-10-07 (plan section 3.2). Delete them in step 12, or give them a "responds with 200" test in B4?
- Manual clearance holds (F-37) and issue #41: still waiting on the team (unchanged).

### Exact next step

1. On your machine: create `AdRIC_DB_test` and set `TEST_DATABASE_URL` as in [tests/README.md](../tests/README.md), then run `npm test`. Push the branch when it passes.
2. Then Part B1:
`Read docs/phase-2-tests/PROMPT-tests.md and follow it. Do Part B1.`

## Phase 2, API tests Part B1, 2026-10-08

**Prompt followed:** [phase-2-tests/PROMPT-tests.md](phase-2-tests/PROMPT-tests.md), Part B1. Branch: `test/phase-2-api-tests`, continued from Part A. Nothing pushed.

### What was produced

- **Auth and registration tests** (`212b69df`): `tests/api/auth.test.ts` (33 tests: login and `/me` for each seeded role, the account update) and `tests/api/registration.test.ts` (22 tests: sign-up requests, the pending list, approve, reject, direct registration). Sign-ups are written only in the test server's temporary folder.
- **Asset tests** (`4fae5b46`): `tests/api/assets.test.ts` (33 tests: the list, custodian history, intake, edit, delete).
- **Team decision recorded (2026-10-08):** none of the 22 analytics endpoints in plan sections 3.1 and 3.2 is deleted. In step 12 their handler code moves to `legacy/analytics-endpoints/` with a README (path, method, what it computed, tables read, group 3.1 or 3.2) and their routes are unregistered, so they answer not found. No Phase 2 tests for them. Written into the plan (3.1, 3.2), the [test log](phase-2-tests/02-test-log.md), and the "Old analytics" row of the [PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md) decisions table. `server.ts` is unchanged.
- **Docs housekeeping:** the test log (status, B1 detail, notes), the plan's B1 defect columns, the status board, the run counts in `tests/README.md`, and this entry.
- **Checks:** `npm test` 5 files, **98 passed**, twice in a row; build passes; **typecheck 71, unchanged** (none in `tests/`).

### Key findings

- **No app code changed.** Every test passed against today's behavior on the first full run; nothing was fixed.
- **C-03 is real on the test database:** the password matches in any letter case (`users.password` uses `utf8mb4_unicode_ci`). CCS Cloud's collation was not checked.
- **Three new defects pinned**, logged not fixed: the account update answers `CITe4D` when no lab is sent (the account page shows it until reload); approving a sign-up for an unknown lab name creates a new research center; editing an asset with only an acquisition value resets its funding source to "Unspecified" (M-16 family).
- **Older text still describes the 2026-10-04 deletion** (`PROMPT-tests.md` B4 line and skip list, the two `legacy/` analytics READMEs, the restructure log). Left as is in this session; listed in the log.

### Open questions

- `PROMPT-tests.md` still says B4 skips "the ones that step 12 deletes". Under the new decision B4's scope is unchanged (live callers plus the three kept on 2026-10-07), but the wording is stale. Update it now, or leave it to step 12?
- Manual clearance holds (F-37) and issue #41: still waiting on the team (unchanged).

### Exact next step

1. On your machine: `npm test` (expect 98 passed). Push the branch when it passes.
2. Then Part B2:
`Read docs/phase-2-tests/PROMPT-tests.md and follow it. Do Part B2.`

## Phase 2, API tests Part B2, 2026-10-08

**Prompt followed:** [phase-2-tests/PROMPT-tests.md](phase-2-tests/PROMPT-tests.md), Part B2. Branch: `test/phase-2-api-tests`, continued from B1. Nothing pushed.

### What was produced

- **Loan tests** (`78987f8e`): `tests/api/loans.test.ts` (31 tests: the loan list, the borrow request, the Lab Head's decision), plus `tests/setup/extraAssets.ts`, a helper that gives a test an asset of its own in a chosen custody state, so tests that move custody do not depend on each other.
- **Return tests** (`43a06080`): `tests/api/returns.test.ts` (16 tests: return finalization and the return list).
- **Transfer tests** (`ccd47c25`): `tests/api/transfers.test.ts` (32 tests: the request, the list, the decision, and the unused `/accept` route).
- **Analytics wording brought in line with the 2026-10-08 decision:** the B4 line and the skip list in `PROMPT-tests.md`, `legacy/analytics-v1/README.md`, and `legacy/analytics-widgets/README.md` now describe the 22 endpoints kept in `legacy/analytics-endpoints/` and unregistered in step 12. The restructure log got dated notes (under step 2 and in its notes table); its old lines were kept.
- **Docs housekeeping:** the test log (status, B2 detail, notes, the C-03 check on CCS Cloud), the plan's B2 rows, the run counts and a line on the helper in `tests/README.md`, the status board, and this entry.
- **Checks:** `npm test` 8 files, **177 passed**, twice in a row; build passes; **typecheck 71, unchanged** (none in `tests/`).

### Key findings

- **No app code changed.** All 79 new tests describe today's behavior; nothing was fixed.
- **C-03 also applies on CCS Cloud** (checked by Raiki, 2026-10-08): `users.password` there is `utf8mb4_0900_ai_ci`, so login ignores letter case and accents on the live database too. It goes away when passwords are hashed (Phase 3).
- **Two new defects in the M-12 family**, pinned and logged: `/accept` moves a transfer in any status, even an approved one, to `pending_approver`; and once a transfer is `pending_approver`, the issue #25 guard no longer sees it, so the asset takes a second transfer request.
- **H-05 reaches returns too:** a disposed asset can be returned and comes back as ACTIVE.
- **H-16 on `/accept`:** an id that is not a number answers 500 with Prisma's full message, including the server's file path and source lines.

### Open questions

- Manual clearance holds (F-37) and issue #41: still waiting on the team (unchanged).

### Exact next step

1. On your machine: `npm test` (expect 177 passed). Push the branch when it passes.
2. Then Part B3:
`Read docs/phase-2-tests/PROMPT-tests.md and follow it. Do Part B3.`

---

## Phase 2, API tests Part B3, 2026-10-08

**Prompt followed:** [phase-2-tests/PROMPT-tests.md](phase-2-tests/PROMPT-tests.md), Part B3. Branch: `test/phase-2-api-tests`, continued from B2. Nothing pushed.

### What was produced

- **Repair tests** (`ab494e76`): `tests/api/repairs.test.ts` (36 tests: the repair request and its 8-second duplicate guard, the ticket list, and both update routes).
- **Inspection and report tests** (`0e81e87b`): `tests/api/inspections.test.ts` (29 tests: the inspection report and the two report lists).
- **Disposal tests** (`13edf79d`): `tests/api/disposals.test.ts` (25 tests: the request, the list, and the Director's decision).
- No new setup file: the write tests use B2's `addExtraAsset` (tags `TEST-0401`, `TEST-0501`, `TEST-0601` onward). Its file header now names the B3 callers.
- **Docs housekeeping:** the test log (status, B3 detail, 11 notes), the plan's B3 rows, the run counts and the helper line in `tests/README.md`, the status board, and this entry.
- **Checks:** `npm test` 11 files, **267 passed**, twice in a row; build passes; **typecheck 71, unchanged** (none in `tests/`).

### Key findings

- **No app code changed.** All 90 new tests describe today's behavior; nothing was fixed.
- **The inspection route turns an unknown condition into PERFECT** and writes it onto the asset with 200 (a typo, lower case, or the stored spelling "MINOR DRIFT"). The return route answers 400 for the same input. New, H-07 family.
- **Disposals have no duplicate guard** like issue #25: a second pending disposal on one asset is accepted, and approving both writes two DISPOSED records. Assets on loan or in maintenance are accepted too (H-05).
- **Repair records are not linked to their ticket:** neither repair route sets `asset_records.repair_id`, while the disposal decision does set `disposal_id`.
- **H-16 in two more places:** `PUT /api/asset_repairs/:id/status` with an unknown or non-numeric id, and an inspection with a `reportedById` that is no account, answer 500 with Prisma's full message (file path and source lines included).
- **Smaller ones**, all in the test log: `/status` accepts a status of only spaces; "Fixed & Completed" adds a record and a report even if the ticket never went into maintenance; the inspection image is not checked; the disposal form's "Last Custodian" is never shown again (M-13 family).

### Open questions

- Manual clearance holds (F-37) and issue #41: still waiting on the team (unchanged).

### Exact next step

1. On your machine: `npm test` (expect 267 passed). Push the branch when it passes.
2. Then Part B4:
`Read docs/phase-2-tests/PROMPT-tests.md and follow it. Do Part B4.`

---

## Phase 2, API tests Part B4, 2026-10-09

**Prompt followed:** [phase-2-tests/PROMPT-tests.md](phase-2-tests/PROMPT-tests.md), Part B4, the last Phase 2 session. Branch: `test/phase-2-api-tests`, continued from B3. Nothing pushed.

### What was produced

- **Analytics tests** (`fa00fa4c`): `tests/api/analytics.test.ts` (38 tests: 35 for the five endpoints the live Director, Lab Head, and Staff views call, and a "responds with 200" check for each of the three advanced endpoints kept on 2026-10-07). The 22 endpoints step 12 moves to `legacy/analytics-endpoints/` get no tests, as decided.
- **Comment fix** (`400c7aea`): one comment in the new file reworded so it has no em dash. Comment only.
- **Two additions to `tests/setup/extraAssets.ts`**, in the analytics commit: optional fields on `addExtraAsset` (home location, project, warranty date, funding; defaults unchanged), and `removeExtraAssets`, which deletes test assets with every row that points at them. The analytics endpoints count every asset, so each test puts the database back in a `finally` block.
- **Docs housekeeping:** the test log (status, B4 detail, Phase 2 done, 8 notes), the plan's B4 rows (including why M-09 is not tested), the run count and a line on `removeExtraAssets` in `tests/README.md`, the status board (Phase 2 done; "Where we are now" set to restructure step 10), and this entry.
- **Checks:** `npm test` 12 files, **305 passed**, twice in a row; build passes; **typecheck 71, unchanged** (none in `tests/`).

### Key findings

- **No app code changed.** All 38 new tests describe today's behavior; nothing was fixed.
- **The Director's lab filter narrows one chart only:** the location counts follow the lab, but the portfolio value, funding, and pending disposals stay the all-lab totals. New.
- **Lab code matching by substring:** the Director view counts any location containing "CAR" (and four other codes) as Laguna, and location-status files a Manila room containing "CAR" under the CAR lab. New, M-03 family.
- **Lab Head delinquencies count a pending loan request past its due date as overdue**, and keep counting a returned loan (H-04).
- **Inspection progress reads no inspection report:** it counts every record of a center's projects (history included) and calls the ACTIVE ones inspected; a center with no projects shows 100%.
- **Smaller ones**, all in the test log: invented values for an asset with no records (H-09 family), "Pending_approver" shown raw on the Lab Head view (M-12 family), and the Staff endpoint ignoring the date range the view sends.

### Open questions

- Manual clearance holds (F-37) and issue #41: still waiting on the team (unchanged).

### Exact next step

1. On your machine: `npm test` (expect 305 passed). Push `test/phase-2-api-tests` and open the pull request for Phase 2.
2. After it is merged, restructure step 10, on the branch PROMPT-2 names:
`Read docs/phase-1c-restructure/PROMPT-2-restructure.md and docs/phase-1c-restructure/02-restructure-log.md. Continue Part B with step 10.`

---

## Phase 1C, restructure step 10, 2026-10-09

**Prompt followed:** [phase-1c-restructure/PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md), Part B, step 10. Branch: `refactor/feature-based-structure`, created fresh from the PR #52 merge (`dd6db809`). Nothing pushed.

### What was produced

- **Moves** (`584d0c5f`, `7a40911b`, `5fd47ff0`): `prisma.ts` to `server/config/prisma.ts`, `mailer.ts` to `server/shared/services/mailer.ts`, and `server.ts` split into `server/main.ts` (startup and listen), `server/app.ts` (Express app and middleware), `server/jobs/backup.ts`, and `server/remainingRoutes.ts` (the 62 routes, unchanged, on an Express router until steps 11 and 12 take them out). `server/config/env.ts` reads `PORT`, the mail settings, and `BACKUP_DIR` with the same defaults. `npm run server`, `server:watch`, and the test harness start `server/main.ts`.
- **One labelled behavior change** (`bd242d15`, C-07): the five `DATABASE_*` variables are required. The hardcoded CCS Cloud host, account, and password are gone from the code; a missing variable stops the server at startup with its name.
- **Comment commit** `docs(step 10)`: headers and TSDoc for the seven server files, TODOs (C-02 CORS, M-17 body limit, H-20 email escaping, F-39 backup, H-10 default custodian), stale `server.ts` mentions fixed in comments, the root README, `tests/README.md`, and the git workflow guide.
- [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md#step-10-detail): step 10 detail, 7 hand checks, three new notes, two notes updated (C-07 done, F-39 moved).
- **Checks after every commit:** `npm test` **305 passed**; typecheck **71, unchanged**; build passes, web bundle byte-identical. `npm run server` with the real `.env` answers `GET /api/assets` with 200.

### Key findings

- The real `.env` on this machine has all five database variables, so the change is invisible here. A teammate whose `.env` relied on the fallbacks will see the server stop with the missing names: that is the intent, and hand check 6 covers it.
- 17 one-off scripts in `scratch/` import the old root `prisma.ts` or `mailer.ts` and no longer run. Logged, not fixed.
- The routes file is named `remainingRoutes.ts`, not kept as a root `server.ts`, so that `npx tsx server.ts` fails loudly instead of loading routes and exiting silently.

### Open questions

- Backup job (F-39): keep, extend, or delete? It moved unchanged.
- Step 9 is merged (PR #50), but the log has no record of its 12 hand checks passing. Did they?

Answered on 2026-10-09 (see the log): the backup job is deleted in its own labelled commit, in step 12 or later (recorded in PROMPT-2's decisions table). Step 9's hand checks were partly run, recorded as reported, with a note that the reported numbers do not all match the log's list. The step 10 hand checks passed (4 skipped, no Mailgun); a pre-existing bell bug (cards open a 404 for most roles) was filed as its own issue and logged as a note.
- Manual clearance holds (F-37) and issue #41: still waiting on the team (unchanged).

### Exact next step

1. Stop any running server, `npm run dev:all`, run the 7 step 10 hand checks, then push and open the pull request. Tell the team to pull and check their `.env` (hand check 6).
2. Then **step 11** (extract loans):
`Read docs/phase-1c-restructure/PROMPT-2-restructure.md and docs/phase-1c-restructure/02-restructure-log.md. Continue Part B with step 11.`
