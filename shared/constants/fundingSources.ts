/**
 * The funding sources the forms offer.
 * Layer: shared. Imported by server/features/lookups/lookups.service.ts and web/ (pages/staff/InventoryPage.tsx, the funding filter). Imports nothing.
 * Used by: Staff asset registration and editing, and the inventory funding filter.
 */

/**
 * Funding sources offered in Register Equipment, Edit Asset, and the inventory filter. The database stores any text
 * here, so older assets can hold a value that is not on this list (for example "Unspecified").
 */
export const FUNDING_SOURCES = ["DOST", "USAID", "CHED", "Internal Grants"];
