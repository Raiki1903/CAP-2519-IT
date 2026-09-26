# 02. Restructure Log

Running record of the migration in [01D section 9](../phase-1b-deep-map/01D-restructure-plan.md#9-ordered-migration-steps).
Decision and comment standard: [01-restructure-decision.md](01-restructure-decision.md), [../guides/CODE-COMMENTS.md](../guides/CODE-COMMENTS.md).

Branch: `refactor/option-a-structure`. Nothing here is pushed by the agent; Raiki pushes and opens the pull requests.

---

## Status

| # | Step | Status | Move commit | Comment commit | Typecheck errors | Date |
|---|---|---|---|---|---|---|
| A | Part A: decision and comment standard | Done | `fbaa777`, `1cfb784` | n/a (docs) | n/a | 2026-09-26 |
| 0 | Safety net first (01C tier 1, code parts) | Done | `324dfda` | n/a (see note 1) | n/a (step 1 adds it) | 2026-09-26 |
| 1 | Add `tsconfig.json` and a `typecheck` script | Not started | | | | |
| 2 | Quarantine dead code into `legacy/analytics-v1/` | Not started | | | | |
| 3 | Create `shared/`, move enums and the lab list | Not started | | | | |
| 4 | Introduce `web/api/client.ts`, convert loans | Not started | | | | |
| 5 | Convert the remaining features to the API client | Not started | | | | |
| 6 | Split `context.tsx`, delete localStorage-only actions | Not started | | | | |
| 7 | Delete `prismaClient.ts` | Not started | | | | |
| 8 | Move the frontend to `web/` with feature folders | Not started | | | | |
| 9 | Merge ITS and TSG into `/staff/*` | Not started | | | | |
| 10 | Create the `server/` skeleton | Not started | | | | |
| 11 | Extract one backend feature end to end (loans) | Not started | | | | |
| 12 | Extract the remaining backend features | Not started | | | | |
| 13 | Add `errorHandler` and `requireAuth` | Not started | | | | |
| 14 | Baseline the migrations | Not started | | | | |

Steps 6, 7, 9, and 13 change behavior on purpose. Every other step is a move or an addition.

---

## Step 0 detail

**What changed in the code:**

- `server.ts` `performDatabaseBackup()`: the `users` table is no longer read, and the destination is `process.env.BACKUP_DIR` with **no default**. If `BACKUP_DIR` is unset the backup is skipped with a warning, and if it resolves to a path inside the repository the backup is skipped as well. Previously it wrote to `scratch/backups/` on startup and every 6 hours (C-01, C-03).
- `.gitignore`: added `scratch/backups/` and `pending_registrations.json` (M-19).
- `.env.example`: created, variable **names** only, including the new `BACKUP_DIR` (C-07).
- Untracked with `git rm --cached`: 113 files under `scratch/backups/` and `pending_registrations.json`. **The files remain on disk**, they are only removed from git tracking.

**Verified:** `npm run build` passes. `npx tsx server.ts` starts and listens on port 4000. No new backup file was written during that run (the folder still holds the same 113 files).

**Not verified:** the "Backup skipped" log line was not observed at runtime, because `assertDefaultCustodianExists()` runs before the backup in the startup callback and hangs without database access from this machine. The guard is the first statement in the function, before any Prisma call, and no file was written, which is the outcome that matters.

---

## Notes: noticed, deliberately not fixed

Kept here instead of being fixed, per 01D section 11 ("scope creep into Phase 3").

| Note | Finding | Where it belongs |
|---|---|---|
| The backup still covers only 4 of 15 tables (no `asset_records`, the table that holds custody state), so it could not actually restore the system. It is a partial export, not a backup. Deciding whether to keep it at all belongs with `server/jobs/backup.ts` | F-39 in 01A | Step 10, or delete the job |
| `pending_registrations.json` is now untracked but still the live store for pending sign-ups, holding a plaintext password per record | H-17 | Phase 3 (becomes a table) |
| `prisma.ts` still carries hardcoded connection fallbacks including a password. Step 0 did not touch them, because removing them without `server/config/env.ts` would break every teammate's setup with no replacement | C-07 | Step 10 (`server/config/env.ts`) |
| `npm ci` reports 11 vulnerabilities (3 moderate, 8 high) and 2 packages have install scripts not covered by `allowScripts` (`@prisma/engines`, `prisma`) | 01C section 7, tier 3 item 22 | Separate dependency pass |
| `node_modules` was absent in this working copy, so `npm ci` and `npm run prisma:generate` were run before anything could be verified. Worth knowing for the next session | n/a | n/a |
| `LabHeadDashboard.tsx` does call `GET /api/assets` (line 165, via a template string), so 01D's list of callers is correct. Recorded because an earlier quick grep suggested otherwise | n/a | n/a |
