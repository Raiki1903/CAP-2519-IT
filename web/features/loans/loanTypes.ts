/**
 * Loan types for TSG releases, returns, and the Accountability Form.
 * Layer: feature types. Shapes match origin/feat/batch-3-loans:shared/types/loans.ts.
 * Used by: LoansPage, LoanReleaseDialog, LoanReceiveDialog, AccountabilityFormPage.
 */
import type { AssetListItem, InspectionInput, PersonRef } from "@shared/types/assets";

/** One metric value of an Inspection. */
export interface InspectionMetricValue {
  metricId: number;
  metricKey: string;
  name: string;
  unit: string;
  value: number;
  flagged: boolean;
}

/** Inspection input sent to loan release and return endpoints. */
export interface LoanInspectionInput extends InspectionInput {
  metrics?: { metricId: number; value: number }[];
}

/** An inspection record from the server. */
export interface LoanInspection {
  inspectionId: number;
  type: string;
  typeLabel: string;
  inspectedBy: { userId: number; name: string } | { hidden: true };
  inspectedAt: string;
  condition: string;
  conditionLabel: string;
  healthScore: number | null;
  missingAccessories: string | null;
  remarks: string | null;
  photo: string | null;
  metrics: InspectionMetricValue[];
}

/** A loan object returned by Batch 3 loan endpoints. */
export interface Loan {
  loanId: number;
  asset: { assetId: number; tag: string; name: string; serial?: string | null };
  borrower: PersonRef;
  status: string;
  statusLabel: string;
  purpose: string;
  project: { projectId: number; code: string; name: string } | null;
  destinationLab: { centerId: number; code: string } | null;
  destinationRoom: string | null;
  returnBy: string;
  requestedAt: string;
  decidedBy: PersonRef | null;
  decidedAt: string | null;
  decisionRemarks: string | null;
  releasedBy: PersonRef | null;
  releasedAt: string | null;
  releaseInspection: LoanInspection | null;
  returnRequestedAt: string | null;
  receivedBy: PersonRef | null;
  returnInspection: LoanInspection | null;
  closedAt: string | null;
  remarks: string | null;
  isOverdue: boolean;
}

/** Damage found by TSG when receiving a returned asset. */
export interface LoanReturnDamage {
  issueTypeId: number;
  issueDescription: string;
}

/** Payload sent to receive a loan. */
export interface LoanReceiveBody {
  inspection: InspectionInput;
  returnDamage?: LoanReturnDamage | null;
}

/** A person's lab affiliation. */
export interface PersonLab {
  centerId: number;
  code: string;
}

/** Data required by the printable Accountability Form. */
export interface AccountabilityForm {
  loan: Loan;
  asset: AssetListItem;
  borrower: {
    userId: number;
    name: string;
    idNumber: number | null;
    email: string;
    labs: PersonLab[];
  };
  releaseInspection: LoanInspection | null;
}


/** Clearance record returned by POST /api/users/:userId/clearance-record. */
export interface ClearanceRecord {
  person: { userId: number; name: string; idNumber: number | null; labs: PersonLab[] };
  cleared: boolean;
  loans: Loan[];
}
