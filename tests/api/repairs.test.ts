/**
 * Repairs API: the repair request, the ticket list, and the two ticket update routes.
 * Covers POST /api/assets/:tag/repair, GET /api/asset_repairs, PUT /api/asset_repairs/:id, PUT /api/asset_repairs/:id/status.
 * Workflow: maintenance (a custodian or staff member reports a fault, TSG moves the ticket through its statuses, and the
 * asset goes into MAINTENANCE and back out when it is fixed).
 * Fixtures: the seeded ticket MNT-1 ("Inspection Phase") on TEST-0003, which is in MAINTENANCE at the TSG Office; the
 * accounts (USERS). The list tests run first and remove the rows they add. One update test completes MNT-1 and so takes
 * TEST-0003 out of maintenance; every other write test uses its own extra asset (TEST-0401 onward, see extraAssets.ts).
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, LAB, LOCATION_SEPARATOR, SEEDED_ROWS, TSG_OFFICE_LOCATION, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db } = useApiHarness();

/** What RepairForm sends: the reporter's typed name, the fault, and whether it is urgent. */
const repairBody = (description: string, extra: Record<string, unknown> = {}) => ({
  reportedBy: USERS.custodianB.fullName,
  description,
  isImmediate: false,
  ...extra,
});

const DEFAULT_COMPLETION_REMARKS = "Repair completed & verified fixed by technical staff.";

const recordCount = (assetId: number) => db.asset_records.count({ where: { asset_id: assetId } });

const reportCount = (assetId: number) => db.asset_reports.count({ where: { asset_id: assetId } });

const newestRecord = (assetId: number) =>
  db.asset_records.findFirstOrThrow({ where: { asset_id: assetId }, orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }] });

const ticketStatus = async (repairId: number) => (await db.asset_repairs.findUniqueOrThrow({ where: { repair_id: repairId } })).progress_status;

/**
 * Opens a ticket through the API and answers its id. The description names the tag, so no two tests
 * send the same tag and description and trip the 8-second duplicate guard. (M-07)
 */
async function openTicket(tag: string): Promise<number> {
  const res = await api.post(`/api/assets/${tag}/repair`, repairBody(`Test fault on ${tag}`));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.repair.repair_id;
}

async function listedAsset(tag: string) {
  const res = await api.get("/api/assets");
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

describe("GET /api/asset_repairs", () => {
  it("lists the seeded ticket with the fields the screens read", async () => {
    const res = await api.get("/api/asset_repairs");

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
      isImmediate: false,
      priority: "Medium",
      acknowledged: true,
    });
    expect(typeof res.body.repairs[0].submittedAt).toBe("string");
    expect(typeof res.body.repairs[0].createdAt).toBe("string");
  });

  it("lists tickets newest first, marks the two starting statuses as not acknowledged, and an immediate ticket as Critical", async () => {
    const pending = await db.asset_repairs.create({
      data: {
        asset_id: ASSETS.inspected.assetId,
        reported_by_id: USERS.staffTsg.userId,
        issue_description: "Test fault: pending review",
        is_immediate: false,
        progress_status: "Pending TSG Review",
        created_at: new Date("2026-06-01T09:00:00Z"),
      },
    });
    const immediate = await db.asset_repairs.create({
      data: {
        asset_id: ASSETS.available.assetId,
        reported_by_id: USERS.labHead.userId,
        issue_description: "Test fault: immediate",
        is_immediate: true,
        progress_status: "Awaiting Immediate Dispatch",
        created_at: new Date("2026-06-02T09:00:00Z"),
      },
    });
    try {
      const res = await api.get("/api/asset_repairs");

      expect(res.body.repairs.map((r: { id: string }) => r.id)).toEqual([
        `MNT-${immediate.repair_id}`,
        `MNT-${pending.repair_id}`,
        `MNT-${SEEDED_ROWS.repairId}`,
      ]);
      expect(res.body.repairs[0]).toMatchObject({
        assetId: ASSETS.available.tag,
        reportedBy: USERS.labHead.fullName,
        isImmediate: true,
        priority: "Critical",
        acknowledged: false,
      });
      expect(res.body.repairs[1]).toMatchObject({ isImmediate: false, priority: "Medium", acknowledged: false });
    } finally {
      await db.asset_repairs.deleteMany({ where: { repair_id: { in: [pending.repair_id, immediate.repair_id] } } });
    }
  });
});

