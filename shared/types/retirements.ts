/**
 * Request and response shapes of the disposal (retirement) endpoints.
 * Layer: shared. Imported by server/features/retirements/ and web/api/retirements.api.ts. Imports shared/types/assets.ts
 * and shared/types/inspections.ts.
 * Used by: TSG disposal requests and completion, the Director's and the Secretary's decisions, the disposal lists.
 */
import type { InspectionInput, PersonRef } from './assets';
import type { Inspection } from './inspections';

/** The body of POST /api/assets/:assetTag/retirement (contract 7.5). */
export interface RetirementRequestBody {
  /** Required, at most 2,000 characters. */
  reason: string;
  /** One of RETIREMENT_PATHWAYS, when TSG already knows it. */
  pathway?: string | null;
  /** A Retirement inspection, when TSG assessed the asset for the request. */
  assessmentInspection?: InspectionInput | null;
}

/** The body of PUT /api/retirements/:retirementId/decision. Remarks are required to deny. */
export interface RetirementDecisionBody {
  decision: "approve" | "deny";
  decisionRemarks?: string | null;
}

/** The body of PUT /api/retirements/:retirementId/complete. */
export interface RetirementCompleteBody {
  /** One of RETIREMENT_PATHWAYS. */
  pathway: string;
  /** At most 255 characters, for example the donation or sale document number. */
  dispositionReference: string;
}

/** A disposal in an answer (docs/contracts/lifecycle.md, Retirement). */
export interface Retirement {
  retirementId: number;
  asset: { assetId: number; tag: string; name: string };
  /** One of RETIREMENT_STATUSES. */
  status: string;
  statusLabel: string;
  reason: string;
  /** One of RETIREMENT_PATHWAYS, or null until TSG names it. */
  pathway: string | null;
  pathwayLabel: string | null;
  /** The asset's status before the request, which a denial gives back. */
  previousStatus: string | null;
  previousStatusLabel: string | null;
  requestedBy: PersonRef;
  /** ISO date-time. */
  requestedAt: string;
  decidedBy: PersonRef | null;
  decidedAt: string | null;
  decisionRemarks: string | null;
  completedBy: PersonRef | null;
  completedAt: string | null;
  dispositionReference: string | null;
  assessmentInspection: Inspection | null;
}

/** The body today's disposal form sends. The server reads RetirementRequestBody instead. */
export interface DisposalRequestInput {
  breakdownReasons: string;
  disposalPathway: string;
  /** Decommission date as yyyy-mm-dd. */
  decommissionDate?: string;
}

/** One row of GET /api/retirements's `disposals`, the shape today's screens read, next to the new `retirements`. */
export interface DisposalListItem {
  /** Display id, "DISP-<retirement_id>". */
  id: string;
  disposalId: number;
  /** The asset's tag. */
  assetId: string;
  assetName: string;
  /** The requester's full name. */
  requestedBy: string;
  /** ISO timestamp. */
  requestedAt: string;
  /** The reason as written. */
  reason: string;
  /** Pending; Approved for Approved and Completed; Rejected for Denied. */
  status: "Pending" | "Approved" | "Rejected";
}
