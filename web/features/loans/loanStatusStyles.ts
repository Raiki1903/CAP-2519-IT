/**
 * Loan status colours: one badge colour and one card accent per loan status, so every loan list colours a status the same way.
 * Layer: feature component (style table). Called by LoansPage, ResearcherMyLoans, and LabHeadLoanRequests. Calls nothing.
 * Used by: TSG Returns tab, Researcher My Loans, Lab Head Requests.
 */

/** The badge colours of each loan status. The word on the badge is the server's `statusLabel`, never typed here. */
const LOAN_STATUS_BADGE: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_RELEASE: "bg-blue-50 text-blue-700 border-blue-200",
  ON_LOAN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RETURN_REQUESTED: "bg-purple-50 text-purple-700 border-purple-200",
  RETURNED: "bg-slate-50 text-slate-700 border-slate-200",
  DECLINED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-300",
  ENDED_BY_MAINTENANCE: "bg-amber-50 text-amber-700 border-amber-200",
  ENDED_BY_LOSS: "bg-red-50 text-red-700 border-red-200",
};

/** The left-border colour of a loan card for each status. A closed loan is slate. */
const LOAN_STATUS_ACCENT: Record<string, string> = {
  PENDING_APPROVAL: "border-l-amber-500",
  PENDING_RELEASE: "border-l-blue-500",
  ON_LOAN: "border-l-emerald-500",
  RETURN_REQUESTED: "border-l-purple-500",
};

/**
 * Returns the badge classes for a loan status, to go on a `Badge variant="outline"`.
 *
 * @param status a loan status such as "ON_LOAN"
 * @returns colour classes; a neutral fill for a status not in the table
 */
export function loanStatusBadgeClass(status: string): string {
  return LOAN_STATUS_BADGE[status] ?? "bg-muted";
}

/**
 * Returns the left-border colour of a loan card. An overdue loan is red whatever its status.
 *
 * @param status a loan status such as "ON_LOAN"
 * @param isOverdue the loan's `isOverdue` flag
 */
export function loanCardAccentClass(status: string, isOverdue: boolean): string {
  if (isOverdue) return "border-l-red-500";
  return LOAN_STATUS_ACCENT[status] ?? "border-l-slate-300";
}
