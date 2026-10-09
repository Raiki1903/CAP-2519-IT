/**
 * Disposals API: disposal requests and the Director's decisions.
 * Layer: api. Called by DisposalFormDialog, AdRICDirectorDashboard, NotificationCenter, and state/serverData.tsx. Calls client.ts.
 * Used by: Staff disposal filing, Director approval.
 */
import type { DisposalRequestInput } from "@shared/types/disposals";
import { apiGet, apiPost, apiPut, type ApiResult } from "./client";

/**
 * Files a disposal request for an asset.
 *
 * @param assetTag the asset's tag
 * @param input who filed it, the last custodian, reasons, pathway, and date
 * @returns `success` and `disposal` (with `disposal_id`), or `error`
 */
export function requestDisposal(assetTag: string, input: DisposalRequestInput): Promise<ApiResult> {
  return apiPost(`/api/assets/${encodeURIComponent(assetTag)}/disposal`, input);
}

/**
 * Lists disposal requests.
 *
 * @returns `success` and `disposals`, an array of disposal rows
 */
export function listDisposals(): Promise<ApiResult> {
  return apiGet("/api/asset_disposals");
}

/**
 * Approves or rejects a pending disposal.
 * The server accepts only "approve" or "reject" here. Loans and transfers use
 * "decline" instead, so the words are not interchangeable.
 *
 * @param disposalId numeric disposal id
 * @param decision "approve" or "reject"
 * @returns `success`, and `error` when the decision is refused
 */
export function decideDisposal(disposalId: number | string, decision: string): Promise<ApiResult> {
  return apiPut(`/api/asset_disposals/${disposalId}/decision`, { decision });
}
