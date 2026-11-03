/**
 * Repairs API: the repair request, the ticket list, and the two ticket update routes.
 * Covers POST /api/assets/:tag/maintenance, GET /api/maintenance, PUT /api/maintenance/:id, PUT /api/maintenance/:id/status.
 * Workflow: maintenance (a custodian or staff member reports a fault, TSG receives the asset and moves the ticket through
 * its statuses, and the asset goes into Maintenance and back to Available when it is fixed).
 * Fixtures: the seeded ticket MNT-1 ("Inspection Phase") on TEST-0003, which is in Maintenance at the TSG Office; the
 * accounts (USERS). The list tests run first and remove the rows they add. One update test completes MNT-1 and so takes
 * TEST-0003 out of maintenance; every other write test uses its own extra asset (TEST-0401 onward, see extraAssets.ts).
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { db, as } = useApiHarness();
const asCustodian = as(USERS.custodianA);
const asStaff = as(USERS.staffTsg);

/** What RepairForm sends: the reporter's typed name (not read since 13c: the reporter is the session user) and the fault. */
const repairBody = (description: string, extra: Record<string, unknown> = {}) => ({
  reportedBy: USERS.custodianB.fullName,
  description,
  ...extra,
});

const DEFAULT_COMPLETION_REMARKS = "Repair completed & verified fixed by technical staff.";

const reportCount = (assetId: number) => db.asset_inspections.count({ where: { asset_id: assetId } });

/** The status each progress text the screens send is stored as. */
const STATUS_OF: Record<string, string> = {
  "Pending TSG Review": "PENDING_RECEIPT",
  "Inspection Phase": "INSPECTING",
  "Warranty Holder Possession": "EXTERNAL_SERVICE",
  "Third-Party Repairer Possession": "EXTERNAL_SERVICE",
  "Fixed & Completed": "RESOLVED",
};

const ticketStatus = async (repairId: number) => (await db.asset_maintenance.findUniqueOrThrow({ where: { maintenance_id: repairId } })).status;

/**
 * Opens a ticket through the API, signed in as Custodian B (the reporter), and answers its id. The description
 * names the tag, so no two tests send the same tag and description and trip the 8-second duplicate guard. (M-07)
 */
async function openTicket(tag: string): Promise<number> {
  const res = await as(USERS.custodianB).post(`/api/assets/${tag}/maintenance`, repairBody(`Test fault on ${tag}`));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.repair.maintenance_id;
}

async function listedAsset(tag: string) {
  const res = await asStaff.get("/api/assets");
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

describe("GET /api/maintenance", () => {
  it("lists the seeded ticket with the fields the screens read", async () => {
    const res = await asStaff.get("/api/maintenance");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.repairs).toHaveLength(1);
    expect(res.body.repairs[0]).toMatchObject({
      id: `MNT-${SEEDED_ROWS.repairId}`,
      repairId: SEEDED_ROWS.repairId,
      assetId: ASSETS.inRepair.tag,
      assetName: ASSETS.inRepair.name,
      reportedBy: USERS.custodianA.fullName,
      custodian: USERS.custodianA.fullName,
      description: "Test repair: the lens does not focus",
      progressStatus: "Inspection Phase",
      statusLabel: "Inspection Phase",
      priority: "Medium",
      acknowledged: true,
    });
    expect(typeof res.body.repairs[0].submittedAt).toBe("string");
    expect(typeof res.body.repairs[0].createdAt).toBe("string");
  });

  it("lists tickets newest first, and marks a ticket not yet received as not acknowledged, with priority Medium", async () => {
    const pending = await db.asset_maintenance.create({
      data: {
        asset_id: ASSETS.inspected.assetId,
        reported_by_id: USERS.staffTsg.userId,
        issue_description: "Test fault: pending review",
        status: "PENDING_RECEIPT",
        reported_at: new Date("2026-06-01T09:00:00Z"),
      },
    });
    const immediate = await db.asset_maintenance.create({
      data: {
        asset_id: ASSETS.available.assetId,
        reported_by_id: USERS.labHead.userId,
        issue_description: "Test fault: immediate",
        status: "PENDING_RECEIPT",
        reported_at: new Date("2026-06-02T09:00:00Z"),
      },
    });
    try {
      const res = await asStaff.get("/api/maintenance");

      expect(res.body.repairs.map((r: { id: string }) => r.id)).toEqual([
        `MNT-${immediate.maintenance_id}`,
        `MNT-${pending.maintenance_id}`,
        `MNT-${SEEDED_ROWS.repairId}`,
      ]);
      expect(res.body.repairs[0]).toMatchObject({
        assetId: ASSETS.available.tag,
        reportedBy: USERS.labHead.fullName,
        priority: "Medium",
        acknowledged: false,
        progressStatus: "Pending TSG Review",
      });
      expect(res.body.repairs[0]).not.toHaveProperty("isImmediate");
      expect(res.body.repairs[1]).toMatchObject({ priority: "Medium", acknowledged: false });
    } finally {
      await db.asset_maintenance.deleteMany({ where: { maintenance_id: { in: [pending.maintenance_id, immediate.maintenance_id] } } });
    }
  });
});

