/**
 * Analytics API: the five endpoints the live analytics views call, and the three kept on 2026-10-07.
 * Covers GET /api/analytics/director, /api/analytics/lab-head, /api/analytics/tsg, /api/analytics/location-status,
 * /api/analytics/advanced/inspection-progress, and (responds with 200 only) /api/analytics/advanced/idle-time,
 * /idle-frequency, /loan-recommender. Not the 22 that step 12 moves to legacy/analytics-endpoints/ (test plan, section 3).
 * Workflow: read-only dashboards (Director, Lab Head, Staff).
 * Fixtures: the whole seed, since every endpoint counts every asset: six assets with values 1000 to 6000 and funding
 * "Test Grant", the loans LOAN-1 and LOAN-2, the repair MNT-1, the approved disposal DISP-1, the report RPT-1 of
 * 2026-03-01, the research center TEST with no projects. A test that needs more (a project, an overdue loan, a
 * warranty relative to today, a record at another location) adds it with extraAssets.ts (tags TEST-0701 onward)
 * and removes it in a finally block, so every test starts from the seed. Nothing here changes a seeded row.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset, removeExtraAssets } from "../setup/extraAssets";
import { ASSETS, FUNDING_SOURCE, LAB, LOCATION_SEPARATOR, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db } = useApiHarness();

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC calendar date `days` from now, as the server prints a DATE column. */
const isoDateInDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);

/** A DATE column value `days` from today (midnight UTC), so day counts come out whole. */
const dateInDays = (days: number) => new Date(`${isoDateInDays(days)}T00:00:00Z`);

const SEEDED_PORTFOLIO_VALUE = Object.values(ASSETS).reduce((sum, a) => sum + a.acquisitionValue, 0);

/** The Director's location counts for the seed: every seeded record is in Manila, one asset per non-active state. */
const SEEDED_LOCATION_STATUS = [
  { location: "MANILA", ACTIVE: 3, ON_LOAN: 1, MAINTENANCE: 1, DISPOSED: 1, total: 6 },
  { location: "LAGUNA", ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0, total: 0 },
];

/** What the Director endpoint answers when no report falls in the range. (H-09) */
const DEMO_AUDIT_SERIES = [
  { month: "Jan 26", count: 4 },
  { month: "Feb 26", count: 8 },
  { month: "Mar 26", count: 15 },
  { month: "Apr 26", count: 12 },
  { month: "May 26", count: 20 },
  { month: "Jun 26", count: 18 },
  { month: "Jul 26", count: 25 },
];

/** The lab codes location-status checks, in its order. */
const LOCATION_STATUS_LABS = ["CITe4D", "CAR", "CeHCI", "HXIL", "GAME", "CeLT", "Bio"];

/** location-status's per-lab counts, all zero except the ones given. */
function labDistribution(counts: Record<string, { available: number; onLoan: number; underRepair: number }>) {
  return LOCATION_STATUS_LABS.map((location) => ({ location, ...(counts[location] ?? { available: 0, onLoan: 0, underRepair: 0 }) }));
}

/** A record location in the server's "Campus — Lab" form. */
const at = (campus: string, lab: string) => `${campus}${LOCATION_SEPARATOR}${lab}`;

/** Adds a project at the seeded research center. */
const addProject = () =>
  db.projects.create({
    data: {
      project_id: "TEST-PRJ-1",
      project_name: "Test Project",
      project_leader: "Test Project Leader",
      center_id: LAB.centerId,
      funding_agency: "Test Agency",
      start_date: new Date("2026-01-01"),
    },
  });

/** Adds an asset on loan to Custodian A through a loan whose due date was `daysOverdue` days ago. */
async function addOverdueLoan(tag: string, daysOverdue: number, status = "approved", projectId?: number) {
  const asset = await addExtraAsset(db, { tag, status: "ON_LOAN", custodianId: USERS.custodianA.userId, projectId });
  const loan = await db.asset_loans.create({
    data: {
      asset_id: asset.assetId,
      borrower_id: USERS.custodianA.userId,
      purpose: "Test purpose: overdue loan",
      loaned_on: new Date("2026-04-01T09:00:00Z"),
      due_date: dateInDays(-daysOverdue),
      status,
    },
  });
  return { asset, loan };
}

