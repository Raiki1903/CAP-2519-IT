# Agent Prompt: Developer Structure Guide

> How to run this: open the repo in VS Code with Claude Code, in manual or edit-auto permission
> mode. Do not use plan mode, it blocks file writes. Work on a `docs/` branch created from an
> up-to-date `main` (see `docs/guides/GIT-WORKFLOW.md` if it exists).
>
> This can run before the restructure is finished. The guide describes the target structure
> and maps it to where things live today, so it is useful now and stays useful after.
>
> Suggested first message:
> `Read docs/phase-1c-restructure/PROMPT-3-structure-guide.md and follow it.`

---

# Role (R)
You are a Technical Writer and Senior Developer writing the day-to-day developer guide for our capstone project, "Asset Management System for DLSU CCS AdRIC" (CAP-2519-IT). Your reader is a teammate who knows React or SQL but has never worked in a layered backend. You teach by tracing real transactions, not by describing architecture in the abstract.

# Task (T)
**Write a developer guide** that explains:
1. What the project structure is and why it is shaped that way.
2. How a transaction travels through the code, traced step by step for real workflows.
3. How to use the structure day to day: where to change something, how to trace a bug, and how to add a new feature.

# Context (C)
- **Read first:** `docs/phase-1b-deep-map/01D-restructure-plan.md` (sections 1 to 5, the target structure and layers), `docs/phase-1c-restructure/01-restructure-decision.md` if it exists, `01A-system-trace.md` section 6 (feature catalog, for the real endpoints and components), `01E-onboarding-roadmap.md` sections 6 to 8 (where to change things, vocabulary, traps), and `docs/phase-1c-restructure/02-restructure-log.md` if it exists (to see which steps are done). Also read `docs/guides/CODE-COMMENTS.md` if it exists; the guide links to it instead of repeating it.
- **The agreed structure (Option A):**
  - `shared/`: enums, types, constants used by both sides. Imports nothing from `server/` or `web/`.
  - `web/pages/<role>/` (staff, lab-head, custodian, director): screens only. They arrange feature components and never fetch data.
  - `web/features/<process>/`: forms, lists, dialogs for one process.
  - `web/api/<process>.api.ts`: the only place a URL appears.
  - `server/features/<process>/`: `routes` (who may call), `validation` (is the input valid), `controller` (HTTP in and out), `service` (business rules), `repository` (the only layer that calls Prisma).
  - `server/shared/`: middleware (`requireAuth`, `requireRole`, `errorHandler`), services (`mailer`, `assetState`), utils.
  - `prisma/`: schema, migrations, seed.
- **The request path to teach:** page, then feature component, then api file, then HTTP, then routes, validation, controller, service, repository, database, and back the same way.
- **Audience:** my capstone groupmates now, future maintainers after us, and our adviser. The guide will also feed the setup guide and the system architecture chapter of the capstone paper.
- **The restructure may be partly done.** Check the repo and the log. Every place the guide names a target path, also show where that code lives today if it has not moved yet.

# Examples (E)
Match this style for the transaction traces:

```
web/pages/staff/Inventory.tsx
 └─ web/features/disposals/DisposalFormDialog.tsx
     └─ web/api/disposals.api.ts → fileDisposal()
         └─ POST /api/assets/:tag/disposal
             └─ server/features/disposals/
                 ├─ routes       requireRole("STAFF")
                 ├─ validation   pathway from shared/enums
                 ├─ service      save pathway and date as real columns (M-13)
                 │               email Directors via shared/services/mailer (H-20)
                 └─ repository   insert asset_disposals as pending
```
> **Today:** `DisposalFormDialog` is inside `src/app/components/ITSDashboard.tsx` (about L2702) and the handler is `server.ts` about L1720.

Match this style for the "where do I change this" table:

| I want to... | Go to | Today (if not yet moved) |
|---|---|---|
| Change who is allowed to do something | `server/features/<process>/*.routes.ts` | Nothing enforces it yet (C-02) |

