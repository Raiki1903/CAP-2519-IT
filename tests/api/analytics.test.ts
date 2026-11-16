/**
 * Analytics API: the five endpoints the live analytics views call, and the three kept on 2026-10-07.
 * Covers GET /api/analytics/director, /api/analytics/lab-head, /api/analytics/tsg, /api/analytics/location-status,
 * /api/analytics/advanced/inspection-progress, and (responds with 200 only) /api/analytics/advanced/idle-time,
 * /idle-frequency, /loan-recommender. Not the 22 that step 12 moves to legacy/analytics-endpoints/ (test plan, section 3).
 * Workflow: read-only dashboards (Director, Lab Head, Staff).
 * Fixtures: the whole seed, since every endpoint counts every asset: six assets with values 1000 to 6000 and funding
 * "Test Grant", the loans LOAN-1 and LOAN-2, the repair MNT-1, the approved disposal RET-1, the report RPT-1 of
 * 2026-03-01, the research center TEST with no projects. A test that needs more (a project, an overdue loan, a
 * warranty relative to today, an asset at another lab) adds it with extraAssets.ts (tags TEST-0701 onward) and
 * removes it in a finally block, so every test starts from the seed. Nothing here changes a seeded row. An asset's lab
 * and campus come from its home lab (assets.center_id), its status from assets.status. The Director's loan flow counts
 * the handed-over loans: for the seed, the one On Loan loan LOAN-1 (TEST to TEST); a test adds the loans it needs.
 */
import type { asset_loans_status } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ASSET_STATUSES } from "../../shared/enums/assetStatus";
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

type StatusKey = (typeof ASSET_STATUSES)[number];

/** A count for each of the six asset statuses: zero, except the ones given. */
const statusCounts = (counts: Partial<Record<StatusKey, number>> = {}) => ({
  ...Object.fromEntries(ASSET_STATUSES.map((status) => [status, 0])),
  ...counts,
});

/** One campus entry of the Director's location counts. */
const campusCounts = (location: string, counts: Partial<Record<StatusKey, number>> = {}) => ({
  location,
  ...statusCounts(counts),
  total: Object.values(counts).reduce((sum, n) => sum + n, 0),
});

/** The seeded assets' statuses: three Available, one On Loan, one in Maintenance, one Retired. All are at the Manila lab TEST. */
const SEEDED_STATUS_COUNTS = { AVAILABLE: 3, ON_LOAN: 1, MAINTENANCE: 1, RETIRED: 1 } as const;

/** The Director's location counts for the seed: all three campuses, every seeded asset in Manila. */
const SEEDED_LOCATION_STATUS = [campusCounts("MANILA", SEEDED_STATUS_COUNTS), campusCounts("LAGUNA"), campusCounts("MCKINLEY")];

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

/** The Director's loan flow for the seed: LOAN-1 is On Loan and LOAN-2 is still waiting for approval, so only LOAN-1 counts. */
const SEEDED_LOAN_FLOW_ROW = { campus: LAB.location, homeLab: LAB.shortCode, destinationLab: LAB.shortCode, loans: 1 };

/** Adds a loan with the given status and borrower's lab (null for none), requested on 2026-04-01 unless a date is given. Returns its id. */
async function addLoan(assetId: number, status: asset_loans_status, destinationCenterId: number | null, requestedAt = "2026-04-01T09:00:00Z") {
  const loan = await db.asset_loans.create({
    data: {
      asset_id: assetId,
      borrower_id: USERS.custodianA.userId,
      purpose: "Test purpose: loan flow",
      requested_at: new Date(requestedAt),
      return_by: dateInDays(30),
      status,
      destination_center_id: destinationCenterId,
    },
  });
  return loan.loan_id;
}

const removeLoans = (loanIds: number[]) => db.asset_loans.deleteMany({ where: { loan_id: { in: loanIds } } });

/** The id of the research center with this short code. */
const centerIdOf = async (shortCode: string) => (await db.research_centers.findUniqueOrThrow({ where: { short_code: shortCode } })).center_id;

/** The id of the asset with this tag. */
const assetIdOf = async (tag: string) => (await db.assets.findUniqueOrThrow({ where: { asset_tag: tag } })).asset_id;

const labHead = (query: string) => asLabHead.get(`/api/analytics/lab-head?${query}`);

/** The query every Lab Head widget sends for the seeded lab. */
const TEST_LAB_QUERY = `labPrefix=${LAB.shortCode}&lab=${LAB.shortCode}`;

