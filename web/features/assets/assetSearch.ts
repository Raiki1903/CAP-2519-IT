/**
 * The one rule for an asset search box: it matches the asset's tag, name, or serial number, ignoring capital letters.
 * Layer: feature helper. Called by pages/staff/InventoryPage.tsx, pages/lab-head/LabHeadDashboard.tsx,
 * pages/custodian/CustodianPortal.tsx, and pages/director/AdRICDirectorDashboard.tsx (placeholder only).
 * Calls nothing.
 * Used by: Staff, Lab Head, Custodian, Director.
 */

/** The placeholder every asset search box shows, so it says what the box matches. */
export const ASSET_SEARCH_PLACEHOLDER = "Search by tag, name or serial…";

/**
 * Tells whether an asset matches what the user typed in an asset search box.
 * An empty box (or spaces only) matches every asset.
 *
 * @param asset the asset row; `id` is the asset tag, for example CITe4D-0009
 * @param query the text in the search box
 */
export function matchesAssetSearch(asset: { id?: string; name?: string; serial?: string }, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [asset.id, asset.name, asset.serial].some(field => (field ?? "").toLowerCase().includes(needle));
}
