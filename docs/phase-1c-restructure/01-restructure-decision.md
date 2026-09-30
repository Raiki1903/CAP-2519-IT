# 01. Restructure Decision (Addendum to 01D)

Project: CAP-2519-IT. Phase 1C. Date: 2026-09-26.
Addendum to [01D-restructure-plan.md](../phase-1b-deep-map/01D-restructure-plan.md). 01D remains the plan of record; this file records that the team confirmed it and why the alternatives lost.

---

## 1. Decision

We are keeping **Option A from 01D exactly as written**: one `package.json` at the root, a `server/` tree and a `web/` tree as siblings, both organized into mirrored feature folders by process (assets, loans, returns, transfers, repairs, inspections, disposals, registrations, auth, analytics), a role-based `web/pages/` layer (staff, lab-head, custodian, director) whose files only arrange feature components, a `web/api/` layer that is the only place a URL appears, five files per server feature (routes, validation, controller, service, repository) with Prisma confined to repositories, and a `shared/` folder of enums, types, and constants that both sides import and that imports from neither. ITS and TSG collapse into one app role, `Staff`, at `/staff/*`, while the database keeps `ITS_STAFF` and `TSG_STAFF` as separate rows. Dead analytics code is quarantined in `legacy/analytics-v1/` with a README, not deleted. This is not a hybrid: the role-based `pages/` layer sitting above process-based `features/` folders is the original Option A design, and the "hybrid" described below is a different layout that we are not building.

---

## 2. Options considered

| | **Option A: role pages over process features** (chosen) | **Page-first** | **Hybrid: server and web inside each feature** |
|---|---|---|---|
| **Shape** | `server/features/<process>/`, `web/features/<process>/`, `web/pages/<role>/`, `shared/` | Folders by screen or role, each holding its own backend and frontend code | `features/<process>/server/` and `features/<process>/web/` in one tree |
| **Traceability** | Strong. One process, one folder name, on both sides. "Where does a transfer live" has one answer | Weak. A loan lives in at least two role folders, so the answer is "it depends who is looking" | Strong on paper, but server-only and web-only code still needs top-level folders, so there are two conventions to learn |
| **Readability** | Strong. Each file is one job, typically under 150 lines. Pages read as layout, features read as behavior | Mixed. A page folder mixes HTTP handling, business rules, and JSX at one level | Medium. Every feature folder is two trees deep before you reach a file |
| **Scalability** | Strong. `shared/` defines each status and role once. Phase 3 can swap repository internals for stored procedures without touching a controller | Poor. Adding a role means copying backend code or importing across page folders | Medium. Works, but the later upgrade to npm workspaces is harder because features straddle the boundary |
| **Risk** | Low. Nothing about how the project is installed or run changes. Every step in 01D section 9 is independently revertible | High. Cross-role workflows force either duplication or import tangles, and both are discovered late | Medium. Needs extra tooling (lint rules or separate tsconfigs) to stop server files importing browser code |
| **Effort** | Medium. 14 ordered steps, each verifiable in minutes | High. Every shared endpoint has to be assigned an owning page, and several have no single owner | High. Same work as A, plus the boundary tooling, plus a second convention for shared code |

---

## 3. Why page-first was rejected

Each reason was checked against the code on 2026-09-26.

