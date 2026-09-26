# Agent Prompt: Git Workflow Guide

> How to run this: open the repo in VS Code with Claude Code, in manual or edit-auto permission
> mode. Do not use plan mode, it blocks file writes. Work on a `docs/git-workflow` branch
> created from an up-to-date `main`.
>
> Run this before the restructure starts, so every teammate follows the same workflow from
> the first restructure commit.
>
> Suggested first message:
> `Read docs/phase-1c-restructure/PROMPT-1-git-workflow.md and follow it.`

---

# Role (R)
You are a DevOps mentor writing the git workflow for a four-person student team working on one GitHub repository for their capstone project, "Asset Management System for DLSU CCS AdRIC" (CAP-2519-IT). Some teammates have only used git to commit and push to one branch. You teach the safe habits first, explain why each step exists, and give exact commands.

# Task (T)
**Write a git workflow guide** for this repository that the team follows for every change, including work done by AI coding agents. Also **write a pull request template** and **list the GitHub settings** we should turn on.

# Context (C)
- **Repository:** `github.com/Raiki1903/CAP-2519-IT` (public).
- **Current branch situation (verify with read-only git commands before writing):**
  - `main` is the base branch.
  - `database-continuation` was a couple of commits ahead of `main`, docs only. The branch `docs/reorganize-docs` builds on it and reorganizes `docs/` into phase folders. Check with `git log` whether that work is already merged into `main`. If not, the first cleanup step is merging it through a pull request, so everyone branches from the same point.
  - Seven older pre-defense branches exist (`asis-balanay-merged`, `frontend-backend-version-one`, `frontend-backend-version-two`, `frontend-backend-version-3`, `new-version-frontend`, `refactored-frontend`, `refactored-and-cleaned`). They share no history with `main` and must never be merged. Recommend how to archive them (for example, tag each one and then delete the branch), and state that deleting is a team decision.
- **The workflow I believe is correct:** start at `main`, create a branch to address an issue or add a feature, stage and commit on that branch, then push to `main`. **Correct this where it is wrong.** In particular, explain that we push the *branch*, open a pull request, have it reviewed, then merge into `main` on GitHub, and that nobody pushes directly to `main`.
- **Upcoming work that the guide must support:**
  - The restructure (`docs/phase-1c-restructure/PROMPT-2-restructure.md`): many small steps, one commit per step, on `refactor/option-a-structure`. Moving files causes conflicts if others edit the same files at the same time.
  - Phase 2 (tests) and Phase 3 (database triggers and procedures, Prisma migrations). Two people creating migrations on separate branches at the same time is a real risk.
  - AI coding agents (Claude Code) that edit files and sometimes commit.
- **Security facts that shape the rules (from `docs/phase-1b-deep-map/01C-security-map.md`):**
  - `scratch/backups/` and `pending_registrations.json` contain real personal data and were committed (C-01, M-19). The `.gitignore` does not cover them yet.
  - Live database credentials were hardcoded as fallbacks in tracked code (C-07).
  - `.env` must never be committed. `.env.example` holds variable names only.
- **Team tools:** VS Code, GitHub web. Some teammates prefer clicking over typing commands.
- **Scripts available:** `npm run dev:all`, `npm run build`, and `npm run typecheck` once the restructure adds it.

# Examples (E)
**Good: the core loop, as the guide should present it**
```
1. git switch main
2. git pull
3. git switch -c fix/return-closes-loan
4. ...make changes...
5. git status              (check what changed, nothing unexpected)
6. git add <files>         (add specific files, not everything blindly)
7. git commit -m "fix(returns): close the loan when a return is finalized (H-04)"
8. git push -u origin fix/return-closes-loan
9. Open a pull request on GitHub into main, ask a teammate to review
10. After approval, merge on GitHub, then: git switch main && git pull && git branch -d fix/return-closes-loan
```

**Good: explaining why**
> **Why not push straight to main?** Because `main` is what everyone branches from and what we demo. A pull request is a checkpoint: someone else reads the change, and GitHub shows exactly what will change before it lands. If it breaks something, we revert one merge instead of hunting through commits.

**Good: a recovery recipe**
> **"I committed something I shouldn't have (not pushed yet)"**
> `git reset --soft HEAD~1` undoes the commit and keeps your changes staged. Fix, then commit again.
> **If it was a password or personal data and you already pushed:** stop, tell the team, rotate the credential. Removing it from the latest commit does not remove it from history.

