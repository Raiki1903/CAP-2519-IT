# AdRIC Asset Management System — Development Progress

## Overview

This project is a full-stack MVC refactor of a Figma Make export.
The starting point was a **frontend-only prototype**: React 18 + Vite 6, all data hardcoded in components and a single in-memory React Context, with a Prisma schema that existed but was wired to nothing.

The goal is a real 3-tier application:

| Tier | Technology |
|------|-----------|
| **View** | React 18 + Tailwind + shadcn/ui + TanStack Query |
| **Controller** | Node.js + Express + TypeScript |
| **Model** | Prisma ORM → MySQL |

---

## What Was Done and Why

### STEP 0 — Audit (no code written)

A full audit of the repo was performed before touching anything.

**Findings:**

- **No backend existed.** All data (equipment inventory, repair requests, borrow requests, custody transfers) was hardcoded inside component files as literal arrays.
- **Prisma schema (`Adric-Database.prisma`) was incomplete.** The `datasource` block had no `url`, so it could never connect to any database. The provider was set to PostgreSQL; the target stack requires MySQL.
- **The role model in the schema was out of date.** It had `ADRIC_DIRECTOR`, `ADRIC_SECRETARY`, `TSG_STAFF` — none of which matched the agreed role names. It was missing `RESEARCHER`, `ITS`, and `DIRECTOR_ASSISTANT` entirely.
- **The `UserType` enum had only `STUDENT` and `FACULTY`** — missing `STAFF` (needed for ITS/TSG/Admin personnel).
- **Several frontend data shapes had no DB backing:**
  - Borrow/loan workflow (frontend had `BorrowRequest` type + custodian "My Assets" with due dates) — no model in the schema.
  - Asset `condition` field — shown prominently in the UI, not in the schema.
  - Asset fields `manufacturer`, `procured` (acquisition date), `warranty` — in the UI, not in the schema.
  - `priority` and `acknowledged` on repair requests — in the frontend context, not in the schema.
- **No `tsconfig.json`, no `.gitignore`, no `.env`/`.env.example`** — the project had none of these.
- **`pnpm-workspace.yaml` existed** but only pointed at `'.'` (the root), not a proper monorepo layout.
- **React and react-dom were listed as optional peer dependencies**, meaning they might not be installed. In a real monorepo they must be regular dependencies.
- **No `@tanstack/react-query`, no `express`, no `jsonwebtoken`, no `bcrypt`, no `zod`** — none of the backend or data-fetching libraries existed yet.
- **Three role-based dashboards had no screens:** DIRECTOR, DIRECTOR_ASSISTANT, and ADMIN had no routes and no components.

**Decisions confirmed during audit:**

| Question | Answer |
|----------|--------|
| MySQL or PostgreSQL? | MySQL |
| Add `AssetLoan` / borrow model now? | Defer to Stage 4 |
| Add `AssetCondition` field now? | Defer |
| Director self-relation (`reportsToId`)? | Defer — one Director only |

---

### STAGE 0 — Monorepo Scaffold (no behavior change)

**Goal:** Convert the repo into a proper pnpm monorepo so the API and web app can live and be deployed independently, while sharing types via a `packages/` layer later.

**What was changed:**

#### Directory structure
```
Before:                          After:
CAP-2519-IT/                     CAP-2519-IT/
├── src/                         ├── apps/
├── index.html                   │   ├── web/        ← React app lives here now
├── vite.config.ts               │   │   ├── src/
├── postcss.config.mjs           │   │   ├── index.html
├── default_shadcn_theme.css     │   │   ├── vite.config.ts
├── package.json  (monolith)     │   │   ├── postcss.config.mjs
└── pnpm-workspace.yaml          │   │   ├── default_shadcn_theme.css
    (pointed at '.')             │   │   ├── tsconfig.json
                                 │   │   └── package.json
                                 │   └── api/        ← Express API (stub, Stage 2)
                                 │       ├── src/server.ts
                                 │       └── package.json
                                 ├── packages/       ← shared types (Stage 5)
                                 ├── prisma/         ← schema moves here (Stage 1)
                                 ├── tsconfig.base.json
                                 ├── pnpm-workspace.yaml
                                 ├── package.json    (monorepo root)
                                 ├── .gitignore
                                 └── .env.example
```

