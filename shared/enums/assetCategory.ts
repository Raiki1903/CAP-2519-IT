/**
 * The asset category type. The categories themselves, with their labels, useful lives and whether they are active,
 * live in the asset_categories table: the server reads them (server/features/reference/reference.service.ts) and the
 * screens get them from GET /api/lookups.
 * Layer: shared. Imported by shared/constants/careGuidelines.ts, server/features (analytics insights, imports), and
 * web/ (features/assets/IntakeWizard.tsx, pages/custodian/CustodianPortal.tsx). Imports nothing.
 * Used by: asset registration and edit, and every screen that shows an asset's category.
 */

/** One asset category code, the key of asset_categories (for example "MONITOR"). */
export type AssetCategory = string;

/**
 * The 20 category codes the asset categories migration wrote.
 * TODO(#194): Register Asset and the Researcher's category filter still read this list instead of GET /api/lookups,
 * so a category added on the Reference Data page is missing there. Commit 5 of #194 moves them and removes this list.
 */
export const ASSET_CATEGORIES: readonly AssetCategory[] = [
  "DEV_KIT", "MONITOR", "TV", "CPU", "KEYBOARD", "MOUSE", "CAMERA",
  "MEMORY_CARD", "PROJECTOR", "RECORDER", "ROUTER", "SIMULATOR",
  "TABLET", "VR", "PRINTER", "SWITCH", "HARD_DRIVE", "AUDIO",
  "VIDEO_CAMERA", "SPEAKER",
];
