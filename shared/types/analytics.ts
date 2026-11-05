/**
 * Response shapes of the eight live analytics endpoints: the `data` each one sends inside `{ success: true, data }`.
 * Layer: shared. Imported by server/features/analytics/analytics.service.ts. Imports the campus and asset status constants.
 * Used by: the Director, Lab Head, and Staff analytics views. The web side does not use these types yet: it builds
 * each query string at its call site and reads the answers loosely (H-13).
 */

import type { Campus } from "../constants/campuses";
import type { AssetStatus } from "../enums/assetStatus";

/** A count for each of the six asset statuses. */
export type StatusCounts = Record<AssetStatus, number>;

/** The `data` of GET /api/analytics/director. */
export interface DirectorAnalyticsData {
  /** The sum of every asset's acquisition value, disposed assets included. Not narrowed by the lab filter. */
  totalPortfolioValue: number;
  /** Pending disposals, in any of three spellings. Not narrowed by the lab filter. */
  pendingDisposalsCount: number;
  /** Value and asset count per funding source ("Unspecified" when empty). Not narrowed by the lab filter. */
  fundingData: { name: string; value: number; count: number }[];
  /**
   * Assets by campus (always all three, in the order of CAMPUSES) and by status, from each asset's home lab and its
   * status now. With a date range, only assets procured inside it count (an asset with no procurement date is left
   * out). The only figure the lab filter narrows.
   */
  locationStatusData: ({ location: Campus; total: number } & StatusCounts)[];
  /** Inspection reports per month ("Oct 26"), oldest first. Empty when there is none in range. */
  auditComplianceData: { month: string; count: number }[];
}

/** One loan row of GET /api/analytics/lab-head. */
export interface LabHeadLoanItem {
  loanId: number;
  /** The asset's tag, despite the name. */
  assetId: string;
  /** The asset's name. */
  asset: string;
  borrower: string;
  /** The purpose as stored. */
  purpose: string;
  /** The destination lab's short code, from destination_center_id, or undefined when the loan names none. */
  destinationLab: string | undefined;
  /** YYYY-MM-DD. */
  requestedOn: string;
  /** YYYY-MM-DD. */
  dueDate: string;
  /** The stored status with its first letter capitalized, for example "Pending". */
  status: string;
}

/** One overdue loan of GET /api/analytics/lab-head. Pending requests past their due date are included. (H-04) */
export interface LabHeadDelinquencyItem {
  /** The loan id. */
  id: number;
  assetName: string;
  assetTag: string;
  custodian: string;
  email: string;
  /** At least 1. */
  daysOverdue: number;
  /** A full ISO timestamp. */
  dueDate: string;
  /** The project of the asset's newest record, or "Unassigned Cohort". */
  project: string;
  /** projects.master_id, or 0. */
  projectId: number;
}

/** The `data` of GET /api/analytics/lab-head. */
export interface LabHeadAnalyticsData {
  loans: LabHeadLoanItem[];
  /** The lab's assets On Loan against all its assets. */
  utilization: {
    onLoanCount: number;
    notOnLoanCount: number;
    totalAssetsCount: number;
    utilizationPercentage: number;
  };
  categoryData: { category: string; count: number }[];
  projectAllocation: {
    projectId: string;
    name: string;
    leader: string;
    center: string;
    count: number;
    size: number;
    pct: string;
    /** The sum of the project's assets' acquisition values in this lab. */
    value: number;
    color: string;
  }[];
  delinquencies: LabHeadDelinquencyItem[];
  scatterData: {
    cohort: string;
    avgDaysOverdue: number;
    unreturnedCount: number;
    bubbleSize: number;
    color: string;
    severity: string;
  }[];
  heatmapData: { cohort: string; counts: number[]; totalOverdue: number }[];
}

/**
 * The `data` of GET /api/analytics/tsg (the Staff dashboard). The Staff view's dates are not applied here.
 * `repairs[].progressStatus` is "Reported" when the stored status is empty; a condition item's `location` is the
 * asset's home lab and room; `warrantyExpiringSoon` holds warranties expired or within 90 days, soonest first. An asset
 * TSG never inspected is in no condition count and has no condition item; `notInspectedCount` says how many.
 */
export interface StaffAnalyticsData {
  repairs: {
    repairId: number;
    assetId: string;
    assetName: string;
    reportedBy: string;
    issueDescription: string;
    progressStatus: string;
    createdAt: string;
  }[];
  conditionSummary: {
    goodCount: number;
    degradedCount: number;
    criticalCount: number;
    /** Assets with no TSG inspection. */
    notInspectedCount: number;
    totalCount: number;
    conditionItems: {
      assetTag: string;
      name: string;
      category: string;
      condition: string;
      trafficLight: "GREEN" | "YELLOW" | "RED";
      location: string;
    }[];
  };
  warrantyExpiringSoon: {
    assetTag: string;
    name: string;
    manufacturer: string;
    warrantyExpiry: string;
    daysRemaining: number;
    isExpired: boolean;
  }[];
}

/** The `data` of GET /api/analytics/location-status. */
export interface LocationStatusData {
  /** Per campus (all three), a count per status. Read by no live screen (its readers are in legacy/analytics-v1/). */
  byLocation: ({ location: string } & StatusCounts)[];
  /** A count per status, with the status label as the name. Read by no live screen either. */
  byStatus: { name: string; value: number }[];
  /** Per home lab, the assets Available, On Loan and in Maintenance (the three bars of the Staff chart). The other statuses count in `statusCounts`. */
  locationDistribution: { location: string; available: number; onLoan: number; underRepair: number }[];
  /** One entry per asset status, in the order of ASSET_STATUSES, with its label as the name. */
  statusCounts: { name: string; value: number }[];
}

/** One entry of GET /api/analytics/advanced/inspection-progress, per research center. No report is read: see analytics.service.ts. */
export interface InspectionProgressItem {
  group: string;
  inspected: number;
  total: number;
  percent: number;
}

/** One bar of GET /api/analytics/advanced/idle-time. */
export interface IdleTimeItem {
  category: string;
  count: number;
}

/** One bar of GET /api/analytics/advanced/idle-frequency. */
export interface IdleFrequencyItem {
  durationRange: string;
  equipmentCount: number;
  criticality: string;
}

/** One row of GET /api/analytics/advanced/loan-recommender: one per ACTIVE record, history included. */
export interface LoanRecommendationItem {
  /** The asset's id. */
  recommendationId: number;
  targetLab: string;
  idleAssetName: string;
  assetTag: string;
  matchReason: string;
  ownerLab: string;
}