describe("GET /api/analytics/director", () => {
  it("answers the portfolio value, funding, pending disposals, location counts, loan flow, and reports per month for the seed", async () => {
    const res = await asDirector.get("/api/analytics/director");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      totalPortfolioValue: SEEDED_PORTFOLIO_VALUE,
      pendingDisposalsCount: 0,
      fundingData: [{ name: FUNDING_SOURCE, value: SEEDED_PORTFOLIO_VALUE, count: 6 }],
      locationStatusData: SEEDED_LOCATION_STATUS,
      loanFlowData: [SEEDED_LOAN_FLOW_ROW],
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

  it("narrows only the location counts and the loan flow by lab; portfolio value, funding, and pending disposals stay for every lab (new)", async () => {
    const res = await asDirector.get("/api/analytics/director?lab=CAR");

    expect(res.status).toBe(200);
    expect(res.body.data.locationStatusData).toEqual([campusCounts("MANILA"), campusCounts("LAGUNA"), campusCounts("MCKINLEY")]);
    expect(res.body.data.loanFlowData).toEqual([]);
    expect(res.body.data.totalPortfolioValue).toBe(SEEDED_PORTFOLIO_VALUE);
    expect(res.body.data.fundingData).toEqual([{ name: FUNDING_SOURCE, value: SEEDED_PORTFOLIO_VALUE, count: 6 }]);
  });

  it("with no report in the range, answers an empty reports series, not a demo one (H-09)", async () => {
    const res = await asDirector.get("/api/analytics/director?startDate=2026-01-01&endDate=2026-01-31");

    expect(res.status).toBe(200);
    expect(res.body.data.auditComplianceData).toEqual([]);
    expect(res.body.data.totalPortfolioValue).toBe(SEEDED_PORTFOLIO_VALUE);
  });

  it("counts a McKinley lab under McKinley and a Laguna lab under Laguna, three campuses in a fixed order (#96)", async () => {
    await withOtherCampusLabs(async () => {
      const res = await asDirector.get("/api/analytics/director");

      expect(res.body.data.locationStatusData).toEqual([
        campusCounts("MANILA", SEEDED_STATUS_COUNTS),
        campusCounts("LAGUNA", { AVAILABLE: 1 }),
        campusCounts("MCKINLEY", { AVAILABLE: 1 }),
      ]);
      const laguna = await asDirector.get("/api/analytics/director?lab=Laguna");
      expect(laguna.body.data.locationStatusData).toEqual([campusCounts("MANILA"), campusCounts("LAGUNA", { AVAILABLE: 1 }), campusCounts("MCKINLEY")]);
      const mckinley = await asDirector.get("/api/analytics/director?lab=TESTM");
      expect(mckinley.body.data.locationStatusData).toEqual([campusCounts("MANILA"), campusCounts("LAGUNA"), campusCounts("MCKINLEY", { AVAILABLE: 1 })]);
    });
  });

  it("counts Pending Retirement and Missing assets under their own statuses (#96)", async () => {
    const extras = [
      await addExtraAsset(db, { tag: "TEST-0702", assetStatus: "PENDING_RETIREMENT" }),
      await addExtraAsset(db, { tag: "TEST-0703", assetStatus: "MISSING" }),
    ];
    try {
      const res = await asDirector.get("/api/analytics/director");

      expect(res.body.data.locationStatusData[0]).toEqual(campusCounts("MANILA", { ...SEEDED_STATUS_COUNTS, PENDING_RETIREMENT: 1, MISSING: 1 }));
    } finally {
      await removeExtraAssets(db, extras.map((a) => a.assetId));
    }
  });

  it("with a date range, counts only the assets procured inside it, and leaves out an asset with no procurement date (#96)", async () => {
    const noDate = await db.assets.create({
      data: { asset_tag: "TEST-0704", name: "Test Asset No Procurement Date", category: "MONITOR", center_id: LAB.centerId, status: "ON_LOAN" },
    });
    try {
      const noneCounted = [campusCounts("MANILA"), campusCounts("LAGUNA"), campusCounts("MCKINLEY")];
      // The seeded assets were procured on 2025-06-01.
      const inside = await asDirector.get("/api/analytics/director?startDate=2025-06-01&endDate=2025-06-30");
      expect(inside.body.data.locationStatusData).toEqual(SEEDED_LOCATION_STATUS);

      const after = await asDirector.get("/api/analytics/director?startDate=2026-01-01");
      expect(after.body.data.locationStatusData).toEqual(noneCounted);

      const before = await asDirector.get("/api/analytics/director?endDate=2025-05-31");
      expect(before.body.data.locationStatusData).toEqual(noneCounted);

      const noRange = await asDirector.get("/api/analytics/director");
      expect(noRange.body.data.locationStatusData[0]).toEqual(campusCounts("MANILA", { ...SEEDED_STATUS_COUNTS, ON_LOAN: 2 }));
    } finally {
      await removeExtraAssets(db, [noDate.asset_id]);
    }
  });

  it("counts a loan under its borrower's lab, in its own row, apart from its asset's home lab (#188)", async () => {
    await withOtherCampusLabs(async () => {
      const loanIds = [await addLoan(await assetIdOf("TESTL-0001"), "ON_LOAN", await centerIdOf("TESTM"))];
      try {
        const res = await asDirector.get("/api/analytics/director");

        expect(res.body.data.loanFlowData).toEqual([SEEDED_LOAN_FLOW_ROW, { campus: "LAGUNA", homeLab: "TESTL", destinationLab: "TESTM", loans: 1 }]);
      } finally {
        await removeLoans(loanIds);
      }
    });
  });

  it("counts a loan once it was handed over, by its status and not by released_at; the other four statuses are left out (#188)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0705" });
    const counted: asset_loans_status[] = ["ON_LOAN", "RETURN_REQUESTED", "RETURNED", "ENDED_BY_MAINTENANCE", "ENDED_BY_LOSS"];
    const leftOut: asset_loans_status[] = ["PENDING_APPROVAL", "PENDING_RELEASE", "DECLINED", "CANCELLED"];
    const loanIds: number[] = [];
    try {
      for (const status of [...counted, ...leftOut]) loanIds.push(await addLoan(asset.assetId, status, LAB.centerId));
      const res = await asDirector.get("/api/analytics/director");

      // The seeded On Loan loan, plus the five handed-over loans added here, none of which has a released_at.
      expect(res.body.data.loanFlowData).toEqual([{ ...SEEDED_LOAN_FLOW_ROW, loans: 1 + counted.length }]);
    } finally {
      await removeLoans(loanIds);
      await removeExtraAssets(db, [asset.assetId]);
    }
  });

  it("with a date range, counts only the loans requested inside it (#188)", async () => {
    await withOtherCampusLabs(async () => {
      // The seeded loan was requested on 2026-02-01; this one on 2026-04-01.
      const loanIds = [await addLoan(await assetIdOf("TESTL-0001"), "RETURNED", LAB.centerId)];
      const aprilRow = { campus: "LAGUNA", homeLab: "TESTL", destinationLab: LAB.shortCode, loans: 1 };
      try {
        const february = await asDirector.get("/api/analytics/director?startDate=2026-01-01&endDate=2026-02-28");
        expect(february.body.data.loanFlowData).toEqual([SEEDED_LOAN_FLOW_ROW]);

        const april = await asDirector.get("/api/analytics/director?startDate=2026-03-01&endDate=2026-04-30");
        expect(april.body.data.loanFlowData).toEqual([aprilRow]);

        const after = await asDirector.get("/api/analytics/director?startDate=2026-05-01");
        expect(after.body.data.loanFlowData).toEqual([]);

        const before = await asDirector.get("/api/analytics/director?endDate=2026-01-31");
        expect(before.body.data.loanFlowData).toEqual([]);

        const noRange = await asDirector.get("/api/analytics/director");
        expect(noRange.body.data.loanFlowData).toEqual([SEEDED_LOAN_FLOW_ROW, aprilRow]);
      } finally {
        await removeLoans(loanIds);
      }
    });
  });

  it("narrows the loan flow by the asset's home lab, by code or campus label, not by the borrower's lab (#188)", async () => {
    await withOtherCampusLabs(async () => {
      // A Laguna asset lent to the McKinley lab.
      const loanIds = [await addLoan(await assetIdOf("TESTL-0001"), "ON_LOAN", await centerIdOf("TESTM"))];
      const lagunaRow = { campus: "LAGUNA", homeLab: "TESTL", destinationLab: "TESTM", loans: 1 };
      try {
        const flowOf = async (lab: string) => (await asDirector.get(`/api/analytics/director?lab=${lab}`)).body.data.loanFlowData;

        expect(await flowOf("TESTL")).toEqual([lagunaRow]);
        expect(await flowOf("testl")).toEqual([lagunaRow]);
        expect(await flowOf("Laguna")).toEqual([lagunaRow]);
        expect(await flowOf(LAB.shortCode)).toEqual([SEEDED_LOAN_FLOW_ROW]);
        expect(await flowOf("Manila")).toEqual([SEEDED_LOAN_FLOW_ROW]);
        // McKinley is only the borrower's lab, so neither its code nor its campus holds a row.
        expect(await flowOf("TESTM")).toEqual([]);
        expect(await flowOf("McKinley")).toEqual([]);
      } finally {
        await removeLoans(loanIds);
      }
    });
  });

  it("gives a handed-over loan with no borrower's lab a null destinationLab (#188)", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0706" });
    const loanIds: number[] = [];
    try {
      loanIds.push(await addLoan(asset.assetId, "RETURNED", null));
      const res = await asDirector.get("/api/analytics/director");

      expect(res.body.data.loanFlowData).toEqual([SEEDED_LOAN_FLOW_ROW, { campus: LAB.location, homeLab: LAB.shortCode, destinationLab: null, loans: 1 }]);
    } finally {
      await removeLoans(loanIds);
      await removeExtraAssets(db, [asset.assetId]);
    }
  });

  it("sorts the loan flow by loans, then home lab, then borrower's lab, a loan with none last (#188)", async () => {
    await withOtherCampusLabs(async () => {
      const asset = await addExtraAsset(db, { tag: "TEST-0707" });
      const mckinleyId = await centerIdOf("TESTM");
      const loanIds: number[] = [];
      try {
        loanIds.push(await addLoan(asset.assetId, "RETURNED", mckinleyId));
        loanIds.push(await addLoan(asset.assetId, "RETURNED", mckinleyId));
        loanIds.push(await addLoan(asset.assetId, "RETURNED", null));
        loanIds.push(await addLoan(await assetIdOf("TESTL-0001"), "RETURNED", LAB.centerId));
        const res = await asDirector.get("/api/analytics/director");

        expect(res.body.data.loanFlowData).toEqual([
          { campus: "MANILA", homeLab: LAB.shortCode, destinationLab: "TESTM", loans: 2 },
          SEEDED_LOAN_FLOW_ROW,
          { campus: "MANILA", homeLab: LAB.shortCode, destinationLab: null, loans: 1 },
          { campus: "LAGUNA", homeLab: "TESTL", destinationLab: LAB.shortCode, loans: 1 },
        ]);
      } finally {
        await removeLoans(loanIds);
        await removeExtraAssets(db, [asset.assetId]);
      }
    });
  });
});

