@AGENTS.md

# Claude Code only

These add to AGENTS.md for the Claude Code agent on Raiki's PC.

- **Stops.** Work in the steps the prompt or task brief gives. Stop after each step with a report and wait for Raiki.
- **Git.** Commit on the branch you are given. Never push, merge, rebase, or rewrite history (the deny rules in settings block these too). Raiki pushes and opens the pull request.
- **Secrets.** Never read `.env` or `pending_registrations.json`, not even to check a value. If a step needs a value from `.env`, ask Raiki.
- **Task briefs.** When a prompt names a file in `docs/tasks/`, read it fully before starting. It is the source of truth for that batch.
- **Browser checks (Playwright MCP).** Only against the local test database, with a start script outside the repo. Before starting, make sure ports 4000 and 5173 are free (a leftover `npm run dev:all` talks to CCS Cloud). Screenshots go to `%TEMP%`. Delete `.playwright-mcp` from the repo afterwards.
- **Hand checks for Raiki.** Give each one its full location: the log or task file, the step and section heading, the check number, and the line. Say which database each check touches. Checks on CCS Cloud must be read-only.
- **Counts.** If the typecheck count or the test count changes in any commit, say so in the report, with the reason.
- **Questions.** Raiki answers without opening files, so follow the question format in AGENTS.md, "When unsure", every time.
