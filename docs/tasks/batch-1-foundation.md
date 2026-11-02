# Batch 1: foundation (one migration, shared rules, permission helpers)

**Owner:** Raiki (Claude Code agent). **Branch:** `feat/batch-1-foundation`, from `main` **after 2a (password hashing) merges**.
**Target:** merged by **Wed Nov 4 morning** (moved half a day for the data model change). The contract doc (commit 2) is pushed early so Joel and Aryan can start.
**Updated 2026-11-02 (late night), after Stop 0:** the data model changed to "store it once" (sections 3 and 4 rewritten): `asset_records`, `asset_returns`, `asset_transfers` and `asset_monetary` go; `assets.status` is the only stored state; holder, location, condition and clearance are worked out; lookup tables for funding sources, issue types and metric definitions; no `LAB_HEAD` role. Stop 0 answers are in section 15.
**Updated 2026-11-02 (night):** the #96 rework (Joel's #133, which Joel can't finish) joins this batch as Stop 5 (section 14), plus a `.gitignore` commit (1b) and three guide fixes. Joel is credited as co-author.
**Updated 2026-11-02 (afternoon):** only Chapters 1 to 3 of the manuscript are frozen (4 and 5 describe the current system and are updated to match it); the Secretary can edit asset master data (decision B); 2a is merged; the UAT reset path after the renames is part of this batch.
**Source of truth:** this file. Background: `claude/nov9-delivery-plan.md` sections 0b, 9 (Batch 1) and 13 (Raiki has it; you don't need it).

Read first, fully: `AGENTS.md`, `CLAUDE.md`, `docs/guides/DATABASE-MIGRATIONS.md`, `docs/guides/CODE-COMMENTS.md`, `tests/README.md`, then this brief.

---

## 1. Why this batch exists

Every later batch (loan chain, maintenance, disposal, sign-ups, users page, analytics) builds on one schema and one set of rules. One owner writes them once, so nobody reinvents "can this asset be loaned?" in three places, and nobody else touches `prisma/`.

The system must match the frozen manuscript (Chapters 1 to 3; Chapters 4 and 5 are updated afterwards to describe what we build) and answer the Stage 1 panel comments (CAP1DEF). The schema below carries every column those need, so later batches need no schema change.

## 2. Hard rules for this batch

1. **Renames are hand-written** (deliberate drops happen only in commit 9b, section 3.4). `prisma migrate diff` writes a table or column rename as DROP plus CREATE, which deletes data. Replace those lines by hand with `RENAME TABLE` and `ALTER TABLE ... RENAME COLUMN`. Check row counts before and after on a copy of the UAT data.
2. **Never** run `prisma migrate dev`, `prisma db push` or `prisma db pull`. Prisma commands take their database only from `PRISMA_TARGET_URL`.
3. **The backfill stops, it never guesses.** If any asset's tag prefix matches no lab, the migration fails with the list. Report the list to Raiki before writing the backfill.
4. **No new package** and no `package.json` change without asking.
5. **No hard-coded status strings** outside the new constants module (grep check at the end).
5b. **Lists never run one query per asset** for worked-out values.
6. **Typecheck stays at 49 or lower.** Build passes. Tests all pass. Report all three after every commit that changes code.
7. **No em dashes** anywhere (code comments, docs, commits).
8. Work in stops. Commit after each step, never push. Raiki pushes.
9. Never read `.env` or `pending_registrations.json`. Hand checks only on the local copy `adric_uat_check`, started only through `C:\dev\uat-data\start-local-uat.ps1`.

## 3. Data model ("store it once")

**Decided with Raiki on Nov 2 night, after Stop 0.** Each fact is stored in one place. Anything that can be worked out from stored facts is worked out by one backend helper, never stored a second time. The one deliberate exception is `assets.status` (every list and guard filters on it). Names say what they mean.

### 3.1 What is stored, what is worked out

| Fact | Where | Stored or worked out |
|---|---|---|
| Asset status (six values) | `assets.status` | **Stored.** Changed only by the status setter, in the same transaction as the step that changes it |
| Home lab and campus | `assets.center_id` to `research_centers` (`location` = campus) | Stored once |
| Home room | `assets.home_room` | Stored, optional |
| Owning project | `assets.project_id` | Stored, optional |
| Funding | `assets.funding_source_id` to `funding_sources`, `assets.acquisition_value` | Stored |
| Who has it now | The borrower on the asset's open loan (On Loan or Return Requested); otherwise nobody | **Worked out** |
| Where it is now | Open loan: its destination lab and room. Maintenance received by TSG: "TSG Office". Missing or Retired: none. Otherwise: home lab and room | **Worked out** |
| Condition now | The newest TSG inspection (any type except Self Report) | **Worked out** |
| Overdue | Open loan whose `return_by` has passed | **Worked out** |
| Cleared (no unreturned equipment) | The user has no loan in Pending Release, On Loan or Return Requested | **Worked out** |
| History of an asset | The loan, inspection, maintenance and retirement rows, plus `activity_log` rows for steps that have no table (registered, edited, marked missing, found) | Read from those tables |

**Rule for the helpers:** a list asks for the worked-out values of all its assets in one query (joins or one grouped query), never one query per asset.

### 3.2 Renames (commit 3, no behavior change)

| Kind | From | To |
|---|---|---|
| Table | `asset_repairs` | `asset_maintenance` |
| Table | `asset_disposals` | `asset_retirements` |
| Table | `asset_reports` | `asset_inspections` |
| Column | `asset_loans.loaned_on` | `requested_at` (it has always been the request time) |
| Column | `asset_loans.due_date` | `return_by` |
| Column | `asset_inspections.report_id`, `reported_by_id`, `report_date`, `report_img`, `report_condition`, `report_remarks` | `inspection_id`, `inspected_by_id`, `inspected_at`, `photo`, `condition`, `remarks` |
| Column | `asset_retirements.disposal_id`, `disposed_by_id`, `disposal_date`, `disposal_reason` | `retirement_id`, `requested_by_id`, `requested_at`, `reason` |
| Column | `asset_maintenance.repair_id`, `created_at` | `maintenance_id`, `reported_at` |
| Column | `asset_records.repair_id`, `disposal_id` | `maintenance_id`, `retirement_id` (the table goes in commit 9b; renaming keeps commit 3 green) |
| Column | `projects.project_id` (text code), then `projects.master_id` | `project_code`, then `project_id` (in that order) |
| Role value | `CUSTODIAN`, `ADMIN` | `RESEARCHER`, `IT_ADMIN` (widen, update, narrow) |
| Role value | `ITS_STAFF` | removed (Stop 0: no holders) |

Code follows in the same commit: Prisma names, feature folders (`repairs` to `maintenance`, `disposals` to `retirements`, the report code under `inspections`), routes (`/api/maintenance`, `/api/retirements`, `/api/inspections`), `web/api/` clients, `requireRole` and `appRoleFor` for the new role values, test fixtures. No old-URL aliases. Row counts before and after on `adric_b1_scratch`; same test count, all green.

### 3.3 Expand and backfill (commit 4)

New migration. Old tables stay until commit 9b, so the code can move over in commits 5 to 9 with tests green the whole way. Report every count named here at Stop 3.

**New lookup tables**
- `funding_sources`: `funding_source_id` PK, `name` varchar(100) unique. Rows: DOST, USAID, CHED, Internal Grants, plus every other distinct non-empty value found in `asset_monetary.funding_source` and `projects.funding_agency` (list them at Stop 3 before writing them). "Unspecified" and empty map to NULL.
- `issue_types`: `issue_type_id` PK, `key` varchar(50) unique, `name` varchar(100), `suggested_action` varchar(255). Rows: Won't power on; Battery or charging; Display; Storage or data; Network or ports; Physical damage; Accessory missing; Software or OS; Other, each with a short suggested first action.
- `metric_definitions`: `metric_id` PK, `metric_key` varchar(50) unique, `name` varchar(100), `unit` varchar(20), `higher_is_better` boolean.
- `category_metrics`: `category` (the asset category enum), `metric_id` FK; unique (`category`, `metric_id`). Rows from the table in section 4.

| Category | Metrics |
|---|---|
| CPU | CPU load temperature (°C); bad sectors (count); battery capacity (% of design, laptops only) |
| TABLET, VR | battery capacity (%) |
| HARD_DRIVE, MEMORY_CARD | bad sectors (count); read speed (MB/s) |
| ROUTER, SWITCH | working ports (count); packet loss (%) |
| DEV_KIT, SIMULATOR | sensor drift (%); motor speed (RPM) |
| Others | none (health score only) |

**`assets`**
- `status` enum `AVAILABLE`, `ON_LOAN`, `MAINTENANCE`, `PENDING_RETIREMENT`, `RETIRED`, `MISSING`, NOT NULL. Backfill from the newest `asset_records` row: ACTIVE to AVAILABLE, ON_LOAN, MAINTENANCE, DISPOSED to RETIRED. An asset with no record: AVAILABLE (report how many).
- `center_id` FK, NOT NULL after the backfill from the tag prefix (Stop 0: all 128 match). The migration fails with the list if any tag matches no lab.
- `home_room` varchar(100) null (empty on existing assets).
- `project_id` null FK `projects` (backfill from the newest record's `project_id`).
- `funding_source_id` null FK, `acquisition_value` decimal(10,2) null (copied from `asset_monetary`; report assets with no monetary row).
- `accessories` varchar(500) null; `its_property_tag`, `tsg_tag` varchar(100) null.
- Indexes on `status` and `center_id`.
- **Consistency report, no fixing:** assets backfilled ON_LOAN with no approved loan, and MAINTENANCE with no open repair row.

**`asset_loans`**
- `status` becomes enum `PENDING_APPROVAL`, `PENDING_RELEASE`, `DECLINED`, `CANCELLED`, `ON_LOAN`, `RETURN_REQUESTED`, `RETURNED`, `ENDED_BY_MAINTENANCE`, `ENDED_BY_LOSS`. Mapping: pending, approved, declined, returned to PENDING_APPROVAL, ON_LOAN, DECLINED, RETURNED.
- Add, all nullable: `project_id` FK (the project it is borrowed for), `destination_center_id` FK (required for new loans, enforced in Batch 3), `destination_room` varchar(100), `decided_by_id`, `decided_at`, `decision_remarks` text, `released_by_id`, `released_at`, `release_inspection_id` FK inspections, `return_requested_at`, `received_by_id`, `return_inspection_id` FK inspections, `closed_at` (any final status; the status says which), `remarks` text.
- **One `return_by`** (the date the borrower asks for, approved as is). No `proposed_return_by`.
- Copy each `asset_returns` row onto its loan: `received_by_id` = `returned_by_id`, `closed_at` = `returned_on`, `remarks` = `comments`. Match by asset and the newest returned loan requested before `returned_on`. Report unmatched rows and stop for Raiki if any.
- Index (`asset_id`, `status`).

**`asset_maintenance`**
- `progress_status` becomes `status` enum `PENDING_RECEIPT`, `INSPECTING`, `REPAIRING`, `EXTERNAL_SERVICE`, `RESOLVED`, `BEYOND_REPAIR`, `CANCELLED` (old free-text mapping as before; Stop 0: one row, Inspection Phase to INSPECTING).
- `type` enum `BORROWER_REPORT`, `TSG_MAINTENANCE`, `RETURN_DAMAGE` (existing rows BORROWER_REPORT).
- `issue_type_id` null FK `issue_types`; `warranty_override_reason` text null (filled means TSG overrode the warranty route; "under warranty" is worked out from `assets.warranty_expiry` at `received_at`).
- `received_by_id`, `received_at`, `provider` varchar(255), `completed_by_id`, `completed_at`, `resolution_remarks` text, `trigger_inspection_id` FK, `completion_inspection_id` FK, all null. No loan id.
- Index (`asset_id`, `status`).

**`asset_retirements`**
- `status` enum `PENDING`, `APPROVED`, `DENIED`, `COMPLETED` (pending, approved, rejected to PENDING, COMPLETED, DENIED).
- `pathway` enum null `DONATE`, `RECYCLE`, `RETURN_TO_FUNDER`, `SELL`, `OTHER`; `previous_status` (asset status enum) null, kept because a denial restores it; `decided_by_id`, `decided_at`, `decision_remarks`, `completed_by_id`, `completed_at`, `disposition_reference` varchar(255), `assessment_inspection_id` FK, all null.
- Unpack the packed text (M-13): the pathway line to `pathway` (both spellings of Scrap / Recycle to RECYCLE; Donate to DONATE; Auction to SELL; Warranty Return to Vendor and Secure Landfill to OTHER); the rest stays in `reason`. For PENDING rows, set `previous_status` from the newest record before the pending row (report).

**`asset_inspections`**
- One condition enum for the whole schema, `asset_condition`: PERFECT, OPERATIONAL, MINOR_DRIFT, DEGRADED, CRITICAL_DEFECT (keep the existing stored spellings of the inspections enum).
- `type` enum `INITIAL`, `LOAN_RELEASE`, `RETURN`, `MAINTENANCE`, `RECOVERY`, `ROUTINE`, `RETIREMENT`, `SELF_REPORT` (Stop 0: ROUTINE 4, SELF_REPORT 1).
- `health_score` tinyint unsigned null; `missing_accessories` varchar(255) null (empty means nothing missing).
- No process FKs on this table. Index (`asset_id`, `inspected_at`).

**New `asset_inspection_metrics`:** `inspection_id` FK, `metric_id` FK, `value` decimal(10,2); unique (`inspection_id`, `metric_id`).

**`users`:** `account_status` enum `PENDING`, `ACTIVE`, `INACTIVE`, `REJECTED` default PENDING (existing rows ACTIVE); `status_decided_by_id`, `status_decided_at`, `anonymized_at` null; `id_number` nullable (unique stays). `user_type` stays (their DLSU position; no rule uses it).

**Roles and labs**
- `roles.role_name` unique. Values after this batch: `RESEARCHER`, `TSG_STAFF`, `ADRIC_DIRECTOR`, `ADRIC_SECRETARY`, `IT_ADMIN`. **`LAB_HEAD` is removed:** a Lab Head is whoever heads a lab (`research_centers.head_user_id`). Holders chosen as a Head lose the role row; holders not chosen get RESEARCHER (report who).
- `user_roles` unique (`user_id`, `role_id`); `user_centers` unique (`user_id`, `center_id`). Report duplicates first; stop if any.
- `research_centers.head_user_id` Int null, unique, FK users, from Raiki's picks (Stop 0 question C). Labs with no Head stay NULL.
- `research_centers.location` gains MCKINLEY; rows corrected: Laguna = TE3D and GAME; McKinley = HXIL; Manila = the rest.

**`projects`:** `funding_agency` becomes `funding_source_id` FK (map the text to `funding_sources`; report). `project_leader` stays text (Raiki, Nov 2: linking leaders to accounts goes to Recommendations).

**New `user_tickets`:** as before (`ticket_id`, `created_by_id`, `type` BUG/ACCOUNT_ACCESS/QUESTION/OTHER, `title`, `description`, `status` OPEN/IN_PROGRESS/RESOLVED/REJECTED, `resolution_remarks`, `resolved_by_id`, `resolved_at`, `created_at`, `updated_at`).

**New `activity_log`:** `log_id`, `actor_id` null FK, `event_type` enum, `target_user_id` null FK, `asset_id` null FK, `details` varchar(255) null, `created_at`. Event types: LOGIN_SUCCESS, LOGIN_FAILURE, SIGNUP_APPROVED, SIGNUP_REJECTED, ROLE_CHANGED, LABS_CHANGED, HEAD_CHANGED, USER_DEACTIVATED, USER_REACTIVATED, USER_ANONYMIZED, TICKET_STATUS_CHANGED, ASSET_REGISTERED, ASSET_EDITED, ASSET_DELETED, ASSET_MARKED_MISSING, ASSET_FOUND, CLEARANCE_RECORD_PRINTED. Never an email, a typed login name, or a password. ASSET_EDITED details list the changed field names.

**CHECK constraints (hand-written):** `health_score` 0 to 100; retirement `decided_by_id <> requested_by_id`; loan `return_by >= DATE(requested_at)`; maintenance `completed_at >= reported_at`; retirement `completed_at >= requested_at` (when not null). If one trips the `migrate diff` check, stop and tell Raiki.

**Not in this batch:** triggers, views, stored procedures, audit tables, a category or campus table, photos as files (Recommendations).

### 3.4 Contract: drop what was replaced (commit 9b)

After commits 5 to 9 have moved every reader and writer, a new migration drops: `asset_records`, `asset_returns`, `asset_transfers`, `asset_monetary`, `asset_maintenance.is_immediate` (report how many were true first), `projects.funding_agency` (replaced by `funding_source_id`; Stop 3 answer), and the old condition enums. A grep shows no code uses them. This is a deliberate drop of data already copied or no longer needed (UAT test data; the Nov 8 deploy is a fresh database), so it is not the accidental DROP that rule 2.1 is about. Report row counts dropped per table.

### 3.5 Tag numbering (#75, folded from #130)

Registration locks the lab's `research_centers` row (`SELECT ... FOR UPDATE` through `$queryRaw` inside the transaction) before reading the highest tag number for that lab. Copy Aryan's `Promise.all` test of 5 same-lab registrations by hand from branch `fix/75-concurrent-tags` (do not check it out), and remove `findTagsWithPrefix` if nothing else uses it. Trailer:
`Co-authored-by: aryanlng06 <137790406+aryanlng06@users.noreply.github.com>`

## 4. Shared code (commits 5 to 9)

**Constants** (`shared/constants/`, or `shared/enums/` where a file exists; one source for web and server):
- Asset statuses with labels: Available, On Loan, Maintenance, Pending Retirement, Retired, Missing. Loan, maintenance, retirement, inspection, ticket and activity statuses and types with labels.
- Campus labels (Manila, Laguna, McKinley).
- Page titles from the manuscript: "Repair and Maintenance", "Asset Disposal", "Asset Loaning and Return", "Asset Information", "Reports and Analytics", "System Administration".
- Metric flag rules keyed by `metric_key` (temp 15 °C or more above baseline; any rise in bad sectors; battery below 70%; read speed below 80% of baseline; working ports below baseline; packet loss above 1%; drift above 5%; RPM more than 10% off baseline; health score below 50 for categories with no metrics).
- Care guidelines per category group (2 or 3 short lines each) and the health score suggestion (Perfect 100, Operational 80, Minor Drift 60, Degraded 40, Critical Defect 20). Display text, so code is fine.
- Funding sources, issue types and metric definitions are **not** constants any more: they come from their tables through `GET /api/lookups`. Remove `shared/constants/fundingSources.ts` once nothing imports it.

**Lifecycle guard** (`server/shared/services/lifecycleGuard.ts`): one table of allowed actions per asset status, used by every service. Actions: request loan, start maintenance, receive for maintenance, request retirement, decide retirement, complete retirement, mark missing, mark found, edit master data, routine inspection. Pending Retirement allows only the decision. Retired allows nothing. Missing allows found and retirement request. An open loan in Pending Approval or Pending Release keeps the asset Available but blocks new requests.

**Status setter** (`server/shared/services/assetStatus.ts`): `setAssetStatus(tx, assetId, newStatus)`, called only after the guard allows the action, inside the caller's transaction. Nothing else writes `assets.status` (grep check).

**Derive helpers** (`server/shared/services/assetState.ts`): current holder, current location (as text: "<lab short code>, <room>" or "<lab short code>", or "TSG Office", never the campus), current condition, overdue, open loan, and the user's open loans (clearance). Each has a version for a list that runs one query. Overdue and "open" use the status lists from the constants.

**Activity log writer** (`server/shared/services/activityLog.ts`): `logActivity(tx, event)` for the events in 3.3, inside the caller's transaction.

**Row locks** (`server/shared/services/rowLocks.ts`): `lockAsset(tx, assetId)` and `lockCenter(tx, centerId)` with `SELECT ... FOR UPDATE`.

**Permission helpers** (following the repo's middleware pattern): `requireActive`, `requireAnyRole(...)`, `requireItAdmin`, `requireTsg`, `requireAssetMasterEditor` (TSG or Secretary), `requireRetirementDecider` (Director or Secretary), `requireLabHead` (heads any lab), `requireHomeLabHead(asset)` through `resolveLoanApprover(asset)` (today the home lab's Head, `null` when the lab has none; later it can return a custodian), `notSameActor`. When the approver is `null`, the loan action answers 409 "This lab has no Lab Head yet. Ask the IT Admin to set one." Apply them to the existing loan, return, maintenance, retirement and inspection routes now. The IT Admin gets 403 on every asset action.

**Session and views:** the session (and `/api/auth/me`) returns all of the user's labs (ids and short codes) and the lab they head, if any. The Lab Head view goes to whoever heads a lab. The internal app role key "Custodian" stays; its label shows "Researcher" (Stop 0 question E). IT Admin and Secretary still land on the Staff view in this batch. Remove the `user_centers[0]` primary-lab use and every `|| "CITe4D"` default (no lab means none). The 3 web readers of `labAffiliation` change with it (the Lab Head lists use the lab they head).

**Asset master rules**
- Registration (TSG only): writes the asset with status AVAILABLE, an INITIAL inspection, and an ASSET_REGISTERED log row, in one transaction.
- Edit Asset changes master data only: name, serial, manufacturer, category, procurement and warranty dates, home lab, home room, owning project, funding source, acquisition value, tags, accessories. Status, holder, location and condition in the body get 400. It writes an ASSET_EDITED log row with the actor and the changed field names. TSG and the Secretary may edit (`requireAssetMasterEditor`); everyone else gets 403.
- Delete is refused with 409 once the asset has any loan, maintenance, retirement, or any inspection besides its initial one. A mistaken fresh registration can be deleted (ASSET_DELETED log row with the tag in `details`).
- **Transfers are removed:** the transfers feature folder, its routes, the web API client and every call to it (including `serverData.tsx` on reload), and the transfer buttons and form (remove them, no redesign; list the files). Transfer tests go. Old rows go with the table in commit 9b.

## 5. Contract doc (commit 2, pushed early)

`docs/contracts/lifecycle.md`, for Joel and Aryan to build screens with mock data. Plain words, no em dashes:
- **Data model:** section 3.1 in plain words: what is stored, what is worked out, and the field names screens will receive (home lab, home room, current location, holder, condition).
- **Locations:** Home (lab, room) on the asset; Current location worked out (loan destination, TSG Office, or home). A return always brings the asset back to its home lab and room.
- **Clearance:** a person is cleared when they have no loan in Pending Release, On Loan or Return Requested. The clearance record (manuscript OUT5) is a printable page for one person: their loans with release and return verification (who received it, when, condition) and either "No unreturned equipment" or the open loans. TSG prints it; printing logs CLEARANCE_RECORD_PRINTED. Endpoint planned in Batch 3.
- The six asset statuses, what each means and which actions each allows (from the guard).
- Each process's statuses and allowed moves: loan, maintenance, retirement, Missing and Found, sign-up, ticket.
- Every endpoint the next batches add, **by meaning**, with method, path, body, response shape and errors (400, 401, 403, 404, 409). Batch 3: request (destination lab from the borrower's labs, optional room, optional project, return-by, purpose), cancel, approve, decline, release, return request, receive, my loans, lab requests, Accountability Form data, clearance record. Batch 5: report issue (Request Immediate Inspection, with issue type), receive, start, stage change, complete, cancel; retirement request, decide, complete; mark Missing, mark Found; routine queue; benchmark data per asset. 2b and module 6: sign-up, pending list, approve (role plus one or more labs), reject; users list, role change, labs change, Head change, deactivate, reactivate, anonymize; activity log list with filters; tickets create, mine, all, status change. Analytics: insights (replace soon, most requested, loans per week per lab), Inventory Report.
- Who may do what: TSG registers, edits and does every physical step; the Secretary edits master data only; the Director and Secretary decide retirements; a lab's Head approves loans for assets of that lab; the IT Admin has no asset actions.
- The lookups each form uses (`GET /api/lookups`: labs with campus, funding sources, issue types with suggested actions, metric definitions per category, projects), and where the borrower's labs come from.
- Screens never compute status: the server sends it.

Mark each endpoint "planned (Batch N)" or "live (Batch 1)".

## 6. Seed

Update `prisma/seed.ts` to the new schema, small working set (the big demo seed is a later brief): IT Admin, Director, Secretary, 2 TSG, 2 Lab Heads of different labs (set as `head_user_id`), 3 researchers (one in two labs), assets in at least 3 labs with home rooms, one with accessories, one per status, the funding sources, issue types and metric definitions. Passwords through 2a's `hashPassword`. Every account ACTIVE except one PENDING. The IT Admin is no longer user 1 as a "nobody holds it" placeholder (there is no holder column).

## 7. Commits and stops

| # | Commit | Stop after? |
|---|---|---|
| 0 | Stop 0, facts check | Done (Nov 2) |
| 1 | `docs(tasks): save the batch 1 foundation brief` | No |
| 1b | `chore: ignore other env files, Playwright output, root DB dumps and local agent settings` (section 14.4) | No |
| 2 | `docs(contracts): lifecycle and API contract for batches 2 to 8` | **Yes, Stop 1** (Raiki pushes for Joel and Aryan) |
| 3 | `db: rename tables, columns and role values (no behavior change)` with the code that follows | **Yes, Stop 2:** row counts before and after on `adric_b1_scratch`; same test count, all green |
| 4 | `db: foundation tables, columns, lookups, enums, backfill and checks` plus the seed, and the code the changed values force | **Yes, Stop 3:** migration on an empty DB and on `adric_b1_scratch`; every count from section 3.3; `migrate diff` empty; changed files grouped by server, shared and web |
| 5 | `feat(shared): statuses, labels, page titles, flag rules and care guidelines` | No |
| 6 | `feat(server): lifecycle guard, status setter, derive helpers, activity log and row locks` (every reader of `asset_records` moves to `assets.status` and the helpers) | No |
| 7 | `feat(server): permission helpers, approver resolver, Lab Head by lab, session with all labs` | No |
| 8 | `fix(assets): lock the lab row when numbering tags (#75)` with Aryan's test and trailer | No |
| 9 | `feat(assets): master-data-only edits, delete guard, transfers removed` | No |
| 9b | `db: drop the replaced tables and columns` (section 3.4) | No |
| 10 | `test: foundation rules` (if not already inside 5 to 9b) | No |
| 11 | `docs: data model and lifecycle note, migration log, fix log, AGENTS.md counts and role names`, the UAT reset path (section 10) and the guide fixes (section 14.5) | **Yes, Stop 4:** checks, hand checks, backup dry run, report |
| 12 | `fix(analytics): campus and lab from the asset's home lab, no guessed numbers on the server (#96)` | No |
| 13 | `fix(web): dashboards wait for real data and use one campus and lab-group source (#96)` | **Yes, Stop 5** |

Tests go in the same commit as the behavior where possible. Small web fixes forced by a commit ride in it; say which files and why.

## 8. Tests (Vitest, local test DB)

- Migrations build on an empty DB; `migrate diff` empty.
- Backfill and mapping on fixture rows: asset status from the newest record, loan statuses, `asset_returns` copied onto the loan, maintenance free text, retirement statuses and unpacked pathway, inspection types, role values (CUSTODIAN to RESEARCHER, LAB_HEAD holders to Head or RESEARCHER), funding text to `funding_sources`, an unknown tag prefix fails the migration.
- Guard table: every status by every action.
- Status setter: a forced failure inside the transaction leaves the status and the process row unchanged.
- Derive helpers: holder and current location for an asset at home, on loan, in maintenance, missing; condition from the newest TSG inspection, ignoring a newer Self Report; overdue; cleared and not cleared; a list of N assets runs a fixed number of queries.
- Permission helpers: the Head of lab X approving an asset of lab Y gets 403 and the loan is unchanged; an asset of a lab with no Head gets 409; IT Admin gets 403 on asset actions; the Secretary edits master data (200, one ASSET_EDITED row) but gets 403 on registration; a researcher editing gets 403; an Inactive or Pending account gets 403; the retirement requester can't decide.
- Edit Asset: status, holder, location or condition in the body gets 400.
- Delete with history gets 409; a fresh mistaken registration can be deleted.
- Transfer routes are gone (404) and the web build has no transfer calls.
- Tag numbering: 5 simultaneous same-lab registrations get 5 different numbers.
- Session lists every lab of a user in two labs and the lab they head; no "CITe4D" default.
- `health_score` CHECK refuses 101; metric rows unique per inspection and metric; unique (user, lab) and (user, role).

## 9. Hand checks for Raiki (local copy `adric_uat_check` only)

Under the heading **"Batch 1 hand checks"** in `docs/tasks/batch-1-foundation.md`, numbered **B1-H1** onward, each with role, screen, clicks, expected result and database. At least:
- **B1-H1** Log in as each role (IT Admin and Secretary are users 13 and 14 after the scratch SQL, Director, TSG, a Lab Head, a researcher); each lands on its view. Old Custodian accounts show "Researcher".
- **B1-H2** Staff Inventory: the six statuses; a disposed asset shows Retired; CAR assets show Manila, HXIL ones McKinley.
- **B1-H3** Edit Asset: no status or holder field; editing the home room saves and the asset's history shows the edit with the actor. Repeat as the Secretary: saves; registering as the Secretary is refused with a clear message.
- **B1-H4** Delete an asset with history: refused with a clear message.
- **B1-H5** Register an asset: correct tag number and home lab; the initial inspection exists.
- **B1-H6** Lookups: TE3D and GAME on Laguna, HXIL on McKinley; funding sources and issue types listed.
- **B1-H7** A Lab Head approving another lab's asset (button or direct API call): refused. An asset of a lab with no Head: the "no Lab Head yet" message.
- **B1-H8** No transfer button or screen anywhere; pages that used to load transfers load without errors.
- **B1-H9** Old behavior nearby still works: a loan request, a repair report, and a return on the existing screens.

## 10. Backup dry run (Stop 4) and the UAT reset path

**Dry run:** restore the pre-UAT backup (Raiki gives the path) into a scratch local database, run `prisma migrate resolve --applied 0_init`, then `prisma migrate deploy` with `PRISMA_TARGET_URL` pointing at it. Report row counts per table before and after, tag-prefix misses, unmatched returns, and whether the app loads. Never touch CCS Cloud. Never edit the backup.

**UAT reset path** (write it in `docs/guides/DATABASE-MIGRATIONS.md`). `uat-reset.sql` uses the old tables, so it no longer loads into an up-to-date database. The path: drop and create the local copy; `prisma db execute --file prisma/migrations/0_init/migration.sql`; `prisma migrate resolve --applied 0_init`; load `uat-reset.sql`; `prisma migrate deploy`; then the 2a hash script. One-line PowerShell per step, passwords prompted, never typed into a URL. Run it once on `adric_uat_check` and report row counts. Then run the scratch SQL that gives users 13 and 14 IT_ADMIN and ADRIC_SECRETARY (never committed).

## 11. Acceptance

- Migrations apply on an empty DB and on the UAT copy; `npm test` diff check empty.
- Every asset has `center_id` and `status`; every count in section 3.3 reported and explained.
- No code reads or writes `asset_records`, `asset_returns`, `asset_transfers` or `asset_monetary`; nothing but the status setter writes `assets.status` (grep in the report).
- Guard, status setter, derive helpers, activity log writer, row locks, permission helpers and constants exist and the existing routes use them.
- No new hard-coded status strings (grep).
- Typecheck 49 or lower, build passes, tests all pass (say how the count moved: transfer tests removed, foundation tests added).
- The contract doc covers every screen in Joel's and Aryan's lists in the team briefing.

## 12. Not in this batch

The loan chain logic and the clearance endpoint (Batch 3); maintenance, disposal and Missing logic (Batch 5); sign-ups in the database and the IT Admin pages (2b, Raiki's next brief); new screens (Joel); the big demo seed; the audit.

## 13. Questions

Ask in the AGENTS.md "When unsure" format: what it is, which screen and role, lettered options, your recommendation with a one-line reason. Raiki answers without opening files.

## 14. Added 2026-11-02 night: #96 rework (Stop 5), .gitignore, guide fixes

### 14.1 Why #96 is here

Issue #96: dashboards show guessed or fixed numbers. Joel's PR #133 (branch `fix/96-dashboard-guessed-numbers`, based on the old `a86c2c7`) fixed it with a new hard-coded lab-to-campus list (`shared/constants/labs.ts`), which disagrees with the database and assumes two campuses. Joel can't redo it, so it lands here, where it gets the real fix the issue asked for: campus and lab from `research_centers` through the asset's new `center_id`. Do it after Stop 4, as commits 12 and 13. If Batch 1 runs late, Raiki may merge at Stop 4 and do Stop 5 on a new branch from `main`; ask him at Stop 4.

**Copy by hand, never check out or cherry-pick the branch** (it predates Batch J and 2a). Read it with `git show origin/fix/96-dashboard-guessed-numbers:<path>` or `git show <commit>`. Both commits carry the trailer:
`Co-authored-by: JoelBalanay <259837053+JoelBalanay@users.noreply.github.com>`

**Keep from #133:**
- `a150c3e`: assets with no record are skipped in analytics, never counted as Manila, CITe4D or ACTIVE; no "Manila" or "CITe4D" defaults in `assets.service.ts` list items.
- `b76a39d`: Director Overview shows a loading skeleton for Campus Distribution and the lab status matrix instead of 0, "N/A" or "Unassigned" while the lists load.
- `abd556c`: Director Descriptive Analytics shows loading until the server answers; no client-side estimate first (numbers no longer jump).
- `d7d1806`: Staff System Overview campus counts and the Inspection Manager lab groups from one shared source.

**Drop from #133:** `shared/constants/labs.ts` and its `RESEARCH_LABS`, `campusForLab` and `campusForAsset`; its changes to `server/shared/utils/campus.ts`; any two-campus assumption ("Manila" vs "everything else").

### 14.2 Commit 12, server (`fix(analytics): ...`)

- Analytics and the asset list read an asset's lab and campus from `assets.center_id` joined to `research_centers` (`short_code`, `location`). No more parsing the location text or the tag prefix for the lab (finding M-03 in `locationStatus`).
- `server/shared/utils/campus.ts` (Batch 1 owns it) maps the `research_centers_location` value to its label from the shared campus labels; no lab list in it.
- Assets with no `asset_records` row are skipped in status counts (keep from `a150c3e`).
- "Utilization" on the Director Overview counts assets whose status is On Loan, not assets linked to a project.
- The project allocation value uses the real `assets.acquisition_value` sum, not the invented 250,000 per asset (H-09).
- Status comes from `assets.status`, lab and campus from `center_id`.
- Status names come from the Batch 1 constants (six statuses), never strings.
- Tests: an HXIL asset counts under McKinley and a TE3D one under Laguna; an asset with no record is not counted; utilization counts only On Loan; update `tests/api/analytics.test.ts` where it pins the old defaults (say which).

### 14.3 Commit 13, web (`fix(web): ...`)

- Campus labels in `shared/constants/campuses.ts` (Manila, Laguna, McKinley), if commit 5 didn't already add them. The inspection lab groups (Group A to D) move from `web/features/inspections/InspectionQueue.tsx` to `shared/constants/inspectionGroups.ts` (finding M-03). Labs not in any group are listed under their own "Other" group, not hidden in Group A.
- Each lab's campus on the web comes from `GET /api/lookups` (labs carry their campus) or from the asset item the server sends. No page keeps its own lab or campus list.
- Director Overview: loading skeletons (from `b76a39d`); Campus Distribution shows three campuses.
- Director Descriptive Analytics: loading until the server answers, no estimate (from `abd556c`).
- Staff System Overview: campus counts by the asset's home lab campus, three campuses.
- **Not here:** the "Pending Returns" card on the Staff System Overview still counts browser-stored return requests (H-02). Batch 3 moves return requests into the database (`RETURN_REQUESTED` on the loan) and fixes that card. Leave it, and say so in the report.

### 14.4 `.gitignore` (commit 1b)

Add exactly these lines, change nothing else, and run `git status` to confirm no tracked file became ignored:

```gitignore
# Other env files (keep the example)
.env.*
!.env.example

# Agent and test output
.playwright-mcp/
coverage/

# Personal Claude Code settings (the shared settings.json stays tracked)
.claude/settings.local.json

# Database dumps dropped in the repo root by mistake
/*.sql
*.sql.gz
*.dump

# OS clutter
.DS_Store
Thumbs.db
```

### 14.5 Guide fixes (in commit 11)

In `docs/guides/DATABASE-MIGRATIONS.md`:
- "Hashing the passwords of existing data": the PowerShell command ends in `adric_uat_check` (Raiki's copy). Make the database name a `<your local database>` placeholder and say "for example `adric_uat_local`". A teammate ran it as written and hashed the wrong database.
- "A fresh local database with demo data": step 2 says `adric_db_dev` while steps 3 and 4 say `AdRIC_DB_dev`. Use `AdRIC_DB_dev` everywhere (on Linux and macOS the case matters).
- Add one line under step 4: if login fails, check the server's "Pool custodian check passed: user_id 1 (...)" line; "Demo Admin" means the demo database, any other name means another database.

### 14.6 Hand checks for Stop 5 (B1-H10 onward, `adric_uat_check`)

- **B1-H10** Director, Overview: skeletons while loading, then Campus Distribution with Manila, Laguna and McKinley; HXIL assets under McKinley; numbers match a count by lab campus on the database.
- **B1-H11** Director, Descriptive Analytics: no numbers until the server answers; no jump after.
- **B1-H12** Staff, System Overview: the same three campus counts as the Director's page.
- **B1-H13** Staff, Inspection Manager: groups come from the shared file; a lab not in any group shows under "Other".
- **B1-H14** Nearby still works: the Director's Inventory Report tab loads and exports CSV.

## 15. Stop 0 answers (Raiki, Nov 2)

- **Locations:** replaced by section 3 (home lab and room on the asset; current location worked out).
- **Separator:** location text is "<lab short code>, <room>"; the asset list reads lab and campus from `center_id`; nothing parses location text.
- **C, labs with no Head:** `head_user_id` stays NULL; loan actions on those assets answer 409 "This lab has no Lab Head yet. Ask the IT Admin to set one." Raiki picks the CITe4D and CAR Heads from the third query.
- **D:** users 13 and 14 get IT_ADMIN and ADRIC_SECRETARY through a scratchpad SQL file after the commit 11 reset; never committed.
- **E:** internal key "Custodian" kept, label "Researcher".
- **F:** Stops 2 and 3 run on `adric_b1_scratch` (0_init, `uat-reset.sql`, resolve, deploy); `adric_uat_check` is upgraded once, in commit 11.
- **G:** Raiki confirms the backup file before Stop 4.
- The packed pathway text has two spellings; both map to RECYCLE.

**Stop 1 answers (Raiki, Nov 2):**

- **H, a chosen Head's role:** every LAB_HEAD row becomes RESEARCHER, the chosen Heads' too. When the server picks the view, heading a lab wins over Researcher.
- **J, Head of CITe4D:** user 6 ("UAT LabHead CITe4D One"). User 7 becomes a plain Researcher.
- **J2, Head of CAR:** user 8 ("UAT LabHead CAR").
- **Approved loans:** only the newest approved loan of an asset whose newest record is ON_LOAN maps to ON_LOAN (Stop 0: 9 loans). Any other approved loan maps to RETURNED with `closed_at` NULL, listed at Stop 3.
- **K, loan 13 (asset 104, Retired while still on loan):** RETURNED, remark "Closed by migration: asset retired while on loan", `closed_at` NULL.
- **Pending disposals:** an asset with a pending disposal gets PENDING_RETIREMENT, with `previous_status` from its newest record (Stop 0: disposals 2 and 3, both AVAILABLE). A DISPOSED asset with no approved disposal stays RETIRED and is reported (Stop 0: 1 asset).
- **User 1 ("Pool Placeholder", no role, no lab):** set INACTIVE in the backfill.
- **Funding sources:** DOST, USAID, CHED, Internal Grants, DOST-PCIEERD and DOST-SEI, each its own row.
- **L, completing a retirement:** approval keeps the asset Pending Retirement; Complete moves it to Retired. Pending Retirement allows Decide (retirement Pending) and Complete (retirement Approved). Retired allows nothing.
- **M, the guide line in 14.5:** the "Pool custodian check" goes with the placeholder in 9b. In its place the server prints `Database: <name> on <host>` at startup (never the password), and the guide line says to check that line.
- **Tickets need a login:** no ticket form on the login page (`user_tickets.created_by_id` is a required account, and an open form invites spam). The login page says "Can't log in? Contact the IT Admin."
- **Loan routes:** `/api/asset_loans` becomes `/api/loans` in commit 3, next to `/api/maintenance` and `/api/retirements`. `/api/asset_returns` goes with its table in 9b. Planned loan actions are `/api/loans/:loanId/...`; the request stays `POST /api/assets/:assetTag/loans`.

**Contract review (advisor, Nov 3):** the contract doc gains asset search, loans by status, `idNumber` in the session, a dashboard snapshot, loan length and time-on-loan insights, the Inventory Report's filters, worked-out notifications, the anonymize fields, and Lab Head office accounts. Two of them touch Batch 1:

- **Asset search** `GET /api/assets?q=` (part of the tag, serial number or name, any letter case) is small, so it is live in Batch 1. It lands in commit 6, where the asset list is rewritten.
- **Lab Head office accounts:** an account that heads a lab is the lab's office account and cannot request loans (403 "Use your personal account to borrow."). The rule is enforced with the loan chain in Batch 3; commit 7's helpers expose "heads a lab" for it. `idNumber` (the person's own) joins the session in commit 7.

**Stop 2 answers (Raiki, Nov 3):**

- **Stop 2 finding:** `uat-reset.sql` holds 12 users, 127 assets and 14 loans; `adric_uat_check` holds more (17 users, 128 assets, 16 loans) from earlier hand checks. The rules above apply to whatever data the migration meets; Stop 3 reports the counts on `adric_b1_scratch` (the reset data).
- **N, IT Admin and Secretary for the hand checks:** after the commit 11 reset, users 10 and 11 become IT_ADMIN and ADRIC_SECRETARY through the never-committed scratch SQL file. This replaces D (users 13 and 14 do not exist in the reset data).
- **O, Lab Heads in the migration:** the migration sets `head_user_id` only where a lab has exactly one LAB_HEAD holder (who heads no other lab), and Stop 3 lists the labs left without a Head. Raiki's CITe4D pick goes in the same scratch SQL file, by name, checked against the reset data at Stop 3. No user id is written into a migration.

**Stop 3 answers (Raiki, Nov 3):**

- The six commit 4 decisions are confirmed: the maintenance text map (the board's texts mapped, any other text 400, the outside service kept as `provider`); `destination_center_id` filled from the purpose's "Destination Lab:" line; `asset_inspection_metrics` keyed by (`inspection_id`, `metric_id`); motor speed `higher_is_better` true; user 1 INACTIVE only when it has no role.
- `projects.funding_agency` stays until commit 9b and is dropped there with the other replaced columns (section 3.4).