const labHead = (query: string) => api.get(`/api/analytics/lab-head?${query}`);

/** The query every Lab Head widget sends for the seeded lab. */
const TEST_LAB_QUERY = `labPrefix=${LAB.shortCode}&lab=${LAB.shortCode}`;

describe("GET /api/analytics/director", () => {
  it("answers the portfolio value, funding, pending disposals, location counts, and reports per month for the seed", async () => {
    const res = await api.get("/api/analytics/director");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      totalPortfolioValue: SEEDED_PORTFOLIO_VALUE,
      pendingDisposalsCount: 0,
      fundingData: [{ name: FUNDING_SOURCE, value: SEEDED_PORTFOLIO_VALUE, count: 6 }],
      locationStatusData: SEEDED_LOCATION_STATUS,
      auditComplianceData: [{ month: "Mar 26", count: 1 }],
    });
  });

  it("adds every asset's value and groups it by funding source", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0701", fundingSource: "Test Grant B", acquisitionValue: 750 });
    try {
      const res = await api.get("/api/analytics/director");

      expect(res.body.data.totalPortfolioValue).toBe(SEEDED_PORTFOLIO_VALUE + 750);
      expect(res.body.data.fundingData).toHaveLength(2);
      expect(res.body.data.fundingData).toEqual(
        expect.arrayContaining([
          { name: FUNDING_SOURCE, value: SEEDED_PORTFOLIO_VALUE, count: 6 },
          { name: "Test Grant B", value: 750, count: 1 },
        ]),
      );
    } finally {
      await removeExtraAssets(db, [asset.assetId]);
    }
  });

  it("counts pending disposals in any of the three spellings, and nothing else", async () => {
    const statuses = ["pending", "Pending", "PENDING", "Test unknown status"];
    const rows = [];
    for (const status of statuses) {
      rows.push(
        await db.asset_disposals.create({
          data: { asset_id: ASSETS.available.assetId, disposed_by_id: USERS.staffTsg.userId, disposal_reason: `Test disposal ${status}`, status },
        }),
      );
    }
    try {
      const res = await api.get("/api/analytics/director");

      expect(res.body.data.pendingDisposalsCount).toBe(3);
    } finally {
      await db.asset_disposals.deleteMany({ where: { disposal_id: { in: rows.map((r) => r.disposal_id) } } });
    }
  });

  it("counts each report under its month, oldest month first", async () => {
    const rows = [];
    for (const day of ["2026-05-14", "2026-05-15"]) {
      rows.push(
        await db.asset_reports.create({
          data: {
            asset_id: ASSETS.inspected.assetId,
            reported_by_id: USERS.staffTsg.userId,
            report_condition: "PERFECT",
            report_date: new Date(`${day}T12:00:00Z`),
          },
        }),
      );
    }
    try {
      const res = await api.get("/api/analytics/director");

      expect(res.body.data.auditComplianceData).toEqual([
        { month: "Mar 26", count: 1 },
        { month: "May 26", count: 2 },
      ]);
    } finally {
      await db.asset_reports.deleteMany({ where: { report_id: { in: rows.map((r) => r.report_id) } } });
    }
  });

  it("treats \"All Labs\" and \"All Laboratories (DLSU Combined)\" as no lab filter", async () => {
    for (const lab of ["All Labs", "All Laboratories (DLSU Combined)"]) {
      const res = await api.get(`/api/analytics/director?lab=${encodeURIComponent(lab)}`);

      expect(res.status).toBe(200);
      expect(res.body.data.locationStatusData).toEqual(SEEDED_LOCATION_STATUS);
    }
  });

  it("matches the lab filter anywhere in the record's location, so a campus name works as well as a lab code", async () => {
    for (const lab of [LAB.shortCode, "Manila"]) {
      const res = await api.get(`/api/analytics/director?lab=${lab}`);

      expect(res.body.data.locationStatusData).toEqual(SEEDED_LOCATION_STATUS);
    }
  });

  it("narrows only the location counts by lab; portfolio value, funding, and pending disposals stay for every lab (new)", async () => {
    const res = await api.get("/api/analytics/director?lab=CAR");

    expect(res.status).toBe(200);
    expect(res.body.data.locationStatusData).toEqual([
      { location: "MANILA", ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0, total: 0 },
      { location: "LAGUNA", ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0, total: 0 },
    ]);
    expect(res.body.data.totalPortfolioValue).toBe(SEEDED_PORTFOLIO_VALUE);
    expect(res.body.data.fundingData).toEqual([{ name: FUNDING_SOURCE, value: SEEDED_PORTFOLIO_VALUE, count: 6 }]);
  });

  it("with a date range, counts each asset by its newest record inside the range, and with no report in it answers a fixed demo series (known defect H-09)", async () => {
    const res = await api.get("/api/analytics/director?startDate=2026-01-01&endDate=2026-01-31");

    expect(res.status).toBe(200);
    expect(res.body.data.locationStatusData).toEqual([
      { location: "MANILA", ACTIVE: 6, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0, total: 6 },
      { location: "LAGUNA", ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0, total: 0 },
    ]);
    expect(res.body.data.auditComplianceData).toEqual(DEMO_AUDIT_SERIES);
    expect(res.body.data.totalPortfolioValue).toBe(SEEDED_PORTFOLIO_VALUE);
  });

  it("counts a Laguna lab as Laguna, and also any location containing CAR, HXIL, CELT, CIVI, or MECH, even in Manila (new)", async () => {
    const laguna = await addExtraAsset(db, { tag: "TEST-0702", location: at("Laguna", "CeLT") });
    const manilaWithCar = await addExtraAsset(db, { tag: "TEST-0703", location: at("Manila", "Test CARD Lab") });
    try {
      const res = await api.get("/api/analytics/director");

      expect(res.body.data.locationStatusData).toEqual([
        { location: "MANILA", ACTIVE: 3, ON_LOAN: 1, MAINTENANCE: 1, DISPOSED: 1, total: 6 },
        { location: "LAGUNA", ACTIVE: 2, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0, total: 2 },
      ]);
    } finally {
      await removeExtraAssets(db, [laguna.assetId, manilaWithCar.assetId]);
    }
  });
});

