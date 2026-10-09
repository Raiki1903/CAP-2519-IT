/** What the disposal form sends. */
export interface DisposalRequestInput {
  /** Display name of the staff member filing the request. */
  requestedBy?: string;
  lastCustodian?: string;
  breakdownReasons: string;
  disposalPathway: string;
  /** Decommission date as yyyy-mm-dd. */
  decommissionDate?: string;
}

export type DisposalDecision = "approve" | "reject";

export interface DisposalListItem {
  id: string;
  disposalId: number;
  assetId: string;
  assetName: string;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
}
