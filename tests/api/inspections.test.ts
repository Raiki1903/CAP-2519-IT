/**
 * Inspections and reports API: filing a Routine inspection (TSG) or a Self Report (the holder), the routine queue, and
 * the two report lists.
 * Covers POST /api/assets/:tag/inspection, GET /api/inspections/routine-queue, GET /api/inspections/log, GET /api/inspections.
 * Workflow: inspection (TSG inspects an Available asset, which sets its condition; the holder reports on an asset they
 * hold, which never does).
 * Fixtures: the seeded report RPT-1 by Staff TSG on TEST-0006, the accounts (USERS). The list tests run first and
 * remove the rows they add; the queue tests run next and remove theirs. The write tests use their own extra assets
 * (TEST-0501 onward, see extraAssets.ts) and change no seeded row.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset, removeExtraAssets } from "../setup/extraAssets";
import { ASSETS, LAB, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";
import { NOT_THE_HOLDER_INSPECTION_MESSAGE } from "../../server/features/inspections/inspections.service";
import { METRIC_NOT_FOR_ASSET_MESSAGE } from "../../server/shared/services/inspections";

const { db, as } = useApiHarness();
const asCustodian = as(USERS.custodianA);
const asStaff = as(USERS.staffTsg);

const DAY_MS = 24 * 60 * 60 * 1000;

/** An extra asset Custodian A holds (On Loan), so their Self Report is accepted. */
const heldByCustodian = (tag: string, extra: Partial<Parameters<typeof addExtraAsset>[1]> = {}) =>
  addExtraAsset(db, { tag, status: "ON_LOAN", custodianId: USERS.custodianA.userId, ...extra });

/** What InspectionQueue sends: the condition, the remarks, and one photo or null. */
const inspectionBody = (extra: Record<string, unknown> = {}) => ({
  condition: "MINOR_DRIFT",
  remarks: "Test inspection: loose hinge",
  photo: null,
  ...extra,
});

const SEEDED_REMARKS = "Test inspection: minor scuffs on the casing";

/** The asset's condition now, as the asset list works it out. */
async function conditionNow(tag: string) {
  const res = await asStaff.get("/api/assets");
  return res.body.assets.find((a: { tag: string }) => a.tag === tag).condition;
}

/** Adds two reports newer than the seeded one, runs the check, and removes them again. */
async function withNewerReports(check: (ids: { older: number; newer: number }) => Promise<void>) {
  const older = await db.asset_inspections.create({
    data: {
      asset_id: ASSETS.available.assetId,
      inspected_by_id: USERS.custodianA.userId,
      type: "SELF_REPORT",
      condition: "DEGRADED",
      remarks: "Test report: older",
      photo: "data:image/png;base64,TEST",
      inspected_at: new Date("2026-06-01T09:00:00Z"),
    },
  });
  const newer = await db.asset_inspections.create({
    data: {
      asset_id: ASSETS.onLoan.assetId,
      inspected_by_id: USERS.custodianB.userId,
      type: "SELF_REPORT",
      condition: "PERFECT",
      remarks: "Test report: newer",
      inspected_at: new Date("2026-06-02T09:00:00Z"),
    },
  });
  try {
    await check({ older: older.inspection_id, newer: newer.inspection_id });
  } finally {
    await db.asset_inspections.deleteMany({ where: { inspection_id: { in: [older.inspection_id, newer.inspection_id] } } });
  }
}

describe("GET /api/inspections/log", () => {
  it("lists the seeded report with the fields the inspection log reads", async () => {
    const res = await asStaff.get("/api/inspections/log");

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
    const res = await asStaff.get("/api/inspections/log");

    expect(res.body.reports[0].reporterEmail).toBe(USERS.staffTsg.email);
  });

  it("lists reports newest first, with the image", async () => {
    await withNewerReports(async ({ older, newer }) => {
      const res = await asStaff.get("/api/inspections/log");

      expect(res.body.reports.map((r: { reportId: number }) => r.reportId)).toEqual([newer, older, SEEDED_ROWS.reportId]);
      expect(res.body.reports[1]).toMatchObject({ assetId: ASSETS.available.tag, reportedBy: USERS.custodianA.fullName, reportImg: "data:image/png;base64,TEST" });
    });
  });
});

