/**
 * Response shapes of the eight live analytics endpoints: the `data` each one sends inside `{ success: true, data }`.
 * Layer: shared. Imported by server/features/analytics/analytics.service.ts. Imports nothing.
 * Used by: the Director, Lab Head, and Staff analytics views. The web side does not use these types yet: it builds
 * each query string at its call site and reads the answers loosely (H-13).
 */

/** The `data` of GET /api/analytics/director. */
export interface DirectorAnalyticsData {
  /** The sum of every asset's acquisition value, disposed assets included. Not narrowed by the lab filter. */
  totalPortfolioValue: number;
  /** Pending disposals, in any of three spellings. Not narrowed by the lab filter. */
  pendingDisposalsCount: number;
  /** Value and asset count per funding source ("Unspecified" when empty). Not narrowed by the lab filter. */
  fundingData: { name: string; value: number; count: number }[];
  /** Assets by campus and status, from each asset's newest record. The only figure the lab filter narrows. */
  locationStatusData: {
    location: "MANILA" | "LAGUNA";
    ACTIVE: number;
    ON_LOAN: number;
    MAINTENANCE: number;
    DISPOSED: number;
    total: number;
  }[];
  /** Inspection reports per month ("Oct 26"), oldest first. A fixed demo series when there is none in range. (H-09) */
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
  /** The purpose without its "Destination Lab:" first line. */
  purpose: string;
  /** Read from the purpose's first line, or undefined. (H-19) */
  destinationLab: string | undefined;
  /** YYYY-MM-DD. */
  requestedOn: string;
  /** YYYY-MM-DD. */
  dueDate: string;
  /** The stored status with its first letter capitalized, for example "Pending". */
  status: string;
}

/** One transfer row of GET /api/analytics/lab-head. */
export interface LabHeadTransferItem {
  transferId: number;
  assetId: string;
  asset: string;
  justification: string;
  destinationLab: string | undefined;
  requestedOn: string;
  /** As for loans, so a transfer moved by /accept shows as "Pending_approver". (M-12) */
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
  transfers: LabHeadTransferItem[];
  utilization: {
    assignedCount: number;
    unassignedCount: number;
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
 * record's home location; `warrantyExpiringSoon` holds warranties expired or within 90 days, soonest first.
 */
export interface StaffAnalyticsData {
  repairs: {
    repairId: number;
    assetId: string;
    assetName: string;
    reportedBy: string;
    issueDescription: string;
    isImmediate: boolean;
    progressStatus: string;
    createdAt: string;
  }[];
  conditionSummary: {
    goodCount: number;
    degradedCount: number;
    criticalCount: number;
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
  /** Per campus, a count per status. Read by no live screen (its readers are in legacy/analytics-v1/). */
  byLocation: { location: string; [status: string]: string | number }[];
  /** A count per status. Read by no live screen either. */
  byStatus: { name: string; value: number }[];
  /** Per lab of a fixed list of seven codes; disposed assets are not counted here. (M-03) */
  locationDistribution: { location: string; available: number; onLoan: number; underRepair: number }[];
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
  /** The asset_records id. */
  recommendationId: number;
  targetLab: string;
  idleAssetName: string;
  assetTag: string;
  matchReason: string;
  ownerLab: string;
}
