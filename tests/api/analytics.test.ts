/**
 * Analytics API: the five endpoints the live analytics views call, and the three kept on 2026-10-07.
 * Covers GET /api/analytics/director, /api/analytics/lab-head, /api/analytics/tsg, /api/analytics/location-status,
 * /api/analytics/advanced/inspection-progress, and (responds with 200 only) /api/analytics/advanced/idle-time,
 * /idle-frequency, /loan-recommender. Not the 22 that step 12 moves to legacy/analytics-endpoints/ (test plan, section 3).
 * Workflow: read-only dashboards (Director, Lab Head, Staff).
 * Fixtures: the whole seed, since every endpoint counts every asset: six assets with values 1000 to 6000 and funding
 * "Test Grant", the loans LOAN-1 and LOAN-2, the repair MNT-1, the approved disposal DISP-1, the report RPT-1 of
 * 2026-03-01, the research center TEST with no projects. A test that needs more (a project, an overdue loan, a
 * warranty relative to today, an asset at another lab) adds it with extraAssets.ts (tags TEST-0701 onward) and
 * removes it in a finally block, so every test starts from the seed. Nothing here changes a seeded row. An asset's lab
 * and campus come from its home lab (assets.center_id), its status from assets.status.
 */
import type { asset_loans_status } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { addExtraAsset, removeExtraAssets } from "../setup/extraAssets";
import { ASSETS, FUNDING_SOURCE, LAB, LOOKUPS, SEEDED_ROWS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { db, as, logIn, withCookie } = useApiHarness();
const asDirector = as(USERS.director);
const asLabHead = as(USERS.labHead);
const asStaff = as(USERS.staffTsg);

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

/**
 * Runs a check with a second and a third research center (Laguna and McKinley) that hold one asset each, and removes
 * them again.
 */
async function withOtherCampusLabs(check: () => Promise<void>) {
  const laguna = await db.research_centers.create({ data: { name: "Test Laguna Lab", short_code: "TESTL", location: "LAGUNA" } });
  const mckinley = await db.research_centers.create({ data: { name: "Test McKinley Lab", short_code: "TESTM", location: "MCKINLEY" } });
  const lagunaAsset = await addExtraAsset(db, { tag: "TESTL-0001", centerId: laguna.center_id });
  const mckinleyAsset = await addExtraAsset(db, { tag: "TESTM-0001", centerId: mckinley.center_id });
  try {
    await check();
  } finally {
    await removeExtraAssets(db, [lagunaAsset.assetId, mckinleyAsset.assetId]);
    await db.research_centers.deleteMany({ where: { center_id: { in: [laguna.center_id, mckinley.center_id] } } });
  }
}

/** Adds a project at the seeded research center. */
const addProject = () =>
  db.projects.create({
    data: {
      project_code: "TEST-PRJ-1",
      project_name: "Test Project",
      project_leader: "Test Project Leader",
      center_id: LAB.centerId,
      funding_agency: "Test Agency",
      start_date: new Date("2026-01-01"),
    },
  });

/** Adds an asset on loan to Custodian A through a loan whose due date was `daysOverdue` days ago. */
async function addOverdueLoan(tag: string, daysOverdue: number, status: asset_loans_status = "ON_LOAN", projectId?: number) {
  const asset = await addExtraAsset(db, { tag, status: "ON_LOAN", custodianId: USERS.custodianA.userId, projectId });
  const loan = await db.asset_loans.create({
    data: {
      asset_id: asset.assetId,
      borrower_id: USERS.custodianA.userId,
      purpose: "Test purpose: overdue loan",
      requested_at: new Date("2026-04-01T09:00:00Z"),
      return_by: dateInDays(-daysOverdue),
      status,
    },
  });
  return { asset, loan };
}

const labHead = (query: string) => asLabHead.get(`/api/analytics/lab-head?${query}`);

/** The query every Lab Head widget sends for the seeded lab. */
const TEST_LAB_QUERY = `labPrefix=${LAB.shortCode}&lab=${LAB.shortCode}`;

describe("GET /api/analytics/director", () => {
  it("answers the portfolio value, funding, pending disposals, location counts, and reports per month for the seed", async () => {
    const res = await asDirector.get("/api/analytics/director");

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
    const asset = await addExtraAsset(db, { tag: "TEST-0701", fundingSource: LOOKUPS.fundingSources[1].name, acquisitionValue: 750 });
    try {
      const res = await asDirector.get("/api/analytics/director");

      expect(res.body.data.totalPortfolioValue).toBe(SEEDED_PORTFOLIO_VALUE + 750);
      expect(res.body.data.fundingData).toHaveLength(2);
      expect(res.body.data.fundingData).toEqual(
        expect.arrayContaining([
          { name: FUNDING_SOURCE, value: SEEDED_PORTFOLIO_VALUE, count: 6 },
          { name: LOOKUPS.fundingSources[1].name, value: 750, count: 1 },
        ]),
      );
    } finally {
      await removeExtraAssets(db, [asset.assetId]);
    }
  });

  it("counts only Pending disposals, not approved, denied or completed ones", async () => {
    const statuses = ["PENDING", "APPROVED", "DENIED", "COMPLETED"] as const;
    const rows = [];
    for (const status of statuses) {
      rows.push(
        await db.asset_retirements.create({
          data: { asset_id: ASSETS.available.assetId, requested_by_id: USERS.staffTsg.userId, reason: `Test disposal ${status}`, status },
        }),
      );
    }
    try {
      const res = await asDirector.get("/api/analytics/director");

      expect(res.body.data.pendingDisposalsCount).toBe(1);
    } finally {
      await db.asset_retirements.deleteMany({ where: { retirement_id: { in: rows.map((r) => r.retirement_id) } } });
    }
  });

  it("counts each report under its month, oldest month first", async () => {
    const rows = [];
    for (const day of ["2026-05-14", "2026-05-15"]) {
      rows.push(
        await db.asset_inspections.create({
          data: {
            asset_id: ASSETS.inspected.assetId,
            inspected_by_id: USERS.staffTsg.userId,
            type: "ROUTINE",
            condition: "PERFECT",
            inspected_at: new Date(`${day}T12:00:00Z`),
          },
        }),
      );
    }
    try {
      const res = await asDirector.get("/api/analytics/director");

      expect(res.body.data.auditComplianceData).toEqual([
        { month: "Mar 26", count: 1 },
        { month: "May 26", count: 2 },
      ]);
    } finally {
      await db.asset_inspections.deleteMany({ where: { inspection_id: { in: rows.map((r) => r.inspection_id) } } });
    }
  });

  it("treats \"All Labs\" and \"All Laboratories (DLSU Combined)\" as no lab filter", async () => {
    for (const lab of ["All Labs", "All Laboratories (DLSU Combined)"]) {
      const res = await asDirector.get(`/api/analytics/director?lab=${encodeURIComponent(lab)}`);

      expect(res.status).toBe(200);
      expect(res.body.data.locationStatusData).toEqual(SEEDED_LOCATION_STATUS);
    }
  });

  it("takes the lab filter as a home lab's code or a campus label, so a campus name works as well as a lab code", async () => {
    for (const lab of [LAB.shortCode, "Manila"]) {
      const res = await asDirector.get(`/api/analytics/director?lab=${lab}`);

      expect(res.body.data.locationStatusData).toEqual(SEEDED_LOCATION_STATUS);
    }
  });

  it("narrows only the location counts by lab; portfolio value, funding, and pending disposals stay for every lab (new)", async () => {
    const res = await asDirector.get("/api/analytics/director?lab=CAR");

    expect(res.status).toBe(200);
    expect(res.body.data.locationStatusData).toEqual([
      { location: "MANILA", ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0, total: 0 },
      { location: "LAGUNA", ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0, total: 0 },
    ]);
    expect(res.body.data.totalPortfolioValue).toBe(SEEDED_PORTFOLIO_VALUE);
    expect(res.body.data.fundingData).toEqual([{ name: FUNDING_SOURCE, value: SEEDED_PORTFOLIO_VALUE, count: 6 }]);
  });

  it("with a date range, still counts every asset by its status, and with no report in it answers a fixed demo series (known defect H-09)", async () => {
    const res = await asDirector.get("/api/analytics/director?startDate=2026-01-01&endDate=2026-01-31");

    expect(res.status).toBe(200);
    expect(res.body.data.locationStatusData).toEqual(SEEDED_LOCATION_STATUS);
    expect(res.body.data.auditComplianceData).toEqual(DEMO_AUDIT_SERIES);
    expect(res.body.data.totalPortfolioValue).toBe(SEEDED_PORTFOLIO_VALUE);
  });

  it("counts an asset of a Laguna lab under Laguna, and for now a McKinley lab's too (TODO #96)", async () => {
    await withOtherCampusLabs(async () => {
      const res = await asDirector.get("/api/analytics/director");

      expect(res.body.data.locationStatusData).toEqual([
        { location: "MANILA", ACTIVE: 3, ON_LOAN: 1, MAINTENANCE: 1, DISPOSED: 1, total: 6 },
        { location: "LAGUNA", ACTIVE: 2, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0, total: 2 },
      ]);
      const laguna = await asDirector.get("/api/analytics/director?lab=Laguna");
      expect(laguna.body.data.locationStatusData[1]).toMatchObject({ ACTIVE: 1, total: 1 });
    });
  });
});

describe("GET /api/analytics/lab-head", () => {
  const EMPTY_LAB = {
    loans: [],
    utilization: { assignedCount: 0, unassignedCount: 0, totalAssetsCount: 0, utilizationPercentage: 0 },
    categoryData: [],
    projectAllocation: [],
    delinquencies: [],
    scatterData: [],
    heatmapData: [],
  };

  it("answers the dashboard of the lab the account heads, with no query", async () => {
    const res = await asLabHead.get("/api/analytics/lab-head");

    expect(res.status).toBe(200);
    expect(res.body.data.loans).toHaveLength(2);
    expect(res.body.data.utilization.totalAssetsCount).toBe(6);
  });

  it("ignores a lab in the query: a Lab Head sees only the lab it heads (C-02 fixed, M-14)", async () => {
    for (const query of ["labPrefix=NOPE&lab=NOPE", `lab=${LAB.shortCode}`, "labPrefix=ALL"]) {
      const res = await labHead(query);

      expect(res.status, query).toBe(200);
      expect(res.body.data.loans, query).toHaveLength(2);
    }
  });

  it("answers empty data for a lab with no assets", async () => {
    const empty = await db.research_centers.create({ data: { name: "Test Empty Lab", short_code: "TESTE", location: "MANILA" } });
    await db.research_centers.update({ where: { center_id: LAB.centerId }, data: { head_user_id: null } });
    await db.research_centers.update({ where: { center_id: empty.center_id }, data: { head_user_id: USERS.labHead.userId } });
    try {
      // A fresh login, so the session lookup sees the lab the account heads now.
      const res = await withCookie(await logIn(USERS.labHead)).get("/api/analytics/lab-head");

      expect(res.body).toEqual({ success: true, data: EMPTY_LAB });
    } finally {
      await db.research_centers.update({ where: { center_id: empty.center_id }, data: { head_user_id: null } });
      await db.research_centers.update({ where: { center_id: LAB.centerId }, data: { head_user_id: USERS.labHead.userId } });
      await db.research_centers.delete({ where: { center_id: empty.center_id } });
    }
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

  it("answers the lab's utilization and categories, and no projects or delinquencies for the seed", async () => {
    const res = await labHead(TEST_LAB_QUERY);

    expect(res.body.data.utilization).toEqual({ assignedCount: 0, unassignedCount: 6, totalAssetsCount: 6, utilizationPercentage: 0 });
    const categories = [...res.body.data.categoryData].sort((a, b) => a.category.localeCompare(b.category));
    expect(categories).toEqual(
      ["CAMERA", "DEV KIT", "MONITOR", "PROJECTOR", "ROUTER", "TABLET"].map((category) => ({ category, count: 1 })),
    );
    expect(res.body.data).toMatchObject({ projectAllocation: [], delinquencies: [], scatterData: [], heatmapData: [] });
    expect(res.body.data).not.toHaveProperty("transfers");
  });

  it("leaves out assets of other labs", async () => {
    const other = await db.research_centers.create({ data: { name: "Test Other Lab", short_code: "OTHER", location: "MANILA" } });
    const otherLab = await addExtraAsset(db, { tag: "OTHER-0701", centerId: other.center_id });
    try {
      const res = await labHead(TEST_LAB_QUERY);

      expect(res.body.data.utilization.totalAssetsCount).toBe(6);
    } finally {
      await removeExtraAssets(db, [otherLab.assetId]);
      await db.research_centers.delete({ where: { center_id: other.center_id } });
    }
  });

  it("applies the date range to loans only, not to the lab's assets", async () => {
    const res = await labHead(`${TEST_LAB_QUERY}&startDate=2026-02-15`);

    expect(res.body.data.loans.map((l: { loanId: number }) => l.loanId)).toEqual([SEEDED_ROWS.pendingLoanId]);
    expect(res.body.data.utilization.totalAssetsCount).toBe(6);
  });

  it("counts an asset whose newest record names a project as assigned, and lists the project in the allocation", async () => {
    const project = await addProject();
    const asset = await addExtraAsset(db, { tag: "TEST-0711", projectId: project.project_id });
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
      await db.projects.delete({ where: { project_id: project.project_id } });
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
    const overdue = await addOverdueLoan("TEST-0723", 20, "ON_LOAN", project.project_id);
    try {
      const res = await labHead(TEST_LAB_QUERY);

      expect(res.body.data.delinquencies).toEqual([
        expect.objectContaining({ id: overdue.loan.loan_id, daysOverdue: 20, project: "Test Project", projectId: project.project_id }),
      ]);
      expect(res.body.data.scatterData).toEqual([
        { cohort: "Test Project", avgDaysOverdue: 20, unreturnedCount: 1, bubbleSize: 170, color: "#EF4444", severity: "Critical Bottleneck" },
      ]);
      expect(res.body.data.heatmapData).toEqual([{ cohort: "Test Project", counts: [0, 0, 0, 1, 0], totalOverdue: 1 }]);
    } finally {
      await removeExtraAssets(db, [overdue.asset.assetId]);
      await db.projects.delete({ where: { project_id: project.project_id } });
    }
  });

  it("leaves out returned and declined loans past due, but counts a pending request past its due date as overdue (new)", async () => {
    const returned = await addOverdueLoan("TEST-0724", 5, "RETURNED");
    const declined = await addOverdueLoan("TEST-0725", 5, "DECLINED");
    const pending = await addOverdueLoan("TEST-0726", 5, "PENDING_APPROVAL");
    try {
      const res = await labHead(TEST_LAB_QUERY);

      expect(res.body.data.delinquencies.map((d: { id: number }) => d.id)).toEqual([pending.loan.loan_id]);
    } finally {
      await removeExtraAssets(db, [returned.asset.assetId, declined.asset.assetId, pending.asset.assetId]);
    }
  });

  it("no longer counts a loan as delinquent once the asset is returned through the return route (issue #99, H-04 fixed)", async () => {
    const overdue = await addOverdueLoan("TEST-0727", 5);
    try {
      const returned = await asStaff.post(`/api/assets/${overdue.asset.tag}/return`, {
        returnedBy: USERS.custodianA.fullName,
        condition: "OPERATIONAL",
        comments: "Test return comment",
      });
      expect(returned.status).toBe(200);

      const res = await labHead(TEST_LAB_QUERY);

      expect((await db.asset_loans.findUniqueOrThrow({ where: { loan_id: overdue.loan.loan_id } })).status).toBe("RETURNED");
      expect(res.body.data.delinquencies).toEqual([]);
    } finally {
      await removeExtraAssets(db, [overdue.asset.assetId]);
    }
  });
});

describe("GET /api/analytics/tsg", () => {
  it("answers the repair board and the condition summary for the seed", async () => {
    const res = await asStaff.get("/api/analytics/tsg");

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
        { assetTag: ASSETS.available.tag, name: ASSETS.available.name, category: "DEV KIT", condition: "PERFECT", trafficLight: "GREEN", location: LAB.shortCode },
        { assetTag: ASSETS.inspected.tag, name: ASSETS.inspected.name, category: "PROJECTOR", condition: "OPERATIONAL", trafficLight: "GREEN", location: LAB.shortCode },
      ]),
    );
  });

  it("gives each asset its home lab, not where it is now (the asset in repair shows its lab, not the TSG Office)", async () => {
    const res = await asStaff.get("/api/analytics/tsg");

    const inRepair = res.body.data.conditionSummary.conditionItems.find((i: { assetTag: string }) => i.assetTag === ASSETS.inRepair.tag);
    expect(inRepair).toEqual({
      assetTag: ASSETS.inRepair.tag,
      name: ASSETS.inRepair.name,
      category: "CAMERA",
      condition: "PERFECT",
      trafficLight: "GREEN",
      location: LAB.shortCode,
    });
  });

  it("counts MINOR_DRIFT and DEGRADED as degraded (yellow) and CRITICAL_DEFECT as critical (red)", async () => {
    const extras = [
      await addExtraAsset(db, { tag: "TEST-0731", condition: "MINOR_DRIFT" }),
      await addExtraAsset(db, { tag: "TEST-0732", condition: "DEGRADED" }),
      await addExtraAsset(db, { tag: "TEST-0733", condition: "CRITICAL_DEFECT" }),
    ];
    try {
      const res = await asStaff.get("/api/analytics/tsg");

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

  it("shows an asset TSG never inspected as PERFECT at its home lab, and counts it as good (H-09 family)", async () => {
    const bare = await db.assets.create({ data: { asset_tag: "TEST-0734", name: "Test Asset Without Records", category: "MONITOR", center_id: LAB.centerId } });
    try {
      const res = await asStaff.get("/api/analytics/tsg");

      expect(res.body.data.conditionSummary).toMatchObject({ goodCount: 7, totalCount: 7 });
      expect(res.body.data.conditionSummary.conditionItems).toContainEqual({
        assetTag: "TEST-0734",
        name: "Test Asset Without Records",
        category: "MONITOR",
        condition: "PERFECT",
        trafficLight: "GREEN",
        location: LAB.shortCode,
      });
    } finally {
      await removeExtraAssets(db, [bare.asset_id]);
    }
  });

  it("lists repairs newest first, with the progress text the screens show", async () => {
    const repair = await db.asset_maintenance.create({
      data: {
        asset_id: ASSETS.available.assetId,
        reported_by_id: USERS.staffTsg.userId,
        issue_description: "Test repair: not received yet",
        status: "PENDING_RECEIPT",
        is_immediate: true,
        reported_at: new Date("2026-05-01T09:00:00Z"),
      },
    });
    try {
      const res = await asStaff.get("/api/analytics/tsg");

      expect(res.body.data.repairs.map((r: { repairId: number }) => r.repairId)).toEqual([repair.maintenance_id, SEEDED_ROWS.repairId]);
      expect(res.body.data.repairs[0]).toMatchObject({ reportedBy: USERS.staffTsg.fullName, isImmediate: true, progressStatus: "Awaiting Immediate Dispatch", createdAt: "2026-05-01" });
    } finally {
      await db.asset_maintenance.delete({ where: { maintenance_id: repair.maintenance_id } });
    }
  });

  it("ignores the startDate and endDate the Staff view sends (the view filters the repairs itself)", async () => {
    const res = await asStaff.get("/api/analytics/tsg?startDate=2030-01-01&endDate=2030-12-31");

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
      const res = await asStaff.get("/api/analytics/tsg");

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
      { location: "McKinley Campus", ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 },
    ],
    byStatus: [
      { name: "ACTIVE", value: 3 },
      { name: "ON LOAN", value: 1 },
      { name: "MAINTENANCE", value: 1 },
      { name: "DISPOSED", value: 1 },
    ],
    locationDistribution: [{ location: LAB.shortCode, available: 3, onLoan: 1, underRepair: 1 }],
    statusCounts: [
      { name: "Available", value: 3 },
      { name: "On Loan", value: 1 },
      { name: "Under Repair", value: 1 },
      { name: "Disposed", value: 1 },
    ],
  };

  it("counts the seed by campus, status, and home lab", async () => {
    const res = await asStaff.get("/api/analytics/location-status");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: SEEDED });
  });

  it("takes the lab filter as a home lab's code in any letter case", async () => {
    const lowerCase = await asStaff.get("/api/analytics/location-status?lab=test");
    expect(lowerCase.body.data).toEqual(SEEDED);

    const noMatch = await asStaff.get("/api/analytics/location-status?lab=CAR");
    expect(noMatch.body.data).toEqual({
      byLocation: SEEDED.byLocation.map(c => ({ ...c, ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 })),
      byStatus: SEEDED.byStatus.map(s => ({ ...s, value: 0 })),
      locationDistribution: [],
      statusCounts: SEEDED.statusCounts.map(s => ({ ...s, value: 0 })),
    });
  });

  it("counts each asset under its home lab's campus, McKinley included, and lists each lab once", async () => {
    await withOtherCampusLabs(async () => {
      const res = await asStaff.get("/api/analytics/location-status");

      expect(res.body.data.byLocation).toEqual([
        { location: "Manila Campus", ACTIVE: 3, ON_LOAN: 1, MAINTENANCE: 1, DISPOSED: 1 },
        { location: "Laguna Campus", ACTIVE: 1, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 },
        { location: "McKinley Campus", ACTIVE: 1, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 },
      ]);
      expect(res.body.data.locationDistribution).toEqual([
        { location: LAB.shortCode, available: 3, onLoan: 1, underRepair: 1 },
        { location: "TESTL", available: 1, onLoan: 0, underRepair: 0 },
        { location: "TESTM", available: 1, onLoan: 0, underRepair: 0 },
      ]);
    });
  });
});

describe("GET /api/analytics/advanced/inspection-progress", () => {
  it("counts each center's assets that are not retired, and calls the Available ones inspected (known defect, no report is read)", async () => {
    const res = await asStaff.get("/api/analytics/advanced/inspection-progress");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [{ group: `${LAB.name} (${LAB.shortCode})`, inspected: 3, total: 5, percent: 60 }],
    });
  });

  it("reports 100% for a research center with no assets", async () => {
    const empty = await db.research_centers.create({ data: { name: "Test Empty Lab", short_code: "TESTE", location: "MANILA" } });
    try {
      const res = await asStaff.get("/api/analytics/advanced/inspection-progress");

      expect(res.body.data).toContainEqual({ group: "Test Empty Lab (TESTE)", inspected: 0, total: 0, percent: 100 });
    } finally {
      await db.research_centers.delete({ where: { center_id: empty.center_id } });
    }
  });
});

describe("the three advanced endpoints kept on 2026-10-07 (responds with 200 only)", () => {
  it("GET /api/analytics/advanced/idle-time answers 200 with success", async () => {
    const res = await asLabHead.get(`/api/analytics/advanced/idle-time?lab=${LAB.shortCode}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/analytics/advanced/idle-frequency answers 200 with success", async () => {
    const res = await asLabHead.get(`/api/analytics/advanced/idle-frequency?lab=${LAB.shortCode}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/analytics/advanced/loan-recommender answers 200 with success", async () => {
    const res = await asLabHead.get("/api/analytics/advanced/loan-recommender");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
