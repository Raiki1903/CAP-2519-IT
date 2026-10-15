/**
 * The placeholder custodian: the user id an asset record names when nobody holds the asset.
 * Layer: shared (server constant). Imported by shared/services/poolCustodianCheck.ts (the startup check) and the services of features/assets, returns, disposals, and repairs. Imports nothing.
 * Used by: intake, return finalization, and every record written for an asset that has no holder.
 */

/**
 * User 1, read as "nobody holds it". asset_records.current_custodian is a required foreign key to users, so an
 * asset with no holder (newly registered, returned to the pool, or with no record at all) is recorded under this
 * account. Never used for who acted: that is always the session user. The asset list and the custodian history
 * send no name for it. main.ts checks at startup that the user exists (shared/services/poolCustodianCheck.ts).
 */
// TODO(H-10): a placeholder account instead of no custodian. Goes when asset_records.current_custodian may be empty, after step 14.
export const POOL_CUSTODIAN_ID = 1;