describe("GET /api/analytics/lab-head", () => {
  const EMPTY_LAB = {
    loans: [],
    transfers: [],
    utilization: { assignedCount: 0, unassignedCount: 0, totalAssetsCount: 0, utilizationPercentage: 0 },
    categoryData: [],
    projectAllocation: [],
    delinquencies: [],
    scatterData: [],
    heatmapData: [],
  };

  it("defaults to the CITe4D prefix, which no seeded asset has, and answers empty data", async () => {
    const res = await api.get("/api/analytics/lab-head");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: EMPTY_LAB });
  });

  it("accepts any prefix and answers empty data, not an error, for one no asset has (known defects 01C 4.4, M-14)", async () => {
    const res = await labHead("labPrefix=NOPE&lab=NOPE");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: EMPTY_LAB });
  });

  it("lists the lab's loans newest first, with the destination lab moved out of the purpose", async () => {
    const res = await labHead(TEST_LAB_QUERY);

    expect(res.status).toBe(200);
    expect(res.body.data.loans).toEqual([
      {
        loanId: SEEDED_ROWS.pendingLoanId,
        assetId: ASSETS.pendingLoan.tag,
        asset: ASSETS.pendingLoan.name,
        borrower: USERS.custodianB.fullName,
        purpose: "Test purpose: pending loan",
        destinationLab: LAB.shortCode,
        requestedOn: "2026-03-01",
        dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        status: "Pending",
      },
      {
        loanId: SEEDED_ROWS.approvedLoanId,
        assetId: ASSETS.onLoan.tag,
        asset: ASSETS.onLoan.name,
        borrower: USERS.custodianA.fullName,
        purpose: "Test purpose: approved loan",
        destinationLab: LAB.shortCode,
        requestedOn: "2026-02-01",
        dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        status: "Approved",
      },
    ]);
  });

  it("answers the lab's utilization and categories, and no projects, delinquencies, or transfers for the seed", async () => {
    const res = await labHead(TEST_LAB_QUERY);

    expect(res.body.data.utilization).toEqual({ assignedCount: 0, unassignedCount: 6, totalAssetsCount: 6, utilizationPercentage: 0 });
    const categories = [...res.body.data.categoryData].sort((a, b) => a.category.localeCompare(b.category));
    expect(categories).toEqual(
      ["CAMERA", "DEV KIT", "MONITOR", "PROJECTOR", "ROUTER", "TABLET"].map((category) => ({ category, count: 1 })),
    );
    expect(res.body.data).toMatchObject({ transfers: [], projectAllocation: [], delinquencies: [], scatterData: [], heatmapData: [] });
  });

  it("lists the lab's transfers with the destination lab moved out, and shows the raw status capitalized (pending_approver as Pending_approver)", async () => {
    const transfer = await db.asset_transfers.create({
      data: {
        asset_id: ASSETS.available.assetId,
        from_custodian_id: USERS.admin.userId,
        to_custodian_id: USERS.custodianB.userId,
        justification: `Destination Lab: ${LAB.shortCode}\n\nTest justification: lab-head analytics`,
        status: "pending_approver",
        requested_on: new Date("2026-05-01T09:00:00Z"),
      },
    });
    try {
      const res = await labHead(TEST_LAB_QUERY);

      expect(res.body.data.transfers).toEqual([
        {
          transferId: transfer.transfer_id,
          assetId: ASSETS.available.tag,
          asset: ASSETS.available.name,
          justification: "Test justification: lab-head analytics",
          destinationLab: LAB.shortCode,
          requestedOn: "2026-05-01",
          status: "Pending_approver",
        },
      ]);
    } finally {
      await db.asset_transfers.delete({ where: { transfer_id: transfer.transfer_id } });
    }
  });

  it("reads labPrefix first and lab only when labPrefix is missing", async () => {
    const byLab = await labHead(`lab=${LAB.shortCode}`);
    expect(byLab.body.data.loans).toHaveLength(2);

    const prefixWins = await labHead(`labPrefix=NOPE&lab=${LAB.shortCode}`);
    expect(prefixWins.body.data.loans).toHaveLength(0);
  });

  it("with ALL or All Labs, counts every asset except the EQ- pool", async () => {
    const otherLab = await addExtraAsset(db, { tag: "OTHER-0701" });
    const pool = await addExtraAsset(db, { tag: "EQ-0701" });
    try {
      for (const prefix of ["ALL", "All Labs"]) {
        const res = await labHead(`labPrefix=${encodeURIComponent(prefix)}`);

        expect(res.status).toBe(200);
        expect(res.body.data.utilization).toEqual({ assignedCount: 0, unassignedCount: 7, totalAssetsCount: 7, utilizationPercentage: 0 });
        expect(res.body.data.loans).toHaveLength(2);
      }
    } finally {
      await removeExtraAssets(db, [otherLab.assetId, pool.assetId]);
    }
  });

  it("applies the date range to loans and transfers only, not to the lab's assets", async () => {
    const res = await labHead(`${TEST_LAB_QUERY}&startDate=2026-02-15`);

    expect(res.body.data.loans.map((l: { loanId: number }) => l.loanId)).toEqual([SEEDED_ROWS.pendingLoanId]);
    expect(res.body.data.utilization.totalAssetsCount).toBe(6);
  });

  it("counts an asset whose newest record names a project as assigned, and lists the project in the allocation", async () => {
    const project = await addProject();
    const asset = await addExtraAsset(db, { tag: "TEST-0711", projectId: project.master_id });
    try {
      const res = await labHead(TEST_LAB_QUERY);

      expect(res.body.data.utilization).toEqual({ assignedCount: 1, unassignedCount: 6, totalAssetsCount: 7, utilizationPercentage: 14 });
      expect(res.body.data.projectAllocation).toEqual([
        {
          projectId: "TEST-PRJ-1",
          name: "Test Project",
          leader: "Test Project Leader",
          center: LAB.name,
          count: 1,
          size: 1,
          pct: "14.3%",
          value: 250000,
          color: "#005A36",
        },
      ]);
    } finally {
      await removeExtraAssets(db, [asset.assetId]);
      await db.projects.delete({ where: { master_id: project.master_id } });
    }
  });

  it("lists overdue loans oldest due date first, grouped by project into the scatter and heatmap data", async () => {
    const tenDays = await addOverdueLoan("TEST-0721", 10);
    const twoDays = await addOverdueLoan("TEST-0722", 2);
    try {
      const res = await labHead(TEST_LAB_QUERY);

      expect(res.body.data.delinquencies).toEqual([
        {
          id: tenDays.loan.loan_id,
          assetName: tenDays.asset.name,
          assetTag: tenDays.asset.tag,
          custodian: USERS.custodianA.fullName,
          email: USERS.custodianA.email,
          daysOverdue: 10,
          dueDate: `${isoDateInDays(-10)}T00:00:00.000Z`,
          project: "Unassigned Cohort",
          projectId: 0,
        },
        {
          id: twoDays.loan.loan_id,
          assetName: twoDays.asset.name,
          assetTag: twoDays.asset.tag,
          custodian: USERS.custodianA.fullName,
          email: USERS.custodianA.email,
          daysOverdue: 2,
          dueDate: `${isoDateInDays(-2)}T00:00:00.000Z`,
          project: "Unassigned Cohort",
          projectId: 0,
        },
      ]);
      expect(res.body.data.scatterData).toEqual([
        { cohort: "Unassigned Cohort", avgDaysOverdue: 6, unreturnedCount: 2, bubbleSize: 200, color: "#F59E0B", severity: "Moderate Risk" },
      ]);
      expect(res.body.data.heatmapData).toEqual([{ cohort: "Unassigned Cohort", counts: [1, 0, 1, 0, 0], totalOverdue: 2 }]);
    } finally {
      await removeExtraAssets(db, [tenDays.asset.assetId, twoDays.asset.assetId]);
    }
  });

  it("names an overdue loan's cohort after the project on the asset's newest record", async () => {
    const project = await addProject();
    const overdue = await addOverdueLoan("TEST-0723", 20, "approved", project.master_id);
    try {
      const res = await labHead(TEST_LAB_QUERY);

      expect(res.body.data.delinquencies).toEqual([
        expect.objectContaining({ id: overdue.loan.loan_id, daysOverdue: 20, project: "Test Project", projectId: project.master_id }),
      ]);
      expect(res.body.data.scatterData).toEqual([
        { cohort: "Test Project", avgDaysOverdue: 20, unreturnedCount: 1, bubbleSize: 170, color: "#EF4444", severity: "Critical Bottleneck" },
      ]);
      expect(res.body.data.heatmapData).toEqual([{ cohort: "Test Project", counts: [0, 0, 0, 1, 0], totalOverdue: 1 }]);
    } finally {
      await removeExtraAssets(db, [overdue.asset.assetId]);
      await db.projects.delete({ where: { master_id: project.master_id } });
    }
  });

  it("leaves out returned and declined loans past due, but counts a pending request past its due date as overdue (new)", async () => {
    const returned = await addOverdueLoan("TEST-0724", 5, "returned");
    const declined = await addOverdueLoan("TEST-0725", 5, "declined");
    const pending = await addOverdueLoan("TEST-0726", 5, "pending");
    try {
      const res = await labHead(TEST_LAB_QUERY);

      expect(res.body.data.delinquencies.map((d: { id: number }) => d.id)).toEqual([pending.loan.loan_id]);
    } finally {
      await removeExtraAssets(db, [returned.asset.assetId, declined.asset.assetId, pending.asset.assetId]);
    }
  });

  it("still counts a loan as delinquent after the asset is returned through the return route (known defect H-04)", async () => {
    const overdue = await addOverdueLoan("TEST-0727", 5);
    try {
      const returned = await api.post(`/api/assets/${overdue.asset.tag}/return`, {
        returnedBy: USERS.custodianA.fullName,
        condition: "OPERATIONAL",
        comments: "Test return comment",
      });
      expect(returned.status).toBe(200);

      const res = await labHead(TEST_LAB_QUERY);

      expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: overdue.loan.loan_id } })).status).toBe("approved");
      expect(res.body.data.delinquencies).toEqual([expect.objectContaining({ id: overdue.loan.loan_id, daysOverdue: 5 })]);
    } finally {
      await removeExtraAssets(db, [overdue.asset.assetId]);
    }
  });
});

