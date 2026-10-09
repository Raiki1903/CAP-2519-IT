/**
 * Request and response shapes of the loan endpoints.
 * Layer: shared. Imported by server/features/loans/ and web/api/loans.api.ts. Imports nothing.
 * Used by: Custodian borrow request, Lab Head approval.
 */

/** The body of POST /api/assets/:assetTag/borrow, as LoanForm sends it. */
export interface LoanRequestInput {
  /** Borrower's display name as typed in the form. */
  // TODO(H-10): the server resolves this name to a user by matching text, and an unknown name becomes user 1 (issue #32). The borrower comes from the session after step 13.
  borrower: string;
  /** Destination lab code, for example "CITe4D". Optional: without it the asset keeps its current location on approval. */
  lab?: string;
  purpose: string;
  /** Due date as yyyy-mm-dd. */
  dueDate: string;
}

/**
 * The two words PUT /api/asset_loans/:loanId/decision accepts.
 * Transfers accept the same two; disposals use "reject" instead of "decline".
 */
export type LoanDecision = "approve" | "decline";

/** One row of GET /api/asset_loans. Several fields come in two spellings because different screens read each. */
export interface LoanListItem {
  /** Display id, "LOAN-<loan_id>". */
  id: string;
  loanId: number;
  loan_id: number;
  /** The asset's numeric id. */
  asset_id: number;
  /** The asset's tag, for example "CeLT-0004". */
  assetId: string;
  asset: string;
  assetName: string;
  borrower_id: number;
  /** The borrower's full name. */
  borrower: string;
  /** The purpose as typed, without the destination lab line. */
  purpose: string;
  /** The destination lab picked on the form, read back out of the stored purpose. (H-19) */
  destinationLab?: string;
  /** yyyy-mm-dd. */
  requestedOn: string;
  /** yyyy-mm-dd. */
  dueDate: string;
  /** "Pending", "Approved", or "Declined". */
  status: string;
  /** The borrower's campus, from their research center; "Manila" when they have none. */
  location: string;
  /** The asset tag's prefix, which the Lab Head screen uses to show only its own lab's requests. (M-02) */
  lab: string;
  /** The borrower's research center id; 1 when they have none. */
  center_id: number;
}
