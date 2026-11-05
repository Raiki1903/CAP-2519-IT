/**
 * The answer shape of GET /api/notifications/mine.
 * Layer: shared. Imported by server/features/notifications/ and web/api/notifications.api.ts. Imports
 * shared/constants/notifications.ts.
 * Used by: the notification bell.
 */
import type { NotificationKind } from '../constants/notifications';

/**
 * One notification, worked out from loans, tickets, retirements, and inspections on each call
 * (docs/contracts/lifecycle.md, 7.10). It names no person.
 */
export interface Notification {
  kind: NotificationKind;
  /** The kind's label, from NOTIFICATION_LABELS. */
  label: string;
  /** The loan, for the loan kinds and STATUS_CHECK_DUE (the loan the holder holds the asset on). */
  loanId?: number;
  /** The ticket, for RECEIPT_WAITING and MAINTENANCE_OPEN. */
  maintenanceId?: number;
  /** The retirement, for DISPOSAL_DECISION_WAITING. */
  retirementId?: number;
  /** The ticket's status label, for MAINTENANCE_OPEN. */
  statusLabel?: string;
  assetTag?: string;
  /** The asset's home lab. */
  centerId?: number;
  /**
   * yyyy-mm-dd: the request date (awaiting approval), the approval date (release waiting), the return request date
   * (return waiting), the return-by date (due soon, overdue), the newest inspection's date (status check, left out when
   * the asset has none), the report date (receipt waiting, my ticket), or the request date (disposal decision).
   */
  date?: string;
}