describe("POST /api/assets/:tag/maintenance", () => {
  it("opens a ticket in 'Pending TSG Review' under the session user, and leaves the asset's status alone (issue #32 fixed)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0401" });

    const res = await as(USERS.custodianB).post(`/api/assets/${asset.tag}/maintenance`, repairBody("Test fault: the fan is loud"));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.repair).toMatchObject({
      asset_id: asset.assetId,
      reported_by_id: USERS.custodianB.userId,
      issue_description: "Test fault: the fan is loud",
      status: "PENDING_RECEIPT",
    });
    expect(await db.asset_maintenance.count({ where: { asset_id: asset.assetId } })).toBe(1);
    expect((await listedAsset(asset.tag)).status).toBe("AVAILABLE");
  });

  it("ignores isImmediate: the column is gone, and every new ticket is 'Pending TSG Review'", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0402" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/maintenance`, repairBody("Test fault: smoke", { isImmediate: true }));

    expect(res.status).toBe(200);
    expect(res.body.repair).toMatchObject({ status: "PENDING_RECEIPT" });
    expect(res.body.repair).not.toHaveProperty("is_immediate");
    expect((await asStaff.get("/api/maintenance")).body.repairs.find((r: { repairId: number }) => r.repairId === res.body.repair.maintenance_id))
      .toMatchObject({ progressStatus: "Pending TSG Review" });
  });

  it("ignores a reporter name that names someone else: the ticket is still the session user's (issue #32 fixed)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0403" });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/maintenance`, repairBody("Test fault: no power", { reportedBy: `Dr. ${USERS.labHead.fullName}` }));

    expect(res.body.repair.reported_by_id).toBe(USERS.custodianA.userId);
  });

  it.each([
    { reportedBy: "Nobody Known", case: "a typed name that matches nobody", tag: "TEST-0404" },
    { reportedBy: undefined, case: "no name", tag: "TEST-0405" },
  ])("files the ticket under the session user for $case, not under user 1 (H-10 fixed)", async ({ reportedBy, tag }) => {
    const asset = await addExtraAsset(db, { tag });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/maintenance`, repairBody("Test fault: unknown reporter", { reportedBy }));

    expect(res.status).toBe(200);
    expect(res.body.repair.reported_by_id).toBe(USERS.custodianA.userId);
  });

  it.each([
    { status: "DISPOSED" as const, label: "Retired", tag: "TEST-0406" },
    { status: "MAINTENANCE" as const, label: "Maintenance", tag: "TEST-0407" },
  ])("answers 409 for an asset that is $label, and writes nothing (the lifecycle guard, H-05)", async ({ status, label, tag }) => {
    const asset = await addExtraAsset(db, { tag, status });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/maintenance`, repairBody(`Test fault: on ${tag}`));

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`${tag} is ${label} and cannot take a maintenance ticket.`);
    expect(await db.asset_maintenance.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it.each([
    { description: undefined, case: "no description" },
    { description: "   ", case: "a description of only spaces" },
  ])("answers 400 for $case, and writes nothing", async ({ description }) => {
    const before = await db.asset_maintenance.count();

    const res = await asCustodian.post(`/api/assets/${ASSETS.available.tag}/maintenance`, repairBody("unused", { description }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await db.asset_maintenance.count()).toBe(before);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asCustodian.post("/api/assets/TEST-9999/maintenance", repairBody("Test fault: unknown tag"));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/assets/:tag/maintenance: the 8-second duplicate guard (M-07)", () => {
  it("rejects the same tag and description sent again within 8 seconds with 409 (M-07)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0411" });

    const first = await asCustodian.post(`/api/assets/${asset.tag}/maintenance`, repairBody("Test fault: sent twice"));
    expect(first.status).toBe(200);

    const second = await asCustodian.post(`/api/assets/${asset.tag}/maintenance`, repairBody("Test fault: sent twice"));
    expect(second.status).toBe(409);
    expect(second.body.success).toBe(false);

    expect(await db.asset_maintenance.count({ where: { asset_id: asset.assetId } })).toBe(1);
  });

  it("accepts a second ticket on the same asset with a different description", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0412" });

    const first = await asCustodian.post(`/api/assets/${asset.tag}/maintenance`, repairBody("Test fault: first problem"));
    const second = await asCustodian.post(`/api/assets/${asset.tag}/maintenance`, repairBody("Test fault: second problem"));

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await db.asset_maintenance.count({ where: { asset_id: asset.assetId } })).toBe(2);
  });

  it("accepts the same description on a different asset", async () => {
    const one = await addExtraAsset(db, { tag: "TEST-0413" });
    const two = await addExtraAsset(db, { tag: "TEST-0414" });

    const first = await asCustodian.post(`/api/assets/${one.tag}/maintenance`, repairBody("Test fault: shared wording"));
    const second = await asCustodian.post(`/api/assets/${two.tag}/maintenance`, repairBody("Test fault: shared wording"));

    expect([first.status, second.status]).toEqual([200, 200]);
  });

  it("answers 409, not 404, when an unknown tag is sent twice, because the guard runs before the tag lookup (new finding, M-07 family)", async () => {
    const first = await asCustodian.post("/api/assets/TEST-9998/maintenance", repairBody("Test fault: unknown tag twice"));
    expect(first.status).toBe(404);

    const second = await asCustodian.post("/api/assets/TEST-9998/maintenance", repairBody("Test fault: unknown tag twice"));
    expect(second.status).toBe(409);
  });
});

describe("PUT /api/maintenance/:id", () => {
  it.each([
    { progressStatus: "Inspection Phase", tag: "TEST-0421" },
    { progressStatus: "Warranty Holder Possession", tag: "TEST-0422" },
    { progressStatus: "Third-Party Repairer Possession", tag: "TEST-0423" },
  ])(
    "'$progressStatus': receives the asset: the ticket notes who and when, and the asset goes to Maintenance at the TSG Office",
    async ({ progressStatus, tag }) => {
      const asset = await addExtraAsset(db, { tag, condition: "MINOR_DRIFT" });
      const repairId = await openTicket(asset.tag);

      const res = await asStaff.put(`/api/maintenance/${repairId}`, { progressStatus });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, repair: { maintenance_id: repairId, status: STATUS_OF[progressStatus] } });
      const ticket = await db.asset_maintenance.findUniqueOrThrow({ where: { maintenance_id: repairId } });
      expect(ticket).toMatchObject({ status: STATUS_OF[progressStatus], received_by_id: USERS.staffTsg.userId });
      expect(ticket.received_at).not.toBeNull();
      expect(await listedAsset(asset.tag)).toMatchObject({ status: "MAINTENANCE", currentLocation: "TSG Office", condition: "MINOR_DRIFT" });
    },
  );

  it("receiving an asset on loan ends its loan as Ended by Maintenance", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0425", status: "ON_LOAN", custodianId: USERS.custodianA.userId });
    const repairId = await openTicket(asset.tag);

    await asStaff.put(`/api/maintenance/${repairId}`, { progressStatus: "Inspection Phase" });

    const loan = await db.asset_loans.findUniqueOrThrow({ where: { loan_id: asset.loanId! } });
    expect(loan.status).toBe("ENDED_BY_MAINTENANCE");
    expect(loan.closed_at).not.toBeNull();
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "MAINTENANCE", holder: null });
  });

  it("moving between received statuses changes only the ticket", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0424" });
    const repairId = await openTicket(asset.tag);
    await asStaff.put(`/api/maintenance/${repairId}`, { progressStatus: "Inspection Phase" });
    const receivedAt = (await db.asset_maintenance.findUniqueOrThrow({ where: { maintenance_id: repairId } })).received_at;

    const res = await asStaff.put(`/api/maintenance/${repairId}`, { progressStatus: "Third-Party Repairer Possession" });

    expect(res.status).toBe(200);
    const ticket = await db.asset_maintenance.findUniqueOrThrow({ where: { maintenance_id: repairId } });
    expect(ticket).toMatchObject({ status: "EXTERNAL_SERVICE", provider: "Third-party repairer", received_at: receivedAt });
    expect((await listedAsset(asset.tag)).status).toBe("MAINTENANCE");
  });

  it("answers 409 when the asset's status cannot be received for maintenance, and changes nothing", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0426", assetStatus: "MISSING" });
    const ticket = await db.asset_maintenance.create({ data: { asset_id: asset.assetId, reported_by_id: USERS.custodianA.userId, issue_description: "Test old ticket" } });

    const res = await asStaff.put(`/api/maintenance/${ticket.maintenance_id}`, { progressStatus: "Inspection Phase" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("TEST-0426 is Missing and cannot be received for maintenance.");
    expect(await ticketStatus(ticket.maintenance_id)).toBe("PENDING_RECEIPT");
  });

  it("'Fixed & Completed': resolves the ticket, files a Maintenance inspection by the Staff member, and puts the asset back to Available", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0431", status: "ON_LOAN", custodianId: USERS.custodianA.userId, condition: "DEGRADED" });
    const repairId = await openTicket(asset.tag);
    await asStaff.put(`/api/maintenance/${repairId}`, { progressStatus: "Inspection Phase" });

    const res = await asStaff.put(`/api/maintenance/${repairId}`, {
      progressStatus: "Fixed & Completed",
      assetCondition: "OPERATIONAL",
      assetRemarks: "Test repaired: fan replaced",
    });

    expect(res.status).toBe(200);
    const ticket = await db.asset_maintenance.findUniqueOrThrow({ where: { maintenance_id: repairId } });
    expect(ticket).toMatchObject({ status: "RESOLVED", completed_by_id: USERS.staffTsg.userId, resolution_remarks: "Test repaired: fan replaced" });
    const inspection = await db.asset_inspections.findUniqueOrThrow({ where: { inspection_id: ticket.completion_inspection_id! } });
    expect(inspection).toMatchObject({ type: "MAINTENANCE", inspected_by_id: USERS.staffTsg.userId, condition: "OPERATIONAL", remarks: "Test repaired: fan replaced" });
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "AVAILABLE", holder: null, condition: "OPERATIONAL", currentLocation: LAB.shortCode });
  });

  it("'Fixed & Completed' without a known condition or remarks keeps the asset's condition and writes the default remarks", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0432", condition: "DEGRADED" });
    const repairId = await openTicket(asset.tag);
    await asStaff.put(`/api/maintenance/${repairId}`, { progressStatus: "Inspection Phase" });

    const res = await asStaff.put(`/api/maintenance/${repairId}`, { progressStatus: "Fixed & Completed", assetCondition: "Broken" });

    expect(res.status).toBe(200);
    expect(await db.asset_inspections.findFirstOrThrow({ where: { asset_id: asset.assetId, type: "MAINTENANCE" } })).toMatchObject({
      condition: "DEGRADED",
      remarks: DEFAULT_COMPLETION_REMARKS,
    });
    expect((await listedAsset(asset.tag)).status).toBe("AVAILABLE");
  });

  it("'Fixed & Completed' on a ticket that was never received still files an inspection, and leaves the asset's status (known defect H-07)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0433", status: "ON_LOAN", custodianId: USERS.custodianA.userId });
    const repairId = await openTicket(asset.tag);

    const res = await asStaff.put(`/api/maintenance/${repairId}`, { progressStatus: "Fixed & Completed" });

    expect(res.status).toBe(200);
    expect(await reportCount(asset.assetId)).toBe(1);
    expect((await listedAsset(asset.tag)).status).toBe("ON_LOAN");
  });

  it("'Fixed & Completed' on the seeded ticket brings TEST-0003 back from the TSG Office to its home lab", async () => {
    const res = await asStaff.put(`/api/maintenance/${SEEDED_ROWS.repairId}`, { progressStatus: "Fixed & Completed" });

    expect(res.status).toBe(200);
    expect(await listedAsset(ASSETS.inRepair.tag)).toMatchObject({ status: "AVAILABLE", currentLocation: LAB.shortCode, holder: null });
  });

  it("accepts 'Pending TSG Review' and saves it on the ticket without touching the asset (known defect H-07)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0442" });
    const repairId = await openTicket(asset.tag);

    const res = await asStaff.put(`/api/maintenance/${repairId}`, { progressStatus: "Pending TSG Review" });

    expect(res.status).toBe(200);
    expect(await ticketStatus(repairId)).toBe("PENDING_RECEIPT");
    expect((await listedAsset(asset.tag)).status).toBe("AVAILABLE");
    expect(await reportCount(asset.assetId)).toBe(0);
  });

  it("answers 400 for a made-up progress text and leaves the ticket and the asset as they were (H-07, the status is an enum)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0441" });
    const repairId = await openTicket(asset.tag);

    const res = await asStaff.put(`/api/maintenance/${repairId}`, { progressStatus: "Test made-up status" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "Unknown progress status: Test made-up status." });
    expect(await ticketStatus(repairId)).toBe("PENDING_RECEIPT");
    expect((await listedAsset(asset.tag)).status).toBe("AVAILABLE");
  });

  it.each([
    { progressStatus: undefined, case: "no progressStatus" },
    { progressStatus: "   ", case: "a progressStatus of only spaces" },
  ])("answers 400 for $case, and leaves the ticket as it was", async ({ progressStatus }) => {
    const before = await ticketStatus(SEEDED_ROWS.repairId);

    const res = await asStaff.put(`/api/maintenance/${SEEDED_ROWS.repairId}`, { progressStatus });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await ticketStatus(SEEDED_ROWS.repairId)).toBe(before);
  });

  it("answers 400 for an id that is not a number, such as the MNT-n id the list shows", async () => {
    const res = await asStaff.put("/api/maintenance/MNT-1", { progressStatus: "Inspection Phase" });

    expect(res.status).toBe(400);
  });

  it("answers 404 for an unknown id", async () => {
    const res = await asStaff.put("/api/maintenance/9999", { progressStatus: "Inspection Phase" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("PUT /api/maintenance/:id/status", () => {
  it.each([
    { progressStatus: "Inspection Phase", tag: "TEST-0451" },
    { progressStatus: "Fixed & Completed", tag: "TEST-0452" },
  ])(
    "'$progressStatus': changes only the ticket, never the asset, and files no report (known defects H-06, H-07)",
    async ({ progressStatus, tag }) => {
      const asset = await addExtraAsset(db, { tag });
      const repairId = await openTicket(asset.tag);

      const res = await asStaff.put(`/api/maintenance/${repairId}/status`, { progressStatus });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, repair: { maintenance_id: repairId, status: STATUS_OF[progressStatus] } });
      expect(await ticketStatus(repairId)).toBe(STATUS_OF[progressStatus]);
      expect(await reportCount(asset.assetId)).toBe(0);
      expect((await listedAsset(asset.tag)).status).toBe("AVAILABLE");
    },
  );

  it("answers 400 for a made-up progress text, and changes nothing (H-07, the status is an enum)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0453" });
    const repairId = await openTicket(asset.tag);

    const res = await asStaff.put(`/api/maintenance/${repairId}/status`, { progressStatus: "Test made-up status" });

    expect(res.status).toBe(400);
    expect(await ticketStatus(repairId)).toBe("PENDING_RECEIPT");
  });

  it("answers 400 for a progressStatus of only spaces, as PUT /api/maintenance/:id does (H-06 family, closed by the enum)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0454" });
    const repairId = await openTicket(asset.tag);

    const res = await asStaff.put(`/api/maintenance/${repairId}/status`, { progressStatus: "   " });

    expect(res.status).toBe(400);
    expect(await ticketStatus(repairId)).toBe("PENDING_RECEIPT");
  });

  it("answers 400 without progressStatus", async () => {
    const res = await asStaff.put(`/api/maintenance/${SEEDED_ROWS.repairId}/status`, {});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("answers 500 with a generic message and no database text for an unknown id (H-16 fixed)", async () => {
    const res = await asStaff.put("/api/maintenance/9999/status", { progressStatus: "Inspection Phase" });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: "Something went wrong on the server. Please try again.", code: "SERVER_ERROR" });
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/prisma/i);
    expect(text).not.toContain("Invalid `");
    expect(text).not.toMatch(/[A-Za-z]:\\|\.ts\b/);
  });

  it("answers 500 with a generic message and no database text for an id that is not a number (H-16 fixed)", async () => {
    const res = await asStaff.put("/api/maintenance/MNT-1/status", { progressStatus: "Inspection Phase" });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: "Something went wrong on the server. Please try again.", code: "SERVER_ERROR" });
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/prisma/i);
    expect(text).not.toContain("Invalid `");
    expect(text).not.toMatch(/[A-Za-z]:\\|\.ts\b/);
  });
});
