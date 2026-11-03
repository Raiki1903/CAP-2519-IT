/**
 * Tests the two helpers the dashboards share: inspectionGroupIdOf (the Inspection Queue's lab groups, with "Other" for a lab in
 * none) and countAssetsByCampus (the Director and Staff Overview campus totals, from each asset's home lab).
 * Covers a lab in each group in any letter case, a lab and a missing lab in none, three campuses always listed, McKinley counted
 * apart from Laguna, and that no web page keeps its own lab list or two-campus split. No server, no database.
 * Fixtures: none.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { INSPECTION_LAB_GROUPS, OTHER_INSPECTION_GROUP_ID, inspectionGroupIdOf } from "../../shared/constants/inspectionGroups";
import { countAssetsByCampus } from "../../web/features/assets/campusCounts";

const WEB = path.join(__dirname, "..", "..", "web");

describe("inspectionGroupIdOf", () => {
  it("finds the group that lists the lab, in any letter case", () => {
    expect(inspectionGroupIdOf("CITe4D")).toBe("A");
    expect(inspectionGroupIdOf("cehci")).toBe("B");
    expect(inspectionGroupIdOf(" GAME ")).toBe("C");
    expect(inspectionGroupIdOf("HXIL")).toBe("D");
  });

  it("puts a lab in none of the groups, or no lab, under Other", () => {
    expect(inspectionGroupIdOf("NEWLAB")).toBe(OTHER_INSPECTION_GROUP_ID);
    expect(inspectionGroupIdOf("")).toBe(OTHER_INSPECTION_GROUP_ID);
    expect(inspectionGroupIdOf(undefined)).toBe(OTHER_INSPECTION_GROUP_ID);
  });

  it("does not match part of a lab code (no CAR inside CARBON)", () => {
    expect(inspectionGroupIdOf("CARBON")).toBe(OTHER_INSPECTION_GROUP_ID);
  });

  it("lists each lab in one group only", () => {
    const labs = INSPECTION_LAB_GROUPS.flatMap((g) => g.labs.map((l) => l.toLowerCase()));
    expect(new Set(labs).size).toBe(labs.length);
  });
});

describe("countAssetsByCampus", () => {
  it("lists the three campuses in order, 0 for an empty one", () => {
    expect(countAssetsByCampus([])).toEqual([
      { campus: "MANILA", label: "Manila", count: 0 },
      { campus: "LAGUNA", label: "Laguna", count: 0 },
      { campus: "MCKINLEY", label: "McKinley", count: 0 },
    ]);
  });

  it("counts a McKinley asset under McKinley, not Laguna, and skips an asset with no home lab", () => {
    const counts = countAssetsByCampus([
      { homeLab: { campus: "MANILA" } },
      { homeLab: { campus: "MANILA" } },
      { homeLab: { campus: "LAGUNA" } },
      { homeLab: { campus: "MCKINLEY" } },
      {},
    ]);

    expect(counts.map((c) => c.count)).toEqual([2, 1, 1]);
  });
});

describe("the dashboards keep no lab or campus list of their own (#96)", () => {
  it("has no hardcoded lab codes in the Director and Staff dashboards or the Inspection Queue", () => {
    const files = [
      "pages/director/AdRICDirectorDashboard.tsx",
      "pages/staff/OverviewPage.tsx",
      "features/inspections/InspectionQueue.tsx",
      "features/analytics/director/DirectorAnalyticsView.tsx",
    ];
    for (const file of files) {
      const text = fs.readFileSync(path.join(WEB, file), "utf8");
      expect(text, file).not.toMatch(/"(CITe4D|CeHCI|CNIS|TE3D|HXIL)"/);
      expect(text, file).not.toMatch(/canlubang|taft/i);
    }
  });
});