# Constraints (C)
- **Documentation only.** Create files only at `docs/guides/GIT-WORKFLOW.md` and `.github/pull_request_template.md`, and update `docs/README.md` and `docs/HANDOFF.md` as described under Docs housekeeping. Do not change application code.
- **Read-only git commands only** for checking the repo state (`git branch -a`, `git log`, `git status`, `git remote -v`, `git fetch`). Do not create, delete, merge, rebase, tag, or push branches. Do not change GitHub settings. You may commit your two files on the current `docs/git-workflow` branch; do not push.
- **Keep it beginner-safe.** Recommend `git merge` (not `rebase`) for bringing `main` into a branch. Do not teach force-push except in a clearly marked "only with team agreement" note.
- **Give both ways** for the core loop: terminal commands and the VS Code Source Control clicks.
- **Use this repo's real names:** branch names, scripts, file paths, finding IDs.
- **No em dashes anywhere.** Use commas, colons, periods, or parentheses.
- **Slightly casual, conversational tone.** It is a team guide, not a policy document.
- The main workflow section should fit on about two screens. Put edge cases and recovery in later sections.
- Do not reproduce credentials or personal data from any file.

# Docs housekeeping (do this last)
- Update the status board in `docs/README.md`: set this prompt's row to **Done** (or **In progress** with the last step reached), with today's date and links to the files you created.
- Add a dated entry to the end of `docs/HANDOFF.md`: which prompt you followed, what you produced, key findings or decisions, and open questions. Keep earlier entries unchanged.
- Put new files only where this prompt says. Do not create new folders under `docs/` unless this prompt names them.

# Output Format (O)
**File 1: `docs/guides/GIT-WORKFLOW.md`**, structured as follows.
1. **The one rule:** nobody commits or pushes directly to `main`; every change goes through a branch and a pull request.
2. **The mental model:** a short diagram of `main`, a feature branch, commits, push, pull request, merge. Correct the "push to main" misunderstanding explicitly.
3. **One-time setup:** clone, set name and email, `npm install`, copy `.env.example` to `.env`, and how to check you are up to date.
4. **The daily loop:** the 10 steps from the example, each with the terminal command and the VS Code equivalent, and one line on why.
5. **Branch naming:** prefixes `feature/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`, `db/`; lowercase with hyphens; include a finding ID when there is one (for example `fix/h04-return-closes-loan`).
6. **Commit messages:** format `type(scope): what changed (finding ID)`, with 5 good and 3 bad examples from this project. Rule: one commit either moves code or changes behavior, never both.
7. **Pull requests:** what to write, how big is too big, who reviews, what the reviewer checks (runs `npm run build`, clicks through the changed screens, looks for secrets), and when to merge.
8. **Keeping your branch up to date:** `git pull origin main` into your branch, and how to resolve a merge conflict step by step in VS Code.
9. **Never commit these:** `.env`, `scratch/backups/`, `pending_registrations.json`, `node_modules/`, `dist/`, database dumps, screenshots with personal data. How to check with `git status` and `git diff --staged` before committing. What to do if one slips in, before and after pushing.
10. **Team coordination rules for this project:**
    - During the restructure: who owns which folders, and announcing in the group chat before touching a file someone else is moving.
    - Database changes: one migration branch at a time, merge it before the next one starts, and everyone runs the migration after pulling.
    - Pull after every merge to `main`.
11. **Working with AI coding agents:** the agent works on a branch, never on `main`; review the full diff before committing; never let an agent push, force-push, rewrite history, or read `.env`; keep the agent's prompt file in `docs/` and reference it in the pull request.
12. **First-time cleanup for this repo (to do together):** if not already done, merge `docs/reorganize-docs` (which includes `database-continuation`) into `main` via pull request; archive the seven old branches (tag, then delete, if the team agrees); turn on branch protection.
13. **GitHub settings to turn on:** branch protection for `main` (require a pull request, require one approval, block force-push and deletion), delete branch on merge, and later a required CI check once `.github/workflows/ci.yml` exists. For each, the exact place in GitHub settings.
14. **Recovery cheat sheet:** discard uncommitted changes, unstage a file, undo the last commit (not pushed), revert a merged pull request, "I committed on main by mistake", "my branch is far behind main", "I see a conflict and I'm scared".
15. **One-page cheat sheet:** the commands from sections 4, 8, and 14 in one table.

**File 2: `.github/pull_request_template.md`** with sections: What changed, Why (finding IDs or issue), How I tested it (checkboxes: `npm run build` passes, screens clicked through, no secrets in the diff), Moves code or changes behavior (pick one), Screenshots if UI changed, Notes for the reviewer.

When done, reply in chat with the two file paths, the list of GitHub settings I need to turn on myself, and the first-time cleanup steps. Do not paste the guide into chat.
