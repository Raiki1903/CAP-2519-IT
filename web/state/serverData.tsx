import { createContext, useContext, useState, useEffect } from "react";
import * as loansApi from "../api/loans.api";
import * as assetsApi from "../api/assets.api";
import * as transfersApi from "../api/transfers.api";
import * as repairsApi from "../api/repairs.api";
import * as disposalsApi from "../api/disposals.api";
import * as inspectionsApi from "../api/inspections.api";
import * as authApi from "../api/auth.api";
import { useBrowserOnly } from "./browserOnly";

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

export interface DisposalDetails {
  lastCustodian: string;
  breakdownReasons: string;
  disposalPathway: string;
  decommissionDate: string;
  decommissionedBy: string;
}

export interface Asset {
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
  status: string; // "Active", "On Loan", "Maintenance", "Reserved", "Partially Deployed", "Available", "Pending Return", "Overdue", "Disposed"
  condition: number;
  descriptiveCondition?: string;
  custodian?: string;
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

export interface PendingDisposal {
  id: string;
  disposalId?: number;
  assetId: string;
  assetName: string;
  lastCustodian: string;
  breakdownReasons: string;
  disposalPathway: string;
  requestedBy: string;
  requestedAt: string;
}

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
  repairRequests: RepairRequest[];
  addRepairRequest: (req: RepairRequest) => void;
  acknowledgeRepair: (id: string) => void;
  updateRepairStatus: (id: string, statusLabel: string) => void;
  unacknowledgedCount: number;
  pendingDisposals: PendingDisposal[];
  pendingRegistrations: PendingRegistration[];
  addPendingRegistration: (req: PendingRegistration) => void;
  approveRegistration: (requestId: string) => Promise<void>;
  rejectRegistration: (requestId: string) => Promise<void>;
  dbTransfers: any[];
  dbReports: any[];
  dbLoans: any[];
  isDbLoading: boolean;
  syncFromDb: () => Promise<void>;
  authorizeLoan: (loanId: string, decision?: "approve" | "decline") => Promise<void>;
}

const ServerDataContext = createContext<ServerDataContextType | null>(null);

export function ServerDataProvider({ children }: { children: React.ReactNode }) {
  const { reloadFromStorage } = useBrowserOnly();
  const [isDbLoading, setIsDbLoading] = useState<boolean>(true);

  const [repairRequests, setRepairRequests] = useState<RepairRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [dbTransfers, setDbTransfers] = useState<any[]>([]);
  const [dbReports, setDbReports] = useState<any[]>([]);
  const [dbLoans, setDbLoans] = useState<any[]>([]);
  const [pendingDisposals, setPendingDisposals] = useState<PendingDisposal[]>([]);

  // Reload the shared lists from the server
  const syncFromDb = async () => {
    setIsDbLoading(true);
    try {
      // Fetch live assets, transfers, reports, loans, and disposals from MySQL server endpoints
      try {
        const jsonAssets = await assetsApi.listAssets();
        if (jsonAssets.success && Array.isArray(jsonAssets.assets)) {
          setAssets(jsonAssets.assets);
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

      try {
        const jsonR = await inspectionsApi.listReportSummaries();
        if (jsonR.success && Array.isArray(jsonR.reports)) {
          setDbReports(jsonR.reports);
        }
      } catch (e) {}

      try {
        const jsonL = await loansApi.listLoans();
        if (jsonL.success && Array.isArray(jsonL.loans)) {
          setDbLoans(jsonL.loans);
        }
      } catch (e) {}

      try {
        const jsonD: any = await disposalsApi.listDisposals();
        if (jsonD.success && Array.isArray(jsonD.disposals)) {
          setPendingDisposals(jsonD.disposals.filter((d: any) => d.status === "Pending").map((d: any) => ({
            id: String(d.id || d.disposalId),
            disposalId: d.disposalId,
            assetId: d.assetId || `EQ-2024-${String(d.asset_id || 0).padStart(3, "0")}`,
            assetName: d.assetName || "Asset Scheduled for Decommissioning",
            requestedBy: d.requestedBy || "ITS/TSG Staff",
            requestedAt: d.requestedAt || new Date().toISOString(),
            reason: d.reason || d.disposal_reason || "Obsolescence",
          })));
        }
      } catch (e) {}

      // Sync Repairs directly from MySQL database API
      try {
        const data = await repairsApi.listRepairs();
        if (data.success && Array.isArray(data.repairs)) {
          setRepairRequests(data.repairs);
        }
      } catch (e) {
        console.error("Failed to sync repairs from database API:", e);
      }

      reloadFromStorage();
    } finally {
      setIsDbLoading(false);
    }
  };

  // Sync on mount
  useEffect(() => {
    syncFromDb();
  }, []);

  const addRepairRequest = async (req: RepairRequest) => {
    try {
      await repairsApi.requestRepairRaw(req.assetId, {
        reportedBy: req.custodian,
        description: req.description,
        isImmediate: req.priority === "Critical" || req.statusLabel === "Disposal Recommendation",
      });
    } catch (e) {
      console.error("Failed to post repair request to DB API:", e);
    }
    await syncFromDb();
  };

  const acknowledgeRepair = async (id: string) => {
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

  useEffect(() => {
    authApi.listPendingRegistrations()
      .then(data => {
        if (data.success && Array.isArray(data.pendingRegistrations)) {
          setPendingRegistrations(data.pendingRegistrations);
        }
      })
      .catch(() => { });
  }, []);

  const addPendingRegistration = (req: PendingRegistration) => {
    setPendingRegistrations(prev => [req, ...prev]);
  };

  const approveRegistration = async (reqOrId: string | PendingRegistration) => {
    const id = typeof reqOrId === "string" ? reqOrId : reqOrId.id;
    const targetObj = typeof reqOrId === "string" ? pendingRegistrations.find(r => r.id === reqOrId) : reqOrId;
    const payload = targetObj ? { requestId: targetObj.id, ...targetObj } : { requestId: id };

    try {
      const data: any = await authApi.approveRegistration(payload);
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

  const rejectRegistration = async (requestId: string) => {
    try {
      await authApi.rejectRegistrationRaw(requestId);
    } catch (err) {
      console.error("Reject registration error:", err);
    } finally {
      setPendingRegistrations(prev => prev.filter(r => r.id !== requestId));
    }
  };

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
        assets,
        repairRequests, addRepairRequest, acknowledgeRepair, updateRepairStatus,
        unacknowledgedCount,
        pendingDisposals,
        pendingRegistrations, addPendingRegistration, approveRegistration, rejectRegistration,
        dbTransfers, dbReports, dbLoans,
        isDbLoading,
        syncFromDb, authorizeLoan
      }}
    >
      {children}
    </ServerDataContext.Provider>
  );
}

export function useServerData() {
  const ctx = useContext(ServerDataContext);
  if (!ctx) throw new Error("useServerData must be used inside ServerDataProvider");
  return ctx;
}
