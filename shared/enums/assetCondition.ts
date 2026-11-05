/**
 * The five asset condition values, best to worst, their labels, and the health score each one suggests.
 * Layer: shared. Imported by the server (assets, loans, inspections, maintenance), shared/types/returns.ts, and web/
 * (EditAssetDialog, ReturnForm, the inspection forms). Imports nothing.
 * Used by: every inspection, and every screen that shows an asset's condition.
 */

/**
 * Valid asset conditions, in order from best to worst.
 * These are the Prisma enum member names, not the stored strings: MINOR_DRIFT and
 * CRITICAL_DEFECT are stored with a space ("MINOR DRIFT") through @map in
 * schema.prisma, but Prisma only accepts the underscore form in code.
 */
export const ASSET_CONDITIONS = ["PERFECT", "OPERATIONAL", "MINOR_DRIFT", "DEGRADED", "CRITICAL_DEFECT"];

/** One asset condition, by its Prisma enum member name. */
export type AssetCondition = "PERFECT" | "OPERATIONAL" | "MINOR_DRIFT" | "DEGRADED" | "CRITICAL_DEFECT";

/** The label every screen shows for each condition. */
export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
  PERFECT: "Perfect",
  OPERATIONAL: "Operational",
  MINOR_DRIFT: "Minor Drift",
  DEGRADED: "Degraded",
  CRITICAL_DEFECT: "Critical Defect",
};

/**
 * The health score an inspection form fills in when TSG picks a condition. Only a suggestion: TSG may change it,
 * and the stored score is whatever TSG saves.
 */
export const SUGGESTED_HEALTH_SCORE: Record<AssetCondition, number> = {
  PERFECT: 100,
  OPERATIONAL: 80,
  MINOR_DRIFT: 60,
  DEGRADED: 40,
  CRITICAL_DEFECT: 20,
};
