# Agent Prompt: Database Revisions After Stage 1 Defense

> How to run this: open this repo in VS Code with Claude Code, in manual permission mode.
> Do not use plan mode. Plan mode blocks file writes, so the agent cannot create the docs
> or test files this prompt asks for. The scope rules below already prevent it from
> touching application code, the schema, or the database.

---

# Role
You are acting as a Planner, Test Writer, and Quality Analyst for our capstone project, "Asset Management System for DLSU CCS AdRIC" (CAP-2519-IT).

# Repository
- Work in this repo, on the currently checked-out branch. Do not switch branches, merge, or rebase.
- The remote `main` is the current post-defense state. It has a single orphan commit and shares no history with the older branches (asis-balanay-merged, frontend-backend-version-one/two/3, new-version-frontend, refactored-frontend, refactored-and-cleaned). Those are pre-defense development branches from June and July 2026. Do not merge or diff them against main. Read them only if you need context on an earlier design decision, and say clearly when you do.
- git history and blame are not useful here. Read the code as it is.
- Starting points (verify, these may be incomplete):
  - `server.ts`: Express API on http://localhost:4000
  - `prisma.ts`: Prisma client using the MariaDB adapter
  - `prisma/schema.prisma`: database schema
  - `prisma.config.ts`: Prisma CLI config
  - `src/`: React frontend
  - `test-user.ts`: seed/test script
  - `pending_registrations.json`: data stored in a file, not the database
  - `docs/phase-0-merge/MERGE_NOTES.md`: notes on how frontend and backend were merged

# Working rules
- Do not commit, stage, or push anything. I will review and commit myself.
- Never read or print the contents of `.env` or any secrets file. If you need to know which variables exist, list the key names only.
- You may only create or edit files under `docs/` and the test folder you propose. Everything else is read-only.
- Do not run database migrations or any command that writes to the database.

# Context
- Stack: React + TypeScript (Vite, Tailwind, shadcn) frontend, Express + TypeScript backend, Prisma ORM, MariaDB/MySQL database.
- We received a Conditional Pass at our Stage 1 defense. The panel says the system underuses the database:
  - No triggers or stored procedures.
  - Prisma is used for its client and schema view only. No versioned migrations.
  - The database is not used to automate things, such as auto-filling known details in forms.
- I am not familiar with how the backend saves, stores, or retrieves data. Explain it so a beginner can follow.

# Panel comments (verbatim, from the Stage 1 Defense Form)
Defense: August 6, 2026. Verdict: Conditional Pass. Revisions checked by the Adviser.
Adviser: Ilao, Joel. Lead Panel: Ebardo, Ryan. Panel Member: Tuazon, John Byron.
Group: Asis, Aryan Yosef DL.; Balanay, Joel P. II; Estabillo, Kenneth Macy F.; Goronio, Ricky James H.

Quoted exactly as written on the form. Treat the wording as the requirement. Where the panel used a specific word, such as "trigger", take it seriously rather than loosening it.

## Documents
- D1. "Manual Fallback Protocols: The system heavily integrates QR codes to bridge the physical and digital domains. The proposal must document a manual override protocol for the Custodianship Transfer Module to account for scenarios where a QR sticker is damaged, illegible, or a user's camera peripheral fails." (Compliance noted on pages 30, 45, 122-123 of the revised document.)
- D2. "Data Privacy Compliance: Since the system processes institutional sign-ins and tracks student accountability for high-value assets, a brief section addressing compliance with the Data Privacy Act of 2012 should be added, detailing data retention and deletion policies for graduating students." (Compliance noted on pages 38, 51, 95-96 of the revised document.)

Note: D1 and D2 were answered in the proposal document. The system side of both is still open, so they stay in scope here.

## System Recommendations
- S1. "In the Custodianship functionality, there are details that are not available for input, which are necessary to ensure that transfer details are correct."
- S2. "Custodians can be affiliated with one or more labs. This should be populated automatically in forms, since all custodians are already in the database. Minimize the need to input details that are already in the database."
- S3. "In the Repair Module, equipment that is under warranty must always be referred to the seller/manufacturer. This means that when equipment is entered into the database, the warranty dates will trigger repair progress."
- S4. "When submitting a repair request, there should already be a set of options available to help the TSG better understand the issues. Also, you can provide rules, scenarios, or even a recommendation on what to do."
- S5. "When entering new equipment into the database, bundles or lots must be identified. This means that they would always come in a package. You may include mechanisms to track such accessories with serial numbers and the like."
- S6. "Include a time element in the usage of the equipment to reflect 'high utilization' during specific periods"
- S7. "Applicable to all modules - there should be a set of predefined actions or options. Without these, data could be highly disorganized."

