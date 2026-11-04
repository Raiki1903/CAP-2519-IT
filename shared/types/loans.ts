/**
 * Request and response shapes of the loan endpoints.
 * Layer: shared. Imported by server/features/loans/ and web/api/loans.api.ts. Imports the shared person and inspection
 * types.
 * Used by: Researcher loan requests, Lab Head approval, TSG release and receipt, and the loan lists.
 */
import type { AssetListItem, PersonRef } from './assets';
import type { Inspection } from './inspections';

/** The body LoanForm sends today. It goes in commit 8 of Batch 3, when LoanForm sends LoanRequestBody. */
export interface LoanRequestInput {
  /** Destination lab code, for example "CITe4D". Optional: without it the asset keeps its current location on approval. */
  lab?: string;
  purpose: string;
  /** Due date as yyyy-mm-dd. */
  dueDate: string;
}

/**
 * The two decision words today's Lab Head screens use. They go in commit 8 of Batch 3, when the screens call approve
 * and decline.
 */
export type LoanDecision = "approve" | "decline";

/** One row of GET /api/loans. Several fields come in two spellings because different screens read each. */
export interface LoanListItem {
  /** Display id, "LOAN-<loan_id>". */
  id: string;
  loanId: number;
  loan_id: number;
  /** The asset's numeric id. */
  asset_id: number;
  /** The asset's tag, for example "CeLT-0004". */
  assetId: string;
  asset: string;
  assetName: string;
  borrower_id: number;
  /** The borrower's full name. Left out for a Custodian on a loan that is not their own. (D2) */
  borrower?: string;
  /** The purpose as stored. */
  purpose: string;
  /** The destination lab's short code, from destination_center_id; undefined when the loan names none. */
  destinationLab?: string;
  /** yyyy-mm-dd. */
  requestedOn: string;
  /** yyyy-mm-dd. */
  dueDate: string;
  /** The word the current screens compare against: "Pending", "Approved", "Declined", or "Returned". */
  status: string;
  /** The label of the stored status, for example "Pending Approval" or "On Loan". */
  statusLabel: string;
  /** The campus label of the asset's home lab. */
  location: string;
  /** The short code of the asset's home lab, which the Lab Head screen uses to show only its own lab's requests. (M-02) */
  lab: string;
  /** The asset's home lab id, or null if the asset is gone. */
  center_id: number | null;
}

/** The body of POST /api/assets/:assetTag/loans. The borrower is the session user. */
export interface LoanRequestBody {
  /** One of the borrower's own labs (the session's `labs`). */
  destinationCenterId: number;
  /** At most 100 characters. */
  destinationRoom?: string | null;
  /** The project the asset is borrowed for, a projects id. */
  projectId?: number | null;
  /** yyyy-mm-dd, not before today. */
  returnBy: string;
  purpose: string;
}

/** The body of PUT /api/loans/:loanId/approve and /decline. Required, and not empty, to decline. */
export interface LoanDecisionBody {
  decisionRemarks?: string | null;
}

/** A loan in an answer (docs/contracts/lifecycle.md, Loan). People are `{ userId, name }`, `{ hidden: true }`, or null. */
export interface Loan {
  loanId: number;
  asset: { assetId: number; tag: string; name: string };
  /** `{ hidden: true }` for a Researcher who is not the borrower. */
  borrower: PersonRef;
  /** One of LOAN_STATUSES. */
  status: string;
  statusLabel: string;
  /** As stored. */
  purpose: string;
  project: { projectId: number; code: string; name: string } | null;
  /** From destination_center_id. Null only on older loans that named none. */
  destinationLab: { centerId: number; code: string } | null;
  destinationRoom: string | null;
  /** yyyy-mm-dd. */
  returnBy: string;
  /** ISO date-times from here on, or null. */
  requestedAt: string;
  decidedBy: PersonRef | null;
  decidedAt: string | null;
  decisionRemarks: string | null;
  releasedBy: PersonRef | null;
  releasedAt: string | null;
  releaseInspection: Inspection | null;
  returnRequestedAt: string | null;
  receivedBy: PersonRef | null;
  returnInspection: Inspection | null;
  closedAt: string | null;
  /** The borrower's remarks when asking to return. */
  remarks: string | null;
  /** On Loan or Return Requested with the return-by date passed. A loan never released is never overdue. */
  isOverdue: boolean;
}

/** A lab as a person's lab list names it. */
export interface PersonLab {
  centerId: number;
  code: string;
}

/**
 * GET /api/loans/:loanId/accountability-form: what the printed Accountability Form needs (Appendix 1 of the CCS
 * Equipment Monitoring Policies). The clauses are fixed text on the print page, not server data. The asset's
 * `manufacturer` stands in for the model.
 */
export interface AccountabilityForm {
  loan: Loan;
  /** The asset in the asset list's shape (GET /api/assets). */
  asset: AssetListItem;
  /** The Responsible Person. The email goes only to the borrower, the home lab's Head, and TSG, who may open this. */
  borrower: { userId: number; name: string; idNumber: number | null; email: string; labs: PersonLab[] };
  /** Null only for a loan handed over before the release step existed. */
  releaseInspection: Inspection | null;
}

/** POST /api/users/:userId/clearance-record: one person's clearance record, for TSG to print. */
export interface ClearanceRecord {
  person: { userId: number; name: string; idNumber: number | null; labs: PersonLab[] };
  /** No loan in Pending Release, On Loan, or Return Requested. */
  cleared: boolean;
  /** The person's loans that were released, or still wait in Pending Release, newest first. */
  loans: Loan[];
}
