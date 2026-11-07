/**
 * Request and response shapes of the IT Admin's activity log (docs/contracts/lifecycle.md, section 7.7).
 * Layer: shared. Imported by server/features/activity-log/ and, in Stop 3, web/api. Imports
 * shared/constants/activityEvents.ts.
 * Used by: the IT Admin's Activity Log page.
 */
import type { ActivityEventType } from "../constants/activityEvents";

/** The filters of GET /api/activity-log, each optional except the page. */
export interface ActivityLogFilters {
  eventType?: ActivityEventType;
  /** The account that acted. */
  actorId?: number;
  /** The account the event is about. */
  targetUserId?: number;
  /** The asset the event is about, by its tag. An unknown tag gives no rows. */
  assetTag?: string;
  /** The first day, yyyy-mm-dd in the server's local time, included. */
  from?: string;
  /** The last day, yyyy-mm-dd in the server's local time, included. */
  to?: string;
  /** The page, from 1. */
  page: number;
}

/** One row of the activity log (contract "Common objects", ActivityEntry). Never an email. */
export interface ActivityEntry {
  logId: number;
  eventType: ActivityEventType;
  /** From ACTIVITY_EVENT_LABELS. */
  eventLabel: string;
  /** The account that acted, or null when nobody did (a failed login). */
  actor: { userId: number; name: string } | null;
  targetUser: { userId: number; name: string } | null;
  asset: { assetId: number; tag: string } | null;
  details: string | null;
  /** ISO time. */
  createdAt: string;
}

/** The answer of GET /api/activity-log: one page, newest first. */
export interface ActivityLogPage {
  entries: ActivityEntry[];
  page: number;
  /** At least 1, even when there are no rows. */
  pageCount: number;
}
