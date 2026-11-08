/**
 * Assets API: the asset list and search, history, registration, edit, and delete.
 * Covers GET /api/assets, GET /api/assets/:tag/history, POST /api/assets, PUT /api/assets/:tag,
 * DELETE /api/assets/:tag. Workflow: asset registry (intake, edit, delete) and the asset detail screens.
 * Fixtures: the six seeded assets (ASSETS) and their loans, repair, disposal, and report; the seeded accounts (USERS)
 * and lookups (LOOKUPS). The read tests run first; the write tests add assets TEST-0007 onward, edit TEST-0001, and add
 * assets TEST-0901 onward (addExtraAsset) and the labs TESTL and a project.
 */
import { describe, expect, it } from "vitest";
import { ASSETS, FUNDING_SOURCE, LAB, LOOKUPS, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";
import { addExtraAsset, removeExtraAssets } from "../setup/extraAssets";
import { USEFUL_LIFE_YEARS, presentValue } from "../../shared/constants/usefulLife";
import { serverToday } from "../../server/shared/services/assetState";

const { db, as } = useApiHarness();
const asStaff = as(USERS.staffTsg);

const DAY_MS = 24 * 60 * 60 * 1000;

async function listedAsset(tag: string) {
  const res = await asStaff.get("/api/assets");
  expect(res.status).toBe(200);
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

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
      usefulLifeYears: USEFUL_LIFE_YEARS.DEV_KIT,
      presentValue: presentValue(ASSETS.available.acquisitionValue, "2025-06-01", USEFUL_LIFE_YEARS.DEV_KIT, serverToday()),
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

  it("gives a retired asset no current location and its disposal details: the reason as written and the pathway's label (M-13 fixed)", async () => {
    const listed = await listedAsset(ASSETS.disposed.tag);

    expect(listed.status).toBe("RETIRED");
    expect(listed.currentLocation).toBeNull();
    expect(listed.disposalId).toBe(`DISP-${SEEDED_ROWS.disposalId}`);
    expect(listed.disposalDetails).toMatchObject({
      lastCustodian: "No Custodian",
      disposalPathway: "Recycle",
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
    expect(listed).toMatchObject({ cost: ASSETS.inspected.acquisitionValue, funding: FUNDING_SOURCE });
    expect(listed).not.toHaveProperty("asset_monetary");
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
    serialNumber: "TEST-SN-NEW",
    manufacturer: "Test Manufacturer",
    centerId: LAB.centerId,
    homeRoom: "Test Room 9",
    fundingSourceId: LOOKUPS.fundingSources[1].fundingSourceId,
    acquisitionValue: 12345.5,
    accessories: "Test charger, test strap",
    initialInspection: { condition: "OPERATIONAL", healthScore: 80, remarks: "Test intake remark" },
    ...extra,
  });

  it("registers the asset under the next free tag for the lab, Available, with its Initial inspection and a log row", async () => {
    const res = await asStaff.post("/api/assets", intake());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.asset).toMatchObject({
      tag: "TEST-0007",
      name: "Test Intake Camera",
      category: "CAMERA",
      serialNumber: "TEST-SN-NEW",
      status: "AVAILABLE",
      homeLab: { centerId: LAB.centerId },
      homeRoom: "Test Room 9",
      currentLocation: `${LAB.shortCode}, Test Room 9`,
      fundingSource: { fundingSourceId: LOOKUPS.fundingSources[1].fundingSourceId },
      acquisitionValue: 12345.5,
      accessories: "Test charger, test strap",
      condition: "OPERATIONAL",
      healthScore: 80,
      holder: null,
    });

    const assetId = res.body.asset.assetId;
    const inspections = await db.asset_inspections.findMany({ where: { asset_id: assetId } });
    expect(inspections).toHaveLength(1);
    expect(inspections[0]).toMatchObject({ type: "INITIAL", condition: "OPERATIONAL", health_score: 80, inspected_by_id: USERS.staffTsg.userId, remarks: "Test intake remark" });
    expect(await db.activity_log.findMany({ where: { asset_id: assetId }, select: { event_type: true, actor_id: true, details: true } })).toEqual([
      { event_type: "ASSET_REGISTERED", actor_id: USERS.staffTsg.userId, details: "TEST-0007" },
    ]);
  });

  it("stores no funding source when none is sent, and answers 400 for a lab, project, or funding source that does not exist", async () => {
    const none = await asStaff.post("/api/assets", intake({ fundingSourceId: null }));
    expect(none.body.asset.fundingSource).toBeNull();

    const before = await db.assets.count();
    for (const [field, error] of [
      ["centerId", "Pick a home lab from the list."],
      ["projectId", "Pick a project from the list."],
      ["fundingSourceId", "Pick a funding source from the list."],
    ]) {
      const res = await asStaff.post("/api/assets", intake({ [field]: 9999 }));

      expect(res.status, field).toBe(400);
      expect(res.body.error).toBe(error);
    }
    expect(await db.assets.count()).toBe(before);
  });

  it("normalizes the spelling of a category, and answers 400 for one that is not a category", async () => {
    const spaced = await asStaff.post("/api/assets", intake({ category: "video camera" }));
    const unknown = await asStaff.post("/api/assets", intake({ category: "Test Unknown Category" }));

    expect(spaced.body.asset.category).toBe("VIDEO_CAMERA");
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe("Pick a category from the list.");
  });

  it.each([
    { field: "initialInspection", value: undefined, error: "Missing required field: initialInspection." },
    { field: "initialInspection", value: { condition: "Broken" }, error: "Pick the condition of the initialInspection from the list." },
    { field: "initialInspection", value: { condition: "PERFECT", healthScore: 101 }, error: "healthScore must be a whole number from 0 to 100." },
    { field: "centerId", value: undefined, error: "Missing required fields: name, category, centerId." },
    { field: "name", value: undefined, error: "Missing required fields: name, category, centerId." },
    { field: "category", value: undefined, error: "Missing required fields: name, category, centerId." },
  ])("answers 400 for $field $value, and writes nothing", async ({ field, value, error }) => {
    const before = await db.assets.count();

    const res = await asStaff.post("/api/assets", intake({ [field]: value }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error });
    expect(await db.assets.count()).toBe(before);
  });

  it("accepts a data:image picture", async () => {
    const res = await asStaff.post("/api/assets", intake({ imageUrl: "data:image/png;base64,iVBORw0KGgo=" }));

    expect(res.status).toBe(200);
    expect(res.body.asset.imageUrl).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("answers 400 for an image that is neither a data:image nor a picture file", async () => {
    const res = await asStaff.post("/api/assets", intake({ imageUrl: "https://example.test/file.exe" }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("refuses the Secretary and the IT Admin with 403: only TSG registers, and nothing is written", async () => {
    const before = await db.assets.count();

    for (const user of [USERS.secretary, USERS.admin, USERS.director, USERS.custodianA]) {
      const res = await as(user).post("/api/assets", intake());

      expect(res.status, user.lastName).toBe(403);
      expect(res.body.error).toBe("Your role is not allowed to do this.");
    }
    expect(await db.assets.count()).toBe(before);
  });

  it("handles concurrent registrations for the same lab by assigning distinct tags (issue #75)", async () => {
    const payloads = Array.from({ length: 5 }, (_, i) =>
      intake({ name: `Concurrent Camera ${i + 1}`, serialNumber: `TEST-SN-CONC-${i + 1}` })
    );

    const responses = await Promise.all(payloads.map(p => asStaff.post("/api/assets", p)));

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }

    const tags = responses.map(r => r.body.asset.tag);
    const uniqueTags = new Set(tags);
    expect(uniqueTags.size).toBe(5);
  });
});

describe("PUT /api/assets/:tag", () => {
  const editLog = (assetId: number) =>
    db.activity_log.findMany({ where: { asset_id: assetId, event_type: "ASSET_EDITED" }, select: { actor_id: true, details: true }, orderBy: { log_id: "asc" } });

  it("changes only the fields sent, and logs ASSET_EDITED with the actor and the changed field names", async () => {
    const res = await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { name: "Test Dev Kit Renamed", homeRoom: "Test Room 1", serialNumber: `TEST-SN-${ASSETS.available.assetId}` });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, asset: { tag: ASSETS.available.tag, name: "Test Dev Kit Renamed", homeRoom: "Test Room 1", currentLocation: `${LAB.shortCode}, Test Room 1` } });
    const row = await db.assets.findUniqueOrThrow({ where: { asset_id: ASSETS.available.assetId } });
    expect(row).toMatchObject({ name: "Test Dev Kit Renamed", home_room: "Test Room 1", serial_number: `TEST-SN-${ASSETS.available.assetId}`, category: "DEV_KIT", status: "AVAILABLE" });
    expect(await editLog(ASSETS.available.assetId)).toEqual([{ actor_id: USERS.staffTsg.userId, details: "Changed: name, home_room" }]);
  });

  it("writes no log row when nothing changes", async () => {
    const before = (await editLog(ASSETS.available.assetId)).length;

    const res = await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { name: "Test Dev Kit Renamed" });

    expect(res.status).toBe(200);
    expect(await editLog(ASSETS.available.assetId)).toHaveLength(before);
  });

  it("lets the Secretary edit master data, with one ASSET_EDITED row under the Secretary", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0910" });

    const res = await as(USERS.secretary).put(`/api/assets/${asset.tag}`, { accessories: "Test cable", tsgTag: "TEST-TSG-1", itsPropertyTag: "TEST-ITS-1" });

    expect(res.status).toBe(200);
    expect(res.body.asset).toMatchObject({ accessories: "Test cable", tsgTag: "TEST-TSG-1", itsPropertyTag: "TEST-ITS-1" });
    expect(await editLog(asset.assetId)).toEqual([{ actor_id: USERS.secretary.userId, details: "Changed: accessories, its_property_tag, tsg_tag" }]);
  });

  it.each([USERS.custodianA, USERS.labHead, USERS.director, USERS.admin])("answers 403 to $lastName, and changes nothing", async (user) => {
    const res = await as(user).put(`/api/assets/${ASSETS.available.tag}`, { name: "Test Not Allowed" });

    expect(res.status).toBe(403);
    expect((await db.assets.findUniqueOrThrow({ where: { asset_id: ASSETS.available.assetId } })).name).not.toBe("Test Not Allowed");
  });

  it.each([
    { status: "ON_LOAN" },
    { holder: { userId: 6 } },
    { custodianId: 6 },
    { location: "Laguna" },
    { currentLocation: "TSG Office" },
    { condition: "PERFECT" },
    { assetCondition: "PERFECT" },
  ])("answers 400 for a body with %o: master data only, and nothing changes", async (body) => {
    const res = await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { name: "Test Refused Rename", ...body });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Edit Asset changes master data only. Status, holder, location, and condition change through their own steps.");
    expect((await db.assets.findUniqueOrThrow({ where: { asset_id: ASSETS.available.assetId } })).name).toBe("Test Dev Kit Renamed");
  });

  it("moves the home lab, funding, project, value, and dates; an empty value clears the field", async () => {
    const laguna = await db.research_centers.create({ data: { name: "Test Laguna Lab", short_code: "TESTL", location: "LAGUNA" } });
    const project = await db.projects.create({
      data: { project_code: "TEST-PRJ-9", project_name: "Test Project", project_leader: "Test Leader", center_id: LAB.centerId, start_date: new Date("2026-01-01") },
    });
    const asset = await addExtraAsset(db, { tag: "TEST-0911", homeRoom: "Test Room 2" });

    const res = await asStaff.put(`/api/assets/${asset.tag}`, {
      centerId: laguna.center_id,
      homeRoom: "",
      projectId: project.project_id,
      fundingSourceId: LOOKUPS.fundingSources[1].fundingSourceId,
      acquisitionValue: 99999,
      procurementDate: "2025-01-15",
      warrantyExpiry: null,
    });

    expect(res.status).toBe(200);
    expect(res.body.asset).toMatchObject({
      tag: asset.tag,
      homeLab: { centerId: laguna.center_id, code: "TESTL", campus: "LAGUNA" },
      homeRoom: null,
      currentLocation: "TESTL",
      project: { projectId: project.project_id, code: "TEST-PRJ-9" },
      fundingSource: { fundingSourceId: LOOKUPS.fundingSources[1].fundingSourceId },
      acquisitionValue: 99999,
      procurementDate: "2025-01-15",
      warrantyExpiry: null,
    });
  });

  it("answers 400 for a home lab, project, or funding source that does not exist, and for a wrong value", async () => {
    for (const body of [{ centerId: 9999 }, { projectId: 9999 }, { fundingSourceId: 9999 }, { acquisitionValue: -1 }, { procurementDate: "June 1" }, { name: "" }]) {
      const res = await asStaff.put(`/api/assets/${ASSETS.available.tag}`, body);

      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it.each([
    { assetStatus: "PENDING_RETIREMENT" as const, label: "Pending Retirement", tag: "TEST-0912" },
    { assetStatus: "RETIRED" as const, label: "Retired", tag: "TEST-0913" },
  ])("answers 409 for an asset that is $label, and changes nothing", async ({ assetStatus, label, tag }) => {
    const asset = await addExtraAsset(db, { tag, assetStatus });

    const res = await asStaff.put(`/api/assets/${asset.tag}`, { name: "Test Late Rename" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`${tag} is ${label} and cannot be edited.`);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asStaff.put("/api/assets/TEST-9999", { name: "Test Nothing" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("answers 400 for an image that is neither a data:image nor a picture file, and changes nothing", async () => {
    const res = await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { imageUrl: "https://example.test/file.exe" });

    expect(res.status).toBe(400);
    expect((await db.assets.findUniqueOrThrow({ where: { asset_id: ASSETS.available.assetId } })).image_url).toBeNull();
  });

  it("the edit shows in the asset's history with the actor", async () => {
    const res = await asStaff.get(`/api/assets/${ASSETS.available.tag}/history`);

    expect(res.body.events).toContainEqual(expect.objectContaining({
      kind: "ASSET_EDITED",
      label: "Asset edited",
      actor: { userId: USERS.staffTsg.userId, name: USERS.staffTsg.fullName },
      details: "Changed: name, home_room",
    }));
  });
});

describe("DELETE /api/assets/:tag", () => {
  it("deletes a fresh registration with its Initial inspection, keeps its log rows, and logs ASSET_DELETED with the tag", async () => {
    const registered = await asStaff.post("/api/assets", {
      name: "Test Mistaken Asset",
      category: "AUDIO",
      centerId: LAB.centerId,
      initialInspection: { condition: "PERFECT" },
    });
    const { assetId, tag } = registered.body.asset;

    const res = await asStaff.delete(`/api/assets/${tag}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, deleted: tag });
    expect(await db.assets.count({ where: { asset_id: assetId } })).toBe(0);
    expect(await db.asset_inspections.count({ where: { asset_id: assetId } })).toBe(0);
    const logs = await db.activity_log.findMany({ where: { details: tag }, select: { event_type: true, asset_id: true, actor_id: true }, orderBy: { log_id: "asc" } });
    expect(logs).toEqual([
      { event_type: "ASSET_REGISTERED", asset_id: null, actor_id: USERS.staffTsg.userId },
      { event_type: "ASSET_DELETED", asset_id: null, actor_id: USERS.staffTsg.userId },
    ]);
    expect((await asStaff.get("/api/assets")).body.assets.map((a: { id: string }) => a.id)).not.toContain(tag);
  });

  it.each([
    { history: "a loan", tag: ASSETS.pendingLoan.tag },
    { history: "a maintenance ticket", tag: ASSETS.inRepair.tag },
    { history: "a retirement", tag: ASSETS.disposed.tag },
    { history: "a routine inspection", tag: ASSETS.inspected.tag },
  ])("answers 409 for an asset with $history, says why, and deletes nothing (issue #69)", async ({ tag }) => {
    const before = await db.assets.count();

    const res = await asStaff.delete(`/api/assets/${tag}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`${tag} cannot be deleted because it has history (loans, maintenance, a retirement, inspections, or remarks). To take it out of use, request its retirement instead.`);
    expect(await db.assets.count()).toBe(before);
  });

  it("answers 409 for an asset whose only history is a remark, even a deleted one (issue #169)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-1691" });
    try {
      const added = await asStaff.post(`/api/assets/${asset.tag}/remarks`, { text: "A remark" });
      expect((await asStaff.delete(`/api/assets/${asset.tag}/remarks/${added.body.remark.remarkId}`)).status).toBe(200);

      const res = await asStaff.delete(`/api/assets/${asset.tag}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe(`${asset.tag} cannot be deleted because it has history (loans, maintenance, a retirement, inspections, or remarks). To take it out of use, request its retirement instead.`);
      expect(await db.assets.count({ where: { asset_id: asset.assetId } })).toBe(1);
    } finally {
      await removeExtraAssets(db, [asset.assetId]);
    }
  });

  it("answers 403 to the Secretary and the IT Admin: only TSG deletes", async () => {
    for (const user of [USERS.secretary, USERS.admin]) {
      expect((await as(user).delete(`/api/assets/${ASSETS.available.tag}`)).status).toBe(403);
    }
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await asStaff.delete("/api/assets/TEST-9999");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
