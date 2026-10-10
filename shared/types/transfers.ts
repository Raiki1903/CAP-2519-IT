/**
 * Request and response shapes of the transfer endpoints.
 * Layer: shared. Imported by server/features/transfers/ and web/api/transfers.api.ts. Imports nothing.
 * Used by: Custodian transfer request, Lab Head approval.
 */

/** The body of POST /api/assets/:assetTag/transfer, as TransferForm sends it. */
export interface TransferRequestInput {
  /** Email of the person receiving the asset. Must belong to an account. */
  toEmail: string;
  reason: string;
  /** Destination lab code, for example "CITe4D". Optional: without it the asset keeps its current location on approval. */
  // TODO(H-19): the server keeps the lab only inside the justification text, and drops effectiveDate. Columns of their own, Phase 3.
  lab?: string;
  /** Effective date as yyyy-mm-dd. The server does not store it. (H-19) */
  effectiveDate?: string;
}

/**
 * The two words PUT /api/asset_transfers/:transferId/decision accepts.
 * Loans accept the same two; disposals use "reject" instead of "decline".
 */
export type TransferDecision = "approve" | "decline";

/** One row of GET /api/asset_transfers. */
export interface TransferListItem {
  /** Display id, "TRF-<transfer_id>". */
  id: string;
  transferId: number;
  /** The asset's tag; "" if the asset is gone. */
  assetId: string;
  /** The asset's name. */
  asset: string;
  /** Full name of the custodian the asset leaves, or "Unknown". */
  from: string;
  /** Lets the custodian screen tell its own requests from others'. (issue #25, D2) */
  fromCustodianId: number;
  /** Full name of the recipient, or "Unknown". */
  to: string;
  toEmail: string;
  /** The reason as typed, without the destination lab line. */
  justification: string;
  /** The destination lab picked on the form, read back out of the stored justification. (H-19) */
  destinationLab?: string;
  /** yyyy-mm-dd. */
  requestedOn: string;
  /** Anything that is not approved or declined shows as Pending, including /accept's pending_approver. (M-12) */
  status: "Pending" | "Approved" | "Declined";
  /** The campus half of the asset's latest location, for display. */
  location: string;
  /** The asset tag's prefix, which the Lab Head screen uses to show only its own lab's requests. (M-02) */
  lab: string;
}
