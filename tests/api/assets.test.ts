/**
 * Assets API: the asset list, custodian history, registration, edit, and delete.
 * Covers GET /api/assets, GET /api/assets/:tag/custodian-history, POST /api/assets, PUT /api/assets/:tag,
 * DELETE /api/assets/:tag. Workflow: asset registry (intake, edit, delete) and the asset detail screens.
 * Fixtures: the six seeded assets (ASSETS) and their records, loans, repair, disposal, and report; the seeded
 * accounts (USERS). The read tests run first; the write tests add assets TEST-0007 onward and CITe4D-0001, edit
 * TEST-0001, TEST-0003, and TEST-0005, and delete TEST-0004. The edit tests also add assets TEST-0901 onward
 * (addExtraAsset), each held as the test needs.
 */
import { describe, expect, it } from "vitest";
import { ASSETS, FUNDING_SOURCE, LAB, LOCATION_SEPARATOR, SEEDED_ROWS, TSG_OFFICE_LOCATION, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";
import { addExtraAsset } from "../setup/extraAssets";

const { db, as } = useApiHarness();
const asStaff = as(USERS.staffTsg);

const DAY_MS = 24 * 60 * 60 * 1000;

async function listedAsset(tag: string) {
  const res = await asStaff.get("/api/assets");
  expect(res.status).toBe(200);
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

const newestRecord = (assetId: number) =>
  db.asset_records.findFirstOrThrow({ where: { asset_id: assetId }, orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }] });

