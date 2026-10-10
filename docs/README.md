# Docs index

Start here. This page tells you where every document lives, what phase the project is in, and which prompt to run next.

## Where we are now

**Current phase:** 1C, restructure, backend split (step 12 batch 1 done: returns, transfers, disposals; all 9 hand checks passed).
**Next prompt to run:** first open the step 12 batch 2 pull request (repairs and inspections; branch pushed, all 9 hand checks passed, [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md#batch-2-repairs-and-inspections-2026-10-10)), and decide on the three proposals listed there (M-07, H-06, L-07). Then `phase-1c-restructure/PROMPT-2-restructure.md`, the next batch of step 12, in the order of [01D section 9](phase-1b-deep-map/01D-restructure-plan.md): registrations, auth, assets, analytics. Name the features in the first message, for example `Read docs/phase-1c-restructure/PROMPT-2-restructure.md and docs/phase-1c-restructure/02-restructure-log.md. Continue Part B with step 12, batch 3: registrations and auth.` Step 12 must keep `npm test` at 305 passed and the typecheck at 71.
**Who does what next (decided 2026-10-09):** Raiki finishes the restructure, through step 14 (baseline migrations and `prisma/seed.ts`). The team then does Phase 3 (schema changes, stored procedures, and triggers) on top of the step 14 baseline, as migration files in `prisma/migrations/`, each tested on the local `_test` database first. Nobody edits the CCS Cloud database by hand.
**Phase 2 (API tests) is done** and merged in PR #52 (2026-10-09): 12 test files, **305 tests** covering the 40 endpoints in the [test plan](phase-2-tests/01-test-plan.md), run with `npm test` against a local MySQL test database ([tests/README.md](../tests/README.md)). The 22 untested analytics endpoints are not deleted; step 12 moves them to `legacy/analytics-endpoints/` and unregisters them (decided 2026-10-08). Findings the tests pinned but did not fix are in the notes of [02-test-log.md](phase-2-tests/02-test-log.md).
**Restructure so far:** Part A and steps 0 to 2 were merged in PR #4, steps 3 to 5 in PR #15, step 6 in PR #16, step 7 in PR #27, step 8 part 1 in PR #45, and step 8 part 2 in PR #46, all with hand checks passed. The fixes for issues #25 and #26 were merged in PR #33. Step 9 (ITS and TSG merged into one Staff role at `/staff/*`, with redirects from the old URLs, the ITS or TSG unit kept in the session for issue #41, `ITS_STAFF` accounts reaching the Staff dashboard (M-11), and Staff wording) was merged in PR #50. **Step 10** (merged in PR #56): the backend now starts from `server/main.ts` (`npm run server` unchanged), with `server/app.ts`, `server/config/` (`env.ts`, `prisma.ts`), `server/shared/services/mailer.ts`, `server/jobs/backup.ts`, and the routes in `server/remainingRoutes.ts`. One behavior change: the server no longer falls back to built-in CCS Cloud credentials and stops at startup if a `DATABASE_*` variable is missing (C-07). **Step 11** (merged in PR #58): the three loan endpoints are the first feature in five layers, in `server/features/loans/` (routes, validation, controller, service, repository), with `server/shared/errors/AppError.ts` and `shared/types/loans.ts`. No behavior change; all 8 hand checks passed. Issue #32 (users by id) is decided: step 13 switches loans and every step 12 feature to the session user. **Step 12 batch 1** (2026-10-09, merged in PR #61): returns, transfers, and disposals are split the same way into `server/features/returns/`, `transfers/`, and `disposals/`, with `shared/types/` for each and the two notification email lookups in `server/features/auth/auth.repository.ts`. No behavior change: the known defects stay (issues #51 and #54, transfer `/accept`), and transfers get no Lab Head approval rule (issue #22). **Step 12 batch 2** (2026-10-10, branch `refactor/feature-based-structure` pushed, all 9 hand checks passed, pull request next): repairs and inspections, the same way, in `server/features/repairs/` and `inspections/`. No behavior change: the repair duplicate guard, both repair status endpoints, and both report listings stay as they are, and deleting or merging them (M-07, H-06, L-07) is proposed as separate commits; the known inspection defects stay, among them an unknown condition saved as PERFECT instead of refused (issue #53). See [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md) for where it stands.

## Status board

Update this table whenever a prompt finishes (agents do this as part of every prompt).

| Phase | Prompt | Output | Status | Date |
|---|---|---|---|---|
| 0. Merge | (manual, no prompt) | [MERGE_NOTES.md](phase-0-merge/MERGE_NOTES.md), [MERGE_NOTES_3WAY.md](phase-0-merge/MERGE_NOTES_3WAY.md) | Done | |
| 1. Codebase map | [PROMPT-db-revisions.md](phase-1-codebase-map/PROMPT-db-revisions.md) (Phase 1 part) | [01-codebase-map.md](phase-1-codebase-map/01-codebase-map.md) | Done | 2026-09-17 |
| 1B. Deep map | [PROMPT-deep-map.md](phase-1b-deep-map/PROMPT-deep-map.md) | 01A to 01E in [phase-1b-deep-map/](phase-1b-deep-map/) | Done | 2026-09-18 |
| 1B. Team briefing | [PROMPT-team-briefing.md](phase-1b-deep-map/PROMPT-team-briefing.md) | [01F-team-briefing.md](phase-1b-deep-map/01F-team-briefing.md) | Done | 2026-09-26 |
| 1C. Git workflow | [PROMPT-1-git-workflow.md](phase-1c-restructure/PROMPT-1-git-workflow.md) | [guides/GIT-WORKFLOW.md](guides/GIT-WORKFLOW.md), [.github/pull_request_template.md](../.github/pull_request_template.md) | Done | 2026-09-26 |
| 1C. Restructure | [PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md) | [01-restructure-decision.md](phase-1c-restructure/01-restructure-decision.md), [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md), [guides/CODE-COMMENTS.md](guides/CODE-COMMENTS.md), the code moves | In progress (Part A and steps 0 to 11 done, merged up to PR #58; Phase 2 tests merged in PR #52; step 12 batch 1 (returns, transfers, disposals) merged in PR #61; step 12 batch 2 (repairs, inspections) done, all 9 hand checks passed, branch pushed, pull request next; next: the rest of step 12, then steps 13 and 14 (Raiki)) | 2026-10-10 |
| 1C. Structure guide | [PROMPT-3-structure-guide.md](phase-1c-restructure/PROMPT-3-structure-guide.md) | `guides/DEVELOPER-GUIDE.md` | Not started | |
| 2. Tests | [PROMPT-tests.md](phase-2-tests/PROMPT-tests.md) (supersedes the Phase 2 part of PROMPT-db-revisions.md) | [01-test-plan.md](phase-2-tests/01-test-plan.md), [02-test-log.md](phase-2-tests/02-test-log.md), [tests/README.md](../tests/README.md), `tests/` | Done (Part A, B1 to B4: harness, plan, and 305 API tests for auth, assets, loans, returns, transfers, repairs, inspections, disposals, and analytics) | 2026-10-09 |
| 3. Database plan | [PROMPT-db-revisions.md](phase-1-codebase-map/PROMPT-db-revisions.md) (Phase 3 part) | `phase-3-database/03-db-plan.md` | Paused until the restructure ends with step 14. Then the team, as migration files on the step 14 baseline, tested on the local `_test` database first (decided 2026-10-09) | |

For the detailed history of each session (what was done, decisions, open questions), read [HANDOFF.md](HANDOFF.md).

## Folder layout

```
docs/
├── README.md                 this page: index and status board
├── HANDOFF.md                running log, one dated entry per agent session
│
├── guides/                   LIVING docs. Kept up to date. Read these to work on the project
│   ├── GIT-WORKFLOW.md       (from 1C prompt 1)
│   ├── CODE-COMMENTS.md      (from 1C prompt 2)
│   └── DEVELOPER-GUIDE.md    (from 1C prompt 3)
│
├── phase-0-merge/            how the separate branches were combined
├── phase-1-codebase-map/     first map of the system + the master prompt for phases 1 to 3
├── phase-1b-deep-map/        system trace, findings, security map, restructure plan, onboarding
├── phase-1c-restructure/     restructure decision, log, and the prompts that drive it
├── phase-2-tests/            API test prompt, test plan, and test log (the tests live in /tests)
├── phase-3-database/         (created when Phase 3 starts)
│
└── reference/                read-only source material: old package files, SQL schema, FE schema
```

## Rules for this folder

1. **Two kinds of docs.** `guides/` holds living docs that describe how things work *now* and get updated. Phase folders hold records of what was found or decided at the time, and are not rewritten later (add a new dated doc instead).
2. **One folder per phase.** Every prompt and everything it produces go in that phase's folder. Guides are the only exception.
3. **Naming inside a phase folder:**
   - Prompts: `PROMPT-<name>.md`, numbered in run order when a phase has several (`PROMPT-1-...`, `PROMPT-2-...`).
   - Outputs: numbered in reading order (`01-...`, `02-...`, or the existing `01A` to `01F` in Phase 1B).
4. **Every agent session ends the same way:** update the status board above and add a dated entry to `HANDOFF.md`. Every prompt says this in its "Docs housekeeping" section.
5. **Nothing at the top of `docs/` except this README and `HANDOFF.md`.** If you are about to add a file here, it belongs in a phase folder or `guides/`.
6. **No credentials or personal data** in any doc, ever. Refer to sensitive files by path and record count only.

## How to run a prompt

1. Switch to an up-to-date `main` (or the branch named in the prompt's header) and create a branch as `guides/GIT-WORKFLOW.md` describes.
2. Open the repo in VS Code, open Claude Code, and pick manual or edit-auto permission mode (not plan mode, it blocks file writes).
3. Send the suggested first message from the top of the prompt file, for example:
   `Read docs/phase-1c-restructure/PROMPT-1-git-workflow.md and follow it.`
4. Review the diff, commit, push the branch, and open a pull request.
