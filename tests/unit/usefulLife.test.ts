/**
 * The straight-line present value formula (shared/constants/usefulLife.ts), used by the asset list,
 * the asset modal, and the Director's Inventory Report.
 * Workflow: an asset's present value. Needs no server or database.
 */
import { describe, expect, it } from "vitest";
import { presentValue } from "../../shared/constants/usefulLife";

describe("presentValue", () => {
  const usefulLifeYears = 5;
  const today = "2026-11-08";

  it("is the full acquisition value at 0 years owned", () => {
    expect(presentValue(10000, "2026-11-08", usefulLifeYears, today)).toBe(10000);
  });

  it("drops one fifth for every whole year owned", () => {
    expect(presentValue(10000, "2025-11-08", usefulLifeYears, today)).toBe(8000);
    expect(presentValue(10000, "2024-11-08", usefulLifeYears, today)).toBe(6000);
  });

  it("is 0 at exactly the useful life", () => {
    expect(presentValue(10000, "2021-11-08", usefulLifeYears, today)).toBe(0);
  });

  it("never goes below 0 past the useful life", () => {
    expect(presentValue(10000, "2020-11-08", usefulLifeYears, today)).toBe(0);
  });

  it("counts 1 year 11 months owned as 1 whole year", () => {
    expect(presentValue(10000, "2024-12-08", usefulLifeYears, today)).toBe(8000);
  });

  it("counts a procurement date in the future as 0 years owned", () => {
    expect(presentValue(10000, "2027-01-01", usefulLifeYears, today)).toBe(10000);
  });

  it("is null when the acquisition value is missing", () => {
    expect(presentValue(null, "2025-11-08", usefulLifeYears, today)).toBeNull();
  });

  it("is null when the procurement date is missing", () => {
    expect(presentValue(10000, null, usefulLifeYears, today)).toBeNull();
  });

  it("rounds to 2 decimals", () => {
    expect(presentValue(12345.67, "2025-11-08", usefulLifeYears, today)).toBe(9876.54);
  });
});