#### `pnpm-workspace.yaml`
Updated from `packages: ['.']` to `apps/*` + `packages/*`, and added:
- `overrides: vite: 6.3.5` (moved here from `package.json` because pnpm v11 no longer reads the `"pnpm"` key in package.json)
- `allowBuilds` for `@tailwindcss/oxide` and `esbuild` (required for Vite/Tailwind to run install scripts)

#### Root `package.json`
Stripped from a 65-dependency Figma export file down to a monorepo root with only:
- `typescript ^5` and `@types/node ^22` in devDependencies
- Three convenience scripts: `dev:web`, `dev:api`, `build`

#### `apps/web/package.json`
Created with all the original React dependencies, plus:
- `react` and `react-dom` promoted from optional peerDependencies to real `dependencies`
- `@types/react ^18` and `@types/react-dom ^18` added to devDependencies (were missing entirely)

#### TypeScript config
- `tsconfig.base.json` at root — shared strict base (no files of its own; named `.base.json` so VS Code does not auto-discover it as a project root, which would cause a "no inputs" error)
- `apps/web/tsconfig.json` — extends the base, adds `jsx: react-jsx`, `moduleResolution: bundler`, `@/*` path alias

#### `.gitignore`
Created from scratch — covers `node_modules/`, `.env`, `dist/`, editor folders, OS files.

#### `.env.example`
Documents every environment variable the finished stack will need:
- `DATABASE_URL` — MySQL connection string for Prisma
- `PORT` — Express server port (default 4000)
- `JWT_SECRET` / `JWT_EXPIRES_IN` — for auth (Stage 3)
- `VITE_API_URL` — consumed by the web app via `import.meta.env`
- Placeholder lines for Mailgun (Stage 5+)

#### pnpm installed
- Installed pnpm v11 globally via npm (was not present)
- Ran `pnpm install` from the monorepo root — all 296 packages resolved cleanly
- Verified: `pnpm dev:web` starts Vite 6.3.5 at `http://localhost:5173/` in ~645 ms with no errors

**The app is unchanged visually.** All existing screens, roles, and navigation work exactly as before.

---

## How to Run It Right Now

```bash
# Prerequisites: Node 22+, pnpm (already installed globally)

# Install all workspace dependencies
pnpm install

# Start the React app
pnpm dev:web
# → http://localhost:5173/

# (API is a stub — Stage 2 will make it real)
```

---

## What Comes Next

### STAGE 1 — Database & Model

**Goal:** Make the database real. After this stage, Prisma Studio will show all the correct tables populated with seed data that mirrors the current hardcoded arrays.

Tasks:
1. Move `Adric-Database.prisma` → `prisma/schema.prisma` and fix the datasource (`provider = "mysql"`, `url = env("DATABASE_URL")`)
2. Apply the full role model:
   - Rename enum values: `ADRIC_DIRECTOR` → `DIRECTOR`, `ADRIC_SECRETARY` → `DIRECTOR_ASSISTANT`, `TSG_STAFF` → `TSG`
   - Add `RESEARCHER` and `ITS` to `RoleName`
   - Add `STAFF` to `UserType`
   - Add `isHead Boolean @default(false)` to `UserCenter`
3. Fix `AssetStatus` enum — add `ON_LOAN` and `RESERVED` (currently missing; frontend uses both)
4. Add missing Asset fields: `manufacturer`, `acquisitionDate`, `warrantyExpiry`
5. Add `priority`, `acknowledged`, `imageUrl` to `AssetRepair`
6. Create `apps/api/src/lib/prisma.ts` — single shared `PrismaClient` instance
7. Write `prisma/seed.ts` — inserts all current hardcoded mock data (equipment arrays, repair requests, sample users for each role) so the UI still has data to display
8. Add npm scripts: `prisma:generate`, `prisma:migrate`, `prisma:seed`, `prisma:studio`

**To test after Stage 1:**
```bash
# Start MySQL (or Docker)
docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=adric_db mysql:8

# Copy and fill .env
cp .env.example .env
# Set: DATABASE_URL=mysql://root:root@localhost:3306/adric_db

# Migrate and seed
pnpm --filter @adric/api prisma:migrate
pnpm --filter @adric/api prisma:seed
pnpm --filter @adric/api prisma:studio  # verify data in browser
```

---