describe("GET /api/assets", () => {
  it("answers one entry per asset with the fields the screens read", async () => {
    const res = await asStaff.get("/api/assets");

    expect(res.status).toBe(200);
    expect(res.body.assets).toHaveLength(Object.keys(ASSETS).length);
    expect(await listedAsset(ASSETS.available.tag)).toMatchObject({
      id: ASSETS.available.tag,
      name: ASSETS.available.name,
      category: ASSETS.available.category,
      status: "Active",
      location: "Manila",
      lab: LAB.shortCode,
      currentLocation: LAB.homeLocation,
      condition: 100,
      assetCondition: "PERFECT",
      cost: ASSETS.available.acquisitionValue,
      funding: FUNDING_SOURCE,
      serial: `TEST-SN-${ASSETS.available.assetId}`,
      procured: "2025-06-01",
      warranty: "2027-06-01",
    });
    // Held by the placeholder custodian: nobody holds it, so no name is sent. (answer 1)
    expect((await listedAsset(ASSETS.available.tag)).custodian).toBeUndefined();
  });

  it("sends each named custodian's user id, and none for the placeholder (issue #32)", async () => {
    expect((await listedAsset(ASSETS.onLoan.tag)).custodianId).toBe(USERS.custodianA.userId);
    expect(await listedAsset(ASSETS.available.tag)).not.toHaveProperty("custodianId");
  });

  it("shows each seeded asset in its seeded state", async () => {
    const res = await asStaff.get("/api/assets");

    for (const asset of Object.values(ASSETS)) {
      const listed = res.body.assets.find((a: { id: string }) => a.id === asset.tag);
      expect(listed.status, asset.tag).toBe(asset.listStatus);
    }
  });

  it("gives an asset on loan its borrowed date, due date, and days left, with the borrower as custodian", async () => {
    const listed = await listedAsset(ASSETS.onLoan.tag);

    expect(listed).toMatchObject({ status: "On Loan", custodian: USERS.custodianA.fullName });
    expect(typeof listed.borrowedOn).toBe("string");
    expect(typeof listed.dueDate).toBe("string");
    expect(listed.daysLeft).toBe(30);
  });

  it("shows an asset whose approved loan is past due as Overdue, with negative days left", async () => {
    const original = await db.asset_loans.findUniqueOrThrow({ where: { loan_id: SEEDED_ROWS.approvedLoanId } });
    await db.asset_loans.update({ where: { loan_id: SEEDED_ROWS.approvedLoanId }, data: { due_date: new Date(Date.now() - 2 * DAY_MS) } });
    try {
      const listed = await listedAsset(ASSETS.onLoan.tag);

      expect(listed.status).toBe("Overdue");
      expect(listed.daysLeft).toBeLessThan(0);
    } finally {
      await db.asset_loans.update({ where: { loan_id: SEEDED_ROWS.approvedLoanId }, data: { due_date: original.due_date } });
    }
  });

  it("shows an asset under maintenance at the TSG Office while its home lab stays the same", async () => {
    const listed = await listedAsset(ASSETS.inRepair.tag);

    expect(listed).toMatchObject({ status: "Maintenance", location: "Manila", lab: LAB.shortCode, currentLocation: TSG_OFFICE_LOCATION });
  });

  it("gives a disposed asset its disposal details, parsed back out of the reason text (known defect M-13)", async () => {
    const listed = await listedAsset(ASSETS.disposed.tag);

    expect(listed.status).toBe("Disposed");
    expect(listed.disposalId).toBe(`DISP-${SEEDED_ROWS.disposalId}`);
    expect(listed.disposalDetails).toMatchObject({
      lastCustodian: "No Custodian",
      disposalPathway: "Test pathway",
      breakdownReasons: "Test breakdown: the board is burnt",
      decommissionedBy: USERS.staffTsg.fullName,
    });
    expect(typeof listed.disposalDetails.decommissionDate).toBe("string");
  });

  it("maps each record condition to a number (OPERATIONAL is 90) and lists the asset's inspection reports", async () => {
    const listed = await listedAsset(ASSETS.inspected.tag);

    expect(listed).toMatchObject({
      condition: 90,
      assetCondition: "OPERATIONAL",
      custodian: USERS.custodianA.fullName,
      remarks: "Test inspection: minor scuffs on the casing",
    });
    expect(listed.asset_reports).toHaveLength(1);
    expect(listed.asset_reports[0]).toMatchObject({
      id: SEEDED_ROWS.reportId,
      reportId: `RPT-${SEEDED_ROWS.reportId}`,
      assetId: ASSETS.inspected.tag,
      reportedBy: USERS.staffTsg.fullName,
      condition: "OPERATIONAL",
    });
  });

  it("nests the asset's records newest first, with custodian names", async () => {
    const listed = await listedAsset(ASSETS.onLoan.tag);

    expect(listed.asset_records.map((r: { status: string }) => r.status)).toEqual(["ON_LOAN", "ACTIVE"]);
    expect(listed.asset_records.map((r: { custodian: string }) => r.custodian)).toEqual([USERS.custodianA.fullName, USERS.admin.fullName]);
    expect(listed.asset_transfers).toEqual([]);
    expect(listed.asset_monetary).toMatchObject({ acquisition_value: ASSETS.onLoan.acquisitionValue, funding_source: FUNDING_SOURCE });
  });

  it("takes the record with the higher id as newest when two share a date_logged (M-09)", async () => {
    const intake = await newestRecord(ASSETS.available.assetId);
    const tie = await db.asset_records.create({
      data: {
        asset_id: ASSETS.available.assetId,
        status: "MAINTENANCE",
        location: intake.location,
        current_custodian: intake.current_custodian,
        date_logged: intake.date_logged,
      },
    });
    try {
      expect((await listedAsset(ASSETS.available.tag)).status).toBe("Maintenance");
    } finally {
      await db.asset_records.delete({ where: { asset_record_id: tie.asset_record_id } });
    }
  });
});

