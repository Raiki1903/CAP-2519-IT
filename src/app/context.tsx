import { createContext, useContext, useState, useEffect } from "react";
import { prisma, type User, type InspectionSchedule, type MaintenanceQueueItem } from "./prismaClient";
import { api } from "./api";

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

export type Role = "ITS" | "TSG" | "LabHead" | "Custodian" | "AdRICDirector";

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
  // Internal: present only for tickets backed by the real asset_repairs table —
  // needed to target PUT /api/asset_repairs/:repairId. Absent for local-only
  // "Disposal Recommendation" tickets, which the backend has no route for.
  repairId?: number;
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
  procured: string;
  warranty: string;
  location: string;
  lab: string;
  status: string; // "Active", "On Loan", "Maintenance", "Reserved", "Partially Deployed", "Available", "Pending Return", "Overdue", "Disposed"
  condition: number;
  custodian?: string;
  borrowedOn?: string;
  dueDate?: string;
  daysLeft?: number;
  disposalId?: string;
  disposalDetails?: DisposalDetails;
  cost?: number;
  itsPropertyTag?: string;
  tsgPropertyTag?: string;
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

export interface TransferRequest {
  id: string;
  asset: string; // asset name
  assetId: string;
  from: string;
  fromRole: string;
  to: string;
  toRole: string;
  lab: string;
  initiated: string;
  status: "Pending" | "Approved" | "Declined";
  reason?: string; // justification, required by the real transfer endpoint
  // Internal: which backend resource this row actually maps to, and its numeric
  // id — asset_loans and asset_transfers are separate tables/endpoints server-side,
  // but the UI shows them merged in one "custody handshake" list.
  kind?: "loan" | "transfer";
  loanId?: number;
  transferId?: number;
}

export interface LoanRequestInput {
  id: string;
  asset: string;
  assetId: string;
  borrower: string;
  purpose: string;
  dueDate: string;
  lab: string;
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

interface AssetOverride {
  status: string;
  disposalId?: string;
  disposalDetails?: DisposalDetails;
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
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;
  updateAsset: (asset: Asset) => void;
  disposeAsset: (assetId: string, details: Omit<DisposalDetails, "decommissionedBy">, role: string) => void;
  transfers: TransferRequest[];
  addTransferRequest: (req: TransferRequest) => void;
  addLoanRequest: (req: LoanRequestInput) => void;
  updateTransferRequest: (id: string, status: "Approved" | "Declined") => void;
  returns: ReturnRequest[];
  addReturnRequest: (req: ReturnRequest) => void;
  finalizeReturn: (id: string, assetId: string, condition: string, checklist: string[], notes: string, clearanceIssued: boolean) => void;
  inspections: InspectionReport[];
  addInspectionReport: (report: InspectionReport) => void;
  pendingDisposals: PendingDisposal[];
  approveDisposal: (id: string) => void;
  rejectDisposal: (id: string) => void;
  manualClearanceHolds: AffiliateClearance[];
  toggleClearanceHold: (userId: number, holdStatus: "Hold Active" | "Cleared", notes?: string) => void;
  currentUser: User | null;
  updateProfile: (firstName: string, lastName: string, profilePicture: string) => Promise<void>;
  inspectionSchedules: InspectionSchedule[];
  addInspectionSchedule: (groupId: string, date: string, cycleType: "Annual" | "Trimestral") => void;
  maintenanceQueue: MaintenanceQueueItem[];
  resolveMaintenanceItem: (id: string, presetStatus: string, remarks: string) => void;
  resetInspectionCycle: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

// Tickets other than these two just-reported statuses count as "acknowledged" —
// mirrors the convention server/server.ts's PUT /api/asset_repairs/:id documents.
const UNACKNOWLEDGED_STATUSES = ["Pending TSG Review", "Awaiting Immediate Dispatch"];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);

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
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [inspections, setInspections] = useState<InspectionReport[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inspectionSchedules, setInspectionSchedules] = useState<InspectionSchedule[]>([]);
  const [maintenanceQueue, setMaintenanceQueue] = useState<MaintenanceQueueItem[]>([]);
  const [pendingDisposals, setPendingDisposals] = useState<PendingDisposal[]>(() => {
    const saved = localStorage.getItem("ems_pending_disposals");
    return saved ? JSON.parse(saved) : [];
  });
  const [manualClearanceHolds, setManualClearanceHolds] = useState<AffiliateClearance[]>(() => {
    const saved = localStorage.getItem("ems_manual_clearance_holds");
    return saved ? JSON.parse(saved) : [];
  });

