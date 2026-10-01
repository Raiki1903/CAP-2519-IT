import { apiDelete, apiGet, apiGetRaw, apiPostRaw, apiPutRaw, type ApiResult } from "./client";

export function listAssets(): Promise<ApiResult> {
  return apiGet("/api/assets");
}

export function listAssetsRaw(): Promise<Response> {
  return apiGetRaw("/api/assets");
}

export function getCustodianHistory(assetTag: string): Promise<ApiResult> {
  return apiGet(`/api/assets/${assetTag}/custodian-history`);
}

export function createAssetRaw(form: unknown): Promise<Response> {
  return apiPostRaw("/api/assets", form);
}

export function updateAssetRaw(assetTag: string, form: unknown): Promise<Response> {
  return apiPutRaw(`/api/assets/${encodeURIComponent(assetTag)}`, form);
}

export function deleteAsset(assetTag: string): Promise<ApiResult> {
  return apiDelete(`/api/assets/${encodeURIComponent(assetTag)}`);
}
