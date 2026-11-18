/**
 * Tests the base seed (SEED_MODE=base, issue #200) by running it on the emptied test database: the rows it writes for a
 * clean start (lookups, 5 roles, 10 labs, one IT Admin), that it writes nothing else, that it prints no secret, and
 * that each bad setting makes it refuse before it writes anything.
 * Covers prisma/seed.ts and prisma/seedTarget.ts, run as a child process the way npm run seed runs it.
 * Fixtures: a made-up password and a made-up @dlsu.edu.ph email, and the lookup lists in prisma/seedData.ts.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_PASSWORD_LENGTH } from "@shared/constants/passwords";
import {
  DEMO_CATEGORIES, DEMO_CATEGORY_METRICS, DEMO_FUNDING_SOURCES, DEMO_ISSUE_TYPES, DEMO_LABS, DEMO_METRICS,
} from "../../prisma/seedData";
import { isPasswordHash, verifyPassword } from "../../server/shared/services/passwords";
import { createTestPrisma, resetDatabase } from "../setup/db";
import { loadTestDatabaseConfig, REPO_ROOT } from "../setup/testDatabase";

const BASE_PASSWORD = "made-up-first-password";
/** Typed with spaces and capitals, to show the seed stores it trimmed and in lower case. */
const TYPED_EMAIL = "  Made.Up.Admin@DLSU.edu.ph ";
const STORED_EMAIL = "made.up.admin@dlsu.edu.ph";

const ROLE_NAMES = ["IT_ADMIN", "ADRIC_DIRECTOR", "ADRIC_SECRETARY", "TSG_STAFF", "RESEARCHER"];