describe("POST /api/assets/:tag/repair", () => {
  it("opens a ticket in 'Pending TSG Review' under the reporter found by typed name, and leaves the asset's status alone", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0401" });
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.post(`/api/assets/${asset.tag}/repair`, repairBody("Test fault: the fan is loud"));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.repair).toMatchObject({
      asset_id: asset.assetId,
      reported_by_id: USERS.custodianB.userId,
      issue_description: "Test fault: the fan is loud",
      is_immediate: false,
      progress_status: "Pending TSG Review",
    });
    expect(await db.asset_repairs.count({ where: { asset_id: asset.assetId } })).toBe(1);
    expect(await recordCount(asset.assetId)).toBe(recordsBefore);
    expect((await listedAsset(asset.tag)).status).toBe("Active");
  });

  it("opens an immediate ticket in 'Awaiting Immediate Dispatch'", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0402" });

    const res = await api.post(`/api/assets/${asset.tag}/repair`, repairBody("Test fault: smoke", { isImmediate: true }));

    expect(res.status).toBe(200);
    expect(res.body.repair).toMatchObject({ is_immediate: true, progress_status: "Awaiting Immediate Dispatch" });
  });

  it("drops a leading 'Dr.' from the typed name before matching the reporter", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0403" });

    const res = await api.post(`/api/assets/${asset.tag}/repair`, repairBody("Test fault: no power", { reportedBy: `Dr. ${USERS.labHead.fullName}` }));

    expect(res.body.repair.reported_by_id).toBe(USERS.labHead.userId);
  });

  it.each([
    { reportedBy: "Nobody Known", case: "a typed name that matches nobody", tag: "TEST-0404" },
    { reportedBy: undefined, case: "no name", tag: "TEST-0405" },
  ])("files the ticket under user 1 for $case (known defect H-10)", async ({ reportedBy, tag }) => {
    const asset = await addExtraAsset(db, { tag });

    const res = await api.post(`/api/assets/${asset.tag}/repair`, repairBody("Test fault: unknown reporter", { reportedBy }));

    expect(res.status).toBe(200);
    expect(res.body.repair.reported_by_id).toBe(USERS.admin.userId);
  });

  it("accepts a repair request for a disposed asset, and leaves it DISPOSED (known defect H-05)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0406", status: "DISPOSED" });

    const res = await api.post(`/api/assets/${asset.tag}/repair`, repairBody("Test fault: on a disposed asset"));

    expect(res.status).toBe(200);
    expect((await newestRecord(asset.assetId)).status).toBe("DISPOSED");
  });

  it.each([
    { description: undefined, case: "no description" },
    { description: "   ", case: "a description of only spaces" },
  ])("answers 400 for $case, and writes nothing", async ({ description }) => {
    const before = await db.asset_repairs.count();

    const res = await api.post(`/api/assets/${ASSETS.available.tag}/repair`, repairBody("unused", { description }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await db.asset_repairs.count()).toBe(before);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await api.post("/api/assets/TEST-9999/repair", repairBody("Test fault: unknown tag"));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/assets/:tag/repair: the 8-second duplicate guard (M-07)", () => {
  it("rejects the same tag and description sent again within 8 seconds with 409 (M-07)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0411" });

    const first = await api.post(`/api/assets/${asset.tag}/repair`, repairBody("Test fault: sent twice"));
    expect(first.status).toBe(200);

    const second = await api.post(`/api/assets/${asset.tag}/repair`, repairBody("Test fault: sent twice"));
    expect(second.status).toBe(409);
    expect(second.body.success).toBe(false);

    expect(await db.asset_repairs.count({ where: { asset_id: asset.assetId } })).toBe(1);
  });

  it("accepts a second ticket on the same asset with a different description", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0412" });

    const first = await api.post(`/api/assets/${asset.tag}/repair`, repairBody("Test fault: first problem"));
    const second = await api.post(`/api/assets/${asset.tag}/repair`, repairBody("Test fault: second problem"));

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await db.asset_repairs.count({ where: { asset_id: asset.assetId } })).toBe(2);
  });

  it("accepts the same description on a different asset", async () => {
    const one = await addExtraAsset(db, { tag: "TEST-0413" });
    const two = await addExtraAsset(db, { tag: "TEST-0414" });

    const first = await api.post(`/api/assets/${one.tag}/repair`, repairBody("Test fault: shared wording"));
    const second = await api.post(`/api/assets/${two.tag}/repair`, repairBody("Test fault: shared wording"));

    expect([first.status, second.status]).toEqual([200, 200]);
  });

  it("answers 409, not 404, when an unknown tag is sent twice, because the guard runs before the tag lookup (new finding, M-07 family)", async () => {
    const first = await api.post("/api/assets/TEST-9998/repair", repairBody("Test fault: unknown tag twice"));
    expect(first.status).toBe(404);

    const second = await api.post("/api/assets/TEST-9998/repair", repairBody("Test fault: unknown tag twice"));
    expect(second.status).toBe(409);
  });
});

