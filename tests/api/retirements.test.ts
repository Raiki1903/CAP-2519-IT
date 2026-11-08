/**
 * Disposals API: the request, the decision by someone other than the requester, TSG's completion, the list, and the
 * printable record of one disposal.
 * Covers POST /api/assets/:tag/retirement, GET /api/retirements, GET /api/retirements/:id, PUT /api/retirements/:id/decision
 * and /complete.
 * Workflow: disposal (TSG requests it and the asset goes to Pending Retirement; the Director or the Secretary approves
 * it, or denies it and the asset gets its status back; TSG completes an approved disposal and the asset is Retired).
 * Fixtures: the seeded completed disposal RET-1 (requested by Staff TSG, decided by the Director) on TEST-0004; the
 * accounts (USERS). The list tests run first. The write tests use their own extra assets (TEST-0601 onward, see
 * extraAssets.ts) and change no seeded row.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, LOOKUPS, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";
import { USEFUL_LIFE_YEARS, presentValue } from "../../shared/constants/usefulLife";

const { db, as } = useApiHarness();
const asDirector = as(USERS.director);
const asSecretary = as(USERS.secretary);
const asStaff = as(USERS.staffTsg);

const NOT_BEYOND_REPAIR = "Finish the maintenance ticket first. Only an asset found beyond repair can be retired from Maintenance.";

const assetStatus = async (assetId: number) => (await db.assets.findUniqueOrThrow({ where: { asset_id: assetId } })).status;
const retirementRow = (retirementId: number) => db.asset_retirements.findUniqueOrThrow({ where: { retirement_id: retirementId } });

/** Files a disposal request as TSG and answers its id. */
async function requestDisposal(tag: string, extra: Record<string, unknown> = {}): Promise<number> {
  const res = await asStaff.post(`/api/assets/${tag}/retirement`, { reason: `Test: ${tag} is worn out`, ...extra });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.retirement.retirementId;
}

/** An asset whose ticket TSG completed Beyond Repair: in Maintenance, ready for a disposal request. */
async function beyondRepair(tag: string) {
  const asset = await addExtraAsset(db, { tag });
  const filed = await asStaff.post(`/api/assets/${tag}/maintenance`, { issueTypeId: LOOKUPS.issueTypes[0].issueTypeId, issueDescription: "Test: board burnt" });
  const maintenanceId = filed.body.maintenance.maintenanceId;
  await asStaff.put(`/api/maintenance/${maintenanceId}/receive`, { inspection: { condition: "CRITICAL_DEFECT" } });
  const done = await asStaff.put(`/api/maintenance/${maintenanceId}/complete`, { outcome: "BEYOND_REPAIR", resolutionRemarks: "Test: no parts", inspection: { condition: "CRITICAL_DEFECT" } });
  expect(done.status).toBe(200);
  return asset;
}

async function listedAsset(tag: string) {
  const res = await asStaff.get("/api/assets");
  return res.body.assets.find((a: { tag: string }) => a.tag === tag);
}

