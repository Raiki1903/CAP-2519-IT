/**
 * Assets API: the asset list and search, history, registration, edit, and delete.
 * Covers GET /api/assets, GET /api/assets/:tag/history, POST /api/assets, PUT /api/assets/:tag,
 * DELETE /api/assets/:tag. Workflow: asset registry (intake, edit, delete) and the asset detail screens.
 * Fixtures: the six seeded assets (ASSETS) and their records, loans, repair, disposal, and report; the seeded
 * accounts (USERS). The read tests run first; the write tests add assets TEST-0007 onward and CITe4D-0001, edit
 * TEST-0001, TEST-0003, and TEST-0005, and delete TEST-0004. The edit tests also add assets TEST-0901 onward
 * (addExtraAsset), each held as the test needs.
 */
import { describe, expect, it } from "vitest";
import { ASSETS, FUNDING_SOURCE, LAB, LOCATION_SEPARATOR, LOOKUPS, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";
import { addExtraAsset, removeExtraAssets } from "../setup/extraAssets";

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
  it("answers one entry per asset with the contract fields and the older fields the screens read", async () => {
    const res = await asStaff.get("/api/assets");

    expect(res.status).toBe(200);
    expect(res.body.assets).toHaveLength(Object.keys(ASSETS).length);
    expect(await listedAsset(ASSETS.available.tag)).toMatchObject({
      assetId: ASSETS.available.assetId,
      tag: ASSETS.available.tag,
      name: ASSETS.available.name,
      category: ASSETS.available.category,
      categoryLabel: "Dev Kit",
      status: "AVAILABLE",
      statusLabel: "Available",
      homeLab: { centerId: LAB.centerId, code: LAB.shortCode, name: LAB.name, campus: "MANILA", campusLabel: "Manila" },
      homeRoom: null,
      currentLocation: LAB.shortCode,
      holder: null,
      condition: null,
      conditionLabel: null,
      healthScore: null,
      isOverdue: false,
      openLoan: null,
      fundingSource: { fundingSourceId: LOOKUPS.fundingSources[0].fundingSourceId, name: FUNDING_SOURCE },
      acquisitionValue: ASSETS.available.acquisitionValue,
      procurementDate: "2025-06-01",
      warrantyExpiry: "2027-06-01",
      id: ASSETS.available.tag,
      location: "Manila",
      lab: LAB.shortCode,
      cost: ASSETS.available.acquisitionValue,
      funding: FUNDING_SOURCE,
      serial: `TEST-SN-${ASSETS.available.assetId}`,
      procured: "2025-06-01",
      warranty: "2027-06-01",
    });
    // Nobody holds it, so no name is sent. (answer 1)
    expect((await listedAsset(ASSETS.available.tag)).custodian).toBeUndefined();
  });

  it("sends the holder's user id only for an asset someone holds through a loan (issue #32)", async () => {
    expect((await listedAsset(ASSETS.onLoan.tag)).custodianId).toBe(USERS.custodianA.userId);
    expect(await listedAsset(ASSETS.available.tag)).not.toHaveProperty("custodianId");
    // The old record of TEST-0006 names Custodian A, but no loan does, so nobody holds it.
    expect((await listedAsset(ASSETS.inspected.tag)).holder).toBeNull();
  });

  it("shows each seeded asset in its stored status", async () => {
    const res = await asStaff.get("/api/assets");

    for (const asset of Object.values(ASSETS)) {
      const listed = res.body.assets.find((a: { id: string }) => a.id === asset.tag);
      expect(listed.status, asset.tag).toBe(asset.listStatus);
    }
  });

  it("gives an asset on loan its holder, open loan, destination, borrowed date, due date, and days left", async () => {
    const listed = await listedAsset(ASSETS.onLoan.tag);

    expect(listed).toMatchObject({
      status: "ON_LOAN",
      holder: { userId: USERS.custodianA.userId, name: USERS.custodianA.fullName },
      custodian: USERS.custodianA.fullName,
      openLoan: { loanId: SEEDED_ROWS.approvedLoanId, status: "ON_LOAN" },
      currentLocation: LAB.shortCode,
    });
    expect(typeof listed.borrowedOn).toBe("string");
    expect(typeof listed.dueDate).toBe("string");
    expect(listed.daysLeft).toBe(30);
  });

  it("marks an asset whose loan is past its return-by date overdue, with negative days left; the status stays On Loan", async () => {
    const original = await db.asset_loans.findUniqueOrThrow({ where: { loan_id: SEEDED_ROWS.approvedLoanId } });
    await db.asset_loans.update({ where: { loan_id: SEEDED_ROWS.approvedLoanId }, data: { return_by: new Date(Date.now() - 2 * DAY_MS) } });
    try {
      const listed = await listedAsset(ASSETS.onLoan.tag);

      expect(listed.status).toBe("ON_LOAN");
      expect(listed.isOverdue).toBe(true);
      expect(listed.daysLeft).toBeLessThan(0);
    } finally {
      await db.asset_loans.update({ where: { loan_id: SEEDED_ROWS.approvedLoanId }, data: { return_by: original.return_by } });
    }
  });

  it("gives a pending loan as the open loan but no holder, and does not mark it overdue", async () => {
    const listed = await listedAsset(ASSETS.pendingLoan.tag);

    expect(listed).toMatchObject({ status: "AVAILABLE", holder: null, isOverdue: false, openLoan: { loanId: SEEDED_ROWS.pendingLoanId, status: "PENDING_APPROVAL" } });
  });

  it("shows an asset in maintenance at the TSG Office while its home lab stays the same", async () => {
    const listed = await listedAsset(ASSETS.inRepair.tag);

    expect(listed).toMatchObject({ status: "MAINTENANCE", location: "Manila", lab: LAB.shortCode, homeLab: { code: LAB.shortCode }, currentLocation: "TSG Office" });
  });

  it("gives a retired asset no current location and its disposal details, parsed back out of the reason text (known defect M-13)", async () => {
    const listed = await listedAsset(ASSETS.disposed.tag);

    expect(listed.status).toBe("RETIRED");
    expect(listed.currentLocation).toBeNull();
    expect(listed.disposalId).toBe(`DISP-${SEEDED_ROWS.disposalId}`);
    expect(listed.disposalDetails).toMatchObject({
      lastCustodian: "No Custodian",
      disposalPathway: "Test pathway",
      breakdownReasons: "Test breakdown: the board is burnt",
      decommissionedBy: USERS.staffTsg.fullName,
    });
    expect(typeof listed.disposalDetails.decommissionDate).toBe("string");
  });

  it("gives an asset the condition of its newest TSG inspection, and lists its inspection reports", async () => {
    const listed = await listedAsset(ASSETS.inspected.tag);

    expect(listed).toMatchObject({
      condition: "OPERATIONAL",
      conditionLabel: "Operational",
      assetCondition: "OPERATIONAL",
      remarks: "Test inspection: minor scuffs on the casing",
    });
    expect(listed.asset_reports).toHaveLength(1);
    expect(listed.asset_reports[0]).toMatchObject({
      id: SEEDED_ROWS.reportId,
      reportId: `RPT-${SEEDED_ROWS.reportId}`,
      assetId: ASSETS.inspected.tag,
      reportedBy: USERS.staffTsg.fullName,
      reporterRole: "Routine",
      condition: "OPERATIONAL",
    });
    expect(listed.asset_monetary).toMatchObject({ acquisition_value: ASSETS.inspected.acquisitionValue, funding_source: FUNDING_SOURCE });
  });

  it("ignores a newer Self Report for the condition", async () => {
    const report = await db.asset_inspections.create({
      data: { asset_id: ASSETS.inspected.assetId, inspected_by_id: USERS.custodianA.userId, type: "SELF_REPORT", condition: "CRITICAL_DEFECT", inspected_at: new Date() },
    });
    try {
      expect((await listedAsset(ASSETS.inspected.tag)).condition).toBe("OPERATIONAL");
    } finally {
      await db.asset_inspections.delete({ where: { inspection_id: report.inspection_id } });
    }
  });

  it("takes the inspection with the higher id as newest when two share an inspected_at (M-09)", async () => {
    const seeded = await db.asset_inspections.findUniqueOrThrow({ where: { inspection_id: SEEDED_ROWS.reportId } });
    const tie = await db.asset_inspections.create({
      data: { asset_id: ASSETS.inspected.assetId, inspected_by_id: USERS.staffTsg.userId, type: "ROUTINE", condition: "DEGRADED", inspected_at: seeded.inspected_at },
    });
    try {
      expect((await listedAsset(ASSETS.inspected.tag)).condition).toBe("DEGRADED");
    } finally {
      await db.asset_inspections.delete({ where: { inspection_id: tie.inspection_id } });
    }
  });

  it("searches by part of the tag, serial number, or name in any letter case, and filters by status and lab", async () => {
    const tags = async (query: string) => (await asStaff.get(`/api/assets?${query}`)).body.assets.map((a: { tag: string }) => a.tag);

    expect(await tags("q=test-0002")).toEqual([ASSETS.onLoan.tag]);
    expect(await tags("q=sn-3")).toEqual([ASSETS.inRepair.tag]);
    expect(await tags("q=PROJECTOR")).toEqual([ASSETS.inspected.tag]);
    expect(await tags("status=RETIRED")).toEqual([ASSETS.disposed.tag]);
    expect(await tags(`centerId=${LAB.centerId}&status=AVAILABLE`)).toEqual([ASSETS.available.tag, ASSETS.pendingLoan.tag, ASSETS.inspected.tag]);
    expect(await tags("q=nothing-matches")).toEqual([]);
  });

  it("answers 400 for an unknown status or a lab id that is not a number", async () => {
    expect((await asStaff.get("/api/assets?status=Active")).status).toBe(400);
    expect((await asStaff.get("/api/assets?centerId=TEST")).status).toBe(400);
  });

  it("runs the same number of queries for 6 assets as for 16: nothing is read per asset", async () => {
    // MySQL counts every statement it receives; the test database has no other client while this runs.
    const statements = async () => {
      const [row] = await db.$queryRawUnsafe<{ Value: string }[]>("SHOW GLOBAL STATUS LIKE 'Questions'");
      return Number(row.Value);
    };
    const queriesForList = async () => {
      await asStaff.get("/api/assets");
      const before = await statements();
      await asStaff.get("/api/assets");
      return (await statements()) - before;
    };

    const forSix = await queriesForList();
    const extras = [];
    for (let i = 0; i < 10; i++) {
      extras.push(await addExtraAsset(db, { tag: `TEST-08${String(i).padStart(2, "0")}`, status: "ON_LOAN", custodianId: USERS.custodianB.userId, condition: "DEGRADED" }));
    }
    try {
      expect(await queriesForList()).toBe(forSix);
    } finally {
      await removeExtraAssets(db, extras.map(e => e.assetId));
    }
  });
});

