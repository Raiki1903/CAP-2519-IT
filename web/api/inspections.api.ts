/**
 * Inspections API: inspections on assets (a Routine inspection by TSG, a Self Report by the holder), the routine queue, and the report lists.
 * Layer: api. Called by CustodianPortal, features/inspections (InspectionQueue, useInspectionReports), and state/serverData.tsx. Calls client.ts.
 * Used by: Custodian condition report, Staff routine queue and inspection finalize, and the report lists.
 */
import type { InspectionInput } from "@shared/types/assets";
import { apiGet, apiPostRaw, type ApiResult } from "./client";

/**
 * Files an inspection for an asset: TSG's files a Routine inspection, the holder's a Self Report. Returns the untouched
 * Response, so each caller reads the answer itself: InspectionQueue and CustodianPortal both show the server's error. (H-16)
 *
 * @param assetTag the asset's tag, sent as is (not URL-encoded)
 * @param input the condition, health score, remarks, and an optional photo
 * @returns the raw Response; its body is `{ success, inspection }` or `{ success: false, error }`
 */
export function submitInspectionRaw(assetTag: string, input: InspectionInput): Promise<Response> {
  return apiPostRaw(`/api/assets/${assetTag}/inspection`, input);
}

/**
 * Gets the routine queue: the Available assets TSG never inspected or last inspected more than `days` days ago, by
 * inspection group. TSG only.
 *
 * @param days the period in days (one of ROUTINE_PERIOD_OPTIONS)
 * @returns `success` and `groups`, each a RoutineQueueGroup from @shared/types/inspections; or `error`
 */
export function getRoutineQueue(days: number): Promise<ApiResult> {
  return apiGet(`/api/inspections/routine-queue?days=${days}`);
}

/**
 * Lists inspection reports in the detailed shape (reporter email, image),
 * from `/api/inspections/log`. Used by the Staff inspection log (useInspectionReports).
 *
 * @returns `success` and `reports`
 */
// TODO(L-07): two list endpoints with two spellings and two shapes. Kept in step 12 as decided; merging them is its own commit, with both callers.
export function listInspectionReports(): Promise<ApiResult> {
  return apiGet("/api/inspections/log");
}

/**
 * Lists inspection reports in the short shape (no email, no image), from
 * `/api/inspections`. Used by state/serverData.tsx on every reload.
 *
 * @returns `success` and `reports`
 */
export function listReportSummaries(): Promise<ApiResult> {
  return apiGet("/api/inspections");
}
