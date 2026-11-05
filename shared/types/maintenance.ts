/**
 * Request and response shapes of the maintenance endpoints.
 * Layer: shared. Imported by server/features/maintenance/ and web/api/maintenance.api.ts. Imports shared/types/assets.ts
 * and shared/types/inspections.ts.
 * Used by: reporting an issue, TSG receipt and the maintenance steps, the ticket lists.
 */
import type { InspectionInput, PersonRef } from './assets';
import type { Inspection } from './inspections';

/** The body of POST /api/assets/:assetTag/maintenance (contract 7.4). */
export interface MaintenanceReportBody {
  /** An issue_types row, from GET /api/lookups `issueTypes`. */
  issueTypeId: number;
  /** Required, at most 2,000 characters. */
  issueDescription: string;
}

/** The body of PUT /api/maintenance/:maintenanceId/receive. */
export interface MaintenanceReceiveBody {
  /** The Maintenance inspection TSG files when the asset arrives. */
  inspection: InspectionInput;
}

/** The body of PUT /api/maintenance/:maintenanceId/start and /stage. */
export interface MaintenanceStageBody {
  stage: "REPAIRING" | "EXTERNAL_SERVICE";
  /** Required for External Service: the warranty holder or the repair shop. */
  provider?: string | null;
  /** Required to repair an asset under warranty in house (Repairing). */
  warrantyOverrideReason?: string | null;
}

/** The body of PUT /api/maintenance/:maintenanceId/complete. */
export interface MaintenanceCompleteBody {
  outcome: "RESOLVED" | "BEYOND_REPAIR";
  resolutionRemarks: string;
  inspection: InspectionInput;
}

/** The body of PUT /api/maintenance/:maintenanceId/cancel. */
export interface MaintenanceCancelBody {
  /** Stored as the ticket's resolution remarks. */
  remarks?: string | null;
}

/** A ticket in an answer (docs/contracts/lifecycle.md, Maintenance). People are `{ hidden: true }` to a Researcher who is not them. */
export interface Maintenance {
  maintenanceId: number;
  /** The asset, with its warranty expiry (yyyy-mm-dd or null) for the "Under warranty until" line. */
  asset: { assetId: number; tag: string; name: string; warrantyExpiry: string | null };
  /** One of MAINTENANCE_TYPES. */
  type: string;
  typeLabel: string;
  /** One of MAINTENANCE_STATUSES. */
  status: string;
  statusLabel: string;
  /** Null only for a ticket filed before issue types existed. */
  issueType: { issueTypeId: number; key: string; name: string; suggestedAction: string } | null;
  issueDescription: string;
  reportedBy: PersonRef;
  /** ISO date-time. */
  reportedAt: string;
  receivedBy: PersonRef | null;
  receivedAt: string | null;
  /** The asset's warranty expiry is on or after the day TSG received it (before receipt: on or after today). */
  underWarranty: boolean;
  warrantyOverrideReason: string | null;
  provider: string | null;
  /** Who completed it, or who cancelled it when the status is Cancelled. */
  completedBy: PersonRef | null;
  completedAt: string | null;
  resolutionRemarks: string | null;
  triggerInspection: Inspection | null;
  completionInspection: Inspection | null;
}