describe("prisma/seed.ts with SEED_MODE=base", () => {
  const config = loadTestDatabaseConfig();
  const db = createTestPrisma(config);
  const tsxLoader = pathToFileURL(createRequire(path.join(REPO_ROOT, "package.json")).resolve("tsx")).href;

  /** Runs the seed as a child process. The SEED_ variables of this shell are dropped; `env` sets the ones the case needs. */
  function runSeed(env: Record<string, string>): { status: number | null; output: string } {
    const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("SEED_")));
    const result = spawnSync(process.execPath, ["--import", tsxLoader, path.join(REPO_ROOT, "prisma", "seed.ts")], {
      cwd: REPO_ROOT,
      env: { ...inherited, SEED_DATABASE_URL: config.url, ...env },
      encoding: "utf-8",
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  }

  const baseEnv = { SEED_MODE: "base", SEED_ADMIN_EMAIL: TYPED_EMAIL, SEED_PASSWORD: BASE_PASSWORD };

  /** How many rows each table the seed fills holds, by table name. */
  async function rowCounts(): Promise<Record<string, number>> {
    return {
      users: await db.users.count(),
      user_roles: await db.user_roles.count(),
      roles: await db.roles.count(),
      research_centers: await db.research_centers.count(),
      asset_categories: await db.asset_categories.count(),
      funding_sources: await db.funding_sources.count(),
      issue_types: await db.issue_types.count(),
      metric_definitions: await db.metric_definitions.count(),
      category_metrics: await db.category_metrics.count(),
    };
  }

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("on an empty database", () => {
    let output = "";

    beforeAll(async () => {
      await resetDatabase(db, config);
      const result = runSeed(baseEnv);
      output = result.output;
      expect(result.status, `the base seed failed:\n${output}`).toBe(0);
    }, 120_000);

    it("writes exactly one user: active, the IT Admin, with the given email and no labs", async () => {
      const users = await db.users.findMany({ include: { user_roles: { include: { roles: true } }, user_centers: true, headed_center: true } });

      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({
        first_name: "AdRIC", last_name: "IT Admin", email: STORED_EMAIL, id_number: null, user_img: null,
        user_type: "STAFF", account_status: "ACTIVE",
        status_decided_by_id: null, status_decided_at: null, anonymized_at: null,
        user_centers: [], headed_center: null,
      });
      expect(users[0].user_roles.map((r) => r.roles.role_name)).toEqual(["IT_ADMIN"]);
    });

    it("writes exactly one user_roles row: that user, as IT Admin", async () => {
      const [user] = await db.users.findMany();
      const rows = await db.user_roles.findMany({ include: { roles: true } });

      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBe(user.user_id);
      expect(rows[0].roles.role_name).toBe("IT_ADMIN");
    });

    it("stores a hash of SEED_PASSWORD that verifies, never the password itself", async () => {
      const [user] = await db.users.findMany();

      expect(user.password).not.toBe(BASE_PASSWORD);
      expect(isPasswordHash(user.password)).toBe(true);
      expect(await verifyPassword(BASE_PASSWORD, user.password)).toBe(true);
      expect(await verifyPassword("another-made-up-password", user.password)).toBe(false);
    });

    it("writes the 5 roles with the ids the demo seed gives them", async () => {
      const roles = await db.roles.findMany({ orderBy: { role_id: "asc" } });

      expect(roles.map((r) => [r.role_id, r.role_name])).toEqual(ROLE_NAMES.map((name, i) => [i + 1, name]));
    });

    it("writes the 10 labs with the ids the demo seed gives them, none with a Head", async () => {
      const labs = await db.research_centers.findMany({ orderBy: { center_id: "asc" } });

      expect(labs.map((l) => [l.center_id, l.short_code, l.name, l.location])).toEqual(
        DEMO_LABS.map((lab, i) => [i + 1, lab.shortCode, lab.name, lab.location]),
      );
      expect(labs.every((l) => l.head_user_id === null)).toBe(true);
    });

    it("writes the 20 categories, and the funding sources, issue types, metrics and category metrics the demo seed writes", async () => {
      expect(DEMO_CATEGORIES).toHaveLength(20);
      expect((await db.asset_categories.findMany({ orderBy: { code: "asc" } })).map((c) => [c.code, c.label, c.useful_life_years, c.is_active])).toEqual(
        [...DEMO_CATEGORIES].sort((a, b) => a.code.localeCompare(b.code)).map((c) => [c.code, c.label, 5, true]),
      );
      expect((await db.funding_sources.findMany()).map((f) => f.name).sort()).toEqual([...DEMO_FUNDING_SOURCES].sort());
      expect((await db.issue_types.findMany()).map((t) => t.key).sort()).toEqual(DEMO_ISSUE_TYPES.map(([key]) => key).sort());
      expect((await db.metric_definitions.findMany()).map((m) => m.metric_key).sort()).toEqual(DEMO_METRICS.map(([key]) => key).sort());
      const metrics = new Map((await db.metric_definitions.findMany()).map((m) => [m.metric_id, m.metric_key]));
      const pairs = (await db.category_metrics.findMany()).map((c) => `${c.category}:${metrics.get(c.metric_id)}`).sort();
      expect(pairs).toEqual(DEMO_CATEGORY_METRICS.map(([category, key]) => `${category}:${key}`).sort());
    });

    it("writes nothing else: no projects, assets, history, remarks, tickets, user labs or log rows", async () => {
      const counts = {
        projects: await db.projects.count(),
        assets: await db.assets.count(),
        asset_loans: await db.asset_loans.count(),
        asset_maintenance: await db.asset_maintenance.count(),
        asset_retirements: await db.asset_retirements.count(),
        asset_inspections: await db.asset_inspections.count(),
        asset_inspection_metrics: await db.asset_inspection_metrics.count(),
        asset_remarks: await db.asset_remarks.count(),
        user_tickets: await db.user_tickets.count(),
        user_centers: await db.user_centers.count(),
        activity_log: await db.activity_log.count(),
      };

      expect(Object.values(counts).every((n) => n === 0), JSON.stringify(counts)).toBe(true);
    });

    it("prints the Done line and the next step, and neither the password, a hash, nor the email", () => {
      expect(output).toContain("[seed] Done (base): 5 roles, 10 labs, 20 categories, 1 IT Admin account. No demo data.");
      expect(output).toContain("[seed] Log in with SEED_ADMIN_EMAIL and SEED_PASSWORD, then change the password in Account Details.");
      expect(output).not.toContain(BASE_PASSWORD);
      expect(output).not.toContain("scrypt$");
      expect(output.toLowerCase()).not.toContain(STORED_EMAIL);
      expect(output).not.toContain(TYPED_EMAIL.trim());
    });
  });

  describe("refusals", () => {
    beforeEach(async () => {
      await resetDatabase(db, config);
    }, 120_000);

    /** Each setting that must stop the seed before it connects, with the part of the message that names the cause. */
    const refusals: [string, Record<string, string>, string][] = [
      ["no SEED_ADMIN_EMAIL", { ...baseEnv, SEED_ADMIN_EMAIL: "" }, "SEED_ADMIN_EMAIL is not set"],
      ["an email outside @dlsu.edu.ph", { ...baseEnv, SEED_ADMIN_EMAIL: "made.up.admin@example.com" }, "must be a @dlsu.edu.ph address"],
      ["an email with nothing before the domain", { ...baseEnv, SEED_ADMIN_EMAIL: "@dlsu.edu.ph" }, "must be a @dlsu.edu.ph address"],
      ["no SEED_PASSWORD", { ...baseEnv, SEED_PASSWORD: "" }, "SEED_PASSWORD is not set"],
      ["a password shorter than 8 characters", { ...baseEnv, SEED_PASSWORD: "short" }, "at least 8 characters"],
      ["a password longer than the app accepts", { ...baseEnv, SEED_PASSWORD: "a".repeat(MAX_PASSWORD_LENGTH + 1) }, `at most ${MAX_PASSWORD_LENGTH} characters`],
      ["SEED_MODE=wrong", { ...baseEnv, SEED_MODE: "wrong" }, "SEED_MODE must be demo or base"],
      ["an empty SEED_MODE", { ...baseEnv, SEED_MODE: "" }, "SEED_MODE must be demo or base"],
      ["SEED_MODE=demo without the demo password (the demo seed's own check)", { SEED_MODE: "demo" }, "every demo account gets it"],
    ];

    it.each(refusals)("refuses %s and writes nothing", async (_name, env, message) => {
      const { status, output } = runSeed(env);

      expect(status).toBe(1);
      expect(output).toContain("Seed refused");
      expect(output).toContain(message);
      expect(output).not.toContain(BASE_PASSWORD);
      expect(output.toLowerCase()).not.toContain(STORED_EMAIL);
      const counts = await rowCounts();
      expect(Object.values(counts).every((n) => n === 0), JSON.stringify(counts)).toBe(true);
    });

    it("refuses a database that already has users (the base seed run twice), and keeps the first run's rows", async () => {
      const first = runSeed(baseEnv);
      expect(first.status, first.output).toBe(0);

      const second = runSeed(baseEnv);

      expect(second.status).toBe(1);
      expect(second.output).toContain("already has rows");
      expect(second.output).not.toContain(BASE_PASSWORD);
      expect(await rowCounts()).toMatchObject({ users: 1, user_roles: 1, roles: 5, research_centers: 10, asset_categories: 20 });
    });
  });
});