describe("GET /api/retirements", () => {
  it("lists the seeded disposal in the Retirement shape", async () => {
    const res = await asDirector.get("/api/retirements");

    expect(res.status).toBe(200);
    expect(res.body.retirements).toHaveLength(1);
    expect(res.body.retirements[0]).toMatchObject({
      retirementId: SEEDED_ROWS.disposalId,
      asset: { assetId: ASSETS.disposed.assetId, tag: ASSETS.disposed.tag, name: ASSETS.disposed.name },
      status: "COMPLETED",
      statusLabel: "Completed",
      reason: "Test breakdown: the board is burnt",
      pathway: "RECYCLE",
      pathwayLabel: "Recycle",
      previousStatus: "AVAILABLE",
      previousStatusLabel: "Available",
      requestedBy: { userId: USERS.staffTsg.userId, name: USERS.staffTsg.fullName },
      decidedBy: { userId: USERS.director.userId },
      completedBy: { userId: USERS.staffTsg.userId },
      dispositionReference: "TEST-REF-0001",
      assessmentInspection: null,
    });
    expect(res.body).not.toHaveProperty("disposals");
  });

  it("shows a Lab Head only its lab's disposals, and filters by ?status= (400 for an unknown status)", async () => {
    const lab = await db.research_centers.create({ data: { name: "Test Lab RETLAB", short_code: "RETLAB", location: "MANILA" } });
    const asset = await addExtraAsset(db, { tag: "RETLAB-0001", centerId: lab.center_id });
    const otherId = await requestDisposal(asset.tag);

    const head = await as(USERS.labHead).get("/api/retirements");
    expect(head.body.retirements.map((r: { retirementId: number }) => r.retirementId)).toEqual([SEEDED_ROWS.disposalId]);
    expect((await asStaff.get("/api/retirements")).body.retirements.map((r: { retirementId: number }) => r.retirementId)).toContain(otherId);

    const pending = await asStaff.get("/api/retirements?status=PENDING");
    expect(pending.body.retirements.map((r: { retirementId: number }) => r.retirementId)).toEqual([otherId]);
    const unknown = await asStaff.get("/api/retirements?status=REJECTED");
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe("Unknown retirement status: REJECTED.");
  });
});

