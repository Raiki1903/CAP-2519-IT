/**
 * The asset category type. The categories themselves, with their labels, useful lives and whether they are active,
 * live in the asset_categories table: the server reads them (server/features/reference/reference.service.ts) and the
 * screens get them from GET /api/lookups.
 * Layer: shared. Imported by shared/constants/careGuidelines.ts and server/features (analytics insights, imports).
 * Imports nothing.
 * Used by: asset registration and edit, and every screen that shows an asset's category.
 */

/** One asset category code, the key of asset_categories (for example "MONITOR"). */
export type AssetCategory = string;
