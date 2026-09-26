# Agent Prompt: Phase 1B, Deep System Map and Restructure Plan

> How to run this: open the repo in VS Code with Claude Code, on a working branch, in manual
> or edit-auto permission mode. Do not use plan mode, it blocks file writes. This replaces
> "proceed to Phase 2" for now. Phase 2 (tests) and Phase 3 (database plan) come after.
>
> Suggested first message:
> `Read docs/phase-1b-deep-map/PROMPT-deep-map.md and follow it.`

---

# Role
You are acting as a Systems Analyst, Security Reviewer, and Technical Writer for our capstone project, "Asset Management System for DLSU CCS AdRIC" (CAP-2519-IT).

# Goal
Produce an onboarding roadmap for this codebase. The reader is a new developer who has never seen the project. After reading your output they should be able to: find where any feature lives, follow a request from a button click to a database row and back, know which parts are fragile or unsafe, and understand how we intend to reorganize the code.

I will also use this to navigate the system myself, so favor precise file and line references over prose.

# Starting point
- `docs/phase-1-codebase-map/01-codebase-map.md` already exists. Read it first.
- Treat it as a summary written by someone else. Verify its claims against the code as you go. If anything in it is wrong, incomplete, or has changed, say so explicitly in your output and correct it. Do not simply repeat it.
- Your job is to go deeper and wider than that document, not to restate it.

# Repository and working rules
- Work in this repo on the current branch. Do not switch branches, merge, or rebase.
- The older pre-defense branches (asis-balanay-merged, frontend-backend-version-one/two/3, new-version-frontend, refactored-frontend, refactored-and-cleaned) share no history with main. Do not merge or diff them. Read them only if you need context on an earlier design decision, and say so when you do.
- Do not commit, stage, or push. I will review and commit myself.
- Do not edit application code, the Prisma schema, or the database. This phase is analysis and planning only. Output is documentation.
- You may only create or edit files under `docs/`.
- Do not run migrations or any command that writes to the database.
- Never read or print the contents of `.env`. If you need to know which variables exist, list the key names only.
- **Do not reproduce credentials or personal data in your output.** If you find passwords, tokens, emails, ID numbers, or similar in files such as `scratch/backups/` or `pending_registrations.json`, refer to them by file path, record count, and field name only. Never paste the values. Never paste a sample row containing real data.

# Context
- Stack: React + TypeScript (Vite, Tailwind, shadcn) frontend, Express + TypeScript backend, Prisma ORM, MariaDB/MySQL database.
- The backend is currently one file, `server.ts`, at roughly 4,700 lines with about 62 routes. The frontend keeps a mix of real API calls and a localStorage mock database.
- We received a Conditional Pass at our Stage 1 defense. Panel comments are recorded in `docs/` from the earlier phase and still apply, but this phase is not limited to them.
- We acknowledge that security has not been addressed at all. Map it honestly. Do not soften findings.
- I am not deeply familiar with backend internals. Explain things so a beginner can follow.

# Scope
The whole system, not only the database. In scope:
- Every feature and process, including the ones that do not touch the database
- Frontend structure, state management, routing, and component responsibilities
- Backend routes, business rules, and side effects
- Database access patterns, schema drift, and data integrity
- Authentication, authorization, session handling, and data exposure
- Configuration, environment handling, build tooling, and dependencies
- Dead code, duplicate code, and abandoned paths
- Codebase organization and how to improve it

Out of scope:
- Writing or changing any application code
- Designing the triggers and stored procedures (that is Phase 3)
- Deployment and infrastructure, unless a finding depends on it

# Deliverables
Produce these five documents in `docs/phase-1b-deep-map`, in this order.

## `docs/phase-1b-deep-map/01A-system-trace.md`
A complete trace of how the system works.

