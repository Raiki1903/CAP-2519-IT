export interface LoanRequestInput {
  borrower: string;
  lab?: string;
  purpose: string;
  dueDate: string;
}

export type LoanDecision = "approve" | "decline";

export interface LoanListItem {
  id: string;
  loanId: number;
  loan_id: number;
  asset_id: number;
  assetId: string;
  asset: string;
  assetName: string;
  borrower_id: number;
  borrower: string;
  purpose: string;
  destinationLab?: string;
  requestedOn: string;
  dueDate: string;
  status: string;
  location: string;
  lab: string;
  center_id: number;
}
