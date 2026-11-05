/**
 * Rows of the Clearance tab: one per borrower, built from the loans the server lists.
 * Layer: feature component (pure helper). Called by pages/staff/LoansPage.tsx and ClearanceTab.tsx. Calls shared/constants/loanStatuses.ts.
 * Used by: TSG, to pick the person whose Equipment Return and Clearance Record to prepare.
 */
import { LOAN_STATUSES, UNCLEARED_LOAN_STATUSES, type LoanStatus } from "@shared/constants/loanStatuses";
import type { Loan } from "@shared/types/loans";

/**
 * The loan statuses the Clearance tab asks the server for: the ones a clearance record lists (a loan handed over, or still
 * waiting in Pending Release). A request that was declined, cancelled, or never approved is on no record, so a person with only
 * those has no row to prepare.
 */
export const CLEARANCE_LOAN_STATUSES: readonly LoanStatus[] = LOAN_STATUSES.filter(
  (s) => s !== "PENDING_APPROVAL" && s !== "DECLINED" && s !== "CANCELLED",
);

/** One borrower on the Clearance tab. */
export interface ClearanceRow {
  userId: number;
  name: string;
  /** Loans that keep the person from being cleared: Pending Release, On Loan, Return Requested. */
  openLoans: number;
  /** Every loan the clearance record would list. */
  loansOnRecord: number;
}

/**
 * Groups loans into one row per borrower, matched by user id, never by name. A loan whose borrower is hidden has no id and is skipped.
 *
 * @param loans loans in the clearance statuses, from GET /api/loans?status=
 * @returns the rows, people who still hold equipment first, then by name
 */
export function buildClearanceRows(loans: Loan[]): ClearanceRow[] {
  const byUser = new Map<number, ClearanceRow>();
  for (const loan of loans) {
    if (!("userId" in loan.borrower)) continue;
    const { userId, name } = loan.borrower;
    const row = byUser.get(userId) ?? { userId, name, openLoans: 0, loansOnRecord: 0 };
    row.loansOnRecord += 1;
    if (UNCLEARED_LOAN_STATUSES.includes(loan.status as LoanStatus)) row.openLoans += 1;
    byUser.set(userId, row);
  }
  return [...byUser.values()].sort((a, b) => b.openLoans - a.openLoans || a.name.localeCompare(b.name));
}
