/**
 * Tests the Clearance tab's row builder: buildClearanceRows and the statuses it asks the server for.
 * Covers one row per borrower matched by user id (two people with one name stay two rows), the open-loan count (only the statuses that
 * keep a person from being cleared), people with open loans first, a hidden borrower skipped, and that a declined, cancelled, or
 * never-approved request is not asked for. No server, no database.
 * Fixtures: none.
 */
import { describe, expect, it } from "vitest";
import { buildClearanceRows, CLEARANCE_LOAN_STATUSES } from "../../web/features/loans/clearanceRows";
import type { Loan } from "../../shared/types/loans";

/** A loan with only the fields the builder reads. */
function loan(loanId: number, status: string, borrower: Loan["borrower"]): Loan {
  return { loanId, status, borrower } as unknown as Loan;
}

describe("buildClearanceRows", () => {
  it("makes one row per borrower, matched by user id and not by name", () => {
    const rows = buildClearanceRows([
      loan(1, "RETURNED", { userId: 7, name: "Ana Cruz" }),
      loan(2, "RETURNED", { userId: 7, name: "Ana Cruz" }),
      loan(3, "RETURNED", { userId: 8, name: "Ana Cruz" }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.userId === 7)?.loansOnRecord).toBe(2);
    expect(rows.find((r) => r.userId === 8)?.loansOnRecord).toBe(1);
  });

  it("counts only the loans that keep a person from being cleared as open", () => {
    const [row] = buildClearanceRows([
      loan(1, "PENDING_RELEASE", { userId: 7, name: "Ana Cruz" }),
      loan(2, "ON_LOAN", { userId: 7, name: "Ana Cruz" }),
      loan(3, "RETURN_REQUESTED", { userId: 7, name: "Ana Cruz" }),
      loan(4, "RETURNED", { userId: 7, name: "Ana Cruz" }),
      loan(5, "ENDED_BY_LOSS", { userId: 7, name: "Ana Cruz" }),
    ]);
    expect(row.openLoans).toBe(3);
    expect(row.loansOnRecord).toBe(5);
  });

  it("puts people who still hold equipment first, then sorts by name", () => {
    const rows = buildClearanceRows([
      loan(1, "RETURNED", { userId: 1, name: "Ana Cruz" }),
      loan(2, "ON_LOAN", { userId: 2, name: "Zed Reyes" }),
      loan(3, "RETURNED", { userId: 3, name: "Ben Lim" }),
    ]);
    expect(rows.map((r) => r.userId)).toEqual([2, 1, 3]);
  });

  it("skips a loan whose borrower is hidden", () => {
    expect(buildClearanceRows([loan(1, "ON_LOAN", { hidden: true })])).toEqual([]);
  });
});

describe("CLEARANCE_LOAN_STATUSES", () => {
  it("leaves out the requests that are on no clearance record", () => {
    expect(CLEARANCE_LOAN_STATUSES).not.toContain("PENDING_APPROVAL");
    expect(CLEARANCE_LOAN_STATUSES).not.toContain("DECLINED");
    expect(CLEARANCE_LOAN_STATUSES).not.toContain("CANCELLED");
  });

  it("asks for every status the record lists", () => {
    expect([...CLEARANCE_LOAN_STATUSES].sort()).toEqual(
      ["ENDED_BY_LOSS", "ENDED_BY_MAINTENANCE", "ON_LOAN", "PENDING_RELEASE", "RETURNED", "RETURN_REQUESTED"].sort(),
    );
  });
});
