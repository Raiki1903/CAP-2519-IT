/**
 * The inspection types (asset_inspections.type), their labels, and which ones TSG files.
 * Layer: shared. Imported by the server (inspections service, derive helpers) and web/. Imports nothing.
 * Used by: every inspection, and the asset's condition now.
 */

/** Every value of asset_inspections.type. Must match the `asset_inspections_type` enum in schema.prisma. */
export const INSPECTION_TYPES = [
  "INITIAL",
  "LOAN_RELEASE",
  "RETURN",
  "MAINTENANCE",
  "RECOVERY",
  "ROUTINE",
  "RETIREMENT",
  "SELF_REPORT",
] as const;

/** One value of asset_inspections.type. */
export type InspectionType = (typeof INSPECTION_TYPES)[number];

/** The label every screen shows for each inspection type. */
export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  INITIAL: "Initial",
  LOAN_RELEASE: "Loan Release",
  RETURN: "Return",
  MAINTENANCE: "Maintenance",
  RECOVERY: "Recovery",
  ROUTINE: "Routine",
  RETIREMENT: "Retirement",
  SELF_REPORT: "Self Report",
};

/**
 * The types TSG files: every type but Self Report. The asset's condition now is the newest of these, so a holder's
 * Self Report never changes it.
 */
export const TSG_INSPECTION_TYPES: readonly InspectionType[] = INSPECTION_TYPES.filter(t => t !== "SELF_REPORT");
