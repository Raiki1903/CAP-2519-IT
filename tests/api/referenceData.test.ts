/**
 * Reference Data API: asset categories, labs, and funding sources, as TSG and the Secretary keep them.
 * Covers GET, POST, and PUT on /api/reference/categories, /api/reference/labs, and /api/reference/funding-sources.
 * Workflow: the Reference Data page (issue #194), and what a change does to Register Asset, Edit Asset, the present
 * value, and the activity log.
 * Fixtures: the accounts (USERS), LAB, the 20 categories, the two funding sources (LOOKUPS), and the seeded assets.
 * The tests add their own categories, labs, and funding sources, all named "Test ...", which stay for the rest of the
 * file. The useful life test puts DEV_KIT's useful life back.
 */
import { describe, expect, it } from "vitest";
import { presentValue } from "../../shared/constants/usefulLife";
import { serverToday } from "../../server/shared/services/assetState";
import { INACTIVE_CATEGORY_MESSAGE } from "../../server/features/reference/reference.service";
import { ASSETS, LAB, LOOKUPS, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness, type ApiClient } from "../setup/harness";

const { api, db, as } = useApiHarness();

const FORBIDDEN = "Your role is not allowed to do this.";
const asStaff = as(USERS.staffTsg);
const asSecretary = as(USERS.secretary);

/** A registration body for a new asset at a lab, with no serial number or tags that could clash. */
const intake = (category: string, centerId: number = LAB.centerId) => ({
  name: "Test Reference Asset",
  category,
  centerId,
  initialInspection: { condition: "OPERATIONAL", healthScore: 80 },
});

/** The REFERENCE_DATA_CHANGED rows, oldest first. */
const referenceLogRows = () =>
  db.activity_log.findMany({ where: { event_type: "REFERENCE_DATA_CHANGED" }, orderBy: { log_id: "asc" } });

/** Every route, with a path that names a row that exists and a body that would pass. */
const ROUTES: [method: "get" | "post" | "put", path: string, body?: unknown][] = [
  ["get", "/api/reference/categories"],
  ["post", "/api/reference/categories", { label: "Test Forbidden Category", usefulLifeYears: 5 }],
  ["put", "/api/reference/categories/MONITOR", { usefulLifeYears: 6 }],
  ["get", "/api/reference/labs"],
  ["post", "/api/reference/labs", { name: "Test Forbidden Lab", shortCode: "TFORB", campus: "MANILA" }],
  ["put", `/api/reference/labs/${LAB.centerId}`, { name: "Test Forbidden Name" }],
  ["get", "/api/reference/funding-sources"],
  ["post", "/api/reference/funding-sources", { name: "Test Forbidden Fund" }],
  ["put", `/api/reference/funding-sources/${LOOKUPS.fundingSources[0].fundingSourceId}`, { name: "Test Forbidden Rename" }],
];

/** Sends one route's request as a client. */
function send(client: ApiClient, [method, path, body]: (typeof ROUTES)[number]) {
  return method === "get" ? client.get(path) : client[method](path, body);
}

describe("who may use the Reference Data routes", () => {
  it("answers 401 to every route with no session", async () => {
    for (const route of ROUTES) {
      const res = await send(api, route);
      expect(res.status, `${route[0]} ${route[1]}`).toBe(401);
    }
  });

  it.each([
    ["the Director", USERS.director],
    ["a Lab Head", USERS.labHead],
    ["a Researcher", USERS.custodianA],
    ["the IT Admin", USERS.admin],
  ] as [string, TestUser][])("answers 403 to %s on every route, and writes nothing", async (_who, user) => {
    const before = await referenceLogRows();
    for (const route of ROUTES) {
      const res = await send(as(user), route);
      expect(res.status, `${route[0]} ${route[1]}`).toBe(403);
      expect(res.body.error).toBe(FORBIDDEN);
    }
    expect(await referenceLogRows()).toHaveLength(before.length);
    expect(await db.asset_categories.findUnique({ where: { code: "TEST_FORBIDDEN_CATEGORY" } })).toBeNull();
  });

  it.each([
    ["TSG", USERS.staffTsg, "T"],
    ["the Secretary", USERS.secretary, "S"],
  ] as [string, TestUser, string][])("lets %s list, add, and change each kind of row", async (_who, user, mark) => {
    const client = as(user);
    for (const path of ["/api/reference/categories", "/api/reference/labs", "/api/reference/funding-sources"]) {
      expect((await client.get(path)).status, path).toBe(200);
    }

    const category = await client.post("/api/reference/categories", { label: `Test Role Category ${mark}`, usefulLifeYears: 4 });
    expect(category.status).toBe(201);
    expect((await client.put(`/api/reference/categories/${category.body.category.code}`, { usefulLifeYears: 7 })).status).toBe(200);

    const lab = await client.post("/api/reference/labs", { name: `Test Role Lab ${mark}`, shortCode: `TROLE${mark}`, campus: "MANILA" });
    expect(lab.status).toBe(201);
    expect((await client.put(`/api/reference/labs/${lab.body.lab.centerId}`, { campus: "LAGUNA" })).status).toBe(200);

    const fund = await client.post("/api/reference/funding-sources", { name: `Test Role Fund ${mark}` });
    expect(fund.status).toBe(201);
    expect((await client.put(`/api/reference/funding-sources/${fund.body.fundingSource.fundingSourceId}`, { name: `Test Role Fund ${mark} 2` })).status).toBe(200);
  });
});

