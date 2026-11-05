/**
 * The notification kinds of GET /api/notifications/mine, their labels, and the due-soon window.
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
] as const;

/** One notification kind. */
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** The label the bell shows for each kind. STATUS_CHECK_DUE is sent once the routine inspection schedule exists (Batch 5). */
export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  LOAN_AWAITING_APPROVAL: "Loan request waiting for your approval",
  RELEASE_WAITING: "Approved loan waiting for release",
  RETURN_WAITING: "Return waiting to be received",
  LOAN_DUE_SOON: "Loan due soon",
  LOAN_OVERDUE: "Loan overdue",
  STATUS_CHECK_DUE: "Status check due",
};

/** A held loan is due soon when its return-by date is today or up to this many days after. */
export const DUE_SOON_DAYS = 3;
