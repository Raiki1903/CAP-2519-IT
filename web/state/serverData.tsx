/**
 * Server data state: the lists that several screens share, loaded from the server and kept in memory.
 * Layer: shared (web state). Called by App.tsx (the provider) and by screens through useServerData().
 * Calls the web/api files, browserOnly.tsx, and session.tsx (the role). Never reads or writes localStorage itself.
 * Used by: every role (asset lists, the notification bell, repairs, loan and registration approvals).
 *
 * Temporary home. 01D gives each page its own data loading; these lists move out as the
 * dashboards are split in step 8 and the notification bell is rewritten.
 */
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import * as loansApi from "../api/loans.api";
import * as assetsApi from "../api/assets.api";
import * as transfersApi from "../api/transfers.api";
import * as repairsApi from "../api/repairs.api";
import * as disposalsApi from "../api/disposals.api";
import * as inspectionsApi from "../api/inspections.api";
import * as authApi from "../api/auth.api";
import type { ApiResult } from "../api/client";
import { useBrowserOnly } from "./browserOnly";
import { useSession } from "./session";
import type { Role } from "@shared/enums/role";

// The lists only some roles may read (the 13b role table). Asking with another role answers 403,
// so those lists are not requested for it. The other lists are open to every signed-in role.
const REPORT_READERS: Role[] = ["Staff", "AdRICDirector"];
const DISPOSAL_READERS: Role[] = ["Staff", "AdRICDirector", "LabHead"];
const REGISTRATION_READERS: Role[] = ["LabHead"];

// refreshSharedLists() skips a reload that started less than this long ago, or is still running.
const RECENT_SYNC_MS = 5000;

/** A repair ticket as `GET /api/asset_repairs` returns it, and as the repair forms build one to send. */
export interface RepairRequest {
  id: string;
  assetId: string;
  assetName: string;
  custodian: string;
  statusLabel: string;
  description: string;
  imageUrl?: string;
  submittedAt: string;
  priority: "Medium" | "High" | "Critical";
  acknowledged: boolean;
  forwardedTo?: "TSG" | "ITS" | "Both";
}

/** How and when a disposed asset left the registry. Present on an asset only once it is disposed. */
export interface DisposalDetails {
  /** Left out for a Custodian when it is someone else. (D2) */
  lastCustodian?: string;
  breakdownReasons: string;
  disposalPathway: string;
  decommissionDate: string;
  /** Left out for a Custodian when it is someone else. (D2) */
  decommissionedBy?: string;
}

/**
 * What a screen shows for an asset's holder: the name, "Not shown" when the caller (a Custodian) may not see who
 * holds it (D2), or "None" when nobody holds it (the server sends no name for its placeholder custodian).
 *
 * @param name the holder's name as the server sent it, if any
 * @param hidden the server's custodianHidden mark
 * @returns the text to show
 */
export function holderLabel(name: string | undefined, hidden?: boolean): string {
  return name || (hidden ? "Not shown" : "None");
}

/** One asset as `GET /api/assets` returns it for display. */
// TODO(H-13): the server also sends fields that are not declared here (asset_transfers, asset_reports, asset_monetary). The real shape belongs in shared/types. Step 12.
export interface Asset {
  /** The asset tag, for example "CITe4D-0004". Not the numeric database id. */
  id: string;
  name: string;
  serial: string;
  manufacturer: string;
  category: string;
  funding: string;
  fundingOrganization?: string;
  projectTitle?: string;
  procured: string;
  warranty: string;
  location: string;
  lab: string;
  /** Display status, for example "Active", "On Loan", "Maintenance", "Overdue", or "Disposed". */
  status: string;
  /** Health score from 0 to 100. */
  condition: number;
  descriptiveCondition?: string;
  custodian?: string;
  /** True when someone holds the asset but the caller, a Custodian, may not see who. (D2) */
  custodianHidden?: boolean;
  borrowedOn?: string;
  dueDate?: string;
  daysLeft?: number;
  disposalId?: string;
  disposalDetails?: DisposalDetails;
  cost?: number;
  itsPropertyTag?: string;
  tsgPropertyTag?: string;
  tsgRemarks?: string;
  itsRemarks?: string;
  projectId?: string;
  projectName?: string;
  projectLeader?: string;
  ccsLab?: string;
  fundingAgency?: string;
  projectStartYear?: string;
  description?: string;
  image?: string;
  specs?: string;
}

