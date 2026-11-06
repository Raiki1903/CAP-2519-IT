/**
 * Loans per week API: GET /api/analytics/utilization, who may call it, which lab each caller sees, the week counts, the
 * average loan length, the busiest weeks, the empty answer, and that the route writes nothing.
 * Covers server/features/analytics/utilization.* and the route in analytics.routes.ts.
 * Workflow: read-only loans per week chart (Director, Lab Head).
 * Fixtures: the whole seed (its two loans have no release time, so no seeded loan counts), plus, per test, extra assets at
 * the seeded lab TEST and at a second lab TESTB (tags TEST-08xx and TESTB-08xx) with loans written straight into
 * asset_loans. Each test removes what it added in a finally block, so every test starts from the seed.
 * Dates are built from the server's own "today" (serverToday), so the counts hold whatever day the tests run.
 */
import { describe, expect, it } from "vitest";
import { addDays, mondayOf } from "../../server/features/analytics/insights.rules";
import { serverToday } from "../../server/shared/services/assetState";
import { addExtraAsset, removeExtraAssets } from "../setup/extraAssets";
import { LAB, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { db, as, api } = useApiHarness();
const asDirector = as(USERS.director);
const asLabHead = as(USERS.labHead);
const asStaff = as(USERS.staffTsg);

interface WeekRow { weekStart: string; loansOut: number; loansReleased: number }
interface Series { weeks: WeekRow[]; averageLoanDays: number | null; busiestWeeks: string[] }
interface UtilizationBody extends Series {
  success: boolean;
  asOfDate: string;
  weekCount: number;
  scope: { type: string; centerId: number | null; code: string | null };
  total: Series;
  labs: (Series & { centerId: number; code: string })[];
}

const bodyOf = (body: unknown) => body as UtilizationBody;

const TODAY = serverToday();
const MONDAY = mondayOf(TODAY);

/** 10:00 in the server's local time zone on a yyyy-mm-dd, for a DateTime column. */
const morningOf = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 10, 0, 0);
};

/** The Monday `weeks` weeks before this week's Monday. */
const mondayBack = (weeks: number) => addDays(MONDAY, -7 * weeks);

/** Writes a loan that was handed over on `released` and, unless `closed` is null, closed on `closed` (both yyyy-mm-dd). */
const addLoan = (assetId: number, released: string, closed: string | null) =>
  db.asset_loans.create({
    data: {
      asset_id: assetId,
      borrower_id: USERS.custodianA.userId,
      purpose: "Test purpose: loans per week",
      return_by: new Date(`${addDays(TODAY, 30)}T00:00:00Z`),
      status: closed ? "RETURNED" : "ON_LOAN",
      released_at: morningOf(released),
      closed_at: closed ? morningOf(closed) : null,
    },
  });

/** Runs a check with a second lab TESTB that has no Head, and removes it again. */
async function withLabB(check: (centerId: number) => Promise<void>) {
  const labB = await db.research_centers.create({ data: { name: "Test Lab B", short_code: "TESTB", location: "MANILA" } });
  try {
    await check(labB.center_id);
  } finally {
    await db.research_centers.delete({ where: { center_id: labB.center_id } });
  }
}

describe("GET /api/analytics/utilization: who may call it", () => {
  it("answers 401 without a session", async () => {
    expect((await api.get("/api/analytics/utilization")).status).toBe(401);
  });

  it("answers 403 to a Researcher and to the IT Admin", async () => {
    expect((await as(USERS.custodianA).get("/api/analytics/utilization")).status).toBe(403);
    expect((await as(USERS.admin).get("/api/analytics/utilization")).status).toBe(403);
  });

  it("answers 200 to TSG Staff, the Director, and the Lab Head, with today taken from the server", async () => {
    for (const client of [asStaff, asDirector, asLabHead]) {
      const res = await client.get("/api/analytics/utilization?asOf=2020-01-01");
      expect(res.status).toBe(200);
      expect(bodyOf(res.body).asOfDate).toBe(TODAY);
    }
  });
});

