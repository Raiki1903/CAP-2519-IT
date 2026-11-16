/**
 * Imports API: CSV validation and atomic bulk creation of projects and assets.
 * Covers POST /api/imports/projects/check, POST /api/imports/projects,
 * POST /api/imports/assets/check, POST /api/imports/assets.
 * Workflow: bulk CSV import of projects and assets (Issue #192).
 * Fixtures: the six seeded assets (ASSETS), the seeded lab (LAB), funding sources (LOOKUPS),
 * and the seeded accounts (USERS). Write tests clean up after themselves with Prisma.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ASSETS, FUNDING_SOURCE, LAB, LOOKUPS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";
import { SUGGESTED_HEALTH_SCORE } from "../../shared/enums/assetCondition";
import { IMPORT_MAX_ERRORS, IMPORT_MAX_ROWS } from "../../shared/constants/importColumns";

const { db, as, api } = useApiHarness();
const asTsg = as(USERS.staffTsg);
const asSecretary = as(USERS.secretary);
const asAdmin = as(USERS.admin);
const asDirector = as(USERS.director);
const asLabHead = as(USERS.labHead);
const asCustodian = as(USERS.custodianA);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal valid projects CSV with one row. */
function projectCsv(overrides: Partial<Record<string, string>> = {}): string {
  const row = {
    project_code: "IMP-TEST-001",
    project_name: "Import Test Project",
    project_leader: "Dr. Importado",
    lab: LAB.shortCode,
    start_date: "2026-01-01",
    ...overrides,
  };
  const header = "project_code,project_name,project_leader,lab,start_date";
  const values = [row.project_code, row.project_name, row.project_leader, row.lab, row.start_date]
    .map((v) => `"${v ?? ""}"`)
    .join(",");
  return `${header}\n${values}`;
}

/** Builds a minimal valid assets CSV with one row. */
function assetCsv(overrides: Partial<Record<string, string>> = {}): string {
  const row = {
    lab: LAB.shortCode,
    name: "Import Test Asset",
    category: "DEV_KIT",
    condition: "OPERATIONAL",
    ...overrides,
  };
  const header = "lab,name,category,condition";
  const values = [row.lab, row.name, row.category, row.condition]
    .map((v) => `"${v ?? ""}"`)
    .join(",");
  return `${header}\n${values}`;
}

/** Returns all asset tags belonging to LAB, sorted ascending. */
async function labTags(): Promise<string[]> {
  const rows = await db.assets.findMany({
    where: { center_id: LAB.centerId },
    select: { asset_tag: true },
    orderBy: { asset_tag: "asc" },
  });
  return rows.map((r) => r.asset_tag);
}

/** Deletes projects created during a test, identified by their codes. */
async function deleteProjects(codes: string[]): Promise<void> {
  if (codes.length === 0) return;
  // activity_log has no project_id column; match by details ("<code> (import)").
  for (const code of codes) {
    await db.activity_log.deleteMany({ where: { details: `${code} (import)` } });
  }
  await db.projects.deleteMany({ where: { project_code: { in: codes } } });
}

/** Deletes assets created during a test, identified by their tags. */
async function deleteImportedAssets(tags: string[]): Promise<void> {
  const assets = await db.assets.findMany({
    where: { asset_tag: { in: tags } },
    select: { asset_id: true },
  });
  const ids = assets.map((a) => a.asset_id);
  if (ids.length === 0) return;
  await db.activity_log.deleteMany({ where: { asset_id: { in: ids } } });
  await db.asset_inspection_metrics.deleteMany({
    where: { asset_inspections: { asset_id: { in: ids } } },
  });
  await db.asset_inspections.deleteMany({ where: { asset_id: { in: ids } } });
  await db.assets.deleteMany({ where: { asset_id: { in: ids } } });
}

// ---------------------------------------------------------------------------
// 1. Role access
// ---------------------------------------------------------------------------

