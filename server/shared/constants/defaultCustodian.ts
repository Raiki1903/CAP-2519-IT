/**
 * The user id the backend records when it cannot tell who is acting.
 * Layer: shared (server constant). Imported by remainingRoutes.ts and the services of features/loans, returns, transfers, and disposals. Imports nothing.
 * Used by: every workflow that records a person: intake, edit, inspection, repair, return, transfer, disposal, borrow.
 */

/**
 * User 1. The "who" columns (asset_records.current_custodian, asset_loans.borrower_id, and others)
 * are required foreign keys to users, so a write that cannot resolve a person uses this id
 * instead of failing. main.ts checks at startup that the user exists.
 */
// TODO(H-10): the acting user is guessed, and anyone not found becomes user 1. After step 13, the session gives the real user.
export const DEFAULT_CUSTODIAN_ID = 1;
