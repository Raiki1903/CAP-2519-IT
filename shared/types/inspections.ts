/**
 * Request and response shapes of the inspection endpoints.
 * Layer: shared. Imported by server/features/inspections/ and web/api/inspections.api.ts. Imports nothing.
 * Used by: Custodian condition report, Staff inspection finalize, the Staff inspection log, and the Director audit.
 */

/**
 * The body of POST /api/assets/:assetTag/inspection. A condition is required, in reportCondition or assetCondition;
 * every other field has a fallback.
 * The two senders (CustodianPortal, InspectionQueue) use reportCondition, reportRemarks, and reportImg; the other names
 * are older spellings the server still reads. The reporter is the session user. (issue #32)
 */
export interface InspectionReportInput {
  /** One of ASSET_CONDITIONS ("MINOR_DRIFT"). Anything else, or no condition at all, answers 400. (issue #53) */
  reportCondition?: string;
  /** Read when reportCondition is empty. */
  assetCondition?: string;
  /** Cut to 255 characters. Without any of the five remark fields, a default sentence is stored. */
  reportRemarks?: string;
  remarks?: string;
  tsgRemarks?: string;
  itsRemarks?: string;
  description?: string;
  /** One image as text (a data URL), or null. Stored as sent, with no check that it is an image. Callers send only the first image they hold. */
  // TODO(M-17): images are stored as base64 text in the database, and only one per report. Phase 3 (at most 3 photos, kept 2 weeks).
  reportImg?: string | null;
  image?: string | null;
  image_url?: string | null;
}

/**
 * One row of GET /api/asset_reports, the short list (no email, no image), read by state/serverData.tsx.
 * Both snake_case and camelCase names are sent for several fields.
 */
// TODO(L-07): two list endpoints with two spellings and two shapes for the same reports. Kept in step 12 as decided; merging them is its own commit, with the screens that read each.
export interface ReportSummaryItem {
  report_id: number;
  /** Same as report_id. */
  id: number;
  /** Display id, "RPT-<report_id>". */
  reportId: string;
  asset_id: number;
  /** The asset's tag, or an invented "EQ-2024-<asset_id>" if the asset is gone. */
  asset_tag: string;
  assetName: string;
  reported_by_id: number;
  /** The reporter's full name, or "Staff". */
  reportedBy: string;
  /** ISO timestamp. */
  report_date: string;
  /** Same as report_date. */
  reportDate: string;
  /** One of ASSET_CONDITIONS. */
  condition: string;
  remarks: string | null;
}

/** One row of GET /api/asset-reports, the detailed list, read by the Staff inspection log (useInspectionReports). */
export interface InspectionReportItem {
  /** The numeric report_id (the short list sends "RPT-n" under the same name). */
  reportId: number;
  /** The asset's tag. */
  assetId: string;
  assetName: string;
  /** The reporter's full name. */
  reportedBy: string;
  /** The reporter's email. Sent to Staff only (the 13b role table, row 19). */
  reporterEmail: string;
  /** The report time as "Oct 9, 2026, 02:15 PM", in the server's time zone. */
  reportDate: string;
  /** One of ASSET_CONDITIONS. */
  reportCondition: string;
  reportRemarks: string | null;
  reportImg: string | null;
}
