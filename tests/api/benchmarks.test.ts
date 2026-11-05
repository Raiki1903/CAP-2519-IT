/**
 * Benchmark data API: an asset's metric values and health scores over time, each flagged by its rule.
 * Covers GET /api/assets/:tag/benchmarks.
 * Workflow: benchmark data for TSG, the Director, and the Head of the asset's home lab (no screen yet).
 * Fixtures: the accounts (USERS), LAB (headed by the Lab Head), and the metrics of LOOKUPS (CPU measures CPU load
 * temperature, bad sectors, and battery capacity; DEV_KIT measures none). The tests add their own assets
 * (TEST-0601 onward) and write their inspections directly, with fixed times. Nothing is written by the endpoint.
 */
import { describe, expect, it } from "vitest";
import { addExtraAsset } from "../setup/extraAssets";
import { USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";
import { NOT_YOUR_LAB_BENCHMARKS_MESSAGE } from "../../server/features/assets/assets.service";

const { db, as } = useApiHarness();

const FORBIDDEN = "Your role is not allowed to do this.";

/** An inspection on the asset at a fixed time, with its metric values. */
async function inspect(assetId: number, at: string, data: { type?: "INITIAL" | "ROUTINE" | "SELF_REPORT"; healthScore?: number; metrics?: [number, number][] }) {
  const row = await db.asset_inspections.create({
    data: {
      asset_id: assetId,
      inspected_by_id: data.type === "SELF_REPORT" ? USERS.custodianA.userId : USERS.staffTsg.userId,
      type: data.type ?? "ROUTINE",
      condition: "OPERATIONAL",
      health_score: data.healthScore ?? null,
      inspected_at: new Date(at),
    },
  });
  if (data.metrics) {
    await db.asset_inspection_metrics.createMany({ data: data.metrics.map(([metricId, value]) => ({ inspection_id: row.inspection_id, metric_id: metricId, value })) });
  }
  return row.inspection_id;
}

describe("GET /api/assets/:tag/benchmarks", () => {
  it("flags a metric against its baseline, the asset's first value, and leaves out Self Reports", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0601" });
    await db.assets.update({ where: { asset_id: asset.assetId }, data: { category: "CPU" } });
    const first = await inspect(asset.assetId, "2026-05-01T09:00:00Z", { type: "INITIAL", healthScore: 90, metrics: [[1, 50], [2, 0]] });
    const second = await inspect(asset.assetId, "2026-06-01T09:00:00Z", { healthScore: 40, metrics: [[1, 66], [2, 0]] });
    await inspect(asset.assetId, "2026-06-15T09:00:00Z", { type: "SELF_REPORT", healthScore: 10, metrics: [[1, 99]] });

    const res = await as(USERS.staffTsg).get(`/api/assets/${asset.tag}/benchmarks`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      metrics: [
        {
          metricId: 1, metricKey: "CPU_LOAD_TEMP", name: "CPU load temperature", unit: "°C", higherIsBetter: false,
          points: [
            { inspectionId: first, inspectedAt: "2026-05-01T09:00:00.000Z", value: 50, flagged: false },
            // 15 °C or more above the baseline of 50.
            { inspectionId: second, inspectedAt: "2026-06-01T09:00:00.000Z", value: 66, flagged: true },
          ],
        },
        {
          metricId: 2, metricKey: "BAD_SECTORS", name: "Bad sectors", unit: "count", higherIsBetter: false,
          points: [
            { inspectionId: first, inspectedAt: "2026-05-01T09:00:00.000Z", value: 0, flagged: false },
            { inspectionId: second, inspectedAt: "2026-06-01T09:00:00.000Z", value: 0, flagged: false },
          ],
        },
        { metricId: 3, metricKey: "BATTERY_CAPACITY", name: "Battery capacity", unit: "% of design", higherIsBetter: true, points: [] },
      ],
      // A category with metrics never flags a health score.
      healthScores: [
        { inspectionId: first, inspectedAt: "2026-05-01T09:00:00.000Z", healthScore: 90, flagged: false },
        { inspectionId: second, inspectedAt: "2026-06-01T09:00:00.000Z", healthScore: 40, flagged: false },
      ],
    });
  });

  it("gives an asset whose category has no metrics no metrics, and flags its health scores below 50", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0602" });
    const good = await inspect(asset.assetId, "2026-05-01T09:00:00Z", { type: "INITIAL", healthScore: 80 });
    await inspect(asset.assetId, "2026-05-15T09:00:00Z", {});
    const bad = await inspect(asset.assetId, "2026-06-01T09:00:00Z", { healthScore: 30 });

    const res = await as(USERS.staffTsg).get(`/api/assets/${asset.tag}/benchmarks`);

    expect(res.status).toBe(200);
    expect(res.body.metrics).toEqual([]);
    expect(res.body.healthScores).toEqual([
      { inspectionId: good, inspectedAt: "2026-05-01T09:00:00.000Z", healthScore: 80, flagged: false },
      { inspectionId: bad, inspectedAt: "2026-06-01T09:00:00.000Z", healthScore: 30, flagged: true },
    ]);
  });

  it("answers TSG, the Director, and the Head of the asset's home lab with the same data", async () => {
    const asset = await addExtraAsset(db, { tag: "TEST-0603" });
    await inspect(asset.assetId, "2026-05-01T09:00:00Z", { type: "INITIAL", healthScore: 70 });

    const answers = await Promise.all([USERS.staffTsg, USERS.director, USERS.labHead].map(u => as(u).get(`/api/assets/${asset.tag}/benchmarks`)));

    for (const res of answers) {
      expect(res.status).toBe(200);
      expect(res.body).toEqual(answers[0].body);
    }
    expect(answers[0].body.healthScores).toHaveLength(1);
  });

  it.each([
    ["a Researcher", USERS.custodianA],
    ["the Secretary", USERS.secretary],
    ["the IT Admin", USERS.admin],
  ])("answers 403 to %s", async (_who, user) => {
    const asset = await addExtraAsset(db, { tag: `TEST-06${10 + user.userId}` });

    const res = await as(user).get(`/api/assets/${asset.tag}/benchmarks`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: FORBIDDEN });
  });

  it("answers 403 to the Head of another lab", async () => {
    const otherLab = await db.research_centers.create({ data: { name: "Test Lab BENCH", short_code: "BENCH", location: "MANILA" } });
    const asset = await addExtraAsset(db, { tag: "BENCH-0001", centerId: otherLab.center_id });

    const res = await as(USERS.labHead).get(`/api/assets/${asset.tag}/benchmarks`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: NOT_YOUR_LAB_BENCHMARKS_MESSAGE });
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await as(USERS.staffTsg).get("/api/assets/TEST-9999/benchmarks");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: "No asset found with tag TEST-9999." });
  });
});
