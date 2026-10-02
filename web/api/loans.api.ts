/**
 * Loans API: every loan request the web app sends to the server.
 * Layer: api. Called by LoanForm, LabHeadDashboard, LabHeadAnalyticsView, and state/serverData.tsx. Calls client.ts.
 * Used by: Custodian borrow request, Lab Head approval.
 */
import { apiGet, apiPost, apiPut, type ApiResult } from "./client";

/** What the borrow form sends. */
export interface LoanRequestInput {
  /** Borrower's display name as typed in the form. */
  // TODO(H-10): the server resolves this name to a user by matching text. Phase 3 takes the borrower from the session.
  borrower: string;
  /** Destination lab code, for example "CITe4D". */
  lab: string;
  purpose: string;
  /** Due date as yyyy-mm-dd. */
  dueDate: string;
}

/**
 * Files a pending borrow request for an asset.
 *
 * @param assetTag the asset's tag, for example from the asset detail modal
 * @param input borrower, destination lab, purpose, and due date
 * @returns `success`, and `error` when the asset or a required field is missing
 */
export function requestLoan(assetTag: string, input: LoanRequestInput): Promise<ApiResult> {
  return apiPost(`/api/assets/${encodeURIComponent(assetTag)}/borrow`, input);
}

/**
 * Lists loan requests.
 *
 * @returns `success` and `loans`, an array of loan rows
 */
export function listLoans(): Promise<ApiResult> {
  return apiGet("/api/asset_loans");
}

/**
 * Approves or declines a pending loan.
 * The server accepts only "approve" or "decline" and refuses anything else.
 *
 * @param loanId numeric loan id, without the "LOAN-" prefix
 * @param decision "approve" or "decline"
 * @returns `success`, and `error` when the loan is missing or not pending
 */
export function decideLoan(loanId: number | string, decision: string): Promise<ApiResult> {
  return apiPut(`/api/asset_loans/${loanId}/decision`, { decision });
}
