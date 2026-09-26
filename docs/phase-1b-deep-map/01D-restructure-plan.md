# 01D. Restructure Plan

Project: CAP-2519-IT. Phase 1B. Date: 2026-09-18.
**Plan only. No files were moved and no code was changed.**

Stated goals for the restructure, from the team: **traceability, readability, scalability.** Every recommendation below is justified against those three.

Companions: [01A-system-trace.md](01A-system-trace.md), [01B-findings-register.md](01B-findings-register.md), [01C-security-map.md](01C-security-map.md).

---

## Table of contents

1. [The decision: one package, feature folders](#1-the-decision-one-package-feature-folders)
2. [Target structure](#2-target-structure)
3. [How the reference layout was adapted, and why](#3-how-the-reference-layout-was-adapted-and-why)
4. [The layered split, explained plainly](#4-the-layered-split-explained-plainly)
5. [Worked example: the borrow route](#5-worked-example-the-borrow-route)
6. [Move map: backend](#6-move-map-backend)
7. [Move map: frontend and root](#7-move-map-frontend-and-root)
8. [What to rewrite instead of move](#8-what-to-rewrite-instead-of-move)
9. [Ordered migration steps](#9-ordered-migration-steps)
10. [What is CI, and where it fits](#10-what-is-ci-and-where-it-fits)
11. [Risks](#11-risks)
12. [What this does not fix](#12-what-this-does-not-fix)

---

## 1. The decision: one package, feature folders

You asked me to recommend, and mentioned feature-based structure. Here is the choice and the reasoning.

### The three options

| Option | Shape | Pros | Cons |
|---|---|---|---|
| **A. One package, feature folders** (recommended) | One `package.json` at the root. `server/` and `web/` as sibling folders, each organized by feature. A `shared/` folder imported by both through a TypeScript path alias | One `npm install`, one lockfile, one `npm run dev:all`. Nothing about how you run the project changes. Types and enums can be shared immediately. Smallest possible gap between today and the target | Backend and frontend dependencies stay mixed in one file. No tooling stops someone importing a React component into the server by mistake |
| **B. npm workspaces** | `apps/api`, `apps/web`, `packages/shared`, each with its own `package.json` | Real boundaries: the API cannot import React because it is not in its dependency list. Each side can be deployed separately later | Every script, path, and config moves at once. Prisma, `tsx`, and Vite all need repointing. More ways for a teammate's setup to break, and a broken setup mid-capstone costs days |
| **C. Two repositories** | Separate repos for API and web | Complete separation | Shared types have to be published or duplicated. Two histories to submit for a capstone. Rejected outright |

### Recommendation: Option A

- **Technical:** Option A delivers the structural wins that matter for your three goals, at a fraction of Option B's risk. Feature folders give **traceability** (one folder per process, so "where does a transfer live" has one answer). The layered split inside each feature gives **readability** (each file is one job, typically under 150 lines, instead of a 4,760-line file). A shared types folder gives **scalability** in the way you will feel first: a status value or lab code is defined once and both sides use it, so adding a field stops meaning "search the whole project for string literals". Option B adds dependency isolation, which is real, but it is not on your list of goals, and it is the part most likely to break four people's machines at once.
- **Simple:** Split the code into folders by feature, keep one project and one install command. You get the organization you want without changing how anyone runs the app. If you ever deploy the API and the website separately, you can upgrade to Option B later; the folder layout below is already shaped for that move.
- **Upgrade path if you choose B later:** rename `server/` to `apps/api/`, `web/` to `apps/web/`, `shared/` to `packages/shared/`, add three small `package.json` files, and add a `workspaces` array to the root one. The internal structure does not change at all. This is deliberate.

### Two structural decisions that follow from your answers

- **ITS and TSG become one role in the app.** You said they do the same job and differ only in name. Today there are two identical route trees, two identical navigation lists, and one shared 2,939-line component ([routes.tsx#L28-L60](../../src/app/routes.tsx#L28-L60), [Sidebar.tsx#L28-L55](../../src/app/components/Sidebar.tsx#L28-L55)). The plan collapses them to one app role, `Staff`, with one route tree at `/staff/*`. The database keeps `ITS_STAFF` and `TSG_STAFF` as separate roles, because who a person works for is still a fact worth recording; both map to the same app role and the same permissions. This alone deletes a third of the routing file and fixes half of finding M-11.
- **Dead code is quarantined, not deleted.** You asked to keep it but flag it. It moves to `legacy/analytics-v1/` with a `README.md` stating what it was, why it is not wired up, and which backend endpoints exist only for it. It stays out of the build. Nothing imports it, so moving it is safe.

---

## 2. Target structure

```
CAP-2519-IT/
├── .env                          # never committed
├── .env.example                  # variable NAMES only
├── .gitignore                    # + scratch/, pending_registrations.json
├── package.json                  # one package, scripts for both sides
├── tsconfig.json                 # NEW: strict mode, path aliases (@server, @web, @shared)
├── vite.config.ts                # + dev proxy so the web app can call /api
├── README.md
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/               # NEW: baseline + every later change, incl. Phase 3 triggers
│   └── seed.ts                   # NEW: replaces the broken test-user.ts
│
├── server/                       # was: server.ts, prisma.ts, mailer.ts
│   ├── main.ts                   # start the process, read PORT, listen
│   ├── app.ts                    # build the express app: middleware order, route mounting
│   │
│   ├── config/
│   │   ├── env.ts                # read and VALIDATE env vars, no fallbacks, fail fast
│   │   └── prisma.ts             # the Prisma client singleton
│   │
│   ├── features/
│   │   ├── auth/                 # login, session, profile
│   │   ├── registrations/        # request, approve, reject
│   │   ├── assets/               # registry, intake, edit, retire, QR data
│   │   ├── loans/                # borrow request, decision
│   │   ├── returns/              # return request, finalization
│   │   ├── transfers/            # transfer request, decision, QR override
│   │   ├── repairs/              # tickets, progress, warranty routing
│   │   ├── inspections/          # condition reports, schedules
│   │   ├── disposals/            # request, director decision
│   │   └── analytics/            # read models for the three live dashboards
│   │       ├── analytics.routes.ts
│   │       ├── director.service.ts
│   │       ├── labHead.service.ts
│   │       ├── tsg.service.ts
│   │       └── shared/           # queries used by more than one dashboard
│   │
│   ├── shared/
│   │   ├── middleware/
│   │   │   ├── requireAuth.ts    # NEW (01C tier 2)
│   │   │   ├── requireRole.ts    # NEW
│   │   │   ├── errorHandler.ts   # NEW: one place, no raw DB messages
│   │   │   └── requestContext.ts # NEW: request id, acting user
│   │   ├── errors/AppError.ts    # NEW: typed errors with HTTP status
│   │   ├── services/
│   │   │   ├── mailer.ts         # was root mailer.ts
│   │   │   └── assetState.ts     # THE shared rule: what is an asset's current state
│   │   └── utils/
│   │       ├── logger.ts         # NEW: replaces console.log with levels
│   │       ├── date.ts           # one date formatting policy
│   │       └── html.ts           # NEW: escaping for email and print output
│   │
│   └── jobs/
│       └── backup.ts             # only if kept; must exclude users and write outside the repo
│
├── shared/                       # imported by BOTH sides via @shared
│   ├── types/                    # the request and response shapes of every endpoint
│   ├── enums/                    # AssetStatus, Condition, Role, RepairStatus, DisposalPathway
│   └── constants/labs.ts         # one lab list, until it is served from research_centers
│
├── web/                          # was: src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes.tsx            # /staff/*, /lab-head/*, /custodian/*, /director/*
│   │   └── layouts/RootLayout.tsx
│   │
│   ├── api/                      # NEW: the only place a URL appears
│   │   ├── client.ts             # base URL from VITE_API_URL, error handling, JSON
│   │   ├── assets.api.ts
│   │   ├── loans.api.ts
│   │   ├── transfers.api.ts
│   │   ├── returns.api.ts
│   │   ├── repairs.api.ts
│   │   ├── disposals.api.ts
│   │   ├── auth.api.ts
│   │   └── analytics.api.ts
│   │
│   ├── features/                 # mirrors the server's feature list
│   │   ├── auth/                 # LoginPage, RegisterPage, useSession
│   │   ├── assets/               # AssetTable, AssetGalleryCard, AssetDetailModal, IntakeWizard, EditAssetDialog, AssetImagePlaceholder
│   │   ├── loans/                # LoanForm, LoanApprovalList
│   │   ├── transfers/            # TransferForm, TransferApprovalList
│   │   ├── returns/              # ReturnForm, PendingReturnsTable
│   │   ├── repairs/              # RepairForm, RepairBoard, RepairProgressDialog
│   │   ├── inspections/          # InspectionForm, InspectionQueue
│   │   ├── disposals/            # DisposalFormDialog, DisposalApprovalList
│   │   ├── qr/                   # QrScanner, QrTagSheet, ManualLookup
│   │   ├── analytics/            # director/, labHead/, staff/
│   │   └── notifications/        # NotificationCenter (rewritten, see section 8)
│   │
│   ├── pages/                    # one file per screen; each assembles feature components
│   │   ├── staff/                # Overview, Register, Inventory, Repairs, Inspections, Returns, QrTags, Health
│   │   ├── lab-head/             # Custody, Inventory, Health, Approvals
│   │   ├── custodian/            # MyAssets, Available, Scan, Report
│   │   ├── director/             # Overview, Analytics, Approvals, Reports
│   │   └── AccountPage.tsx
│   │
│   ├── components/ui/            # unchanged shadcn primitives
│   ├── hooks/                    # useDebounce, useLabScope, and similar
│   ├── state/session.tsx         # what remains of context.tsx: session and preferences only
│   └── styles/
│
├── legacy/                       # quarantined, not built, not imported
│   └── analytics-v1/             # 6 dead components + analyticsReasoning + README.md
│
├── scripts/                      # was scratch/, minus backups and minus raw ALTER scripts
└── tests/
    ├── db/                       # Phase 2: trigger and procedure tests
    ├── api/                      # endpoint tests
    └── setup/                    # test database bootstrap
```

---

## 3. How the reference layout was adapted, and why

| Reference | Adaptation | Reason |
|---|---|---|
| `src/server.js` and `src/app.js` | `server/main.ts` and `server/app.ts` | Same idea, TypeScript, and moved under `server/` because `src/` is already the frontend here. Keeping the frontend at `src/` and the backend inside it would be misleading |
| `src/config/env.js`, `database.js` | `server/config/env.ts`, `server/config/prisma.ts` | Identical intent. `env.ts` is where the fallbacks in [prisma.ts#L5-L15](../../prisma.ts#L5-L15) get deleted and replaced by validation |
| `src/features/<name>/` with routes, controller, service, repository, validation, test | Same five files per feature, plus a sixth folder `analytics/shared/` | The reference did not anticipate 30 read-only report endpoints sharing aggregation logic |
| `src/shared/middleware`, `utils`, `errors` | Same, plus `shared/services/` | `mailer.ts` and the "what state is this asset in" rule are shared services, not utilities. That second one is the single most duplicated piece of logic in `server.ts` |
| `src/db/migrations`, `seeds` | `prisma/migrations/`, `prisma/seed.ts` | Prisma owns this directory by convention and `prisma.config.ts` already points at it. Fighting that convention would cost more than it gains |
| (not covered by the reference) | `web/` | The reference is backend only. The frontend gets the same feature-based treatment so both halves read the same way, which is the point of doing this at all |
| (not covered) | `shared/` | The single change with the highest long-term value: one definition of every status, role, and DTO, used by both sides |
| (not covered) | `legacy/` | Your answer to question 14: keep the dead analytics work, flagged and out of the way |
| `<feature>.test.js` beside the code | `tests/` at the root, mirroring the feature names | Phase 2 needs a test database and shared fixtures, which sit awkwardly beside feature code. If you prefer co-located tests, that also works; it is a preference, not a correctness issue |

---

## 4. The layered split, explained plainly

- **Simple:** Today one function does five jobs at once: read the request, check the input, decide the rules, talk to the database, and write the reply. That is why `server.ts` is 4,760 lines and why the same rule is written slightly differently in six places. The split gives each job its own file:

| Layer | Its one job | Plain description | Knows about |
|---|---|---|---|
| **routes** | Which URL maps to which handler | The signpost. "POST to this address goes here, and only staff may pass" | HTTP paths, middleware |
| **validation** | Is this request even shaped correctly | The bouncer. Rejects a missing due date or an invalid condition before anything else runs | The request body only |
| **controller** | Translate between HTTP and the service | The receptionist. Unpacks the request, calls the service, turns the answer into a response or an error | HTTP, and the service it calls |
| **service** | The business rules | The decision maker. "You cannot borrow an asset that is already on loan." This is where Phase 3 decides what stays in code and what becomes a database trigger | Rules, other services |
| **repository** | Read and write rows | The filing clerk. The only layer allowed to call Prisma | Prisma, table shapes |

- **Technical:** The rule that makes this work is one-directional dependency: routes depend on controllers, controllers on services, services on repositories. Nothing points back up. The payoff for your three goals is direct. **Traceability:** every rule has one home, so "where is the rule that says a loan must be pending" has exactly one answer. **Readability:** a reviewer reads `loans.service.ts` and sees the policy without wading through response formatting. **Scalability:** Phase 3 replaces repository internals with stored procedure calls without touching a single controller, and Phase 2 can test a service without starting an HTTP server.

---

## 5. Worked example: the borrow route

Today, `POST /api/assets/:assetTag/borrow` is one 50-line function ([server.ts#L934-L983](../../server.ts#L934-L983)) that validates, resolves a borrower by splitting a display name, encodes the destination lab into a text field, and inserts a row. Here is the same route after the split. This is an illustration inside a document, not code to copy: the fixes it shows (real borrower id, real destination column, state guard) depend on decisions from Phase 3.

**`server/features/loans/loans.routes.ts`**
```ts
router.post(
  "/assets/:assetTag/borrow",
  requireAuth,                        // 01C tier 2: who is calling
  requireRole("CUSTODIAN"),           // 01C tier 2: may they do this
  validate(createLoanSchema),         // shape of the body
  loansController.createLoanRequest
);
```

**`server/features/loans/loans.validation.ts`**
```ts
export const createLoanSchema = {
  purpose:        required.string().min(10),
  dueDate:        required.date().inFuture(),     // fixes "no minimum date" today
  destinationLab: required.oneOf(LAB_CODES),      // from shared/constants/labs.ts
};
```

**`server/features/loans/loans.controller.ts`**
```ts
async function createLoanRequest(req, res, next) {
  try {
    const loan = await loansService.requestLoan({
      assetTag:   req.params.assetTag,
      borrowerId: req.user.id,                    // from the session, never a typed name
      ...req.body,
    });
    res.json({ success: true, loan });
  } catch (err) { next(err); }                    // errorHandler decides the status code
}
```

**`server/features/loans/loans.service.ts`**
```ts
async function requestLoan(input) {
  const asset = await assetsRepository.findByTag(input.assetTag);
  if (!asset) throw new NotFoundError("Asset not found");

  const state = await assetState.current(asset.asset_id);   // the one shared rule
  if (state.status !== "ACTIVE")                            // H-05: the missing guard
    throw new ConflictError(`Asset is ${state.status}`);
  if (await loansRepository.hasPending(asset.asset_id))
    throw new ConflictError("This asset already has a pending request");

  return loansRepository.create({ ...input, assetId: asset.asset_id, status: "pending" });
}
```

**`server/features/loans/loans.repository.ts`**
```ts
const create = (data) => prisma.asset_loans.create({ data });
const hasPending = (assetId) =>
  prisma.asset_loans.count({ where: { asset_id: assetId, status: "pending" } }).then(Boolean);
```

- **What changed beyond location:** the borrower comes from the session instead of a typed name (H-10), the asset state is checked (H-05), the destination lab becomes a real field instead of text hidden in `purpose` (H-19), and the error becomes a typed error that the error handler converts, instead of a raw database message (H-16). **The point of the split is that each of those fixes now has an obvious place to live.**

---

## 6. Move map: backend

`server.ts` line ranges from [01A section 3.1](01A-system-trace.md#31-endpoints-grouped-by-process).

| Current region of `server.ts` | Destination | What has to change |
|---|---|---|
| L1-L13 middleware setup | `server/app.ts` | CORS gets an origin allowlist; body limit lowered; `errorHandler` added last |
| L4753-L4760 listen and startup checks | `server/main.ts` | Port from `env.ts`; the "does user 1 exist" check ([L41](../../server.ts#L41)) is deleted once `DEFAULT_CUSTODIAN_ID` is gone |
| L18-L37 constants (`DEFAULT_CUSTODIAN_ID`, `LAGUNA_LABS`, `ASSET_CONDITIONS`) | `shared/enums/`, `shared/constants/labs.ts` | `LAGUNA_LABS` is deleted: campus comes from `research_centers.location`. `DEFAULT_CUSTODIAN_ID` is deleted entirely |
| L56-L287 `GET /api/assets` | `features/assets/assets.{routes,controller,service,repository}.ts` | The nine-table load becomes repository queries with filters. The per-asset derivation (status, condition number, disposal text parsing) moves to a service mapper. **Rewrite, do not move** |
| L414-L497 custodian history | `features/assets/` | Strip email and ID number from the response (01C 4.2) |
| L499-L606 intake | `features/assets/` | Tag generation moves inside the transaction (H-11); custodian comes from the session |
| L609-L760 edit | `features/assets/` | Must append a record instead of overwriting (H-14) |
| L763-L862 inspection | `features/inspections/` | Same append rule; store all images or state that only one is kept |
| L865-L892, L380-L411 the two report listings | `features/inspections/` | Two endpoints with two spellings collapse into one (L-07) |
| L895-L926 delete | `features/assets/` | Becomes "retire": a status change, not a delete (H-03). If a hard delete survives, it must include `asset_reports` |
| L934-L1062 borrow and decision | `features/loans/` | See section 5 |
| L1066-L1131 repair create, L1075 dedupe map | `features/repairs/` | The in-memory dedupe map is deleted; the duplicate POST is fixed on the client (M-07) |
| L1134-L1307 repair list and update | `features/repairs/` | The two status endpoints merge into one (H-06); status becomes an enum (H-07); warranty routing (S3) gets a home here |
| L1326-L1445 return and list | `features/returns/` | Must close the loan (H-04); condition enum mapping fixed (H-21) |
| L1447-L1685 transfer, list, decision | `features/transfers/` | Destination lab and effective date become columns (H-19); QR override fields (D1) land here |
| L1688-L1708 `getUserEmail`, `getRoleEmails` | `features/auth/auth.repository.ts` | Unchanged logic |
| L1710-L1907 disposal, list, decision | `features/disposals/` | Pathway becomes a lookup value; the text block splits into columns (M-13) |
| L1910-L2160 `/analytics/dashboard` | `features/analytics/` or `legacy/` | Its only consumer is dead. **Decide:** re-attach or quarantine with its component |
| L2161-L3610, L4136-L4688 the other analytics | `features/analytics/{director,labHead,tsg,shared}` | The 8 live endpoints move. The 11 dead-component endpoints move with their component decision. The 11 with no caller at all are quarantined. Hardcoded demo series deleted (H-09) |
| L3613-L3673 `POST /api/auth/register` (dead) | delete | Superseded by the request and approve flow |
| L3675-L3766, L3769-L3883, L3954-L3963 registrations | `features/registrations/` | The JSON file becomes a table (H-17); the body fallback is deleted (C-05); the response stops echoing the password (01C 4.1) |
| L3886-L3951 login | `features/auth/` | Hashing, session issuing, rate limiting (01C tier 2) |
| L3966-L4106 `/me` and account update | `features/auth/` | Both act on the session user, not an email in the query or body |
| L4109-L4129 `/accept` (dead) | delete | Would stall a transfer (M-12) |
| L4690-L4711 repair status (duplicate) | delete | Merged into `features/repairs/` |
| L4713-L4750 backup job | `server/jobs/backup.ts` or delete | Must exclude `users` and write outside the repository (C-01) |
| `prisma.ts` | `server/config/prisma.ts` | Fallbacks deleted |
| `mailer.ts` | `server/shared/services/mailer.ts` | Bodies escaped (H-20) |

---

## 7. Move map: frontend and root

| Current | Destination | What has to change |
|---|---|---|
| `src/main.tsx`, `src/app/App.tsx` | `web/main.tsx`, `web/app/App.tsx` | Import paths only |
| `src/app/routes.tsx` | `web/app/routes.tsx` | ITS and TSG trees collapse into `/staff/*`; each tab becomes its own page component instead of an `activeTab` prop |
| `src/app/layouts/RootLayout.tsx` | `web/app/layouts/` | Unchanged apart from imports |
| `src/app/context.tsx` (1,195 lines) | Split three ways: session and preferences to `web/state/session.tsx`; every data action to `web/api/*.api.ts`; every localStorage-only action deleted | The largest single improvement available on the frontend. See section 8 |
| `src/app/prismaClient.ts` | **delete** | It is a fake database. Every remaining caller must move to the API (H-01, H-02) |
| `src/app/components/ITSDashboard.tsx` (2,939 lines) | Eight page files under `web/pages/staff/`, plus feature components | The three dialogs at the bottom of the file become `features/assets/EditAssetDialog`, `features/disposals/DisposalFormDialog`, `features/repairs/RepairProgressDialog` |
| `LabHeadDashboard.tsx` | `web/pages/lab-head/*` plus `features/loans`, `features/transfers`, `features/registrations` | Lab scoping moves to the server (M-02) |
| `CustodianPortal.tsx` | `web/pages/custodian/*` plus `features/qr` | The scanner and the new manual lookup (D1) become one QR feature |
| `AdRICDirectorDashboard.tsx` | `web/pages/director/*` plus `features/disposals` | |
| `AssetDetailModal.tsx` and the four forms | `web/features/<process>/` | Each form loses its second write to context |
| `NotificationCenter.tsx` | `web/features/notifications/` | Rewrite, see section 8 |
| `Sidebar.tsx` | `web/app/layouts/Sidebar.tsx` | ITS and TSG nav entries merge |
| `AssetImagePlaceholder.tsx` | `web/features/assets/` | None |
| `constants/labs.ts` | `shared/constants/labs.ts` | Becomes the only lab list, then is replaced by a `GET /api/research-centers` call (M-03) |
| `lib/analyticsReasoning.ts`, `AnalyticsDashboard`, `AnalyticsModule`, `AssetCatalog`, `ReportsAnalyticsDashboard`, `RoleAnalyticsModule`, `StudentAnalyticsView` | `legacy/analytics-v1/` | Plus a README naming the endpoints each one needs |
| `components/ui/*` | `web/components/ui/` | Import paths only |
| `scratch/*.ts` | `scripts/` | The three raw `ALTER TABLE` scripts are deleted; their intent becomes migrations |
| `scratch/backups/*` | untracked, outside the repository | C-01 |
| `test-user.ts` | `prisma/seed.ts` | Full rewrite against the real schema |
| `docs/reference/AdRIC_DB_Schema.sql` | becomes the baseline migration in `prisma/migrations/` | After the two syntax errors and the role seeding bug are fixed (H-22, H-23) |

---

## 8. What to rewrite instead of move

Being direct, as asked.

| Item | Verdict | Why |
|---|---|---|
| `src/app/prismaClient.ts` | **Delete** | 583 lines imitating a database in the browser. It is the direct cause of H-01 and H-02 and it makes every screen ambiguous about where data lives. There is nothing here worth keeping |
| `context.tsx` | **Rewrite** | It is three unrelated things in one file: a session store, an API layer, and a shadow database. Moving it whole just relocates the confusion. Keep the session and preference logic, move fetches into `web/api/`, delete the rest |
| `GET /api/assets` handler | **Rewrite** | 230 lines that load nine tables and derive a view model in JavaScript. Rewriting it as targeted queries is less work than moving it and then fixing M-01 and M-09 separately |
| `NotificationCenter.tsx` | **Rewrite** | One 470-line `useMemo` with hardcoded lab names, invented emails, and two buttons that do not save. The concept is good; the implementation should be rebuilt on top of the API layer |
| ITS inspection scheduling tab | **Rewrite or drop** | It persists nothing (H-18). Since you have not yet decided whether it should persist (open question 15), moving it as is only preserves the illusion. Move it under `legacy/` or rebuild it once the decision is made |
| The 11 analytics endpoints with no caller | **Quarantine** | They are unreviewed, untested, and describe institutional finances. Keeping them mounted is attack surface with no benefit (01C section 4.4) |
| `test-user.ts` | **Rewrite** | It targets fields that no longer exist |
| The three `scratch/` ALTER scripts | **Delete, capture intent as migrations** | Running them again against a real database is the failure mode we are trying to leave behind |

---

## 9. Ordered migration steps

Each step leaves the app working, can be verified in a few minutes, and can be undone by reverting one commit. Do them in order; none depends on a later one.

| # | Step | What moves | What could break | How to verify | How to undo |
|---|---|---|---|---|---|
| 0 | **Safety net first** | Nothing. Do 01C tier 1 (stop the backup, gitignore the data files, rotate passwords) | Nothing | `git status` shows no backup files; server still starts | Revert commit |
| 1 | **Add `tsconfig.json`** with `strict: false` initially, plus path aliases, and a `typecheck` script | Nothing moves | Nothing at runtime; expect a long list of reported errors on first run | `npm run typecheck` completes and prints a list | Delete the file |
| 2 | **Quarantine dead code** | 7 files into `legacy/analytics-v1/` with a README | Nothing, since nothing imports them | App builds and runs; every screen still works | Move back |
| 3 | **Create `shared/`** and move the enums and lab list into it | `ASSET_CONDITIONS`, category list, role names, `labs.ts` | Import paths in both halves | Type-check passes; a form still shows the same dropdown options | Move back |
| 4 | **Introduce `web/api/client.ts`** and convert one feature's calls (start with loans) | The `fetch` literals for loans | Loan screens only | Request a loan, approve it, confirm the row in the database | Revert; the old literals still exist elsewhere |
| 5 | **Convert the remaining features to the API client**, one per commit | The other `fetch` literals, including the ones in `context.tsx` | One feature at a time | Exercise that feature end to end | Revert one feature |
| 6 | **Split `context.tsx`** into `web/state/session.tsx` plus API modules; delete the localStorage-only actions | The shadow-database actions | Notification approvals and pending returns will visibly change behavior, correctly (H-01, H-02) | Approve a transfer from the bell and confirm the database changed | Revert; this is the step most worth doing carefully |
| 7 | **Delete `prismaClient.ts`** | 583 lines | Anything still importing it, which after step 6 should be only `Login.tsx`'s fallback | Log in with a real account; log in with a fake one and confirm it is refused | Revert |
| 8 | **Move the frontend to `web/` with feature folders**, one feature per commit; split `ITSDashboard` into pages last | Files only, no logic | Import paths, Vite alias | The app builds and every route loads | Revert per feature |
| 9 | **Merge ITS and TSG into `/staff/*`** | `routes.tsx`, `Sidebar.tsx` | Bookmarked URLs; add redirects from `/its/*` and `/tsg/*` | Log in as each and confirm one identical dashboard | Revert |
| 10 | **Create `server/` skeleton**: `main.ts`, `app.ts`, `config/`, and mount the existing `server.ts` routes unchanged | Startup and configuration only | Startup path, npm script | `npm run server` starts and `/api/assets` responds | Revert |
| 11 | **Extract one backend feature end to end** (recommended: `loans`, the smallest complete workflow) | 3 routes into 5 files | Loan endpoints only | Request, approve, and decline a loan | Revert one folder |
| 12 | **Extract the remaining features**, one per commit, in this order: returns, transfers, disposals, repairs, inspections, registrations, auth, assets, analytics | The rest of `server.ts` | One feature at a time; `assets` is the riskiest so it goes late | Exercise that workflow | Revert one feature |
| 13 | **Add `errorHandler` and `requireAuth`** once every feature is extracted | Cross-cutting middleware | Everything at once, which is why it comes after the split | Every endpoint returns a generic error; unauthenticated calls are refused | Revert |
| 14 | **Baseline the migrations**: fix the SQL file's two syntax errors, make it the first migration, add `prisma/seed.ts` | Database tooling | Nothing in the running app | Create a fresh test database from migrations and run the seed | Delete the folder |

Steps 0 to 9 are frontend and safety work that can proceed while Phase 2 test writing happens in parallel. Steps 10 to 14 are the backend split, and step 14 is the precondition for Phase 3.

---

## 10. What is CI, and where it fits

You asked what a CI setup is.

- **Simple:** CI stands for continuous integration. It is a robot that runs your checks for you. You connect it to your GitHub repository once, and from then on, every time someone pushes code or opens a pull request, it checks out the project on a fresh machine, installs the dependencies, and runs whatever commands you list, for example "check the types" and "run the tests". If anything fails, GitHub shows a red mark on that commit and says which command failed. If everything passes, a green tick. Nobody has to remember to run anything.
- **Technical:** For this project it would be GitHub Actions, one YAML file at `.github/workflows/ci.yml`, running on push and pull request: `npm ci`, then `npm run typecheck`, then `npm test`, and later a job that spins up a MariaDB service container, applies `prisma/migrations`, and runs the Phase 2 database tests against it.
- **Why it matters here specifically:** the two biggest quality problems in this codebase are that nothing checks the types (H-13) and that nothing is tested (M-18). Both are invisible until someone notices a bug in the running app. CI makes them visible at the moment they are introduced. It also prevents the restructure from silently breaking something between step 8 and step 12, which is exactly the window where a mistake is easiest to make and hardest to trace.
- **Is it required?** No. You can run `npm run typecheck` and `npm test` by hand. CI is the same thing, done automatically, with the result attached to the commit. My recommendation is to add the scripts first (step 1), work with them locally for a week, and add the CI file once the restructure is under way. It is roughly 20 lines and half an hour of setup.

---

## 11. Risks

| Risk | Likelihood | Impact | Reduce it by |
|---|---|---|---|
| **Splitting `server.ts` with no tests** | High | High | Do step 14 (migrations and a test database) early if you can, and write Phase 2 tests for a feature immediately before extracting it. Otherwise the only safety net is manual clicking |
| **The "current asset state" rule diverging during the split** | High | High | Extract `shared/services/assetState.ts` first and make every feature use it before moving anything else. Today that logic is repeated in at least six handlers with different tie-breaking (M-09) |
| **`ITSDashboard.tsx` splitting badly** | High | Medium | 2,939 lines with about 30 shared `useState` hooks across eight tabs. Split it last, one tab per commit, and accept some duplication rather than inventing a shared store |
| **Import path churn breaking the build silently** | Medium | Medium | Step 1 first. Without type checking, a wrong import path can survive until a user clicks the screen |
| **Behavior changes disguised as moves** | Medium | High | Rule: one commit either moves code or changes behavior, never both. Steps 6 and 7 deliberately change behavior and should say so in the commit message |
| **A teammate's environment drifting mid-restructure** | Medium | Medium | Add `.env.example` in step 0 and agree that everyone pulls after each step |
| **Scope creep into Phase 3** | High | Medium | Resist fixing schema problems during the move. Write them down, leave them for Phase 3. The exceptions are the fixes that have no schema impact: H-21's `@map`, H-22's seed, H-23's typos |
| **The restructure stalling half-done** | Medium | High | Every step above is independently shippable. If you stop after step 9, the project is still better organized than today and nothing is broken |

---

## 12. What this does not fix

Reorganizing files changes none of the following. They survive the restructure untouched and must be fixed as their own work.

| Category | Findings that survive |
|---|---|
| **Security** | C-02, C-03, C-06, C-07 remain until the session and hashing work is done. Moving `login` into `features/auth/` does not make it safe. C-01 is fixed by step 0, not by the restructure |
| **Data integrity** | H-04 (returns do not close loans), H-05 (no state guards), H-07 (free-text statuses), H-10 (guessed identity), H-14 (history overwritten), H-21 (enum mismatch) are all behavioral or schema issues |
| **Database** | H-15 (no migrations) is addressed by step 14, but every Phase 3 deliverable, triggers, procedures, bundles, usage time, retention, is untouched by this plan |
| **Panel comments** | D1, D2, S1 through S7 are all still open. The restructure only gives each of them an obvious place to be implemented |
| **Correctness** | H-08 (GET that writes), H-09 (invented analytics), H-12 (phantom column), H-22 (Director seeded wrong) are one-line or one-row fixes that should be done independently, and soon |
| **Performance** | M-01 (nine-table loads) and M-17 (base64 images) are rewrites, not moves |

- **Simple:** A tidy house is not a safe house. This plan makes the code findable and gives every future fix an obvious home. It does not, by itself, make a single one of those fixes.
