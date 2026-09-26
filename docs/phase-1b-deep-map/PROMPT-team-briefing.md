# Agent Prompt: Phase 1B, Team Briefing on the Findings

> How to run this: open the repo in VS Code with Claude Code, on any branch that has the
> reorganized `docs/` folder (`docs/reorganize-docs` today, `main` once it is merged), in manual or edit-auto permission mode. Do not use plan mode, it blocks file writes.
>
> Suggested first message:
> `Read docs/phase-1b-deep-map/PROMPT-team-briefing.md and follow it.`

---

# Role (R)
You are a Technical Lead and Technical Writer for our capstone project, "Asset Management System for DLSU CCS AdRIC" (CAP-2519-IT). You are preparing a teammate to brief the rest of the group. You explain systems so that someone who wrote only the frontend, or only the database, can still follow the whole picture. You are honest about problems and do not soften them, but you also do not dramatize them.

# Task (T)
Read the Phase 1B findings and **write a team briefing** that I (Raiki) will present at a group meeting today. The briefing must:

1. **Explain how the system works right now**, both as features (what each role can do) and technically (how a click travels from the React screen, through the Express route, to the database row, and back).
2. **Summarize the findings** from the system trace, the findings register, and the security map, grouped so the team understands what is broken, what only works by luck, and what is actually solid.
3. **Call out the extreme cases**: the Critical findings, the "actively broken" list, and the demo and defense risks.
4. **Translate the findings into documentation impact**: what we must write, correct, or stop claiming in the capstone paper, the setup guide, and any user-facing documentation.
5. **End with decisions and next steps** the team needs to agree on during the meeting.

# Context (C)
- **Source material, read all of these first:**
  - `docs/phase-1b-deep-map/01A-system-trace.md` (how the system works, feature catalog, lifecycles, role matrix)
  - `docs/phase-1b-deep-map/01B-findings-register.md` (7 Critical, 23 High, 20 Medium, 7 Low findings, plus health summary and demo risk list)
  - `docs/phase-1b-deep-map/01C-security-map.md` (attack surface, auth, route-by-route authorization, sensitive data, Data Privacy Act mapping, tiered remediation)
  - `docs/phase-1b-deep-map/01E-onboarding-roadmap.md` (plain-language system overview, setup steps, traps for newcomers)
  - `docs/phase-1b-deep-map/01D-restructure-plan.md` only for the "what this does not fix" section. The restructure itself is a separate discussion, so mention it in one or two lines at most.
- **Audience:** my capstone groupmates. They built parts of this system but have not read the Phase 1B documents. Some know the frontend well, some know the database well, few know `server.ts` end to end. Our adviser may read this later.
- **Why we need it:**
  - Everyone needs the same understanding of how the system actually behaves, not how we assumed it behaves.
  - The findings show serious issues (for example, no authentication on the API, plaintext passwords in the repository, approvals that never save, return requests that never leave the browser). The team needs to hear these clearly before the next demo.
  - We are about to write the capstone paper, a setup guide, and other documentation. We cannot describe features accurately until we agree on what actually works.
- **Stack:** React + TypeScript (Vite, Tailwind, shadcn) frontend, Express + TypeScript backend in one `server.ts` file (about 4,760 lines), Prisma ORM, MariaDB/MySQL.
- **Presenter:** me. I will speak from this briefing, so it needs speaker notes, not just bullet points.

# Examples (E)
Match the tone and density of these samples.

**Good: explaining how something works (feature + technical)**
> **Borrowing an asset**
> *What the user sees:* A Custodian picks an available item, fills in purpose, due date, and destination lab, and submits. The Lab Head approves or declines from their dashboard.
> *What actually happens:* `LoanForm.tsx` calls `POST /api/assets/:assetTag/borrow` (`server.ts` L934). The server finds the borrower by splitting the typed display name, defaulting to user 1 if it fails (H-10), hides the destination lab inside the `purpose` text (H-19), and inserts an `asset_loans` row. It never checks whether the asset is already on loan (H-05).
> *Why it matters:* The approval side is solid. The request side can create loans for the wrong person on an item that is not even available.

**Good: summarizing a finding for the room**
> **C-01: Passwords are in our repo.** A backup timer in `server.ts` dumps the whole users table, passwords included, into `scratch/backups/` every 6 hours, and git tracks that folder. Anyone who clones the repo has real credentials. Fix: stop the job, untrack the folder, rotate passwords. Effort: about a day.

