/**
 * The field limit of an asset remark (asset_remarks.remark_text).
 * Layer: shared. Imported by server/features/assets/remarks.validation.ts and web/features/assets/AssetRemarks.tsx.
 * Imports nothing.
 * Used by: the Remarks section of the asset detail modal.
 */

/** The longest remark, in characters. Must match `remark_text` VARCHAR(500) in schema.prisma. */
export const ASSET_REMARK_MAX_LENGTH = 500;
