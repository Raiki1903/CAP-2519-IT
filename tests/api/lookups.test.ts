/**
 * Lookups API: the option lists the forms pick from, and the custodian list Staff pick from.
 * Covers GET /api/lookups, and that GET /api/lookups/users is gone. Workflow: Edit Asset, Register Equipment, the borrow
 * form, Report an issue, the inspection forms, and the sign-up page (issue #12).
 * Fixtures: the seeded research center (LAB), accounts (USERS), and lookup rows (LOOKUPS). The first test adds a second,
 * Laguna research center, which stays for the rest of this file.
 */
import { describe, expect, it } from "vitest";
import { ASSET_CATEGORIES, ASSET_CATEGORY_LABELS, type AssetCategory } from "../../shared/enums/assetCategory";
import { LAB, LOOKUPS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db, as } = useApiHarness();

/** A second research center, so the answer shows the order and both campuses. Made-up values. */
const LAGUNA_LAB = { code: "TESTL", name: "Test Laguna Lab", campus: "LAGUNA" } as const;

describe("GET /api/lookups", () => {
  it("answers the labs with their campus and Head, the categories with labels, and the lookup tables, with no session", async () => {
    const laguna = await db.research_centers.create({ data: { name: LAGUNA_LAB.name, short_code: LAGUNA_LAB.code, location: LAGUNA_LAB.campus } });
    const res = await api.get("/api/lookups");

    expect(res.status).toBe(200);
    expect(res.body.labs).toEqual([
      { centerId: LAB.centerId, code: LAB.shortCode, name: LAB.name, campus: LAB.location, campusLabel: "Manila", headUserId: USERS.labHead.userId },
      { centerId: laguna.center_id, ...LAGUNA_LAB, campusLabel: "Laguna", headUserId: null },
    ]);
    expect(res.body.categories).toEqual(ASSET_CATEGORIES.map(key => ({ key, label: ASSET_CATEGORY_LABELS[key as AssetCategory] })));
    expect(res.body.fundingSources).toEqual([...LOOKUPS.fundingSources].sort((a, b) => a.name.localeCompare(b.name)));
    expect(res.body.issueTypes).toEqual(LOOKUPS.issueTypes);
    expect(res.body.projects).toEqual([]);
    expect(res.body).not.toHaveProperty("statuses");
    // CPU measures the three seeded metrics and a tablet the battery; a monitor has none.
    expect(res.body.metricsByCategory.CPU).toEqual(LOOKUPS.metrics);
    expect(res.body.metricsByCategory.TABLET).toEqual([LOOKUPS.metrics[2]]);
    expect(res.body.metricsByCategory.MONITOR).toBeUndefined();
  });

  it("sends no person in the public answer", async () => {
    const res = await api.get("/api/lookups");
    const text = JSON.stringify(res.body);

    expect(res.body.users).toBeUndefined();
    for (const user of Object.values(USERS)) {
      expect(text).not.toContain(user.lastName);
      expect(text).not.toContain(String(user.idNumber));
    }
    expect(text).not.toContain("@");
  });
});

describe("GET /api/lookups/users", () => {
  it("is gone with Edit Asset's custodian field: 404", async () => {
    const res = await as(USERS.staffTsg).get("/api/lookups/users");

    expect(res.status).toBe(404);
  });
});