  // Disposal has no backend route at all (asset_disposals is a schema-only table) —
  // these overrides let the real backend's asset list stay the source of truth for
  // everything else while disposal state is tracked entirely client-side.
  const [assetOverrides, setAssetOverrides] = useState<Record<string, AssetOverride>>(() => {
    const saved = localStorage.getItem("ems_asset_overrides");
    return saved ? JSON.parse(saved) : {};
  });

  // "Disposal Recommendation" tickets (from RepairForm's disposal path) have no
  // backend equivalent either — kept local and merged alongside the real
  // asset_repairs-backed tickets in `repairRequests`.
  const [localRepairTickets, setLocalRepairTickets] = useState<RepairRequest[]>(() => {
    const saved = localStorage.getItem("ems_local_repair_tickets");
    return saved ? JSON.parse(saved) : [];
  });

  const applyAssetOverride = (assetId: string, override: AssetOverride | null) => {
    setAssetOverrides(prev => {
      const next = { ...prev };
      if (override) next[assetId] = override;
      else delete next[assetId];
      localStorage.setItem("ems_asset_overrides", JSON.stringify(next));
      return next;
    });
    setAssets(prev => prev.map(a => {
      if (a.id !== assetId) return a;
      if (override) return { ...a, status: override.status, disposalId: override.disposalId, disposalDetails: override.disposalDetails };
      const { disposalId, disposalDetails, ...rest } = a;
      return rest as Asset;
    }));
  };

