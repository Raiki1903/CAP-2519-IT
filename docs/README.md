# Docs index

Start here. This page tells you where every document lives, what phase the project is in, and which prompt to run next.

## Where we are now

**Current phase:** 1C, restructure and team conventions.
**Next prompt to run:** `phase-1c-restructure/PROMPT-2-restructure.md`, continuing from **step 4**. Part A and steps 0 to 2 were merged in PR #4; step 3 is done on `refactor/feature-based-structure`. See [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md) for where it stands.

## Status board

Update this table whenever a prompt finishes (agents do this as part of every prompt).

| Phase | Prompt | Output | Status | Date |
|---|---|---|---|---|
| 0. Merge | (manual, no prompt) | [MERGE_NOTES.md](phase-0-merge/MERGE_NOTES.md), [MERGE_NOTES_3WAY.md](phase-0-merge/MERGE_NOTES_3WAY.md) | Done | |
| 1. Codebase map | [PROMPT-db-revisions.md](phase-1-codebase-map/PROMPT-db-revisions.md) (Phase 1 part) | [01-codebase-map.md](phase-1-codebase-map/01-codebase-map.md) | Done | 2026-09-17 |
| 1B. Deep map | [PROMPT-deep-map.md](phase-1b-deep-map/PROMPT-deep-map.md) | 01A to 01E in [phase-1b-deep-map/](phase-1b-deep-map/) | Done | 2026-09-18 |
| 1B. Team briefing | [PROMPT-team-briefing.md](phase-1b-deep-map/PROMPT-team-briefing.md) | [01F-team-briefing.md](phase-1b-deep-map/01F-team-briefing.md) | Done | 2026-09-26 |
| 1C. Git workflow | [PROMPT-1-git-workflow.md](phase-1c-restructure/PROMPT-1-git-workflow.md) | [guides/GIT-WORKFLOW.md](guides/GIT-WORKFLOW.md), [.github/pull_request_template.md](../.github/pull_request_template.md) | Done | 2026-09-26 |
| 1C. Restructure | [PROMPT-2-restructure.md](phase-1c-restructure/PROMPT-2-restructure.md) | [01-restructure-decision.md](phase-1c-restructure/01-restructure-decision.md), [02-restructure-log.md](phase-1c-restructure/02-restructure-log.md), [guides/CODE-COMMENTS.md](guides/CODE-COMMENTS.md), the code moves | In progress (Part A and steps 0 to 3 done; next is step 4) | 2026-09-30 |
| 1C. Structure guide | [PROMPT-3-structure-guide.md](phase-1c-restructure/PROMPT-3-structure-guide.md) | `guides/DEVELOPER-GUIDE.md` | Not started | |
| 2. Tests | [PROMPT-db-revisions.md](phase-1-codebase-map/PROMPT-db-revisions.md) (Phase 2 part) | `phase-2-tests/02-test-spec.md` + test files | Paused | |
| 3. Database plan | [PROMPT-db-revisions.md](phase-1-codebase-map/PROMPT-db-revisions.md) (Phase 3 part) | `phase-3-database/03-db-plan.md` | Paused | |

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
├── phase-2-tests/            (created when Phase 2 starts)
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
