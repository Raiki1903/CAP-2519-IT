/**
 * The answer shape of GET /api/notifications/mine.
 * Layer: shared. Imported by server/features/notifications/ and web/api/notifications.api.ts. Imports
 * shared/constants/notifications.ts.
 * Used by: the notification bell.
 */
import type { NotificationKind } from '../constants/notifications';

/** One notification, worked out from loans on each call (docs/contracts/lifecycle.md, 7.10). It names no person. */
export interface Notification {
  kind: NotificationKind;
  /** The kind's label, from NOTIFICATION_LABELS. */
  label: string;
  loanId?: number;
  assetTag?: string;
  /** The asset's home lab. */
  centerId?: number;
  /**
   * yyyy-mm-dd: the request date (awaiting approval), the approval date (release waiting), the return request date
   * (return waiting), or the return-by date (due soon, overdue).
   */
  date?: string;
}
