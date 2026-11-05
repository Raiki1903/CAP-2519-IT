/**
 * Foundation rules (Batch 1): the lifecycle guard table, the status setter inside a transaction, the derive helpers,
 * and the database checks the foundation migration added.
 * Covers server/shared/services/lifecycleGuard.ts, assetStatus.ts, and assetState.ts, called directly with the test
 * database's client, and the CHECK and unique constraints of asset_inspections, asset_inspection_metrics,
 * user_centers, and user_roles.
 * Fixtures: the seeded assets, loans, and accounts. Extra assets TEST-0951 onward; every write is undone or removed.
 */
import { describe, expect, it } from "vitest";
import { ALLOWED_ACTIONS, LIFECYCLE_ACTIONS, isActionAllowed, refusalFor, type LifecycleAction } from "../../server/shared/services/lifecycleGuard";
import { setAssetStatus } from "../../server/shared/services/assetStatus";
import { isCleared, stateOf, unclearedLoansOf } from "../../server/shared/services/assetState";
import { addExtraAsset, removeExtraAssets } from "../setup/extraAssets";
import { ASSETS, LAB, LOOKUPS, ROLE_IDS, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { db } = useApiHarness();

/** The guard table of docs/contracts/lifecycle.md, section 3: the actions each status allows, nothing else. */
const EXPECTED: Record<string, LifecycleAction[]> = {
  AVAILABLE: ["REQUEST_LOAN", "APPROVE_LOAN", "RELEASE_LOAN", "START_MAINTENANCE", "RECEIVE_FOR_MAINTENANCE", "REQUEST_RETIREMENT", "MARK_MISSING", "EDIT_MASTER_DATA", "ROUTINE_INSPECTION"],
  ON_LOAN: ["REQUEST_RETURN", "RECEIVE_RETURN", "START_MAINTENANCE", "RECEIVE_FOR_MAINTENANCE", "MARK_MISSING", "EDIT_MASTER_DATA"],
  MAINTENANCE: ["WORK_ON_MAINTENANCE", "REQUEST_RETIREMENT", "EDIT_MASTER_DATA"],
  PENDING_RETIREMENT: ["DECIDE_RETIREMENT", "COMPLETE_RETIREMENT"],
  RETIRED: [],
  MISSING: ["MARK_FOUND", "REQUEST_RETIREMENT", "EDIT_MASTER_DATA"],
};

describe("the lifecycle guard", () => {
  it.each(Object.keys(EXPECTED))("allows exactly the contract's actions for %s, and refuses every other one", (status) => {
    for (const action of LIFECYCLE_ACTIONS) {
      expect(isActionAllowed(status as keyof typeof ALLOWED_ACTIONS, action), `${status} ${action}`).toBe(EXPECTED[status].includes(action));
    }
  });

  it("covers the six statuses and the fifteen actions", () => {
    expect(Object.keys(ALLOWED_ACTIONS).sort()).toEqual(Object.keys(EXPECTED).sort());
    expect(LIFECYCLE_ACTIONS).toHaveLength(15);
  });

  it("refuses a second loan while a loan waits, and says which loan; a waiting loan blocks no retirement request or ticket (Batch 5, 3.7)", () => {
    const asset = { asset_tag: "TEST-0001", status: "AVAILABLE" as const };
    const waiting = { loanId: 7, status: "PENDING_RELEASE" as const };

    expect(refusalFor(asset, "REQUEST_LOAN", waiting)).toBe("TEST-0001 already has a loan in Pending Release (LOAN-7).");
    expect(refusalFor(asset, "REQUEST_RETIREMENT", waiting)).toBeNull();
    expect(refusalFor(asset, "START_MAINTENANCE", waiting)).toBeNull();
  });
});

describe("the status setter", () => {
  it("changes the status inside the caller's transaction, and a failure later in it leaves the status and the loan as they were", async () => {
    const loanBefore = await db.asset_loans.findUniqueOrThrow({ where: { loan_id: SEEDED_ROWS.approvedLoanId } });

    await expect(db.$transaction(async (tx) => {
      await setAssetStatus(tx, ASSETS.onLoan.assetId, "MISSING");
      await tx.asset_loans.update({ where: { loan_id: SEEDED_ROWS.approvedLoanId }, data: { status: "ENDED_BY_LOSS", closed_at: new Date() } });
      throw new Error("Test: forced failure after the writes");
    })).rejects.toThrow("Test: forced failure");

    expect((await db.assets.findUniqueOrThrow({ where: { asset_id: ASSETS.onLoan.assetId } })).status).toBe("ON_LOAN");
    expect(await db.asset_loans.findUniqueOrThrow({ where: { loan_id: SEEDED_ROWS.approvedLoanId } })).toEqual(loanBefore);
  });

  it("is the only writer: a committed transaction changes the status", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0951" });
    try {
      await db.$transaction(async (tx) => setAssetStatus(tx, asset.assetId, "MISSING"));

      expect((await db.assets.findUniqueOrThrow({ where: { asset_id: asset.assetId } })).status).toBe("MISSING");
    } finally {
      await removeExtraAssets(db, [asset.assetId]);
    }
  });
});