describe("GET /api/analytics/utilization: the query", () => {
  it("shows 12 weeks by default, this week last, and as many as asked", async () => {
    const body = bodyOf((await asDirector.get("/api/analytics/utilization")).body);
    expect(body.weekCount).toBe(12);
    expect(body.total.weeks).toHaveLength(12);
    expect(body.total.weeks[0].weekStart).toBe(mondayBack(11));
    expect(body.total.weeks[11].weekStart).toBe(MONDAY);
    expect(bodyOf((await asDirector.get("/api/analytics/utilization?weeks=4")).body).total.weeks).toHaveLength(4);
  });

  it("answers 400 for weeks outside 1 to 52, a lab that does not exist, and a lab that is not a number", async () => {
    for (const weeks of ["0", "53", "abc", "-1", "1.5"]) {
      expect((await asDirector.get(`/api/analytics/utilization?weeks=${weeks}`)).status).toBe(400);
    }
    expect((await asStaff.get("/api/analytics/utilization?centerId=99999")).status).toBe(400);
    expect((await asDirector.get("/api/analytics/utilization?centerId=abc")).status).toBe(400);
  });
});

describe("GET /api/analytics/utilization: the counts", () => {
  it("counts a loan in every week it touches, the average length of closed loans, and the busiest weeks", async () => {
    const [a, b, c, d, e] = await Promise.all(["TEST-0801", "TEST-0802", "TEST-0803", "TEST-0804", "TEST-0805"].map((tag) => addExtraAsset(db, { tag })));
    try {
      // A: released 15 days before this Monday, closed 6 days before it (9 days): out in three weeks.
      await addLoan(a.assetId, addDays(MONDAY, -15), addDays(MONDAY, -6));
      // B: released 8 days before this Monday and never closed: out from then until now.
      await addLoan(b.assetId, addDays(MONDAY, -8), null);
      // C: released and closed on this Monday (0 days).
      await addLoan(c.assetId, MONDAY, MONDAY);
      // D: closed long before the first week shown, so it counts nowhere, not even in the average.
      await addLoan(d.assetId, addDays(MONDAY, -100), addDays(MONDAY, -90));
      // E: released on the Sunday before this Monday and closed on it (1 day): out in two weeks, across the boundary.
      await addLoan(e.assetId, addDays(MONDAY, -1), MONDAY);

      const res = await asDirector.get("/api/analytics/utilization");
      expect(res.status).toBe(200);
      const body = bodyOf(res.body);
      const weekOf = (weeksBack: number) => body.total.weeks.find((w) => w.weekStart === mondayBack(weeksBack))!;

      expect(weekOf(3)).toEqual({ weekStart: mondayBack(3), loansOut: 1, loansReleased: 1 });
      expect(weekOf(2)).toEqual({ weekStart: mondayBack(2), loansOut: 2, loansReleased: 1 });
      expect(weekOf(1)).toEqual({ weekStart: mondayBack(1), loansOut: 3, loansReleased: 1 });
      expect(weekOf(0)).toEqual({ weekStart: MONDAY, loansOut: 3, loansReleased: 1 });
      for (const weeksBack of [4, 5, 11]) expect(weekOf(weeksBack).loansOut).toBe(0);

      // Closed loans in the weeks shown: A 9 days, C 0 days, E 1 day. B is still open and D is out of range.
      expect(body.total.averageLoanDays).toBe(3.3);
      // Three weeks are busiest; the two with 3 loans first (the newer one first), then the week with 2.
      expect(body.total.busiestWeeks).toEqual([MONDAY, mondayBack(1), mondayBack(2)]);

      expect(body.labs).toHaveLength(1);
      expect(body.labs[0]).toMatchObject({ centerId: LAB.centerId, code: LAB.shortCode });
      expect(body.labs[0].weeks).toEqual(body.total.weeks);
      expect(body.labs[0].averageLoanDays).toBe(3.3);
    } finally {
      await removeExtraAssets(db, [a, b, c, d, e].map((x) => x.assetId));
    }
  });

  it("answers an empty series when no loan was handed over", async () => {
    const body = bodyOf((await asDirector.get("/api/analytics/utilization")).body);
    expect(body.total.weeks.every((w) => w.loansOut === 0 && w.loansReleased === 0)).toBe(true);
    expect(body.total.averageLoanDays).toBeNull();
    expect(body.total.busiestWeeks).toEqual([]);
    expect(body.labs).toEqual([]);
  });

  it("leaves out a loan that was never handed over", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0811" });
    try {
      await db.asset_loans.create({
        data: { asset_id: asset.assetId, borrower_id: USERS.custodianA.userId, purpose: "Test purpose: waiting", return_by: new Date(`${addDays(TODAY, 30)}T00:00:00Z`), status: "PENDING_RELEASE" },
      });
      const body = bodyOf((await asDirector.get("/api/analytics/utilization")).body);
      expect(body.total.weeks.every((w) => w.loansOut === 0)).toBe(true);
    } finally {
      await removeExtraAssets(db, [asset.assetId]);
    }
  });
});

