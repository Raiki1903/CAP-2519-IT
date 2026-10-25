# AdRIC AMS: Advisor + agent setup (Joel, Aryan)

You'll fix issues with the same setup Raiki uses:

| Who | What they do |
|---|---|
| **Advisor:** your chat AI (for example a Gemini Gem) | Writes the prompt for the agent, reviews the agent's plan, report, and test results, explains its questions, writes the PR text |
| **Agent:** Antigravity | Reads the repo, plans, edits the code, commits, runs the checks, writes the hand checks (you run them) |
| **You** | In the middle: pass prompts and reports between the two, answer questions, **run the hand checks on your local UAT database**, read the diff, push the branch, open the PR |
| **Raiki** (with his advisor) | Reviews the PR (the diff and your test results), asks for changes if needed, merges |

Your issues and their order are in the "who does what" table Raiki sent.

## What changed since the last version (2026-10-23)

- **The check numbers live in `AGENTS.md`** ("Commands": the typecheck count and the test count). Every batch updates them there, so this guide doesn't repeat them. Pull `main` before you start, and use those numbers.
- **Click-test on a local copy of the UAT data** (Before you start, step 4), not a demo database and never CCS Cloud.
- **Screen names changed** (batch W, PR #117). Use the new names in hand checks:
  - Lab Head: **Requests** (was Custody Transitions), **Lab Inventory** (was Branch Inventory), **Analytics** (was Health Benchmarking), **Account Approvals**
  - Staff: **Repairs**, **Inspections**, **QR Tags**, **Analytics** (were Repair Manager, Inspection Manager, QR Tag Wizard, Health Benchmarking)
  - Director: **Overview**, **Analytics**, **Disposal Approvals**, **Inventory Report** (were Executive Overview, Descriptive Analytics, Approvals & Holds, Audit Generator)
  - Everywhere: buttons say **Approve** and **Decline** (not Authorize or Reject), and an asset's availability shows **Available** (the stored value is still "Active": never change a comparison or a request body to "Available")
- **`npm test` is required before a PR**, not optional. If it can't connect, fix the test database setup first (`tests/README.md`) or ask Raiki.
- **`Closes #<n>` must name the issue the PR actually fixes.** Check the issue is open and matches the change.
- **Changes to who sees what** (lab matching, role checks, bell relevance) need a hand check with **two Lab Heads from different labs** (LabHead CITe4D One and LabHead CAR on your local UAT database).
- **Merges and deploys** happen only in a sprint (Saturday) or a weeknight window. Open your PR early in the window.
- **Going back to a PR after review:** pull `main` into your branch first (section D, step 14), so you build on the current code.
- **Each branch starts from a fresh `main`,** never from another fix branch. Stacked branches carry other PRs' changes and get checked on old code.
- **Two accounts at once need two different browsers** (for example Chrome and Firefox). Private windows in the same browser share one login, so logging in as a second user replaces the first.

## Before you start (once)

1. Pull `main`, then run `npm install` and `npm run prisma:generate`.
2. `npm run typecheck` should print the error count in `AGENTS.md` ("Commands").
3. `npm test` should pass the test count in `AGENTS.md`. It needs local MySQL and a test database: `tests/README.md`, "One-time setup".
4. Set up a **local copy of the UAT data** for clicking through your fixes. Raiki sends you `uat-reset.sql` privately: never commit it or post it, it holds the UAT passwords. In PowerShell, from the repo folder:
   1. `mysql -u root -p -e "CREATE DATABASE adric_uat_local"`
   2. Build the tables (your MySQL password in place of `<password>`):
      ```
      $env:PRISMA_TARGET_URL = "mysql://root:<password>@localhost:3306/adric_uat_local"
      npx.cmd prisma migrate deploy
      Remove-Item Env:PRISMA_TARGET_URL
      ```
   3. Load the data (forward slashes in the path): `mysql --default-character-set=utf8mb4 -u root -p adric_uat_local -e "source C:/path/to/uat-reset.sql"`
   4. In your `.env`, point the app at it: `DATABASE_HOST=localhost`, `DATABASE_PORT=3306`, `DATABASE_USER=root`, `DATABASE_PASSWORD=<your MySQL password>`, `DATABASE_NAME=adric_uat_local`, and a `SESSION_SECRET` from `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   5. `npm run dev:all`, open http://localhost:5173, and log in with any UAT account (the same accounts as the UAT manual, including two Lab Heads from different labs: LabHead CITe4D One and LabHead CAR).

   To start over, run step 3 again: it empties every table and reloads the data, with due dates counted from that day. **Never put CCS Cloud details in your `.env`.** Your test database (`npm test`) is separate: it is wiped on every run, so never click-test on it.

If any of this fails, ask Raiki before starting your first issue.

## A. Set up your advisor (once)

1. Make a **Gem** in Gemini (or a Project in ChatGPT or Claude) called "AdRIC AMS advisor".
2. Upload **`AGENTS.md`** (repo root) and **this guide** (`docs/guides/TEAMMATES-AI-GUIDE.md`) as files. When either changes (check after every `git pull`), upload the new version and delete the old one.
3. Paste this as its instructions:

```
You are my advisor for our capstone, CAP-2519-IT (Asset Management System for DLSU CCS AdRIC). I use Antigravity as my coding agent. You do not write the code yourself. Follow AGENTS.md and the advisor + agent guide (both attached).

Your jobs:
1. When I give you an issue (number, title, body), write the agent prompt using the template in the guide, part C, filled with that issue's details. Exact text in one code block, no placeholders left.
2. When I paste the agent's plan, check it against the issue and AGENTS.md: right files, no extra changes, no rule breaks. Explain each of its questions in plain words with your recommendation. Tell me exactly what to reply ("go", or the answers).
3. When I paste the agent's report, check: only the issue's files changed, one change per commit, typecheck and test counts match AGENTS.md (typecheck no higher, tests no lower, or a reason), build passes, hand checks are numbered with role, screen, clicks, expected result, and use the local UAT database only. Tell me what to fix, if anything.
4. When I paste my hand check results (pass or fail per check), tell me if the fix is done or what to send back to the agent. Don't call it done until every check passes.
5. Write the PR title and body (sections: What changed, Why with "Closes #<n>" for the issue this PR fixes, How I tested it with the three check numbers and each hand check with its result, Screenshots, Notes for the reviewer).
6. Tell me to stop and ask Raiki whenever the agent wants to install a package, run a prisma command, touch .env, change files the issue doesn't mention, skip or delete tests, test against CCS Cloud, or push.

Use plain, simple words. Keep it short. No em dashes.
```

## B. Set up your agent (once)

1. Open the repo folder in Antigravity.
2. Make sure `AGENTS.md` is in the repo root (pull `main`). The agent prompt tells the agent to read it every time.
3. If Antigravity has a setting to ask before running terminal commands, keep it on.
4. **Your agent never pushes.** You push.

## C. Agent prompt template

Your advisor fills this in for each issue. Start a **new agent conversation per issue**.

```
# Role
You are a careful engineer on CAP-2519-IT. Read AGENTS.md in the repo root first and follow it, including "Working in steps" and "Reporting".

# Task
Fix issue #<number>: <issue title>.
<What happens now, and what should happen, from the issue.>
Work in these steps and stop after each:
1. Plan: read the issue's files, explain the cause and the fix in plain words, list the files you will change, ask your questions. No code yet. Stop.
2. Build (after I say go): branch fix/<number>-<short-name> from a fresh main, one change per commit. Commit, never push.
3. Checks: npm run typecheck (no more errors than AGENTS.md says), npm run build, npm test (at least the count in AGENTS.md). Report the numbers. If npm test cannot connect to the database, stop and tell me.
4. Hand checks: numbered H1, H2, and so on. Each one: the role to log in as, the screen by its name in the app, the exact clicks, what I should see. At least one check that the old bug is gone and one that nearby behavior still works. If the change affects who sees what, include a check with two Lab Heads from different labs. I run them myself on my local UAT database. Only write them: do not open a browser and do not use browser or MCP tools.
5. Report and stop.

# Context
<The issue body. Anything from the table, for example "after #62 is merged".>

# Constraints
- Only the files this issue needs. Ask before touching any other file.
- Never read or edit .env or pending_registrations.json. No package or prisma changes. Never run prisma migrate, db push, or db pull.
- Never point the app or any command at CCS Cloud, the team's shared database. My .env points at my local UAT database only.
- Never push, merge, or rebase.
- No browser or MCP tools.
- No em dashes.
- Write questions so I can answer without opening files: one plain sentence on what it is, lettered options, your recommendation with a one-line reason.

# Output format
Plan step: cause, fix, files, questions. Final step: what changed (per commit), the three check results, hand checks H1..., questions, anything not done.
```

### Filled example: #62

```
# Role
You are a careful engineer on CAP-2519-IT. Read AGENTS.md in the repo root first and follow it, including "Working in steps" and "Reporting".

# Task
Fix issue #62: inspection queue gives assets from different labs the same ticket ID.
The Staff Inspections screen builds each ticket ID from the asset tag with the letters removed, so CAR-001 and CNIS-001 both become MNT-0001. React uses that ID as the row key, so the console warns "Encountered two children with the same key" and rows can show the wrong data. Each row needs a unique ID, for example built from the full asset tag.
Work in these steps and stop after each:
1. Plan: read the issue's files, explain the cause and the fix in plain words, list the files you will change, ask your questions. No code yet. Stop.
2. Build (after I say go): branch fix/62-unique-ticket-ids from a fresh main, one change per commit. Commit, never push.
3. Checks: npm run typecheck (no more errors than AGENTS.md says), npm run build, npm test (at least the count in AGENTS.md). Report the numbers. If npm test cannot connect to the database, stop and tell me.
4. Hand checks: numbered H1, H2, and so on. Each one: the role to log in as, the screen by its name in the app, the exact clicks, what I should see. At least one check that the old bug is gone and one that nearby behavior still works. I run them myself on my local UAT database. Only write them: do not open a browser and do not use browser or MCP tools.
5. Report and stop.

# Context
The code is in web/features/inspections/InspectionQueue.tsx, around line 118: id: `MNT-${String(a.id).replace(/^[^\d]+/, "").padStart(4, "0")}`. The finalize dialog uses selectedQueueItem.rawAsset?.id first and the row ID as a fallback, so submitting an inspection must still save it for the right asset. Issue #63 (double submit) is in the same file and is a separate branch later.

# Constraints
- Only the files this issue needs. Ask before touching any other file.
- Never read or edit .env or pending_registrations.json. No package or prisma changes. Never run prisma migrate, db push, or db pull.
- Never point the app or any command at CCS Cloud, the team's shared database. My .env points at my local UAT database only.
- Never push, merge, or rebase.
- No browser or MCP tools.
- No em dashes.
- Write questions so I can answer without opening files: one plain sentence on what it is, lettered options, your recommendation with a one-line reason.

# Output format
Plan step: cause, fix, files, questions. Final step: what changed (per commit), the three check results, hand checks H1..., questions, anything not done.
```

## D. One issue, start to PR

1. **Pick your next issue** from your table, in order. If it says "after #...", wait until that one is merged. Comment "taking this" on the issue.
2. **Fresh `main`:** `git switch main`, `git pull`, `npm run prisma:generate` (and `npm install` if `package-lock.json` changed).
3. **Advisor:** paste the issue number, title, and body. Ask for the agent prompt.
4. **Agent (new conversation):** paste the prompt. It plans and stops.
5. **Advisor:** paste the plan. It explains the questions and tells you what to reply. Reply to the agent ("go", or the answers).
6. **Agent** builds, commits, runs the checks, writes the hand checks, and stops.
7. **Advisor:** paste the report. Fix anything it flags (back to the agent).
8. **Test it yourself:** start the app on your local UAT database (`npm run dev:all`, in a private browser window; two different browsers if a check needs two accounts at once) and run every hand check. Note pass or fail, and take screenshots. 
9. **Advisor:** paste the results. If anything failed, back to the agent (step 6). Repeat until every check passes.
10. **Read the diff yourself** (VS Code, Source Control, or `git diff main`). Only what the issue needs.
11. **Latest `main`:** `git pull origin main`. On a conflict, **stop and message Raiki.** Don't let the agent or the advisor resolve it. If new code came in, run the checks and the main hand check again.
12. **Push:** `git push -u origin fix/<number>-<short-name>`
13. **Open the PR** with the advisor's title and body: What changed, `Closes #<n>` (the issue this PR fixes), the three check numbers, **each hand check with its result**, screenshots, and in Notes the advisor and agent you used.
14. **Tell Raiki in the group chat.** Raiki and his advisor review it. If they ask for changes: on the same branch, first `git pull origin main` (merge, not rebase; on a conflict, stop and message Raiki), then fix them (back to the agent), run the checks again, push, and reply on the PR. The PR updates by itself. Don't merge it yourself.
15. **After the merge:** `git switch main`, `git pull`, `git branch -d <branch>`, then your next issue.

## Stop and ask Raiki if

- the agent wants to install a package, run any `prisma` command, read or edit `.env`, or push
- it wants to change files the issue doesn't mention, or delete or skip a test
- typecheck goes above, or tests drop below, the counts in AGENTS.md
- anything points at CCS Cloud, or wrote test data there
- you get a merge conflict
- you can't tell what the change does