describe("GET /api/analytics/tsg", () => {
  it("answers the repair board and the condition summary for the seed", async () => {
    const res = await api.get("/api/analytics/tsg");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.repairs).toEqual([
      {
        repairId: SEEDED_ROWS.repairId,
        assetId: ASSETS.inRepair.tag,
        assetName: ASSETS.inRepair.name,
        reportedBy: USERS.custodianA.fullName,
        issueDescription: "Test repair: the lens does not focus",
        isImmediate: false,
        progressStatus: "Inspection Phase",
        createdAt: "2026-02-09",
      },
    ]);
    const { conditionItems, ...counts } = res.body.data.conditionSummary;
    expect(counts).toEqual({ goodCount: 6, degradedCount: 0, criticalCount: 0, totalCount: 6 });
    expect(conditionItems).toHaveLength(6);
    expect(conditionItems).toEqual(
      expect.arrayContaining([
        { assetTag: ASSETS.available.tag, name: ASSETS.available.name, category: "DEV KIT", condition: "PERFECT", trafficLight: "GREEN", location: LAB.homeLocation },
        { assetTag: ASSETS.inspected.tag, name: ASSETS.inspected.name, category: "PROJECTOR", condition: "OPERATIONAL", trafficLight: "GREEN", location: LAB.homeLocation },
      ]),
    );
  });

  it("gives each asset the home location of its newest record, not where it is now (the asset in repair shows its lab, not the TSG Office)", async () => {
    const res = await api.get("/api/analytics/tsg");

    const inRepair = res.body.data.conditionSummary.conditionItems.find((i: { assetTag: string }) => i.assetTag === ASSETS.inRepair.tag);
    expect(inRepair).toEqual({
      assetTag: ASSETS.inRepair.tag,
      name: ASSETS.inRepair.name,
      category: "CAMERA",
      condition: "PERFECT",
      trafficLight: "GREEN",
      location: LAB.homeLocation,
    });
  });

  it("counts MINOR_DRIFT and DEGRADED as degraded (yellow) and CRITICAL_DEFECT as critical (red)", async () => {
    const extras = [
      await addExtraAsset(db, { tag: "TEST-0731", condition: "MINOR_DRIFT" }),
      await addExtraAsset(db, { tag: "TEST-0732", condition: "DEGRADED" }),
      await addExtraAsset(db, { tag: "TEST-0733", condition: "CRITICAL_DEFECT" }),
    ];
    try {
      const res = await api.get("/api/analytics/tsg");

      const { conditionItems, ...counts } = res.body.data.conditionSummary;
      expect(counts).toEqual({ goodCount: 6, degradedCount: 2, criticalCount: 1, totalCount: 9 });
      const lights = Object.fromEntries(
        conditionItems.filter((i: { assetTag: string }) => i.assetTag.startsWith("TEST-073")).map((i: { assetTag: string; condition: string; trafficLight: string }) => [i.assetTag, [i.condition, i.trafficLight]]),
      );
      expect(lights).toEqual({
        "TEST-0731": ["MINOR_DRIFT", "YELLOW"],
        "TEST-0732": ["DEGRADED", "YELLOW"],
        "TEST-0733": ["CRITICAL_DEFECT", "RED"],
      });
    } finally {
      await removeExtraAssets(db, extras.map((a) => a.assetId));
    }
  });

  it("shows an asset with no records as PERFECT and Unassigned, and counts it as good (H-09 family)", async () => {
    const bare = await db.assets.create({ data: { asset_tag: "TEST-0734", name: "Test Asset Without Records", category: "MONITOR" } });
    try {
      const res = await api.get("/api/analytics/tsg");

      expect(res.body.data.conditionSummary).toMatchObject({ goodCount: 7, totalCount: 7 });
      expect(res.body.data.conditionSummary.conditionItems).toContainEqual({
        assetTag: "TEST-0734",
        name: "Test Asset Without Records",
        category: "MONITOR",
        condition: "PERFECT",
        trafficLight: "GREEN",
        location: "Unassigned",
      });
    } finally {
      await removeExtraAssets(db, [bare.asset_id]);
    }
  });

  it("lists repairs newest first and shows an empty status as Reported", async () => {
    const repair = await db.asset_repairs.create({
      data: {
        asset_id: ASSETS.available.assetId,
        reported_by_id: USERS.staffTsg.userId,
        issue_description: "Test repair: no status yet",
        progress_status: "",
        is_immediate: true,
        created_at: new Date("2026-05-01T09:00:00Z"),
      },
    });
    try {
      const res = await api.get("/api/analytics/tsg");

      expect(res.body.data.repairs.map((r: { repairId: number }) => r.repairId)).toEqual([repair.repair_id, SEEDED_ROWS.repairId]);
      expect(res.body.data.repairs[0]).toMatchObject({ reportedBy: USERS.staffTsg.fullName, isImmediate: true, progressStatus: "Reported", createdAt: "2026-05-01" });
    } finally {
      await db.asset_repairs.delete({ where: { repair_id: repair.repair_id } });
    }
  });

  it("ignores the startDate and endDate the Staff view sends (the view filters the repairs itself)", async () => {
    const res = await api.get("/api/analytics/tsg?startDate=2030-01-01&endDate=2030-12-31");

    expect(res.status).toBe(200);
    expect(res.body.data.repairs).toHaveLength(1);
    expect(res.body.data.conditionSummary.totalCount).toBe(6);
  });

  it("lists warranties that expired or expire within 90 days, soonest first, with days remaining counted from today", async () => {
    const extras = [
      await addExtraAsset(db, { tag: "TEST-0741", warrantyExpiry: dateInDays(30) }),
      await addExtraAsset(db, { tag: "TEST-0742", warrantyExpiry: dateInDays(-10) }),
      await addExtraAsset(db, { tag: "TEST-0743", warrantyExpiry: dateInDays(120) }),
    ];
    try {
      const res = await api.get("/api/analytics/tsg");

      // Only the extra assets: the seeded warranties end on 2027-06-01, which enters the 90 days in 2027.
      const listed = res.body.data.warrantyExpiringSoon.filter((w: { assetTag: string }) => w.assetTag.startsWith("TEST-074"));
      expect(listed).toEqual([
        { assetTag: "TEST-0742", name: extras[1].name, manufacturer: "N/A", warrantyExpiry: isoDateInDays(-10), daysRemaining: -10, isExpired: true },
        { assetTag: "TEST-0741", name: extras[0].name, manufacturer: "N/A", warrantyExpiry: isoDateInDays(30), daysRemaining: 30, isExpired: false },
      ]);
    } finally {
      await removeExtraAssets(db, extras.map((a) => a.assetId));
    }
  });
});