**One backend endpoint serves many pages.** `GET /api/assets` is fetched from six live places: [ITSDashboard.tsx:366](../../src/app/components/ITSDashboard.tsx#L366), [LabHeadDashboard.tsx:165](../../src/app/components/LabHeadDashboard.tsx#L165), [CustodianPortal.tsx:87](../../src/app/components/CustodianPortal.tsx#L87), [AdRICDirectorDashboard.tsx:179](../../src/app/components/AdRICDirectorDashboard.tsx#L179), [TSGAnalyticsView.tsx:496](../../src/app/components/TSGAnalyticsView.tsx#L496), and [context.tsx:278](../../src/app/context.tsx#L278). Two quarantined files call it as well. Under page-first, that one handler would have to live in one page's folder and be imported by four others, or be copied.

**Workflows cross roles.** A loan is requested by a Custodian at [LoanForm.tsx:103](../../src/app/components/LoanForm.tsx#L103) and approved by a Lab Head at [LabHeadDashboard.tsx:250](../../src/app/components/LabHeadDashboard.tsx#L250). A disposal is filed by Staff at [ITSDashboard.tsx:2717](../../src/app/components/ITSDashboard.tsx#L2717) and decided by the Director at [AdRICDirectorDashboard.tsx:225](../../src/app/components/AdRICDirectorDashboard.tsx#L225). Neither workflow belongs to one role, so neither belongs in one role folder.

**Authorization is enforced per API action, not per page.** The whole point of [01C section 4](../phase-1b-deep-map/01C-security-map.md#4-authorization-route-by-route) is a route-by-route permission table. `requireRole` attaches to a route, so routes need to be grouped the way permissions are reasoned about, which is by process.

**The same action already has two screens and two endpoints.** Repair progress is updated from [ITSDashboard.tsx:453](../../src/app/components/ITSDashboard.tsx#L453) (`PUT /api/asset_repairs/:id`) and from [TSGAnalyticsView.tsx:80](../../src/app/components/TSGAnalyticsView.tsx#L80) (`PUT /api/asset_repairs/:id/status`), and the two behave differently (H-06). Page-first would legitimize that split by giving each screen its own home. One `repairs` feature makes merging them the obvious fix.

**Mirrored feature names already give one obvious place per process**, and the role-based `web/pages/` layer keeps the per-role view the team is used to navigating. We get the benefit page-first was reaching for without putting backend code inside it.

**Why the hybrid was rejected too.** Putting `server/` and `web/` subfolders inside each feature needs extra tooling to stop server code importing browser code (there is no `tsconfig.json` at all today, H-13, so we have no such tooling and would be adding it during a move). It still needs top-level folders for server-only and web-only code, so the team learns two conventions. And it makes the later upgrade to npm workspaces harder, which 01D section 1 deliberately kept cheap.

---

## 4. Three transactions traced through the target structure

Indented paths read top to bottom, browser to database. Findings named are the ones each destination gives a home to, not fixes performed by the move itself.

### 4a. Asset registration (today: `POST /api/assets`, [server.ts:512](../../server.ts#L512))

```
web/pages/staff/RegisterPage.tsx                     arranges the intake wizard
  web/features/assets/IntakeWizard.tsx               the form, step gating
    web/api/assets.api.ts  createAsset()             the only place the URL appears (M-08)
      server/features/assets/assets.routes.ts        requireAuth, requireRole("STAFF") (C-02)
        server/features/assets/assets.validation.ts  category must be a known enum, no silent DEV_KIT rewrite
          server/features/assets/assets.controller.ts
            server/features/assets/assets.service.ts custodian from the session, not user 1 (H-10)
              server/features/assets/assets.repository.ts  tag sequence inside the transaction (H-11)
```

The second write into the localStorage mock that follows a successful intake today ([ITSDashboard.tsx:583](../../src/app/components/ITSDashboard.tsx#L583) calling `addAsset`) disappears in step 6, when `context.tsx` is split.

### 4b. Repair request and progress (today: `POST /api/assets/:tag/repair` at [server.ts:1078](../../server.ts#L1078), plus two update endpoints)

```
web/pages/custodian/MyAssetsPage.tsx
  web/features/repairs/RepairForm.tsx                one submit, not two (M-07)
    web/api/repairs.api.ts  requestRepair()
      server/features/repairs/repairs.routes.ts
        server/features/repairs/repairs.validation.ts
          server/features/repairs/repairs.controller.ts
            server/features/repairs/repairs.service.ts   reporter from the session (H-10); no in-memory dedupe map
              server/features/repairs/repairs.repository.ts

web/pages/staff/RepairsPage.tsx and web/pages/staff/HealthPage.tsx
  web/features/repairs/RepairProgressDialog.tsx      both screens, one component
  web/features/repairs/RepairBoard.tsx               the kanban
    web/api/repairs.api.ts  updateProgress()         one function, so one endpoint (H-06)
      server/features/repairs/repairs.routes.ts
        server/features/repairs/repairs.service.ts   status is an enum (H-07); warranty routing lives here (panel S3)
          server/shared/services/assetState.ts       the one shared "what state is this asset in" rule
            server/features/repairs/repairs.repository.ts
```

Two endpoints becoming one is a behavior change, so it is its own commit, not part of a move.

### 4c. Disposal filing and decision (today: `POST /api/assets/:tag/disposal` at [server.ts:1720](../../server.ts#L1720), decision at [server.ts:1824](../../server.ts#L1824))

```
web/pages/staff/InventoryPage.tsx
  web/features/disposals/DisposalFormDialog.tsx
    web/api/disposals.api.ts  requestDisposal()
      server/features/disposals/disposals.routes.ts
        server/features/disposals/disposals.validation.ts   pathway from a shared enum
          server/features/disposals/disposals.controller.ts
            server/features/disposals/disposals.service.ts  pathway, last custodian, target date as fields (M-13)
              server/features/disposals/disposals.repository.ts
              server/shared/services/mailer.ts              escaped bodies (H-20)

web/pages/director/ApprovalsPage.tsx
  web/features/disposals/DisposalApprovalList.tsx
    web/api/disposals.api.ts  decideDisposal()
      server/features/disposals/disposals.routes.ts         requireRole("ADRIC_DIRECTOR") (C-02)
        server/features/disposals/disposals.service.ts      pending check inside the transaction (H-11)
          server/features/disposals/disposals.repository.ts
```

The Director's other route to this action today, the notification bell, writes only to localStorage ([context.tsx:813](../../src/app/context.tsx#L813) onward, H-01). In the target structure the bell calls the same `decideDisposal()` as the dashboard, which is what step 6 fixes.

---

## 5. What stays open

These are not decided here. The restructure stops and asks when it reaches one.

| Open decision | Where it bites | Reference |
|---|---|---|
| Is `/api/analytics/dashboard` re-attached or quarantined with its dead component? | Step 2 quarantines the component. The endpoint's fate is separate | 01D section 6, M-06 |
| Is the inspection scheduling tab rebuilt or moved to `legacy/`? | Step 8, splitting `ITSDashboard.tsx` | Open question 15, H-18 |
| Are tests co-located with features or in a root `tests/` folder? | Phase 2, and step 14 | 01D section 3 |
| Must git history be rewritten to remove the committed backups? | Step 0 stops the leak; history is a separate call. **Never rewritten by an agent** | C-01, 01C tier 1 item 4 |
| Who approves a transfer, the recipient or the Lab Head? | Step 12, extracting `transfers` | 01A section 10, HANDOFF question 1 |

One more, noted rather than opened: `01D` section 7 says `context.tsx` splits three ways and `prismaClient.ts` is deleted. Both are steps 6 and 7, and both change behavior on purpose. They are the two steps where a reviewer should look hardest.
