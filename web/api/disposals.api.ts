import { apiGet, apiPost, apiPut, type ApiResult } from "./client";

export interface DisposalRequestInput {
  requestedBy: string;
  lastCustodian: string;
  breakdownReasons: string;
  disposalPathway: string;
  decommissionDate: string;
}

export function requestDisposal(assetTag: string, input: DisposalRequestInput): Promise<ApiResult> {
  return apiPost(`/api/assets/${encodeURIComponent(assetTag)}/disposal`, input);
}

export function listDisposals(): Promise<ApiResult> {
  return apiGet("/api/asset_disposals");
}

export function decideDisposal(disposalId: number | string, decision: string): Promise<ApiResult> {
  return apiPut(`/api/asset_disposals/${disposalId}/decision`, { decision });
}
