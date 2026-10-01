import { apiGet, apiPostRaw, type ApiResult } from "./client";

export interface InspectionReportInput {
  reporterEmail?: string;
  reportedById?: number;
  reportCondition: string;
  reportRemarks: string;
  reportImg: string | null;
}

export function submitInspectionRaw(assetTag: string, input: InspectionReportInput): Promise<Response> {
  return apiPostRaw(`/api/assets/${assetTag}/inspection`, input);
}

export function listInspectionReports(): Promise<ApiResult> {
  return apiGet("/api/asset-reports");
}

export function listReportSummaries(): Promise<ApiResult> {
  return apiGet("/api/asset_reports");
}
