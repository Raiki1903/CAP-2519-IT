/**
 * The retirement statuses and pathways (asset_retirements.status and .pathway), and their labels.
 * Layer: shared. Imported by the server (retirements and assets services) and web/. Imports nothing.
 * Used by: the Asset Disposal workflow.
 */

/** Every value of asset_retirements.status. Must match the `asset_retirements_status` enum in schema.prisma. */
export const RETIREMENT_STATUSES = ["PENDING", "APPROVED", "DENIED", "COMPLETED"] as const;

/** One value of asset_retirements.status. */
export type RetirementStatus = (typeof RETIREMENT_STATUSES)[number];

/** The label every screen shows for each retirement status. */
export const RETIREMENT_STATUS_LABELS: Record<RetirementStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DENIED: "Denied",
  COMPLETED: "Completed",
};

/** Every value of asset_retirements.pathway. Must match the `asset_retirements_pathway` enum in schema.prisma. */
export const RETIREMENT_PATHWAYS = ["DONATE", "RECYCLE", "RETURN_TO_FUNDER", "SELL", "OTHER"] as const;

/** One value of asset_retirements.pathway. */
export type RetirementPathway = (typeof RETIREMENT_PATHWAYS)[number];

/** The label every screen shows for each pathway. */
export const RETIREMENT_PATHWAY_LABELS: Record<RetirementPathway, string> = {
  DONATE: "Donate",
  RECYCLE: "Recycle",
  RETURN_TO_FUNDER: "Return to Funder",
  SELL: "Sell",
  OTHER: "Other",
};
