/**
 * Tests what the demo seed writes for passwords, by running it on the emptied test database. (C-03, issue #10)
 * Covers prisma/seed.ts, run as a child process the way npm run seed runs it.
 * Fixtures: a made-up demo password, and the accounts in prisma/seedData.ts.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS } from "../../prisma/seedData";
import { isPasswordHash, verifyPassword } from "../../server/shared/services/passwords";
import { createTestPrisma, resetDatabase } from "../setup/db";
import { loadTestDatabaseConfig, REPO_ROOT } from "../setup/testDatabase";

const DEMO_PASSWORD = "made-up-demo-password";

describe("prisma/seed.ts", () => {
  const config = loadTestDatabaseConfig();
  const db = createTestPrisma(config);
  let output = "";

  beforeAll(async () => {
    await resetDatabase(db, config);
    const tsxLoader = pathToFileURL(createRequire(path.join(REPO_ROOT, "package.json")).resolve("tsx")).href;
    const result = spawnSync(process.execPath, ["--import", tsxLoader, path.join(REPO_ROOT, "prisma", "seed.ts")], {
      cwd: REPO_ROOT,
      env: { ...process.env, SEED_DATABASE_URL: config.url, SEED_PASSWORD: DEMO_PASSWORD },
      encoding: "utf-8",
    });
    output = `${result.stdout}${result.stderr}`;
    expect(result.status, "the seed failed").toBe(0);
  }, 120_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("writes a hash of SEED_PASSWORD for every demo account but the anonymized one, each with its own salt", async () => {
    const rows = await db.users.findMany({ select: { password: true, anonymized_at: true } });
    const hashed = rows.filter((r) => r.anonymized_at === null);

    expect(rows).toHaveLength(DEMO_ACCOUNTS.length);
    expect(hashed.every((r) => isPasswordHash(r.password))).toBe(true);
    expect(new Set(hashed.map((r) => r.password)).size).toBe(hashed.length);
    expect(await verifyPassword(DEMO_PASSWORD, hashed[0].password)).toBe(true);
    // anonymizeUser clears the password to an empty string, which never verifies.
    expect(rows.filter((r) => r.anonymized_at !== null).map((r) => r.password)).toEqual([""]);
  });

  it("prints neither the password nor a hash", () => {
    expect(output).not.toContain(DEMO_PASSWORD);
    expect(output).not.toContain("scrypt$");
  });
});