/** A disposal request waiting for the Director's decision. */
// TODO(H-13): lastCustodian, breakdownReasons, and disposalPathway are declared here but never filled. The server sends one `reason` text instead (M-13), so the bell shows "undefined" for them. Fix with the bell rewrite.
export interface PendingDisposal {
  /** Display id, for example "DISP-12". */
  id: string;
  /** Numeric id, the one the decision endpoint needs. */
  disposalId?: number;
  assetId: string;
  assetName: string;
  lastCustodian: string;
  breakdownReasons: string;
  disposalPathway: string;
  requestedBy: string;
  requestedAt: string;
}

/** A sign-up request waiting for a Lab Head. */
// TODO(C-04): the server sends each applicant's password in this list (issue #72). Phase 3.
export interface PendingRegistration {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number;
  userType: "STUDENT" | "FACULTY" | "STAFF";
  requestedRole: string;
  labAffiliation: string;
  password?: string;
  avatarUrl?: string;
  submittedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface ServerDataContextType {
  assets: Asset[];
  assetsVersion: number;
  repairRequests: RepairRequest[];
  addRepairRequest: (req: RepairRequest) => void;
  acknowledgeRepair: (id: string) => void;
  updateRepairStatus: (id: string, statusLabel: string) => void;
  unacknowledgedCount: number;
  pendingDisposals: PendingDisposal[];
  pendingRegistrations: PendingRegistration[];
  addPendingRegistration: (req: PendingRegistration) => void;
  approveRegistration: (reqOrId: string | PendingRegistration) => Promise<ApiResult>;
  rejectRegistration: (requestId: string) => Promise<void>;
  dbTransfers: any[];
  dbReports: any[];
  dbLoans: any[];
  isDbLoading: boolean;
  syncFromDb: () => Promise<void>;
  refreshSharedLists: () => Promise<void>;
  reloadLoans: () => Promise<ApiResult>;
  authorizeLoan: (loanId: string, decision?: "approve" | "decline") => Promise<void>;
}

const ServerDataContext = createContext<ServerDataContextType | null>(null);

/**
 * Loads the shared lists when someone is logged in (after login, or when a page load restores the session),
 * shares them through useServerData(), reloads them whenever a screen calls `syncFromDb()` after saving
 * something, and empties them on logout. Each role loads only the lists the server lets it read.
 *
 * What it shares, and the api function behind each:
 * - `assets`: assetsApi.listAssets. `assetsVersion`: goes up by one each time a new asset list is stored.
 * - `repairRequests`, `unacknowledgedCount`: repairsApi.listRepairs.
 * - `addRepairRequest(req)`: repairsApi.requestRepairRaw. `acknowledgeRepair(id)` and
 *   `updateRepairStatus(id, status)`: repairsApi.updateRepairRaw. Each reloads afterwards.
 * - `dbLoans`: loansApi.listLoans. `reloadLoans()`: reloads only this list and returns the answer.
 *   `authorizeLoan(loanId, decision)`: loansApi.decideLoan.
 * - `dbTransfers`: transfersApi.listTransfers. `dbReports`: inspectionsApi.listReportSummaries.
 * - `pendingDisposals`: disposalsApi.listDisposals, pending ones only.
 * - `pendingRegistrations`, `approveRegistration`, `rejectRegistration`: authApi.
 * - `isDbLoading`: true while a reload is running. `syncFromDb()`: runs one.
 * - `refreshSharedLists()`: runs one too, unless one is running or started in the last few seconds.
 *   For a screen that opens, not for a save (a save needs the lists as they are after it).
 *
 * Must sit inside BrowserOnlyProvider, because each reload also re-reads the browser-only lists and
 * drops the return requests whose asset is back in the pool or disposed.
 *
 * @param children the rest of the app
 */
export function ServerDataProvider({ children }: { children: React.ReactNode }) {
  const { reloadFromStorage, dropReturnRequests } = useBrowserOnly();
  const { role } = useSession();
  const [isDbLoading, setIsDbLoading] = useState<boolean>(true);

  const [repairRequests, setRepairRequests] = useState<RepairRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  // Lets a screen tell whether the list reloaded after a moment it remembers (the asset detail modal). (issue #89)
  const [assetsVersion, setAssetsVersion] = useState(0);
  const [dbTransfers, setDbTransfers] = useState<any[]>([]);
  const [dbReports, setDbReports] = useState<any[]>([]);
  const [dbLoans, setDbLoans] = useState<any[]>([]);
  const [pendingDisposals, setPendingDisposals] = useState<PendingDisposal[]>([]);
  // When the last reload started, and how many are running. Refs, because only refreshSharedLists reads them.
  const lastSyncStartedAt = useRef(0);
  const runningSyncs = useRef(0);

  // The one place the loan list is loaded, so the bell and Custody Transitions show the same loans. (issue #57)
  const reloadLoans = useCallback(async () => {
    const data = await loansApi.listLoans();
    if (data.success && Array.isArray(data.loans)) {
      setDbLoans(data.loans);
    }
    return data;
  }, []);

  // Each list has its own try block so one failed request does not stop the
  // others. A list whose request fails keeps what it showed before.
  // TODO(M-01): six requests on every reload, and GET /api/assets alone reads nine tables. Pages loading their own data (01D), and the asset list rewrite (issue #76).
  const syncFromDb = async () => {
    lastSyncStartedAt.current = Date.now();
    runningSyncs.current += 1;
    setIsDbLoading(true);
    // Tags of assets back in the pool or retired, from this reload's asset list. Empty when the list did not load.
    let doneAssetTags: string[] = [];
    try {
      try {
        const jsonAssets = await assetsApi.listAssets();
        if (jsonAssets.success && Array.isArray(jsonAssets.assets)) {
          setAssets(jsonAssets.assets);
          setAssetsVersion(v => v + 1);
          doneAssetTags = jsonAssets.assets
            .filter((a: Asset) => a.status === "Active" || a.status === "Disposed")
            .map((a: Asset) => a.id);
          // First guess at transfers and reports from the rows inside each asset.
          // The two dedicated requests below replace them when they succeed.
          const allTransfers = jsonAssets.assets.flatMap((a: any) => a.asset_transfers || []);
          const allReports = jsonAssets.assets.flatMap((a: any) => a.asset_reports || []);
          if (allTransfers.length > 0) setDbTransfers(allTransfers);
          if (allReports.length > 0) setDbReports(allReports);
        }
      } catch (e) {
        console.error("Failed to fetch live assets from API:", e);
      }

      try {
        const jsonT = await transfersApi.listTransfers();
        if (jsonT.success && Array.isArray(jsonT.transfers)) {
          setDbTransfers(jsonT.transfers);
        }
      } catch (e) {}

      if (role && REPORT_READERS.includes(role)) {
        try {
          const jsonR = await inspectionsApi.listReportSummaries();
          if (jsonR.success && Array.isArray(jsonR.reports)) {
            setDbReports(jsonR.reports);
          }
        } catch (e) {}
      }

      try {
        await reloadLoans();
      } catch (e) {}

      if (role && DISPOSAL_READERS.includes(role)) {
        try {
          const jsonD: any = await disposalsApi.listDisposals();
          if (jsonD.success && Array.isArray(jsonD.disposals)) {
            // The endpoint returns decided disposals too. Only pending ones are kept,
            // so one that was just approved or rejected leaves the bell. (H-01)
            setPendingDisposals(jsonD.disposals.filter((d: any) => d.status === "Pending").map((d: any) => ({
              id: String(d.id || d.disposalId),
              disposalId: d.disposalId,
              assetId: d.assetId || `EQ-2024-${String(d.asset_id || 0).padStart(3, "0")}`,
              assetName: d.assetName || "Asset Scheduled for Decommissioning",
              requestedBy: d.requestedBy || "Staff",
              requestedAt: d.requestedAt || new Date().toISOString(),
              reason: d.reason || d.disposal_reason || "Obsolescence",
            })));
          }
        } catch (e) {}
      }

      try {
        const data = await repairsApi.listRepairs();
        if (data.success && Array.isArray(data.repairs)) {
          setRepairRequests(data.repairs);
        }
      } catch (e) {
        console.error("Failed to sync repairs from database API:", e);
      }

      reloadFromStorage();
      // A return request for an asset that is now Active or Disposed is done, wherever it was finalized.
      dropReturnRequests(doneAssetTags);
    } finally {
      runningSyncs.current -= 1;
      setIsDbLoading(false);
    }
  };

  // A screen that opens gets fresh lists without repeating the reload made a moment ago, for example the
  // one at login, which is still running when the first screen opens. (issue #92)
  const refreshSharedLists = async () => {
    if (runningSyncs.current > 0 || Date.now() - lastSyncStartedAt.current < RECENT_SYNC_MS) return;
    await syncFromDb();
  };


  // The only post for the callers that use it (the asset modal's "Send to Maintenance"
  // and the custodian condition report). RepairForm posts its ticket itself. (M-07)
  const addRepairRequest = async (req: RepairRequest) => {
    try {
      await repairsApi.requestRepairRaw(req.assetId, {
        description: req.description,
        isImmediate: req.priority === "Critical" || req.statusLabel === "Disposal Recommendation",
      });
    } catch (e) {
      console.error("Failed to post repair request to DB API:", e);
    }
    await syncFromDb();
  };

  // "Inspection Phase" is the first status after a ticket is acknowledged.
  const acknowledgeRepair = async (id: string) => {
    // Ticket ids are shown as "MNT-<number>". The endpoint needs the number.
    const numericId = parseInt(id.replace(/^MNT-/, ""), 10);
    if (!isNaN(numericId)) {
      try {
        await repairsApi.updateRepairRaw(numericId, { progressStatus: "Inspection Phase" });
      } catch (e) {
        console.error("Failed to acknowledge repair in DB API:", e);
      }
    }
    await syncFromDb();
  };

  const updateRepairStatus = async (id: string, statusLabel: string) => {
    const numericId = parseInt(id.replace(/^MNT-/, ""), 10);
    if (!isNaN(numericId)) {
      try {
        await repairsApi.updateRepairRaw(numericId, { progressStatus: statusLabel });
      } catch (e) {
        console.error("Failed to update repair status in DB API:", e);
      }
    }
    await syncFromDb();
  };

  const unacknowledgedCount = repairRequests.filter(r => !r.acknowledged).length;

  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);

