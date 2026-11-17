/**
 * Pure data builder for the Director's Asset History Report (CSV and printable PDF).
 * Layer: feature component (report logic). Called by pages/director/AdRICDirectorDashboard.tsx and pages/director/AssetHistoryPrintPage.tsx.
 * Calls: features/assets/assetBadges.ts.
 * Used by: AdRIC Director asset history CSV export and printable PDF report.
 */
import { assetStatusLabel } from "@web/features/assets/assetBadges";
import type { Maintenance } from "@shared/types/maintenance";

/**
 * Core metadata fields for an asset's history report.
 */
export interface AssetHistoryDetails {
  assetId: string;
  assetName: string;
  serialNumber: string;
  manufacturer: string;
  fundingSource: string;
  acquisitionDate: string;
  purchaseValuation: string;
  itsPropertyTag: string;
  tsgPropertyTag: string;
  availability: string;
}

/**
 * One repair and maintenance row in an asset's history report.
 */
export interface AssetHistoryRepairRow {
  repairId: string;
  issueType: string;
  status: string;
  description: string;
  reportedBy: string;
  reportedAt: string;
}

/**
 * One routine inspection row in an asset's history report.
 */
export interface AssetHistoryInspectionRow {
  reportId: string;
  inspector: string;
  dateLogged: string;
  conditionStatus: string;
  remarks: string;
}

/**
 * Retirement details section, present only when the asset is Retired and has disposal details.
 */
export interface AssetHistoryRetirementDetails {
  retirementId: string;
  retirementDate: string;
  retiredBy: string;
  pathway: string;
  breakdownReasons: string;
}

/**
 * Complete structured sections of an Asset History Report.
 */
export interface AssetHistoryReportData {
  details: AssetHistoryDetails;
  repairLogs: AssetHistoryRepairRow[];
  inspectionReports: AssetHistoryInspectionRow[];
  retirementDetails: AssetHistoryRetirementDetails | null;
}

/**
 * Gathers the four sections of an asset's history from the shared asset row and maintenance ticket list.
 *
 * @param asset the asset row from useServerData()
 * @param tickets the maintenance ticket list from useServerData()
 * @returns structured details, repairLogs, inspectionReports, and retirementDetails
 */
export function buildAssetHistory(asset: any, tickets: Maintenance[]): AssetHistoryReportData {
  const assetRepairs = (tickets || []).filter((t) => t.asset.tag === asset.id);
  // Only the reports saved in asset_inspections, the same ones the Staff inspection log shows. (F-28)
  const assetReports: any[] = asset.asset_reports || [];

  const details: AssetHistoryDetails = {
    assetId: asset.id || "",
    assetName: asset.name || "",
    serialNumber: asset.serial || asset.serial_number || "",
    manufacturer: asset.manufacturer || "",
    fundingSource: asset.funding || "",
    acquisitionDate: asset.procurement_date || asset.procured || "",
    purchaseValuation: `PHP ${(asset.cost || 0).toLocaleString()}`,
    itsPropertyTag: asset.itsPropertyTag || "None",
    tsgPropertyTag: asset.tsgPropertyTag || "None",
    availability: assetStatusLabel(asset.status),
  };

  const repairLogs: AssetHistoryRepairRow[] = assetRepairs.map((r) => ({
    repairId: `MNT-${r.maintenanceId}`,
    issueType: r.issueType?.name ?? r.typeLabel,
    status: r.statusLabel,
    description: r.issueDescription,
    reportedBy: "hidden" in r.reportedBy ? "Not shown" : r.reportedBy.name,
    reportedAt: r.reportedAt,
  }));

  const inspectionReports: AssetHistoryInspectionRow[] = assetReports.map((rpt: any) => ({
    reportId: String(rpt.reportId || rpt.id || ""),
    inspector: String(rpt.reportedBy || rpt.inspector || "Staff"),
    dateLogged: String(rpt.reportDate || rpt.date_logged || rpt.date || "N/A"),
    conditionStatus: String(rpt.condition || rpt.status || "VERIFIED"),
    remarks: String(rpt.remarks || rpt.description || rpt.notes || ""),
  }));

  const retirementDetails: AssetHistoryRetirementDetails | null =
    asset.status === "RETIRED" && asset.disposalDetails
      ? {
          retirementId: String(asset.disposalId ?? ""),
          retirementDate: String(asset.disposalDetails.decommissionDate ?? ""),
          retiredBy: String(asset.disposalDetails.decommissionedBy ?? ""),
          pathway: String(asset.disposalDetails.disposalPathway ?? ""),
          breakdownReasons: String(asset.disposalDetails.breakdownReasons ?? ""),
        }
      : null;

  return {
    details,
    repairLogs,
    inspectionReports,
    retirementDetails,
  };
}