describe("GET /api/inspections", () => {
  it("lists the seeded report in the short shape, with no email and no image (L-07)", async () => {
    const res = await asStaff.get("/api/inspections");

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
      const res = await asStaff.get("/api/inspections");

      expect(res.body.reports.map((r: { id: number }) => r.id)).toEqual([newer, older, SEEDED_ROWS.reportId]);
    });
  });
});

describe("GET /api/inspections/routine-queue", () => {
  /** A Routine inspection by TSG on the asset, `daysAgo` days ago. */
  const inspectedDaysAgo = (assetId: number, daysAgo: number) => db.asset_inspections.create({
    data: { asset_id: assetId, inspected_by_id: USERS.staffTsg.userId, type: "ROUTINE", condition: "OPERATIONAL", inspected_at: new Date(Date.now() - daysAgo * DAY_MS) },
  });

  type Group = { group: string; name: string; labs: string[]; assets: { asset: { tag: string }; lastTsgInspectionAt: string | null }[] };
  const queue = async (query = "") => {
    const res = await asStaff.get(`/api/inspections/routine-queue${query}`);
    expect(res.status).toBe(200);
    return res.body.groups as Group[];
  };
  const tagsOf = (groups: Group[], id: string) => groups.find(g => g.group === id)!.assets.map(e => e.asset.tag);

  it("lists the Available assets TSG never inspected or last inspected more than 90 days ago, oldest first, and no asset that is out, in repair or retired", async () => {
    const recent = await addExtraAsset(db, { tag: "TEST-0451" });
    await inspectedDaysAgo(recent.assetId, 10);
    const old = await addExtraAsset(db, { tag: "TEST-0452" });
    await inspectedDaysAgo(old.assetId, 120);
    const selfOnly = await addExtraAsset(db, { tag: "TEST-0453" });
    await db.asset_inspections.create({ data: { asset_id: selfOnly.assetId, inspected_by_id: USERS.custodianA.userId, type: "SELF_REPORT", condition: "PERFECT", inspected_at: new Date() } });
    const out = await Promise.all([
      addExtraAsset(db, { tag: "TEST-0454", status: "ON_LOAN", custodianId: USERS.custodianA.userId }),
      addExtraAsset(db, { tag: "TEST-0455", status: "MAINTENANCE" }),
      addExtraAsset(db, { tag: "TEST-0456", assetStatus: "PENDING_RETIREMENT" }),
      addExtraAsset(db, { tag: "TEST-0457", status: "DISPOSED" }),
      addExtraAsset(db, { tag: "TEST-0458", assetStatus: "MISSING" }),
    ]);
    try {
      const groups = await queue();

      expect(groups.map(g => g.group)).toEqual(["A", "B", "C", "D", "Other"]);
      // Never inspected first (by asset id: the seeded ones, then the one with only a Self Report), then oldest.
      expect(tagsOf(groups, "Other")).toEqual([ASSETS.available.tag, ASSETS.pendingLoan.tag, "TEST-0453", ASSETS.inspected.tag, "TEST-0452"]);
      const other = groups.find(g => g.group === "Other")!;
      expect(other.labs).toEqual([LAB.shortCode]);
      expect(other.assets[0].lastTsgInspectionAt).toBeNull();
      expect(other.assets[0].asset).toMatchObject({ tag: ASSETS.available.tag, status: "AVAILABLE", statusLabel: "Available", homeLab: { code: LAB.shortCode } });
      expect(typeof other.assets[3].lastTsgInspectionAt).toBe("string");
    } finally {
      await removeExtraAssets(db, [recent.assetId, old.assetId, selfOnly.assetId, ...out.map(a => a.assetId)]);
    }
  });

  it("takes the period from days, and the lab from centerId", async () => {
    const old = await addExtraAsset(db, { tag: "TEST-0461" });
    await inspectedDaysAgo(old.assetId, 120);
    try {
      expect(tagsOf(await queue("?days=180"), "Other")).not.toContain("TEST-0461");
      expect(tagsOf(await queue("?days=30"), "Other")).toContain("TEST-0461");
      expect(tagsOf(await queue(`?centerId=${LAB.centerId + 1000}`), "Other")).toEqual([]);
      expect(tagsOf(await queue(`?centerId=${LAB.centerId}`), "Other")).toContain("TEST-0461");
    } finally {
      await removeExtraAssets(db, [old.assetId]);
    }
  });

  it("puts a lab's assets in the lab's inspection group", async () => {
    const car = await db.research_centers.create({ data: { name: "Test Lab CAR", short_code: "CAR", location: "MANILA" } });
    const asset = await addExtraAsset(db, { tag: "CAR-0001", centerId: car.center_id });
    try {
      const groups = await queue();

      expect(tagsOf(groups, "A")).toEqual(["CAR-0001"]);
      expect(groups.find(g => g.group === "A")).toMatchObject({ name: "Group A", labs: ["CITe4D", "CAR", "CNIS"] });
      expect(tagsOf(groups, "Other")).not.toContain("CAR-0001");
    } finally {
      await removeExtraAssets(db, [asset.assetId]);
      await db.research_centers.delete({ where: { center_id: car.center_id } });
    }
  });

  it.each(["abc", "0", "3651", "1.5"])("answers 400 for days=%s", async (days) => {
    const res = await asStaff.get(`/api/inspections/routine-queue?days=${days}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "days must be a whole number from 1 to 3650." });
  });
});

describe("POST /api/assets/:tag/inspection", () => {
  it("files a Self Report under the session user, whatever reporterEmail names, with the condition and remarks sent (issue #32 fixed)", async () => {
    const asset = await heldByCustodian("TEST-0501");

    const res = await asCustodian.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ reporterEmail: USERS.staffTsg.email }));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.inspection).toMatchObject({
      type: "SELF_REPORT",
      typeLabel: "Self Report",
      inspectedBy: { userId: USERS.custodianA.userId, name: USERS.custodianA.fullName },
      condition: "MINOR_DRIFT",
      conditionLabel: "Minor Drift",
      remarks: "Test inspection: loose hinge",
      photo: null,
      metrics: [],
    });
    expect(res.body.report).toBeUndefined();
    expect(await db.asset_inspections.count({ where: { asset_id: asset.assetId, inspection_id: res.body.inspection.inspectionId } })).toBe(1);
    expect(await db.asset_inspections.count({ where: { asset_id: asset.assetId } })).toBe(1);
  });

  it("a holder's Self Report never changes the asset's condition", async () => {
    const asset = await heldByCustodian("TEST-0502", { condition: "OPERATIONAL" });

    const self = await asCustodian.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ condition: "CRITICAL_DEFECT" }));

    expect(self.body.inspection.type).toBe("SELF_REPORT");
    expect(await conditionNow(asset.tag)).toBe("OPERATIONAL");
  });

  it("a TSG inspection is Routine and sets the asset's condition", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0508", condition: "OPERATIONAL" });

    const routine = await asStaff.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ condition: "DEGRADED" }));

    expect(routine.body.inspection.type).toBe("ROUTINE");
    expect(routine.body.inspection.typeLabel).toBe("Routine");
    expect(await conditionNow(asset.tag)).toBe("DEGRADED");
  });

  it("files the score, missing accessories and metrics, and flags a metric", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0509" });
    await db.assets.update({ where: { asset_id: asset.assetId }, data: { category: "TABLET" } });

    const res = await asStaff.post(`/api/assets/${asset.tag}/inspection`, {
      condition: "DEGRADED", healthScore: 40, missingAccessories: "Test charger", remarks: "Test routine round", metrics: [{ metricId: 3, value: 65 }],
    });

    expect(res.status).toBe(200);
    expect(res.body.inspection).toMatchObject({
      type: "ROUTINE", condition: "DEGRADED", healthScore: 40, missingAccessories: "Test charger", remarks: "Test routine round",
      metrics: [{ metricId: 3, metricKey: "BATTERY_CAPACITY", value: 65, flagged: true }],
    });
    expect(await db.asset_inspection_metrics.count({ where: { inspection_id: res.body.inspection.inspectionId } })).toBe(1);
    expect(await conditionNow(asset.tag)).toBe("DEGRADED");
  });

  it.each([
    { body: { condition: "Broken" }, error: "Pick the condition of the inspection from the list.", tag: "TEST-0527" },
    { body: { condition: "PERFECT", healthScore: 101 }, error: "healthScore must be a whole number from 0 to 100.", tag: "TEST-0528" },
    { body: { condition: "PERFECT", metrics: [{ metricId: 3, value: 90 }] }, error: METRIC_NOT_FOR_ASSET_MESSAGE, tag: "TEST-0529" },
  ])("answers 400 to a contract body with $error, and writes nothing", async ({ body, error, tag }) => {
    const asset = await addExtraAsset(db, { tag });

    const res = await asStaff.post(`/api/assets/${asset.tag}/inspection`, body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error });
    expect(await db.asset_inspections.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it("ignores reportedById: the report is the session user's (issue #32 fixed)", async () => {
    const asset = await heldByCustodian("TEST-0503");

    const res = await asCustodian.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ reportedById: USERS.custodianB.userId }));

    expect(res.body.inspection.inspectedBy.userId).toBe(USERS.custodianA.userId);
  });

  it.each([
    { reporter: { reporterEmail: undefined }, case: "no reporter", tag: "TEST-0504" },
    { reporter: { reporterEmail: "nobody@example.test" }, case: "an email that matches nobody", tag: "TEST-0505" },
    { reporter: { reporterEmail: "nobody@example.test", reportedById: USERS.custodianB.userId }, case: "an unknown email even with reportedById", tag: "TEST-0506" },
  ])("files the report under the session user for $case, not under user 1 (H-10 fixed)", async ({ reporter, tag }) => {
    const asset = await heldByCustodian(tag);

    const res = await asCustodian.post(`/api/assets/${asset.tag}/inspection`, inspectionBody(reporter));

    expect(res.status).toBe(200);
    expect(res.body.inspection.inspectedBy.userId).toBe(USERS.custodianA.userId);
  });

  it("ignores a reportedById that is no account, and files the report under the session user (it answered a generic 500 before 13c)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0507", condition: "PERFECT" });

    const res = await asStaff.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ reportedById: 9999 }));

    expect(res.status).toBe(200);
    expect(res.body.inspection.inspectedBy.userId).toBe(USERS.staffTsg.userId);
    expect(await db.asset_inspections.count({ where: { asset_id: asset.assetId } })).toBe(2);
    expect(await conditionNow(asset.tag)).toBe("MINOR_DRIFT");
  });

  it.each([
    { sent: "PERFECT", tag: "TEST-0511" },
    { sent: "OPERATIONAL", tag: "TEST-0512" },
    { sent: "MINOR_DRIFT", tag: "TEST-0513" },
    { sent: "DEGRADED", tag: "TEST-0514" },
    { sent: "CRITICAL_DEFECT", tag: "TEST-0515" },
  ])("stores the condition $sent on the report, and it becomes the asset's condition", async ({ sent, tag }) => {
    const asset = await addExtraAsset(db, { tag, condition: "OPERATIONAL" });

    const res = await asStaff.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ condition: sent }));

    expect(res.status).toBe(200);
    expect(res.body.inspection.condition).toBe(sent);
    expect(await conditionNow(asset.tag)).toBe(sent);
  });

  it.each([
    { sent: "Broken", case: "a condition it does not know", tag: "TEST-0521" },
    { sent: "degraded", case: "a condition in lower case", tag: "TEST-0522" },
    { sent: "MINOR DRIFT", case: "the stored spelling with a space", tag: "TEST-0523" },
    { sent: "Degraded Performance", case: "a display name", tag: "TEST-0526" },
    { sent: undefined, case: "no condition", tag: "TEST-0524" },
  ])("answers 400 for $case, and writes nothing (issue #53)", async ({ sent, tag }) => {
    const asset = await addExtraAsset(db, { tag, condition: "DEGRADED" });

    const res = await asStaff.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ condition: sent }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "Pick the condition of the inspection from the list." });
    expect(await db.asset_inspections.count({ where: { asset_id: asset.assetId } })).toBe(1);
    expect(await conditionNow(asset.tag)).toBe("DEGRADED");
  });

  it("answers 400 for remarks longer than 255 characters instead of cutting them, and writes nothing", async () => {
    const asset = await heldByCustodian("TEST-0532");

    const res = await asCustodian.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ remarks: "Test long remark. ".repeat(20) }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "remarks can be at most 255 characters." });
    expect(await db.asset_inspections.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it("stores the image text as sent, with no check that it is an image (unlike asset edits)", async () => {
    const asset = await heldByCustodian("TEST-0533");

    const res = await asCustodian.post(`/api/assets/${asset.tag}/inspection`, inspectionBody({ photo: "not an image" }));

    expect(res.status).toBe(200);
    expect(res.body.inspection.photo).toBe("not an image");
  });

  it("looks a numeric tag up as an asset id", async () => {
    const asset = await heldByCustodian("TEST-0541");

    const res = await asCustodian.post(`/api/assets/${asset.assetId}/inspection`, inspectionBody());

    expect(res.status).toBe(200);
    expect(await db.asset_inspections.count({ where: { asset_id: asset.assetId } })).toBe(1);
  });

  it("sets the condition of an asset TSG never inspected", async () => {
    const asset = await db.assets.create({ data: { asset_tag: "TEST-0542", name: "Test Asset Without Records", category: "DEV_KIT", center_id: LAB.centerId } });

    const res = await asStaff.post(`/api/assets/${asset.asset_tag}/inspection`, inspectionBody());

    expect(res.status).toBe(200);
    expect(await conditionNow(asset.asset_tag)).toBe("MINOR_DRIFT");
  });

  it.each([
    { state: { status: "DISPOSED" }, label: "Retired", tag: "TEST-0543" },
    { state: { status: "MAINTENANCE" }, label: "Maintenance", tag: "TEST-0544" },
    { state: { status: "ON_LOAN", custodianId: USERS.custodianA.userId }, label: "On Loan", tag: "TEST-0545" },
    { state: { assetStatus: "PENDING_RETIREMENT" }, label: "Pending Retirement", tag: "TEST-0546" },
    { state: { assetStatus: "MISSING" }, label: "Missing", tag: "TEST-0547" },
  ] as const)("refuses TSG a routine inspection on a $label asset with the guard's 409, and writes nothing (issue #88: repairs inspect through the maintenance steps)", async ({ state, label, tag }) => {
    const asset = await addExtraAsset(db, { tag, condition: "DEGRADED", ...state });

    const res = await asStaff.post(`/api/assets/${asset.tag}/inspection`, inspectionBody());

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: `${tag} is ${label} and cannot take a routine inspection.` });
    expect(await db.asset_inspections.count({ where: { asset_id: asset.assetId } })).toBe(1);
  });

  it("takes a Self Report while the borrower has asked to return the asset", async () => {
    const asset = await heldByCustodian("TEST-0548");
    await db.asset_loans.update({ where: { loan_id: asset.loanId! }, data: { status: "RETURN_REQUESTED", return_requested_at: new Date() } });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/inspection`, { condition: "OPERATIONAL" });

    expect(res.status).toBe(200);
    expect(res.body.inspection.type).toBe("SELF_REPORT");
  });

  it.each([
    { case: "another person's asset", options: { status: "ON_LOAN", custodianId: USERS.custodianB.userId }, tag: "TEST-0551" },
    { case: "an Available asset nobody holds", options: {}, tag: "TEST-0552" },
    { case: "an asset in maintenance", options: { status: "MAINTENANCE" }, tag: "TEST-0553" },
  ] as const)("answers 403 to a Researcher's Self Report on $case, and writes nothing", async ({ options, tag }) => {
    const asset = await addExtraAsset(db, { tag, ...options });

    const res = await asCustodian.post(`/api/assets/${asset.tag}/inspection`, { condition: "OPERATIONAL" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: NOT_THE_HOLDER_INSPECTION_MESSAGE });
    expect(await db.asset_inspections.count({ where: { asset_id: asset.assetId } })).toBe(0);
  });

  it("answers 404 for an unknown tag, and writes nothing", async () => {
    const before = await db.asset_inspections.count();

    const res = await asCustodian.post("/api/assets/TEST-9999/inspection", inspectionBody());

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(await db.asset_inspections.count()).toBe(before);
  });
});
