/** What the transfer form sends. */
export interface TransferRequestInput {
  /** Email of the person receiving the asset. */
  toEmail: string;
  reason: string;
  /** Destination lab code, for example "CITe4D". */
  lab?: string;
  /** Effective date as yyyy-mm-dd. */
  effectiveDate?: string;
}

export type TransferDecision = "approve" | "decline";

export interface TransferListItem {
  id: string;
  transferId: number;
  assetId: string;
  asset: string;
  from: string;
  fromCustodianId: number;
  to: string;
  toEmail: string;
  justification: string;
  destinationLab?: string;
  requestedOn: string;
  status: "Pending" | "Approved" | "Declined";
  location: string;
  lab: string;
}
