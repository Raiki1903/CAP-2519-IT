/**
 * Inspections API: condition reports on assets.
 * Layer: api. Called by CustodianPortal, ITSDashboard, and state/serverData.tsx. Calls client.ts.
 * Used by: Custodian condition report, Staff inspection finalize and report list.
 */
import { apiGet, apiPostRaw, type ApiResult } from "./client";

/** What an inspection report sends. */
export interface InspectionReportInput {
  reporterEmail?: string;
  reportedById?: number;
  /** One of ASSET_CONDITIONS from shared/enums/assetCondition.ts. */
  reportCondition: string;
  reportRemarks: string;
  /** One image, or null. Callers send only the first image they hold. */
  reportImg: string | null;
}

/**
 * Files an inspection report for an asset. Returns the untouched Response
 * because both callers send the report and never read the answer.
 *
 * @param assetTag the asset's tag, sent as is (not URL-encoded)
 * @param input reporter, condition, remarks, and an optional image
 * @returns the raw Response
 */
export function submitInspectionRaw(assetTag: string, input: InspectionReportInput): Promise<Response> {
  return apiPostRaw(`/api/assets/${assetTag}/inspection`, input);
}

/**
 * Lists inspection reports in the detailed shape (reporter email, image),
 * from `/api/asset-reports`. Used by the Staff dashboard.
 *
 * @returns `success` and `reports`
 */
// TODO(L-07): two list endpoints with two spellings and two shapes. They become one when inspections is extracted (step 12).
export function listInspectionReports(): Promise<ApiResult> {
  return apiGet("/api/asset-reports");
}

/**
 * Lists inspection reports in the short shape (no email, no image), from
 * `/api/asset_reports`. Used by state/serverData.tsx on every reload.
 *
 * @returns `success` and `reports`
 */
export function listReportSummaries(): Promise<ApiResult> {
  return apiGet("/api/asset_reports");
}
