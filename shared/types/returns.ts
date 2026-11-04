/**
 * Request and response shapes of the return endpoints.
 * Layer: shared. Imported by web/api/returns.api.ts, until Batch 3 commit 8 moves Record Return to PUT /api/loans/:loanId/receive.
 * Imports nothing.
 * Used by: Staff return finalization.
 */

/** The body of POST /api/assets/:assetTag/return, as ReturnForm sends it when Staff finalize a return. */
export interface ReturnInput {
  /** One of ASSET_CONDITIONS from shared/enums/assetCondition.ts. The server refuses any other value. */
  condition: string;
  /** Inspection notes. Stored as the loan's remarks and the Return inspection's remarks. */
  comments?: string;
  /** Read when `comments` is empty. ReturnForm does not send it. */
  inspection?: string;
}