describe("GET /api/assets/:tag/custodian-history", () => {
  it("answers the custody records oldest first, with the last one marked current", async () => {
    const res = await asStaff.get(`/api/assets/${ASSETS.onLoan.tag}/custodian-history`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, assetTag: ASSETS.onLoan.tag, assetName: ASSETS.onLoan.name, historyCount: 2 });
    expect(res.body.custodianHistory).toMatchObject([
      {
        sequence: 1,
        status: "ACTIVE",
        location: LAB.homeLocation,
        condition: "PERFECT",
        remarks: "Initial Asset Registration Intake Record",
        isCurrent: false,
      },
      {
        sequence: 2,
        custodianName: USERS.custodianA.fullName,
        status: "ON_LOAN",
        location: LAB.homeLocation,
        condition: "PERFECT",
        remarks: "Custody Update Record",
        isCurrent: true,
      },
    ]);
    // The first entry is the placeholder custodian's: no name, email, or id number. (answer 1)
    expect(res.body.custodianHistory[0]).not.toHaveProperty("custodianName");
    expect(res.body.custodianHistory[0]).not.toHaveProperty("custodianEmail");
    expect(res.body.custodianHistory[0]).not.toHaveProperty("custodianId");
  });

  it("sends each custodian's email to a Lab Head only (01C 4.2), and no id number to any role (answer 6)", async () => {
    const forLabHead = await as(USERS.labHead).get(`/api/assets/${ASSETS.onLoan.tag}/custodian-history`);
    const forStaff = await asStaff.get(`/api/assets/${ASSETS.onLoan.tag}/custodian-history`);

    expect(forLabHead.body.custodianHistory[1]).toMatchObject({ custodianEmail: USERS.custodianA.email });
    expect(forStaff.body.custodianHistory[1]).not.toHaveProperty("custodianEmail");
    for (const entry of [...forLabHead.body.custodianHistory, ...forStaff.body.custodianHistory]) expect(entry).not.toHaveProperty("custodianId");
  });

  it("looks a numeric tag up as an asset id", async () => {
    const res = await asStaff.get(`/api/assets/${ASSETS.onLoan.assetId}/custodian-history`);

    expect(res.status).toBe(200);
    expect(res.body.assetTag).toBe(ASSETS.onLoan.tag);
  });

  it("invents a first entry for an asset with no records (H-09 family)", async () => {
    const bare = await db.assets.create({ data: { asset_tag: "TEST-9001", name: "Test Asset With No Records", category: "AUDIO" } });
    try {
      const res = await asStaff.get("/api/assets/TEST-9001/custodian-history");

      expect(res.status).toBe(200);
      expect(res.body.custodianHistory).toMatchObject([
        { sequence: 1, custodianName: "Equipment Custodian", status: "ACTIVE", location: "DLSU Campus", isCurrent: true },
      ]);
      expect(res.body.custodianHistory[0]).not.toHaveProperty("custodianEmail");
    } finally {
      await db.assets.delete({ where: { asset_id: bare.asset_id } });
    }
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asStaff.get("/api/assets/TEST-9999/custodian-history");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/assets", () => {
  const intake = (extra: Record<string, unknown> = {}) => ({
    name: "Test Intake Camera",
    category: "CAMERA",
    serial: "TEST-SN-NEW",
    manufacturer: "Test Manufacturer",
    funding: "Test Intake Grant",
    acquisitionValue: 12345.5,
    location: "Manila",
    lab: LAB.shortCode,
    ...extra,
  });

  it("registers the asset under the next free tag for the lab, with its monetary row and an ACTIVE PERFECT record", async () => {
    const res = await asStaff.post("/api/assets", intake({ remarks: "Test intake remark" }));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.asset).toMatchObject({ asset_tag: "TEST-0007", name: "Test Intake Camera", category: "CAMERA", serial_number: "TEST-SN-NEW" });

    const assetId = res.body.asset.asset_id;
    const monetary = await db.asset_monetary.findUniqueOrThrow({ where: { asset_id: assetId } });
    expect(monetary.funding_source).toBe("Test Intake Grant");
    expect(Number(monetary.acquisition_value)).toBe(12345.5);

    const records = await db.asset_records.findMany({ where: { asset_id: assetId } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      status: "ACTIVE",
      asset_condition: "PERFECT",
      location: `Manila${LOCATION_SEPARATOR}${LAB.shortCode}`,
      current_location: `Manila${LOCATION_SEPARATOR}${LAB.shortCode}`,
      Asset_Remarks: "Test intake remark",
    });
  });

  it("files the new asset under the placeholder custodian, user 1 (nobody holds it), when no custodian id is sent", async () => {
    const res = await asStaff.post("/api/assets", intake());

    const record = await newestRecord(res.body.asset.asset_id);
    expect(record.current_custodian).toBe(USERS.admin.userId);
  });

  it("files the new asset under the custodian id when one is sent", async () => {
    const res = await asStaff.post("/api/assets", intake({ custodianId: USERS.custodianB.userId }));

    const record = await newestRecord(res.body.asset.asset_id);
    expect(record.current_custodian).toBe(USERS.custodianB.userId);
  });

  it("normalizes a category name and stores an unknown category as DEV_KIT", async () => {
    const spaced = await asStaff.post("/api/assets", intake({ category: "video camera" }));
    const unknown = await asStaff.post("/api/assets", intake({ category: "Test Unknown Category" }));

    expect(spaced.body.asset.category).toBe("VIDEO_CAMERA");
    expect(unknown.body.asset.category).toBe("DEV_KIT");
  });

  it("uses the CITe4D tag prefix and location Unassigned when no lab or location is sent", async () => {
    const res = await asStaff.post("/api/assets", { name: "Test Unplaced Asset", category: "AUDIO" });

    expect(res.status).toBe(200);
    expect(res.body.asset.asset_tag).toBe("CITe4D-0001");
    const record = await newestRecord(res.body.asset.asset_id);
    expect(record.location).toBe("Unassigned");
    const monetary = await db.asset_monetary.findUniqueOrThrow({ where: { asset_id: res.body.asset.asset_id } });
    expect(monetary.funding_source).toBe("Unspecified");
    expect(Number(monetary.acquisition_value)).toBe(0);
  });

  it("accepts a data:image picture", async () => {
    const res = await asStaff.post("/api/assets", intake({ image: "data:image/png;base64,iVBORw0KGgo=" }));

    expect(res.status).toBe(200);
    expect(res.body.asset.image_url).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("answers 400 without a name or a category, and writes nothing", async () => {
    const before = await db.assets.count();
    const noName = await asStaff.post("/api/assets", intake({ name: undefined }));
    const noCategory = await asStaff.post("/api/assets", intake({ category: undefined }));

    expect(noName.status).toBe(400);
    expect(noCategory.status).toBe(400);
    expect(await db.assets.count()).toBe(before);
  });

  it("answers 400 for an image that is neither a data:image nor a picture file", async () => {
    const res = await asStaff.post("/api/assets", intake({ image: "https://example.test/file.exe" }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("PUT /api/assets/:tag", () => {
  it("changes only the fields sent", async () => {
    const recordBefore = await newestRecord(ASSETS.available.assetId);

    const res = await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { name: "Test Dev Kit Renamed" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, asset: { asset_tag: ASSETS.available.tag, name: "Test Dev Kit Renamed" } });
    const row = await db.assets.findUniqueOrThrow({ where: { asset_id: ASSETS.available.assetId } });
    expect(row).toMatchObject({ name: "Test Dev Kit Renamed", serial_number: `TEST-SN-${ASSETS.available.assetId}`, category: "DEV_KIT" });
    const recordAfter = await newestRecord(ASSETS.available.assetId);
    expect(recordAfter).toMatchObject({
      status: recordBefore.status,
      location: recordBefore.location,
      current_custodian: recordBefore.current_custodian,
      asset_condition: recordBefore.asset_condition,
    });
    expect(await db.asset_reports.count({ where: { asset_id: ASSETS.available.assetId } })).toBe(0);
  });

  it("adds a record for a location change and leaves the older record as it was (H-14 fixed, issue #74)", async () => {
    const countBefore = await db.asset_records.count({ where: { asset_id: ASSETS.pendingLoan.assetId } });
    const recordBefore = await newestRecord(ASSETS.pendingLoan.assetId);

    const res = await asStaff.put(`/api/assets/${ASSETS.pendingLoan.tag}`, { location: "Laguna", lab: "TESTL" });

    expect(res.status).toBe(200);
    expect(await db.asset_records.count({ where: { asset_id: ASSETS.pendingLoan.assetId } })).toBe(countBefore + 1);
    expect(await db.asset_records.findUniqueOrThrow({ where: { asset_record_id: recordBefore.asset_record_id } })).toEqual(recordBefore);
    const recordAfter = await newestRecord(ASSETS.pendingLoan.assetId);
    expect(recordAfter.asset_record_id).not.toBe(recordBefore.asset_record_id);
    expect(recordAfter.location).toBe(`Laguna${LOCATION_SEPARATOR}TESTL`);
  });

  it("sets the new custodian by user id in a new record, and files the remark as a report under the session user who edited (issues #32, #95)", async () => {
    const countBefore = await db.asset_records.count({ where: { asset_id: ASSETS.pendingLoan.assetId } });

    const res = await asStaff.put(`/api/assets/${ASSETS.pendingLoan.tag}`, {
      custodianId: USERS.custodianB.userId,
      status: "ON_LOAN",
      remarks: "Test edit remark",
      assetCondition: "MINOR_DRIFT",
    });

    expect(res.status).toBe(200);
    expect(await db.asset_records.count({ where: { asset_id: ASSETS.pendingLoan.assetId } })).toBe(countBefore + 1);
    const record = await newestRecord(ASSETS.pendingLoan.assetId);
    expect(record).toMatchObject({ current_custodian: USERS.custodianB.userId, asset_condition: "MINOR_DRIFT", Asset_Remarks: "Test edit remark" });
    const reports = await db.asset_reports.findMany({ where: { asset_id: ASSETS.pendingLoan.assetId } });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ reported_by_id: USERS.staffTsg.userId, report_condition: "MINOR_DRIFT", report_remarks: "Test edit remark" });
  });

  it("answers 400 for an id that is not a Custodian account, and saves nothing (issue #95)", async () => {
    const recordsBefore = await db.asset_records.count({ where: { asset_id: ASSETS.inRepair.assetId } });
    const reportsBefore = await db.asset_reports.count({ where: { asset_id: ASSETS.inRepair.assetId } });

    const res = await asStaff.put(`/api/assets/${ASSETS.inRepair.tag}`, { custodianId: USERS.labHead.userId, remarks: "Test remark for a Lab Head" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "Pick a custodian from the list." });
    expect(await db.asset_records.count({ where: { asset_id: ASSETS.inRepair.assetId } })).toBe(recordsBefore);
    expect(await db.asset_reports.count({ where: { asset_id: ASSETS.inRepair.assetId } })).toBe(reportsBefore);
  });

  it("sets None as the placeholder, user 1, in a new record (issue #95)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0921", status: "ON_LOAN", custodianId: USERS.custodianA.userId });

    const res = await asStaff.put(`/api/assets/${asset.tag}`, { custodianId: null });

    expect(res.status).toBe(200);
    expect(await db.asset_records.count({ where: { asset_id: asset.assetId } })).toBe(2);
    expect(await newestRecord(asset.assetId)).toMatchObject({ current_custodian: USERS.admin.userId, status: "ON_LOAN" });
  });

  it("ignores a typed custodian name (issue #32)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0922", status: "ON_LOAN", custodianId: USERS.custodianA.userId });

    const res = await asStaff.put(`/api/assets/${asset.tag}`, { custodian: USERS.custodianB.fullName });

    expect(res.status).toBe(200);
    expect(await db.asset_records.count({ where: { asset_id: asset.assetId } })).toBe(1);
    expect((await newestRecord(asset.assetId)).current_custodian).toBe(USERS.custodianA.userId);
  });

  it("answers 400 for user 1 and for a value that is not a whole number (issue #95)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0923", status: "ON_LOAN", custodianId: USERS.custodianA.userId });

    for (const custodianId of [USERS.admin.userId, String(USERS.custodianB.userId), 6.5, 0, -7, true]) {
      const res = await asStaff.put(`/api/assets/${asset.tag}`, { custodianId });
      expect(res.status, String(custodianId)).toBe(400);
      expect(res.body.error).toBe("Pick a custodian from the list.");
    }
    expect(await db.asset_records.count({ where: { asset_id: asset.assetId } })).toBe(1);
  });

  it("answers 400 when a save would leave an available asset with a person, and saves nothing (issue #95, answer 5)", async () => {
    const message = "An available asset has no custodian. Pick None, or change the availability.";
    const pooled = await addExtraAsset(db, { tag: "TEST-0924" });
    const lent = await addExtraAsset(db, { tag: "TEST-0925", status: "ON_LOAN", custodianId: USERS.custodianA.userId });

    const giveToPerson = await asStaff.put(`/api/assets/${pooled.tag}`, { name: "Test Should Not Save", custodianId: USERS.custodianA.userId });
    const makeAvailable = await asStaff.put(`/api/assets/${lent.tag}`, { status: "ACTIVE" });

    expect(giveToPerson.status).toBe(400);
    expect(giveToPerson.body.error).toBe(message);
    expect(makeAvailable.status).toBe(400);
    expect(makeAvailable.body.error).toBe(message);
    expect((await db.assets.findUniqueOrThrow({ where: { asset_id: pooled.assetId } })).name).toBe(pooled.name);
    expect(await db.asset_records.count({ where: { asset_id: { in: [pooled.assetId, lent.assetId] } } })).toBe(2);
  });

  it("still saves a rename and a remark on an available asset that an older record gives a person (issue #95, answer 5)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0926", custodianId: USERS.custodianA.userId });

    const res = await asStaff.put(`/api/assets/${asset.tag}`, { name: "Test Old Row Renamed", description: "Test remark on an old row" });

    expect(res.status).toBe(200);
    expect(await newestRecord(asset.assetId)).toMatchObject({ status: "ACTIVE", current_custodian: USERS.custodianA.userId, Asset_Remarks: "Test remark on an old row" });
  });

  it("saves a new funding source and acquisition value when the asset already has both (M-16 fixed)", async () => {
    await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { funding: "Test New Grant", acquisitionValue: 99999 });

    const monetary = await db.asset_monetary.findUniqueOrThrow({ where: { asset_id: ASSETS.available.assetId } });
    expect(monetary.funding_source).toBe("Test New Grant");
    expect(Number(monetary.acquisition_value)).toBe(99999);
  });

  it("keeps the funding source when only an acquisition value is sent (M-16 fixed)", async () => {
    await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { acquisitionValue: 12345.5 });

    const monetary = await db.asset_monetary.findUniqueOrThrow({ where: { asset_id: ASSETS.available.assetId } });
    expect(monetary.funding_source).toBe("Test New Grant");
    expect(Number(monetary.acquisition_value)).toBe(12345.5);
  });

  it("keeps the acquisition value when only a funding source is sent", async () => {
    await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { funding: "Test Third Grant" });

    const monetary = await db.asset_monetary.findUniqueOrThrow({ where: { asset_id: ASSETS.available.assetId } });
    expect(monetary.funding_source).toBe("Test Third Grant");
    expect(Number(monetary.acquisition_value)).toBe(12345.5);
  });

  it.each([
    ["status", "TEST-0901", { status: "MAINTENANCE" }, { status: "MAINTENANCE" }],
    ["condition", "TEST-0902", { assetCondition: "DEGRADED" }, { asset_condition: "DEGRADED" }],
    ["location", "TEST-0903", { location: "Laguna", lab: "TESTL" }, { location: `Laguna${LOCATION_SEPARATOR}TESTL` }],
    ["remarks", "TEST-0904", { description: "Test changed remark" }, { Asset_Remarks: "Test changed remark" }],
  ])("adds a record for a change of %s and leaves the older record as it was (issue #74)", async (_field, tag, body, changed) => {
    const asset = await addExtraAsset(db, { tag, custodianId: USERS.custodianA.userId, remarks: "Test old remark" });
    const recordBefore = await newestRecord(asset.assetId);

    const res = await asStaff.put(`/api/assets/${tag}`, body);

    expect(res.status).toBe(200);
    expect(await db.asset_records.count({ where: { asset_id: asset.assetId } })).toBe(2);
    expect(await db.asset_records.findUniqueOrThrow({ where: { asset_record_id: recordBefore.asset_record_id } })).toEqual(recordBefore);
    const recordAfter = await newestRecord(asset.assetId);
    expect(recordAfter).toMatchObject({
      status: recordBefore.status,
      location: recordBefore.location,
      current_custodian: USERS.custodianA.userId,
      asset_condition: recordBefore.asset_condition,
      Asset_Remarks: recordBefore.Asset_Remarks,
      ...changed,
    });
  });

  it("adds no record for fields on the assets row only (issue #74)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0905" });
    const recordBefore = await newestRecord(asset.assetId);

    const res = await asStaff.put(`/api/assets/${asset.tag}`, {
      name: "Test Row Only Renamed",
      serial: "TEST-SN-ROW-ONLY",
      manufacturer: "Test Maker",
      category: "CAMERA",
      funding: "Test Other Grant",
      procured: "2025-01-15",
      warranty: "2028-01-15",
      image: "data:image/png;base64,iVBORw0KGgo=",
    });

    expect(res.status).toBe(200);
    expect(await db.assets.findUniqueOrThrow({ where: { asset_id: asset.assetId } })).toMatchObject({
      name: "Test Row Only Renamed",
      serial_number: "TEST-SN-ROW-ONLY",
      manufacturer: "Test Maker",
      category: "CAMERA",
      image_url: "data:image/png;base64,iVBORw0KGgo=",
    });
    expect(await db.asset_records.findMany({ where: { asset_id: asset.assetId } })).toEqual([recordBefore]);
    expect(await db.asset_reports.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it("adds no record when a record field is sent with the value it already has (issue #74)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0906", remarks: "Test same remark" });
    const recordBefore = await newestRecord(asset.assetId);

    const res = await asStaff.put(`/api/assets/${asset.tag}`, {
      status: "ACTIVE",
      location: "Manila",
      lab: LAB.shortCode,
      description: "Test same remark",
    });

    expect(res.status).toBe(200);
    expect(await db.asset_records.findMany({ where: { asset_id: asset.assetId } })).toEqual([recordBefore]);
  });

  it("moves the current location with the home only while the asset is at home, and home when it is made available (issue #74)", async () => {
    const away = `Manila${LOCATION_SEPARATOR}TEST Destination`;
    const atHome = await addExtraAsset(db, { tag: "TEST-0907" });
    const onLoan = await addExtraAsset(db, { tag: "TEST-0908", status: "ON_LOAN", custodianId: USERS.custodianA.userId, currentLocation: away });
    // Held by nobody (the placeholder), so making it available leaves no person on an available asset.
    const backFromLoan = await addExtraAsset(db, { tag: "TEST-0909", status: "ON_LOAN", currentLocation: away });
    const newHome = `Laguna${LOCATION_SEPARATOR}TESTL`;

    await asStaff.put(`/api/assets/${atHome.tag}`, { location: "Laguna", lab: "TESTL" });
    await asStaff.put(`/api/assets/${onLoan.tag}`, { location: "Laguna", lab: "TESTL" });
    await asStaff.put(`/api/assets/${backFromLoan.tag}`, { status: "ACTIVE" });

    expect(await newestRecord(atHome.assetId)).toMatchObject({ location: newHome, current_location: newHome });
    expect(await newestRecord(onLoan.assetId)).toMatchObject({ location: newHome, current_location: away });
    expect(await newestRecord(backFromLoan.assetId)).toMatchObject({ status: "ACTIVE", location: LAB.homeLocation, current_location: LAB.homeLocation });
  });

  it("files the condition report and gives only the new record its condition (issue #74)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0910" });
    const recordBefore = await newestRecord(asset.assetId);

    const res = await asStaff.put(`/api/assets/${asset.tag}`, { assetCondition: "MINOR_DRIFT" });

    expect(res.status).toBe(200);
    expect(await db.asset_records.findUniqueOrThrow({ where: { asset_record_id: recordBefore.asset_record_id } })).toEqual(recordBefore);
    expect(await newestRecord(asset.assetId)).toMatchObject({ asset_condition: "MINOR_DRIFT", Asset_Remarks: null });
    const reports = await db.asset_reports.findMany({ where: { asset_id: asset.assetId } });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ reported_by_id: USERS.staffTsg.userId, report_condition: "MINOR_DRIFT", report_remarks: "Routine inspection verified." });
  });

  it("builds on the record with the higher id when two share a date_logged (M-09)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0911" });
    const first = await newestRecord(asset.assetId);
    const tieLocation = `Laguna${LOCATION_SEPARATOR}TEST Tie`;
    await db.asset_records.create({
      data: { ...first, asset_record_id: undefined, location: tieLocation, current_location: tieLocation, current_custodian: USERS.custodianB.userId, status: "ON_LOAN" },
    });

    await asStaff.put(`/api/assets/${asset.tag}`, { description: "Test remark on a tie" });

    expect(await newestRecord(asset.assetId)).toMatchObject({
      location: tieLocation,
      current_custodian: USERS.custodianB.userId,
      status: "ON_LOAN",
      Asset_Remarks: "Test remark on a tie",
    });
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asStaff.put("/api/assets/TEST-9999", { name: "Test Nothing" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("answers 400 for an image that is neither a data:image nor a picture file, and changes nothing", async () => {
    const res = await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { name: "Test Should Not Save", image: "https://example.test/file.exe" });

    expect(res.status).toBe(400);
    const row = await db.assets.findUniqueOrThrow({ where: { asset_id: ASSETS.available.assetId } });
    expect(row.name).toBe("Test Dev Kit Renamed");
  });
});

