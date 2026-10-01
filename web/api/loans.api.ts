import { apiGet, apiPost, apiPut, type ApiResult } from "./client";

export interface LoanRequestInput {
  borrower: string;
  lab: string;
  purpose: string;
  dueDate: string;
}

export function requestLoan(assetTag: string, input: LoanRequestInput): Promise<ApiResult> {
  return apiPost(`/api/assets/${encodeURIComponent(assetTag)}/borrow`, input);
}

export function listLoans(): Promise<ApiResult> {
  return apiGet("/api/asset_loans");
}

export function decideLoan(loanId: number | string, decision: string): Promise<ApiResult> {
  return apiPut(`/api/asset_loans/${loanId}/decision`, { decision });
}
