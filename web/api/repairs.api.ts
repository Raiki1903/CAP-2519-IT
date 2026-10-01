import { apiGet, apiPost, apiPostRaw, apiPut, apiPutRaw, type ApiResult } from "./client";

export interface RepairRequestInput {
  reportedBy: string;
  description: string;
  isImmediate: boolean;
}

export interface RepairUpdateInput {
  progressStatus: string;
  assetCondition?: string;
  assetRemarks?: string;
}

export function requestRepair(assetTag: string, input: RepairRequestInput): Promise<ApiResult> {
  return apiPost(`/api/assets/${assetTag}/repair`, input);
}

export function requestRepairRaw(assetTag: string, input: RepairRequestInput): Promise<Response> {
  return apiPostRaw(`/api/assets/${assetTag}/repair`, input);
}

export function listRepairs(): Promise<ApiResult> {
  return apiGet("/api/asset_repairs");
}

export function updateRepair(repairId: number | string, input: RepairUpdateInput): Promise<ApiResult> {
  return apiPut(`/api/asset_repairs/${repairId}`, input);
}

export function updateRepairRaw(repairId: number | string, input: RepairUpdateInput): Promise<Response> {
  return apiPutRaw(`/api/asset_repairs/${repairId}`, input);
}

export function updateRepairStatus(repairId: number | string, progressStatus: string): Promise<ApiResult> {
  return apiPut(`/api/asset_repairs/${repairId}/status`, { progressStatus });
}
