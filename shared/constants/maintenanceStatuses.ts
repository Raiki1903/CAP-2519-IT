/**
 * The maintenance ticket statuses and types (asset_maintenance.status and .type), their labels, and the open statuses.
 * Layer: shared. Imported by the server (maintenance service, derive helpers) and web/. Imports nothing.
 * Used by: the Repair and Maintenance workflow.
 */

/** Every value of asset_maintenance.status. Must match the `asset_maintenance_status` enum in schema.prisma. */
export const MAINTENANCE_STATUSES = [
  "PENDING_RECEIPT",
  "INSPECTING",
  "REPAIRING",
  "EXTERNAL_SERVICE",
  "RESOLVED",
  "BEYOND_REPAIR",
  "CANCELLED",
] as const;

/** One value of asset_maintenance.status. */
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

/** The label every screen shows for each maintenance status. */
export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  PENDING_RECEIPT: "Pending Receipt",
  INSPECTING: "Inspecting",
  REPAIRING: "Repairing",
  EXTERNAL_SERVICE: "External Service",
  RESOLVED: "Resolved",
  BEYOND_REPAIR: "Beyond Repair",
  CANCELLED: "Cancelled",
};

/** A ticket that is not finished. An asset has at most one. */
export const OPEN_MAINTENANCE_STATUSES: readonly MaintenanceStatus[] = ["PENDING_RECEIPT", "INSPECTING", "REPAIRING", "EXTERNAL_SERVICE"];

/** A ticket whose asset TSG has received: the asset is in Maintenance while the ticket is in one of these. */
export const RECEIVED_MAINTENANCE_STATUSES: readonly MaintenanceStatus[] = ["INSPECTING", "REPAIRING", "EXTERNAL_SERVICE"];

/** Every value of asset_maintenance.type. Must match the `asset_maintenance_type` enum in schema.prisma. */
export const MAINTENANCE_TYPES = ["BORROWER_REPORT", "TSG_MAINTENANCE", "RETURN_DAMAGE"] as const;

/** One value of asset_maintenance.type. */
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

/** The label every screen shows for each ticket type. */
export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  BORROWER_REPORT: "Borrower Report",
  TSG_MAINTENANCE: "TSG Maintenance",
  RETURN_DAMAGE: "Return Damage",
};
