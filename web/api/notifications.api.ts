/**
 * Notifications API: the one request behind the notification bell.
 * Layer: api. Called by features/notifications/NotificationCenter.tsx. Calls client.ts; types from @shared/types/notifications.
 * Used by: the notification bell of every role but the IT Admin.
 */
import { apiGet, type ApiResult } from "./client";

/**
 * Gets the session user's notifications, worked out by the server from the loans on each call: a Head's waiting
 * approvals, TSG's waiting releases and returns, and a borrower's due-soon and overdue loans.
 *
 * @returns `success` and `notifications`, each a Notification from @shared/types/notifications; or `error`
 */
export function getMyNotifications(): Promise<ApiResult> {
  return apiGet("/api/notifications/mine");
}
