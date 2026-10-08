# AdRIC System (combined)

Asset Management System for DLSU CCS AdRIC. This is the **combined** project: the
Vite/React frontend and the Express/Prisma/MariaDB backend now live in one root and
install from one `package.json`.

## Layout

```
AdRIC_System/
  index.html            Frontend entry (Vite)
  vite.config.ts        Frontend build config
  web/                  Frontend source (React): app shell, pages, features, api, state
  shared/               Enums and constants used by both frontend and backend
  server/               Backend API (Express, listens on http://localhost:4000)
    main.ts             Starts the server (npm run server)
    app.ts              Express app: middleware, then the routes
    remainingRoutes.ts  The routes not yet split into server/features/ (restructure steps 11 and 12)
    config/env.ts       Reads and checks .env; the server will not start without the DATABASE_* variables
    config/prisma.ts    Prisma client wired to the MariaDB adapter
    shared/services/    mailer.ts (Mailgun)
    jobs/backup.ts      Optional backup, switched off unless BACKUP_DIR is set
  prisma.config.ts      Prisma CLI config
  prisma/schema.prisma  Authoritative database schema
  generated/prisma/     Generated Prisma client (imported by server/config/prisma.ts)
  test-user.ts          Seed / test script
  .env                  Database connection settings
  docs/                 Merge notes + the old FE design schema, kept for reference
```

## Setup

1. Install dependencies (one install now covers both halves):
   ```
   npm install
   ```
   If React is not pulled in automatically, run `npm install react@18.3.1 react-dom@18.3.1`.

2. Make sure the database connection in `.env` is correct and reachable (the backend
   reads `DATABASE_HOST/PORT/USER/PASSWORD/NAME`, all five required, see `.env.example`;
   the port must match your SSH tunnel).

3. Regenerate the Prisma client if needed:
   ```
   npm run prisma:generate
   ```

## Running

The frontend calls the backend at `http://localhost:4000`, so both need to run.

- Both at once:
  ```
  npm run dev:all
  ```
- Or in two terminals:
  ```
  npm run server     # Express API on :4000
  npm run dev        # Vite dev server (frontend)
  ```

See `docs/phase-0-merge/MERGE_NOTES.md` for exactly how the two projects were combined and which
conflicting files were resolved.
