/**
 * Inspections and reports API: filing a condition report and the two report lists.
 * Covers POST /api/assets/:tag/inspection, GET /api/asset-reports, GET /api/asset_reports.
 * Workflow: inspection (a custodian or staff member reports an asset's condition, which is copied onto the asset).
 * Fixtures: the seeded report RPT-1 by Staff TSG on TEST-0006, the accounts (USERS). The list tests run first and
 * remove the rows they add. The write tests use their own extra assets (TEST-0501 onward, see extraAssets.ts) and
 * change no seeded row.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { ASSETS, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db } = useApiHarness();

/** What InspectionQueue sends: the signed-in reporter's email, the condition, the remarks, and one image or null. */
const inspectionBody = (extra: Record<string, unknown> = {}) => ({
  reporterEmail: USERS.staffTsg.email,
  reportCondition: "MINOR_DRIFT",
  reportRemarks: "Test inspection: loose hinge",
  reportImg: null,
  ...extra,
});

const SEEDED_REMARKS = "Test inspection: minor scuffs on the casing";

const newestRecord = (assetId: number) =>
  db.asset_records.findFirstOrThrow({ where: { asset_id: assetId }, orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }] });

/** Adds two reports newer than the seeded one, runs the check, and removes them again. */
async function withNewerReports(check: (ids: { older: number; newer: number }) => Promise<void>) {
  const older = await db.asset_reports.create({
    data: {
      asset_id: ASSETS.available.assetId,
      reported_by_id: USERS.custodianA.userId,
      report_condition: "DEGRADED",
      report_remarks: "Test report: older",
      report_img: "data:image/png;base64,TEST",
      report_date: new Date("2026-06-01T09:00:00Z"),
    },
  });
  const newer = await db.asset_reports.create({
    data: {
      asset_id: ASSETS.onLoan.assetId,
      reported_by_id: USERS.custodianB.userId,
      report_condition: "PERFECT",
      report_remarks: "Test report: newer",
      report_date: new Date("2026-06-02T09:00:00Z"),
    },
  });
  try {
    await check({ older: older.report_id, newer: newer.report_id });
  } finally {
    await db.asset_reports.deleteMany({ where: { report_id: { in: [older.report_id, newer.report_id] } } });
  }
}

describe("GET /api/asset-reports", () => {
  it("lists the seeded report with the fields the inspection log reads", async () => {
    const res = await api.get("/api/asset-reports");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reports).toHaveLength(1);
    expect(res.body.reports[0]).toMatchObject({
      reportId: SEEDED_ROWS.reportId,
      assetId: ASSETS.inspected.tag,
      assetName: ASSETS.inspected.name,
      reportedBy: USERS.staffTsg.fullName,
      reportCondition: "OPERATIONAL",
      reportRemarks: SEEDED_REMARKS,
      reportImg: null,
    });
    expect(typeof res.body.reports[0].reportDate).toBe("string");
  });

  it("includes the reporter's email, for any caller (known issue, 01C 4.2)", async () => {
    const res = await api.get("/api/asset-reports");

    expect(res.body.reports[0].reporterEmail).toBe(USERS.staffTsg.email);
  });

  it("lists reports newest first, with the image", async () => {
    await withNewerReports(async ({ older, newer }) => {
      const res = await api.get("/api/asset-reports");

      expect(res.body.reports.map((r: { reportId: number }) => r.reportId)).toEqual([newer, older, SEEDED_ROWS.reportId]);
      expect(res.body.reports[1]).toMatchObject({ assetId: ASSETS.available.tag, reportedBy: USERS.custodianA.fullName, reportImg: "data:image/png;base64,TEST" });
    });
  });
});

