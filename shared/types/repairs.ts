/** What a repair request sends. */
export interface RepairRequestInput {
  /** Display name of the person reporting the fault. */
  reportedBy?: string;
  description: string;
  /** True when the fault needs immediate attention. */
  isImmediate?: boolean;
}

/** What a repair progress update sends. Only `progressStatus` is required. */
export interface RepairUpdateInput {
  progressStatus: string;
  /** Condition after the repair, one of ASSET_CONDITIONS. */
  assetCondition?: string;
  assetRemarks?: string;
}

/** What the status-only update sends. */
export interface RepairStatusInput {
  progressStatus: string;
}

export interface RepairListItem {
  id: string;
  repairId: number;
  _source: "db";
  _repairId: number;
  assetId: string;
  assetName: string;
  custodian: string;
  reportedBy: string;
  description: string;
  statusLabel: string;
  progressStatus: string;
  isImmediate: boolean;
  priority: "Critical" | "Medium";
  acknowledged: boolean;
  submittedAt: string;
  createdAt: string;
}
