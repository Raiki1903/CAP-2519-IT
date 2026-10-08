/**
 * Assets API: the asset list, custodian history, registration, edit, and delete.
 * Covers GET /api/assets, GET /api/assets/:tag/custodian-history, POST /api/assets, PUT /api/assets/:tag,
 * DELETE /api/assets/:tag. Workflow: asset registry (intake, edit, delete) and the asset detail screens.
 * Fixtures: the six seeded assets (ASSETS) and their records, loans, repair, disposal, and report; the seeded
 * accounts (USERS). The read tests run first; the write tests add assets TEST-0007 onward and CITe4D-0001, edit
 * TEST-0001, TEST-0003, and TEST-0005, and delete TEST-0004.
 */
import { describe, expect, it } from "vitest";
import { ASSETS, FUNDING_SOURCE, LAB, LOCATION_SEPARATOR, SEEDED_ROWS, TSG_OFFICE_LOCATION, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db } = useApiHarness();

const DAY_MS = 24 * 60 * 60 * 1000;

async function listedAsset(tag: string) {
  const res = await api.get("/api/assets");
  expect(res.status).toBe(200);
  return res.body.assets.find((a: { id: string }) => a.id === tag);
}

const newestRecord = (assetId: number) =>
  db.asset_records.findFirstOrThrow({ where: { asset_id: assetId }, orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }] });