describe("Role access: projects check", () => {
  it("returns 401 for unauthenticated", async () => {
    const res = await api.post("/api/imports/projects/check", { csv: projectCsv() });
    expect(res.status).toBe(401);
  });

  it("returns 403 for IT Admin", async () => {
    const res = await asAdmin.post("/api/imports/projects/check", { csv: projectCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Director", async () => {
    const res = await asDirector.post("/api/imports/projects/check", { csv: projectCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Lab Head", async () => {
    const res = await asLabHead.post("/api/imports/projects/check", { csv: projectCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Researcher", async () => {
    const res = await asCustodian.post("/api/imports/projects/check", { csv: projectCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 200 for Secretary (projects check)", async () => {
    const res = await asSecretary.post("/api/imports/projects/check", { csv: projectCsv() });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 200 for TSG Staff (projects check)", async () => {
    const res = await asTsg.post("/api/imports/projects/check", { csv: projectCsv() });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("Role access: projects save", () => {
  it("returns 401 for unauthenticated", async () => {
    const res = await api.post("/api/imports/projects", { csv: projectCsv() });
    expect(res.status).toBe(401);
  });

  it("returns 403 for IT Admin", async () => {
    const res = await asAdmin.post("/api/imports/projects", { csv: projectCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Director", async () => {
    const res = await asDirector.post("/api/imports/projects", { csv: projectCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Lab Head", async () => {
    const res = await asLabHead.post("/api/imports/projects", { csv: projectCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Researcher", async () => {
    const res = await asCustodian.post("/api/imports/projects", { csv: projectCsv() });
    expect(res.status).toBe(403);
  });
});

describe("Role access: assets check", () => {
  it("returns 401 for unauthenticated", async () => {
    const res = await api.post("/api/imports/assets/check", { csv: assetCsv() });
    expect(res.status).toBe(401);
  });

  it("returns 403 for IT Admin", async () => {
    const res = await asAdmin.post("/api/imports/assets/check", { csv: assetCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Director", async () => {
    const res = await asDirector.post("/api/imports/assets/check", { csv: assetCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Lab Head", async () => {
    const res = await asLabHead.post("/api/imports/assets/check", { csv: assetCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Researcher", async () => {
    const res = await asCustodian.post("/api/imports/assets/check", { csv: assetCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Secretary (assets check)", async () => {
    const res = await asSecretary.post("/api/imports/assets/check", { csv: assetCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 200 for TSG Staff (assets check)", async () => {
    const res = await asTsg.post("/api/imports/assets/check", { csv: assetCsv() });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("Role access: assets save", () => {
  it("returns 401 for unauthenticated", async () => {
    const res = await api.post("/api/imports/assets", { csv: assetCsv() });
    expect(res.status).toBe(401);
  });

  it("returns 403 for IT Admin", async () => {
    const res = await asAdmin.post("/api/imports/assets", { csv: assetCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Director", async () => {
    const res = await asDirector.post("/api/imports/assets", { csv: assetCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Lab Head", async () => {
    const res = await asLabHead.post("/api/imports/assets", { csv: assetCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Researcher", async () => {
    const res = await asCustodian.post("/api/imports/assets", { csv: assetCsv() });
    expect(res.status).toBe(403);
  });

  it("returns 403 for Secretary (assets save)", async () => {
    const res = await asSecretary.post("/api/imports/assets", { csv: assetCsv() });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 2. Header and file-level errors (row: 1)
// ---------------------------------------------------------------------------

describe("Header and file-level errors: projects", () => {
  it("rejects a missing required column with a file error on row 1", async () => {
    // Drop 'lab' from the header.
    const csv = "project_code,project_name,project_leader,start_date\nIMP-001,Name,Leader,2026-01-01";
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { row: number; column: string; message: string }) =>
        e.row === 1 && e.column === "lab" && e.message.includes("Missing required column")
    );
    expect(err).toBeDefined();
  });

  it("rejects an unknown column with a file error on row 1", async () => {
    const csv =
      "project_code,project_name,project_leader,lab,start_date,unknown_col\nIMP-001,Name,Leader,TEST,2026-01-01,bad";
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { row: number; column: string; message: string }) =>
        e.row === 1 && e.message.includes("Unknown column")
    );
    expect(err).toBeDefined();
  });

  it("rejects a repeated column header with a file error on row 1", async () => {
    const csv =
      "project_code,project_name,project_leader,lab,start_date,project_code\nIMP-001,Name,Leader,TEST,2026-01-01,IMP-002";
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { row: number; column: string; message: string }) =>
        e.row === 1 && e.message.includes("Duplicate column header")
    );
    expect(err).toBeDefined();
  });

  it("rejects a header-only file (zero data rows) with a file error on row 1", async () => {
    const csv = "project_code,project_name,project_leader,lab,start_date";
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.rowCount).toBe(0);
    const err = res.body.errors.find(
      (e: { row: number; message: string }) => e.row === 1 && e.message.includes("no data rows")
    );
    expect(err).toBeDefined();
  });

  it(`rejects a file with ${IMPORT_MAX_ROWS + 1} data rows before processing`, async () => {
    const header = "project_code,project_name,project_leader,lab,start_date";
    const dataRows = Array.from(
      { length: IMPORT_MAX_ROWS + 1 },
      (_, i) => `IMP-${String(i + 1).padStart(4, "0")},Name ${i + 1},Leader,${LAB.shortCode},2026-01-01`
    );
    const csv = [header, ...dataRows].join("\n");
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { row: number; message: string }) =>
        e.row === 1 && e.message.includes("exceeds the limit of 500 rows")
    );
    expect(err).toBeDefined();
  });
});

describe("Header and file-level errors: assets", () => {
  it("rejects a missing required column with a file error on row 1", async () => {
    // Drop 'condition'.
    const csv = "lab,name,category\nTEST,Asset 1,DEV_KIT";
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { row: number; column: string; message: string }) =>
        e.row === 1 && e.column === "condition" && e.message.includes("Missing required column")
    );
    expect(err).toBeDefined();
  });

  it("rejects an unknown column with a file error on row 1", async () => {
    const csv = "lab,name,category,condition,extra_col\nTEST,Asset 1,DEV_KIT,OPERATIONAL,bad";
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { row: number; message: string }) =>
        e.row === 1 && e.message.includes("Unknown column")
    );
    expect(err).toBeDefined();
  });

  it("rejects a repeated column header with a file error on row 1", async () => {
    const csv = "lab,name,category,condition,lab\nTEST,Asset 1,DEV_KIT,OPERATIONAL,TEST";
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { row: number; message: string }) =>
        e.row === 1 && e.message.includes("Duplicate column header")
    );
    expect(err).toBeDefined();
  });

  it("rejects a header-only file (zero data rows) with a file error on row 1", async () => {
    const csv = "lab,name,category,condition";
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.rowCount).toBe(0);
    const err = res.body.errors.find(
      (e: { row: number; message: string }) => e.row === 1 && e.message.includes("no data rows")
    );
    expect(err).toBeDefined();
  });

  it(`rejects a file with ${IMPORT_MAX_ROWS + 1} data rows before processing`, async () => {
    const header = "lab,name,category,condition";
    const dataRows = Array.from(
      { length: IMPORT_MAX_ROWS + 1 },
      (_, i) => `${LAB.shortCode},Asset ${i + 1},DEV_KIT,OPERATIONAL`
    );
    const csv = [header, ...dataRows].join("\n");
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { row: number; message: string }) =>
        e.row === 1 && e.message.includes("exceeds the limit of 500 rows")
    );
    expect(err).toBeDefined();
  });
});

describe("Error capping at 200 with 'and N more'", () => {
  it("caps errors at 200 and appends a row-0 'and N more' item", async () => {
    // 220 rows, each with an invalid lab, produces 220 errors, should cap at 200 + 1 summary.
    const errorCount = IMPORT_MAX_ERRORS + 20; // 220
    const header = "project_code,project_name,project_leader,lab,start_date";
    const dataRows = Array.from(
      { length: errorCount },
      (_, i) => `CODE-${String(i + 1).padStart(4, "0")},Name,Leader,BADLAB,2026-01-01`
    );
    const csv = [header, ...dataRows].join("\n");
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    // Last item is the "and N more" summary at row 0.
    const errors: { row: number; column: string | null; message: string }[] = res.body.errors;
    expect(errors.length).toBe(IMPORT_MAX_ERRORS + 1);
    const last = errors[errors.length - 1];
    expect(last.row).toBe(0);
    expect(last.column).toBeNull();
    expect(last.message).toMatch(/^and \d+ more$/);
    const remaining = parseInt(last.message.split(" ")[1], 10);
    expect(remaining).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 3. CSV reader edge cases via endpoints
// ---------------------------------------------------------------------------

describe("CSV reader edge cases via projects check", () => {
  it("strips a leading UTF-8 BOM and parses the file correctly", async () => {
    const bom = "\uFEFF";
    const csv =
      bom +
      "project_code,project_name,project_leader,lab,start_date\n" +
      `BOM-001,BOM Project,Dr. BOM,${LAB.shortCode},2026-03-01`;
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rowCount).toBe(1);
  });

  it("skips blank rows and counts only data rows", async () => {
    const csv =
      "project_code,project_name,project_leader,lab,start_date\n" +
      "\n" +
      `BLANK-001,Blank Test,Leader,${LAB.shortCode},2026-03-01\n` +
      "   \n" +
      `BLANK-002,Blank Test 2,Leader,${LAB.shortCode},2026-03-01`;
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rowCount).toBe(2);
  });

  it("parses quoted fields that contain commas", async () => {
    const csv =
      "project_code,project_name,project_leader,lab,start_date\n" +
      `"QUO-001","Name, With Comma","Leader, Jr.",${LAB.shortCode},2026-03-01`;
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preview[0].project_name).toBe("Name, With Comma");
    expect(res.body.preview[0].project_leader).toBe("Leader, Jr.");
  });

  it("parses escaped quotes (doubled double-quotes) inside quoted fields", async () => {
    const csv =
      "project_code,project_name,project_leader,lab,start_date\n" +
      `"QUO-002","Name ""Quoted""",Leader,${LAB.shortCode},2026-03-01`;
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preview[0].project_name).toBe('Name "Quoted"');
  });

  it("accepts yyyy-mm-dd dates", async () => {
    const csv =
      "project_code,project_name,project_leader,lab,start_date,end_date\n" +
      `DATE-001,Date Test,Leader,${LAB.shortCode},2026-01-15,2026-12-31`;
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preview[0].start_date).toBe("2026-01-15");
    expect(res.body.preview[0].end_date).toBe("2026-12-31");
  });

  it("accepts m/d/yyyy dates (Excel slash format)", async () => {
    const csv =
      "project_code,project_name,project_leader,lab,start_date,end_date\n" +
      `DATE-002,Date Slash Test,Leader,${LAB.shortCode},1/15/2026,12/31/2026`;
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preview[0].start_date).toBe("2026-01-15");
    expect(res.body.preview[0].end_date).toBe("2026-12-31");
  });

  it("rejects an end date earlier than start date", async () => {
    const csv =
      "project_code,project_name,project_leader,lab,start_date,end_date\n" +
      `DATE-003,Date Order Test,Leader,${LAB.shortCode},2026-06-01,2026-01-01`;
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "end_date" && e.message.includes("cannot be earlier")
    );
    expect(err).toBeDefined();
  });
});

describe("CSV reader edge cases: money parsing via assets check", () => {
  it("accepts acquisition_value with PHP prefix", async () => {
    const csv =
      "lab,name,category,condition,acquisition_value\n" +
      `${LAB.shortCode},PHP Asset,DEV_KIT,OPERATIONAL,PHP 1500.00`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preview[0].acquisition_value).toBe(1500);
  });

  it("accepts acquisition_value with the peso sign prefix", async () => {
    const csv =
      "lab,name,category,condition,acquisition_value\n" +
      `${LAB.shortCode},Peso Asset,DEV_KIT,OPERATIONAL,\u20b12000.50`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preview[0].acquisition_value).toBe(2000.5);
  });

  it("accepts acquisition_value with commas as thousands separators", async () => {
    // The comma inside the value must be quoted; otherwise the CSV parser splits on it.
    const csv =
      "lab,name,category,condition,acquisition_value\n" +
      `${LAB.shortCode},Comma Asset,DEV_KIT,OPERATIONAL,"PHP 10,000.00"`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preview[0].acquisition_value).toBe(10000);
  });

  it("rejects acquisition_value with a dollar sign", async () => {
    const csv =
      "lab,name,category,condition,acquisition_value\n" +
      `${LAB.shortCode},Dollar Asset,DEV_KIT,OPERATIONAL,$500`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string }) => e.column === "acquisition_value"
    );
    expect(err).toBeDefined();
  });

  it("rejects a non-numeric acquisition_value", async () => {
    const csv =
      "lab,name,category,condition,acquisition_value\n" +
      `${LAB.shortCode},Bad Asset,DEV_KIT,OPERATIONAL,notanumber`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string }) => e.column === "acquisition_value"
    );
    expect(err).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Lookup failures
// ---------------------------------------------------------------------------

describe("Lookup failures: projects check", () => {
  it("rejects an invalid lab code", async () => {
    const csv = projectCsv({ lab: "BADLAB" });
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "lab" && e.message.includes("Unknown lab")
    );
    expect(err).toBeDefined();
  });

  it("rejects an invalid funding source", async () => {
    const csv =
      "project_code,project_name,project_leader,lab,start_date,funding_source\n" +
      `FS-001,Name,Leader,${LAB.shortCode},2026-01-01,NoSuchFund`;
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "funding_source" && e.message.includes("Unknown funding source")
    );
    expect(err).toBeDefined();
  });

  it("accepts a lab code case-insensitively", async () => {
    const csv = projectCsv({ lab: LAB.shortCode.toLowerCase() });
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("accepts a valid funding source case-insensitively", async () => {
    const csv =
      "project_code,project_name,project_leader,lab,start_date,funding_source\n" +
      `FS-OK,Name,Leader,${LAB.shortCode},2026-01-01,${FUNDING_SOURCE.toUpperCase()}`;
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("Lookup failures: assets check", () => {
  it("rejects an invalid lab code", async () => {
    const csv = assetCsv({ lab: "NOLAB" });
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "lab" && e.message.includes("Unknown lab")
    );
    expect(err).toBeDefined();
  });

  it("rejects an invalid category", async () => {
    const csv = assetCsv({ category: "FLYING_CARPET" });
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "category" && e.message.includes("Unknown category")
    );
    expect(err).toBeDefined();
  });

  it("rejects an invalid condition", async () => {
    const csv = assetCsv({ condition: "MINT" });
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "condition" && e.message.includes("Unknown condition")
    );
    expect(err).toBeDefined();
  });

  it("rejects an unknown project code", async () => {
    const csv =
      "lab,name,category,condition,project_code\n" +
      `${LAB.shortCode},Asset,DEV_KIT,OPERATIONAL,NOSUCHPROJECT`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "project_code" && e.message.includes("Unknown project code")
    );
    expect(err).toBeDefined();
  });

  it("rejects an invalid funding source for an asset", async () => {
    const csv =
      "lab,name,category,condition,funding_source\n" +
      `${LAB.shortCode},Asset,DEV_KIT,OPERATIONAL,NoSuchFund`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "funding_source" && e.message.includes("Unknown funding source")
    );
    expect(err).toBeDefined();
  });

  it("accepts a category case-insensitively", async () => {
    const csv = assetCsv({ category: "dev_kit" });
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("accepts a condition case-insensitively", async () => {
    const csv = assetCsv({ condition: "operational" });
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Duplicate checks: projects
// ---------------------------------------------------------------------------

describe("Duplicate project_code checks", () => {
  const EXISTING_PROJECT_CODE = "EXISTING-PROJ-001";

  beforeEach(async () => {
    // Insert a project so the duplicate-against-DB check has something to find.
    await db.projects.create({
      data: {
        project_code: EXISTING_PROJECT_CODE,
        project_name: "Pre-existing Project",
        project_leader: "Leader",
        center_id: LAB.centerId,
        start_date: new Date("2025-01-01"),
      },
    });
  });

  afterEach(async () => {
    // Only the check endpoints run here: no activity log rows are written.
    await db.projects.deleteMany({});
  });

  it("flags a project_code that already exists in the database", async () => {
    const csv = projectCsv({ project_code: EXISTING_PROJECT_CODE });
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "project_code" && e.message.includes("already exists")
    );
    expect(err).toBeDefined();
  });

  it("flags a project_code that is duplicated within the same CSV file", async () => {
    const header = "project_code,project_name,project_leader,lab,start_date";
    const csv =
      `${header}\n` +
      `DUP-FILE-001,Name A,Leader,${LAB.shortCode},2026-01-01\n` +
      `DUP-FILE-001,Name B,Leader,${LAB.shortCode},2026-01-01`;
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "project_code" && e.message.includes("repeats row")
    );
    expect(err).toBeDefined();
  });

  it("checks project_code case-insensitively against the database", async () => {
    const csv = projectCsv({ project_code: EXISTING_PROJECT_CODE.toLowerCase() });
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "project_code" && e.message.includes("already exists")
    );
    expect(err).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. Duplicate checks: assets
// ---------------------------------------------------------------------------

describe("Duplicate asset identifier checks", () => {
  // The seeded retired asset (TEST-0004) has serial TEST-SN-4; we can test
  // duplicates against RETIRED assets too.
  const RETIRED_ASSET = ASSETS.disposed; // status RETIRED

  it("flags a serial_number that is already used by an existing DB asset", async () => {
    const existingSerial = `TEST-SN-${ASSETS.available.assetId}`;
    const csv =
      "lab,name,category,condition,serial_number\n" +
      `${LAB.shortCode},Dup Serial,DEV_KIT,OPERATIONAL,${existingSerial}`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "serial_number" && e.message.includes("already used by")
    );
    expect(err).toBeDefined();
    expect(err.message).toContain(ASSETS.available.tag);
  });

  it("flags a serial_number that is already used by a RETIRED asset", async () => {
    const retiredSerial = `TEST-SN-${RETIRED_ASSET.assetId}`;
    const csv =
      "lab,name,category,condition,serial_number\n" +
      `${LAB.shortCode},Dup Retired Serial,DEV_KIT,OPERATIONAL,${retiredSerial}`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "serial_number" && e.message.includes("already used by")
    );
    expect(err).toBeDefined();
    expect(err.message).toContain(RETIRED_ASSET.tag);
  });

  it("flags a serial_number that repeats an earlier row in the same CSV", async () => {
    const csv =
      "lab,name,category,condition,serial_number\n" +
      `${LAB.shortCode},Asset A,DEV_KIT,OPERATIONAL,SN-REPEAT-999\n` +
      `${LAB.shortCode},Asset B,DEV_KIT,OPERATIONAL,SN-REPEAT-999`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "serial_number" && e.message.includes("repeats row")
    );
    expect(err).toBeDefined();
    // row 2 repeats row 2 (1-based data row 2 = header row 2)
    expect(err.message).toContain("2");
  });

  it("checks serial_number case-insensitively against the database", async () => {
    const existingSerial = `TEST-SN-${ASSETS.available.assetId}`.toLowerCase();
    const csv =
      "lab,name,category,condition,serial_number\n" +
      `${LAB.shortCode},Case Asset,DEV_KIT,OPERATIONAL,${existingSerial}`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "serial_number" && e.message.includes("already used by")
    );
    expect(err).toBeDefined();
  });

  it("flags an its_property_tag that repeats an earlier row in the same CSV", async () => {
    const csv =
      "lab,name,category,condition,its_property_tag\n" +
      `${LAB.shortCode},Asset A,DEV_KIT,OPERATIONAL,ITS-REPEAT-01\n` +
      `${LAB.shortCode},Asset B,DEV_KIT,OPERATIONAL,ITS-REPEAT-01`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "its_property_tag" && e.message.includes("repeats row")
    );
    expect(err).toBeDefined();
  });

  it("flags a tsg_tag that repeats an earlier row in the same CSV", async () => {
    const csv =
      "lab,name,category,condition,tsg_tag\n" +
      `${LAB.shortCode},Asset A,DEV_KIT,OPERATIONAL,TSG-REPEAT-01\n` +
      `${LAB.shortCode},Asset B,DEV_KIT,OPERATIONAL,TSG-REPEAT-01`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "tsg_tag" && e.message.includes("repeats row")
    );
    expect(err).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 7. Transaction and side-effect checks
// ---------------------------------------------------------------------------

describe("Projects check: saves nothing", () => {
  // check endpoint writes nothing, so no cleanup is needed; the guard is implicit.

  it("does not create any project row even when the CSV is fully valid", async () => {
    const before = await db.projects.count();
    const res = await asTsg.post("/api/imports/projects/check", {
      csv: projectCsv({ project_code: "CHECK-NO-SAVE-001" }),
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const after = await db.projects.count();
    expect(after).toBe(before);
  });
});

describe("Assets check: saves nothing, previews expectedTag", () => {
  it("does not create any asset row even when the CSV is fully valid", async () => {
    const before = await db.assets.count();
    const res = await asTsg.post("/api/imports/assets/check", {
      csv: assetCsv(),
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const after = await db.assets.count();
    expect(after).toBe(before);
  });

  it("previews an expectedTag that continues the lab's sequential numbering", async () => {
    const existingTags = await labTags();
    const maxSeq = existingTags.reduce((max, tag) => {
      const m = tag.match(/^TEST-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const nextExpected = `TEST-${String(maxSeq + 1).padStart(4, "0")}`;

    const res = await asTsg.post("/api/imports/assets/check", {
      csv: assetCsv(),
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preview.length).toBeGreaterThan(0);
    expect(res.body.preview[0].expectedTag).toBe(nextExpected);
  });
});

describe("Projects save: atomic rollback on a bad row", () => {
  afterEach(async () => {
    await deleteProjects(["ROLLBACK-PROJ-A", "ROLLBACK-PROJ-B"]);
  });

  it("returns HTTP 400 with ImportCheckResult and writes zero records when one row is invalid", async () => {
    const header = "project_code,project_name,project_leader,lab,start_date";
    // Row 1 is valid, row 2 has a bad lab.
    const csv =
      `${header}\n` +
      `ROLLBACK-PROJ-A,Name A,Leader,${LAB.shortCode},2026-01-01\n` +
      `ROLLBACK-PROJ-B,Name B,Leader,BADLAB,2026-01-01`;
    const before = await db.projects.count();
    const res = await asTsg.post("/api/imports/projects", { csv });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.rowCount).toBe(2);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
    // Nothing written.
    const after = await db.projects.count();
    expect(after).toBe(before);
  });
});

describe("Assets save: atomic rollback on a bad row", () => {
  afterEach(async () => {
    await deleteImportedAssets(["TEST-0007", "TEST-0008"]);
  });

  it("returns HTTP 400 with ImportCheckResult and writes zero records when one row is invalid", async () => {
    const header = "lab,name,category,condition";
    // Row 1 is valid, row 2 has a bad condition.
    const csv =
      `${header}\n` +
      `${LAB.shortCode},Asset Good,DEV_KIT,OPERATIONAL\n` +
      `${LAB.shortCode},Asset Bad,DEV_KIT,MINT_CONDITION`;
    const before = await db.assets.count();
    const res = await asTsg.post("/api/imports/assets", { csv });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const after = await db.assets.count();
    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// 8. Projects save: success, activity log, ImportSaveResult
// ---------------------------------------------------------------------------

describe("Projects save: successful creation", () => {
  const SAVED_CODES = ["SAVE-PROJ-001", "SAVE-PROJ-002"];

  afterEach(async () => {
    await deleteProjects(SAVED_CODES);
  });

  it("returns HTTP 200 with ImportSaveResult and creates one project per row", async () => {
    const header = "project_code,project_name,project_leader,lab,start_date";
    const csv =
      `${header}\n` +
      `${SAVED_CODES[0]},Project One,Leader One,${LAB.shortCode},2026-02-01\n` +
      `${SAVED_CODES[1]},Project Two,Leader Two,${LAB.shortCode},2026-03-01`;
    const res = await asTsg.post("/api/imports/projects", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.created).toHaveLength(2);
    expect(res.body.created.map((c: { key: string }) => c.key)).toEqual(
      expect.arrayContaining(SAVED_CODES)
    );
  });

  it("writes a PROJECT_CREATED activity log row with '<code> (import)' details per project", async () => {
    const header = "project_code,project_name,project_leader,lab,start_date";
    const csv =
      `${header}\n` +
      `${SAVED_CODES[0]},Project One,Leader One,${LAB.shortCode},2026-02-01\n` +
      `${SAVED_CODES[1]},Project Two,Leader Two,${LAB.shortCode},2026-03-01`;
    await asTsg.post("/api/imports/projects", { csv });

    for (const code of SAVED_CODES) {
      const log = await db.activity_log.findFirst({
        where: { event_type: "PROJECT_CREATED", details: `${code} (import)` },
      });
      expect(log, `Missing PROJECT_CREATED log for ${code}`).not.toBeNull();
      expect(log!.actor_id).toBe(USERS.staffTsg.userId);
    }
  });

  it("stores the correct project fields in the database", async () => {
    const header = "project_code,project_name,project_leader,lab,start_date,end_date";
    const csv =
      `${header}\n` +
      `${SAVED_CODES[0]},My Project,Dr. Leader,${LAB.shortCode},1/5/2026,12/31/2026`;
    await asTsg.post("/api/imports/projects", { csv });

    const proj = await db.projects.findFirst({ where: { project_code: SAVED_CODES[0] } });
    expect(proj).not.toBeNull();
    expect(proj!.project_name).toBe("My Project");
    expect(proj!.project_leader).toBe("Dr. Leader");
    expect(proj!.center_id).toBe(LAB.centerId);
    expect(proj!.start_date.toISOString().startsWith("2026-01-05")).toBe(true);
    expect(proj!.end_date!.toISOString().startsWith("2026-12-31")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. Assets save: success, sequential tags, inspection, activity log
// ---------------------------------------------------------------------------

describe("Assets save: successful creation across one lab", () => {
  // Track created tags for cleanup.
  let createdTags: string[] = [];

  afterEach(async () => {
    await deleteImportedAssets(createdTags);
    createdTags = [];
  });

  it("returns HTTP 200 with ImportSaveResult containing all created tags", async () => {
    const header = "lab,name,category,condition";
    const csv =
      `${header}\n` +
      `${LAB.shortCode},Asset Alpha,DEV_KIT,OPERATIONAL\n` +
      `${LAB.shortCode},Asset Beta,MONITOR,PERFECT`;
    const res = await asTsg.post("/api/imports/assets", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.created).toHaveLength(2);
    createdTags = res.body.created.map((c: { key: string }) => c.key);
    expect(createdTags[0]).toMatch(/^TEST-\d{4}$/);
    expect(createdTags[1]).toMatch(/^TEST-\d{4}$/);
  });

  it("assigns sequential tags continuing from the lab's highest existing tag", async () => {
    const existingTags = await labTags();
    const maxSeq = existingTags.reduce((max, tag) => {
      const m = tag.match(/^TEST-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);

    const header = "lab,name,category,condition";
    const csv =
      `${header}\n` +
      `${LAB.shortCode},Seq Asset 1,DEV_KIT,OPERATIONAL\n` +
      `${LAB.shortCode},Seq Asset 2,DEV_KIT,OPERATIONAL`;
    const res = await asTsg.post("/api/imports/assets", { csv });

    expect(res.status).toBe(200);
    createdTags = res.body.created.map((c: { key: string }) => c.key);
    expect(createdTags[0]).toBe(`TEST-${String(maxSeq + 1).padStart(4, "0")}`);
    expect(createdTags[1]).toBe(`TEST-${String(maxSeq + 2).padStart(4, "0")}`);
  });

  it("sets each asset's status to AVAILABLE", async () => {
    const csv =
      "lab,name,category,condition\n" +
      `${LAB.shortCode},Status Asset,DEV_KIT,OPERATIONAL`;
    const res = await asTsg.post("/api/imports/assets", { csv });

    expect(res.status).toBe(200);
    createdTags = res.body.created.map((c: { key: string }) => c.key);
    const asset = await db.assets.findFirst({ where: { asset_tag: createdTags[0] } });
    expect(asset!.status).toBe("AVAILABLE");
  });

  it("creates an INITIAL inspection with SUGGESTED_HEALTH_SCORE when health_score is omitted", async () => {
    const condition = "OPERATIONAL";
    const csv =
      "lab,name,category,condition\n" +
      `${LAB.shortCode},Inspection Asset,DEV_KIT,${condition}`;
    const res = await asTsg.post("/api/imports/assets", { csv });

    expect(res.status).toBe(200);
    createdTags = res.body.created.map((c: { key: string }) => c.key);
    const asset = await db.assets.findFirst({ where: { asset_tag: createdTags[0] } });
    const inspection = await db.asset_inspections.findFirst({ where: { asset_id: asset!.asset_id } });

    expect(inspection).not.toBeNull();
    expect(inspection!.type).toBe("INITIAL");
    expect(inspection!.condition).toBe("OPERATIONAL");
    expect(inspection!.health_score).toBe(SUGGESTED_HEALTH_SCORE[condition]);
  });

  it("creates an INITIAL inspection with the custom health_score when provided", async () => {
    const csv =
      "lab,name,category,condition,health_score\n" +
      `${LAB.shortCode},Custom Score Asset,DEV_KIT,OPERATIONAL,75`;
    const res = await asTsg.post("/api/imports/assets", { csv });

    expect(res.status).toBe(200);
    createdTags = res.body.created.map((c: { key: string }) => c.key);
    const asset = await db.assets.findFirst({ where: { asset_tag: createdTags[0] } });
    const inspection = await db.asset_inspections.findFirst({ where: { asset_id: asset!.asset_id } });

    expect(inspection!.health_score).toBe(75);
  });

  it("stores inspection_remarks and missing_accessories on the INITIAL inspection", async () => {
    const csv =
      "lab,name,category,condition,inspection_remarks,missing_accessories\n" +
      `${LAB.shortCode},Remarks Asset,DEV_KIT,OPERATIONAL,Looks fine,Power cable`;
    const res = await asTsg.post("/api/imports/assets", { csv });

    expect(res.status).toBe(200);
    createdTags = res.body.created.map((c: { key: string }) => c.key);
    const asset = await db.assets.findFirst({ where: { asset_tag: createdTags[0] } });
    const inspection = await db.asset_inspections.findFirst({ where: { asset_id: asset!.asset_id } });

    expect(inspection!.remarks).toBe("Looks fine");
    expect(inspection!.missing_accessories).toBe("Power cable");
  });

  it("writes an ASSET_REGISTERED activity log with '<tag> (import)' details per asset", async () => {
    const csv =
      "lab,name,category,condition\n" +
      `${LAB.shortCode},Log Asset,DEV_KIT,OPERATIONAL`;
    const res = await asTsg.post("/api/imports/assets", { csv });

    expect(res.status).toBe(200);
    createdTags = res.body.created.map((c: { key: string }) => c.key);
    const tag = createdTags[0];

    const log = await db.activity_log.findFirst({
      where: { event_type: "ASSET_REGISTERED", details: `${tag} (import)` },
    });
    expect(log).not.toBeNull();
    expect(log!.actor_id).toBe(USERS.staffTsg.userId);
  });

  it("stores optional asset fields in the database", async () => {
    const fundingSource = LOOKUPS.fundingSources[0].name;
    const csv =
      "lab,name,category,condition,serial_number,manufacturer,acquisition_value,procurement_date\n" +
      `${LAB.shortCode},Full Asset,DEV_KIT,OPERATIONAL,SN-IMPORT-FULL,Acme Corp,PHP 5000.00,2026-01-15`;
    const res = await asTsg.post("/api/imports/assets", { csv });

    expect(res.status).toBe(200);
    createdTags = res.body.created.map((c: { key: string }) => c.key);
    const asset = await db.assets.findFirst({ where: { asset_tag: createdTags[0] } });

    expect(asset!.serial_number).toBe("SN-IMPORT-FULL");
    expect(asset!.manufacturer).toBe("Acme Corp");
    expect(Number(asset!.acquisition_value)).toBe(5000);
    expect(asset!.procurement_date!.toISOString().startsWith("2026-01-15")).toBe(true);
    void fundingSource;
  });
});

// ---------------------------------------------------------------------------
// 10. Chained import: projects first, then assets referencing the new codes
// ---------------------------------------------------------------------------

describe("Chained import: projects then assets", () => {
  const PROJECT_CODE = "CHAIN-PROJ-001";
  let createdAssetTags: string[] = [];

  afterEach(async () => {
    await deleteImportedAssets(createdAssetTags);
    await deleteProjects([PROJECT_CODE]);
    createdAssetTags = [];
  });

  it("allows assets to reference a project_code created in the same session's earlier import", async () => {
    // Step 1: import the project.
    const projCsv =
      "project_code,project_name,project_leader,lab,start_date\n" +
      `${PROJECT_CODE},Chain Project,Dr. Chain,${LAB.shortCode},2026-05-01`;
    const projRes = await asTsg.post("/api/imports/projects", { csv: projCsv });
    expect(projRes.status).toBe(200);
    expect(projRes.body.success).toBe(true);

    // Step 2: import assets referencing the new project.
    const assetsCsv =
      "lab,name,category,condition,project_code\n" +
      `${LAB.shortCode},Chained Asset,DEV_KIT,OPERATIONAL,${PROJECT_CODE}`;
    const assetsRes = await asTsg.post("/api/imports/assets", { csv: assetsCsv });

    expect(assetsRes.status).toBe(200);
    expect(assetsRes.body.success).toBe(true);
    createdAssetTags = assetsRes.body.created.map((c: { key: string }) => c.key);

    // Verify the project is linked.
    const asset = await db.assets.findFirst({ where: { asset_tag: createdAssetTags[0] } });
    const project = await db.projects.findFirst({ where: { project_code: PROJECT_CODE } });
    expect(asset!.project_id).toBe(project!.project_id);
  });

  it("assets check detects unknown project code that does not yet exist", async () => {
    const csv =
      "lab,name,category,condition,project_code\n" +
      `${LAB.shortCode},Orphan Asset,DEV_KIT,OPERATIONAL,CHAIN-PROJ-001`;
    // Project not created yet.
    const res = await asTsg.post("/api/imports/assets/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string; message: string }) =>
        e.column === "project_code" && e.message.includes("Unknown project code")
    );
    expect(err).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 11. Header normalization (spaces, mixed case)
// ---------------------------------------------------------------------------

describe("Header normalization", () => {
  it("accepts headers with spaces and mixed case by normalizing them", async () => {
    // 'Project Code' should normalize to 'project_code', etc.
    const csv =
      "Project Code,Project Name,Project Leader,Lab,Start Date\n" +
      `NORM-001,Normalized Project,Leader,${LAB.shortCode},2026-01-01`;
    const res = await asTsg.post("/api/imports/projects/check", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preview[0].project_code).toBe("NORM-001");
  });
});

// ---------------------------------------------------------------------------
// 12. Health score boundary validation
// ---------------------------------------------------------------------------

describe("Health score validation", () => {
  it("accepts health_score of 0", async () => {
    const csv =
      "lab,name,category,condition,health_score\n" +
      `${LAB.shortCode},Zero Score,DEV_KIT,CRITICAL_DEFECT,0`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("accepts health_score of 100", async () => {
    const csv =
      "lab,name,category,condition,health_score\n" +
      `${LAB.shortCode},Max Score,DEV_KIT,PERFECT,100`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejects health_score of 101", async () => {
    const csv =
      "lab,name,category,condition,health_score\n" +
      `${LAB.shortCode},Over Score,DEV_KIT,PERFECT,101`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string }) => e.column === "health_score"
    );
    expect(err).toBeDefined();
  });

  it("rejects a non-integer health_score", async () => {
    const csv =
      "lab,name,category,condition,health_score\n" +
      `${LAB.shortCode},Float Score,DEV_KIT,PERFECT,75.5`;
    const res = await asTsg.post("/api/imports/assets/check", { csv });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    const err = res.body.errors.find(
      (e: { column: string }) => e.column === "health_score"
    );
    expect(err).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 13. Secretary can save projects
// ---------------------------------------------------------------------------

describe("Secretary: can check and save projects", () => {
  const SEC_CODE = "SEC-PROJ-001";

  afterEach(async () => {
    await deleteProjects([SEC_CODE]);
  });

  it("allows Secretary to save a valid projects CSV", async () => {
    const csv =
      "project_code,project_name,project_leader,lab,start_date\n" +
      `${SEC_CODE},Secretary Project,Dr. Sec,${LAB.shortCode},2026-04-01`;
    const res = await asSecretary.post("/api/imports/projects", { csv });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const proj = await db.projects.findFirst({ where: { project_code: SEC_CODE } });
    expect(proj).not.toBeNull();
  });
});
