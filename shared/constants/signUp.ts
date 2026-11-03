/**
 * The sign-up rules both sides check: the email domain, the ID number's form, and the user types with their labels.
 * Layer: shared. Imported by server/features/auth (auth.validation.ts) and web/pages/auth/Register.tsx. Imports nothing.
 * Used by: sign-up, and the IT Admin's Approvals page (the user type label).
 */

/** The only email domain a sign-up accepts, compared in lower case. */
export const SIGN_UP_EMAIL_DOMAIN = "@dlsu.edu.ph";

/** The 400 message for an email outside the domain. */
export const SIGN_UP_EMAIL_MESSAGE = "Use your @dlsu.edu.ph email address.";

/**
 * 8 digits, not starting with 0. users.id_number is a number column, so a leading 0 would be lost and the stored
 * number would show as 7 digits.
 */
export const ID_NUMBER_PATTERN = /^[1-9]\d{7}$/;

/** The 400 message for an ID number that does not match ID_NUMBER_PATTERN. */
export const ID_NUMBER_MESSAGE = "Enter your 8-digit DLSU ID number.";

/** Every value of users.user_type. Must match the `users_user_type` enum in schema.prisma. */
export const USER_TYPES = ["STUDENT", "FACULTY", "STAFF"] as const;

/** One value of users.user_type. */
export type UserType = (typeof USER_TYPES)[number];

/** The label every screen shows for each user type. */
export const USER_TYPE_LABELS: Record<UserType, string> = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  STAFF: "Staff",
};
