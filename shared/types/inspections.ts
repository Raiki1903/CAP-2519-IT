/** What an inspection report sends. */
export interface InspectionReportInput {
  reporterEmail?: string;
  reportedById?: number;
  /** One of ASSET_CONDITIONS from shared/enums/assetCondition.ts. */
  reportCondition?: string;
  assetCondition?: string;
  reportRemarks?: string;
  remarks?: string;
  tsgRemarks?: string;
  itsRemarks?: string;
  description?: string;
  /** One image, or null. Callers send only the first image they hold. */
  reportImg?: string | null;
  image?: string | null;
  image_url?: string | null;
}

/** One row of GET /api/asset_reports. */
export interface ReportSummaryItem {
  report_id: number;
  id: number;
  reportId: string;
  asset_id: number;
  asset_tag: string;
  assetName: string;
  reported_by_id: number;
  reportedBy: string;
  report_date: string;
  reportDate: string;
  condition: string;
  remarks: string | null;
}

/** One row of GET /api/asset-reports. */
export interface InspectionReportItem {
  reportId: number;
  assetId: string;
  assetName: string;
  reportedBy: string;
  reporterEmail: string;
  reportDate: string;
  reportCondition: string;
  reportRemarks: string | null;
  reportImg: string | null;
}
