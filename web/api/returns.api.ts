/**
 * Returns API: recording that a borrowed asset came back.
 * Layer: api. Called by ReturnForm. Calls client.ts.
 * Used by: return finalization.
 */
import type { ReturnInput } from "@shared/types/returns";
import { apiPost, type ApiResult } from "./client";

/**
 * Records a finalized return.
 *
 * @param assetTag the asset's tag, sent as is (not URL-encoded)
 * @param input who returned it, its condition, and the inspection notes
 * @returns `success` and `return` (with `reference_number`), or `error`
 */
// TODO(H-04): the server does not close the matching loan. Phase 3.
export function finalizeReturn(assetTag: string, input: ReturnInput): Promise<ApiResult> {
  return apiPost(`/api/assets/${assetTag}/return`, input);
}