describe("the derive helpers", () => {
  const withLab = (assetId: number) => db.assets.findUniqueOrThrow({ where: { asset_id: assetId }, include: { research_centers: true } });

  it("works out holder and location at home, on loan, in maintenance, and missing", async () => {
    const missing = await addExtraAsset(db, { tag: "TEST-0952", assetStatus: "MISSING" });
    try {
      const home = await stateOf(db, await withLab(ASSETS.available.assetId));
      const onLoan = await stateOf(db, await withLab(ASSETS.onLoan.assetId));
      const inRepair = await stateOf(db, await withLab(ASSETS.inRepair.assetId));
      const lost = await stateOf(db, await withLab(missing.assetId));

      expect([home.holder, home.currentLocation]).toEqual([null, LAB.shortCode]);
      expect([onLoan.holder, onLoan.currentLocation]).toEqual([{ userId: USERS.custodianA.userId, name: USERS.custodianA.fullName }, LAB.shortCode]);
      expect([inRepair.holder, inRepair.currentLocation]).toEqual([null, "TSG Office"]);
      expect([lost.holder, lost.currentLocation]).toEqual([null, null]);
    } finally {
      await removeExtraAssets(db, [missing.assetId]);
    }
  });

  it("clears a person only when no loan of theirs is Pending Release, On Loan, or Return Requested", async () => {
    // Custodian A holds the seeded loan; Custodian B has only a loan waiting for approval.
    expect(await isCleared(db, USERS.custodianA.userId)).toBe(false);
    expect((await unclearedLoansOf(db, USERS.custodianA.userId)).map(l => l.loan_id)).toEqual([SEEDED_ROWS.approvedLoanId]);
    expect(await isCleared(db, USERS.custodianB.userId)).toBe(true);

    await db.asset_loans.update({ where: { loan_id: SEEDED_ROWS.pendingLoanId }, data: { status: "PENDING_RELEASE" } });
    try {
      expect(await isCleared(db, USERS.custodianB.userId)).toBe(false);
    } finally {
      await db.asset_loans.update({ where: { loan_id: SEEDED_ROWS.pendingLoanId }, data: { status: "PENDING_APPROVAL" } });
    }
  });
});

describe("the database checks", () => {
  it("refuses a health score of 101, and takes 0 and 100", async () => {
    const row = (score: number) => ({ asset_id: ASSETS.available.assetId, inspected_by_id: USERS.staffTsg.userId, type: "ROUTINE" as const, condition: "PERFECT" as const, health_score: score });

    await expect(db.asset_inspections.create({ data: row(101) })).rejects.toThrow();
    const ok = await Promise.all([db.asset_inspections.create({ data: row(0) }), db.asset_inspections.create({ data: row(100) })]);
    await db.asset_inspections.deleteMany({ where: { inspection_id: { in: ok.map(r => r.inspection_id) } } });
  });

  it("takes one value per inspection and metric", async () => {
    const metric = LOOKUPS.metrics[0].metricId;
    await db.asset_inspection_metrics.create({ data: { inspection_id: SEEDED_ROWS.reportId, metric_id: metric, value: 55 } });
    try {
      await expect(db.asset_inspection_metrics.create({ data: { inspection_id: SEEDED_ROWS.reportId, metric_id: metric, value: 56 } })).rejects.toThrow();
    } finally {
      await db.asset_inspection_metrics.deleteMany({ where: { inspection_id: SEEDED_ROWS.reportId } });
    }
  });

  it("takes each lab once per person and each role once per person", async () => {
    await expect(db.user_centers.create({ data: { user_id: USERS.custodianA.userId, center_id: LAB.centerId } })).rejects.toThrow();
    await expect(db.user_roles.create({ data: { user_id: USERS.custodianA.userId, role_id: ROLE_IDS.RESEARCHER } })).rejects.toThrow();
  });
});