- **File inventory.** Every meaningful file in `src/` and at the root, with: purpose in one line, what it imports, what imports it, and rough size. Group by area. Mark files that appear unused.
- **Feature catalog.** For every feature a user can perform, including ones outside the database processes:
  - Entry point in the UI (file, component, line)
  - What the user sees and what inputs are collected
  - Client-side validation and state changes
  - The API call, or a note that it never leaves the browser
  - Server handler, validation, business rules, writes, and side effects (emails, files, in-memory state)
  - What comes back and what the UI does with it
  - Which tables are read and written
  - What is silently dropped, guessed, or defaulted along the way
- **Component tree.** How screens compose, which components hold state, which fetch data, and which are pure presentation.
- **Shared state.** What lives in `context.tsx`, what lives in the localStorage mock, what lives in cookies, and which features depend on each. Be explicit about which actions never reach the server.
- **Role and permission matrix.** A table of role by feature by what the frontend allows by what the backend enforces. Highlight every gap.
- **Cross-cutting behavior.** Error handling, loading states, notifications, email, logging, date handling, and how consistently each is done.
- **Diagrams.** A system context diagram, a per-feature sequence diagram for the main flows, and a state diagram for each entity with a lifecycle (asset, loan, transfer, repair, disposal).

## `docs/phase-1b-deep-map/01B-findings-register.md`
A single register of everything that needs attention. This is the document I will work from, so make it scannable.

- One table, sorted by severity, with columns: ID, severity, category, title, location (file and line), what happens, why it matters, suggested fix direction, effort estimate.
- Severity: Critical, High, Medium, Low. Define what each means at the top.
- Category: Security, Data integrity, Correctness, Reliability, Performance, Maintainability, Privacy compliance.
- Then a short detailed section per Critical and High finding, with a **Technical** and a **Simple** explanation, plus a concrete failure scenario showing how it goes wrong in practice.
- Include a "system health" summary: what works reliably, what works by luck, and what is actively broken.
- Flag anything that would embarrass us in a demo or defense, such as hardcoded fake data, endpoints that write on read, or features that only work on one machine.

## `docs/phase-1b-deep-map/01C-security-map.md`
A security review. We know the answer is bad; the value is in the detail and the ordering.

- **Attack surface.** Every way into the system: HTTP routes, static files, the database connection, email, file reads and writes, and anything reachable from the network.
- **Authentication.** How identity is established today, where it is stored, how it can be forged, and what it does not protect.
- **Authorization.** For each route: which role should be allowed, and what is actually enforced. Mark every route where the answer is "nothing".
- **Sensitive data.** Where personal data and credentials are stored, transmitted, logged, backed up, or committed to the repository. Reference locations and counts only, never values.
- **Input handling.** Validation, injection risk, file and image upload handling, payload size, and output escaping in emails and the UI.
- **Configuration and secrets.** Hardcoded fallbacks, committed files that should be ignored, CORS, and what `.gitignore` misses. List variable names only.
- **Prioritized remediation plan.** Ordered by risk against effort, in three tiers: do immediately, do before the next defense, and do before any real deployment. For each item, say what the fix is in principle, without writing the code.
- Map findings to the Data Privacy Act obligations we committed to in the proposal, so this connects to panel comment D2.
- Note clearly that this is a review of our own system for the purpose of fixing it.

## `docs/phase-1b-deep-map/01D-restructure-plan.md`
A plan to reorganize the codebase. Plan only, no files moved.

