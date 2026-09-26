# Git Workflow Guide

For everyone on CAP-2519-IT, including AI coding agents. Repo: `github.com/Raiki1903/CAP-2519-IT`. Last checked against the repo on 2026-09-26.

Casual version: this is how we change code without stepping on each other or breaking `main`.

---

## 1. The one rule

**Nobody commits or pushes directly to `main`.** Every change, even a one-line docs fix, goes through a branch and a pull request (PR).

## 2. The mental model

The workflow you may have in your head is "branch, commit, push to main." One step is wrong: **we push the branch, not `main`.** `main` only changes when a PR is merged on GitHub.

```
main       A---B---C-----------------M---   (only changes via merged PRs)
                    \               /
your branch          D---E---F----+        (you commit here)
                                   \
                                    PR: you push the branch, open a pull request,
                                    a teammate reviews, then GitHub merges it (M)
```

**Why not push straight to `main`?** Because `main` is what everyone branches from and what we demo. A PR is a checkpoint: someone else reads the change, and GitHub shows exactly what will land. If something breaks, we revert one merge instead of hunting through commits.

## 3. One-time setup

1. Clone: `git clone https://github.com/Raiki1903/CAP-2519-IT.git` (VS Code: Command Palette, "Git: Clone").
2. Set your identity (once per machine):
   ```
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```
3. `npm install`
4. Copy `.env.example` to `.env` and fill it in. **Note:** `.env.example` does not exist yet (01C section 7, C-07). Until it does, ask a teammate for the variable names. Never paste real values into a tracked file.
5. Check you are current: `git switch main`, then `git pull`. `git status` should say "up to date with origin/main".

## 4. The daily loop

| # | Terminal | VS Code | Why |
|---|---|---|---|
| 1 | `git switch main` | Click the branch name (bottom left), pick `main` | Start from the shared base |
| 2 | `git pull` | Source Control, `...` menu, Pull | Get everyone's latest merged work |
| 3 | `git switch -c fix/h04-return-closes-loan` | Branch name, "Create new branch...", type the name | Your work lives on its own branch |
| 4 | (make changes) | | |
| 5 | `git status` | Source Control panel lists changed files | Check nothing unexpected changed |
| 6 | `git add <files>` | Click `+` next to each file | Stage specific files, not everything blindly |
| 7 | `git commit -m "fix(returns): close the loan when a return is finalized (H-04)"` | Type the message, click Commit | Save a snapshot with a clear label |
| 8 | `git push -u origin fix/h04-return-closes-loan` | Click "Publish Branch" | Sends your **branch** (not main) to GitHub |
| 9 | Open a PR on GitHub into `main` | GitHub shows a "Compare & pull request" banner | Ask a teammate to review |
| 10 | After approval: merge on GitHub, then `git switch main && git pull && git branch -d fix/h04-return-closes-loan` | Same, via the branch picker and Pull | Sync and clean up |

Before step 6 also run `git diff --staged` after staging (VS Code: click a staged file) to read what you are about to commit. See section 9.

## 5. Branch naming

Prefixes: `feature/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`, `db/`. Lowercase with hyphens. Include a finding ID when there is one.

| Good | Why |
|---|---|
| `fix/h04-return-closes-loan` | Prefix, finding ID, what it does |
| `fix/c04-strip-pending-passwords` | Security fix tied to C-04 |
| `db/return-condition-enum-map` | Database change (H-21) |
| `refactor/option-a-structure` | The restructure branch |
| `docs/git-workflow` | Docs only |
| `test/loan-approval-guards` | Phase 2 tests |

Avoid `my-branch`, `test2`, `Fix_Stuff`.

## 6. Commit messages

Format: `type(scope): what changed (finding ID)`. Types match branch prefixes: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `db`.

**Good (from this project):**
- `fix(returns): close the loan when a return is finalized (H-04)`
- `fix(security): stop backing up the users table (C-01)`
- `chore(git): ignore scratch/backups and pending_registrations.json (M-19)`
- `db(returns): map MINOR_DRIFT and CRITICAL_DEFECT to the column values (H-21)`
- `refactor(server): move loan routes to features/loans/loans.routes.ts`

**Bad:**
- `updates` (what updates?)
- `fixed stuff and moved files around` (two things, no scope, no ID)
- `WIP asdf` (never merge this)

**Rule: one commit either moves code or changes behavior, never both.** Moves are easy to review because the diff is "same code, new place." Mixing them hides bugs inside a giant diff.

## 7. Pull requests

