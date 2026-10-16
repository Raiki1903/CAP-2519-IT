/**
 * Prisma CLI configuration: where the schema and the migrations are, and which database a CLI command acts on.
 * Layer: config. Read by the Prisma CLI only (generate, migrate deploy, migrate diff); the server never reads it.
 * Used by: npm run prisma:generate, the test setup (tests/setup/globalSetup.ts), and docs/guides/DATABASE-MIGRATIONS.md.
 */
import { defineConfig } from "prisma/config";

// The target database comes from PRISMA_TARGET_URL only, set in the shell for the one command that needs it.
// This file does not load .env, whose settings point at CCS Cloud, so a command that names no database
// stops with "no URL" instead of reaching the shared database. How to set it: docs/guides/DATABASE-MIGRATIONS.md.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["PRISMA_TARGET_URL"],
  },
});