  // Every list needs a session, so nothing loads until someone is logged in (after login, or when a page load
  // restores the session). A logout empties the lists, so the next person in this tab never sees them.
  useEffect(() => {
    if (!role) {
      setAssets([]);
      setRepairRequests([]);
      setDbTransfers([]);
      setDbReports([]);
      setDbLoans([]);
      setPendingDisposals([]);
      setPendingRegistrations([]);
      setIsDbLoading(false);
      return;
    }
    syncFromDb();
    if (REGISTRATION_READERS.includes(role)) {
      authApi.listPendingRegistrations()
        .then(data => {
          if (data.success && Array.isArray(data.pendingRegistrations)) {
            setPendingRegistrations(data.pendingRegistrations);
          }
        })
        .catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Adds to the in-memory list only. Register.tsx has already sent the request to the server.
  const addPendingRegistration = (req: PendingRegistration) => {
    setPendingRegistrations(prev => [req, ...prev]);
  };

  // Shows an alert and throws when the server refuses, so the caller's own success message is skipped.
  const approveRegistration = async (reqOrId: string | PendingRegistration) => {
    const id = typeof reqOrId === "string" ? reqOrId : reqOrId.id;
    const targetObj = typeof reqOrId === "string" ? pendingRegistrations.find(r => r.id === reqOrId) : reqOrId;
    const payload = targetObj ? { requestId: targetObj.id, ...targetObj } : { requestId: id };

    try {
      const data = await authApi.approveRegistration(payload);
      if (data.success) {
        setPendingRegistrations(prev => prev.filter(r => r.id !== id));
        await syncFromDb();
        return data;
      } else {
        alert(`❌ Error approving registration: ${data.error || "Failed to create user in database"}`);
        throw new Error(data.error || "Failed to approve registration");
      }
    } catch (err: any) {
      console.error("Approve registration error:", err);
      alert(`❌ Error connecting to server: ${err.message}`);
      throw err;
    }
  };

  // The request leaves the list even when the server call fails.
  const rejectRegistration = async (requestId: string) => {
    try {
      await authApi.rejectRegistrationRaw(requestId);
    } catch (err) {
      console.error("Reject registration error:", err);
    } finally {
      setPendingRegistrations(prev => prev.filter(r => r.id !== requestId));
    }
  };

  // Updates the one loan in memory instead of reloading every list.
  const authorizeLoan = async (loanId: string, decision: "approve" | "decline" = "approve") => {
    const numericId = loanId.replace("LOAN-", "");
    try {
      const data = await loansApi.decideLoan(numericId, decision);
      if (data.success) {
        setDbLoans(prev => prev.map(l => {
          if (String(l.loanId) === String(numericId) || String(l.loan_id) === String(numericId) || l.id === loanId) {
            return { ...l, status: decision === "approve" ? "Approved" : "Declined" };
          }
          return l;
        }));
      }
    } catch (e) {
      console.error("Failed to authorize loan:", e);
    }
  };

  return (
    <ServerDataContext.Provider
      value={{
        assets, assetsVersion,
        repairRequests, addRepairRequest, acknowledgeRepair, updateRepairStatus,
        unacknowledgedCount,
        pendingDisposals,
        pendingRegistrations, addPendingRegistration, approveRegistration, rejectRegistration,
        dbTransfers, dbReports, dbLoans,
        isDbLoading,
        syncFromDb, refreshSharedLists, reloadLoans, authorizeLoan
      }}
    >
      {children}
    </ServerDataContext.Provider>
  );
}

/**
 * Gives a component the shared server lists and their actions.
 *
 * @returns the lists, the actions, `isDbLoading`, and `syncFromDb`
 * @throws Error if the component is not inside ServerDataProvider
 */
export function useServerData() {
  const ctx = useContext(ServerDataContext);
  if (!ctx) throw new Error("useServerData must be used inside ServerDataProvider");
  return ctx;
}
