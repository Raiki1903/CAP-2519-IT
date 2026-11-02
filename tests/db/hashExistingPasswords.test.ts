/**
 * Tests the password upgrade script: which URLs its guard accepts, and what the script does to the rows when it runs.
 * Covers prisma/hashTarget.ts and prisma/hashExistingPasswords.ts, run as a child process on the test database. (C-03, issue #10)
 * Fixtures: made-up URLs; the seeded accounts, which hold hashes; and two invented accounts with plain passwords.
 * A remote URL is only ever given to the guard or refused by it: nothing here connects to one.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALLOW_REMOTE_FLAG, parseHashTarget } from "../../prisma/hashTarget";
import { parseSeedTarget, SeedRefused } from "../../prisma/seedTarget";
import { verifyPassword } from "../../server/shared/services/passwords";
import { createTestPrisma, resetDatabase } from "../setup/db";
import { seedDatabase } from "../setup/seed";
import { loadTestDatabaseConfig, REPO_ROOT } from "../setup/testDatabase";
import { USERS } from "../setup/fixtures";

const REMOTE_URL = "mysql://root:fake-secret-value@db.example.test:3306/AdRIC_DB";

describe("parseHashTarget", () => {
  it("accepts a local URL with no flag", () => {
    expect(parseHashTarget("mysql://root:fake-password@localhost:3306/adric_uat_check", [])).toMatchObject({ host: "localhost", database: "adric_uat_check" });
  });

  it("refuses a remote URL without the flag, naming the flag, and accepts it with the flag", () => {
    expect(() => parseHashTarget(REMOTE_URL, [])).toThrow(SeedRefused);
    expect(() => parseHashTarget(REMOTE_URL, [])).toThrow(/--allow-remote/);
    expect(parseHashTarget(REMOTE_URL, [ALLOW_REMOTE_FLAG])).toMatchObject({ host: "db.example.test" });
  });

  it("refuses when HASH_TARGET_URL is not set, and says the script never reads .env", () => {
    expect(() => parseHashTarget(undefined, [ALLOW_REMOTE_FLAG])).toThrow(/HASH_TARGET_URL is not set.*never reads \.env/);
  });

  it("keeps every other check with the flag on", () => {
    expect(() => parseHashTarget("postgres://root:fake-password@db.example.test/demo", [ALLOW_REMOTE_FLAG])).toThrow(/mysql:\/\//);
    expect(() => parseHashTarget("mysql://root@db.example.test/demo", [ALLOW_REMOTE_FLAG])).toThrow(/user name and a password/);
  });

  it("never puts the URL, the host, or the password in its message", () => {
    try {
      parseHashTarget(REMOTE_URL, []);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("fake-secret-value");
      expect((error as Error).message).not.toContain("db.example.test");
    }
  });

  it("leaves the seed with no way past the local-host rule", () => {
    expect(() => parseSeedTarget(REMOTE_URL)).toThrow(/Seed refused: the host must be localhost/);
  });
});

describe("prisma/hashExistingPasswords.ts", () => {
  const config = loadTestDatabaseConfig();
  const db = createTestPrisma(config);
  const PLAIN_ROWS = [
    { first_name: "Test", last_name: "Plain One", email: "plain.one@example.test", password: "test-password-plain-one", id_number: 95000001, user_type: "STUDENT" as const },
    { first_name: "Test", last_name: "Plain Two", email: "plain.two@example.test", password: "Short1", id_number: 95000002, user_type: "STUDENT" as const },
  ];
  const seededCount = Object.keys(USERS).length;

  /** Runs the script as a child process, with only the given HASH_TARGET_URL, from the repository root. */
  function runScript(url: string | undefined, args: string[] = []) {
    const tsxLoader = pathToFileURL(createRequire(path.join(REPO_ROOT, "package.json")).resolve("tsx")).href;
    const env: NodeJS.ProcessEnv = { ...process.env, HASH_TARGET_URL: url };
    if (url === undefined) delete env.HASH_TARGET_URL;
    const result = spawnSync(process.execPath, ["--import", tsxLoader, path.join(REPO_ROOT, "prisma", "hashExistingPasswords.ts"), ...args], {
      cwd: REPO_ROOT,
      env,
      encoding: "utf-8",
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  }

  const passwordOf = async (email: string) => (await db.users.findUniqueOrThrow({ where: { email } })).password;

  beforeAll(async () => {
    await resetDatabase(db, config);
    await seedDatabase(db);
    await db.users.createMany({ data: PLAIN_ROWS });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("refuses a remote URL without the flag, before connecting, and changes nothing", async () => {
    const res = runScript(REMOTE_URL);

    expect(res.status).toBe(1);
    expect(res.output).toContain("--allow-remote");
    expect(res.output).not.toContain("fake-secret-value");
    expect(res.output).not.toContain("db.example.test");
    expect(await passwordOf(PLAIN_ROWS[0].email)).toBe(PLAIN_ROWS[0].password);
  });

  it("refuses when HASH_TARGET_URL is not set, whatever .env holds", async () => {
    const res = runScript(undefined);

    expect(res.status).toBe(1);
    expect(res.output).toContain("HASH_TARGET_URL is not set");
    expect(await passwordOf(PLAIN_ROWS[0].email)).toBe(PLAIN_ROWS[0].password);
  });

  it("hashes the plain rows and skips the hashed ones, printing only the counts", async () => {
    const seededHashBefore = await passwordOf(USERS.custodianA.email);

    const res = runScript(config.url);

    expect(res.status, res.output).toBe(0);
    expect(res.output.trim()).toBe(`[hash] hashed: ${PLAIN_ROWS.length}, skipped: ${seededCount}`);
    for (const row of PLAIN_ROWS) {
      expect(await verifyPassword(row.password, await passwordOf(row.email)), row.email).toBe(true);
      expect(res.output).not.toContain(row.password);
      expect(res.output).not.toContain(row.email);
      expect(res.output).not.toContain(row.last_name);
    }
    expect(res.output).not.toContain("scrypt$");
    expect(await passwordOf(USERS.custodianA.email)).toBe(seededHashBefore);
  });

  it("changes 0 rows on a second run", async () => {
    const before = await passwordOf(PLAIN_ROWS[0].email);

    const res = runScript(config.url);

    expect(res.output.trim()).toBe(`[hash] hashed: 0, skipped: ${seededCount + PLAIN_ROWS.length}`);
    expect(await passwordOf(PLAIN_ROWS[0].email)).toBe(before);
  });
});
