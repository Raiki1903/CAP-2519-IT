/**
 * Request and response shapes of the disposal endpoints.
 * Layer: shared. Imported by server/features/disposals/ and web/api/disposals.api.ts. Imports nothing.
 * Used by: Staff disposal filing, Director approval.
 */

/**
 * The body of POST /api/assets/:assetTag/disposal, as DisposalFormDialog sends it. The last custodian is not sent:
 * the server names the asset's holder. (issue #12)
 */
// TODO(M-13): the server packs pathway, last custodian, and date into one text column. Phase 3 splits them into columns.
export interface DisposalRequestInput {
  breakdownReasons: string;
  disposalPathway: string;
  /** Decommission date as yyyy-mm-dd. */
  decommissionDate?: string;
}

/**
 * The two words PUT /api/asset_disposals/:disposalId/decision accepts.
 * Loans and transfers use "decline" instead of "reject".
 */
export type DisposalDecision = "approve" | "reject";

/** One row of GET /api/asset_disposals. */
export interface DisposalListItem {
  /** Display id, "DISP-<disposal_id>". */
  id: string;
  disposalId: number;
  /** The asset's tag; "" if the asset is gone. */
  assetId: string;
  assetName: string;
  /** The requester's full name, or "Unknown". */
  requestedBy: string;
  /** ISO timestamp. */
  requestedAt: string;
  /** The whole packed reason text: pathway, last custodian, date, and justification. (M-13) */
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
}
