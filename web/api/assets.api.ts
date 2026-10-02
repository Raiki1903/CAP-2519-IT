/**
 * Assets API: the asset registry calls (list, history, create, edit, delete).
 * Layer: api. Called by the four role dashboards, AssetDetailModal, TSGAnalyticsView, and state/serverData.tsx. Calls client.ts.
 * Used by: every role's inventory view, Staff asset registration and editing.
 */
import { apiDelete, apiGet, apiGetRaw, apiPostRaw, apiPutRaw, type ApiResult } from "./client";

/**
 * Lists every asset with its current state.
 *
 * @returns `success` and `assets`, an array of asset view rows
 */
// TODO(M-01): the server loads nine whole tables for this, and most screens call it. Phase 3 replaces it with targeted queries.
export function listAssets(): Promise<ApiResult> {
  return apiGet("/api/assets");
}

/**
 * Same request as `listAssets`, but returns the untouched Response.
 * For TSGAnalyticsView, which checks `res.ok` before parsing.
 *
 * @returns the raw Response; the caller checks the status and parses it
 */
export function listAssetsRaw(): Promise<Response> {
  return apiGetRaw("/api/assets");
}

/**
 * Lists who has held an asset.
 *
 * @param assetTag the asset's tag, sent as is (not URL-encoded)
 * @returns `success` and `custodianHistory`
 */
export function getCustodianHistory(assetTag: string): Promise<ApiResult> {
  return apiGet(`/api/assets/${assetTag}/custodian-history`);
}

/**
 * Registers a new asset. Returns the untouched Response because the intake
 * form checks the status and content type itself, so it can show a non-JSON
 * server error as readable text.
 *
 * @param form the intake form values
 * @returns the raw Response; on success its JSON holds `asset` with the new `asset_tag`
 */
export function createAssetRaw(form: unknown): Promise<Response> {
  return apiPostRaw("/api/assets", form);
}

/**
 * Saves edits to an asset. Returns the untouched Response for the same reason
 * as `createAssetRaw`.
 *
 * @param assetTag the asset's tag
 * @param form the edit dialog values
 * @returns the raw Response
 */
// TODO(H-14): the server overwrites the newest history row instead of adding one. Phase 3.
export function updateAssetRaw(assetTag: string, form: unknown): Promise<Response> {
  return apiPutRaw(`/api/assets/${encodeURIComponent(assetTag)}`, form);
}

/**
 * Deletes an asset.
 *
 * @param assetTag the asset's tag
 * @returns `success`, and `error` when the delete fails
 */
// TODO(H-03): this is a hard delete that destroys the asset's history. Phase 3 turns it into "retire".
export function deleteAsset(assetTag: string): Promise<ApiResult> {
  return apiDelete(`/api/assets/${encodeURIComponent(assetTag)}`);
}
