/**
 * Tests the demo seed by running it on the emptied test database: the passwords it writes (C-03, issue #10), and that
 * its history follows the lifecycle contract the way the app would have written it, with each insight rule firing on a
 * few assets (issue #176).
 * Covers prisma/seed.ts and the files it calls, run as a child process the way npm run seed runs it, without
 * SEED_PHOTOS_DIR (every asset gets its category picture). The insight rules are the pure ones in insights.rules.ts,
 * run on the seeded rows read with the test database's client.
 * Fixtures: a made-up demo password, and the accounts and assets in prisma/seedData.ts.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TSG_INSPECTION_TYPES } from "@shared/constants/inspectionTypes";
import { HELD_LOAN_STATUSES } from "@shared/constants/loanStatuses";
import { OPEN_MAINTENANCE_STATUSES } from "@shared/constants/maintenanceStatuses";
import type { AssetCategory } from "@shared/enums/assetCategory";
import { DEMO_ACCOUNTS } from "../../prisma/seedData";
import {
  conditionDropRule, lifecycleRule, overdueLoanRule, repeatRepairsRule, warrantyRule, type InsightHit, type RuleAsset,
} from "../../server/features/analytics/insights.rules";
import { serverToday } from "../../server/shared/services/assetState";
import { isPasswordHash, verifyPassword } from "../../server/shared/services/passwords";
import { createTestPrisma, resetDatabase } from "../setup/db";
import { loadTestDatabaseConfig, REPO_ROOT } from "../setup/testDatabase";

const DEMO_PASSWORD = "made-up-demo-password";

/** The three assets whose warranty the seed sets to end 10, 25 and 60 days after it runs. */
const WARRANTY_TARGETS = ["CeHCI-0003", "CIVI-0003", "TE3D-0008"];

