/**
 * Lookups API: the option lists the forms pick from, and the custodian list Staff pick from.
 * Covers GET /api/lookups and GET /api/lookups/users. Workflow: Edit Asset, Register Equipment, the borrow form, and the
 * sign-up page (issue #12).
 * Fixtures: the seeded research center (LAB) and accounts (USERS). The first test adds a second, Laguna research center,
 * which stays for the rest of this file.
 */
import { describe, expect, it } from "vitest";
import { ASSET_CATEGORIES } from "../../shared/enums/assetCategory";
import { FUNDING_SOURCES } from "../../shared/constants/fundingSources";
import { LAB, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db, as } = useApiHarness();

/** A second research center, so the answer shows the order and both campuses. Made-up values. */
const LAGUNA_LAB = { code: "TESTL", name: "Test Laguna Lab", campus: "LAGUNA" } as const;

describe("GET /api/lookups", () => {
  it("answers the labs by code, name, and campus, the categories, the funding sources, and the statuses, with no session", async () => {
    await db.research_centers.create({ data: { name: LAGUNA_LAB.name, short_code: LAGUNA_LAB.code, location: LAGUNA_LAB.campus } });

    const res = await api.get("/api/lookups");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      labs: [
        { code: LAB.shortCode, name: LAB.name, campus: LAB.location },
        LAGUNA_LAB,
      ],
      categories: ASSET_CATEGORIES,
      fundingSources: FUNDING_SOURCES,
      statuses: ["ACTIVE", "ON_LOAN", "MAINTENANCE"],
    });
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
  it("lists the Custodian accounts to Staff by user id and name only, without the placeholder or any other role", async () => {
    const res = await as(USERS.staffTsg).get("/api/lookups/users");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      users: [
        { userId: USERS.custodianA.userId, name: USERS.custodianA.fullName },
        { userId: USERS.custodianB.userId, name: USERS.custodianB.fullName },
      ],
    });
  });
});
