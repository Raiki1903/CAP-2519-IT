/**
 * The five asset condition values, best to worst.
 * Layer: shared. Imported by server/remainingRoutes.ts, server/features/returns/returns.validation.ts, and web/ (EditAssetDialog, ReturnForm). Imports nothing.
 * Used by: asset edit, repair progress, return, and inspection workflows.
 */

/**
 * Valid asset conditions, in order from best to worst.
 * These are the Prisma enum member names, not the stored strings: MINOR_DRIFT and
 * CRITICAL_DEFECT are stored with a space ("MINOR DRIFT") through @map in
 * schema.prisma, but Prisma only accepts the underscore form in code.
 */
export const ASSET_CONDITIONS = ["PERFECT", "OPERATIONAL", "MINOR_DRIFT", "DEGRADED", "CRITICAL_DEFECT"];