describe("GET /api/analytics/utilization: which lab each caller sees", () => {
  it("gives a Lab Head only their own lab and 403 for another lab", async () => {
    await withLabB(async (labBId) => {
      const mine = await addExtraAsset(db, { tag: "TEST-0821" });
      const theirs = await addExtraAsset(db, { tag: "TESTB-0821", centerId: labBId });
      try {
        await addLoan(mine.assetId, addDays(MONDAY, -8), addDays(MONDAY, -2));
        await addLoan(theirs.assetId, addDays(MONDAY, -8), null);

        const body = bodyOf((await asLabHead.get("/api/analytics/utilization")).body);
        expect(body.scope).toEqual({ type: "lab", centerId: LAB.centerId, code: LAB.shortCode });
        expect(body.labs.map((l) => l.code)).toEqual([LAB.shortCode]);
        expect(body.total.weeks.find((w) => w.weekStart === mondayBack(1))!.loansOut).toBe(1);
        expect(body.total.averageLoanDays).toBe(6);

        expect((await asLabHead.get(`/api/analytics/utilization?centerId=${labBId}`)).status).toBe(403);
        expect((await asLabHead.get(`/api/analytics/utilization?centerId=${LAB.centerId}`)).status).toBe(200);
      } finally {
        await removeExtraAssets(db, [mine.assetId, theirs.assetId]);
      }
    });
  });

  it("gives TSG Staff and the Director every lab, or one lab with centerId, by the asset's home lab", async () => {
    await withLabB(async (labBId) => {
      const mine = await addExtraAsset(db, { tag: "TEST-0831" });
      const theirs = await addExtraAsset(db, { tag: "TESTB-0831", centerId: labBId });
      try {
        await addLoan(mine.assetId, addDays(MONDAY, -8), addDays(MONDAY, -2));
        // The loan goes to a room of lab TEST, but the asset's home lab is TESTB, so it counts for TESTB.
        await addLoan(theirs.assetId, addDays(MONDAY, -8), null);
        await db.asset_loans.updateMany({ where: { asset_id: theirs.assetId }, data: { destination_center_id: LAB.centerId } });

        for (const client of [asStaff, asDirector]) {
          const everyLab = bodyOf((await client.get("/api/analytics/utilization")).body);
          expect(everyLab.scope).toEqual({ type: "all", centerId: null, code: null });
          expect(everyLab.labs.map((l) => l.code)).toEqual(["TEST", "TESTB"]);
          expect(everyLab.total.weeks.find((w) => w.weekStart === mondayBack(1))!.loansOut).toBe(2);

          const oneLab = bodyOf((await client.get(`/api/analytics/utilization?centerId=${labBId}`)).body);
          expect(oneLab.scope).toEqual({ type: "lab", centerId: labBId, code: "TESTB" });
          expect(oneLab.labs.map((l) => l.code)).toEqual(["TESTB"]);
          expect(oneLab.total.weeks.find((w) => w.weekStart === mondayBack(1))!.loansOut).toBe(1);
          expect(oneLab.total.averageLoanDays).toBeNull();
        }
      } finally {
        await removeExtraAssets(db, [mine.assetId, theirs.assetId]);
      }
    });
  });
});

describe("GET /api/analytics/utilization: what the answer holds and what it changes", () => {
  it("sends no names, emails, or ID numbers", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0841" });
    try {
      await addLoan(asset.assetId, addDays(MONDAY, -8), null);
      const text = JSON.stringify((await asDirector.get("/api/analytics/utilization")).body);
      expect(text).not.toMatch(/example\.test|@|Custodian|password|idNumber|id_number|email/i);
    } finally {
      await removeExtraAssets(db, [asset.assetId]);
    }
  });

  it("writes nothing", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0851" });
    const counts = async () => ({
      assets: await db.assets.count(),
      loans: await db.asset_loans.count(),
      maintenance: await db.asset_maintenance.count(),
      inspections: await db.asset_inspections.count(),
      activity: await db.activity_log.count(),
      users: await db.users.count(),
    });
    try {
      await addLoan(asset.assetId, addDays(MONDAY, -8), null);
      const before = await counts();
      for (const client of [asStaff, asDirector, asLabHead]) {
        expect((await client.get("/api/analytics/utilization")).status).toBe(200);
      }
      expect(await counts()).toEqual(before);
    } finally {
      await removeExtraAssets(db, [asset.assetId]);
    }
  });
});
