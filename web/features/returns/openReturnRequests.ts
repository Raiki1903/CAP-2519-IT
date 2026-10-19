/**
 * Open return requests: which of this browser's return requests still wait for Staff.
 * Layer: feature helper. Called by pages/staff/ReturnsPage.tsx, pages/staff/OverviewPage.tsx, and
 * features/notifications/NotificationCenter.tsx. Calls nothing; types from state/browserOnly.tsx and state/serverData.tsx.
 * Used by: Staff pending returns, the Staff overview count, the notification bell.
 */
import type { ReturnRequest } from "@web/state/browserOnly";
import type { Asset } from "@web/state/serverData";

/** Display statuses of an asset that is still out: on loan, or on loan past its due date. */
const STILL_OUT = ["On Loan", "Overdue"];

/**
 * The Pending requests whose asset is still out. A request whose asset the server's list shows as
 * Active, under maintenance, or disposed is left out: it was returned on another computer, or cannot
 * be returned now. A request whose asset is not in the list (not loaded yet, or deleted) is kept.
 * The requests stay in the browser; this only decides which ones to show. (issue #99)
 *
 * @param returns this browser's return requests, from useBrowserOnly()
 * @param assets the server's asset list, from useServerData()
 * @returns the requests to show, in the order given
 */
export function openReturnRequests(returns: ReturnRequest[], assets: Pick<Asset, "id" | "status">[]): ReturnRequest[] {
  return returns.filter(r => {
    if (r.status !== "Pending") return false;
    const asset = assets.find(a => a.id === r.assetId);
    return !asset || STILL_OUT.includes(asset.status);
  });
}
