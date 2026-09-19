# 01B. Findings Register

Project: CAP-2519-IT. Phase 1B. Date: 2026-09-18.
Companion to [01A-system-trace.md](01A-system-trace.md), which explains how the system works. This document lists what is wrong with it.

---

## Table of contents

1. [Severity definitions](#1-severity-definitions)
2. [Master table](#2-master-table)
3. [Critical findings in detail](#3-critical-findings-in-detail)
4. [High findings in detail](#4-high-findings-in-detail)
5. [System health summary](#5-system-health-summary)
6. [Demo and defense risk list](#6-demo-and-defense-risk-list)

---

## 1. Severity definitions

| Severity | Meaning |
|---|---|
| **Critical** | Exploitable or already harmful right now, with severe consequence: credentials exposed, any stranger can act as any role, or personal data is published. Fix before anything else, including before the next demo. |
| **High** | Causes silent data loss, wrong records, or wrong decisions during normal use. The system appears to work while producing incorrect data. |
| **Medium** | Real defect or serious maintainability problem. Wastes effort, produces confusing behavior, or will block the Phase 3 database work. |
| **Low** | Cosmetic, noisy, or minor cleanup. Worth doing, safe to defer. |

Effort: **S** up to one day, **M** one to three days, **L** more than three days or structural.

Categories: Security, Privacy compliance, Data integrity, Correctness, Reliability, Performance, Maintainability.

---

## 2. Master table

### Critical

| ID | Category | Title | Location | What happens | Why it matters | Fix direction | Effort |
|---|---|---|---|---|---|---|---|
| C-01 | Privacy compliance | User table with plaintext passwords committed to the repository | [server.ts#L4717-L4750](../../server.ts#L4717-L4750), `scratch/backups/` (113 files) | A timer dumps all users, including the password field, to JSON every 6 hours and at startup. The files are tracked by git | Real credentials and ID numbers of 25 people are in the repo and in every clone. Direct breach of the Data Privacy Act commitment in panel comment D2 | Stop dumping `users`. Remove the folder from tracking and add it to `.gitignore`. Rotate every affected password. Decide with the adviser whether git history must be rewritten | M |
| C-02 | Security | The API has no authentication or authorization at all | whole of [server.ts](../../server.ts); `app.use(cors())` at [L11](../../server.ts#L11) | No middleware, no token, no session check, no ownership check on any of the 62 routes. CORS is open to every origin | Anyone who can reach port 4000 can read every record and approve, delete, or create anything. The role system is decoration | Add a session or token layer, a `requireAuth` middleware, and per-route role checks. Restrict CORS to the frontend origin | L |
| C-03 | Security | Passwords are stored, compared, and transported in clear text | [server.ts#L3641](../../server.ts#L3641), [L3845](../../server.ts#L3845), [L3894-L3898](../../server.ts#L3894-L3898), [prismaClient.ts#L202-L214](../../src/app/prismaClient.ts#L202-L214) | Registration writes the raw password; login puts it in the SQL `WHERE`; the browser mock seeds 11 demo passwords | One database read exposes every account. Login is also unthrottled and unlogged | Hash with bcrypt or argon2 at registration, compare on the server, never select the column into responses | M |
| C-04 | Privacy compliance | Open endpoint returns pending registrations including passwords | [server.ts#L3717-L3719](../../server.ts#L3717-L3719) | `GET /api/auth/pending-registrations` returns the whole pending list with the `password` field, unauthenticated | Anyone on the network can harvest credentials of people who have not even been approved yet | Require Lab Head authentication, strip the password field from the response, and stop storing it in the file at all | S |
| C-05 | Security | Anyone can create an account, with a role, by calling one endpoint | [server.ts#L3769-L3789](../../server.ts#L3769-L3789) | If the request id is unknown, the handler builds the user from the request body and creates it | Privilege escalation to LAB_HEAD or ADMIN without touching the UI. Combined with C-02, this is a one-request takeover | Remove the body fallback. Require an authenticated Lab Head and an existing pending record | S |
| C-06 | Security | The session is a plain, unsigned cookie holding an email address | [context.tsx#L466-L509](../../src/app/context.tsx#L466-L509), [server.ts#L3966](../../server.ts#L3966) | On load, the app sends whatever email is in `session_user_email` to `/api/auth/me` and adopts the role it gets back | Editing one cookie value in dev tools turns a student into the AdRIC Director. No password is involved | Replace with a signed, httpOnly session cookie or a JWT issued at login, validated server-side | M |
| C-07 | Security | Live database credentials hardcoded as fallbacks in tracked code | [prisma.ts#L5-L15](../../prisma.ts#L5-L15) | Host, port, user, database, and password all have literal defaults, used whenever the environment variables are absent. No `.env` exists in this working copy | The shared `ccscloud` database can be reached by anyone with the repo. The fallback also hides a missing configuration instead of failing | Remove all fallbacks, fail fast on missing variables, add `.env.example` with names only, and rotate the database password | S |

### High

| ID | Category | Title | Location | What happens | Why it matters | Fix direction | Effort |
|---|---|---|---|---|---|---|---|
| H-01 | Data integrity | Notification Center approvals for transfers and disposals never reach the database | [NotificationCenter.tsx#L757-L790](../../src/app/components/NotificationCenter.tsx#L757-L790) calling [context.tsx#L813-L936](../../src/app/context.tsx#L813-L936) | The buttons call localStorage-only actions. The UI shows success | A Director believes a disposal is authorized; the database still says pending. Two sources of truth diverge permanently | Point both buttons at the real decision endpoints, delete the mock actions | S |
| H-02 | Data integrity | Custodian return requests exist only in the submitting browser | [ReturnForm.tsx#L54-L64](../../src/app/components/ReturnForm.tsx#L54-L64), read back at [ITSDashboard.tsx#L2115](../../src/app/components/ITSDashboard.tsx#L2115) | Stored in `localStorage.ems_returns` | TSG never sees the request on their own machine. The "Pending Returns Ledger" is empty for everyone except the person who filed it | Add a pending state to returns in the database (Phase 3 schema work) and post the request | M |
| H-03 | Data integrity | Deleting an asset destroys its whole history, and fails outright if it was ever inspected | [server.ts#L895-L926](../../server.ts#L895-L926) | Seven child tables are deleted, `asset_reports` is not, so the FK blocks the delete. When it does succeed, custody history is gone | Audited equipment records vanish with no trace. The 500 error is also confusing to staff | Replace hard delete with a retired or archived state. If deletion must stay, include every child table and restrict it to an admin role | M |
| H-04 | Correctness | A return never closes its loan | [server.ts#L1326-L1413](../../server.ts#L1326-L1413) vs [L2776-L2779](../../server.ts#L2776-L2779) | `asset_returns` is written, `asset_loans.status` stays `approved`. The delinquency query filters on a `returned` status that nothing writes | Every returned item is reported as an outstanding delinquency forever. Accountability analytics are wrong | Link the return to the loan and set a terminal status, or derive the state from the record log consistently | M |
| H-05 | Data integrity | No endpoint checks an asset's current state before acting on it | [server.ts#L934](../../server.ts#L934), [L1454](../../server.ts#L1454), [L1720](../../server.ts#L1720) | You can borrow an asset that is on loan, transfer one in maintenance, or dispose of one that is out with a student | The custody log can describe physically impossible situations. This is exactly the integrity gap the panel pointed at | Add state guards in the service layer now, and the same rules as database triggers in Phase 3 | M |
| H-06 | Correctness | Two repair endpoints with different side effects | [server.ts#L1198](../../server.ts#L1198) and [L4690](../../server.ts#L4690) | The dialog route also moves the asset in and out of MAINTENANCE; the kanban route only updates the ticket | The same action produces different data depending on which screen staff used. Asset status silently drifts from the repair record | Delete the second endpoint, route both screens to one handler | S |
| H-07 | Data integrity | Workflow status columns are free text and accept anything | [schema.prisma#L15](../../prisma/schema.prisma#L15), [L167](../../prisma/schema.prisma#L167), [L196](../../prisma/schema.prisma#L196), [L60](../../prisma/schema.prisma#L60) | `VARCHAR` columns for loan, transfer, disposal, and repair status. `progress_status` takes any string at [L1208-L1225](../../server.ts#L1208-L1225) | "Waiting for Parts" already exists in live data and matches none of the code paths, so those assets are stuck in an unhandled state. Panel comment S7 | Convert to enums or lookup tables with FK constraints in Phase 3, and validate at the boundary now | M |
| H-08 | Reliability | A GET endpoint writes to the database | [server.ts#L297-L316](../../server.ts#L297-L316) | `GET /api/asset_loans` inserts a hardcoded loan with id 9 when no pending loan exists, and renames its asset in the response | Refreshing a page creates data. Demo data appears from nowhere and cannot be explained to a panel | Delete the block. Put demo data in a proper seed script | S |
| H-09 | Correctness | Analytics invent data when the database is empty | [server.ts#L2078-L2085](../../server.ts#L2078-L2085), [L2097](../../server.ts#L2097), [L2120](../../server.ts#L2120), [L4254](../../server.ts#L4254) | Fixed demo series are returned for degradation, repair frequency, disposal volume, and audit compliance | Charts show confident numbers that describe nothing. If a panel member asks where a figure came from, there is no answer | Return empty arrays and let the UI show an empty state | S |
| H-10 | Data integrity | The acting user is guessed from a typed display name, defaulting to user 1 | [server.ts#L955](../../server.ts#L955), [L1108](../../server.ts#L1108), [L1351](../../server.ts#L1351), [L1742](../../server.ts#L1742), default at [L18](../../server.ts#L18) | First name and last name are split from a string and matched. No match means user 1 | Custody, reporter, and approver fields are unreliable, and user 1 accumulates other people's actions. Chain of custody is not defensible | Send the authenticated user id with every request once C-02 is fixed, and make these columns non-guessable | M |
| H-11 | Data integrity | Uniqueness and state checks happen outside their transactions | [server.ts#L534-L554](../../server.ts#L534-L554), [L1006-L1013](../../server.ts#L1006-L1013), [L1614-L1622](../../server.ts#L1614-L1622), [L1844-L1852](../../server.ts#L1844-L1852) | The next asset tag is computed before the transaction opens; "is it still pending" is checked before the update begins | Two simultaneous intakes collide on the unique tag; two approvers can both approve the same request | Move the read inside the transaction, or use a database sequence and a conditional update that matches on the current status |M|
| H-12 | Correctness | A compliance metric reads a column that does not exist | [server.ts#L2374-L2381](../../server.ts#L2374-L2381) | `asset_monetary.is_documented` is in neither `schema.prisma` nor the database ([reference/AdRIC_DB_Schema.sql](../reference/AdRIC_DB_Schema.sql), confirmed by the team). The `ALTER` in [scratch/add_column.ts](../../scratch/add_column.ts) was never applied | Governance and audit-readiness percentages report 0 documented assets regardless of the data, and nothing errors | Decide whether documentation status is a real requirement. If yes, add the column properly through a migration; if no, delete the metric | S |
| H-21 | Data integrity | Two of the five return conditions cannot be saved | [reference/AdRIC_DB_Schema.sql](../reference/AdRIC_DB_Schema.sql) `asset_returns.condition` vs [schema.prisma#L285-L291](../../prisma/schema.prisma#L285-L291) | The column's enum stores `MINOR DRIFT` and `CRITICAL DEFECT` with spaces. The Prisma enum has `MINOR_DRIFT` and `CRITICAL_DEFECT` with no `@map`, unlike the other two condition enums which do have it | Finalizing a return in either of those conditions fails or stores an empty value. These are exactly the conditions that matter for accountability | Add the `@map` values to `asset_returns_condition`, then verify existing rows | S |
| H-22 | Data integrity | The seeded Director holds the wrong role, and nobody holds ADRIC_DIRECTOR | [reference/AdRIC_DB_Schema.sql](../reference/AdRIC_DB_Schema.sql), `user_roles` insert row `(3, 4, 6)` | User 4, `director@dlsu.edu.ph`, is given role 6 (CUSTODIAN). No seeded user has role 2 (ADRIC_DIRECTOR) | The Director account logs in to the student portal, and `getRoleEmails("ADRIC_DIRECTOR")` ([server.ts#L1698](../../server.ts#L1698)) returns nothing, so every disposal request email goes to no one | Fix the seed. Add a check that every role in the enum has at least one holder | S |
| H-23 | Reliability | The schema file cannot be executed | [reference/AdRIC_DB_Schema.sql](../reference/AdRIC_DB_Schema.sql) | `VARCAHR(255)` on `asset_records.current_location` is not a MySQL type, and the `user_roles` insert ends with `;` before its last row, leaving `(14, 3, 6);` as a stray statement | The only file that claims to recreate the database stops on the third table. Nobody can stand up a fresh instance, which blocks the Phase 2 test database | Fix both typos, then keep the file as the baseline migration in Phase 3 | S |
| H-13 | Maintainability | TypeScript is never type-checked, and real type bugs are live | No `tsconfig.json` in the repo; `"build": "vite build"` in [package.json](../../package.json) | Nothing runs `tsc`. Example live bugs: `currentUser.first_name` at [ITSDashboard.tsx#L1943](../../src/app/components/ITSDashboard.tsx#L1943) (the field is `firstName`) records the inspector as "undefined undefined"; `currentUser?.user_id` at [L1973](../../src/app/components/ITSDashboard.tsx#L1973) and [CustodianPortal.tsx#L341](../../src/app/components/CustodianPortal.tsx#L341) is always undefined | The language's main safety benefit is switched off, and wrong data is being written because of it | Add `tsconfig.json`, run `tsc --noEmit` in a script and in CI, fix the fallout incrementally | M |
| H-14 | Data integrity | Editing an asset rewrites the newest history row instead of appending | [server.ts#L697-L701](../../server.ts#L697-L701), also [L833-L839](../../server.ts#L833-L839) | `asset_records.update` overwrites status, location, custodian, condition, and remarks in place | The log is described everywhere else as append-only. Editing silently erases the previous state, so history is not trustworthy | Always append a new record row; never update an existing one outside a correction workflow | S |
| H-15 | Maintainability | No migrations. The schema is changed by hand with raw SQL scripts | no `prisma/migrations` folder; [scratch/add_column.ts](../../scratch/add_column.ts), [scratch/alter_table.ts](../../scratch/alter_table.ts), [scratch/update_user_img_column.ts](../../scratch/update_user_img_column.ts) | Structure changes are applied ad hoc with `$executeRawUnsafe` and then pulled back with `db pull` | No one can recreate the database, roll back, or review a change. This is the panel's own comment, and it blocks all of Phase 3 | Adopt `prisma migrate`, baseline the current schema, and add triggers and procedures as custom SQL migrations | M |
| H-16 | Security | Raw database errors are returned to the browser | every route's catch block, for example [server.ts#L283-L286](../../server.ts#L283-L286) | `error.message` from Prisma or MariaDB is sent as JSON, including table and column names | Leaks internal structure to an unauthenticated caller and confuses users | Add one error middleware that logs the detail and returns a generic message with a code | S |
| H-17 | Privacy compliance | Sign-up requests live in a JSON file next to the code | [server.ts#L3692-L3714](../../server.ts#L3692-L3714), [pending_registrations.json](../../pending_registrations.json) | The file is the only store for pending accounts, holds plaintext passwords, and is committed | Not transactional with `users`, lost or duplicated if the server moves, and it is a second copy of personal data outside the database | Move pending registrations into a table with a status column (Phase 3), and stop storing the password until approval, or store only a hash | M |
| H-18 | Reliability | The inspection scheduling feature keeps nothing | [ITSDashboard.tsx#L294-L305](../../src/app/components/ITSDashboard.tsx#L294-L305), reset at [L1493-L1501](../../src/app/components/ITSDashboard.tsx#L1493-L1501) | Schedule dates, group progress, and inspected flags are component state. Navigating away clears them. The reset dialog assures the user that historical records remain saved | A whole management screen appears to work and stores nothing. The reassuring message makes it worse | Persist schedules and per-asset inspection state in the database, or clearly label the screen as a prototype |M|
| H-19 | Correctness | Transfer details entered by the user are dropped or hidden in text | [TransferForm.tsx#L110-L116](../../src/app/components/TransferForm.tsx#L110-L116), [server.ts#L1493-L1505](../../server.ts#L1493-L1505) | `effectiveDate` is never stored; the destination lab is concatenated into `justification` and later parsed back out with a regex | Panel comment S1 is unresolved. Text-packed data cannot be filtered, validated, or joined | Add real columns for effective date, destination lab or center id, and handover condition | M |
| H-20 | Security | User-supplied text is interpolated into emails and printed HTML without escaping | [server.ts#L1514-L1518](../../server.ts#L1514-L1518), [L1774-L1778](../../server.ts#L1774-L1778), [ITSDashboard.tsx#L2196-L2212](../../src/app/components/ITSDashboard.tsx#L2196-L2212) | Asset names, reasons, and requester names go straight into HTML strings | A crafted asset name or transfer reason can inject markup or a link into a mail sent from the institutional domain, or into a printed document | Escape all interpolated values, or use a templating library that escapes by default | S |

### Medium

| ID | Category | Title | Location | What happens | Why it matters | Fix direction | Effort |
|---|---|---|---|---|---|---|---|
| M-01 | Performance | The main asset endpoint reads nine whole tables per request | [server.ts#L64-L87](../../server.ts#L64-L87) | Every call loads all assets, monetary rows, records, users, loans, disposals, transfers, reports, and projects, then joins in JavaScript, including every base64 image | Slow and memory heavy as data grows; several screens call it on every tab change | Query per asset with filters and pagination; move images out of the row or serve them separately | M |
| M-02 | Correctness | Lab scoping is fuzzy string matching, done only in the browser | [LabHeadDashboard.tsx#L470-L488](../../src/app/components/LabHeadDashboard.tsx#L470-L488) | Two-way substring comparison between lab labels | A Lab Head can see and act on another lab's records by calling the API directly, and the matching itself can produce false positives | Scope by `center_id` in the query, enforced server-side | M |
| M-03 | Maintainability | Six disagreeing lab lists, none of them the database table | See [01A section 9.7](01A-system-trace.md#97-the-six-lab-lists) | Different lists in labs.ts, the forms, the server, and the inspection grouping | Assets are tagged with codes that some screens do not recognize. Panel comment S2 and S7 both depend on this | Serve the lab list from `research_centers` through one endpoint and delete the literals | M |
| M-04 | Correctness | Notification relevance is hardcoded to one lab | [NotificationCenter.tsx#L142](../../src/app/components/NotificationCenter.tsx#L142), [L227](../../src/app/components/NotificationCenter.tsx#L227), [L264](../../src/app/components/NotificationCenter.tsx#L264) | Lab Head notifications only match the literal "CITe4D" or "Manila" | Every other Lab Head gets an empty or wrong notification list | Compare against the signed-in user's own centers | S |
| M-05 | Correctness | Fabricated identities in the clearance list | [NotificationCenter.tsx#L150-L155](../../src/app/components/NotificationCenter.tsx#L150-L155) | Faculty status is inferred from the literal name "Felix Torres" or a "Dr." prefix, and an email is invented from the display name | Invented contact details are shown as institutional data | Use the real user record | S |
| M-06 | Maintainability | Large amounts of dead code | [01A section 3.4](01A-system-trace.md#34-dead-files) | 2,672 frontend lines unreachable; 22 of 30 analytics endpoints unreachable; 3 dead non-analytics routes; 27 scratch scripts | A newcomer cannot tell which analytics implementation is real. Maintenance effort is doubled | Decide per component: re-attach or delete. Do it as part of the Phase 1D restructure | M |
| M-07 | Reliability | Every repair request is submitted twice | [RepairForm.tsx#L116](../../src/app/components/RepairForm.tsx#L116) then [L135](../../src/app/components/RepairForm.tsx#L135) into [context.tsx#L642-L657](../../src/app/context.tsx#L642-L657) | Two POSTs; the second is normally rejected by an 8-second in-memory duplicate guard at [server.ts#L1089](../../server.ts#L1089) | The guard hides the bug and does not survive a restart or a second server process. A slow first request can let both through | Remove the second call; keep idempotency in the database rather than in memory | S |
| M-08 | Maintainability | The API base URL is hardcoded in more than twenty places | for example [LoanForm.tsx#L103](../../src/app/components/LoanForm.tsx#L103), [context.tsx#L278](../../src/app/context.tsx#L278) | `http://localhost:4000` literals, no env var, no Vite proxy | The app only runs where the API runs. Nothing can be deployed or demoed from another machine | One API client module reading `import.meta.env.VITE_API_URL` | S |
| M-09 | Correctness | "Newest record" ordering is unreliable | `DATETIME(0)` columns; tie-break only at [server.ts#L67-L69](../../server.ts#L67-L69) | Ordering by `date_logged DESC` with 1-second resolution and no secondary key in the write paths | Two records in the same second can invert, so the wrong custody state is read back | Order by `(date_logged DESC, asset_record_id DESC)` everywhere, or use an auto-increment cursor | S |
| M-10 | Maintainability | Native `alert` and `confirm` used for workflow decisions | [ITSDashboard.tsx#L1499](../../src/app/components/ITSDashboard.tsx#L1499), [L2010](../../src/app/components/ITSDashboard.tsx#L2010), [LabHeadDashboard.tsx#L717](../../src/app/components/LabHeadDashboard.tsx#L717), [context.tsx#L1083](../../src/app/context.tsx#L1083) | Blocking browser dialogs, including for approvals | Inconsistent with the rest of the UI and impossible to style or test | One dialog and toast component used everywhere | S |
| M-11 | Correctness | Role mapping gaps | [server.ts#L3918-L3928](../../server.ts#L3918-L3928), [L3796-L3801](../../server.ts#L3796-L3801) | `ITS_STAFF` falls through to Custodian; `ADRIC_SECRETARY` gets the ITS dashboard; multi-role users get only the first match; Director, Secretary, and ITS_STAFF accounts cannot be created through the app | Staff get the wrong portal and the role table is not usable as designed | Define the mapping in one table, support multiple roles, and cover every enum value | M |
| M-12 | Correctness | A dead endpoint would permanently stall a transfer | [server.ts#L4109-L4129](../../server.ts#L4109-L4129) | `/accept` sets status `pending_approver`, which `/decision` then refuses at [L1614](../../server.ts#L1614) | A future caller, or anyone probing the API, can freeze a transfer with no way back through the UI | Delete the route or finish the three-step handshake properly | S |
| M-13 | Data integrity | Disposal details are packed into one text column and parsed back with regex | [server.ts#L1749-L1756](../../server.ts#L1749-L1756), parsed at [L152-L157](../../server.ts#L152-L157) | Pathway, last custodian, and target date are concatenated | Cannot be reported on, and a stray line break corrupts the parse | Give each value its own column, with the pathway as a lookup table | S |
| M-14 | Correctness | Lab Head analytics break for a user with no center row | [LabHeadDashboard.tsx#L468](../../src/app/components/LabHeadDashboard.tsx#L468), consumed at [server.ts#L4301-L4305](../../server.ts#L4301-L4305) | The fallback is a long lab name, used as an asset tag prefix | Every chart silently returns zero rows instead of reporting the problem | Remove the literal fallback and show an explicit "no lab assigned" state | S |
| M-15 | Correctness | QR flow has no recorded manual fallback (panel D1) | [CustodianPortal.tsx#L200-L270](../../src/app/components/CustodianPortal.tsx#L200-L270), [L670-L680](../../src/app/components/CustodianPortal.tsx#L670-L680) | Camera or uploaded image only. The encoded URL points at a domain that does not exist | The documented manual override protocol has no system counterpart, and nothing records that a scan was bypassed | Add typed tag entry plus an override reason and verifier, stored on the transfer | M |
| M-16 | Correctness | Acquisition value cannot be corrected after intake | [server.ts#L667-L675](../../server.ts#L667-L675) | The upsert updates only `funding_source` | A typo in an asset's value is permanent through the UI | Include the value in the update branch | S |
| M-17 | Performance | Images are base64 in the database and in every payload | `LONGTEXT` columns, 50 MB JSON limit at [server.ts#L12](../../server.ts#L12) | Asset and user images are stored inline and returned with list endpoints | Row and response sizes grow without limit; the 50 MB limit is itself a denial-of-service surface | Store files outside the database and keep a path or id | M |
| M-18 | Reliability | No tests of any kind | no test runner in [package.json](../../package.json) | Zero automated coverage | Every change is verified by hand. Phase 2 has to introduce the harness from nothing | Add Vitest plus a test database, starting with the Phase 2 specification | M |
| M-19 | Privacy compliance | `.gitignore` does not cover the data files | [.gitignore](../../.gitignore) | Ignores node_modules, dist, .env, generated client, caches. Does not ignore `scratch/backups/` or `pending_registrations.json` | This is the mechanism by which C-01 happened, and it will happen again after any cleanup | Add both paths, and ignore `scratch/` output generally | S |
| M-20 | Maintainability | Documentation describes a structure that no longer exists | [docs/MERGE_NOTES.md#L10-L11](../MERGE_NOTES.md#L10-L11) | States that `server.ts` imports the client from `./generated/prisma`, which the current schema does not produce | A newcomer following the notes looks for a folder that is not there | Update or mark as historical |S|

### Low

| ID | Category | Title | Location | What happens | Fix direction | Effort |
|---|---|---|---|---|---|---|
| L-01 | Maintainability | Emoji console logging everywhere, including full request bodies | [server.ts#L515](../../server.ts#L515), [L529](../../server.ts#L529) | Request payloads and image lengths printed to the terminal | Replace with a logger that has levels and redaction | S |
| L-02 | Reliability | Artificial one-second delay on login | [Login.tsx#L79-L84](../../src/app/components/Login.tsx#L79-L84) | `setTimeout` before navigating | Remove | S |
| L-03 | Maintainability | `@types/react` v19 against React 18 runtime | [package.json](../../package.json) | Type definitions do not match the runtime. Currently harmless only because nothing type-checks (H-13) | Align versions when adding `tsconfig.json` | S |
| L-04 | Maintainability | The seed script is broken | [test-user.ts](../../test-user.ts) | `npm run seed` writes fields that no longer exist and throws | Rewrite as a real seed once Phase 3 defines the data | S |
| L-05 | Security | Session cookies have no `Secure`, `SameSite`, or `HttpOnly` flags | [context.tsx#L5-L13](../../src/app/context.tsx#L5-L13) | Written from JavaScript with path only | Becomes relevant as soon as C-06 is fixed; set the flags then | S |
| L-06 | Maintainability | Vite resolves `figma:asset/*` to a folder that does not exist | [vite.config.ts#L7-L17](../../vite.config.ts#L7-L17) | Dead build hook for `src/assets` | Delete | S |
| L-07 | Maintainability | Inconsistent endpoint naming | `/api/asset-reports` vs `/api/asset_reports` ([server.ts#L865](../../server.ts#L865), [L380](../../server.ts#L380)) | Two spellings, two shapes, both live | Settle on one convention during the restructure | S |

---

## 3. Critical findings in detail

### C-01 Plaintext passwords and personal data committed to the repository

- **Technical:** `performDatabaseBackup()` ([server.ts#L4717](../../server.ts#L4717)) selects `assets`, `users`, `asset_transfers`, `asset_repairs`, and `asset_loans` and writes them verbatim to `scratch/backups/backup-<epoch>.json`, at startup and every 6 hours ([L4750](../../server.ts#L4750)). `.gitignore` does not exclude that path, so 113 snapshots are tracked. The newest tracked file contains 25 user rows with `email`, `password`, `id_number`, and `user_img` fields; none of the 25 password values are hashes. `pending_registrations.json` adds one more record with a plaintext password.
- **Simple:** The server keeps saving a copy of the user list, passwords included, into a folder inside the project. That folder was uploaded with the code, so the passwords are in the repository and in every copy anyone has cloned.
- **Failure scenario:** The team shares the repository with the panel, a classmate, or a future capstone group, as capstone projects normally do. That person opens any file in `scratch/backups/`, reads a Lab Head's email and password, and signs in as them. Because passwords are reused across systems in practice, the exposure does not stop at this app. Deleting the files in a new commit does not help: git keeps every earlier version.
- **Note on scope:** this is the concrete, already-happened version of the D2 privacy commitment failing. Fixing D2 on paper while this stands would not survive scrutiny.

### C-02 No authentication or authorization anywhere in the API

- **Technical:** `server.ts` registers 62 routes and 3 middleware lines; none of the middleware is auth-related. `app.use(cors())` ([L11](../../server.ts#L11)) permits every origin. No route reads a token, a session, or a user id from the request to decide whether the caller may act. Role checks exist only in React components, which control rendering.
- **Simple:** The server never asks who is calling. The website hides buttons per role, but the server behind it answers anyone.
- **Failure scenario:** With the app running for a demo, anyone on the same network opens a terminal and sends `PUT /api/asset_disposals/3/decision {"decision":"approve"}`. The asset is marked disposed. No log records who did it, because there is no concept of who. The same applies to `DELETE /api/assets/CITe4D-0004`, which erases an asset and its custody history.

### C-03 Plaintext passwords

- **Technical:** `POST /api/auth/register` ([L3641](../../server.ts#L3641)) and `approve-registration` ([L3845](../../server.ts#L3845)) insert `password` as given. Login matches it inside the SQL `WHERE` clause ([L3894-L3898](../../server.ts#L3894-L3898)), which also means the comparison is subject to the database collation, so it may be case-insensitive. The browser mock ships 11 demo accounts with passwords in source ([prismaClient.ts#L202-L214](../../src/app/prismaClient.ts#L202-L214)).
- **Simple:** Passwords are kept exactly as typed, so anyone who can read the table can read the passwords.
- **Failure scenario:** Any of the following exposes every account at once: the committed backups (C-01), the open pending-registrations endpoint (C-04), a single `SELECT` by anyone with database access, or a raw error message from a failing query. There is no second line of defense.

### C-04 Open endpoint returning credentials

- **Technical:** `GET /api/auth/pending-registrations` ([L3717-L3719](../../server.ts#L3717-L3719)) returns the in-memory pending list, filtered only by `status === "PENDING"`. The objects include `password`, `idNumber`, `email`, and `avatarUrl`. The frontend calls it on mount for every user, regardless of role ([context.tsx#L1051-L1060](../../src/app/context.tsx#L1051-L1060)).
- **Simple:** One web address hands out the sign-up details, passwords included, of everyone waiting for approval. No login required.
- **Failure scenario:** A student opens the browser network tab on their own dashboard, sees the request, and copies the response. They now hold the credentials of everyone who registered recently, including staff.

### C-05 Arbitrary account creation

- **Technical:** In `approve-registration` ([L3769](../../server.ts#L3769)), if `pendingRegistrationsStore` has no entry for `requestId`, the handler synthesises one from the request body when `email`, `firstName`, and `lastName` are present ([L3774-L3789](../../server.ts#L3774-L3789)). The requested role string then maps to a DB role by substring ([L3796-L3801](../../server.ts#L3796-L3801)), so `"requestedRole":"LAB HEAD"` yields LAB_HEAD and `"ITS"` yields ADMIN.
- **Simple:** Send one request with any name, email, and the word "admin", and the server creates that account for you.
- **Failure scenario:** Anyone who can reach the server creates an ADMIN account, then logs in through the normal screen and has the full ITS surface: register, edit, and delete assets. Nothing in the app shows that this happened, because no audit exists.

### C-06 Forgeable session

- **Technical:** Login writes `session_user_email` as a plain cookie ([Login.tsx#L77](../../src/app/components/Login.tsx#L77)). On every page load, context reads it and calls `GET /api/auth/me?email=...` ([context.tsx#L498](../../src/app/context.tsx#L498)), which returns the profile and role for whatever email is supplied ([server.ts#L3966](../../server.ts#L3966)), with no verification. The returned role drives routing and every UI permission.
- **Simple:** Your "logged in" state is just your email written in a cookie. Change the text to someone else's email and you become them.
- **Failure scenario:** A student in the custodian portal opens dev tools, edits the cookie to the Director's address, and refreshes. The app loads the Director dashboard with disposal approvals. No password was needed, and the server never noticed.

### C-07 Hardcoded database credentials

- **Technical:** [prisma.ts#L5-L15](../../prisma.ts#L5-L15) supplies literal defaults for host, port, user, database, and password to `PrismaMariaDb`, used whenever the matching environment variables are unset. No `.env` file exists in this working copy, so those defaults are what runs today. `prisma.config.ts` separately expects `DATABASE_URL`, which is also unset, so Prisma CLI commands fail while the server keeps working, which is confusing on its own.
- **Simple:** The address and password of the shared university database are written into a file that is in the repository.
- **Failure scenario:** Anyone with the repository connects directly to `ccscloud` with a database client, outside the application entirely, and reads or changes any table. Rotating the password later also breaks every teammate's checkout silently, because the fallback hides the missing configuration instead of failing loudly.

---

## 4. High findings in detail

### H-01 Approvals from the notification panel are not saved

- **Technical:** The bell icon offers approve and decline for transfers ([NotificationCenter.tsx#L757](../../src/app/components/NotificationCenter.tsx#L757), [L766](../../src/app/components/NotificationCenter.tsx#L766)) and approve and reject for disposals ([L781](../../src/app/components/NotificationCenter.tsx#L781), [L790](../../src/app/components/NotificationCenter.tsx#L790)). These call `updateTransferRequest`, `approveDisposal`, and `rejectDisposal`, all of which write only to the localStorage mock. Only the loan action calls the real API.
- **Simple:** Two of the three approval buttons in the notification panel do nothing to the database.
- **Failure scenario:** The Director approves a disposal from the bell during a demo. The item disappears from their list, so it looks successful. The next day, on a different machine, the disposal is still pending and the asset is still active. Nobody can tell which state is correct.

### H-02 Return requests trapped in one browser

- **Technical:** The custodian branch of `ReturnForm.handleSubmit` calls `addReturnRequest`, which appends to `ems_returns` in localStorage ([context.tsx#L938-L944](../../src/app/context.tsx#L938-L944)). The ITS "Pending Returns Ledger" renders `returns` from the same context ([ITSDashboard.tsx#L2115](../../src/app/components/ITSDashboard.tsx#L2115)).
- **Simple:** When a student submits a return request, only that student's browser knows about it.
- **Failure scenario:** A custodian submits a return and waits. TSG opens the returns tab and sees an empty queue. The asset stays ON_LOAN, the due date passes, and the student appears delinquent for returning an item on time.

### H-03 Deletion destroys or fails

- **Technical:** The delete transaction ([server.ts#L908-L917](../../server.ts#L908-L917)) clears `asset_records`, `asset_monetary`, `asset_loans`, `asset_repairs`, `asset_transfers`, `asset_returns`, and `asset_disposals`, then the asset. `asset_reports` also has `fk_reports_asset` to `assets` ([schema.prisma#L97](../../prisma/schema.prisma#L97)) and is not cleared.
- **Simple:** Removing an asset either fails with a confusing error, or succeeds and wipes its whole history.
- **Failure scenario:** ITS tries to remove a duplicate entry that was inspected once. The request returns a 500 with a foreign key message. They try a different asset that was never inspected, and it works: the asset, its cost record, its loans, and its custody chain are all gone with nothing left to audit against.

### H-04 Returns leave loans open

- **Technical:** `POST /api/assets/:tag/return` writes `asset_returns` and appends an ACTIVE record but never touches `asset_loans`. `/api/analytics/delinquencies` selects loans whose status is not in `["returned", "RETURNED"]` ([server.ts#L2776-L2779](../../server.ts#L2776-L2779)). No code path writes either value.
- **Simple:** Giving an item back does not close the borrowing record.
- **Failure scenario:** A student returns a camera in good condition. The Director's delinquency report still lists them, and it will list them forever. If clearance decisions were ever driven by that report, the student would be blocked over a returned item.

### H-05 No state guards on custody actions

- **Technical:** `/borrow` ([L934](../../server.ts#L934)), `/transfer` ([L1454](../../server.ts#L1454)), and `/disposal` ([L1720](../../server.ts#L1720)) all read the asset only to confirm it exists. None reads the latest `asset_records.status`, and none checks for an existing pending request of the same kind.
- **Simple:** Nothing stops the system from lending out an item that is already lent out, thrown away, or in the repair shop.
- **Failure scenario:** Two students request the same projector on the same day. Both requests are created. The Lab Head approves both. The record log now says the projector is with student A and then with student B, and the physical item is with whoever collected it first. There is no way to tell from the data which is true.

### H-06 Two repair endpoints, two behaviors

- **Technical:** `PUT /api/asset_repairs/:id` ([L1198](../../server.ts#L1198)) updates the ticket and synchronises the asset's status through `asset_records`. `PUT /api/asset_repairs/:id/status` ([L4690](../../server.ts#L4690)) updates only `progress_status`. The dialog in ITSDashboard uses the first; the kanban in TSGAnalyticsView uses the second ([TSGAnalyticsView.tsx#L80](../../src/app/components/TSGAnalyticsView.tsx#L80)).
- **Simple:** Two screens do the same job, but only one of them also updates where the asset is.
- **Failure scenario:** A technician drags a ticket to "Warranty Holder Possession" on the kanban. The ticket moves, but the asset still shows as ACTIVE in the lab, so someone else borrows it while it is physically at the vendor.

### H-07 Free-text statuses

- **Technical:** `asset_loans.status`, `asset_transfers.status`, `asset_disposals.status` are `VARCHAR(50)` and `asset_repairs.progress_status` is `VARCHAR(100)`, with defaults but no constraints. The repair update accepts any string ([L1208-L1225](../../server.ts#L1208-L1225)); only three specific strings trigger a status change on the asset ([L1193](../../server.ts#L1193)).
- **Simple:** The database will store any word at all in these fields, so nothing guarantees the workflow was followed.
- **Failure scenario:** The live database already contains repairs with `progress_status = "Waiting for Parts"`. That value matches neither the MAINTENANCE list nor the completion check, so those assets sit in an unhandled state: the ticket says work is ongoing, the asset log says nothing happened, and no screen agrees on what is true.

### H-08 A read endpoint that writes

- **Technical:** Inside `GET /api/asset_loans`, if no loan has id 9 and none is pending, the handler inserts a loan with the literal id 9 for the first asset and the first STUDENT user ([L297-L316](../../server.ts#L297-L316)), then the response hardcodes that loan's asset name to "ASUS TUF Gaming A15" ([L357-L358](../../server.ts#L357-L358)).
- **Simple:** Opening a page can create a fake borrowing record.
- **Failure scenario:** During the defense, a panel member asks why a loan exists for equipment nobody requested. The answer is that the act of viewing the page created it. It also means the loans table can never be trusted as evidence of real activity.

### H-09 Invented analytics

- **Technical:** Four places substitute constants when a series is empty ([L2078-L2085](../../server.ts#L2078-L2085), [L2097](../../server.ts#L2097), [L2120](../../server.ts#L2120), [L4254](../../server.ts#L4254)). The degradation fallback even carries plausible dates from 2025 and 2026.
- **Simple:** When a chart has no data, the server sends made-up numbers instead of nothing.
- **Failure scenario:** The Director dashboard shows a smooth equipment degradation curve. Asked which assets it covers, the team cannot answer, because the numbers are literals in the source. This is worse than an empty chart, because it looks like evidence.

### H-10 Guessed identity

- **Technical:** Four handlers split a display name and look up `first_name` and `last_name`, falling back to `DEFAULT_CUSTODIAN_ID = 1`. Only the transfer recipient lookup is by email and refuses to default ([L1483-L1487](../../server.ts#L1483-L1487)).
- **Simple:** The server works out who did something from a typed name. A typo files the action under user number 1.
- **Failure scenario:** A borrower types "Dela Cruz, Ana" instead of "Ana Dela Cruz". The loan is created against user 1. The asset is later shown as being held by user 1, the real borrower sees nothing in "My Assets", and the custody chain the panel asked about is wrong in a way no one will notice until someone goes looking for the equipment.

### H-11 Checks outside transactions

- **Technical:** The asset tag sequence is computed by reading existing tags before `$transaction` opens ([L534-L554](../../server.ts#L534-L554)). The "still pending" guards for loans, transfers, and disposals also run before their transactions ([L1006](../../server.ts#L1006), [L1614](../../server.ts#L1614), [L1844](../../server.ts#L1844)).
- **Simple:** The server checks whether something is safe, then does the work a moment later, and anything can change in between.
- **Failure scenario:** Two ITS staff register equipment for the same lab at the same moment. Both compute `CITe4D-0051`. The first insert succeeds, the second fails on the unique index with a raw database error, and the second person's form data is lost. The approval version is worse: two Lab Heads approving the same request both pass the pending check, so two ON_LOAN records are appended for one loan.

### H-12 A metric built on a column that was never created

- **Technical:** [scratch/add_column.ts](../../scratch/add_column.ts) was written to add `is_documented` to `asset_monetary`, but it was never applied: the column is absent from the team's schema ([reference/AdRIC_DB_Schema.sql](../reference/AdRIC_DB_Schema.sql)), absent from `schema.prisma`, and confirmed absent from the live database. `m.is_documented` in `/api/analytics/compliance` ([L2374-L2381](../../server.ts#L2374-L2381)) is therefore always `undefined`, which JavaScript treats as false without complaint.
- **Simple:** The code counts a checkbox that nobody ever added to the database, so the count is always zero and nothing reports an error.
- **Failure scenario:** The compliance panel reports "0 percent audit ready" for every funding source, permanently. A reviewer reasonably concludes the institution documents none of its grant equipment, when in fact the flag does not exist.

### H-21 Two return conditions cannot be saved

- **Technical:** `asset_returns.condition` is `ENUM('PERFECT','OPERATIONAL','MINOR DRIFT','DEGRADED','CRITICAL DEFECT')`, with spaces. The Prisma enum `asset_returns_condition` declares `MINOR_DRIFT` and `CRITICAL_DEFECT` with no `@map` ([schema.prisma#L285-L291](../../prisma/schema.prisma#L285-L291)), while the equivalent enums for `asset_records` and `asset_reports` do carry `@map("MINOR DRIFT")` and `@map("CRITICAL DEFECT")`. The return handler validates against the underscore form and writes it straight through ([server.ts#L1336-L1340](../../server.ts#L1336-L1340), [L1370](../../server.ts#L1370)).
- **Simple:** The database expects "MINOR DRIFT" with a space; the code sends "MINOR_DRIFT" with an underscore, so those returns are rejected.
- **Failure scenario:** TSG finalizes the return of a damaged camera and selects Critical Defect. In MySQL strict mode the insert fails and the whole transaction rolls back, so the return is not recorded at all and the asset stays ON_LOAN. Outside strict mode the value is stored as an empty string, and every later condition report about that asset is meaningless. Either way, the two conditions that matter most for accountability are the two that break.

### H-22 The Director is seeded as a Custodian

- **Technical:** In the seed, `user_roles` row `(3, 4, 6)` maps user 4 (`director@dlsu.edu.ph`) to role 6, `CUSTODIAN`. Role 2, `ADRIC_DIRECTOR`, is created but assigned to nobody. The login role mapping ([server.ts#L3918-L3928](../../server.ts#L3918-L3928)) therefore resolves the Director to the Custodian portal, and `getRoleEmails("ADRIC_DIRECTOR")` ([L1698-L1708](../../server.ts#L1698-L1708)) returns an empty array.
- **Simple:** The Director's account was given the student job title by mistake, and no account has the Director title at all.
- **Failure scenario:** During the demo the adviser signs in as the Director and lands on "My Borrowed Assets" with no approvals tab. Separately, every disposal request silently emails nobody, because the notification is addressed to a role that no one holds, and `sendEmail` logs a warning and returns.

### H-23 The schema file does not run

- **Technical:** `asset_records.current_location` is declared `VARCAHR(255)`, which MySQL rejects, stopping the script at the third table. The `user_roles` insert is terminated with `;` after row 13, leaving `(14, 3, 6);` as an invalid standalone statement. That orphaned row is the only one granting the seeded custodian a role.
- **Simple:** The file meant to build the database has two typing mistakes and stops partway through.
- **Failure scenario:** Phase 2 needs a separate test database. Whoever tries to create one runs this file, gets a syntax error on the third table, and has no working database to test against. The same blocks any teammate setting up locally, which is part of why everyone shares one remote database today.

### H-13 No type checking

- **Technical:** There is no `tsconfig.json` in the repository and no script runs `tsc`. Vite and esbuild strip types without checking them. Live consequences include `currentUser.first_name` ([ITSDashboard.tsx#L1943](../../src/app/components/ITSDashboard.tsx#L1943)) against a `firstName` field, `currentUser?.user_id` ([L1973](../../src/app/components/ITSDashboard.tsx#L1973), [CustodianPortal.tsx#L341](../../src/app/components/CustodianPortal.tsx#L341)) against `userId`, and `updateProfile` being declared with three parameters in the context type ([context.tsx#L215](../../src/app/context.tsx#L215)) but implemented and called with four ([L583](../../src/app/context.tsx#L583), [AccountDetailsPage.tsx#L104](../../src/app/components/AccountDetailsPage.tsx#L104)).
- **Simple:** The project is written in TypeScript but nothing ever checks the types, so mistakes that TypeScript exists to catch are shipping.
- **Failure scenario:** Every inspection finalized from the ITS inspection queue is recorded with the inspector name "undefined undefined", stored into `asset_reports.report_remarks` context and shown in the UI. Nobody noticed because the screen still renders and the write still succeeds.

### H-14 Edits overwrite history

- **Technical:** `PUT /api/assets/:tag` updates the newest `asset_records` row in place ([L697-L701](../../server.ts#L697-L701)); the inspection endpoint does the same for condition and remarks ([L833-L839](../../server.ts#L833-L839)).
- **Simple:** Correcting an asset's details rewrites the last page of its logbook instead of adding a new one.
- **Failure scenario:** An asset is marked DEGRADED after an inspection. Someone edits the asset to fix a typo in the manufacturer name, and the same request rewrites status, location, custodian, and condition from whatever the edit form had loaded. The degraded state is gone, with no record that it ever existed.

### H-15 No migrations

- **Technical:** `prisma.config.ts` points `migrations.path` at `prisma/migrations`, which does not exist. `package.json` exposes only `prisma:generate` and `prisma:pull`. Three scratch scripts perform live DDL with `$executeRawUnsafe`.
- **Simple:** Database changes were made by hand, one at a time, with no record of what changed or how to undo it.
- **Failure scenario:** A teammate sets up the project on a new machine. The only build file is the team's SQL schema, which does not run (H-23), describes `user_img` and `image_url` as `VARCHAR(500)` when the app stores base64 images in them, and contains none of the ad hoc ALTERs. They end up pointing at the shared production database instead, which is what everyone does today. This also blocks Phase 3 entirely: triggers and procedures have to be delivered as versioned SQL, and there is no place to put them.

### H-16 Database errors sent to the browser

- **Technical:** Each catch block returns `error.message` ([L283-L286](../../server.ts#L283-L286) and 60 more).
- **Simple:** When something breaks, the database's own error text is shown to whoever is using the site.
- **Failure scenario:** A duplicate asset tag produces "Unique constraint failed on the fields: (`asset_tag`)" in the browser. Harmless-looking, but the same mechanism reveals table names, column names, and constraint names to an unauthenticated caller mapping the system.

### H-17 Registrations in a JSON file

- **Technical:** `pending_registrations.json` is loaded into memory at startup ([L3714](../../server.ts#L3714)) and rewritten on every change ([L3706-L3712](../../server.ts#L3706-L3712)). It carries a plaintext password and is committed.
- **Simple:** People waiting for account approval are kept in a text file next to the code instead of in the database.
- **Failure scenario:** The server restarts mid-approval, or two people run the server, or the file is checked out over with the repository version. Pending applicants are lost or resurrected, and there is no record of which registrations were rejected or by whom. Rejections in particular leave no trace at all ([L3954](../../server.ts#L3954)).

### H-18 Inspection scheduling keeps nothing

- **Technical:** `isScheduled`, `groupDates`, `groupResolved`, and `itemInspectedState` are `useState` in ITSDashboard ([L294-L305](../../src/app/components/ITSDashboard.tsx#L294-L305)). The context helpers intended for this (`addInspectionSchedule`, `resolveMaintenanceItem`, `resetInspectionCycle`) are never called from any live screen. The reset confirmation tells the user "All historical inspection records in the database will remain saved" ([L1494](../../src/app/components/ITSDashboard.tsx#L1494)).
- **Simple:** The inspection scheduling screen forgets everything as soon as you leave it.
- **Failure scenario:** ITS schedules the trimestral cycle for all four lab groups, marks a dozen assets inspected, then clicks to another tab. Coming back, the schedule is blank and every asset is "For Inspection" again. The individual inspection reports that were submitted did reach the database, so the two views now disagree.

### H-19 Transfer details dropped

- **Technical:** `effectiveDate` is collected ([TransferForm.tsx#L115](../../src/app/components/TransferForm.tsx#L115)) and never referenced in the handler ([server.ts#L1497-L1505](../../server.ts#L1497-L1505)). The destination lab is folded into `justification` and recovered by regex in three separate places.
- **Simple:** The date the transfer should take effect is thrown away, and the destination lab is hidden inside the reason text.
- **Failure scenario:** The panel asks, at the next defense, to see when a transfer took effect and to list transfers into a given lab. Neither question can be answered from the database without parsing free text, which is exactly the comment (S1) that produced the conditional pass.

### H-20 Unescaped interpolation into email and print output

- **Technical:** Email bodies embed `existing.name`, `data.reason`, `data.requestedBy`, and `data.disposalPathway` directly ([L1514-L1518](../../server.ts#L1514-L1518), [L1774-L1778](../../server.ts#L1774-L1778)). The QR print window builds HTML from asset names and labs ([ITSDashboard.tsx#L2196-L2212](../../src/app/components/ITSDashboard.tsx#L2196-L2212)).
- **Simple:** Text that users typed is pasted straight into emails and printed pages without cleaning.
- **Failure scenario:** Someone registers an asset whose name contains an anchor tag pointing at an external site. Every transfer email about that asset, sent from the institutional Mailgun domain to real staff, now carries a working link the team did not write.

---

## 5. System health summary

### Works reliably

- Asset intake, edit, and inspection writes, thanks to real transactions around the multi-table work ([server.ts#L559](../../server.ts#L559), [L646](../../server.ts#L646), [L805](../../server.ts#L805)).
- The loan, transfer, and disposal approval endpoints themselves: state is checked, the write is transactional, and the custody log is appended correctly when they are called from the dashboards.
- `GET /api/assets` produces a consistent, if heavy, view of the registry, and is the backbone of every screen.
- QR generation and camera scanning work as built.
- Email delivery for transfers and disposals, when Mailgun variables are set.
- Lab Head branch filtering, for a Lab Head whose account actually has a `user_centers` row.

### Works by luck

- **Repair submissions**: correct only because an in-memory 8-second guard swallows the duplicate POST (M-07). Restart the server between the two calls and both are written.
- **Lab Head analytics**: correct only because `labAffiliation` usually resolves to a short code that matches asset tag prefixes. One user without a center row makes every panel silently empty (M-14).
- **"Latest record" reads**: correct only because writes rarely land in the same second (M-09).
- **Login**: correct only because the mock fallback rarely triggers; when it does, it grants a Custodian session on demo credentials ([Login.tsx#L55-L73](../../src/app/components/Login.tsx#L55-L73)).
- **Asset tag allocation**: correct only because two people rarely register equipment at the same moment (H-11).
- **Role routing**: correct only for the five roles anyone tests. `ITS_STAFF` lands in the student portal (M-11).
- **Custodian "My Assets"**: correct only while no two users share a display name, since it matches on a formatted name string ([CustodianPortal.tsx#L115](../../src/app/components/CustodianPortal.tsx#L115)).

### Actively broken

- Transfer and disposal approval from the notification panel: saves nothing (H-01).
- Custodian return requests: never leave the browser (H-02).
- Deleting an inspected asset: always fails (H-03).
- Delinquency reporting: counts returned items forever (H-04).
- Compliance and audit-readiness percentages: always zero (H-12).
- Inspection scheduling: forgets everything (H-18).
- Inspector attribution on ITS inspections: records "undefined undefined" (H-13).
- `PUT /api/auth/account` lab creation path: always throws, silently, on an invalid enum value ([L4067](../../server.ts#L4067)).
- `PUT /api/asset_transfers/:id/accept`: would permanently stall a transfer if called (M-12).
- `npm run seed`: throws (L-04).
- Prisma CLI commands: fail, because `DATABASE_URL` is unset while the server uses different variables (C-07).
- Finalizing a return as Minor Drift or Critical Defect: rejected by the database enum (H-21).
- The seeded Director account: lands in the custodian portal, and disposal emails address a role nobody holds (H-22).
- `docs/reference/AdRIC_DB_Schema.sql`: stops on a syntax error at the third table (H-23).

---

## 6. Demo and defense risk list

Ordered by how badly it would go if noticed during the CAP2 demo or defense.

| Risk | What a panel member would see | Finding |
|---|---|---|
| Passwords in the repository | Open the repo, find `scratch/backups/`, read credentials. Fatal for a project claiming Data Privacy Act compliance | C-01 |
| Anyone can approve or delete without logging in | One terminal command changes the data mid-demo | C-02, C-05, C-06 |
| A loan nobody created | "Where did loan 9 and this ASUS TUF come from?" Answer: loading the page created it | H-08 |
| Charts built from constants | "Which assets produced this degradation curve?" Answer: none, the numbers are in the source | H-09 |
| A Director approves a disposal and nothing is saved | The item is still pending after refresh on another machine | H-01 |
| A return request that TSG cannot see | The demo has to be done on one laptop, in one browser profile, or the workflow breaks | H-02 |
| "It only works on my machine" | Every API URL is `localhost:4000`; the frontend cannot run anywhere else | M-08 |
| Compliance reads 0 percent | Suggests no grant equipment is documented, which is not what the data says | H-12 |
| Delete fails with a raw SQL error | "Foreign key constraint fails on `fk_reports_asset`" shown to the user | H-03, H-16 |
| The Director cannot act as Director | The seeded Director account opens the student portal, because the seed gives it the Custodian role | H-22 |
| A return is refused for the two worst conditions | Demonstrating a damaged return fails at the database | H-21 |
| Inspection schedule vanishes | Set it up, navigate away, come back, it is gone | H-18 |
| Inspector recorded as "undefined undefined" | Visible in the inspection history | H-13 |
| Two screens, two answers for one repair | The kanban and the repairs tab disagree about the same ticket | H-06 |
| Half the analytics screens are unreachable | 22 of 30 endpoints have no caller; three reporting components are dead code | M-06 |
| The panel's own points still open | S1 date dropped, S2 labs not auto-filled, S3 warranty unused, S4 free text, S5 no bundles, S6 no usage time, S7 free-text statuses | H-19, M-03, M-15, and Phase 3 |