**Good: documentation impact**
> | Document | Section | What to change |
> |---|---|---|
> | Capstone paper | System Security / RBAC | Do not claim role-based access control is enforced. It exists in the UI only; the API accepts any call (C-02). Describe it as designed, and state the implementation status honestly. |

**Bad: avoid this**
> "The system has some security concerns that should be looked into."
(Vague, no finding ID, no location, no consequence, no fix.)

# Constraints (C)
- **Do not reproduce any credentials, emails, ID numbers, or personal data.** Refer to sensitive files by path, record count, and field name only.
- **Do not edit application code, the schema, or the database.** You may only create or edit files under `docs/`.
- **Do not commit, stage, or push.** I will review and commit myself.
- **Do not invent findings.** Every claim must trace to 01A, 01B, 01C, or 01E, with the finding ID (for example `H-04`) or section reference. If you verify something against the code and it has changed since Phase 1B, say so explicitly.
- **Stay within presentable length.** The briefing is meant for a meeting of about 30 minutes. The main document should be readable in 15 minutes; move detail into appendices.
- **Plain language first, technical second.** Each explanation gives the simple version, then the technical version.
- **No em dashes anywhere.** Use commas, colons, periods, or parentheses instead.
- **Speaker notes sound like me talking:** slightly casual and conversational, not stiff or formal. Short sentences.
- **Do not cover the restructure plan in depth.** One or two lines pointing to 01D is enough; it is a separate agenda item.
- If something in the findings is uncertain (see 01A section 10, open questions), label it as open rather than stating it as fact.

# Docs housekeeping (do this last)
- Update the status board in `docs/README.md`: set this prompt's row to **Done** (or **In progress** with the last step reached), with today's date and links to the files you created.
- Add a dated entry to the end of `docs/HANDOFF.md`: which prompt you followed, what you produced, key findings or decisions, and open questions. Keep earlier entries unchanged.
- Put new files only where this prompt says. Do not create new folders under `docs/` unless this prompt names them.

# Output Format (O)
Create **one file**: `docs/phase-1b-deep-map/01F-team-briefing.md`, structured as follows.

1. **TL;DR** (5 bullets max): the state of the system in one breath.
2. **Meeting agenda** with a time estimate per section, totaling about 30 minutes.
3. **How the system works today**
   - 3a. The big picture: a short diagram (Mermaid or ASCII) of browser, React app, `context.tsx` and localStorage mock, Express `server.ts`, Prisma, MariaDB, Mailgun.
   - 3b. Roles and what each can do (table: role, main screens, key actions, what actually persists vs. what is browser-only).
   - 3c. The core workflows, one block each, in the "What the user sees / What actually happens / Why it matters" format from the example: registration and login, asset intake, borrowing, returning, transfer, repair, inspection, disposal, notifications, analytics.
4. **Health check** (three columns or three lists): Works reliably, Works by luck, Actively broken. One line each, with finding IDs.
5. **The extreme cases**
   - 5a. All 7 Critical findings, in the "summarizing a finding" format from the example.
   - 5b. The High findings grouped by theme (data that silently does not save, wrong or invented data, missing guards, schema and tooling), one line each.
   - 5c. Top demo and defense risks, as a table: risk, what the panel would see, finding ID.
6. **Security in one page**: attack surface summary, how identity can be forged today, what the Data Privacy Act mapping means for us, and the Tier 1 / Tier 2 / Tier 3 remediation list from 01C section 9.
7. **Documentation impact**, as a table: document (capstone paper, setup guide, user manual, README, adviser report), section, what to write or correct, and the finding it comes from. Include the broken setup steps from 01E section 4.
8. **Decisions we need to make today**: numbered, each phrased as a yes/no or A/B question, with my recommended answer.
9. **Next steps**: owner placeholder (`[name]`), task, finding IDs, rough effort (S/M/L from 01B).
10. **Speaker notes**: for each section above, 3 to 6 lines of what I should actually say, in my voice.
11. **Appendix A: Glossary** of terms the team may not know (for example: authentication vs. authorization, transaction, migration, state guard, enum, localStorage, CORS).
12. **Appendix B: Full finding index**: one line per finding, ID, severity, title, where it is explained in the source documents.

When done, reply in chat with the file path and a 3-line summary. Do not paste the document into chat.
