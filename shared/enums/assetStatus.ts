/**
 * The asset statuses Staff may set by hand.
 * Layer: shared. Imported by server/features/lookups/lookups.service.ts. Imports nothing.
 * Used by: Staff asset editing.
 */

/**
 * The stored statuses (asset_records.status) Edit Asset offers. DISPOSED is not here: only a Director's disposal
 * approval sets it.
 */
export const EDITABLE_ASSET_STATUSES = ["ACTIVE", "ON_LOAN", "MAINTENANCE"];