describe("GET /api/assets/:tag/history", () => {
  it("answers the asset's steps oldest first: the loan, then the inspections", async () => {
    const res = await asStaff.get(`/api/assets/${ASSETS.onLoan.tag}/history`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, assetTag: ASSETS.onLoan.tag, assetName: ASSETS.onLoan.name });
    expect(res.body.events.map((e: { kind: string }) => e.kind)).toEqual(["LOAN_REQUESTED", "LOAN_APPROVED"]);
    expect(res.body.events[0]).toMatchObject({ loanId: SEEDED_ROWS.approvedLoanId, actor: { userId: USERS.custodianA.userId, name: USERS.custodianA.fullName } });
    expect(res.body.events[1].actor).toEqual({ userId: USERS.labHead.userId, name: USERS.labHead.fullName });
  });

  it("lists a ticket's report and receipt, and a retirement's request, decision, and completion", async () => {
    const repair = await asStaff.get(`/api/assets/${ASSETS.inRepair.tag}/history`);
    const retired = await asStaff.get(`/api/assets/${ASSETS.disposed.tag}/history`);

    expect(repair.body.events.map((e: { kind: string }) => e.kind)).toEqual(["MAINTENANCE_REPORTED", "MAINTENANCE_RECEIVED"]);
    expect(retired.body.events.map((e: { kind: string }) => e.kind)).toEqual(["RETIREMENT_REQUESTED", "RETIREMENT_DECIDED", "RETIREMENT_COMPLETED"]);
  });

  it("hides other people from a Custodian, and shows their own name", async () => {
    const forOther = await as(USERS.custodianB).get(`/api/assets/${ASSETS.onLoan.tag}/history`);
    const forOwn = await as(USERS.custodianA).get(`/api/assets/${ASSETS.onLoan.tag}/history`);

    expect(forOther.body.events[0].actor).toEqual({ hidden: true });
    expect(forOwn.body.events[0].actor).toEqual({ userId: USERS.custodianA.userId, name: USERS.custodianA.fullName });
    expect(JSON.stringify(forOther.body)).not.toContain(USERS.custodianA.lastName);
  });

  it("looks a numeric tag up as an asset id", async () => {
    const res = await asStaff.get(`/api/assets/${ASSETS.onLoan.assetId}/history`);

    expect(res.status).toBe(200);
    expect(res.body.assetTag).toBe(ASSETS.onLoan.tag);
  });

  it("answers an empty list for an asset with nothing recorded", async () => {
    const bare = await db.assets.create({ data: { asset_tag: "TEST-9001", name: "Test Asset With No History", category: "AUDIO", center_id: LAB.centerId } });
    try {
      const res = await asStaff.get("/api/assets/TEST-9001/history");

      expect(res.status).toBe(200);
      expect(res.body.events).toEqual([]);
    } finally {
      await db.assets.delete({ where: { asset_id: bare.asset_id } });
    }
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asStaff.get("/api/assets/TEST-9999/history");

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
    funding: LOOKUPS.fundingSources[1].name,
    acquisitionValue: 12345.5,
    location: "Manila",
    lab: LAB.shortCode,
    ...extra,
  });

  it("registers the asset under the next free tag for the lab, Available, with its funding source and value", async () => {
    const res = await asStaff.post("/api/assets", intake({ remarks: "Test intake remark" }));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.asset).toMatchObject({ asset_tag: "TEST-0007", name: "Test Intake Camera", category: "CAMERA", serial_number: "TEST-SN-NEW" });

    const row = await db.assets.findUniqueOrThrow({ where: { asset_id: res.body.asset.asset_id } });
    expect(row).toMatchObject({ status: "AVAILABLE", center_id: LAB.centerId, funding_source_id: LOOKUPS.fundingSources[1].fundingSourceId });
    expect(Number(row.acquisition_value)).toBe(12345.5);
    expect(await db.asset_records.count({ where: { asset_id: row.asset_id } })).toBe(0);
  });

  it("stores no funding source for Unspecified or an empty one, and answers 400 for one that is not on the list", async () => {
    const unspecified = await asStaff.post("/api/assets", intake({ funding: "Unspecified" }));
    const unknown = await asStaff.post("/api/assets", intake({ funding: "Test Grant Nobody Has" }));

    expect((await db.assets.findUniqueOrThrow({ where: { asset_id: unspecified.body.asset.asset_id } })).funding_source_id).toBeNull();
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe("Pick a funding source from the list.");
  });

  it("ignores a custodian id: a new asset is held by nobody", async () => {
    const res = await asStaff.post("/api/assets", intake({ custodianId: USERS.custodianB.userId }));

    expect((await listedAsset(res.body.asset.asset_tag)).holder).toBeNull();
  });

  it("normalizes a category name and stores an unknown category as DEV_KIT", async () => {
    const spaced = await asStaff.post("/api/assets", intake({ category: "video camera" }));
    const unknown = await asStaff.post("/api/assets", intake({ category: "Test Unknown Category" }));

    expect(spaced.body.asset.category).toBe("VIDEO_CAMERA");
    expect(unknown.body.asset.category).toBe("DEV_KIT");
  });

  it("answers 400 and writes nothing when the lab is not a known research center: the asset's home lab is stored on it", async () => {
    const before = await db.assets.count();

    const res = await asStaff.post("/api/assets", { name: "Test Unplaced Asset", category: "AUDIO" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "Pick a lab from the list." });
    expect(await db.assets.count()).toBe(before);
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
    expect(await db.asset_inspections.count({ where: { asset_id: ASSETS.available.assetId } })).toBe(0);
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
    const reports = await db.asset_inspections.findMany({ where: { asset_id: ASSETS.pendingLoan.assetId } });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ inspected_by_id: USERS.staffTsg.userId, condition: "MINOR_DRIFT", remarks: "Test edit remark" });
  });

  it("answers 400 for an id that is not a Custodian account, and saves nothing (issue #95)", async () => {
    const recordsBefore = await db.asset_records.count({ where: { asset_id: ASSETS.inRepair.assetId } });
    const reportsBefore = await db.asset_inspections.count({ where: { asset_id: ASSETS.inRepair.assetId } });

    const res = await asStaff.put(`/api/assets/${ASSETS.inRepair.tag}`, { custodianId: USERS.labHead.userId, remarks: "Test remark for a Lab Head" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "Pick a custodian from the list." });
    expect(await db.asset_records.count({ where: { asset_id: ASSETS.inRepair.assetId } })).toBe(recordsBefore);
    expect(await db.asset_inspections.count({ where: { asset_id: ASSETS.inRepair.assetId } })).toBe(reportsBefore);
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

  const funding = async (assetId: number) => {
    const row = await db.assets.findUniqueOrThrow({ where: { asset_id: assetId } });
    return { fundingSourceId: row.funding_source_id, value: row.acquisition_value === null ? null : Number(row.acquisition_value) };
  };

  it("saves a new funding source and acquisition value on the asset (M-16 fixed)", async () => {
    await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { funding: LOOKUPS.fundingSources[1].name, acquisitionValue: 99999 });

    expect(await funding(ASSETS.available.assetId)).toEqual({ fundingSourceId: LOOKUPS.fundingSources[1].fundingSourceId, value: 99999 });
  });

  it("keeps the funding source when only an acquisition value is sent (M-16 fixed)", async () => {
    await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { acquisitionValue: 12345.5 });

    expect(await funding(ASSETS.available.assetId)).toEqual({ fundingSourceId: LOOKUPS.fundingSources[1].fundingSourceId, value: 12345.5 });
  });

  it("keeps the acquisition value when only a funding source is sent, and answers 400 for one not on the list", async () => {
    await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { funding: LOOKUPS.fundingSources[0].name });
    const unknown = await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { funding: "Test Grant Nobody Has" });

    expect(await funding(ASSETS.available.assetId)).toEqual({ fundingSourceId: LOOKUPS.fundingSources[0].fundingSourceId, value: 12345.5 });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe("Pick a funding source from the list.");
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
      funding: LOOKUPS.fundingSources[1].name,
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
    expect(await db.asset_inspections.count({ where: { asset_id: asset.assetId } })).toBe(0);
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
    const reports = await db.asset_inspections.findMany({ where: { asset_id: asset.assetId } });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ inspected_by_id: USERS.staffTsg.userId, condition: "MINOR_DRIFT", remarks: "Routine inspection verified." });
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
      data: { asset_id: assetId, borrower_id: USERS.custodianA.userId, purpose: "Test old loan", requested_at: new Date("2026-01-10"), return_by: new Date("2026-01-20"), status: "ON_LOAN" },
    });
    await db.asset_maintenance.create({ data: { asset_id: assetId, reported_by_id: USERS.custodianA.userId, issue_description: "Test old repair", status: "RESOLVED" } });
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
      repairs: await db.asset_maintenance.count(where),
      transfers: await db.asset_transfers.count(where),
      returns: await db.asset_returns.count(where),
      disposals: await db.asset_retirements.count(where),
    }).toEqual({ assets: 0, records: 0, monetary: 0, loans: 0, repairs: 0, transfers: 0, returns: 0, disposals: 0 });
    expect((await asStaff.get("/api/assets")).body.assets.map((a: { id: string }) => a.id)).not.toContain(ASSETS.disposed.tag);
  });

  it("answers 409 for an asset with an inspection report, says why, and deletes nothing (issue #69)", async () => {
    const recordsBefore = await db.asset_records.count({ where: { asset_id: ASSETS.inspected.assetId } });
    const reportsBefore = await db.asset_inspections.count({ where: { asset_id: ASSETS.inspected.assetId } });

    const res = await asStaff.delete(`/api/assets/${ASSETS.inspected.tag}`);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: `${ASSETS.inspected.tag} cannot be deleted because it has inspection or condition reports, which are part of its history. To take it out of use, file a disposal instead.`,
    });
    expect(await db.assets.count({ where: { asset_id: ASSETS.inspected.assetId } })).toBe(1);
    expect(await db.asset_records.count({ where: { asset_id: ASSETS.inspected.assetId } })).toBe(recordsBefore);
    expect(await db.asset_inspections.count({ where: { asset_id: ASSETS.inspected.assetId } })).toBe(reportsBefore);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asStaff.delete("/api/assets/TEST-9999");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
