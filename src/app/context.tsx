import { createContext, useContext, useState, useEffect } from "react";
import type { Role } from "@shared/enums/role";
import * as loansApi from "@web/api/loans.api";
import * as assetsApi from "@web/api/assets.api";
import * as transfersApi from "@web/api/transfers.api";
import * as repairsApi from "@web/api/repairs.api";
import * as disposalsApi from "@web/api/disposals.api";
import * as inspectionsApi from "@web/api/inspections.api";
import * as authApi from "@web/api/auth.api";

// ── Cookie Helper Functions ────────────────────────────────────────────────
export function setCookie(name: string, value: string, days?: number) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/";
}

export function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

export function eraseCookie(name: string) {
  document.cookie = name + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
}

export interface SessionUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number;
  userType: string;
  profilePicture?: string;
  userImg?: string;
  avatarUrl?: string;
  labAffiliation?: string;
}

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

export function getDescriptiveCondition(score: number): string {
  if (score >= 95) return "Brand New";
  if (score >= 80) return "Used";
  if (score >= 65) return "Functional";
  if (score >= 50) return "Functional with Issues";
  return "Non-Functional / Repair Needed";
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

export interface ReturnRequest {
  id: string;
  assetId: string;
  assetName: string;
  custodian: string;
  returnDate: string;
  comments: string;
  status: "Pending" | "Finalized";
  condition?: string;
  checklist?: string[];
  notes?: string;
  clearanceIssued?: boolean;
  certId?: string;
}

export interface InspectionReport {
  id: string;
  assetId: string;
  assetName: string;
  custodian: string;
  status: string;
  description: string;
  images: string[];
  submittedAt: string;
  cycleType: "Trimestral" | "Annual";
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

export interface AffiliateClearance {
  userId: number;
  name: string;
  email: string;
  role: "Faculty" | "Student";
  holdStatus: "Hold Active" | "Cleared";
  notes?: string;
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

interface AppContextType {
  role: Role | null;
  setRole: (role: Role | null) => void;
  cycleMode: "Annual" | "Trimestral";
  setCycleMode: (mode: "Annual" | "Trimestral") => void;
  theme: "classic-dark" | "light-slate";
  setTheme: (t: "classic-dark" | "light-slate") => void;
  repairRequests: RepairRequest[];
  addRepairRequest: (req: RepairRequest) => void;
  acknowledgeRepair: (id: string) => void;
  updateRepairStatus: (id: string, statusLabel: string) => void;
  unacknowledgedCount: number;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;

  // Stateful Data Arrays
  assets: Asset[];
  returns: ReturnRequest[];
  addReturnRequest: (req: ReturnRequest) => void;
  finalizeReturn: (id: string, condition: string, checklist: string[], notes: string, clearanceIssued: boolean) => void;
  inspections: InspectionReport[];
  addInspectionReport: (report: InspectionReport) => void;
  pendingDisposals: PendingDisposal[];
  pendingRegistrations: PendingRegistration[];
  addPendingRegistration: (req: PendingRegistration) => void;
  approveRegistration: (requestId: string) => Promise<void>;
  rejectRegistration: (requestId: string) => Promise<void>;
  manualClearanceHolds: AffiliateClearance[];
  currentUser: SessionUser | null;
  updateProfile: (firstName: string, lastName: string, profilePicture: string) => Promise<void>;
  dbTransfers: any[];
  dbReports: any[];
  dbLoans: any[];
  isDbLoading: boolean;
  setIsDbLoading: (loading: boolean) => void;
  syncFromDb: () => Promise<void>;
  authorizeLoan: (loanId: string, decision?: "approve" | "decline") => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [isDbLoading, setIsDbLoading] = useState<boolean>(true);

  // Load preferences from cookies
  const [cycleMode, setCycleModeState] = useState<"Annual" | "Trimestral">(() => {
    const c = getCookie("pref_cycle_mode");
    return (c === "Annual" || c === "Trimestral") ? c : "Trimestral";
  });

  const [theme, setThemeState] = useState<"classic-dark" | "light-slate">(() => {
    const c = getCookie("pref_theme");
    return (c === "classic-dark" || c === "light-slate") ? c : "classic-dark";
  });

  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(() => {
    return getCookie("pref_sidebar_collapsed") === "true";
  });

  const [repairRequests, setRepairRequests] = useState<RepairRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [inspections, setInspections] = useState<InspectionReport[]>([]);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [dbTransfers, setDbTransfers] = useState<any[]>([]);
  const [dbReports, setDbReports] = useState<any[]>([]);
  const [dbLoans, setDbLoans] = useState<any[]>([]);
  const [pendingDisposals, setPendingDisposals] = useState<PendingDisposal[]>([]);
  const [manualClearanceHolds] = useState<AffiliateClearance[]>(() => {
    const saved = localStorage.getItem("ems_manual_clearance_holds");
    return saved ? JSON.parse(saved) : [];
  });

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

      // Sync Returns from local storage
      const savedReturns = localStorage.getItem("ems_returns");
      if (savedReturns) setReturns(JSON.parse(savedReturns));

      // Sync Inspections from local storage
      const savedInspections = localStorage.getItem("ems_inspections");
      if (savedInspections) setInspections(JSON.parse(savedInspections));
      else setInspections([]);
    } finally {
      setIsDbLoading(false);
    }
  };

  // Sync on mount
  useEffect(() => {
    syncFromDb();
  }, []);

  // Set up preferences color schema in class list
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "classic-dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Session activity verification & decay checks
  useEffect(() => {
    const sessionEmail = getCookie("session_user_email");
    const lastActivityStr = getCookie("session_last_activity");
    const sessionCreatedStr = getCookie("session_created");

    if (sessionEmail && lastActivityStr && sessionCreatedStr) {
      const now = Date.now();
      const lastActivity = parseInt(lastActivityStr, 10);
      const sessionCreated = parseInt(sessionCreatedStr, 10);

      const oneDayMs = 24 * 60 * 60 * 1000;
      const thirtyDaysMs = 30 * oneDayMs;

      if (now - lastActivity > oneDayMs) {
        // Session expired due to 24h inactivity
        setRoleState(null);
        eraseCookie("session_user_email");
        eraseCookie("session_last_activity");
        eraseCookie("session_created");
        alert("Session expired due to 24 hours of inactivity. Please log in again.");
      } else if (now - sessionCreated > thirtyDaysMs) {
        // Session expired due to 30 days max lifespan
        setRoleState(null);
        eraseCookie("session_user_email");
        eraseCookie("session_last_activity");
        eraseCookie("session_created");
        alert("Your session has reached its 30-day limit. Please log in again.");
      } else {
        // Session valid! Reset activity timer to now + 24 hours
        setCookie("session_last_activity", String(now), 1);

        // Session valid! Fetch live user from MySQL DB in Prisma Studio
        authApi.getMe(sessionEmail)
          .then(data => {
            if (data.success && data.user) {
              setRoleState(data.user.role as Role);
              const img = data.user.userImg || data.user.profilePicture || data.user.avatarUrl;
              setCurrentUser({
                ...data.user,
                profilePicture: img,
                userImg: img,
                avatarUrl: img
              } as any);
            } else {
              setRoleState(null);
              setCurrentUser(null);
            }
          })
          .catch(() => {
            setRoleState(null);
            setCurrentUser(null);
          });
      }
    }
  }, []);

  const setCycleMode = (mode: "Annual" | "Trimestral") => {
    setCycleModeState(mode);
    setCookie("pref_cycle_mode", mode, 365);
  };

  const setRole = (newRole: Role | null) => {
    setRoleState(newRole);
    if (newRole === null) {
      eraseCookie("session_user_email");
      eraseCookie("session_last_activity");
      eraseCookie("session_created");
      setCurrentUser(null);
    } else {
      setCookie("session_last_activity", String(Date.now()), 1);
      const email = getCookie("session_user_email");
      if (email) {
        authApi.getMe(email)
          .then(data => {
            if (data.success && data.user) {
              const img = data.user.userImg || data.user.profilePicture || data.user.avatarUrl;
              setCurrentUser({
                ...data.user,
                profilePicture: img,
                userImg: img,
                avatarUrl: img
              } as any);
            }
          })
          .catch(() => { });
      }
    }
  };

  const updateProfile = async (firstName: string, lastName: string, profilePicture: string, labAffiliation?: string) => {
    if (!currentUser) return;
    try {
      const data = await authApi.updateAccount({
        email: currentUser.email,
        firstName,
        lastName,
        avatarUrl: profilePicture,
        profilePicture,
        userImg: profilePicture,
        labAffiliation
      });
      if (data.success && data.user) {
        const savedImg = data.user.userImg || data.user.profilePicture || data.user.avatarUrl || profilePicture;
        setCurrentUser({
          ...currentUser,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          profilePicture: savedImg,
          userImg: savedImg,
          avatarUrl: savedImg,
          labAffiliation: data.user.labAffiliation
        } as any);
      }
    } catch (e) {
      console.error("Failed to update profile on server:", e);
    }
  };

  const setSidebarCollapsed = (v: boolean) => {
    setSidebarCollapsedState(v);
    setCookie("pref_sidebar_collapsed", String(v), 365);
  };

  const setTheme = (t: "classic-dark" | "light-slate") => {
    setThemeState(t);
    setCookie("pref_theme", t, 365);
  };

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

  const addReturnRequest = (req: ReturnRequest) => {
    setReturns(prev => {
      const next = [req, ...prev];
      localStorage.setItem("ems_returns", JSON.stringify(next));
      return next;
    });
  };

  const finalizeReturn = (id: string, condition: string, checklist: string[], notes: string, clearanceIssued: boolean) => {
    const certId = clearanceIssued ? `CLR-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : undefined;

    setReturns(prev => {
      const next = prev.map(r =>
        r.id === id
          ? { ...r, status: "Finalized" as const, condition, checklist, notes, clearanceIssued, certId }
          : r
      );
      localStorage.setItem("ems_returns", JSON.stringify(next));
      return next;
    });
  };

  const addInspectionReport = (report: InspectionReport) => {
    setInspections(prev => {
      const next = [report, ...prev];
      localStorage.setItem("ems_inspections", JSON.stringify(next));
      return next;
    });
  };

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
    <AppContext.Provider
      value={{
        role, setRole,
        cycleMode, setCycleMode,
        theme, setTheme,
        repairRequests, addRepairRequest, acknowledgeRepair, updateRepairStatus,
        unacknowledgedCount,
        sidebarCollapsed, setSidebarCollapsed,

        assets,
        returns, addReturnRequest, finalizeReturn,
        inspections, addInspectionReport,
        pendingDisposals,
        pendingRegistrations, addPendingRegistration, approveRegistration, rejectRegistration,
        manualClearanceHolds,
        currentUser, updateProfile,
        dbTransfers, dbReports, dbLoans,
        isDbLoading, setIsDbLoading,
        syncFromDb, authorizeLoan
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export const roleToSlug: Record<Role, string> = {
  ITS: "its",
  TSG: "tsg",
  LabHead: "lab-head",
  Custodian: "custodian",
  AdRICDirector: "adric-director",
};

export const roleDefaultPath: Record<Role, string> = {
  ITS: "/its/overview",
  TSG: "/tsg/repairs",
  LabHead: "/lab-head/custody",
  Custodian: "/custodian/myassets",
  AdRICDirector: "/adric-director/overview",
};