### STAGE 2 — Express API + First Vertical Slice (Assets)

**Goal:** Stand up the Express server and wire the asset list end-to-end through the stack. After this stage, the asset catalog and ITS inventory tab will load from the database — not from a hardcoded array.

New packages: `express`, `cors`, `tsx` (API); `@tanstack/react-query`, `axios` (web)

Structure built:
```
apps/api/src/
├── server.ts          ← Express app, cors, json, error handler, health route
├── routes/
│   └── asset.routes.ts
├── controllers/
│   └── asset.controller.ts   ← thin: parse req → call service → send res
├── services/
│   └── asset.service.ts      ← all Prisma queries live here
└── lib/
    └── prisma.ts
```

Frontend additions:
```
apps/web/src/lib/
├── api.ts             ← axios instance pointed at VITE_API_URL
├── queryClient.ts     ← TanStack Query client
└── hooks/
    └── useAssets.ts   ← useQuery wrapping GET /api/assets
```

The `allEquipment` array in `AssetCatalog.tsx` and `mockInventory` in `ITSDashboard.tsx` are deleted and replaced with `useAssets()`.

---

### STAGE 3 — Auth & RBAC

**Goal:** Real login. JWT tokens. Role-based route protection.

New packages: `jsonwebtoken`, `bcrypt`, `zod` (API)

- `POST /api/auth/login` — validates credentials, returns a signed JWT containing `userId` and `roles[]`
- Auth middleware decodes the JWT and populates `req.user`
- RBAC guard checks `req.user.roles` against the route's required roles (union semantics — a user's permissions are the union of all their roles)
- Login screen wired to the real endpoint; `AppContext` role replaced with the authenticated user object from the JWT
- Each role's route tree protected in React (redirect to `/login` if unauthenticated or wrong role)

---

### STAGE 4 — Remaining Modules

**Goal:** Every screen reads and writes real data. `AppContext` holds only UI state (sidebar collapsed, theme) — no data.

Modules to convert (each follows the same controller → service → Prisma slice pattern):
1. **Asset Information & Monitoring** — TSG health data, lab groups, maintenance queues
2. **Repair & Maintenance** — `AssetRepair` CRUD, priority, acknowledgement
3. **Borrow/Loan** — add `AssetLoan` model, custodian "My Assets", due dates, delinquency calculation
4. **Custodianship Transfer** — `CustodianshipTransfer` approval flow
5. **Asset Disposal** — `AssetDisposal` with reason and approval
6. **Reports & Analytics** — aggregate queries for Director/Lab Head dashboards
7. **User Management** — ADMIN stub screens, user CRUD

After Stage 4: zero hardcoded data arrays remain in the frontend.

---

### STAGE 5 — Cleanup & Guardrails

**Goal:** Production-ready codebase.

- Delete all dead code (unused mock arrays, context state that moved to the API)
- Create `packages/shared/` — TypeScript types and enums shared between `apps/web` and `apps/api` (eliminates duplication)
- Add Zod validation schemas on every write endpoint (`POST`, `PUT`, `PATCH`, `DELETE`)
- Finalize README with complete local-setup guide including test login credentials for every role

---

### STAGE 5+ — Integrations (future)

- **QR code generation** (`qrcode` package) — generate and serve QR codes for assets via the API
- **Email notifications** (`mailgun.js`) — notify custodians on transfer approvals, repair completions

---

## Dependency Install Timeline

| Stage | Package | Location | Purpose |
|-------|---------|----------|---------|
| 0 ✅ | `typescript ^5`, `@types/node ^22` | root | Monorepo TS tooling |
| 0 ✅ | `@types/react ^18`, `@types/react-dom ^18` | apps/web | React types |
| 1 | `prisma`, `@prisma/client`, `dotenv` | apps/api | ORM + env loading |
| 2 | `express`, `cors`, `tsx` | apps/api | HTTP server |
| 2 | `@types/express`, `@types/cors` | apps/api | TS types |
| 2 | `@tanstack/react-query`, `axios` | apps/web | Data fetching |
| 3 | `jsonwebtoken`, `bcrypt`, `zod` | apps/api | Auth + validation |
| 3 | `@types/jsonwebtoken`, `@types/bcrypt` | apps/api | TS types |
| 5+ | `qrcode`, `mailgun.js` | apps/api | Integrations |