describe("GET /api/analytics/location-status", () => {
  const SEEDED = {
    byLocation: [
      { location: "Manila Campus", ACTIVE: 3, ON_LOAN: 1, MAINTENANCE: 1, DISPOSED: 1 },
      { location: "Laguna Campus", ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 },
    ],
    byStatus: [
      { name: "ACTIVE", value: 3 },
      { name: "ON LOAN", value: 1 },
      { name: "MAINTENANCE", value: 1 },
      { name: "DISPOSED", value: 1 },
    ],
    locationDistribution: labDistribution({ CITe4D: { available: 3, onLoan: 1, underRepair: 1 } }),
    statusCounts: [
      { name: "Available", value: 3 },
      { name: "On Loan", value: 1 },
      { name: "Under Repair", value: 1 },
      { name: "Disposed", value: 1 },
    ],
  };

  it("counts the seed by campus and status, and counts the lab TEST, missing from its list, as CITe4D (known defect M-03)", async () => {
    const res = await api.get("/api/analytics/location-status");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: SEEDED });
  });

  it("matches the lab filter anywhere in the location, ignoring letter case", async () => {
    const lowerCase = await api.get("/api/analytics/location-status?lab=test");
    expect(lowerCase.body.data).toEqual(SEEDED);

    const noMatch = await api.get("/api/analytics/location-status?lab=CAR");
    expect(noMatch.body.data).toEqual({
      byLocation: [
        { location: "Manila Campus", ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 },
        { location: "Laguna Campus", ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 },
      ],
      byStatus: [
        { name: "ACTIVE", value: 0 },
        { name: "ON LOAN", value: 0 },
        { name: "MAINTENANCE", value: 0 },
        { name: "DISPOSED", value: 0 },
      ],
      locationDistribution: labDistribution({}),
      statusCounts: [
        { name: "Available", value: 0 },
        { name: "On Loan", value: 0 },
        { name: "Under Repair", value: 0 },
        { name: "Disposed", value: 0 },
      ],
    });
  });

  it("puts a location under the first listed lab code it contains, so a Manila room containing CAR counts as the CAR lab (new)", async () => {
    const laguna = await addExtraAsset(db, { tag: "TEST-0751", location: at("Laguna", "CeLT") });
    const manilaWithCar = await addExtraAsset(db, { tag: "TEST-0752", location: at("Manila", "Test CARD Lab") });
    try {
      const res = await api.get("/api/analytics/location-status");

      expect(res.body.data.byLocation).toEqual([
        { location: "Manila Campus", ACTIVE: 4, ON_LOAN: 1, MAINTENANCE: 1, DISPOSED: 1 },
        { location: "Laguna Campus", ACTIVE: 1, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 },
      ]);
      expect(res.body.data.locationDistribution).toEqual(
        labDistribution({
          CITe4D: { available: 3, onLoan: 1, underRepair: 1 },
          CAR: { available: 1, onLoan: 0, underRepair: 0 },
          CeLT: { available: 1, onLoan: 0, underRepair: 0 },
        }),
      );
    } finally {
      await removeExtraAssets(db, [laguna.assetId, manilaWithCar.assetId]);
    }
  });

  it("counts an asset with no records as Active at Manila, CITe4D (H-09 family)", async () => {
    const bare = await db.assets.create({ data: { asset_tag: "TEST-0753", name: "Test Asset Without Records", category: "MONITOR" } });
    try {
      const res = await api.get("/api/analytics/location-status");

      expect(res.body.data.byLocation[0]).toEqual({ location: "Manila Campus", ACTIVE: 4, ON_LOAN: 1, MAINTENANCE: 1, DISPOSED: 1 });
      expect(res.body.data.locationDistribution[0]).toEqual({ location: "CITe4D", available: 4, onLoan: 1, underRepair: 1 });
    } finally {
      await removeExtraAssets(db, [bare.asset_id]);
    }
  });
});

