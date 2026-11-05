/**
 * Missing and Found: TSG marks an asset missing, with a reason, and found again, with a Recovery inspection.
 * Covers PUT /api/assets/:tag/missing and PUT /api/assets/:tag/found.
 * Workflow: Missing and Found (a held loan ends by loss and a ticket still waiting for receipt is cancelled; a found
 * asset is Available again at home, and its old loan stays closed). Each step writes one activity row.
 * Fixtures: the seeded accounts and LAB, headed by the Lab Head; the Retired TEST-0004. Every write test uses its own
 * extra asset (TEST-0701 onward, see extraAssets.ts).
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, LOOKUPS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { db, as } = useApiHarness();
const asStaff = as(USERS.staffTsg);

const assetStatus = async (assetId: number) => (await db.assets.findUniqueOrThrow({ where: { asset_id: assetId } })).status;
const loanRow = (loanId: number) => db.asset_loans.findUniqueOrThrow({ where: { loan_id: loanId } });
const activityOf = (assetId: number) => db.activity_log.findMany({ where: { asset_id: assetId }, orderBy: { log_id: 'asc' } });

/** A Missing asset that was On Loan to Custodian A, marked missing through the API. */
async function missingAsset(tag: string) {
  const asset = await addExtraAsset(db, { tag, status: "ON_LOAN", custodianId: USERS.custodianA.userId });
  expect((await asStaff.put(`/api/assets/${tag}/missing`, { reason: "Test: not in the lab" })).status).toBe(200);
  return asset;
}

describe("PUT /api/assets/:tag/missing", () => {
  it("ends the held loan by loss, sets Missing with no holder and no location, and writes one activity row with the reason", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0701", status: "ON_LOAN", custodianId: USERS.custodianA.userId });

    const res = await asStaff.put(`/api/assets/${asset.tag}/missing`, { reason: "Test: not returned after the event" });

    expect(res.status).toBe(200);
    expect(res.body.asset).toMatchObject({ tag: asset.tag, status: "MISSING", statusLabel: "Missing", holder: null, currentLocation: null, openLoan: null });
    const loan = await loanRow(asset.loanId!);
    expect(loan.status).toBe("ENDED_BY_LOSS");
    expect(loan.closed_at).not.toBeNull();
    const rows = await activityOf(asset.assetId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event_type: "ASSET_MARKED_MISSING", actor_id: USERS.staffTsg.userId, details: "Test: not returned after the event", target_user_id: null });
  });

  it("cancels a ticket still waiting for receipt, with the remarks 'Asset marked missing.'", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0702", status: "ON_LOAN", custodianId: USERS.custodianA.userId });
    const filed = await as(USERS.custodianA).post(`/api/assets/${asset.tag}/maintenance`, { issueTypeId: LOOKUPS.issueTypes[0].issueTypeId, issueDescription: "Test: cracked" });

    expect((await asStaff.put(`/api/assets/${asset.tag}/missing`, { reason: "Test: lost" })).status).toBe(200);

    expect(await db.asset_maintenance.findUniqueOrThrow({ where: { maintenance_id: filed.body.maintenance.maintenanceId } })).toMatchObject({
      status: "CANCELLED",
      resolution_remarks: "Asset marked missing.",
      completed_by_id: USERS.staffTsg.userId,
    });
  });

  it("leaves a loan waiting for approval as it is; its approval is then refused (section 3.7)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0703" });
    const waiting = await db.asset_loans.create({
      data: { asset_id: asset.assetId, borrower_id: USERS.custodianB.userId, purpose: "Test purpose: waiting", return_by: new Date(Date.now() + 14 * 86400000), status: "PENDING_APPROVAL", destination_center_id: LAB.centerId },
    });

    expect((await asStaff.put(`/api/assets/${asset.tag}/missing`, { reason: "Test: lost" })).status).toBe(200);

    expect((await loanRow(waiting.loan_id)).status).toBe("PENDING_APPROVAL");
    const approve = await as(USERS.labHead).put(`/api/loans/${waiting.loan_id}/approve`, {});
    expect(approve.status).toBe(409);
    expect(approve.body.error).toBe(`${asset.tag} is Missing and cannot have a loan approved.`);
  });

  it.each([
    { body: {}, error: "Write why the asset is missing.", case: "no reason" },
    { body: { reason: "x".repeat(256) }, error: "reason can be at most 255 characters.", case: "a reason over 255 characters" },
  ])("answers 400 for $case, and changes nothing", async ({ body, error }) => {
    const res = await asStaff.put(`/api/assets/${ASSETS.available.tag}/missing`, body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
    expect(await assetStatus(ASSETS.available.assetId)).toBe("AVAILABLE");
  });

  it.each([
    { tag: ASSETS.disposed.tag, label: "Retired" },
    { tag: ASSETS.inRepair.tag, label: "Maintenance" },
  ])("answers 409 for an asset that is $label (the lifecycle guard), and writes no activity row", async ({ tag, label }) => {
    const before = await db.activity_log.count();

    const res = await asStaff.put(`/api/assets/${tag}/missing`, { reason: "Test" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`${tag} is ${label} and cannot be marked missing.`);
    expect(await db.activity_log.count()).toBe(before);
  });

  it("answers 404 for an unknown tag", async () => {
    expect((await asStaff.put("/api/assets/TEST-9999/missing", { reason: "Test" })).status).toBe(404);
  });
});