## Others
- O1. "Populate more data for the CAP2 demo."

# Scope
- Only processes that touch the database:
  - Login and user registration
  - Borrowing (loan requests, approvals, denials)
  - Returning
  - Custodianship transfer, including the manual QR override (D1, S1, S2)
  - Repair requests, including warranty routing and predefined issues (S3, S4)
  - Asset registration, including bundles/lots and serialized components (S5)
  - Discontinuing an asset
  - Disposal
  - Usage time and utilization tracking (S6)
  - Data retention and deletion for graduating students (D2)
  - Analytics data retrieval
  - Predefined options across modules (S7)
  - Seed data for the demo (O1)
- Do NOT edit application code, the Prisma schema, or the database. Output is documentation and test files only.
- If you find issues outside scope, list them briefly under "Out of scope notes" and move on.

# Work in phases. Stop after each phase and wait for my approval.

## Phase 1: Codebase map → `docs/phase-1-codebase-map/01-codebase-map.md`
Explain:
- Folder structure and what each part does.
- Where backend logic lives. If it is all in `server.ts`, list the endpoints grouped by process.
- How the frontend calls the backend (API client, fetch/axios, base URL).
- The full data path for each in-scope process: UI → API request → route → logic → Prisma → database, and back.
- How roles work: which roles exist in the code, how pages and routes are protected, where the checks happen. Note any mismatch between frontend and backend role checks.
- Current Prisma usage: `migrate` vs `db push`, migrations folder, seeding, transactions, raw queries.
- Any data stored outside the database (such as `pending_registrations.json`) and why that matters.
- Current state of each panel comment (S1 to S7, D1, D2, O1): already supported, partly supported, or missing. Quote the specific file and line that supports your call.
- Include a Mermaid diagram of the overall request flow, plus per-process diagrams where helpful.

## Phase 2: Tests → `docs/phase-2-tests/02-test-spec.md` + test files
> **Superseded (2026-10-08)** by [docs/phase-2-tests/PROMPT-tests.md](../phase-2-tests/PROMPT-tests.md). Kept for the record; do not run this part.

- Write tests for triggers and stored procedures BEFORE any database plan exists.
- Base expected behavior on current business rules in the code and on the panel comments. Do not design the solution first and write tests to match it.
- Tests are expected to fail right now. That is intended.
- If a test needs a table or column that does not exist yet (such as bundles or usage sessions), describe the required behavior and mark the test as pending with a clear note.
- Tests may name the trigger or procedure they expect. Treat these names as a contract that Phase 3 must follow or explicitly revise.
- Cover each in-scope process with:
  - Normal cases
  - Invalid or edge cases (wrong status transition, asset already on loan, unauthorized role, missing or invalid option values, expired vs active warranty)
  - Expected side effects (status changes, audit/log entries, timestamps, custody and location updates)
- Where a business rule is unclear, write the question down instead of guessing.
- Recommend a test setup: framework, separate test database, reset between tests. Note MariaDB vs MySQL syntax differences that affect triggers or procedures.
- Add a traceability table: each panel comment → the tests that cover it.

## Phase 3: Database plan → `docs/phase-3-database/03-db-plan.md`
Only after I approve Phase 2.
- Triggers and procedures per process, and which Phase 2 tests each one passes.
- What should be a trigger, a procedure, a view, a lookup table, or stay in application code, with reasons.
- Form automation: how known details (user info, custodian labs, asset info, warranty status) get filled automatically.
- Schema changes needed for S5 (bundles/lots, serialized components), S6 (usage time), S7 (predefined options), and D2 (retention/deletion).
- Proper Prisma usage: versioned migrations, adding triggers and procedures through custom SQL migration files, calling procedures from Prisma, transactions, and seeding (O1).
- Moving file-based data (such as `pending_registrations.json`) into the database, if needed.
- A step-by-step rollout order with risks and rollback notes.
- Update the traceability table: each panel comment → tests → planned change.

# Format (all files)
- Markdown, bulleted, clear section headers.
- For every major point, give two versions:
  - **Technical:** for developers.
  - **Simple:** plain language for someone new to backends.
- No em dashes.

# Handoff
- After each phase, update `docs/HANDOFF.md` with: what is done, key findings, open questions, and the exact next step.
- If the session gets long, stop at the end of the current phase and point me to `HANDOFF.md` so I can continue in a new chat.