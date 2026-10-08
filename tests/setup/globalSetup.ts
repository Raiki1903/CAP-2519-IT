/**
 * Runs once before the whole test run: checks the target database, empties it, then loads the table structure into it.
 * Layer: test setup. Called by vitest.config.ts (globalSetup). Calls testDatabase.ts, db.ts, and the Prisma CLI (db push).
 * Used by: every test run. If the guard refuses, no test file runs.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { createTestPrisma, resetDatabase } from "./db";
import { describeTarget, loadTestDatabaseConfig, REPO_ROOT, type TestDatabaseConfig } from "./testDatabase";

function redact(text: string, config: TestDatabaseConfig): string {
  return text.split(config.url).join("<TEST_DATABASE_URL>").split(config.password).join("<password>");
}

/**
 * Checks TEST_DATABASE_URL, empties whatever tables the test database already has, and runs a
 * plain `prisma db push` so the tables match prisma/schema.prisma.
 * Emptying first means a schema change never trips db push's data-loss warning, so it needs
 * neither `--force-reset` nor `--accept-data-loss`. `prisma migrate` is not used: migrations
 * are baselined later (restructure step 14).
 *
 * @throws TestDatabaseRefused when the URL fails the guard
 * @throws Error when the database cannot be reached or `prisma db push` fails
 */
export default async function setup(): Promise<void> {
  const config = loadTestDatabaseConfig();
  const target = describeTarget(config);

  const prisma = createTestPrisma(config);
  let storedName: string;
  try {
    storedName = await resetDatabase(prisma, config);
  } catch (error) {
    throw new Error(
      `[tests] Could not open ${target}. Is MySQL running, and was the database created? See tests/README.md.\n` +
        redact(String((error as Error)?.message ?? error), config),
    );
  } finally {
    await prisma.$disconnect();
  }

  // db push is given the name as MySQL stores it. On Windows that is lower case, and with the
  // mixed-case name from the URL Prisma does not find the existing foreign keys, so a second
  // push fails trying to add them again ("Duplicate foreign key constraint name").
  const pushUrl = new URL(config.url);
  pushUrl.pathname = `/${storedName}`;

  console.log(`[tests] Loading prisma/schema.prisma into ${target}.`);
  const prismaCli = createRequire(path.join(REPO_ROOT, "package.json")).resolve("prisma/build/index.js");
  // DATABASE_URL is set for this one command only. prisma.config.ts loads .env too,
  // but dotenv never overrides a variable that is already set.
  const result = spawnSync(process.execPath, [prismaCli, "db", "push"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: pushUrl.toString(), PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.split(pushUrl.toString()).join("<TEST_DATABASE_URL>");
    throw new Error(`[tests] prisma db push failed for ${target}.\n${redact(output, config)}`);
  }
}