describe("GET /api/analytics/advanced/inspection-progress", () => {
  it("reports 100% for a research center with no projects (new)", async () => {
    const res = await api.get("/api/analytics/advanced/inspection-progress");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [{ group: `${LAB.name} (${LAB.shortCode})`, inspected: 0, total: 0, percent: 100 }],
    });
  });

  it("counts every record of the center's projects, history included, and calls the ACTIVE ones inspected (new)", async () => {
    const project = await addProject();
    const reassigned = await addExtraAsset(db, { tag: "TEST-0761", projectId: project.master_id });
    const inRepair = await addExtraAsset(db, { tag: "TEST-0762", status: "MAINTENANCE", projectId: project.master_id });
    await db.asset_records.create({
      data: {
        asset_id: reassigned.assetId,
        status: "ON_LOAN",
        location: LAB.homeLocation,
        current_custodian: USERS.custodianA.userId,
        project_id: project.master_id,
        date_logged: new Date("2026-05-01T09:00:00Z"),
      },
    });
    try {
      const res = await api.get("/api/analytics/advanced/inspection-progress");

      expect(res.body.data).toEqual([{ group: `${LAB.name} (${LAB.shortCode})`, inspected: 1, total: 3, percent: 33 }]);
    } finally {
      await removeExtraAssets(db, [reassigned.assetId, inRepair.assetId]);
      await db.projects.delete({ where: { master_id: project.master_id } });
    }
  });
});

describe("the three advanced endpoints kept on 2026-10-07 (responds with 200 only)", () => {
  it("GET /api/analytics/advanced/idle-time answers 200 with success", async () => {
    const res = await api.get(`/api/analytics/advanced/idle-time?lab=${LAB.shortCode}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/analytics/advanced/idle-frequency answers 200 with success", async () => {
    const res = await api.get(`/api/analytics/advanced/idle-frequency?lab=${LAB.shortCode}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/analytics/advanced/loan-recommender answers 200 with success", async () => {
    const res = await api.get("/api/analytics/advanced/loan-recommender");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