  // Sync state from the real backend (assets/repairs/loans/transfers) plus the
  // local-only mock (users/roles) and localStorage (returns/inspections/disposal).
  const syncFromDb = async () => {
    const dbSchedules = await prisma.inspectionSchedule.findMany();
    setInspectionSchedules(dbSchedules);
    const dbQueue = await prisma.maintenanceQueue.findMany();
    setMaintenanceQueue(dbQueue);

    // Assets
    const assetsRes = await api.getAssets();
    const mappedAssets: Asset[] = assetsRes.assets.map(a => {
      const override = assetOverrides[a.id];
      return {
        id: a.id,
        name: a.name,
        serial: a.serial,
        manufacturer: a.manufacturer,
        category: a.category,
        funding: a.funding,
        procured: a.procured,
        warranty: a.warranty,
        location: a.location,
        lab: a.lab,
        status: override?.status ?? a.status,
        condition: a.condition,
        custodian: a.custodian,
        borrowedOn: a.borrowedOn,
        dueDate: a.dueDate,
        daysLeft: a.daysLeft,
        cost: a.cost,
        disposalId: override?.disposalId,
        disposalDetails: override?.disposalDetails,
      };
    });
    setAssets(mappedAssets);

    // Repairs
    const repairsRes = await api.getRepairs();
    const mappedRepairs: RepairRequest[] = repairsRes.repairs.map(r => ({
      id: r.id,
      repairId: r.repairId,
      assetId: r.assetId,
      assetName: r.asset,
      custodian: r.reportedBy,
      statusLabel: r.progressStatus,
      description: r.description,
      submittedAt: new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      priority: r.isImmediate ? "Critical" : "Medium",
      acknowledged: !UNACKNOWLEDGED_STATUSES.includes(r.progressStatus),
      forwardedTo: undefined,
    }));
    setRepairRequests([...mappedRepairs, ...localRepairTickets]);

    // Loans + Transfers — two separate backend resources, merged into one
    // "custody handshake" list the UI has always treated as a single concept.
    const [loansRes, transfersRes] = await Promise.all([api.getLoans(), api.getTransfers()]);
    const mappedLoans: TransferRequest[] = loansRes.loans.map(l => ({
      id: l.id,
      loanId: l.loanId,
      kind: "loan",
      asset: l.asset,
      assetId: l.assetId,
      from: "Inventory Storage",
      fromRole: "System Registry",
      to: l.borrower,
      toRole: "Active Custodian",
      lab: l.lab,
      initiated: l.requestedOn,
      status: l.status,
    }));
    const mappedTransfers: TransferRequest[] = transfersRes.transfers.map(t => ({
      id: t.id,
      transferId: t.transferId,
      kind: "transfer",
      asset: t.asset,
      assetId: t.assetId,
      from: t.from,
      fromRole: "Active Custodian",
      to: t.to,
      toRole: "Researcher",
      lab: t.lab,
      initiated: t.requestedOn,
      status: t.status,
    }));
    setTransfers([...mappedLoans, ...mappedTransfers]);

    // Sync Returns from local storage
    const savedReturns = localStorage.getItem("ems_returns");
    if (savedReturns) setReturns(JSON.parse(savedReturns));

    // Sync and seed Inspections in local storage
    let savedInspections = localStorage.getItem("ems_inspections");
    if (!savedInspections || JSON.parse(savedInspections).length === 0) {
      const defaultInspections = [
        { id: "INSP-001", assetId: "EQ-2024-004", assetName: "Boston Dynamics Spot Robot", custodian: "Felix Torres", status: "Degraded Performance", description: "Battery capacity decaying under stress load.", images: [], submittedAt: "2026-03-10T10:00:00Z", cycleType: "Trimestral" },
        { id: "INSP-002", assetId: "EQ-2024-004", assetName: "Boston Dynamics Spot Robot", custodian: "Felix Torres", status: "Operational", description: "Calibration run successful, minor drift.", images: [], submittedAt: "2026-05-15T14:30:00Z", cycleType: "Trimestral" },
        { id: "INSP-003", assetId: "EQ-2024-004", assetName: "Boston Dynamics Spot Robot", custodian: "Felix Torres", status: "Critical Failure", description: "Leg servo motor failure.", images: [], submittedAt: "2026-07-01T09:00:00Z", cycleType: "Trimestral" },
        { id: "INSP-004", assetId: "EQ-2024-001", assetName: "Dell PowerEdge R740 Server", custodian: "Dr. Santos", status: "Perfect", description: "Storage sectors nominal.", images: [], submittedAt: "2026-02-20T11:00:00Z", cycleType: "Trimestral" },
        { id: "INSP-005", assetId: "EQ-2024-001", assetName: "Dell PowerEdge R740 Server", custodian: "Dr. Santos", status: "Operational", description: "Operating under stable loads.", images: [], submittedAt: "2026-06-25T16:00:00Z", cycleType: "Trimestral" },
        { id: "INSP-006", assetId: "EQ-2024-003", assetName: "UR10e Collaborative Robot", custodian: "J. Sy", status: "Perfect", description: "Joint torque metrics within standard threshold.", images: [], submittedAt: "2026-04-10T12:00:00Z", cycleType: "Trimestral" },
        { id: "INSP-007", assetId: "EQ-2024-003", assetName: "UR10e Collaborative Robot", custodian: "J. Sy", status: "Operational", description: "Routine health check passed.", images: [], submittedAt: "2026-06-28T14:00:00Z", cycleType: "Trimestral" }
      ];
      localStorage.setItem("ems_inspections", JSON.stringify(defaultInspections));
      savedInspections = JSON.stringify(defaultInspections);
    }
    setInspections(JSON.parse(savedInspections));
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

        prisma.user.findFirst({
          where: { email: sessionEmail },
          include: { userRoles: { include: { role: true } } }
        }).then(user => {
          if (user) {
            const roles = user.userRoles || [];
            let determinedRole: Role = "Custodian";
            if (roles.some((ur: any) => ur.role?.roleName === "ADMIN" || ur.role?.roleName === "ADRIC_SECRETARY")) {
              determinedRole = "ITS";
            } else if (roles.some((ur: any) => ur.role?.roleName === "ADRIC_DIRECTOR")) {
              determinedRole = "AdRICDirector";
            } else if (roles.some((ur: any) => ur.role?.roleName === "TSG_STAFF")) {
              determinedRole = "TSG";
            } else if (roles.some((ur: any) => ur.role?.roleName === "LAB_HEAD")) {
              determinedRole = "LabHead";
            }
            setRoleState(determinedRole);
            setCurrentUser(user as any);
          } else {
            setRoleState(null);
            setCurrentUser(null);
          }
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
      // Whenever a role session is explicitly set, update the activity timer
      setCookie("session_last_activity", String(Date.now()), 1);
      const email = getCookie("session_user_email");
      if (email) {
        prisma.user.findFirst({
          where: { email }
        }).then(u => {
          if (u) setCurrentUser(u as any);
        });
      }
    }
  };

  const updateProfile = async (firstName: string, lastName: string, profilePicture: string) => {
    if (!currentUser) return;
    const updated = await prisma.user.update({
      where: { userId: currentUser.userId },
      data: {
        firstName,
        lastName,
        profilePicture
      }
    });
    if (updated) {
      setCurrentUser(updated as any);
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
    if (req.statusLabel === "Disposal Recommendation") {
      // No backend route covers this — RepairForm's "disposal recommendation"
      // sub-flow stays a local-only ticket that just surfaces in the repair queue.
      setLocalRepairTickets(prev => {
        const next = [req, ...prev];
        localStorage.setItem("ems_local_repair_tickets", JSON.stringify(next));
        return next;
      });
      setRepairRequests(prev => [req, ...prev]);
      return;
    }

    await api.reportRepair(req.assetId, {
      description: req.description,
      isImmediate: false,
      reportedBy: req.custodian,
    });
    await syncFromDb();
  };

  const acknowledgeRepair = async (id: string) => {
    const match = repairRequests.find(r => r.id === id);
    if (!match) return;

    if (match.repairId != null) {
      // No distinct "acknowledged" column server-side — moving the ticket into
      // "Inspection Phase" is what the backend treats as acknowledgement (see
      // server/server.ts's PUT /api/asset_repairs/:id comment).
      await api.updateRepairStatus(match.repairId, "Inspection Phase");
      await syncFromDb();
    } else {
      setLocalRepairTickets(prev => {
        const next = prev.map(r => r.id === id ? { ...r, acknowledged: true } : r);
        localStorage.setItem("ems_local_repair_tickets", JSON.stringify(next));
        return next;
      });
      setRepairRequests(prev => prev.map(r => r.id === id ? { ...r, acknowledged: true } : r));
    }
  };

  const updateRepairStatus = async (id: string, statusLabel: string) => {
    const match = repairRequests.find(r => r.id === id);
    if (!match) return;

    if (match.repairId != null) {
      await api.updateRepairStatus(match.repairId, statusLabel);
      await syncFromDb();
    } else {
      setLocalRepairTickets(prev => {
        const next = prev.map(r => r.id === id ? { ...r, statusLabel } : r);
        localStorage.setItem("ems_local_repair_tickets", JSON.stringify(next));
        return next;
      });
      setRepairRequests(prev => prev.map(r => r.id === id ? { ...r, statusLabel } : r));
    }
  };

  const unacknowledgedCount = repairRequests.filter(r => !r.acknowledged).length;

  const addAsset = async (asset: Omit<Asset, "id">) => {
    await api.createAsset({
      name: asset.name,
      category: asset.category,
      serial: asset.serial,
      manufacturer: asset.manufacturer,
      procured: asset.procured,
      warranty: asset.warranty,
      funding: asset.funding,
      location: asset.location,
      lab: asset.lab,
    });
    await syncFromDb();
  };

  const removeAsset = async (id: string) => {
    await api.deleteAsset(id);
    await syncFromDb();
  };

  const updateAsset = async (updated: Asset) => {
    await api.updateAsset(updated.id, {
      name: updated.name,
      serial: updated.serial,
      manufacturer: updated.manufacturer,
      category: updated.category,
      funding: updated.funding,
      procured: updated.procured,
      warranty: updated.warranty,
      location: updated.location,
      lab: updated.lab,
      status: updated.status,
      custodian: updated.custodian,
    });
    await syncFromDb();
  };

  const disposeAsset = (assetIdStr: string, details: Omit<DisposalDetails, "decommissionedBy">, activeRole: string) => {
    const decommissionedBy = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : (activeRole === "AdRICDirector" ? "AdRIC Director" : "ITS Admin");

    if (activeRole === "AdRICDirector") {
      applyAssetOverride(assetIdStr, {
        status: "Disposed",
        disposalId: `DISP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        disposalDetails: { ...details, decommissionedBy },
      });
    } else {
      const matchedAsset = assets.find(a => a.id === assetIdStr);
      const newPending: PendingDisposal = {
        id: `PDISP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        assetId: assetIdStr,
        assetName: matchedAsset?.name || "Unknown Asset",
        lastCustodian: details.lastCustodian,
        breakdownReasons: details.breakdownReasons,
        disposalPathway: details.disposalPathway,
        requestedBy: decommissionedBy,
        requestedAt: new Date().toISOString()
      };

      setPendingDisposals(prev => {
        const next = [newPending, ...prev];
        localStorage.setItem("ems_pending_disposals", JSON.stringify(next));
        return next;
      });

      applyAssetOverride(assetIdStr, { status: "Pending Disposal" });
    }
  };

  const approveDisposal = (id: string) => {
    const req = pendingDisposals.find(p => p.id === id);
    if (!req) return;

    const decommissionedBy = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "AdRIC Director";

    applyAssetOverride(req.assetId, {
      status: "Disposed",
      disposalId: `DISP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      disposalDetails: {
        lastCustodian: req.lastCustodian,
        breakdownReasons: req.breakdownReasons,
        disposalPathway: req.disposalPathway,
        decommissionDate: new Date().toLocaleDateString(),
        decommissionedBy,
      },
    });

    setPendingDisposals(prev => {
      const next = prev.filter(p => p.id !== id);
      localStorage.setItem("ems_pending_disposals", JSON.stringify(next));
      return next;
    });
  };

  const rejectDisposal = (id: string) => {
    const req = pendingDisposals.find(p => p.id === id);
    if (!req) return;

    // Clears the local override so the asset reverts to whatever the real
    // backend actually has on file — it was never touched by the pending flow.
    applyAssetOverride(req.assetId, null);

    setPendingDisposals(prev => {
      const next = prev.filter(p => p.id !== id);
      localStorage.setItem("ems_pending_disposals", JSON.stringify(next));
      return next;
    });
  };

  const toggleClearanceHold = (userId: number, holdStatus: "Hold Active" | "Cleared", notes?: string) => {
    setManualClearanceHolds(prev => {
      const existingIdx = prev.findIndex(h => h.userId === userId);
      let next = [...prev];
      if (existingIdx > -1) {
        next[existingIdx] = { ...next[existingIdx], holdStatus, notes };
      } else {
        prisma.user.findUnique({ where: { userId } }).then(u => {
          if (u) {
            const newHold: AffiliateClearance = {
              userId,
              name: `${u.firstName} ${u.lastName}`,
              email: u.email,
              role: u.userType === "FACULTY" ? "Faculty" : "Student",
              holdStatus,
              notes
            };
            setManualClearanceHolds(p => {
              const n = [...p.filter(h => h.userId !== userId), newHold];
              localStorage.setItem("ems_manual_clearance_holds", JSON.stringify(n));
              return n;
            });
          }
        });
      }
      localStorage.setItem("ems_manual_clearance_holds", JSON.stringify(next));
      return next;
    });
  };

  const addTransferRequest = async (req: TransferRequest) => {
    await api.requestTransfer(req.assetId, { toCustodian: req.to, reason: req.reason || "" });
    await syncFromDb();
  };

  const addLoanRequest = async (req: LoanRequestInput) => {
    await api.borrowAsset(req.assetId, { borrower: req.borrower, purpose: req.purpose, dueDate: req.dueDate });
    await syncFromDb();
  };

  const updateTransferRequest = async (id: string, status: "Approved" | "Declined") => {
    const match = transfers.find(t => t.id === id);
    if (!match) return;

    const decision = status === "Approved" ? "approve" : "decline";
    if (match.kind === "loan" && match.loanId != null) {
      await api.decideLoan(match.loanId, decision);
    } else if (match.transferId != null) {
      await api.decideTransfer(match.transferId, decision);
    }
    await syncFromDb();
  };

  const addReturnRequest = (req: ReturnRequest) => {
    setReturns(prev => {
      const next = [req, ...prev];
      localStorage.setItem("ems_returns", JSON.stringify(next));
      return next;
    });
  };

  const finalizeReturn = async (id: string, assetIdStr: string, condition: string, checklist: string[], notes: string, clearanceIssued: boolean) => {
    const returnedBy = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined;
    const res: any = await api.finalizeReturn(assetIdStr, { condition, accessories: checklist, returnedBy });
    const certId = clearanceIssued ? (res?.return?.reference_number as string | undefined) : undefined;

    setReturns(prev => {
      const next = prev.map(r =>
        r.id === id
          ? { ...r, status: "Finalized" as const, condition, checklist, notes, clearanceIssued, certId }
          : r
      );
      localStorage.setItem("ems_returns", JSON.stringify(next));
      return next;
    });

    await syncFromDb();
  };

  const addInspectionReport = async (report: InspectionReport) => {
    setInspections(prev => {
      const next = [report, ...prev];
      localStorage.setItem("ems_inspections", JSON.stringify(next));
      return next;
    });
    // Note: the real backend hardcodes asset condition at 100 and exposes no
    // route to change it, so there's nothing to persist server-side here.
  };

  const addInspectionSchedule = async (groupId: string, date: string, cycleType: "Annual" | "Trimestral") => {
    await prisma.inspectionSchedule.create({
      data: {
        labGroupId: groupId,
        inspectionDate: date,
        cycleType,
        createdAt: new Date().toISOString()
      }
    });

    const dbQueue = await prisma.maintenanceQueue.findMany();
    for (const item of dbQueue) {
      if (item.labGroupId === groupId && item.status !== "Inspected") {
        await prisma.maintenanceQueue.update({
          where: { id: item.id },
          data: { status: "Scheduled" }
        });
      }
    }

    const updatedSchedules = await prisma.inspectionSchedule.findMany();
    setInspectionSchedules(updatedSchedules);
    const updatedQueue = await prisma.maintenanceQueue.findMany();
    setMaintenanceQueue(updatedQueue);
  };

  const resolveMaintenanceItem = async (id: string, presetStatus: string, remarks: string) => {
    await prisma.maintenanceQueue.update({
      where: { id },
      data: { status: "Inspected" }
    });

    const dbQueue = await prisma.maintenanceQueue.findMany();
    const item = dbQueue.find(i => i.id === id);
    if (item) {
      const reportId = `RPT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await addInspectionReport({
        id: reportId,
        assetId: item.asset,
        assetName: item.asset,
        custodian: "A. Dela Cruz",
        status: presetStatus,
        description: remarks,
        images: [],
        submittedAt: new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' }),
        cycleType: cycleMode
      });
    }

    setMaintenanceQueue(dbQueue);
  };

  const resetInspectionCycle = async () => {
    await prisma.inspectionSchedule.deleteMany();

    const dbQueue = await prisma.maintenanceQueue.findMany();
    for (const item of dbQueue) {
      const defaultStatus = (item.urgency === "Critical" || item.urgency === "High") ? "Overdue" : "Due Soon";
      await prisma.maintenanceQueue.update({
        where: { id: item.id },
        data: { status: defaultStatus }
      });
    }

    setInspectionSchedules([]);
    const updatedQueue = await prisma.maintenanceQueue.findMany();
    setMaintenanceQueue(updatedQueue);
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

        assets, addAsset, removeAsset, updateAsset, disposeAsset,
        transfers, addTransferRequest, addLoanRequest, updateTransferRequest,
        returns, addReturnRequest, finalizeReturn,
        inspections, addInspectionReport,
        pendingDisposals, approveDisposal, rejectDisposal,
        manualClearanceHolds, toggleClearanceHold,
        currentUser, updateProfile,
        inspectionSchedules, addInspectionSchedule,
        maintenanceQueue, resolveMaintenanceItem,
        resetInspectionCycle
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