describe("PUT /api/assets/:tag/found", () => {
  it("files a Recovery inspection, makes the asset Available at home, keeps the old loan closed, and writes one activity row", async () => {
    const asset = await missingAsset("TEST-0721");

    const res = await asStaff.put(`/api/assets/${asset.tag}/found`, { inspection: { condition: "MINOR_DRIFT", remarks: "Test: scratched" }, remarks: "Test: found in the stock room" });

    expect(res.status).toBe(200);
    expect(res.body.asset).toMatchObject({ status: "AVAILABLE", holder: null, currentLocation: LAB.shortCode, condition: "MINOR_DRIFT" });
    const [inspection] = await db.asset_inspections.findMany({ where: { asset_id: asset.assetId } });
    expect(inspection).toMatchObject({ type: "RECOVERY", inspected_by_id: USERS.staffTsg.userId, condition: "MINOR_DRIFT" });
    expect((await loanRow(asset.loanId!)).status).toBe("ENDED_BY_LOSS");
    expect((await activityOf(asset.assetId)).map(r => [r.event_type, r.details])).toEqual([
      ["ASSET_MARKED_MISSING", "Test: not in the lab"],
      ["ASSET_FOUND", "Test: found in the stock room"],
    ]);
  });

  it("answers 400 without an inspection, and leaves the asset Missing", async () => {
    const asset = await missingAsset("TEST-0722");

    const res = await asStaff.put(`/api/assets/${asset.tag}/found`, { remarks: "Test" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing required field: inspection.");
    expect(await assetStatus(asset.assetId)).toBe("MISSING");
  });

  it("answers 409 for an asset that is not Missing", async () => {
    const res = await asStaff.put(`/api/assets/${ASSETS.available.tag}/found`, { inspection: { condition: "PERFECT" } });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`${ASSETS.available.tag} is Available and cannot be marked found.`);
  });

  it("shows both steps in the asset's history", async () => {
    const asset = await missingAsset("TEST-0723");
    await asStaff.put(`/api/assets/${asset.tag}/found`, { inspection: { condition: "OPERATIONAL" } });

    const res = await asStaff.get(`/api/assets/${asset.tag}/history`);

    const kinds = res.body.events.map((e: { kind: string }) => e.kind);
    expect(kinds).toContain("ASSET_MARKED_MISSING");
    expect(kinds).toContain("ASSET_FOUND");
    expect(kinds.filter((k: string) => k === "LOAN_CLOSED")).toHaveLength(1);
  });
});
