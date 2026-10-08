/**
 * Repairs API: repair tickets and their progress.
 * Layer: api. Called by RepairForm, ReturnForm, useRepairTickets, StaffAnalyticsView, and state/serverData.tsx. Calls client.ts.
 * Used by: Custodian repair request, Staff repair queue and progress updates.
 */
import { apiGet, apiPost, apiPostRaw, apiPut, apiPutRaw, type ApiResult } from "./client";

/** What a repair request sends. */
export interface RepairRequestInput {
  /** Display name of the person reporting the fault. */
  // TODO(H-10): the server resolves this name to a user by matching text. Phase 3 takes the reporter from the session.
  reportedBy: string;
  description: string;
  /** True when the fault needs immediate attention. */
  isImmediate: boolean;
}

/** What a repair progress update sends. Only `progressStatus` is required. */
export interface RepairUpdateInput {
  // TODO(H-07): free text, the server accepts any value. Phase 3 makes it an enum.
  progressStatus: string;
  /** Condition after the repair, one of ASSET_CONDITIONS. */
  assetCondition?: string;
  assetRemarks?: string;
}

/**
 * Opens a repair ticket for an asset.
 *
 * @param assetTag the asset's tag, sent as is (not URL-encoded)
 * @param input reporter, description, and urgency
 * @returns `success`, and `error` when the ticket is refused
 */
export function requestRepair(assetTag: string, input: RepairRequestInput): Promise<ApiResult> {
  return apiPost(`/api/assets/${assetTag}/repair`, input);
}

/**
 * Same request as `requestRepair`, but returns the untouched Response.
 * For state/serverData.tsx, which sends the request and never reads the answer.
 *
 * @returns the raw Response
 */
export function requestRepairRaw(assetTag: string, input: RepairRequestInput): Promise<Response> {
  return apiPostRaw(`/api/assets/${assetTag}/repair`, input);
}

/**
 * Lists repair tickets.
 *
 * @returns `success` and `repairs`, an array of ticket rows
 */
export function listRepairs(): Promise<ApiResult> {
  return apiGet("/api/asset_repairs");
}

/**
 * Updates a repair ticket. The server also changes the asset's own status to
 * match (for example into MAINTENANCE), so callers refresh the asset list too.
 *
 * @param repairId numeric ticket id, without the "MNT-" prefix
 * @param input new progress status, and optionally the condition and remarks
 * @returns `success`, and `error` when the update is refused
 */
export function updateRepair(repairId: number | string, input: RepairUpdateInput): Promise<ApiResult> {
  return apiPut(`/api/asset_repairs/${repairId}`, input);
}

/**
 * Same request as `updateRepair`, but returns the untouched Response.
 * For state/serverData.tsx, which sends the request and never reads the answer.
 *
 * @returns the raw Response
 */
export function updateRepairRaw(repairId: number | string, input: RepairUpdateInput): Promise<Response> {
  return apiPutRaw(`/api/asset_repairs/${repairId}`, input);
}

/**
 * Moves a ticket to a new status through the second, separate status endpoint.
 *
 * @param repairId numeric ticket id
 * @param progressStatus the new status text
 * @returns `success`, and `error` when the update is refused
 */
// TODO(H-06): this endpoint and the one behind updateRepair have different side effects. They merge into one when repairs is extracted (step 12).
export function updateRepairStatus(repairId: number | string, progressStatus: string): Promise<ApiResult> {
  return apiPut(`/api/asset_repairs/${repairId}/status`, { progressStatus });
}