Use this analogy set for the layers, so the whole team uses the same words: routes are the **signpost**, validation is the **bouncer**, controller is the **receptionist**, service is the **decision maker**, repository is the **filing clerk**.

# Constraints (C)
- **Documentation only.** Create or edit files under `docs/` only. Do not change code, the schema, or the database.
- **Do not commit to `main`.** You may commit on the current `docs/` branch. Do not push.
- **Trace real code.** Every trace must use real component names, endpoints, and tables from this repo. Verify each one; do not copy from 01A without checking.
- **Separate today from the target.** Mark clearly which parts of a trace are the target state and which findings (by ID) the target fixes. Never describe a fix as done unless the log or the code shows it is done.
- **Plain language first, then technical.** Explain any term a beginner may not know the first time it appears, and add it to the glossary.
- **No em dashes anywhere.** Use commas, colons, periods, or parentheses.
- **Keep it usable.** The main guide should be readable in about 20 minutes. Put the long reference tables in appendices.
- Do not reproduce credentials or personal data from any file.

# Docs housekeeping (do this last)
- Update the status board in `docs/README.md`: set this prompt's row to **Done** (or **In progress** with the last step reached), with today's date and links to the files you created.
- Add a dated entry to the end of `docs/HANDOFF.md`: which prompt you followed, what you produced, key findings or decisions, and open questions. Keep earlier entries unchanged.
- Put new files only where this prompt says. Do not create new folders under `docs/` unless this prompt names them.

# Output Format (O)
Create **one file**: `docs/guides/DEVELOPER-GUIDE.md`, structured as follows.

1. **Start here:** what this guide is for, and the one-sentence rule: *pages decide what a role sees, features decide how a process works.*
2. **The structure:** the condensed folder tree, with a one-line purpose for each top-level folder.
3. **Why it is shaped this way:** a short explanation of feature folders, the role-based pages layer, and `shared/`. Link to `docs/phase-1c-restructure/01-restructure-decision.md` for why page-first was rejected; do not repeat that argument.
4. **The layers:** a table (layer, its one job, analogy, what it may import). Then a small diagram of the request path.
5. **Traced transactions**, one block each in the example style, each with a "Today" note:
   - 5a. Asset registration (Staff)
   - 5b. Borrowing (Custodian requests, Lab Head approves)
   - 5c. Returning (Custodian returns, Staff finalizes)
   - 5d. Repair (Custodian requests, Staff updates progress)
   - 5e. Disposal (Staff files, Director decides, including the notification panel path)
   - 5f. Viewing the inventory (`GET /api/assets`, one endpoint used by every role's pages)
6. **Where do I change this?** The table from the example, covering at least: screen layout, a form or list, a URL, permissions, input rules, business rules, queries, statuses and enums, lab list, request/response shapes, emails, the database schema.
7. **How to trace a bug in five steps**, starting from the page where it was seen.
8. **How to add a feature**, as a numbered recipe with a worked example (for example, "extend a loan's due date"), from `shared/types` through server, api file, feature component, and page.
9. **The rules**, numbered, each with one line on why:
   1. Only repository files call Prisma.
   2. Only `web/api/` files contain URLs.
   3. Pages do not fetch data.
   4. `shared/` imports nothing from `server/` or `web/`.
   5. One commit either moves code or changes behavior, never both.
10. **Comments:** three lines summarizing the comment standard (file header, TSDoc on exports, inline comments only for why) and a link to `docs/guides/CODE-COMMENTS.md`.
11. **Common mistakes**, from 01E section 8, updated for the new structure.
12. **Appendix A: Process map:** each process, its web feature folder, its api file, its server feature folder, its main tables, its endpoints, and where it lives today.
13. **Appendix B: Glossary.**

When done, reply in chat with the file path and a 3-line summary. Do not paste the guide into chat.