describe("PUT /api/asset_repairs/:id", () => {
  it.each([
    { progressStatus: "Inspection Phase", tag: "TEST-0421" },
    { progressStatus: "Warranty Holder Possession", tag: "TEST-0422" },
    { progressStatus: "Third-Party Repairer Possession", tag: "TEST-0423" },
  ])(
    "'$progressStatus': updates the ticket and adds one MAINTENANCE record at the TSG Office, keeping custodian, condition, and home lab",
    async ({ progressStatus, tag }) => {
      const asset = await addExtraAsset(db, { tag, custodianId: USERS.custodianA.userId, condition: "MINOR_DRIFT" });
      const repairId = await openTicket(asset.tag);
      const recordsBefore = await recordCount(asset.assetId);

      const res = await api.put(`/api/asset_repairs/${repairId}`, { progressStatus });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, repair: { repair_id: repairId, progress_status: progressStatus } });
      expect(await ticketStatus(repairId)).toBe(progressStatus);
      expect(await recordCount(asset.assetId)).toBe(recordsBefore + 1);
      expect(await newestRecord(asset.assetId)).toMatchObject({
        status: "MAINTENANCE",
        asset_condition: "MINOR_DRIFT",
        location: LAB.homeLocation,
        current_location: TSG_OFFICE_LOCATION,
        current_custodian: USERS.custodianA.userId,
        repair_id: null,
      });
      expect((await listedAsset(asset.tag)).status).toBe("Maintenance");
    },
  );

  it("adds no second MAINTENANCE record when the ticket moves between maintenance statuses", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0424" });
    const repairId = await openTicket(asset.tag);
    await api.put(`/api/asset_repairs/${repairId}`, { progressStatus: "Inspection Phase" });
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.put(`/api/asset_repairs/${repairId}`, { progressStatus: "Third-Party Repairer Possession" });

    expect(res.status).toBe(200);
    expect(await ticketStatus(repairId)).toBe("Third-Party Repairer Possession");
    expect(await recordCount(asset.assetId)).toBe(recordsBefore);
  });

  it("'Fixed & Completed': restores the status, custodian, and location from before maintenance, with the new condition, and files a report", async () => {
    const asset = await addExtraAsset(db, {
      tag: "TEST-0431",
      status: "ON_LOAN",
      custodianId: USERS.custodianA.userId,
      condition: "DEGRADED",
      currentLocation: `Laguna${LOCATION_SEPARATOR}CeLT`,
    });
    const repairId = await openTicket(asset.tag);
    await api.put(`/api/asset_repairs/${repairId}`, { progressStatus: "Inspection Phase" });
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.put(`/api/asset_repairs/${repairId}`, {
      progressStatus: "Fixed & Completed",
      assetCondition: "OPERATIONAL",
      assetRemarks: "Test repaired: fan replaced",
    });

    expect(res.status).toBe(200);
    expect(await ticketStatus(repairId)).toBe("Fixed & Completed");
    expect(await recordCount(asset.assetId)).toBe(recordsBefore + 1);
    expect(await newestRecord(asset.assetId)).toMatchObject({
      status: "ON_LOAN",
      asset_condition: "OPERATIONAL",
      location: LAB.homeLocation,
      current_location: `Laguna${LOCATION_SEPARATOR}CeLT`,
      current_custodian: USERS.custodianA.userId,
      Asset_Remarks: "Test repaired: fan replaced",
    });
    const reports = await db.asset_reports.findMany({ where: { asset_id: asset.assetId } });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      reported_by_id: USERS.custodianB.userId,
      report_condition: "OPERATIONAL",
      report_remarks: "Test repaired: fan replaced",
    });
    expect(await listedAsset(asset.tag)).toMatchObject({ status: "On Loan", custodian: USERS.custodianA.fullName });
  });

  it("'Fixed & Completed' without a known condition or remarks keeps the asset's condition and writes the default remarks", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0432", condition: "DEGRADED" });
    const repairId = await openTicket(asset.tag);
    await api.put(`/api/asset_repairs/${repairId}`, { progressStatus: "Inspection Phase" });

    const res = await api.put(`/api/asset_repairs/${repairId}`, { progressStatus: "Fixed & Completed", assetCondition: "Broken" });

    expect(res.status).toBe(200);
    expect(await newestRecord(asset.assetId)).toMatchObject({ status: "ACTIVE", asset_condition: "DEGRADED", Asset_Remarks: DEFAULT_COMPLETION_REMARKS });
    expect(await db.asset_reports.findFirstOrThrow({ where: { asset_id: asset.assetId } })).toMatchObject({
      report_condition: "DEGRADED",
      report_remarks: DEFAULT_COMPLETION_REMARKS,
    });
  });

  it("'Fixed & Completed' on a ticket that never went into maintenance still adds a record and a report", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0433" });
    const repairId = await openTicket(asset.tag);
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.put(`/api/asset_repairs/${repairId}`, { progressStatus: "Fixed & Completed" });

    expect(res.status).toBe(200);
    expect(await recordCount(asset.assetId)).toBe(recordsBefore + 1);
    expect(await reportCount(asset.assetId)).toBe(1);
    expect((await newestRecord(asset.assetId)).status).toBe("ACTIVE");
  });

  it("'Fixed & Completed' on the seeded ticket brings TEST-0003 back from the TSG Office to Custodian A at its home lab", async () => {
    const res = await api.put(`/api/asset_repairs/${SEEDED_ROWS.repairId}`, { progressStatus: "Fixed & Completed" });

    expect(res.status).toBe(200);
    expect(await newestRecord(ASSETS.inRepair.assetId)).toMatchObject({
      status: "ACTIVE",
      current_location: LAB.homeLocation,
      current_custodian: USERS.custodianA.userId,
    });
    expect(await listedAsset(ASSETS.inRepair.tag)).toMatchObject({ status: "Active", custodian: USERS.custodianA.fullName });
  });

  it.each([
    { progressStatus: "Test made-up status", tag: "TEST-0441" },
    { progressStatus: "Pending TSG Review", tag: "TEST-0442" },
  ])("accepts '$progressStatus' and saves it on the ticket without touching the asset (known defect H-07)", async ({ progressStatus, tag }) => {
    const asset = await addExtraAsset(db, { tag });
    const repairId = await openTicket(asset.tag);
    const recordsBefore = await recordCount(asset.assetId);

    const res = await api.put(`/api/asset_repairs/${repairId}`, { progressStatus });

    expect(res.status).toBe(200);
    expect(await ticketStatus(repairId)).toBe(progressStatus);
    expect(await recordCount(asset.assetId)).toBe(recordsBefore);
    expect(await reportCount(asset.assetId)).toBe(0);
  });

  it.each([
    { progressStatus: undefined, case: "no progressStatus" },
    { progressStatus: "   ", case: "a progressStatus of only spaces" },
  ])("answers 400 for $case, and leaves the ticket as it was", async ({ progressStatus }) => {
    const before = await ticketStatus(SEEDED_ROWS.repairId);

    const res = await api.put(`/api/asset_repairs/${SEEDED_ROWS.repairId}`, { progressStatus });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await ticketStatus(SEEDED_ROWS.repairId)).toBe(before);
  });

  it("answers 400 for an id that is not a number, such as the MNT-n id the list shows", async () => {
    const res = await api.put("/api/asset_repairs/MNT-1", { progressStatus: "Inspection Phase" });

    expect(res.status).toBe(400);
  });

  it("answers 404 for an unknown id", async () => {
    const res = await api.put("/api/asset_repairs/9999", { progressStatus: "Inspection Phase" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("PUT /api/asset_repairs/:id/status", () => {
  it.each([
    { progressStatus: "Inspection Phase", tag: "TEST-0451" },
    { progressStatus: "Fixed & Completed", tag: "TEST-0452" },
    { progressStatus: "Test made-up status", tag: "TEST-0453" },
  ])(
    "'$progressStatus': changes only the ticket, with no asset record and no report (known defects H-06, H-07)",
    async ({ progressStatus, tag }) => {
      const asset = await addExtraAsset(db, { tag });
      const repairId = await openTicket(asset.tag);
      const recordsBefore = await recordCount(asset.assetId);

      const res = await api.put(`/api/asset_repairs/${repairId}/status`, { progressStatus });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, repair: { repair_id: repairId, progress_status: progressStatus } });
      expect(await ticketStatus(repairId)).toBe(progressStatus);
      expect(await recordCount(asset.assetId)).toBe(recordsBefore);
      expect(await reportCount(asset.assetId)).toBe(0);
      expect((await listedAsset(asset.tag)).status).toBe("Active");
    },
  );

  it("accepts a progressStatus of only spaces, which PUT /api/asset_repairs/:id refuses (H-06 family)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0454" });
    const repairId = await openTicket(asset.tag);

    const res = await api.put(`/api/asset_repairs/${repairId}/status`, { progressStatus: "   " });

    expect(res.status).toBe(200);
    expect((await ticketStatus(repairId)).trim()).toBe("");
  });

  it("answers 400 without progressStatus", async () => {
    const res = await api.put(`/api/asset_repairs/${SEEDED_ROWS.repairId}/status`, {});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("answers 500 with the raw Prisma error for an unknown id (known defect H-16)", async () => {
    const res = await api.put("/api/asset_repairs/9999/status", { progressStatus: "Inspection Phase" });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/prisma\.asset_repairs\.update/);
  });

  it("answers 500 with the raw Prisma error for an id that is not a number (known defect H-16)", async () => {
    const res = await api.put("/api/asset_repairs/MNT-1/status", { progressStatus: "Inspection Phase" });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/prisma\.asset_repairs\.update/);
  });
});
