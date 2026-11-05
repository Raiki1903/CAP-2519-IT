/**
 * Request and response shapes of the inspection endpoints.
 * Layer: shared. Imported by server/features/inspections/ and web/api/inspections.api.ts. Imports shared/types/assets.ts.
 * Used by: Custodian condition report, Staff inspection finalize, the Staff inspection log, the routine queue, and the
 * Director audit.
 */
import type { AssetListItem } from './assets';

/**
 * One row of GET /api/inspections, the short list (no email, no image), read by state/serverData.tsx.
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

/** One row of GET /api/inspections/log, the detailed list, read by the Staff inspection log (useInspectionReports). */
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

/** One metric value of an Inspection. */
export interface InspectionMetricValue {
  metricId: number;
  metricKey: string;
  name: string;
  unit: string;
  value: number;
  /** Whether the value breaks its flag rule (shared/constants/metricFlagRules.ts), against the asset's first recorded value. */
  flagged: boolean;
}

/** An inspection in an answer (docs/contracts/lifecycle.md, Inspection). */
export interface Inspection {
  inspectionId: number;
  /** One of INSPECTION_TYPES. */
  type: string;
  typeLabel: string;
  /** `{ hidden: true }` for a Researcher when someone else inspected it. */
  inspectedBy: { userId: number; name: string } | { hidden: true };
  /** ISO date-time. */
  inspectedAt: string;
  /** One of ASSET_CONDITIONS. */
  condition: string;
  conditionLabel: string;
  healthScore: number | null;
  missingAccessories: string | null;
  remarks: string | null;
  photo: string | null;
  metrics: InspectionMetricValue[];
}

/** The routine queue's query (GET /api/inspections/routine-queue). */
export interface RoutineQueueFilters {
  /** An asset is due when TSG last inspected it more than this many days ago. */
  days: number;
  /** Only this home lab's assets. */
  centerId?: number;
}

/** One asset in the routine queue. */
export interface RoutineQueueEntry {
  /** The asset, as the asset list shows it. */
  asset: AssetListItem;
  /** When TSG last inspected it (ISO date-time), or null when TSG never did. */
  lastTsgInspectionAt: string | null;
}

/** One inspection group of the routine queue, its assets oldest inspection first. */
export interface RoutineQueueGroup {
  /** The group's id, "A" to "D", or "Other". */
  group: string;
  name: string;
  /** The lab short codes in the group; for "Other", the codes of the labs its assets belong to. */
  labs: string[];
  assets: RoutineQueueEntry[];
}
