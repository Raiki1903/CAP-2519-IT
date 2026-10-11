/**
 * Repair tickets for Staff: loads them, shapes them for the Staff screens, and saves progress.
 * Layer: feature component (data hook). Called by pages/staff/OverviewPage.tsx and RepairsPage.tsx.
 * Calls: api/repairs.api.ts listRepairs() and updateRepair(), state/serverData.tsx (fallback actions).
 * Used by: Staff repair handling.
 */
import { useState, useEffect } from "react";
import { useServerData } from "@web/state/serverData";
import * as repairsApi from "@web/api/repairs.api";

// The two statuses a new ticket starts in. A ticket in either is "not acknowledged yet".
const DB_PENDING_STATUSES = ["Pending TSG Review", "Awaiting Immediate Dispatch"];

/**
 * Loads GET /api/asset_repairs once when the calling page mounts and maps each ticket to the
 * shape the Staff screens use. Saving a status goes through repairsApi.updateRepair(), which also
 * moves the asset into or out of maintenance, then reloads the tickets.
 *
 * @param onAssetsChanged optional; called after a status save so a page that shows assets can reload them
 * @returns the raw `dbRepairs` with `loadingDbRepairs` and `dbRepairsError`, the mapped
 *   `combinedRepairs`, and `handleAcknowledgeRepair(id)` and `handleUpdateRepairStatus(id, status, condition?, remarks?)`
 */
export function useRepairTickets(onAssetsChanged?: () => Promise<void>) {
  const { acknowledgeRepair, updateRepairStatus } = useServerData();

  const [dbRepairs, setDbRepairs] = useState<any[]>([]);
  const [loadingDbRepairs, setLoadingDbRepairs] = useState(false);
  const [dbRepairsError, setDbRepairsError] = useState<string | null>(null);

  const fetchDbRepairs = async () => {
    setLoadingDbRepairs(true);
    setDbRepairsError(null);
    try {
      const data = await repairsApi.listRepairs();
      if (data.success) {
        setDbRepairs(data.repairs);
      } else {
        throw new Error(data.error || "Failed to fetch repairs from server");
      }
    } catch (err: any) {
      console.error("❌ Failed to fetch database repairs:", err);
      setDbRepairsError(err.message || "Could not load repair tickets from DB.");
    } finally {
      setLoadingDbRepairs(false);
    }
  };

  useEffect(() => {
    fetchDbRepairs();
  }, []);

  // Shaped like RepairRequest for the priority table and RepairProgressDialog. _repairId is the
  // number the update endpoint needs; the shown id is "MNT-<number>".
  // Known gaps: forwardedTo is always undefined, so "Dispatched To" always shows a dash, and
  // priority is only ever Critical or Medium, so the High styling never appears.
  const mappedDbRepairs = dbRepairs.map(r => ({
    id: r.id,
    _source: "db" as const,
    _repairId: r.repairId,
    assetId: r.assetId,
    assetName: r.asset,
    custodian: r.reportedBy,
    statusLabel: r.progressStatus,
    description: r.description,
    submittedAt: new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    priority: r.isImmediate ? "Critical" : "Medium",
    acknowledged: !DB_PENDING_STATUSES.includes(r.progressStatus),
    forwardedTo: undefined as string | undefined,
  }));

  // Every ticket here comes from the database, so _source is always "db".
  const combinedRepairs = mappedDbRepairs;

  const updateDbRepairStatus = async (repairId: number, status: string, condition?: string, remarks?: string) => {
    try {
      // TODO(H-06): the Staff analytics board moves tickets through a second endpoint that does not touch the asset's status. Kept in step 12 as decided; merging them is its own behavior-change commit.
      // TODO(H-07): the server stores any status text it is sent. Phase 3.
      const data = await repairsApi.updateRepair(repairId, { progressStatus: status, assetCondition: condition, assetRemarks: remarks });
      if (!data.success) {
        console.error("❌ Failed to update repair status:", data.error);
      }
    } catch (err: any) {
      console.error("❌ Failed to reach the server:", err.message);
    }
    // The endpoint also changes the asset's status (into MAINTENANCE on acknowledge, back
    // out on Fixed & Completed), so a page that shows assets reloads them too.
    await Promise.all([fetchDbRepairs(), onAssetsChanged?.()]);
  };

  // The else branches call serverData's acknowledgeRepair and updateRepairStatus. They never run,
  // because every ticket is from the database (see combinedRepairs).
  const handleAcknowledgeRepair = (id: string) => {
    const target = combinedRepairs.find(r => r.id === id) as any;
    if (target?._source === "db") {
      updateDbRepairStatus(target._repairId, "Inspection Phase");
    } else {
      acknowledgeRepair(id);
    }
  };

  const handleUpdateRepairStatus = (id: string, status: string, condition?: string, remarks?: string) => {
    const target = combinedRepairs.find(r => r.id === id) as any;
    if (target?._source === "db") {
      updateDbRepairStatus(target._repairId, status, condition, remarks);
    } else {
      updateRepairStatus(id, status);
    }
  };

  return {
    dbRepairs, loadingDbRepairs, dbRepairsError,
    combinedRepairs, handleAcknowledgeRepair, handleUpdateRepairStatus,
  };
}
