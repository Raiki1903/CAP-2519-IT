/**
 * The notification kinds of GET /api/notifications/mine, their labels, the due-soon window, and the status check period.
 * Layer: shared. Imported by server/features/notifications/ and web/ (the bell). Imports nothing.
 * Used by: the notification bell of every role but the IT Admin.
 */

/** Every notification kind (docs/contracts/lifecycle.md, 7.10). */
export const NOTIFICATION_KINDS = [
  "LOAN_AWAITING_APPROVAL",
  "RELEASE_WAITING",
  "RETURN_WAITING",
  "LOAN_DUE_SOON",
  "LOAN_OVERDUE",
  "STATUS_CHECK_DUE",
  "RECEIPT_WAITING",
  "DISPOSAL_DECISION_WAITING",
  "MAINTENANCE_OPEN",
] as const;

/** One notification kind. */
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** The label the bell shows for each kind. */
export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  LOAN_AWAITING_APPROVAL: "Loan request waiting for your approval",
  RELEASE_WAITING: "Approved loan waiting for release",
  RETURN_WAITING: "Return waiting to be received",
  LOAN_DUE_SOON: "Loan due soon",
  LOAN_OVERDUE: "Loan overdue",
  STATUS_CHECK_DUE: "Status check due",
  RECEIPT_WAITING: "Reported issue waiting for receipt",
  DISPOSAL_DECISION_WAITING: "Disposal request waiting for your decision",
  MAINTENANCE_OPEN: "Your maintenance ticket",
};

/** A held loan is due soon when its return-by date is today or up to this many days after. */
export const DUE_SOON_DAYS = 3;

/**
 * The holder of an asset is asked for a status check (a Self Report) when its newest inspection of any type is older
 * than this many days, or it has none.
 */
export const STATUS_CHECK_DAYS = 90;
