/**
 * The limits on a password's length.
 * Layer: shared. Imported by server/features/auth and the tests. Imports nothing.
 * Used by: login.
 */

/** Longest password accepted. The server takes bodies up to 50 MB, and hashing an unbounded password costs CPU on every attempt. */
export const MAX_PASSWORD_LENGTH = 128;
