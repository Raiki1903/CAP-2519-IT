/** The `data` of GET /api/analytics/director. */
export interface DirectorAnalyticsData {
  totalPortfolioValue: number;
  pendingDisposalsCount: number;
  fundingData: { name: string; value: number; count: number }[];
  locationStatusData: {
    location: "MANILA" | "LAGUNA";
    ACTIVE: number;
    ON_LOAN: number;
    MAINTENANCE: number;
    DISPOSED: number;
    total: number;
  }[];
  auditComplianceData: { month: string; count: number }[];
}

/** One loan row of GET /api/analytics/lab-head. */
export interface LabHeadLoanItem {
  loanId: number;
  assetId: string;
  asset: string;
  borrower: string;
  purpose: string;
  destinationLab: string | undefined;
  requestedOn: string;
  dueDate: string;
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
  status: string;
}

/** One overdue loan of GET /api/analytics/lab-head. */
export interface LabHeadDelinquencyItem {
  id: number;
  assetName: string;
  assetTag: string;
  custodian: string;
  email: string;
  daysOverdue: number;
  dueDate: string;
  project: string;
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

/** The `data` of GET /api/analytics/tsg (the Staff dashboard). */
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
  byLocation: { location: string; [status: string]: string | number }[];
  byStatus: { name: string; value: number }[];
  locationDistribution: { location: string; available: number; onLoan: number; underRepair: number }[];
  statusCounts: { name: string; value: number }[];
}

/** One entry of GET /api/analytics/advanced/inspection-progress. */
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

/** One row of GET /api/analytics/advanced/loan-recommender. */
export interface LoanRecommendationItem {
  recommendationId: number;
  targetLab: string;
  idleAssetName: string;
  assetTag: string;
  matchReason: string;
  ownerLab: string;
}
