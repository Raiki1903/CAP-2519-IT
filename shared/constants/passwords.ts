/**
 * The limits on a password's length.
 * Layer: shared. Imported by server/features/auth, web/pages/auth/Register.tsx, and the tests. Imports nothing.
 * Used by: login and sign-ups.
 */

/** Shortest password a sign-up accepts. Login has no such check: an older account may have a shorter one. */
export const MIN_PASSWORD_LENGTH = 8;

/** Longest password accepted. The server takes bodies up to 50 MB, and hashing an unbounded password costs CPU on every attempt. */
export const MAX_PASSWORD_LENGTH = 128;
