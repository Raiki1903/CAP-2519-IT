/**
 * Maintenance tickets for Staff: the shared ticket list, split into open and closed, for the Staff screens.
 * Layer: feature component (data hook). Called by pages/staff/OverviewPage.tsx and RepairsPage.tsx.
 * Calls: state/serverData.tsx (the shared ticket list, loaded from api/maintenance.api.ts listTickets()).
 * Used by: Staff repair handling.
 */
import { useEffect } from "react";
import type { Maintenance } from "@shared/types/maintenance";
import { OPEN_MAINTENANCE_STATUSES, type MaintenanceStatus } from "@shared/constants/maintenanceStatuses";
import { useServerData } from "@web/state/serverData";

/**
 * Reloads the shared ticket list when the calling page mounts (unless one just ran) and splits it. The steps
 * themselves (receive, start, change stage, complete, cancel) are sent by RepairProgressDialog, which then asks for a
 * reload with `reload()`.
 *
 * @returns `openTickets` (Pending Receipt first, then newest report first), `closedTickets` (newest first),
 *   `pendingReceiptCount`, `loading`, and `reload()`
 */
export function useRepairTickets() {
  const { tickets, pendingReceiptCount, isDbLoading, syncFromDb, refreshSharedLists } = useServerData();

  useEffect(() => {
    refreshSharedLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOpen = (t: Maintenance) => (OPEN_MAINTENANCE_STATUSES as readonly string[]).includes(t.status as MaintenanceStatus);
  const waiting = (t: Maintenance) => (t.status === "PENDING_RECEIPT" ? 0 : 1);
  const openTickets = tickets.filter(isOpen).sort((a, b) => waiting(a) - waiting(b));
  const closedTickets = tickets.filter(t => !isOpen(t));

  return { openTickets, closedTickets, pendingReceiptCount, loading: isDbLoading, reload: syncFromDb };
}