describe("categories", () => {
  it("lists every category, inactive ones too, with how many assets have each", async () => {
    await db.asset_categories.update({ where: { code: "MOUSE" }, data: { is_active: false } });
    try {
      const res = await asStaff.get("/api/reference/categories");

      expect(res.status).toBe(200);
      const byCode = new Map(res.body.categories.map((c: { code: string }) => [c.code, c]));
      for (const c of LOOKUPS.categories) expect(byCode.has(c.code), c.code).toBe(true);
      expect(byCode.get("MOUSE")).toMatchObject({ label: "Mouse", usefulLifeYears: 5, isActive: false });
      const devKits = await db.assets.count({ where: { category: "DEV_KIT" } });
      expect(byCode.get("DEV_KIT")).toEqual({ code: "DEV_KIT", label: "Dev Kit", usefulLifeYears: 5, isActive: true, assetCount: devKits });
    } finally {
      await db.asset_categories.update({ where: { code: "MOUSE" }, data: { is_active: true } });
    }
  });

  it("adds a category with its code made from the label, active, and logs it", async () => {
    const res = await asStaff.post("/api/reference/categories", { label: "  Test 3D Scanner!  ", usefulLifeYears: 8 });

    expect(res.status).toBe(201);
    expect(res.body.category).toEqual({ code: "TEST_3D_SCANNER", label: "Test 3D Scanner!", usefulLifeYears: 8, isActive: true, assetCount: 0 });
    const lookups = await api.get("/api/lookups");
    expect(lookups.body.categories).toContainEqual({ key: "TEST_3D_SCANNER", label: "Test 3D Scanner!", usefulLifeYears: 8 });
    const last = (await referenceLogRows()).at(-1)!;
    expect(last).toMatchObject({ actor_id: USERS.staffTsg.userId, details: "Category added: Test 3D Scanner!", asset_id: null });
  });

  it("refuses a label or a code that exists, in any letter case, with 409", async () => {
    const sameLabel = await asStaff.post("/api/reference/categories", { label: "monitor", usefulLifeYears: 5 });
    expect(sameLabel.status).toBe(409);
    expect(sameLabel.body.error).toBe("A category named monitor already exists.");

    // Two spaces: another label, but the same code as "Dev Kit".
    const sameCode = await asStaff.post("/api/reference/categories", { label: "dev  kit", usefulLifeYears: 5 });
    expect(sameCode.status).toBe(409);
    expect(sameCode.body.error).toBe("A category with the code DEV_KIT already exists.");
  });

  it.each([
    [{ usefulLifeYears: 5 }, "The label is required."],
    [{ label: "   ", usefulLifeYears: 5 }, "The label is required."],
    [{ label: "x".repeat(101), usefulLifeYears: 5 }, "The label can be at most 100 characters."],
    [{ label: "!!!", usefulLifeYears: 5 }, "The label needs at least one letter or digit."],
    [{ label: "Test Bad Life" }, "The useful life must be a whole number of years from 1 to 50."],
    [{ label: "Test Bad Life", usefulLifeYears: 0 }, "The useful life must be a whole number of years from 1 to 50."],
    [{ label: "Test Bad Life", usefulLifeYears: 51 }, "The useful life must be a whole number of years from 1 to 50."],
    [{ label: "Test Bad Life", usefulLifeYears: 2.5 }, "The useful life must be a whole number of years from 1 to 50."],
    [{ label: "Test Bad Life", usefulLifeYears: "5" }, "The useful life must be a whole number of years from 1 to 50."],
  ])("refuses the add %j with 400", async (body, message) => {
    const res = await asStaff.post("/api/reference/categories", body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
  });

  it("changes the label, the useful life, and whether it is active, never the code", async () => {
    await asStaff.post("/api/reference/categories", { label: "Test Oscilloscope", usefulLifeYears: 5 });

    const res = await asSecretary.put("/api/reference/categories/TEST_OSCILLOSCOPE", { label: "Test Scope", usefulLifeYears: 8, isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.category).toEqual({ code: "TEST_OSCILLOSCOPE", label: "Test Scope", usefulLifeYears: 8, isActive: false, assetCount: 0 });
    expect((await referenceLogRows()).at(-1)).toMatchObject({
      actor_id: USERS.secretary.userId,
      details: "Category changed: Test Scope (renamed from Test Oscilloscope, useful life 8, inactive)",
    });

    const code = await asStaff.put("/api/reference/categories/TEST_OSCILLOSCOPE", { code: "TEST_SCOPE" });
    expect(code.status).toBe(400);
    expect(code.body.error).toBe("The code of a category cannot change.");
  });

  it("answers 404 for an unknown code, 400 for an empty change, and 409 for another category's label", async () => {
    const unknown = await asStaff.put("/api/reference/categories/NOT_A_CATEGORY", { usefulLifeYears: 6 });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error).toBe("No category found with code NOT_A_CATEGORY.");

    const empty = await asStaff.put("/api/reference/categories/MONITOR", {});
    expect(empty.status).toBe(400);
    expect(empty.body.error).toBe("Send a label, a useful life, or whether it is active.");

    const taken = await asStaff.put("/api/reference/categories/MONITOR", { label: "CAMERA" });
    expect(taken.status).toBe(409);
    expect(taken.body.error).toBe("A category named CAMERA already exists.");

    const badActive = await asStaff.put("/api/reference/categories/MONITOR", { isActive: "no" });
    expect(badActive.status).toBe(400);
  });

  it("moves the present value in GET /api/assets when the useful life changes", async () => {
    const today = serverToday();
    const available = () => asStaff.get("/api/assets").then(res => res.body.assets.find((a: { tag: string }) => a.tag === ASSETS.available.tag));
    expect((await available()).presentValue).toBe(presentValue(ASSETS.available.acquisitionValue, "2025-06-01", 5, today));

    await asStaff.put("/api/reference/categories/DEV_KIT", { usefulLifeYears: 2 });
    try {
      const after = await available();
      expect(after.usefulLifeYears).toBe(2);
      expect(after.presentValue).toBe(presentValue(ASSETS.available.acquisitionValue, "2025-06-01", 2, today));
      expect(after.presentValue).not.toBe(presentValue(ASSETS.available.acquisitionValue, "2025-06-01", 5, today));
    } finally {
      await asStaff.put("/api/reference/categories/DEV_KIT", { usefulLifeYears: 5 });
    }
  });

  it("refuses a deactivated category for a new asset, and lets an edit keep it but not move to it", async () => {
    await asStaff.post("/api/reference/categories", { label: "Test Probe", usefulLifeYears: 5 });
    const registered = await asStaff.post("/api/assets", intake("TEST_PROBE"));
    expect(registered.status).toBe(200);
    const tag = registered.body.asset.tag;
    expect(registered.body.asset.categoryLabel).toBe("Test Probe");

    await asStaff.put("/api/reference/categories/TEST_PROBE", { isActive: false });

    const refused = await asStaff.post("/api/assets", intake("TEST_PROBE"));
    expect(refused.status).toBe(400);
    expect(refused.body.error).toBe(INACTIVE_CATEGORY_MESSAGE);
    expect((await api.get("/api/lookups")).body.categories.map((c: { key: string }) => c.key)).not.toContain("TEST_PROBE");

    const kept = await asSecretary.put(`/api/assets/${tag}`, { name: "Test Probe Renamed", category: "TEST_PROBE" });
    expect(kept.status).toBe(200);
    expect(kept.body.asset).toMatchObject({ name: "Test Probe Renamed", category: "TEST_PROBE", categoryLabel: "Test Probe" });

    const other = await asStaff.put(`/api/assets/${ASSETS.available.tag}`, { category: "TEST_PROBE" });
    expect(other.status).toBe(400);
    expect(other.body.error).toBe(INACTIVE_CATEGORY_MESSAGE);
  });

  it("refuses an unknown category on Register Asset with the list message", async () => {
    const res = await asStaff.post("/api/assets", intake("NOT_A_CATEGORY"));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Pick a category from the list.");
  });
});

describe("labs", () => {
  it("lists every lab with its campus and how many assets it is home to", async () => {
    const res = await asStaff.get("/api/reference/labs");

    expect(res.status).toBe(200);
    const assets = await db.assets.count({ where: { center_id: LAB.centerId } });
    expect(res.body.labs).toContainEqual({
      centerId: LAB.centerId, shortCode: LAB.shortCode, name: LAB.name, campus: "MANILA", campusLabel: "Manila", assetCount: assets,
    });
  });

  it("adds a lab whose first registered asset is <CODE>-0001, and logs it", async () => {
    const res = await asStaff.post("/api/reference/labs", { name: "Test New Lab", shortCode: "TNEW", campus: "LAGUNA" });

    expect(res.status).toBe(201);
    expect(res.body.lab).toMatchObject({ shortCode: "TNEW", name: "Test New Lab", campus: "LAGUNA", campusLabel: "Laguna", assetCount: 0 });
    expect((await referenceLogRows()).at(-1)).toMatchObject({ details: "Lab added: TNEW" });

    const asset = await asStaff.post("/api/assets", intake("CAMERA", res.body.lab.centerId));
    expect(asset.status).toBe(200);
    expect(asset.body.asset.tag).toBe("TNEW-0001");
  });

  it("refuses a short code that exists in another letter case with 409", async () => {
    const res = await asStaff.post("/api/reference/labs", { name: "Test Clash Lab", shortCode: LAB.shortCode.toLowerCase(), campus: "MANILA" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe(`A lab with the short code ${LAB.shortCode.toLowerCase()} already exists.`);
  });

  it.each([
    [{ shortCode: "TBAD", campus: "MANILA" }, "The name is required."],
    [{ name: "x".repeat(256), shortCode: "TBAD", campus: "MANILA" }, "The name can be at most 255 characters."],
    [{ name: "Test Bad Lab", shortCode: "T", campus: "MANILA" }, "The short code must be 2 to 10 letters and digits."],
    [{ name: "Test Bad Lab", shortCode: "TOOLONGCODE", campus: "MANILA" }, "The short code must be 2 to 10 letters and digits."],
    [{ name: "Test Bad Lab", shortCode: "T-BAD", campus: "MANILA" }, "The short code must be 2 to 10 letters and digits."],
    [{ name: "Test Bad Lab", shortCode: "TBAD", campus: "CEBU" }, "Pick a campus from the list."],
  ])("refuses the add %j with 400", async (body, message) => {
    const res = await asStaff.post("/api/reference/labs", body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
  });

  it("changes the name and the campus, never the short code", async () => {
    const lab = (await asStaff.post("/api/reference/labs", { name: "Test Rename Lab", shortCode: "TREN", campus: "MANILA" })).body.lab;

    const res = await asSecretary.put(`/api/reference/labs/${lab.centerId}`, { name: "Test Renamed Lab", campus: "MCKINLEY" });
    expect(res.status).toBe(200);
    expect(res.body.lab).toMatchObject({ shortCode: "TREN", name: "Test Renamed Lab", campus: "MCKINLEY", campusLabel: "McKinley" });
    expect((await referenceLogRows()).at(-1)).toMatchObject({ details: "Lab changed: TREN (name Test Renamed Lab, campus McKinley)" });

    const code = await asStaff.put(`/api/reference/labs/${lab.centerId}`, { shortCode: "TREN" });
    expect(code.status).toBe(400);
    expect(code.body.error).toBe("The short code of a lab cannot change: its asset tags start with it.");
    expect((await db.research_centers.findUnique({ where: { center_id: lab.centerId } }))!.short_code).toBe("TREN");
  });

  it("answers 404 for an unknown lab and 400 for an id that is not a number", async () => {
    expect((await asStaff.put("/api/reference/labs/99999", { name: "Test Nobody" })).status).toBe(404);
    expect((await asStaff.put("/api/reference/labs/abc", { name: "Test Nobody" })).status).toBe(400);
  });
});

describe("funding sources", () => {
  it("lists every funding source with how many assets and projects name it", async () => {
    const res = await asStaff.get("/api/reference/funding-sources");

    expect(res.status).toBe(200);
    const first = LOOKUPS.fundingSources[0];
    const assets = await db.assets.count({ where: { funding_source_id: first.fundingSourceId } });
    const projects = await db.projects.count({ where: { funding_source_id: first.fundingSourceId } });
    expect(res.body.fundingSources).toContainEqual({ fundingSourceId: first.fundingSourceId, name: first.name, assetCount: assets, projectCount: projects });
  });

  it("adds a funding source that Register Asset can use, and logs it", async () => {
    const res = await asStaff.post("/api/reference/funding-sources", { name: "Test New Grant" });

    expect(res.status).toBe(201);
    expect(res.body.fundingSource).toMatchObject({ name: "Test New Grant", assetCount: 0, projectCount: 0 });
    expect((await referenceLogRows()).at(-1)).toMatchObject({ details: "Funding source added: Test New Grant" });
    const lookups = await api.get("/api/lookups");
    expect(lookups.body.fundingSources).toContainEqual({ fundingSourceId: res.body.fundingSource.fundingSourceId, name: "Test New Grant" });
  });

  it("refuses a name that exists in another letter case with 409, on add and on rename", async () => {
    const add = await asStaff.post("/api/reference/funding-sources", { name: LOOKUPS.fundingSources[0].name.toUpperCase() });
    expect(add.status).toBe(409);

    const rename = await asStaff.put(`/api/reference/funding-sources/${LOOKUPS.fundingSources[1].fundingSourceId}`, { name: LOOKUPS.fundingSources[0].name.toLowerCase() });
    expect(rename.status).toBe(409);
    expect(rename.body.error).toBe(`A funding source named ${LOOKUPS.fundingSources[0].name.toLowerCase()} already exists.`);
  });

  it("renames a funding source, its own letter case too, and logs the old and new names", async () => {
    const id = (await asStaff.post("/api/reference/funding-sources", { name: "Test Old Grant" })).body.fundingSource.fundingSourceId;

    const res = await asSecretary.put(`/api/reference/funding-sources/${id}`, { name: "Test Fresh Grant" });
    expect(res.status).toBe(200);
    expect(res.body.fundingSource).toMatchObject({ fundingSourceId: id, name: "Test Fresh Grant" });
    expect((await referenceLogRows()).at(-1)).toMatchObject({ details: "Funding source renamed: Test Old Grant to Test Fresh Grant" });

    const caseOnly = await asSecretary.put(`/api/reference/funding-sources/${id}`, { name: "TEST FRESH GRANT" });
    expect(caseOnly.status).toBe(200);
    expect(caseOnly.body.fundingSource.name).toBe("TEST FRESH GRANT");
  });

  it("answers 400 for a missing or too long name and 404 for an unknown funding source", async () => {
    expect((await asStaff.post("/api/reference/funding-sources", {})).status).toBe(400);
    expect((await asStaff.post("/api/reference/funding-sources", { name: "x".repeat(101) })).status).toBe(400);
    expect((await asStaff.put("/api/reference/funding-sources/99999", { name: "Test Nobody" })).status).toBe(404);
  });
});

describe("the activity log", () => {
  it("writes one REFERENCE_DATA_CHANGED row per change, and none when nothing changes or a request is refused", async () => {
    const before = (await referenceLogRows()).length;

    await asStaff.post("/api/reference/categories", { label: "Test Logged Category", usefulLifeYears: 5 });
    await asStaff.put("/api/reference/categories/TEST_LOGGED_CATEGORY", { usefulLifeYears: 9 });
    await asStaff.put("/api/reference/categories/TEST_LOGGED_CATEGORY", { usefulLifeYears: 9 });
    await asStaff.post("/api/reference/categories", { label: "Test Logged Category", usefulLifeYears: 5 });
    const lab = (await asStaff.post("/api/reference/labs", { name: "Test Logged Lab", shortCode: "TLOG", campus: "MANILA" })).body.lab;
    await asStaff.put(`/api/reference/labs/${lab.centerId}`, { name: "Test Logged Lab" });
    await asStaff.post("/api/reference/funding-sources", { name: "Test Logged Fund" });

    const rows = (await referenceLogRows()).slice(before);
    expect(rows.map(r => r.details)).toEqual([
      "Category added: Test Logged Category",
      "Category changed: Test Logged Category (useful life 9)",
      "Lab added: TLOG",
      "Funding source added: Test Logged Fund",
    ]);
    for (const row of rows) expect(row.actor_id).toBe(USERS.staffTsg.userId);
  });
});
