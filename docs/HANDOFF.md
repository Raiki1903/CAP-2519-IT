# Handoff

Source prompt: [AGENT-PROMPT-DB-REVISIONS.md](AGENT-PROMPT-DB-REVISIONS.md)

## Status

| Phase | Output | State |
|---|---|---|
| 1. Codebase map | [01-codebase-map.md](01-codebase-map.md) | Done, waiting for approval |
| 2. Tests | `02-test-spec.md` + test files | Not started (blocked on Phase 1 approval) |
| 3. Database plan | `03-db-plan.md` | Not started (blocked on Phase 2 approval) |

## What was done in Phase 1

- Read `server.ts` (all process handlers, auth, backup job, key analytics routes), `prisma/schema.prisma`, `prisma.ts`, `prisma.config.ts`, `package.json`, `test-user.ts`, `mailer.ts` (env key names only), `pending_registrations.json` (password value not printed), `scratch/` DDL scripts, `docs/MERGE_NOTES.md`.
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

- Review [01-codebase-map.md](01-codebase-map.md). Answer or defer the open questions above.
- Reply "Phase 1 approved" (optionally with answers). The agent then starts Phase 2: writes `docs/02-test-spec.md`, proposes a test folder (expected: `tests/db/`), and writes failing and pending tests for triggers and stored procedures, with a traceability table from each panel comment to its tests.
