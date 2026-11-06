/**
 * Insights API: GET /api/analytics/insights, who may call it, which lab each caller sees, the five rules end to end,
 * the order of the notes, and that the route writes nothing.
 * Covers server/features/analytics/insights.* and the route in analytics.routes.ts. The rules' edge cases are in
 * tests/unit/insightRules.test.ts.
 * Workflow: read-only advice notes (Staff, Lab Head, Director).
 * Fixtures: the whole seed, plus, per test, extra assets at the seeded lab TEST and at a second lab TESTB (tags
 * TEST-0701 onward and TESTB-0001 onward) with a warranty, loan, tickets, purchase date or inspections as the test
 * needs. Each test removes what it added in a finally block, so every test starts from the seed. The seeded rows
 * are never changed.
 */
import { describe, expect, it } from "vitest";
import { serverToday } from "../../server/shared/services/assetState";
import { addExtraAsset, removeExtraAssets } from "../setup/extraAssets";
import { LAB, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { db, as, api } = useApiHarness();
const asDirector = as(USERS.director);
const asLabHead = as(USERS.labHead);
const asStaff = as(USERS.staffTsg);
const asSecretary = as(USERS.secretary);

const DAY_MS = 24 * 60 * 60 * 1000;

/** The server's local day `days` from today, as yyyy-mm-dd. */
const dayFromToday = (days: number) => serverToday(new Date(Date.now() + days * DAY_MS));

/** A DATE column value for a yyyy-mm-dd. */
const dateColumn = (day: string) => new Date(`${day}T00:00:00Z`);

/** A moment `days` ago, at the same time of day, for a DateTime column. */
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

interface InsightBody {
  success: boolean;
  asOfDate: string;
  scope: { type: string; centerId: number | null; code: string | null };
  summary: { high: number; medium: number; planning: number };
  insights: {
    id: string; ruleId: string; view: string; priority: string; assetTag: string; labCode: string;
    title: string; issue: string; preferredAction: string;
    evidence: { label: string; value: string }[]; alternatives: { rank: number; text: string }[]; chartKey: string;
  }[];
}

const insightsOf = (body: unknown) => body as InsightBody;

/** The ids of the insights in an answer. */
const idsOf = (body: unknown) => insightsOf(body).insights.map((i) => i.id);

/** Runs a check with a second lab TESTB that has no Head, and removes it again. */
async function withLabB(check: (centerId: number) => Promise<void>) {
  const labB = await db.research_centers.create({ data: { name: "Test Lab B", short_code: "TESTB", location: "MANILA" } });
  try {
    await check(labB.center_id);
  } finally {
    await db.research_centers.delete({ where: { center_id: labB.center_id } });
  }
}

/** Adds a ticket on an asset, reported by Custodian A `ago` days back. */
const addTicket = (assetId: number, ago: number, status: "RESOLVED" | "REPAIRING" | "CANCELLED" = "RESOLVED") =>
  db.asset_maintenance.create({
    data: {
      asset_id: assetId, reported_by_id: USERS.custodianA.userId, issue_description: "Test issue",
      status, type: "BORROWER_REPORT", reported_at: daysAgo(ago),
    },
  });

/** Adds a Routine inspection by Staff TSG `ago` days back. */
const addInspection = (assetId: number, ago: number, condition: "PERFECT" | "OPERATIONAL" | "DEGRADED" | "CRITICAL_DEFECT", type: "ROUTINE" | "SELF_REPORT" = "ROUTINE") =>
  db.asset_inspections.create({
    data: { asset_id: assetId, inspected_by_id: USERS.staffTsg.userId, type, condition, inspected_at: daysAgo(ago) },
  });

describe("GET /api/analytics/insights: who may call it", () => {
  it("answers 401 without a session", async () => {
    expect((await api.get("/api/analytics/insights")).status).toBe(401);
  });

  it("answers 403 to a Researcher and to the IT Admin", async () => {
    expect((await as(USERS.custodianA).get("/api/analytics/insights")).status).toBe(403);
    expect((await as(USERS.admin).get("/api/analytics/insights")).status).toBe(403);
  });

  it("answers 200 to TSG Staff, the Secretary, the Director, and the Lab Head", async () => {
    for (const client of [asStaff, asSecretary, asDirector, asLabHead]) {
      const res = await client.get("/api/analytics/insights");
      expect(res.status).toBe(200);
      expect(insightsOf(res.body).success).toBe(true);
      expect(insightsOf(res.body).asOfDate).toBe(serverToday());
    }
  });
});

describe("GET /api/analytics/insights: the query", () => {
  it("answers 400 for an unknown lab, a lab that is not a number, and a view that is not offered", async () => {
    expect((await asStaff.get("/api/analytics/insights?centerId=99999")).status).toBe(400);
    expect((await asDirector.get("/api/analytics/insights?centerId=abc")).status).toBe(400);
    expect((await asDirector.get("/api/analytics/insights?centerId=-1")).status).toBe(400);
    expect((await asStaff.get("/api/analytics/insights?view=everything")).status).toBe(400);
  });

  it("takes today from the server and ignores an asOf in the query", async () => {
    const res = await asStaff.get("/api/analytics/insights?asOf=2020-01-01&asOfDate=2020-01-01");
    expect(insightsOf(res.body).asOfDate).toBe(serverToday());
  });
});

describe("GET /api/analytics/insights: the five rules", () => {
  it("returns a note for each rule with its evidence, wording, and chart key", async () => {
    const warranty = await addExtraAsset(db, { tag: "TEST-0701", warrantyExpiry: dateColumn(dayFromToday(10)) });
    const overdue = await addExtraAsset(db, { tag: "TEST-0702", status: "ON_LOAN", custodianId: USERS.custodianA.userId, returnBy: dateColumn(dayFromToday(-9)) });
    const repairs = await addExtraAsset(db, { tag: "TEST-0703" });
    const old = await addExtraAsset(db, { tag: "TEST-0704" });
    const dropping = await addExtraAsset(db, { tag: "TEST-0705" });
    const assetIds = [warranty, overdue, repairs, old, dropping].map((a) => a.assetId);
    try {
      for (const ago of [5, 40, 100]) await addTicket(repairs.assetId, ago);
      await db.assets.update({ where: { asset_id: old.assetId }, data: { category: "MONITOR", procurement_date: dateColumn("2019-01-15") } });
      await addInspection(dropping.assetId, 30, "OPERATIONAL");
      await addInspection(dropping.assetId, 3, "CRITICAL_DEFECT");

      const res = await asStaff.get("/api/analytics/insights");
      expect(res.status).toBe(200);
      const body = insightsOf(res.body);
      const byId = new Map(body.insights.map((i) => [i.id, i]));

      const war = byId.get("WAR-01:TEST-0701")!;
      expect(war).toMatchObject({ view: "operational", priority: "HIGH", title: "Warranty ending soon", chartKey: "warranty", labCode: LAB.shortCode });
      expect(war.issue).toBe(`The warranty for Test Extra Asset TEST-0701 (TEST-0701) ends in 10 days (${dayFromToday(10)}).`);
      expect(war.evidence).toEqual([{ label: "Warranty ends", value: dayFromToday(10) }]);

      const loan = byId.get("LOAN-02:TEST-0702")!;
      expect(loan).toMatchObject({ view: "operational", priority: "MEDIUM", chartKey: "overdueLoans" });
      expect(loan.issue).toContain("is 9 days past its return date.");
      expect(loan.evidence).toEqual([
        { label: "Return by", value: dayFromToday(-9) },
        { label: "Borrower", value: "Test Custodian A" },
      ]);

      const rep = byId.get("REP-03:TEST-0703")!;
      expect(rep).toMatchObject({ view: "operational", priority: "MEDIUM", chartKey: "repairs" });
      expect(rep.issue).toContain("had 3 repair tickets in the last 180 days.");
      expect(rep.evidence).toHaveLength(3);

      const life = byId.get("LIFE-04:TEST-0704")!;
      expect(life).toMatchObject({ view: "strategic", priority: "PLANNING", chartKey: "lifecycle" });
      expect(life.issue).toContain("a review point, not policy");

      const cond = byId.get("COND-05:TEST-0705")!;
      expect(cond).toMatchObject({ view: "operational", priority: "HIGH", chartKey: "condition" });
      expect(cond.issue).toContain("went from Operational to Critical Defect");

      for (const insight of body.insights) {
        expect(insight.alternatives.length).toBeGreaterThanOrEqual(1);
        expect(insight.alternatives.length).toBeLessThanOrEqual(2);
      }
    } finally {
      await removeExtraAssets(db, assetIds);
    }
  });

  it("leaves out an asset that does not qualify, a Retired asset, and a Cancelled ticket", async () => {
    const quiet = await addExtraAsset(db, { tag: "TEST-0711", warrantyExpiry: dateColumn(dayFromToday(91)) });
    const retired = await addExtraAsset(db, { tag: "TEST-0712", status: "DISPOSED", warrantyExpiry: dateColumn(dayFromToday(5)) });
    const cancelled = await addExtraAsset(db, { tag: "TEST-0713" });
    const selfReport = await addExtraAsset(db, { tag: "TEST-0714" });
    const assetIds = [quiet, retired, cancelled, selfReport].map((a) => a.assetId);
    try {
      await addTicket(cancelled.assetId, 5);
      await addTicket(cancelled.assetId, 10);
      await addTicket(cancelled.assetId, 15, "CANCELLED");
      await addInspection(selfReport.assetId, 30, "OPERATIONAL");
      await addInspection(selfReport.assetId, 3, "CRITICAL_DEFECT", "SELF_REPORT");

      const ids = idsOf((await asStaff.get("/api/analytics/insights")).body);
      for (const tag of ["TEST-0711", "TEST-0712", "TEST-0713", "TEST-0714"]) {
        expect(ids.filter((id) => id.endsWith(`:${tag}`))).toEqual([]);
      }
    } finally {
      await removeExtraAssets(db, assetIds);
    }
  });

  it("filters by view and counts what it returns", async () => {
    const warranty = await addExtraAsset(db, { tag: "TEST-0721", warrantyExpiry: dateColumn(dayFromToday(40)) });
    const old = await addExtraAsset(db, { tag: "TEST-0722" });
    try {
      await db.assets.update({ where: { asset_id: old.assetId }, data: { category: "ROUTER", procurement_date: dateColumn("2018-03-01") } });

      const operational = insightsOf((await asStaff.get("/api/analytics/insights?view=operational")).body);
      const strategic = insightsOf((await asStaff.get("/api/analytics/insights?view=strategic")).body);
      const all = insightsOf((await asStaff.get("/api/analytics/insights?view=all")).body);

      expect(operational.insights.every((i) => i.view === "operational")).toBe(true);
      expect(strategic.insights.every((i) => i.view === "strategic")).toBe(true);
      expect(operational.insights.map((i) => i.id)).toContain("WAR-01:TEST-0721");
      expect(strategic.insights.map((i) => i.id)).toContain("LIFE-04:TEST-0722");
      expect(all.insights).toHaveLength(operational.insights.length + strategic.insights.length);
      expect(strategic.summary).toEqual({ high: 0, medium: 0, planning: strategic.insights.length });
      expect(all.summary.high + all.summary.medium + all.summary.planning).toBe(all.insights.length);
      expect(insightsOf((await asStaff.get("/api/analytics/insights")).body).insights).toHaveLength(all.insights.length);
    } finally {
      await removeExtraAssets(db, [warranty.assetId, old.assetId]);
    }
  });

  it("sorts HIGH, MEDIUM, PLANNING, then the most urgent, then by id", async () => {
    const a = await addExtraAsset(db, { tag: "TEST-0731", warrantyExpiry: dateColumn(dayFromToday(60)) });
    const b = await addExtraAsset(db, { tag: "TEST-0732", warrantyExpiry: dateColumn(dayFromToday(20)) });
    const c = await addExtraAsset(db, { tag: "TEST-0733", warrantyExpiry: dateColumn(dayFromToday(5)) });
    const d = await addExtraAsset(db, { tag: "TEST-0734", warrantyExpiry: dateColumn(dayFromToday(5)) });
    const e = await addExtraAsset(db, { tag: "TEST-0735" });
    try {
      await db.assets.update({ where: { asset_id: e.assetId }, data: { category: "DEV_KIT", procurement_date: dateColumn("2015-01-01") } });
      const ids = idsOf((await asStaff.get("/api/analytics/insights")).body).filter((id) => /TEST-073\d/.test(id));
      expect(ids).toEqual(["WAR-01:TEST-0733", "WAR-01:TEST-0734", "WAR-01:TEST-0732", "WAR-01:TEST-0731", "LIFE-04:TEST-0735"]);
    } finally {
      await removeExtraAssets(db, [a, b, c, d, e].map((x) => x.assetId));
    }
  });

  it("words the preferred action for each viewer", async () => {
    const warranty = await addExtraAsset(db, { tag: "TEST-0741", warrantyExpiry: dateColumn(dayFromToday(20)) });
    try {
      const action = async (client: typeof asStaff) =>
        insightsOf((await client.get("/api/analytics/insights")).body).insights.find((i) => i.id === "WAR-01:TEST-0741")!.preferredAction;
      expect(await action(asLabHead)).toBe("Consider asking TSG for a condition check before it ends.");
      expect(await action(asStaff)).toBe("Consider an inspection before the warranty ends.");
      expect(await action(asSecretary)).toBe("Consider an inspection before the warranty ends.");
      expect(await action(asDirector)).toBe("Review assets whose warranty ends soon.");
    } finally {
      await removeExtraAssets(db, [warranty.assetId]);
    }
  });
});

describe("GET /api/analytics/insights: which lab each caller sees", () => {
  it("gives a Lab Head only their own lab and 403 for another lab", async () => {
    await withLabB(async (labBId) => {
      const mine = await addExtraAsset(db, { tag: "TEST-0751", warrantyExpiry: dateColumn(dayFromToday(10)) });
      const theirs = await addExtraAsset(db, { tag: "TESTB-0001", centerId: labBId, warrantyExpiry: dateColumn(dayFromToday(10)) });
      try {
        const res = await asLabHead.get("/api/analytics/insights");
        const body = insightsOf(res.body);
        expect(body.scope).toEqual({ type: "lab", centerId: LAB.centerId, code: LAB.shortCode });
        expect(body.insights.map((i) => i.id)).toContain("WAR-01:TEST-0751");
        expect(body.insights.every((i) => i.labCode === LAB.shortCode)).toBe(true);
        expect(JSON.stringify(res.body)).not.toContain("TESTB-0001");

        expect((await asLabHead.get(`/api/analytics/insights?centerId=${labBId}`)).status).toBe(403);
        expect((await asLabHead.get(`/api/analytics/insights?centerId=99999`)).status).toBe(403);
        const own = await asLabHead.get(`/api/analytics/insights?centerId=${LAB.centerId}`);
        expect(own.status).toBe(200);
        expect(idsOf(own.body)).toContain("WAR-01:TEST-0751");
      } finally {
        await removeExtraAssets(db, [mine.assetId, theirs.assetId]);
      }
    });
  });

  it("gives TSG Staff and the Director every lab, or one lab with centerId", async () => {
    await withLabB(async (labBId) => {
      const a = await addExtraAsset(db, { tag: "TEST-0761", warrantyExpiry: dateColumn(dayFromToday(10)) });
      const b = await addExtraAsset(db, { tag: "TESTB-0002", centerId: labBId, warrantyExpiry: dateColumn(dayFromToday(10)) });
      try {
        for (const client of [asStaff, asDirector]) {
          const everyLab = insightsOf((await client.get("/api/analytics/insights")).body);
          expect(everyLab.scope).toEqual({ type: "all", centerId: null, code: null });
          expect(everyLab.insights.map((i) => i.id)).toEqual(expect.arrayContaining(["WAR-01:TEST-0761", "WAR-01:TESTB-0002"]));

          const oneLab = insightsOf((await client.get(`/api/analytics/insights?centerId=${labBId}`)).body);
          expect(oneLab.scope).toEqual({ type: "lab", centerId: labBId, code: "TESTB" });
          expect(oneLab.insights.map((i) => i.id)).toEqual(["WAR-01:TESTB-0002"]);
        }
      } finally {
        await removeExtraAssets(db, [a.assetId, b.assetId]);
      }
    });
  });

  it("scopes by the asset's home lab, not by its tag", async () => {
    await withLabB(async (labBId) => {
      const odd = await addExtraAsset(db, { tag: "TEST-0771", centerId: labBId, warrantyExpiry: dateColumn(dayFromToday(10)) });
      try {
        expect(idsOf((await asLabHead.get("/api/analytics/insights")).body)).not.toContain("WAR-01:TEST-0771");
        expect(idsOf((await asStaff.get(`/api/analytics/insights?centerId=${labBId}`)).body)).toContain("WAR-01:TEST-0771");
      } finally {
        await removeExtraAssets(db, [odd.assetId]);
      }
    });
  });
});

describe("GET /api/analytics/insights: what the answer holds and what it changes", () => {
  it("sends no email, ID number, or password, only the borrower's name", async () => {
    const overdue = await addExtraAsset(db, { tag: "TEST-0781", status: "ON_LOAN", custodianId: USERS.custodianB.userId, returnBy: dateColumn(dayFromToday(-20)) });
    try {
      const res = await asDirector.get("/api/analytics/insights");
      const text = JSON.stringify(res.body);
      expect(idsOf(res.body)).toContain("LOAN-02:TEST-0781");
      expect(text).toContain("Test Custodian B");
      expect(text).not.toContain("@");
      expect(text).not.toMatch(/example\.test|password|idNumber|id_number|email/i);
    } finally {
      await removeExtraAssets(db, [overdue.assetId]);
    }
  });

  it("writes nothing", async () => {
    const warranty = await addExtraAsset(db, { tag: "TEST-0791", warrantyExpiry: dateColumn(dayFromToday(10)) });
    const counts = async () => ({
      assets: await db.assets.count(),
      loans: await db.asset_loans.count(),
      maintenance: await db.asset_maintenance.count(),
      inspections: await db.asset_inspections.count(),
      retirements: await db.asset_retirements.count(),
      activity: await db.activity_log.count(),
      tickets: await db.user_tickets.count(),
      users: await db.users.count(),
    });
    try {
      const before = await counts();
      for (const client of [asStaff, asDirector, asLabHead, asSecretary]) {
        expect((await client.get("/api/analytics/insights?view=all")).status).toBe(200);
      }
      expect(await counts()).toEqual(before);
    } finally {
      await removeExtraAssets(db, [warranty.assetId]);
    }
  });
});
