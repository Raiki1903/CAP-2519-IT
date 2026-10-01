import { apiGet, apiPost, apiPut, type ApiResult } from "./client";

export interface TransferRequestInput {
  toEmail: string;
  reason: string;
  lab: string;
  effectiveDate: string;
}

export function requestTransfer(assetTag: string, input: TransferRequestInput): Promise<ApiResult> {
  return apiPost(`/api/assets/${assetTag}/transfer`, input);
}

export function listTransfers(): Promise<ApiResult> {
  return apiGet("/api/asset_transfers");
}

export function decideTransfer(transferId: number | string, decision: string): Promise<ApiResult> {
  return apiPut(`/api/asset_transfers/${transferId}/decision`, { decision });
}