describe("DELETE /api/assets/:tag", () => {
  it("deletes the asset with its records, monetary row, loans, repairs, transfers, returns, and disposals", async () => {
    const assetId = ASSETS.disposed.assetId;
    await db.asset_loans.create({
      data: { asset_id: assetId, borrower_id: USERS.custodianA.userId, purpose: "Test old loan", due_date: new Date("2026-01-20"), status: "approved" },
    });
    await db.asset_repairs.create({ data: { asset_id: assetId, reported_by_id: USERS.custodianA.userId, issue_description: "Test old repair", progress_status: "Fixed & Completed" } });
    await db.asset_transfers.create({
      data: { asset_id: assetId, from_custodian_id: USERS.admin.userId, to_custodian_id: USERS.custodianA.userId, justification: "Test old transfer", status: "declined" },
    });
    await db.asset_returns.create({ data: { asset_id: assetId, returned_by_id: USERS.custodianA.userId, reference_number: "TEST-RET-DELETE" } });

    const res = await asStaff.delete(`/api/assets/${ASSETS.disposed.tag}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const where = { where: { asset_id: assetId } };
    expect({
      assets: await db.assets.count(where),
      records: await db.asset_records.count(where),
      monetary: await db.asset_monetary.count(where),
      loans: await db.asset_loans.count(where),
      repairs: await db.asset_repairs.count(where),
      transfers: await db.asset_transfers.count(where),
      returns: await db.asset_returns.count(where),
      disposals: await db.asset_disposals.count(where),
    }).toEqual({ assets: 0, records: 0, monetary: 0, loans: 0, repairs: 0, transfers: 0, returns: 0, disposals: 0 });
    expect((await asStaff.get("/api/assets")).body.assets.map((a: { id: string }) => a.id)).not.toContain(ASSETS.disposed.tag);
  });

  it("answers 409 for an asset with an inspection report, says why, and deletes nothing (issue #69)", async () => {
    const recordsBefore = await db.asset_records.count({ where: { asset_id: ASSETS.inspected.assetId } });
    const reportsBefore = await db.asset_reports.count({ where: { asset_id: ASSETS.inspected.assetId } });

    const res = await asStaff.delete(`/api/assets/${ASSETS.inspected.tag}`);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: `${ASSETS.inspected.tag} cannot be deleted because it has inspection or condition reports, which are part of its history. To take it out of use, file a disposal instead.`,
    });
    expect(await db.assets.count({ where: { asset_id: ASSETS.inspected.assetId } })).toBe(1);
    expect(await db.asset_records.count({ where: { asset_id: ASSETS.inspected.assetId } })).toBe(recordsBefore);
    expect(await db.asset_reports.count({ where: { asset_id: ASSETS.inspected.assetId } })).toBe(reportsBefore);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asStaff.delete("/api/assets/TEST-9999");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