describe("GET /api/asset_reports", () => {
  it("lists the seeded report in the short shape, with no email and no image (L-07)", async () => {
    const res = await api.get("/api/asset_reports");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reports).toHaveLength(1);
    expect(res.body.reports[0]).toMatchObject({
      id: SEEDED_ROWS.reportId,
      report_id: SEEDED_ROWS.reportId,
      reportId: `RPT-${SEEDED_ROWS.reportId}`,
      asset_id: ASSETS.inspected.assetId,
      asset_tag: ASSETS.inspected.tag,
      assetName: ASSETS.inspected.name,
      reported_by_id: USERS.staffTsg.userId,
      reportedBy: USERS.staffTsg.fullName,
      condition: "OPERATIONAL",
      remarks: SEEDED_REMARKS,
    });
    expect(typeof res.body.reports[0].reportDate).toBe("string");
    expect(res.body.reports[0].reporterEmail).toBeUndefined();
    expect(res.body.reports[0].reportImg).toBeUndefined();
  });

  it("lists reports newest first", async () => {
    await withNewerReports(async ({ older, newer }) => {
      const res = await api.get("/api/asset_reports");

      expect(res.body.reports.map((r: { id: number }) => r.id)).toEqual([newer, older, SEEDED_ROWS.reportId]);
    });
  });
});

