/**
 * Loans API: every loan request the web app sends to the server, one function per endpoint.
 * Layer: api. Called by LoanForm, ReturnForm, ReturnsPage, OverviewPage, LabHeadDashboard, and state/serverData.tsx. Calls
 * client.ts; types from @shared/types/loans.
 * Used by: Researcher loan requests and return requests, Lab Head approval, TSG release and receipt, the loan lists, the
 * Accountability Form, and the clearance record.
 */
import type { InspectionInput } from "@shared/types/assets";
import type { LoanReceiveBody, LoanRequestBody } from "@shared/types/loans";
import { apiGet, apiPost, apiPut, type ApiResult } from "./client";

/**
 * Files a loan request for an asset. The borrower is the session user.
 *
 * @param assetTag the asset's tag, for example from the asset detail modal
 * @param body the destination lab (one of the borrower's own), return-by date, and purpose
 * @returns `success` and the new `loan` (Pending Approval); or `error` with the server's sentence
 */
export function requestLoan(assetTag: string, body: LoanRequestBody): Promise<ApiResult> {
  return apiPost(`/api/assets/${encodeURIComponent(assetTag)}/loans`, body);
}

/**
 * Lists every loan in the old row shape that today's screens read.
 * TODO(M-02): this still sends every loan to every caller. It goes when Joel's loan screens move to the lists below.
 *
 * @returns `success` and `loans`
 */
export function listLoans(): Promise<ApiResult> {
  return apiGet("/api/loans");
}

/**
 * Lists the loans in the given statuses, oldest request first. TSG only.
 *
 * @param statuses loan statuses, for example ["RETURN_REQUESTED", "ON_LOAN"]
 * @returns `success` and `loans`, each a Loan from @shared/types/loans; or `error` (403 for anyone but TSG)
 */
export function listLoansByStatus(statuses: string[]): Promise<ApiResult> {
  return apiGet(`/api/loans?status=${encodeURIComponent(statuses.join(","))}`);
}

/**
 * Lists the session user's own loans, newest first.
 *
 * @returns `success` and `loans`
 */
export function listMyLoans(): Promise<ApiResult> {
  return apiGet("/api/loans/mine");
}

/**
 * Lists the loans on the assets of the lab the session user heads, oldest request first.
 *
 * @returns `success` and `loans`; or `error` (403 for an account that heads no lab)
 */
export function listLabRequests(): Promise<ApiResult> {
  return apiGet("/api/loans/lab-requests");
}

/**
 * Gets what the printed Accountability Form needs for a released loan.
 *
 * @param loanId numeric loan id, without the "LOAN-" prefix
 * @returns `success`, `loan`, `asset`, `borrower`, and `releaseInspection`; or `error`
 */
export function getAccountabilityForm(loanId: number | string): Promise<ApiResult> {
  return apiGet(`/api/loans/${loanId}/accountability-form`);
}

/**
 * Cancels the session user's own loan request, before the asset is handed over.
 *
 * @param loanId numeric loan id
 * @returns `success` and the `loan`; or `error`
 */
export function cancelLoan(loanId: number | string): Promise<ApiResult> {
  return apiPut(`/api/loans/${loanId}/cancel`, {});
}

/**
 * Approves a Pending Approval loan. Only the Head of the asset's home lab may.
 *
 * @param loanId numeric loan id
 * @param decisionRemarks optional remarks
 * @returns `success` and the `loan` (now Pending Release); or `error`
 */
export function approveLoan(loanId: number | string, decisionRemarks?: string): Promise<ApiResult> {
  return apiPut(`/api/loans/${loanId}/approve`, { decisionRemarks: decisionRemarks || null });
}

/**
 * Declines a Pending Approval loan. Only the Head of the asset's home lab may.
 *
 * @param loanId numeric loan id
 * @param decisionRemarks why it is declined; the server refuses an empty one
 * @returns `success` and the `loan` (now Declined); or `error`
 */
export function declineLoan(loanId: number | string, decisionRemarks: string): Promise<ApiResult> {
  return apiPut(`/api/loans/${loanId}/decline`, { decisionRemarks });
}

/**
 * Releases a Pending Release loan to the borrower, with a Loan Release inspection. TSG only.
 *
 * @param loanId numeric loan id
 * @param inspection the condition and measurements TSG found when handing the asset over
 * @returns `success` and the `loan` (now On Loan); or `error`
 */
export function releaseLoan(loanId: number | string, inspection: InspectionInput): Promise<ApiResult> {
  return apiPut(`/api/loans/${loanId}/release`, { inspection });
}

/**
 * Asks to return an On Loan loan. Only the borrower may.
 *
 * @param loanId numeric loan id
 * @param remarks optional remarks, at most 255 characters
 * @returns `success` and the `loan` (now Return Requested); or `error`
 */
export function requestReturn(loanId: number | string, remarks?: string): Promise<ApiResult> {
  return apiPut(`/api/loans/${loanId}/return-request`, { remarks: remarks || null });
}

/**
 * Receives a returned asset, with a Return inspection and, when there is damage, a Return Damage ticket. TSG only.
 * A loan that is still On Loan can be received too (a walk-in return).
 *
 * @param loanId numeric loan id
 * @param body the inspection, and the damage if any
 * @returns `success`, the `loan` (now Returned), and `maintenance` when a ticket was opened; or `error`
 */
export function receiveLoan(loanId: number | string, body: LoanReceiveBody): Promise<ApiResult> {
  return apiPut(`/api/loans/${loanId}/receive`, body);
}

/**
 * Gets one person's clearance record, for TSG to print. The server logs the print.
 *
 * @param userId the person's user id
 * @returns `success`, `person`, `cleared`, and `loans`; or `error`
 */
export function printClearanceRecord(userId: number | string): Promise<ApiResult> {
  return apiPost(`/api/users/${userId}/clearance-record`, {});
}
