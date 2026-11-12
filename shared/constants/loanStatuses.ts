/**
 * The loan statuses (asset_loans.status), their labels, and the groups the rules are built from.
 * Layer: shared. Imported by the server (lifecycle guard, derive helpers, loans service, analytics service) and web/. Imports nothing.
 * Used by: the loan workflow, holder and location, overdue, clearance, and the Director's loan flow.
 */

/** Every value of asset_loans.status. Must match the `asset_loans_status` enum in schema.prisma. */
export const LOAN_STATUSES = [
  "PENDING_APPROVAL",
  "PENDING_RELEASE",
  "DECLINED",
  "CANCELLED",
  "ON_LOAN",
  "RETURN_REQUESTED",
  "RETURNED",
  "ENDED_BY_MAINTENANCE",
  "ENDED_BY_LOSS",
] as const;

/** One value of asset_loans.status. */
export type LoanStatus = (typeof LOAN_STATUSES)[number];

/** The label every screen shows for each loan status. */
export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  PENDING_APPROVAL: "Pending Approval",
  PENDING_RELEASE: "Pending Release",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  ON_LOAN: "On Loan",
  RETURN_REQUESTED: "Return Requested",
  RETURNED: "Returned",
  ENDED_BY_MAINTENANCE: "Ended by Maintenance",
  ENDED_BY_LOSS: "Ended by Loss",
};

/** A loan that is not final: the asset's open loan, if it has one. An asset has at most one. */
export const OPEN_LOAN_STATUSES: readonly LoanStatus[] = ["PENDING_APPROVAL", "PENDING_RELEASE", "ON_LOAN", "RETURN_REQUESTED"];

/** A loan still waiting for its approval or its release. The asset stays Available, but no second request is taken. */
export const WAITING_LOAN_STATUSES: readonly LoanStatus[] = ["PENDING_APPROVAL", "PENDING_RELEASE"];

/** A loan whose borrower has the asset: the holder, the current location, and overdue come from it. */
export const HELD_LOAN_STATUSES: readonly LoanStatus[] = ["ON_LOAN", "RETURN_REQUESTED"];

/** A loan that keeps its borrower from being cleared (no unreturned equipment). */
export const UNCLEARED_LOAN_STATUSES: readonly LoanStatus[] = ["PENDING_RELEASE", "ON_LOAN", "RETURN_REQUESTED"];

/** A final loan status. A loan in one of these has `closed_at` set. */
export const FINAL_LOAN_STATUSES: readonly LoanStatus[] = ["DECLINED", "CANCELLED", "RETURNED", "ENDED_BY_MAINTENANCE", "ENDED_BY_LOSS"];

/**
 * The loans that were handed over: held now, or closed after a release. Stored as statuses rather than read from
 * released_at, so loans from before the release step (which have no released_at) count too.
 */
export const HANDED_OVER_LOAN_STATUSES: readonly LoanStatus[] = [...HELD_LOAN_STATUSES, "RETURNED", "ENDED_BY_MAINTENANCE", "ENDED_BY_LOSS"];