describe("GET /api/retirements/:retirementId", () => {
  it("answers the disposal record for TSG, the Director, the Secretary, and the asset's own Lab Head", async () => {
    for (const caller of [asStaff, asDirector, asSecretary, as(USERS.labHead)]) {
      const res = await caller.get(`/api/retirements/${SEEDED_ROWS.disposalId}`);

      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.retirement).toMatchObject({ retirementId: SEEDED_ROWS.disposalId, status: "COMPLETED" });
      expect(res.body.asset).toMatchObject({
        tag: ASSETS.disposed.tag,
        name: ASSETS.disposed.name,
        serialNumber: `TEST-SN-${ASSETS.disposed.assetId}`,
        manufacturer: "Test Manufacturer",
        category: "ROUTER",
        categoryLabel: "Router",
        procurementDate: "2025-06-01",
        acquisitionValue: ASSETS.disposed.acquisitionValue,
        homeLab: { code: LAB.shortCode, name: LAB.name },
        homeRoom: null,
        itsPropertyTag: null,
        tsgTag: null,
      });
      expect(res.body.presentValueAtCompletion).toBe(presentValue(ASSETS.disposed.acquisitionValue, "2025-06-01", USEFUL_LIFE_YEARS.ROUTER, "2026-03-10"));
    }
  });

  it("is null for a disposal that is not Completed yet", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0611" });
    const id = await requestDisposal(asset.tag);

    const res = await asStaff.get(`/api/retirements/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.retirement.status).toBe("PENDING");
    expect(res.body.presentValueAtCompletion).toBeNull();
  });

  it("answers 403 for the Head of another lab, and 200 for their own", async () => {
    const lab = await db.research_centers.create({ data: { name: "Test Lab RETLAB2", short_code: "RETLAB2", location: "MANILA" } });
    const asset = await addExtraAsset(db, { tag: "RETLAB2-0001", centerId: lab.center_id });
    const id = await requestDisposal(asset.tag);

    const otherLab = await as(USERS.labHead).get(`/api/retirements/${id}`);
    expect(otherLab.status).toBe(403);
    expect(otherLab.body.error).toBe("This asset belongs to another lab. Only that lab's Head can see its retirement record.");

    const ownLab = await as(USERS.labHead).get(`/api/retirements/${SEEDED_ROWS.disposalId}`);
    expect(ownLab.status).toBe(200);
  });

  it("answers 400 for an id that is not a number, such as RET-1, and 404 for an unknown id", async () => {
    expect((await asStaff.get("/api/retirements/RET-1")).status).toBe(400);
    expect((await asStaff.get("/api/retirements/999999")).status).toBe(404);
  });
});

describe("POST /api/assets/:tag/retirement", () => {
  it("files a Pending request from Available: the reason, the pathway in its own column, the previous status, and the asset Pending Retirement", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0601" });

    const res = await asStaff.post(`/api/assets/${asset.tag}/retirement`, { reason: "Test: obsolete", pathway: "DONATE", requestedBy: USERS.director.fullName });

    expect(res.status).toBe(201);
    expect(res.body.retirement).toMatchObject({
      status: "PENDING",
      reason: "Test: obsolete",
      pathway: "DONATE",
      pathwayLabel: "Donate",
      previousStatus: "AVAILABLE",
      requestedBy: { userId: USERS.staffTsg.userId },
      decidedBy: null,
    });
    expect(await assetStatus(asset.assetId)).toBe("PENDING_RETIREMENT");
  });

  it("writes and links a Retirement inspection when TSG assessed the asset", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0602" });

    const res = await asStaff.post(`/api/assets/${asset.tag}/retirement`, { reason: "Test: cracked casing", assessmentInspection: { condition: "CRITICAL_DEFECT", remarks: "Test: casing split" } });

    expect(res.status).toBe(201);
    expect(res.body.retirement.assessmentInspection).toMatchObject({ type: "RETIREMENT", typeLabel: "Retirement", condition: "CRITICAL_DEFECT", inspectedBy: { userId: USERS.staffTsg.userId } });
    expect((await retirementRow(res.body.retirement.retirementId)).assessment_inspection_id).toBe(res.body.retirement.assessmentInspection.inspectionId);
  });

  it("takes a Missing asset, keeping Missing as the previous status", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0603", assetStatus: "MISSING" });

    const id = await requestDisposal(asset.tag);

    expect((await retirementRow(id)).previous_status).toBe("MISSING");
    expect(await assetStatus(asset.assetId)).toBe("PENDING_RETIREMENT");
  });

  it("takes an asset in Maintenance once its ticket ended Beyond Repair", async () => {
    const asset = await beyondRepair("TEST-0604");

    const id = await requestDisposal(asset.tag);

    expect((await retirementRow(id)).previous_status).toBe("MAINTENANCE");
  });

  it("answers 409 for an asset in Maintenance whose ticket is still open, and writes nothing", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0605" });
    const filed = await asStaff.post(`/api/assets/${asset.tag}/maintenance`, { issueTypeId: LOOKUPS.issueTypes[0].issueTypeId, issueDescription: "Test fault" });
    await asStaff.put(`/api/maintenance/${filed.body.maintenance.maintenanceId}/receive`, { inspection: { condition: "DEGRADED" } });

    const res = await asStaff.post(`/api/assets/${asset.tag}/retirement`, { reason: "Test: give up" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(NOT_BEYOND_REPAIR);
    expect(await db.asset_retirements.count({ where: { asset_id: asset.assetId } })).toBe(0);
    expect(await assetStatus(asset.assetId)).toBe("MAINTENANCE");
  });

  it("answers 409 for an asset On Loan (the guard), and for a second request while one is open", async () => {
    const onLoan = await addExtraAsset(db, { tag: "TEST-0606", status: "ON_LOAN", custodianId: USERS.custodianA.userId });
    const asset = await addExtraAsset(db, { tag: "TEST-0607" });
    const id = await requestDisposal(asset.tag);

    const loaned = await asStaff.post(`/api/assets/${onLoan.tag}/retirement`, { reason: "Test" });
    const second = await asStaff.post(`/api/assets/${asset.tag}/retirement`, { reason: "Test: again" });

    expect(loaned.status).toBe(409);
    expect(loaned.body.error).toBe(`${onLoan.tag} is On Loan and cannot be requested for retirement.`);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe(`${asset.tag} already has an open retirement request (RET-${id}).`);
    expect(await db.asset_retirements.count({ where: { asset_id: { in: [onLoan.assetId, asset.assetId] } } })).toBe(1);
  });

  it("takes an asset with a loan waiting for approval, and leaves that loan as it is (section 3.7)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0608" });
    const waiting = await db.asset_loans.create({
      data: { asset_id: asset.assetId, borrower_id: USERS.custodianB.userId, purpose: "Test purpose: waiting", return_by: new Date(Date.now() + 14 * 86400000), status: "PENDING_APPROVAL", destination_center_id: LAB.centerId },
    });

    await requestDisposal(asset.tag);

    expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: waiting.loan_id } })).status).toBe("PENDING_APPROVAL");
    const approve = await as(USERS.labHead).put(`/api/loans/${waiting.loan_id}/approve`, {});
    expect(approve.status).toBe(409);
    expect(approve.body.error).toBe(`${asset.tag} is Pending Retirement and cannot have a loan approved.`);
  });

  it.each([
    { body: {}, error: "Write the reason for the retirement.", case: "no reason" },
    { body: { reason: "Test", pathway: "Scrap" }, error: "Pick a pathway from the list.", case: "an unknown pathway" },
    { body: { reason: "Test", assessmentInspection: { condition: "BROKEN" } }, error: "Pick the condition of the assessmentInspection from the list.", case: "a wrong assessment" },
  ])("answers 400 for $case, and writes nothing", async ({ body, error }) => {
    const before = await db.asset_retirements.count();

    const res = await asStaff.post(`/api/assets/${ASSETS.available.tag}/retirement`, body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
    expect(await db.asset_retirements.count()).toBe(before);
  });

  it("answers 404 for an unknown tag", async () => {
    expect((await asStaff.post("/api/assets/TEST-9999/retirement", { reason: "Test" })).status).toBe(404);
  });
});

describe("PUT /api/retirements/:id/decision", () => {
  it("approve (Director): Approved, with who decided and the remarks; the asset stays Pending Retirement", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0621" });
    const id = await requestDisposal(asset.tag);

    const res = await asDirector.put(`/api/retirements/${id}/decision`, { decision: "approve", decisionRemarks: "Test: agreed" });

    expect(res.status).toBe(200);
    expect(res.body.retirement).toMatchObject({ status: "APPROVED", statusLabel: "Approved", decidedBy: { userId: USERS.director.userId }, decisionRemarks: "Test: agreed", completedBy: null });
    expect(await assetStatus(asset.assetId)).toBe("PENDING_RETIREMENT");
  });

  it("lets the Secretary approve too", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0622" });
    const id = await requestDisposal(asset.tag);

    const res = await asSecretary.put(`/api/retirements/${id}/decision`, { decision: "approve" });

    expect(res.status).toBe(200);
    expect(res.body.retirement.decidedBy.userId).toBe(USERS.secretary.userId);
  });

  it("deny needs remarks (400), then gives the asset back its status: Maintenance after Beyond Repair, Missing for a missing asset", async () => {
    const repaired = await beyondRepair("TEST-0623");
    const missing = await addExtraAsset(db, { tag: "TEST-0624", assetStatus: "MISSING" });
    const fromRepair = await requestDisposal(repaired.tag);
    const fromMissing = await requestDisposal(missing.tag);

    const noRemarks = await asSecretary.put(`/api/retirements/${fromRepair}/decision`, { decision: "deny" });
    expect(noRemarks.status).toBe(400);
    expect(noRemarks.body.error).toBe("Write the reason for denying.");

    expect((await asSecretary.put(`/api/retirements/${fromRepair}/decision`, { decision: "deny", decisionRemarks: "Test: try a new board" })).body.retirement).toMatchObject({ status: "DENIED", decisionRemarks: "Test: try a new board" });
    expect((await asDirector.put(`/api/retirements/${fromMissing}/decision`, { decision: "deny", decisionRemarks: "Test: keep looking" })).status).toBe(200);
    expect(await assetStatus(repaired.assetId)).toBe("MAINTENANCE");
    expect(await assetStatus(missing.assetId)).toBe("MISSING");
  });

  it("answers 400 for the old word 'reject'", async () => {
    const res = await asDirector.put(`/api/retirements/${SEEDED_ROWS.disposalId}/decision`, { decision: "reject" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("decision must be 'approve' or 'deny'.");
  });

  it("answers 409 to a disposal that is no longer Pending", async () => {
    const res = await asDirector.put(`/api/retirements/${SEEDED_ROWS.disposalId}/decision`, { decision: "approve" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`RET-${SEEDED_ROWS.disposalId} is Completed, so it can no longer be decided.`);
  });

  it("gives one winner when the Director approves and the Secretary denies at once", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0625" });
    const id = await requestDisposal(asset.tag);

    const [approve, deny] = await Promise.all([
      asDirector.put(`/api/retirements/${id}/decision`, { decision: "approve" }),
      asSecretary.put(`/api/retirements/${id}/decision`, { decision: "deny", decisionRemarks: "Test: no" }),
    ]);

    expect([approve.status, deny.status].sort()).toEqual([200, 409]);
    const row = await retirementRow(id);
    expect(await assetStatus(asset.assetId)).toBe(row.status === "APPROVED" ? "PENDING_RETIREMENT" : "AVAILABLE");
  });

  it("answers 400 for an id that is not a number, such as RET-1, and 404 for an unknown id", async () => {
    expect((await asDirector.put("/api/retirements/RET-1/decision", { decision: "approve" })).status).toBe(400);
    expect((await asDirector.put("/api/retirements/999999/decision", { decision: "approve" })).status).toBe(404);
  });
});

describe("PUT /api/retirements/:id/complete", () => {
  it("completes an Approved disposal with the pathway and the reference: Completed, and the asset Retired with no location", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0641" });
    const id = await requestDisposal(asset.tag);
    await asDirector.put(`/api/retirements/${id}/decision`, { decision: "approve" });

    const res = await asStaff.put(`/api/retirements/${id}/complete`, { pathway: "SELL", dispositionReference: "Test OR 12345" });

    expect(res.status).toBe(200);
    expect(res.body.retirement).toMatchObject({ status: "COMPLETED", pathway: "SELL", pathwayLabel: "Sell", dispositionReference: "Test OR 12345", completedBy: { userId: USERS.staffTsg.userId } });
    expect(await assetStatus(asset.assetId)).toBe("RETIRED");
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "RETIRED", currentLocation: null, disposalDetails: { disposalPathway: "Sell", breakdownReasons: `Test: ${asset.tag} is worn out` } });
  });

  it("answers 409 to a disposal that is not Approved", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0642" });
    const id = await requestDisposal(asset.tag);

    const res = await asStaff.put(`/api/retirements/${id}/complete`, { pathway: "RECYCLE", dispositionReference: "Test" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`RET-${id} is Pending, so it cannot be completed.`);
    expect(await assetStatus(asset.assetId)).toBe("PENDING_RETIREMENT");
  });

  it.each([
    { body: { dispositionReference: "Test" }, error: "Pick a pathway from the list.", case: "no pathway" },
    { body: { pathway: "RECYCLE" }, error: "Write the disposition reference.", case: "no reference" },
    { body: { pathway: "RECYCLE", dispositionReference: "x".repeat(256) }, error: "dispositionReference can be at most 255 characters.", case: "a reference over 255 characters" },
  ])("answers 400 for $case", async ({ body, error }) => {
    const res = await asStaff.put(`/api/retirements/${SEEDED_ROWS.disposalId}/complete`, body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
  });

  it("leaves a Retired asset nothing: no report, no loan, no second disposal", async () => {
    const tag = ASSETS.disposed.tag;

    const report = await asStaff.post(`/api/assets/${tag}/maintenance`, { issueTypeId: LOOKUPS.issueTypes[0].issueTypeId, issueDescription: "Test" });
    const loan = await as(USERS.custodianA).post(`/api/assets/${tag}/loans`, { destinationCenterId: LAB.centerId, returnBy: "2030-01-01", purpose: "Test" });
    const disposal = await asStaff.post(`/api/assets/${tag}/retirement`, { reason: "Test" });

    expect(report.status).toBe(409);
    expect(report.body.error).toBe(`${tag} is Retired and cannot take a maintenance ticket.`);
    expect(loan.status).toBe(409);
    expect(disposal.status).toBe(409);
    expect(disposal.body.error).toBe(`${tag} is Retired and cannot be requested for retirement.`);
  });
});
