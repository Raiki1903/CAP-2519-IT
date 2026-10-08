/**
 * Smoke test: proves the harness works end to end before any feature test relies on it.
 * Covers GET /api/assets and POST /api/auth/login. Workflow: none in particular (startup, asset list, login).
 * Fixtures: the seeded assets (ASSETS) and Custodian A (USERS.custodianA).
 */
import { describe, expect, it } from "vitest";
import { ASSETS, LAB, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api } = useApiHarness();

describe("smoke", () => {
  it("answers GET /api/assets with 200 and success true", async () => {
    const res = await api.get("/api/assets");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.assets)).toBe(true);
  });

  it("lists every seeded asset by tag, with its name and status", async () => {
    const res = await api.get("/api/assets");
    const seeded = Object.values(ASSETS);

    expect(res.body.assets).toHaveLength(seeded.length);
    for (const asset of seeded) {
      const listed = res.body.assets.find((a: { id: string }) => a.id === asset.tag);
      expect(listed, asset.tag).toMatchObject({ name: asset.name, status: asset.listStatus });
    }
  });

  it("logs in a seeded custodian and answers with role Custodian and their profile", async () => {
    const res = await api.post("/api/auth/login", { email: USERS.custodianA.email, password: USERS.custodianA.password });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      role: "Custodian",
      user: {
        userId: USERS.custodianA.userId,
        email: USERS.custodianA.email,
        firstName: USERS.custodianA.firstName,
        lastName: USERS.custodianA.lastName,
        labAffiliation: LAB.shortCode,
        staffUnit: null,
      },
    });
  });
});