describe("GET /api/analytics/lab-head", () => {
  const EMPTY_LAB = {
    loans: [],
    utilization: { onLoanCount: 0, notOnLoanCount: 0, totalAssetsCount: 0, utilizationPercentage: 0 },
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

  it("lists the lab's loans newest first, with the destination lab from destination_center_id", async () => {
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

  it("answers the lab's utilization (assets On Loan) and categories, and no projects or delinquencies for the seed", async () => {
    const res = await labHead(TEST_LAB_QUERY);

    expect(res.body.data.utilization).toEqual({ onLoanCount: 1, notOnLoanCount: 5, totalAssetsCount: 6, utilizationPercentage: 17 });
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

  it("counts only assets On Loan as utilized, not assets that belong to a project (#96)", async () => {
    const project = await addProject();
    const inProject = await addExtraAsset(db, { tag: "TEST-0711", projectId: project.project_id });
    const loaned = await addExtraAsset(db, { tag: "TEST-0712", status: "ON_LOAN", custodianId: USERS.custodianA.userId });
    try {
      const res = await labHead(TEST_LAB_QUERY);

      expect(res.body.data.utilization).toEqual({ onLoanCount: 2, notOnLoanCount: 6, totalAssetsCount: 8, utilizationPercentage: 25 });
    } finally {
      await removeExtraAssets(db, [inProject.assetId, loaned.assetId]);
      await db.projects.delete({ where: { project_id: project.project_id } });
    }
  });

  it("lists a project in the allocation with the sum of its assets' acquisition values, not a guessed value (#96, H-09)", async () => {
    const project = await addProject();
    const first = await addExtraAsset(db, { tag: "TEST-0713", projectId: project.project_id, acquisitionValue: 1200 });
    const second = await addExtraAsset(db, { tag: "TEST-0714", projectId: project.project_id, acquisitionValue: 300 });
    try {
      const res = await labHead(TEST_LAB_QUERY);

      expect(res.body.data.projectAllocation).toEqual([
        {
          projectId: "TEST-PRJ-1",
          name: "Test Project",
          leader: "Test Project Leader",
          center: LAB.name,
          count: 2,
          size: 2,
          pct: "25.0%",
          value: 1500,
          color: "#005A36",
        },
      ]);
    } finally {
      await removeExtraAssets(db, [first.assetId, second.assetId]);
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

  it("leaves out returned and declined loans past due, and a Pending Approval request past its return-by date (H-04 fixed)", async () => {
    const returned = await addOverdueLoan("TEST-0724", 5, "RETURNED");
    const declined = await addOverdueLoan("TEST-0725", 5, "DECLINED");
    const pending = await addOverdueLoan("TEST-0726", 5, "PENDING_APPROVAL");
    try {
      const res = await labHead(TEST_LAB_QUERY);

      expect(res.body.data.delinquencies).toEqual([]);
    } finally {
      await removeExtraAssets(db, [returned.asset.assetId, declined.asset.assetId, pending.asset.assetId]);
    }
  });

  it("counts On Loan and Return Requested loans past their return-by date, and not a Pending Release one", async () => {
    const onLoan = await addOverdueLoan("TEST-0728", 3, "ON_LOAN");
    const returnRequested = await addOverdueLoan("TEST-0729", 3, "RETURN_REQUESTED");
    const waiting = await addOverdueLoan("TEST-0730", 3, "PENDING_RELEASE");
    try {
      const res = await labHead(TEST_LAB_QUERY);

      expect(res.body.data.delinquencies.map((d: { id: number }) => d.id).sort()).toEqual([onLoan.loan.loan_id, returnRequested.loan.loan_id].sort());
    } finally {
      await removeExtraAssets(db, [onLoan.asset.assetId, returnRequested.asset.assetId, waiting.asset.assetId]);
    }
  });

  it("no longer counts a loan as delinquent once TSG receives it back (issue #99, H-04 fixed)", async () => {
    const overdue = await addOverdueLoan("TEST-0727", 5);
    try {
      const returned = await asStaff.put(`/api/loans/${overdue.loan.loan_id}/receive`, {
        inspection: { condition: "OPERATIONAL", remarks: "Test return comment" },
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
        progressStatus: "Inspecting",
        createdAt: "2026-02-09",
      },
    ]);
    const { conditionItems, ...counts } = res.body.data.conditionSummary;
    // Only the projector has a TSG inspection in the seed; the other five are counted apart, not as good (#96).
    expect(counts).toEqual({ goodCount: 1, degradedCount: 0, criticalCount: 0, notInspectedCount: 5, totalCount: 6 });
    expect(conditionItems).toEqual([
      { assetTag: ASSETS.inspected.tag, name: ASSETS.inspected.name, category: "PROJECTOR", condition: "OPERATIONAL", trafficLight: "GREEN", location: LAB.shortCode },
    ]);
  });

  it("gives each asset its home lab, not where it is now (the asset in repair shows its lab, not the TSG Office)", async () => {
    const inspection = await db.asset_inspections.create({
      data: { asset_id: ASSETS.inRepair.assetId, inspected_by_id: USERS.staffTsg.userId, type: "ROUTINE", condition: "PERFECT", inspected_at: new Date("2026-04-01T09:00:00Z") },
    });
    try {
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
    } finally {
      await db.asset_inspections.delete({ where: { inspection_id: inspection.inspection_id } });
    }
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
      expect(counts).toEqual({ goodCount: 1, degradedCount: 2, criticalCount: 1, notInspectedCount: 5, totalCount: 9 });
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

  it("counts an asset TSG never inspected apart, and does not call it good or list a condition for it (#96, H-09 family)", async () => {
    const bare = await db.assets.create({ data: { asset_tag: "TEST-0734", name: "Test Asset Without Records", category: "MONITOR", center_id: LAB.centerId } });
    try {
      const res = await asStaff.get("/api/analytics/tsg");

      expect(res.body.data.conditionSummary).toMatchObject({ goodCount: 1, notInspectedCount: 6, totalCount: 7 });
      expect(res.body.data.conditionSummary.conditionItems).toHaveLength(1);
      expect(res.body.data.conditionSummary.conditionItems.map((i: { assetTag: string }) => i.assetTag)).not.toContain("TEST-0734");
    } finally {
      await removeExtraAssets(db, [bare.asset_id]);
    }
  });

  it("lists repairs newest first, with the status label as the progress text", async () => {
    const repair = await db.asset_maintenance.create({
      data: {
        asset_id: ASSETS.available.assetId,
        reported_by_id: USERS.staffTsg.userId,
        issue_description: "Test repair: not received yet",
        status: "PENDING_RECEIPT",
        reported_at: new Date("2026-05-01T09:00:00Z"),
      },
    });
    try {
      const res = await asStaff.get("/api/analytics/tsg");

      expect(res.body.data.repairs.map((r: { repairId: number }) => r.repairId)).toEqual([repair.maintenance_id, SEEDED_ROWS.repairId]);
      expect(res.body.data.repairs[0]).toMatchObject({ reportedBy: USERS.staffTsg.fullName, progressStatus: "Pending Receipt", createdAt: "2026-05-01" });
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
  const SEEDED_LABELS = [
    { name: "Available", value: 3 },
    { name: "On Loan", value: 1 },
    { name: "Maintenance", value: 1 },
    { name: "Pending Retirement", value: 0 },
    { name: "Retired", value: 1 },
    { name: "Missing", value: 0 },
  ];
  const SEEDED = {
    byLocation: [
      { location: "Manila Campus", ...statusCounts(SEEDED_STATUS_COUNTS) },
      { location: "Laguna Campus", ...statusCounts() },
      { location: "McKinley Campus", ...statusCounts() },
    ],
    byStatus: SEEDED_LABELS,
    locationDistribution: [{ location: LAB.shortCode, available: 3, onLoan: 1, underRepair: 1 }],
    statusCounts: SEEDED_LABELS,
  };

  it("counts the seed by campus, status, and home lab, with all six statuses", async () => {
    const res = await asStaff.get("/api/analytics/location-status");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: SEEDED });
  });

  it("takes the lab filter as a home lab's code in any letter case", async () => {
    const lowerCase = await asStaff.get("/api/analytics/location-status?lab=test");
    expect(lowerCase.body.data).toEqual(SEEDED);

    const noMatch = await asStaff.get("/api/analytics/location-status?lab=CAR");
    expect(noMatch.body.data).toEqual({
      byLocation: SEEDED.byLocation.map((c) => ({ ...c, ...statusCounts() })),
      byStatus: SEEDED_LABELS.map((s) => ({ ...s, value: 0 })),
      locationDistribution: [],
      statusCounts: SEEDED_LABELS.map((s) => ({ ...s, value: 0 })),
    });
  });

  it("counts each asset under its home lab's campus, McKinley included, and lists each lab once", async () => {
    await withOtherCampusLabs(async () => {
      const res = await asStaff.get("/api/analytics/location-status");

      expect(res.body.data.byLocation).toEqual([
        { location: "Manila Campus", ...statusCounts(SEEDED_STATUS_COUNTS) },
        { location: "Laguna Campus", ...statusCounts({ AVAILABLE: 1 }) },
        { location: "McKinley Campus", ...statusCounts({ AVAILABLE: 1 }) },
      ]);
      expect(res.body.data.locationDistribution).toEqual([
        { location: LAB.shortCode, available: 3, onLoan: 1, underRepair: 1 },
        { location: "TESTL", available: 1, onLoan: 0, underRepair: 0 },
        { location: "TESTM", available: 1, onLoan: 0, underRepair: 0 },
      ]);
    });
  });

  it("counts Pending Retirement and Missing assets in the status counts, and still lists their lab (#96)", async () => {
    const extras = [
      await addExtraAsset(db, { tag: "TEST-0751", assetStatus: "PENDING_RETIREMENT" }),
      await addExtraAsset(db, { tag: "TEST-0752", assetStatus: "MISSING" }),
    ];
    try {
      const res = await asStaff.get("/api/analytics/location-status");

      const expected = SEEDED_LABELS.map((s) => (s.name === "Pending Retirement" || s.name === "Missing" ? { ...s, value: 1 } : s));
      expect(res.body.data.statusCounts).toEqual(expected);
      expect(res.body.data.locationDistribution).toEqual([{ location: LAB.shortCode, available: 3, onLoan: 1, underRepair: 1 }]);
    } finally {
      await removeExtraAssets(db, extras.map((a) => a.assetId));
    }
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