The template at `.github/pull_request_template.md` fills in automatically. Write:
- **What changed** in plain words, and **why** (finding IDs like H-04, or an issue).
- **How you tested it**, honestly.

**How big is too big?** If a reviewer cannot read it in 15 minutes, split it. Restructure PRs are the exception: one PR per migration step (see section 10).

**Who reviews?** Any teammate who did not write the change. Ask in the group chat, do not just wait.

**What the reviewer checks:**
1. Checkout the branch and run `npm run build`. (Also `npm run typecheck` once the restructure adds it.)
2. Click through the changed screens in `npm run dev:all`.
3. Look for secrets: passwords, keys, emails, ID numbers, `.env`, anything under `scratch/backups/`.

**When to merge:** one approval, build passes, no conflicts, no secrets. The author merges, using the green button on GitHub.

## 8. Keeping your branch up to date

Someone else's PR merged and you want it in your branch:

```
git switch your-branch
git pull origin main
```

VS Code: Source Control, `...` menu, Branch, "Merge Branch...", pick `origin/main`.

We use **merge, not rebase**. It is safer and you cannot lose work.

**Resolving a conflict in VS Code, step by step:**
1. The merge stops and lists conflicted files. Open one.
2. You see `Accept Current Change | Accept Incoming Change | Accept Both Changes | Compare Changes` above each conflict.
   - "Current" is your branch. "Incoming" is `main`.
3. Read both versions. Pick one, or accept both and tidy by hand. Delete every `<<<<<<<`, `=======`, `>>>>>>>` line.
4. Save. Repeat for each conflict and each file.
5. Run `npm run build` to be sure it still works.
6. Stage the files and commit (the default merge message is fine). Push.

Not sure? Stop and ask. A half-resolved conflict is fixable. See section 14 for the escape hatch.

## 9. Never commit these

| Never commit | Why |
|---|---|
| `.env` | Real credentials (C-07) |
| `scratch/backups/` | Contains the users table with plaintext passwords (C-01, 113 files were already committed) |
| `pending_registrations.json` | Plaintext passwords and personal data (H-17) |
| `node_modules/`, `dist/` | Generated, huge |
| Database dumps, `*.sql` with real data | Personal data |
| Screenshots showing real names, emails, or IDs | Personal data |

**Heads up:** today `.gitignore` covers `node_modules`, `dist`, and `.env`, but **not** `scratch/backups/` or `pending_registrations.json` (M-19). Fixing that is Tier 1 in `docs/phase-1b-deep-map/01C-security-map.md`. Until it is done, be extra careful with `git add`: never use `git add .` or `git add -A`.

**Check before committing:**
- `git status` (are there files you do not recognize?)
- `git diff --staged` (read every line you are about to commit)

**If one slips in:**
- **Committed, not pushed:** `git reset --soft HEAD~1`, unstage the file (`git restore --staged <file>`), commit again.
- **Already pushed:** stop. Tell the team right away. **Rotate the credential.** Removing the file in a new commit does not remove it from history. Anyone who cloned, or a public repo's cache, may already have it. Whether to rewrite history is a team decision with the adviser (01C tier 1, item 4).

This repo is **public**. Treat anything pushed as public forever.

## 10. Team coordination rules for this project

**During the restructure** (`docs/phase-1c-restructure/PROMPT-2-restructure.md`, branch `refactor/option-a-structure`):
- One person owns the restructure branch. Moving files conflicts with anyone editing the same files.
- **Announce in the group chat before you touch a file that is being moved**, and wait for an ok. Announce again when you merge.
- One commit per migration step, one PR per step, each independently revertible.
- Everyone else: keep changes small, merge them fast, and pull `main` into your branch daily.
- Until the restructure lands, avoid big edits to `server.ts`, `context.tsx`, and the four dashboard components.

**Database changes (Phase 3):**
- **One migration branch at a time.** Merge it before the next one starts.
- Never edit a migration that is already merged. Add a new one.
- After pulling a merged migration, everyone runs it. The database is shared and live (01E section 4), so announce first and never run a migration you have not read.
- No `$executeRawUnsafe` scripts in `scratch/` against the live database (H-15).

**Always:** pull after every merge to `main` (`git switch main && git pull`).

## 11. Working with AI coding agents

