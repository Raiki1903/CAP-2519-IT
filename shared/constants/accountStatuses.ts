/**
 * The account statuses (users.account_status) and their labels.
 * Layer: shared. Imported by server/shared/middleware (requireActive), server/features/auth, and web/. Imports nothing.
 * Used by: login, every action (only an Active account may act), sign-ups, and the users page.
 */

/** Every value of users.account_status. Must match the `users_account_status` enum in schema.prisma. */
export const ACCOUNT_STATUSES = ["PENDING", "ACTIVE", "INACTIVE", "REJECTED"] as const;

/** One value of users.account_status. */
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** The 403 message, at login and on every step, for an account that is Pending, Inactive, or Rejected. */
export const ACCOUNT_NOT_ACTIVE_MESSAGE = "This account is not active. Contact the IT Admin.";

/** The label every screen shows for each account status. */
export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  REJECTED: "Rejected",
};