describe("prisma/seed.ts", () => {
  const config = loadTestDatabaseConfig();
  const db = createTestPrisma(config);
  let output = "";

  beforeAll(async () => {
    await resetDatabase(db, config);
    const tsxLoader = pathToFileURL(createRequire(path.join(REPO_ROOT, "package.json")).resolve("tsx")).href;
    const result = spawnSync(process.execPath, ["--import", tsxLoader, path.join(REPO_ROOT, "prisma", "seed.ts")], {
      cwd: REPO_ROOT,
      env: { ...process.env, SEED_DATABASE_URL: config.url, SEED_PASSWORD: DEMO_PASSWORD, SEED_PHOTOS_DIR: "" },
      encoding: "utf-8",
    });
    output = `${result.stdout}${result.stderr}`;
    expect(result.status, `the seed failed:\n${output}`).toBe(0);
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

  it("writes about 28 accounts, 60 assets, 100 returned loans and the other history in range", async () => {
    expect(await db.users.count()).toBeGreaterThanOrEqual(26);
    expect(await db.users.count()).toBeLessThanOrEqual(32);
    expect(await db.assets.count()).toBeGreaterThanOrEqual(55);
    expect(await db.assets.count()).toBeLessThanOrEqual(62);
    expect(await db.asset_loans.count({ where: { status: "RETURNED" } })).toBeGreaterThanOrEqual(90);
    expect(await db.asset_loans.count({ where: { status: "RETURNED" } })).toBeLessThanOrEqual(110);
    expect(await db.asset_maintenance.count()).toBeGreaterThanOrEqual(10);
    expect(await db.asset_maintenance.count()).toBeLessThanOrEqual(15);
    expect(await db.asset_retirements.count()).toBe(4);
    expect(await db.projects.count()).toBeGreaterThanOrEqual(6);
    expect(await db.asset_remarks.count()).toBeGreaterThanOrEqual(8);
    expect(await db.user_tickets.count()).toBeGreaterThanOrEqual(8);
    expect(await db.research_centers.count({ where: { head_user_id: null } })).toBe(0);
  });

  it("has every asset status, and the open row behind each status that needs one", async () => {
    const assets = await db.assets.findMany({
      select: {
        asset_tag: true, status: true,
        asset_loans: { select: { status: true } },
        asset_maintenance: { select: { status: true } },
        asset_retirements: { select: { status: true } },
      },
    });
    expect(new Set(assets.map((a) => a.status))).toEqual(new Set(["AVAILABLE", "ON_LOAN", "MAINTENANCE", "PENDING_RETIREMENT", "RETIRED", "MISSING"]));
    for (const a of assets) {
      const held = a.asset_loans.filter((l) => HELD_LOAN_STATUSES.includes(l.status)).length;
      const openTickets = a.asset_maintenance.filter((t) => OPEN_MAINTENANCE_STATUSES.includes(t.status)).length;
      const pending = a.asset_retirements.filter((r) => r.status === "PENDING").length;
      expect(held, `${a.asset_tag} held loans`).toBe(a.status === "ON_LOAN" ? 1 : 0);
      if (a.status === "MAINTENANCE") expect(openTickets, `${a.asset_tag} open tickets`).toBe(1);
      expect(pending, `${a.asset_tag} pending retirements`).toBe(a.status === "PENDING_RETIREMENT" ? 1 : 0);
      if (a.status === "RETIRED") expect(a.asset_retirements.filter((r) => r.status === "COMPLETED"), a.asset_tag).toHaveLength(1);
    }
  });

  it("never overlaps two loans of one asset, and gives every released loan its two inspections and its TSG accounts", async () => {
    const loans = await db.asset_loans.findMany({
      orderBy: [{ asset_id: "asc" }, { requested_at: "asc" }],
      include: { release_inspection: true, return_inspection: true, released_by: { select: { user_roles: { select: { roles: true } } } } },
    });
    for (let i = 1; i < loans.length; i++) {
      const [before, after] = [loans[i - 1], loans[i]];
      if (before.asset_id !== after.asset_id) continue;
      expect(before.closed_at, `loan ${before.loan_id} is still open before loan ${after.loan_id}`).not.toBeNull();
      expect(before.closed_at!.getTime(), `loans ${before.loan_id} and ${after.loan_id}`).toBeLessThan(after.requested_at.getTime());
    }
    for (const loan of loans.filter((l) => l.released_at)) {
      expect(loan.release_inspection?.type, `loan ${loan.loan_id}`).toBe("LOAN_RELEASE");
      expect(loan.released_by?.user_roles[0].roles.role_name).toBe("TSG_STAFF");
      if (loan.status === "RETURNED") {
        expect(loan.return_inspection?.type, `loan ${loan.loan_id}`).toBe("RETURN");
        expect(loan.closed_at).not.toBeNull();
      }
    }
    const final = loans.filter((l) => ["DECLINED", "CANCELLED", "RETURNED", "ENDED_BY_MAINTENANCE", "ENDED_BY_LOSS"].includes(l.status));
    expect(final.every((l) => l.closed_at !== null)).toBe(true);
  });

  it("has every loan decided by the Head of the asset's home lab at that time, and no Head borrowing", async () => {
    const labs = await db.research_centers.findMany({ select: { center_id: true, short_code: true, head_user_id: true } });
    const headChanges = await db.activity_log.findMany({ where: { event_type: "HEAD_CHANGED" }, orderBy: { created_at: "asc" } });
    const headAt = (code: string, at: Date) =>
      headChanges.filter((h) => h.details?.startsWith(`${code}:`) && h.created_at <= at).at(-1)?.target_user_id ?? null;
    const loans = await db.asset_loans.findMany({ include: { assets: { select: { center_id: true } } } });
    const heads = new Set(labs.map((l) => l.head_user_id));

    for (const loan of loans) {
      expect(heads.has(loan.borrower_id), `loan ${loan.loan_id} borrower heads a lab`).toBe(false);
      if (!loan.decided_at) continue;
      const code = labs.find((l) => l.center_id === loan.assets.center_id)!.short_code;
      expect(loan.decided_by_id, `loan ${loan.loan_id}`).toBe(headAt(code, loan.decided_at));
    }
  });

  it("sends every loan to one of the borrower's labs", async () => {
    const loans = await db.asset_loans.findMany({
      include: { users: { select: { anonymized_at: true, user_centers: { select: { center_id: true } } } } },
    });
    // An anonymized account's labs are removed, so its old loans cannot be checked against them.
    for (const loan of loans.filter((l) => l.users.anonymized_at === null)) {
      expect(loan.users.user_centers.map((c) => c.center_id), `loan ${loan.loan_id}`).toContain(loan.destination_center_id);
    }
  });

  it("uses demo emails only, and writes the anonymized account as anonymizeUser leaves it", async () => {
    const users = await db.users.findMany({ include: { user_centers: true } });
    for (const user of users) {
      if (user.anonymized_at) {
        expect(user).toMatchObject({ first_name: "Former", last_name: "researcher", email: `anonymized-${user.user_id}@invalid`, id_number: null, user_img: null, account_status: "INACTIVE" });
        expect(user.user_centers).toHaveLength(0);
      } else {
        expect(user.email.startsWith("demo."), user.email).toBe(true);
      }
      const decided = user.account_status !== "PENDING" && user.user_id !== 1;
      expect(user.status_decided_by_id, user.email).toBe(decided ? 1 : null);
    }
  });

  it("closes support tickets the way the IT Admin does, with one log row per status change", async () => {
    const tickets = await db.user_tickets.findMany();
    expect(new Set(tickets.map((t) => t.status))).toEqual(new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"]));
    expect(new Set(tickets.map((t) => t.type))).toEqual(new Set(["BUG", "ACCOUNT_ACCESS", "QUESTION", "OTHER"]));
    for (const t of tickets) {
      const closed = t.status === "RESOLVED" || t.status === "REJECTED";
      expect(t.resolved_by_id, `ticket ${t.ticket_id}`).toBe(closed ? 1 : null);
      expect(t.resolution_remarks !== null, `ticket ${t.ticket_id}`).toBe(closed);
      const rows = await db.activity_log.findMany({ where: { event_type: "TICKET_STATUS_CHANGED", details: { startsWith: `#${t.ticket_id} ` } } });
      expect(rows.every((r) => r.actor_id === 1 && r.target_user_id === t.created_by_id)).toBe(true);
      expect(rows.length > 0, `ticket ${t.ticket_id}`).toBe(t.status !== "OPEN");
    }
  });

  it("never has a retirement decided by its requester, and nothing happens to an asset after it is retired", async () => {
    const retirements = await db.asset_retirements.findMany();
    for (const r of retirements) {
      if (r.decided_by_id !== null) expect(r.decided_by_id).not.toBe(r.requested_by_id);
      if (r.status !== "COMPLETED") continue;
      expect(r.pathway).not.toBeNull();
      expect(r.disposition_reference).toMatch(/^DEMO-DISP-\d{4}$/);
      const later = { asset_id: r.asset_id };
      expect(await db.asset_loans.count({ where: { ...later, requested_at: { gt: r.completed_at! } } })).toBe(0);
      expect(await db.asset_inspections.count({ where: { ...later, inspected_at: { gt: r.completed_at! } } })).toBe(0);
      expect(await db.asset_maintenance.count({ where: { ...later, reported_at: { gt: r.completed_at! } } })).toBe(0);
    }
  });

  it("fires WAR-01 on its three targets, and each other insight rule on 1 to 4 assets", async () => {
    const asOf = serverToday();
    const assets = await db.assets.findMany({
      where: { status: { not: "RETIRED" } },
      include: {
        research_centers: { select: { short_code: true } },
        asset_loans: { where: { status: { in: [...HELD_LOAN_STATUSES] } } },
        asset_maintenance: { where: { status: { not: "CANCELLED" } } },
        asset_inspections: { where: { type: { in: [...TSG_INSPECTION_TYPES] } }, orderBy: [{ inspected_at: "desc" }, { inspection_id: "desc" }] },
      },
    });
    const hits: Record<string, string[]> = { "WAR-01": [], "LOAN-02": [], "REP-03": [], "LIFE-04": [], "COND-05": [] };
    const add = (hit: InsightHit | null) => hit && hits[hit.ruleId].push(hit.asset.tag);

    for (const a of assets) {
      const asset: RuleAsset = {
        assetId: a.asset_id, tag: a.asset_tag, name: a.name, category: a.category as AssetCategory, status: a.status,
        labCode: a.research_centers.short_code, procurementDate: a.procurement_date, warrantyExpiry: a.warranty_expiry,
      };
      add(warrantyRule(asset, asOf));
      for (const l of a.asset_loans) add(overdueLoanRule(asset, { loanId: l.loan_id, status: l.status, returnBy: l.return_by, borrowerName: "" }, asOf));
      const inspections = a.asset_inspections.map((i) => ({ inspectionId: i.inspection_id, type: i.type, condition: i.condition, inspectedAt: i.inspected_at }));
      add(repeatRepairsRule(asset, a.asset_maintenance.map((t) => ({ maintenanceId: t.maintenance_id, status: t.status, reportedAt: t.reported_at })), inspections[0]?.condition ?? null, asOf));
      add(lifecycleRule(asset, asOf));
      add(conditionDropRule(asset, inspections));
    }

    // WAR-01 is not capped: the fixed warranties of 2024 purchases start ending within 90 days in mid-2027.
    expect(hits["WAR-01"]).toEqual(expect.arrayContaining(WARRANTY_TARGETS));
    for (const rule of ["LOAN-02", "REP-03", "LIFE-04", "COND-05"]) {
      expect(hits[rule].length, `${rule}: ${hits[rule].join(", ")}`).toBeGreaterThanOrEqual(1);
      expect(hits[rule].length, `${rule}: ${hits[rule].join(", ")}`).toBeLessThanOrEqual(4);
    }
  });
});
