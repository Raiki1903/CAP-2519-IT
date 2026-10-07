import { useState, useEffect } from "react";
import { useServerData } from "@web/state/serverData";
import * as repairsApi from "@web/api/repairs.api";

const DB_PENDING_STATUSES = ["Pending TSG Review", "Awaiting Immediate Dispatch"];

export function useRepairTickets(onAssetsChanged?: () => Promise<void>) {
  const { acknowledgeRepair, updateRepairStatus } = useServerData();

  // Live repair/maintenance tickets from the MySQL-backed API (RepairForm and
  // ReturnForm's "flag for repair" both write here via POST /api/assets/:tag/repair).
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

  // Shape DB-sourced tickets to match the RepairRequest interface the existing
  // UI (RepairAlertCard, the priority table, RepairProgressDialog) expects.
  // _source/_repairId let the acknowledge/update handlers below route the
  // action to the real backend instead of the local mock context.
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

  // Repair Operations Manager reads only from the database now — no mock/demo
  // tickets mixed in. (acknowledgeRepair/updateRepairStatus from context are
  // kept as a fallback in the handlers below but should never fire in
  // practice, since every ticket here is DB-sourced.)
  const combinedRepairs = mappedDbRepairs;

  const updateDbRepairStatus = async (repairId: number, status: string, condition?: string, remarks?: string) => {
    try {
      const data = await repairsApi.updateRepair(repairId, { progressStatus: status, assetCondition: condition, assetRemarks: remarks });
      if (!data.success) {
        console.error("❌ Failed to update repair status:", data.error);
      }
    } catch (err: any) {
      console.error("❌ Failed to reach the server:", err.message);
    }
    // The endpoint also flips the underlying asset's status (e.g. into
    // MAINTENANCE on acknowledge, back to ON_LOAN on Fixed & Completed), so
    // both lists need to refresh — not just the repair ticket.
    await Promise.all([fetchDbRepairs(), onAssetsChanged?.()]);
  };

  // Unified handlers — route to the real API for DB-sourced tickets, and to
  // the existing mock context functions for the legacy demo tickets.
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
