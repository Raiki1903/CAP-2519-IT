/**
 * Request and response shapes of the repair endpoints.
 * Layer: shared. Imported by server/features/repairs/ and web/api/repairs.api.ts. Imports nothing.
 * Used by: Custodian repair request, Staff repair queue and progress updates.
 */

/** The body of POST /api/assets/:assetTag/repair, as RepairForm and ReturnForm send it. */
export interface RepairRequestInput {
  /** Display name of the person reporting the fault. */
  // TODO(H-10): the server resolves this name to a user by matching text, and an unknown or missing name becomes user 1 (issue #32). The session user after step 13.
  reportedBy?: string;
  /** Required, and not only spaces. With the tag, it is also the key of the 8-second duplicate guard. (M-07) */
  description: string;
  /** True when the fault needs immediate attention: the ticket opens as "Awaiting Immediate Dispatch". */
  isImmediate?: boolean;
}

/** The body of PUT /api/asset_repairs/:repairId. Only `progressStatus` is required. */
export interface RepairUpdateInput {
  // TODO(H-07): free text, the server accepts any value. Phase 3 makes it an enum.
  progressStatus: string;
  /** Condition after the repair, one of ASSET_CONDITIONS. Read only for "Fixed & Completed"; any other value keeps the current one. */
  assetCondition?: string;
  /** Remarks for the restoring record and the report on "Fixed & Completed". */
  assetRemarks?: string;
}

/**
 * The body of PUT /api/asset_repairs/:repairId/status, sent by the Staff analytics board.
 * Unlike RepairUpdateInput, it changes the ticket only, never the asset. (H-06)
 */
export interface RepairStatusInput {
  progressStatus: string;
}

/** One row of GET /api/asset_repairs. */
export interface RepairListItem {
  /** Display id, "MNT-<repair_id>". */
  id: string;
  repairId: number;
  /** Always "db". Kept for screens that once mixed in browser-only tickets. */
  _source: "db";
  /** Same as repairId. */
  _repairId: number;
  /** The asset's tag, or an invented "EQ-2024-<nnn>" if the asset is gone. */
  assetId: string;
  assetName: string;
  /** The reporter's full name, not the asset's custodian. Same value as reportedBy. */
  custodian: string;
  /** The reporter's full name, or "Unassigned". */
  reportedBy: string;
  description: string;
  /** Same as progressStatus. */
  statusLabel: string;
  progressStatus: string;
  isImmediate: boolean;
  /** "Critical" for an immediate ticket, else "Medium". */
  priority: "Critical" | "Medium";
  /** False only while the status is one of the two starting values. */
  acknowledged: boolean;
  /** The creation time as "Oct 9, 2026, 02:15 PM", in the server's time zone. */
  submittedAt: string;
  /** ISO timestamp. */
  createdAt: string;
}
