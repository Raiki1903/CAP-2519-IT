/**
 * Retirements API: every disposal request the web app sends to the server, one function per endpoint.
 * Layer: api. Called by DisposalFormDialog, DisposalDecisionControls, CompleteDisposalDialog, and state/serverData.tsx.
 * Calls client.ts; types from @shared/types/retirements.
 * Used by: TSG disposal requests and completion, the Director's and the Secretary's decisions, the disposal lists.
 */
import type { RetirementCompleteBody, RetirementDecisionBody, RetirementRequestBody } from "@shared/types/retirements";
import { apiGet, apiPost, apiPut, type ApiResult } from "./client";

/**
 * TSG requests the disposal of an asset. The requester is the session user.
 *
 * @param assetTag the asset's tag
 * @param body the reason, and the pathway when TSG already knows it
 * @returns `success` and the new `retirement` (Pending); or `error` with the server's sentence
 */
export function requestRetirement(assetTag: string, body: RetirementRequestBody): Promise<ApiResult> {
  return apiPost(`/api/assets/${encodeURIComponent(assetTag)}/retirement`, body);
}

/**
 * Lists the disposals the session user may see: all for TSG, the Director and the Secretary, the lab's for its Head.
 *
 * @returns `success` and `retirements`, each a Retirement from @shared/types/retirements; or `error`
 */
export function listRetirements(): Promise<ApiResult> {
  return apiGet("/api/retirements");
}

/**
 * The printable disposal record: one disposal, the asset fields it shows, and the present value at completion.
 *
 * @param retirementId numeric disposal id, without the "RET-" prefix
 * @returns `success`, `retirement`, `asset`, and `presentValueAtCompletion`; or `error`
 */
export function getRetirement(retirementId: number | string): Promise<ApiResult> {
  return apiGet(`/api/retirements/${retirementId}`);
}

/**
 * The Director or the Secretary approves or denies a Pending disposal. The requester is refused by the server.
 *
 * @param retirementId numeric disposal id, without the "RET-" prefix
 * @param body "approve", or "deny" with the remarks
 * @returns `success` and the decided `retirement`; or `error`
 */
export function decideRetirement(retirementId: number | string, body: RetirementDecisionBody): Promise<ApiResult> {
  return apiPut(`/api/retirements/${retirementId}/decision`, body);
}

/**
 * TSG completes an Approved disposal with the pathway and the disposition reference. The asset is Retired.
 *
 * @param retirementId numeric disposal id
 * @returns `success` and the completed `retirement`; or `error`
 */
export function completeRetirement(retirementId: number | string, body: RetirementCompleteBody): Promise<ApiResult> {
  return apiPut(`/api/retirements/${retirementId}/complete`, body);
}
