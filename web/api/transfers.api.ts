/**
 * Transfers API: custodianship transfer requests and decisions.
 * Layer: api. Called by TransferForm, LabHeadDashboard, LabHeadAnalyticsView, NotificationCenter, and state/serverData.tsx. Calls client.ts.
 * Used by: Custodian transfer request, Lab Head approval.
 */
import { apiGet, apiPost, apiPut, type ApiResult } from "./client";

/** What the transfer form sends. */
export interface TransferRequestInput {
  /** Email of the person receiving the asset. */
  toEmail: string;
  reason: string;
  /** Destination lab code, for example "CITe4D". */
  // TODO(H-19): the server does not keep lab and effectiveDate in their own columns. Phase 3.
  lab: string;
  /** Effective date as yyyy-mm-dd. */
  effectiveDate: string;
}

/**
 * Files a pending transfer request for an asset.
 *
 * @param assetTag the asset's tag, sent as is (not URL-encoded)
 * @param input recipient email, reason, destination lab, and effective date
 * @returns `success`, and `error` when the request is refused
 */
export function requestTransfer(assetTag: string, input: TransferRequestInput): Promise<ApiResult> {
  return apiPost(`/api/assets/${assetTag}/transfer`, input);
}

/**
 * Lists transfer requests.
 *
 * @returns `success` and `transfers`, an array of transfer rows
 */
export function listTransfers(): Promise<ApiResult> {
  return apiGet("/api/asset_transfers");
}

/**
 * Approves or declines a pending transfer.
 * The server accepts only "approve" or "decline" and refuses anything else.
 *
 * @param transferId numeric transfer id
 * @param decision "approve" or "decline"
 * @returns `success`, and `error` when the decision is refused
 */
export function decideTransfer(transferId: number | string, decision: string): Promise<ApiResult> {
  return apiPut(`/api/asset_transfers/${transferId}/decision`, { decision });
}
