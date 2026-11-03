/**
 * Assets API: the asset registry calls (list, history, create, edit, delete).
 * Layer: api. Called by the four role dashboards, AssetDetailModal, StaffAnalyticsView, and state/serverData.tsx. Calls client.ts; types from @shared/types/assets.
 * Used by: every role's inventory view, Staff asset registration and editing.
 */
import type { AssetCreateInput, AssetUpdateInput } from "@shared/types/assets";
import { apiDelete, apiGet, apiGetRaw, apiPostRaw, apiPutRaw, type ApiResult } from "./client";

/** Reads the answer to `createAssetRaw` or `updateAssetRaw`; see client.ts. */
export { readResult } from "./client";

/**
 * Lists every asset with its current state, worked out on the server.
 *
 * @returns `success` and `assets`, each an AssetListItem from @shared/types/assets
 */
export function listAssets(): Promise<ApiResult> {
  return apiGet("/api/assets");
}

/**
 * Same request as `listAssets`, but returns the untouched Response.
 * For StaffAnalyticsView, which checks `res.ok` before parsing.
 *
 * @returns the raw Response; the caller checks the status and parses it
 */
export function listAssetsRaw(): Promise<Response> {
  return apiGetRaw("/api/assets");
}

/**
 * Lists what happened to an asset, oldest first: loans, inspections, maintenance, retirements, and logged steps.
 *
 * @param assetTag the asset's tag
 * @returns `success` and `events`, each an AssetHistoryEvent from @shared/types/assets
 */
export function getAssetHistory(assetTag: string): Promise<ApiResult> {
  return apiGet(`/api/assets/${encodeURIComponent(assetTag)}/history`);
}

/**
 * Registers a new asset. Returns the untouched Response; the intake form reads
 * it with `readResult`, so it shows only the server's message.
 *
 * @param form the intake form values
 * @returns the raw Response; on success its JSON holds `asset` with the new `asset_tag`
 */
export function createAssetRaw(form: AssetCreateInput): Promise<Response> {
  return apiPostRaw("/api/assets", form);
}

/**
 * Saves edits to an asset. Returns the untouched Response for the same reason
 * as `createAssetRaw`. A change to a record field adds a record; no record is overwritten (issue #74).
 *
 * @param assetTag the asset's tag
 * @param form only the fields the edit dialog changed
 * @returns the raw Response
 */
export function updateAssetRaw(assetTag: string, form: AssetUpdateInput): Promise<Response> {
  return apiPutRaw(`/api/assets/${encodeURIComponent(assetTag)}`, form);
}

/**
 * Deletes an asset.
 *
 * @param assetTag the asset's tag
 * @returns `success`, and `error` when the delete fails
 */
// TODO(H-03): this is a hard delete that destroys the asset's history. Phase 3 turns it into "retire" (issue #69).
export function deleteAsset(assetTag: string): Promise<ApiResult> {
  return apiDelete(`/api/assets/${encodeURIComponent(assetTag)}`);
}
