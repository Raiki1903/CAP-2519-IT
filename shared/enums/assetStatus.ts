/**
 * The six asset statuses (assets.status), their labels, and the statuses Edit Asset still offers.
 * Layer: shared. Imported by the server (lifecycle guard, status setter, derive helpers, asset list, lookups) and web/
 * (badges and filters). Imports nothing.
 * Used by: every workflow that reads or changes an asset's state.
 */

/**
 * Every value of assets.status. Must match the `assets_status` enum in schema.prisma, because the server writes these
 * values straight into that column. Only the status setter (server/shared/services/assetStatus.ts) writes it.
 */
export const ASSET_STATUSES = ["AVAILABLE", "ON_LOAN", "MAINTENANCE", "PENDING_RETIREMENT", "RETIRED", "MISSING"] as const;

/** One value of assets.status. */
export type AssetStatus = (typeof ASSET_STATUSES)[number];

/** The label every screen shows for each asset status. A screen never makes up its own. */
export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  AVAILABLE: "Available",
  ON_LOAN: "On Loan",
  MAINTENANCE: "Maintenance",
  PENDING_RETIREMENT: "Pending Retirement",
  RETIRED: "Retired",
  MISSING: "Missing",
};

/**
 * The old record statuses (asset_records.status) Edit Asset still offers. DISPOSED is not here: only a Director's
 * disposal approval sets it.
 */
// TODO(H-07): Edit Asset still sets a status. Batch 1 commit 9 makes it master data only and removes this list.
export const EDITABLE_ASSET_STATUSES = ["ACTIVE", "ON_LOAN", "MAINTENANCE"];
