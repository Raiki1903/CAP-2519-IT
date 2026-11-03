/**
 * The activity log event types (activity_log.event_type) and their labels.
 * Layer: shared. Imported by server/shared/services/activityLog.ts and web/ (the activity log page, module 6). Imports nothing.
 * Used by: every step that has no table of its own (registered, edited, deleted, missing, found), and account events.
 */

/** Every value of activity_log.event_type. Must match the `activity_log_event_type` enum in schema.prisma. */
export const ACTIVITY_EVENT_TYPES = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "SIGNUP_APPROVED",
  "SIGNUP_REJECTED",
  "ROLE_CHANGED",
  "LABS_CHANGED",
  "HEAD_CHANGED",
  "USER_DEACTIVATED",
  "USER_REACTIVATED",
  "USER_ANONYMIZED",
  "TICKET_STATUS_CHANGED",
  "ASSET_REGISTERED",
  "ASSET_EDITED",
  "ASSET_DELETED",
  "ASSET_MARKED_MISSING",
  "ASSET_FOUND",
  "CLEARANCE_RECORD_PRINTED",
] as const;

/** One value of activity_log.event_type. */
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

/** The label every screen shows for each event type. */
export const ACTIVITY_EVENT_LABELS: Record<ActivityEventType, string> = {
  LOGIN_SUCCESS: "Logged in",
  LOGIN_FAILURE: "Login failed",
  SIGNUP_APPROVED: "Sign-up approved",
  SIGNUP_REJECTED: "Sign-up rejected",
  ROLE_CHANGED: "Role changed",
  LABS_CHANGED: "Labs changed",
  HEAD_CHANGED: "Lab Head changed",
  USER_DEACTIVATED: "Account deactivated",
  USER_REACTIVATED: "Account reactivated",
  USER_ANONYMIZED: "Account anonymized",
  TICKET_STATUS_CHANGED: "Ticket status changed",
  ASSET_REGISTERED: "Asset registered",
  ASSET_EDITED: "Asset edited",
  ASSET_DELETED: "Asset deleted",
  ASSET_MARKED_MISSING: "Marked missing",
  ASSET_FOUND: "Found",
  CLEARANCE_RECORD_PRINTED: "Clearance record printed",
};
