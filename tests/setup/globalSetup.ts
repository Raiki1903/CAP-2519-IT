/**
 * Runs once before the whole test run: checks the target database, drops its tables, then builds them again from prisma/migrations.
 * Layer: test setup. Called by vitest.config.ts (globalSetup). Calls testDatabase.ts, db.ts, and the Prisma CLI (migrate deploy, migrate diff).
 * Used by: every test run. If the guard refuses, a migration fails, or schema.prisma has a change no migration contains, no test file runs.
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { createTestPrisma, dropAllTables } from "./db";
import { describeTarget, loadTestDatabaseConfig, REPO_ROOT, type TestDatabaseConfig } from "./testDatabase";

function redact(text: string, config: TestDatabaseConfig): string {
  return text.split(config.url).join("<TEST_DATABASE_URL>").split(config.password).join("<password>");
}

/**
 * Checks TEST_DATABASE_URL, drops every table in the test database, applies prisma/migrations with
 * `prisma migrate deploy`, then asks `prisma migrate diff` whether the result matches prisma/schema.prisma.
 * Building from the migrations, not from schema.prisma (`db push`), means every run tests the files that
 * will one day be deployed to CCS Cloud. The tables are dropped rather than emptied because migrate
 * deploy only builds on a database it has a record for.
 *
 * @throws TestDatabaseRefused when the URL fails the guard
 * @throws Error when the database cannot be reached, a migration fails, or schema.prisma differs from the migrations
 */
export default async function setup(): Promise<void> {
  const config = loadTestDatabaseConfig();
  const target = describeTarget(config);

  const prisma = createTestPrisma(config);
  let storedName: string;
  try {
    storedName = await dropAllTables(prisma, config);
  } catch (error) {
    throw new Error(
      `[tests] Could not open ${target}. Is MySQL running, and was the database created? See tests/README.md.\n` +
        redact(String((error as Error)?.message ?? error), config),
    );
  } finally {
    await prisma.$disconnect();
  }

  // The Prisma CLI is given the name as MySQL stores it. On Windows that is lower case, and with the
  // mixed-case name from the URL Prisma does not recognize the existing tables and keys as the same ones.
  const targetUrl = new URL(config.url);
  targetUrl.pathname = `/${storedName}`;
  const prismaCli = createRequire(path.join(REPO_ROOT, "package.json")).resolve("prisma/build/index.js");
  const runPrisma = (args: string[]): SpawnSyncReturns<string> =>
    // PRISMA_TARGET_URL is set for this one command only; prisma.config.ts reads nothing else and does not load .env.
    spawnSync(process.execPath, [prismaCli, ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, PRISMA_TARGET_URL: targetUrl.toString(), PRISMA_HIDE_UPDATE_MESSAGE: "1" },
      encoding: "utf8",
    });
  const outputOf = (result: SpawnSyncReturns<string>): string =>
    redact(`${result.stdout ?? ""}${result.stderr ?? ""}`.split(targetUrl.toString()).join("<TEST_DATABASE_URL>"), config);

  console.log(`[tests] Applying prisma/migrations to ${target}.`);
  const deploy = runPrisma(["migrate", "deploy"]);
  if (deploy.status !== 0) {
    throw new Error(`[tests] prisma migrate deploy failed for ${target}.\n${outputOf(deploy)}`);
  }

  // Exit code 2 means the database the migrations built differs from schema.prisma: someone changed
  // the schema without adding a migration, or a migration does something the schema does not say.
  const diff = runPrisma(["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--script", "--exit-code"]);
  if (diff.status === 2) {
    throw new Error(
      "[tests] prisma/schema.prisma has changes that no migration in prisma/migrations contains. " +
        "Add a migration for them (docs/guides/DATABASE-MIGRATIONS.md). What is missing:\n" +
        outputOf(diff),
    );
  }
  if (diff.status !== 0) {
    throw new Error(`[tests] prisma migrate diff failed for ${target}.\n${outputOf(diff)}`);
  }
  console.log("[tests] The migrations built the test database, and prisma/schema.prisma matches it.");
}