- **Target structure.** Start from the reference layout below. Adapt it for TypeScript and for the fact that we also have a Vite React frontend, which the reference does not cover. Present the final proposed tree in full.
- **How you adapted it and why.** Where you departed from the reference, explain the reason. If there is a genuine choice to make, for example whether the frontend and backend become separate workspaces or stay in one root, present the options with trade-offs and recommend one.
- **Move map.** A table: current file or code region, destination file, what has to change (imports, exports, shared types, config paths). For `server.ts`, break it down route group by route group, naming which routes become which feature module.
- **Splitting `server.ts`.** Explain the routes, controller, service, repository, validation split in plain language, with one worked example using a real route from our code so the pattern is concrete.
- **Frontend reorganization.** How components, context, hooks, API access, and types get grouped, and how to introduce a single API client instead of scattered `fetch("http://localhost:4000/...")` calls.
- **Ordered migration steps.** Small, independently verifiable steps, each one leaving the app working. For each step: what moves, what could break, how to check it still runs, and how to undo it.
- **Risks.** What is most likely to break during the move, and what we should do first to reduce that risk. Be direct if you think some part should be rewritten rather than moved.
- **What this does not fix.** Structure is not the same as correctness. Say which findings from 01B survive the reorganization untouched.

### Reference structure
```
project-root/
├── .env
├── .env.example
├── .gitignore
├── package.json
├── README.md
│
├── src/
│   ├── server.js
│   ├── app.js
│   │
│   ├── config/
│   │   ├── env.js
│   │   └── database.js
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   ├── auth.repository.js
│   │   │   ├── auth.validation.js
│   │   │   └── auth.test.js
│   │   │
│   │   └── assets/
│   │       ├── assets.routes.js
│   │       ├── assets.controller.js
│   │       ├── assets.service.js
│   │       ├── assets.repository.js
│   │       └── assets.test.js
│   │
│   ├── shared/
│   │   ├── middleware/
│   │   │   ├── errorHandler.js
│   │   │   └── requireAuth.js
│   │   ├── utils/
│   │   │   ├── logger.js
│   │   │   └── date.js
│   │   └── errors/
│   │       └── AppError.js
│   │
│   └── db/
│       ├── migrations/
│       └── seeds/
│
└── docs/
```

## `docs/phase-1b-deep-map/01E-onboarding-roadmap.md`
The front door. Assume the reader opens this file first and has read nothing else.

- What the system is, who uses it, and what each role does, in plain language.
- How to get it running locally, derived from what is actually in `package.json` and the config files. Flag any step that is currently broken or undocumented.
- A guided tour: "if you want to understand X, read these files in this order." Cover at least login, borrowing, and one admin flow.
- A "where do I change this" table: common tasks mapped to the files you would touch.
- Vocabulary used in this project, including any place where our naming is inconsistent or misleading.
- Known traps for newcomers: things that look like they work but do not, names that mean something unexpected, and code paths that are dead.
- Links into the other four documents for detail.

# Format
- Markdown, bulleted, clear section headers, table of contents in each file.
- For every major point give two versions:
  - **Technical:** for developers.
  - **Simple:** plain language for someone new to backends.
- File references as relative links with line numbers, for example `../../server.ts#L559`. These documents live in `docs/phase-1b-deep-map/`, so repo-root files are two levels up. Links between the five documents in this folder are plain filenames.
- Mermaid for diagrams.
- No em dashes.
- Be direct. If something is bad, say it is bad and say why. Do not hedge to be polite.

# Method
- Read the code before describing it. Do not infer behavior from file names.
- When you state that something happens, cite the file and line.
- When you are uncertain, say so and say what you would need to check. Do not guess and present it as fact.
- Keep a running list of open questions for me. Add them to `docs/HANDOFF.md` by appending a new section at the end. Do not edit, reorder, or delete anything already in that file.

# Stop points
- Stop after `01A-system-trace.md` and `01B-findings-register.md` and wait for my approval before continuing. Those two anchor everything else, so I want to check them first.
- After that, continue through 01C, 01D, and 01E.
- Update `docs/HANDOFF.md` after each document with: what is done, key findings, open questions, and the exact next step.
- After each document, append a new section to `docs/HANDOFF.md` under a heading naming the phase and document, for example `## Phase 1B, 01A system trace, 2026-09-18`. Include what is done, key findings, open questions, and the exact next step. Append only. Never rewrite or remove existing content.
- If the session gets long, stop at the end of the current document and point me to `HANDOFF.md` so I can continue in a new chat.