describe("POST /api/assets/:tag/inspection", () => {
  it("files a report under the reporter found by email, with the condition and remarks sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0501" });

    const res = await api.post(`/api/assets/${asset.tag}/inspection`, inspectionBody());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report).toMatchObject({
      asset_id: asset.assetId,
      reported_by_id: USERS.staffTsg.userId,
      report_condition: "MINOR_DRIFT",
      report_remarks: "Test inspection: loose hinge",
      report_img: null,
    });
    expect(await db.asset_reports.count({ where: { asset_id: asset.assetId } })).toBe(1);
  });

  it("writes the condition and remarks into the newest record in place instead of adding one (known defect H-14)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0502", custodianId: USERS.custodianA.userId });
    const before = await newestRecord(asset.assetId);

    await api.post(`/api/assets/${asset.tag}/inspection`, inspectionBody());

    expect(await db.asset_records.count({ where: { asset_id: asset.assetId } })).toBe(1);
    const after = await newestRecord(asset.assetId);
    expect(after).toMatchObject({
      asset_record_id: before.asset_record_id,
      status: "ACTIVE",
      current_custodian: USERS.custodianA.userId,
      asset_condition: "MINOR_DRIFT",
      Asset_Remarks: "Test inspection: loose hinge",
    });
    expect(after.date_logged).toEqual(before.date_logged);
  });

  it("takes the reporter from reportedById when no email is sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0503" });

    const res = await api.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ reporterEmail: undefined, reportedById: USERS.custodianB.userId }));

    expect(res.body.report.reported_by_id).toBe(USERS.custodianB.userId);
  });

  it.each([
    { reporter: { reporterEmail: undefined }, case: "no reporter", tag: "TEST-0504" },
    { reporter: { reporterEmail: "nobody@example.test" }, case: "an email that matches nobody", tag: "TEST-0505" },
    { reporter: { reporterEmail: "nobody@example.test", reportedById: USERS.custodianB.userId }, case: "an unknown email even with reportedById", tag: "TEST-0506" },
  ])("files the report under user 1 for $case (known defect H-10)", async ({ reporter, tag }) => {
    const asset = await addExtraAsset(db, { tag });

    const res = await api.post(`/api/assets/${asset.tag}/inspection`, inspectionBody(reporter));

    expect(res.status).toBe(200);
    expect(res.body.report.reported_by_id).toBe(USERS.admin.userId);
  });

  it("answers 500 with the raw database error for a reportedById that is no account, and writes nothing (known defect H-16)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0507", condition: "PERFECT" });

    const res = await api.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ reporterEmail: undefined, reportedById: 9999 }));

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/tx\.asset_reports\.create/);
    expect(res.body.error).toMatch(/Foreign key constraint violated/);
    expect(await db.asset_reports.count({ where: { asset_id: asset.assetId } })).toBe(0);
    expect((await newestRecord(asset.assetId)).asset_condition).toBe("PERFECT");
  });

  it.each([
    { sent: "Perfect", stored: "PERFECT", tag: "TEST-0511" },
    { sent: "Operational", stored: "OPERATIONAL", tag: "TEST-0512" },
    { sent: "Minor Drift", stored: "MINOR_DRIFT", tag: "TEST-0513" },
    { sent: "Degraded Performance", stored: "DEGRADED", tag: "TEST-0514" },
    { sent: "Critical Defect", stored: "CRITICAL_DEFECT", tag: "TEST-0515" },
    { sent: "CRITICAL_DEFECT", stored: "CRITICAL_DEFECT", tag: "TEST-0516" },
  ])("maps the condition '$sent' to $stored on the report and the record", async ({ sent, stored, tag }) => {
    const asset = await addExtraAsset(db, { tag, condition: "OPERATIONAL" });

    const res = await api.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ reportCondition: sent }));

    expect(res.body.report.report_condition).toBe(stored);
    expect((await newestRecord(asset.assetId)).asset_condition).toBe(stored);
  });

  it.each([
    { sent: "Broken", case: "a condition it does not know", tag: "TEST-0521" },
    { sent: "degraded", case: "a condition in lower case", tag: "TEST-0522" },
    { sent: "MINOR DRIFT", case: "the stored spelling with a space", tag: "TEST-0523" },
    { sent: undefined, case: "no condition", tag: "TEST-0524" },
  ])("stores PERFECT for $case, overwriting the asset's condition", async ({ sent, tag }) => {
    const asset = await addExtraAsset(db, { tag, condition: "DEGRADED" });

    const res = await api.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ reportCondition: sent }));

    expect(res.status).toBe(200);
    expect(res.body.report.report_condition).toBe("PERFECT");
    expect((await newestRecord(asset.assetId)).asset_condition).toBe("PERFECT");
  });

  it("takes assetCondition when no reportCondition is sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0525" });

    const res = await api.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ reportCondition: undefined, assetCondition: "DEGRADED" }));

    expect(res.body.report.report_condition).toBe("DEGRADED");
  });

  it("writes the default remarks when none are sent", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0531", remarks: "Test earlier remark" });

    const res = await api.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ reportRemarks: undefined }));

    expect(res.body.report.report_remarks).toBe("Routine technical inspection completed.");
    expect((await newestRecord(asset.assetId)).Asset_Remarks).toBe("Routine technical inspection completed.");
  });

  it("cuts remarks longer than 255 characters to 255, on the report and the record", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0532" });
    const longRemarks = "Test long remark. ".repeat(20);

    const res = await api.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ reportRemarks: longRemarks }));

    expect(res.status).toBe(200);
    expect(res.body.report.report_remarks).toBe(longRemarks.slice(0, 255));
    expect((await newestRecord(asset.assetId)).Asset_Remarks).toBe(longRemarks.slice(0, 255));
  });

  it("stores the image text as sent, with no check that it is an image (unlike asset edits)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0533" });

    const res = await api.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ reportImg: "not an image" }));

    expect(res.status).toBe(200);
    expect(res.body.report.report_img).toBe("not an image");
  });

  it("looks a numeric tag up as an asset id", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0541" });

    const res = await api.post(`/api/assets/${asset.assetId}/inspection`, inspectionBody());

    expect(res.status).toBe(200);
    expect(res.body.report.asset_id).toBe(asset.assetId);
  });

  it("gives an asset with no records a first ACTIVE record at 'DLSU Campus' under the reporter", async () => {
    const asset = await db.assets.create({ data: { asset_tag: "TEST-0542", name: "Test Asset Without Records", category: "DEV_KIT" } });

    const res = await api.post(`/api/assets/${asset.asset_tag}/inspection`, inspectionBody());

    expect(res.status).toBe(200);
    const records = await db.asset_records.findMany({ where: { asset_id: asset.asset_id } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      status: "ACTIVE",
      asset_condition: "MINOR_DRIFT",
      location: "DLSU Campus",
      current_location: null,
      current_custodian: USERS.staffTsg.userId,
      Asset_Remarks: "Test inspection: loose hinge",
    });
  });

  it("answers 404 for an unknown tag, and writes nothing", async () => {
    const before = await db.asset_reports.count();

    const res = await api.post("/api/assets/TEST-9999/inspection", inspectionBody());

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(await db.asset_reports.count()).toBe(before);
  });
});