describe("GET /api/assets", () => {
  it("answers one entry per asset with the fields the screens read", async () => {
    const res = await api.get("/api/assets");

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
      custodian: USERS.admin.fullName,
      condition: 100,
      assetCondition: "PERFECT",
      cost: ASSETS.available.acquisitionValue,
      funding: FUNDING_SOURCE,
      serial: `TEST-SN-${ASSETS.available.assetId}`,
      procured: "2025-06-01",
      warranty: "2027-06-01",
    });
  });

  it("shows each seeded asset in its seeded state", async () => {
    const res = await api.get("/api/assets");

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
      lastCustodian: USERS.admin.fullName,
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
    const res = await api.get(`/api/assets/${ASSETS.onLoan.tag}/custodian-history`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, assetTag: ASSETS.onLoan.tag, assetName: ASSETS.onLoan.name, historyCount: 2 });
    expect(res.body.custodianHistory).toMatchObject([
      {
        sequence: 1,
        custodianName: USERS.admin.fullName,
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
  });

  it("includes each custodian's email and id number (known defect, 01C 4.2)", async () => {
    const res = await api.get(`/api/assets/${ASSETS.onLoan.tag}/custodian-history`);

    expect(res.body.custodianHistory[1]).toMatchObject({ custodianEmail: USERS.custodianA.email, custodianId: USERS.custodianA.idNumber });
  });

  it("looks a numeric tag up as an asset id", async () => {
    const res = await api.get(`/api/assets/${ASSETS.onLoan.assetId}/custodian-history`);

    expect(res.status).toBe(200);
    expect(res.body.assetTag).toBe(ASSETS.onLoan.tag);
  });

  it("invents a first entry for an asset with no records (H-09 family)", async () => {
    const bare = await db.assets.create({ data: { asset_tag: "TEST-9001", name: "Test Asset With No Records", category: "AUDIO" } });
    try {
      const res = await api.get("/api/assets/TEST-9001/custodian-history");

      expect(res.status).toBe(200);
      expect(res.body.custodianHistory).toMatchObject([
        { sequence: 1, custodianName: "Equipment Custodian", custodianEmail: "custodian@dlsu.edu.ph", status: "ACTIVE", location: "DLSU Campus", isCurrent: true },
      ]);
    } finally {
      await db.assets.delete({ where: { asset_id: bare.asset_id } });
    }
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await api.get("/api/assets/TEST-9999/custodian-history");

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
    const res = await api.post("/api/assets", intake({ remarks: "Test intake remark" }));

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

  it("files the new asset under user 1 when no custodian id is sent (known defect H-10)", async () => {
    const res = await api.post("/api/assets", intake());

    const record = await newestRecord(res.body.asset.asset_id);
    expect(record.current_custodian).toBe(USERS.admin.userId);
  });

  it("files the new asset under the custodian id when one is sent", async () => {
    const res = await api.post("/api/assets", intake({ custodianId: USERS.custodianB.userId }));

    const record = await newestRecord(res.body.asset.asset_id);
    expect(record.current_custodian).toBe(USERS.custodianB.userId);
  });

  it("normalizes a category name and stores an unknown category as DEV_KIT", async () => {
    const spaced = await api.post("/api/assets", intake({ category: "video camera" }));
    const unknown = await api.post("/api/assets", intake({ category: "Test Unknown Category" }));

    expect(spaced.body.asset.category).toBe("VIDEO_CAMERA");
    expect(unknown.body.asset.category).toBe("DEV_KIT");
  });

  it("uses the CITe4D tag prefix and location Unassigned when no lab or location is sent", async () => {
    const res = await api.post("/api/assets", { name: "Test Unplaced Asset", category: "AUDIO" });

    expect(res.status).toBe(200);
    expect(res.body.asset.asset_tag).toBe("CITe4D-0001");
    const record = await newestRecord(res.body.asset.asset_id);
    expect(record.location).toBe("Unassigned");
    const monetary = await db.asset_monetary.findUniqueOrThrow({ where: { asset_id: res.body.asset.asset_id } });
    expect(monetary.funding_source).toBe("Unspecified");
    expect(Number(monetary.acquisition_value)).toBe(0);
  });

  it("accepts a data:image picture", async () => {
    const res = await api.post("/api/assets", intake({ image: "data:image/png;base64,iVBORw0KGgo=" }));

    expect(res.status).toBe(200);
    expect(res.body.asset.image_url).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("answers 400 without a name or a category, and writes nothing", async () => {
    const before = await db.assets.count();
    const noName = await api.post("/api/assets", intake({ name: undefined }));
    const noCategory = await api.post("/api/assets", intake({ category: undefined }));

    expect(noName.status).toBe(400);
    expect(noCategory.status).toBe(400);
    expect(await db.assets.count()).toBe(before);
  });

  it("answers 400 for an image that is neither a data:image nor a picture file", async () => {
    const res = await api.post("/api/assets", intake({ image: "https://example.test/file.exe" }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("PUT /api/assets/:tag", () => {
  it("changes only the fields sent", async () => {
    const recordBefore = await newestRecord(ASSETS.available.assetId);

    const res = await api.put(`/api/assets/${ASSETS.available.tag}`, { name: "Test Dev Kit Renamed" });

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

  it("rewrites the newest record in place instead of adding one (known defect H-14)", async () => {
    const countBefore = await db.asset_records.count({ where: { asset_id: ASSETS.pendingLoan.assetId } });
    const recordBefore = await newestRecord(ASSETS.pendingLoan.assetId);

    await api.put(`/api/assets/${ASSETS.pendingLoan.tag}`, { location: "Laguna", lab: "TESTL" });

    expect(await db.asset_records.count({ where: { asset_id: ASSETS.pendingLoan.assetId } })).toBe(countBefore);
    const recordAfter = await newestRecord(ASSETS.pendingLoan.assetId);
    expect(recordAfter.asset_record_id).toBe(recordBefore.asset_record_id);
    expect(recordAfter.location).toBe(`Laguna${LOCATION_SEPARATOR}TESTL`);
  });

  it("finds the custodian by typed name and files the remark as a report under them", async () => {
    const res = await api.put(`/api/assets/${ASSETS.pendingLoan.tag}`, {
      custodian: USERS.custodianB.fullName,
      remarks: "Test edit remark",
      assetCondition: "MINOR_DRIFT",
    });

    expect(res.status).toBe(200);
    const record = await newestRecord(ASSETS.pendingLoan.assetId);
    expect(record).toMatchObject({ current_custodian: USERS.custodianB.userId, asset_condition: "MINOR_DRIFT", Asset_Remarks: "Test edit remark" });
    const reports = await db.asset_reports.findMany({ where: { asset_id: ASSETS.pendingLoan.assetId } });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ reported_by_id: USERS.custodianB.userId, report_condition: "MINOR_DRIFT", report_remarks: "Test edit remark" });
  });

  it("files the report under user 1 and keeps the custodian when the typed name matches nobody (known defect H-10)", async () => {
    const recordBefore = await newestRecord(ASSETS.inRepair.assetId);

    await api.put(`/api/assets/${ASSETS.inRepair.tag}`, { custodian: "Nobody Known", remarks: "Test remark from an unknown name" });

    const recordAfter = await newestRecord(ASSETS.inRepair.assetId);
    expect(recordAfter.current_custodian).toBe(recordBefore.current_custodian);
    const report = await db.asset_reports.findFirstOrThrow({ where: { asset_id: ASSETS.inRepair.assetId } });
    expect(report.reported_by_id).toBe(USERS.admin.userId);
  });

  it("ignores a new acquisition value when the asset already has one (known defect M-16)", async () => {
    await api.put(`/api/assets/${ASSETS.available.tag}`, { funding: "Test New Grant", acquisitionValue: 99999 });

    const monetary = await db.asset_monetary.findUniqueOrThrow({ where: { asset_id: ASSETS.available.assetId } });
    expect(monetary.funding_source).toBe("Test New Grant");
    expect(Number(monetary.acquisition_value)).toBe(ASSETS.available.acquisitionValue);
  });

  it("resets the funding source to Unspecified when only an acquisition value is sent (new finding, M-16 family)", async () => {
    await api.put(`/api/assets/${ASSETS.available.tag}`, { acquisitionValue: 99999 });

    const monetary = await db.asset_monetary.findUniqueOrThrow({ where: { asset_id: ASSETS.available.assetId } });
    expect(monetary.funding_source).toBe("Unspecified");
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await api.put("/api/assets/TEST-9999", { name: "Test Nothing" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("answers 400 for an image that is neither a data:image nor a picture file, and changes nothing", async () => {
    const res = await api.put(`/api/assets/${ASSETS.available.tag}`, { name: "Test Should Not Save", image: "https://example.test/file.exe" });

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

    const res = await api.delete(`/api/assets/${ASSETS.disposed.tag}`);

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
    expect((await api.get("/api/assets")).body.assets.map((a: { id: string }) => a.id)).not.toContain(ASSETS.disposed.tag);
  });

  it("cannot delete an asset that has an inspection report: answers 500 with the raw database error and deletes nothing (known defects H-03, H-16)", async () => {
    const recordsBefore = await db.asset_records.count({ where: { asset_id: ASSETS.inspected.assetId } });

    const res = await api.delete(`/api/assets/${ASSETS.inspected.tag}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/foreign key/i);
    expect(await db.assets.count({ where: { asset_id: ASSETS.inspected.assetId } })).toBe(1);
    expect(await db.asset_records.count({ where: { asset_id: ASSETS.inspected.assetId } })).toBe(recordsBefore);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await api.delete("/api/assets/TEST-9999");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