- The agent works on a **branch**, never on `main`. Create the branch before you start it.
- **Review the full diff before committing**, the same as if a teammate wrote it. Agents sometimes touch files you did not expect.
- **Never let an agent push, force-push, rewrite history, or read `.env`.** You push, after review.
- Keep the agent's prompt file in `docs/` (for example `docs/phase-1c-restructure/PROMPT-2-restructure.md`) and reference it in the PR description.
- Use manual or edit-auto permission mode, not auto-approve everything.
- Agents leave a commit attribution line. Leave it in.

## 12. First-time cleanup for this repo (to do together)

Status checked on 2026-09-26:

1. **Merge `docs/reorganize-docs` into `main`.** Already done: PR #1 was merged (it included `database-continuation`). Nothing to do. Everyone should `git switch main && git pull`.
2. **Archive the seven old branches.** They share no history with `main` and must never be merged: `asis-balanay-merged`, `frontend-backend-version-one`, `frontend-backend-version-two`, `frontend-backend-version-3`, `new-version-frontend`, `refactored-frontend`, `refactored-and-cleaned`. Suggested (only if the team agrees, deleting is a team decision):
   ```
   git tag archive/<branch-name> origin/<branch-name>
   git push origin archive/<branch-name>
   ```
   Then delete the remote branch on GitHub (Branches page, trash icon). The tag keeps the commits reachable.
3. **Local-only leftovers:** `Frontend-Check` and `old-local-main` exist only on some machines. Delete them locally when you no longer need them (`git branch -d <name>`, or `-D` if git refuses and you are sure).
4. **Turn on branch protection** (section 13).
5. **Fix `.gitignore`** and untrack the sensitive files (01C tier 1, items 1 to 3). This is separate from git workflow, but nothing in section 9 is safe until it is done.

## 13. GitHub settings to turn on

Someone with admin rights on the repo does these (Raiki, as owner).

| Setting | Where |
|---|---|
| **Branch protection for `main`**: require a pull request before merging, require 1 approval, block force pushes, block deletion | Repo, Settings, Branches, "Add branch protection rule" (or Rulesets), branch name pattern `main` |
| **Automatically delete head branches** after a PR merges | Repo, Settings, General, Pull Requests, tick "Automatically delete head branches" |
| **Allow merge commits** (keep it simple, we use merge, not rebase) | Repo, Settings, General, Pull Requests |
| **Require status checks to pass** once `.github/workflows/ci.yml` exists (build and typecheck) | Same branch protection rule, "Require status checks to pass before merging" |
| Optional: **Secret scanning and push protection** | Repo, Settings, Code security and analysis (available on public repos) |

Note: with a single approval required and four people, the PR author cannot approve their own PR. That is intended.

## 14. Recovery cheat sheet

| Situation | What to do |
|---|---|
| Discard uncommitted changes to one file | `git restore <file>` (VS Code: file's "Discard Changes"). **Permanent.** |
| Unstage a file | `git restore --staged <file>` (VS Code: click `-`) |
| Undo the last commit, not pushed | `git reset --soft HEAD~1` (keeps changes staged) |
| Revert a merged PR | On GitHub, open the merged PR, click "Revert". It opens a new PR that undoes it. Merge that |
| I committed on `main` by mistake (not pushed) | `git switch -c fix/my-change` (keeps your commit on a new branch), then `git switch main`, `git reset --hard origin/main`. Check `git status` first |
| I pushed to `main` by mistake | Tell the team. Do not force-push. Revert it through a PR |
| My branch is far behind `main` | `git pull origin main` into your branch, resolve conflicts (section 8). Big gap? Ask for help before starting |
| I see a conflict and I am scared | Nothing is lost. Run `git merge --abort` to back out to before the merge, then ask a teammate to pair with you |
| I committed a password or personal data | Section 9 |

**Force-push (only with team agreement):** `git push --force-with-lease`. Never on `main`. Never as a first resort. Ask first.

## 15. One-page cheat sheet

| Task | Command |
|---|---|
| Start a change | `git switch main` then `git pull` then `git switch -c <prefix>/<name>` |
| See what changed | `git status` |
| Stage a file | `git add <file>` |
| Read what you will commit | `git diff --staged` |
| Commit | `git commit -m "type(scope): message (ID)"` |
| Push your branch | `git push -u origin <branch>` |
| Bring `main` into your branch | `git pull origin main` |
| Abort a bad merge | `git merge --abort` |
| Clean up after merge | `git switch main && git pull && git branch -d <branch>` |
| Discard file changes | `git restore <file>` |
| Unstage a file | `git restore --staged <file>` |
| Undo last commit (not pushed) | `git reset --soft HEAD~1` |
| Revert a merged PR | GitHub, PR page, "Revert" |
