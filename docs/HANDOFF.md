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
