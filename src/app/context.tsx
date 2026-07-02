import { createContext, useContext, useState, useEffect } from "react";
import { prisma } from "./prismaClient";

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

export type Role = "ITS" | "TSG" | "LabHead" | "Custodian";

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
  updateTransferRequest: (id: string, status: "Approved" | "Declined") => void;
  returns: ReturnRequest[];
  addReturnRequest: (req: ReturnRequest) => void;
  finalizeReturn: (id: string, assetId: string, condition: string, checklist: string[], notes: string, clearanceIssued: boolean) => void;
  inspections: InspectionReport[];
  addInspectionReport: (report: InspectionReport) => void;
}

const AppContext = createContext<AppContextType | null>(null);

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

  // Sync state from simulated database (Prisma client)
  const syncFromDb = async () => {
    const dbAssets = await prisma.asset.findMany();
    const dbUsers = await prisma.user.findMany();
    const dbCenters = await prisma.researchCenter.findMany();
    const dbDisposals = await prisma.assetDisposal.findMany();
    const dbMonetaries = await prisma.assetMonetary.findMany();

    const mappedAssets = dbAssets.map(a => {
      const custodianUser = a.custodianId ? dbUsers.find(u => u.userId === a.custodianId) : null;
      const center = dbCenters.find(c => c.centerId === a.centerId);
      const disposal = dbDisposals.find(d => d.assetId === a.assetId);
      const disposerUser = disposal ? dbUsers.find(u => u.userId === disposal.disposedById) : null;
      const monetary = dbMonetaries.find(m => m.assetId === a.assetId);

      let daysLeft: number | undefined = undefined;
      if (a.dueDate) {
        const due = new Date(a.dueDate);
        const today = new Date();
        const diffTime = due.getTime() - today.getTime();
        daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      let disposalDetails: DisposalDetails | undefined = undefined;
      if (disposal) {
        disposalDetails = {
          lastCustodian: custodianUser ? `${custodianUser.firstName} ${custodianUser.lastName}` : "No Custodian",
          breakdownReasons: disposal.disposalReason,
          disposalPathway: disposal.pathway,
          decommissionDate: new Date(disposal.disposalDate).toLocaleDateString(),
          decommissionedBy: disposerUser ? `${disposerUser.firstName} ${disposerUser.lastName}` : "Admin"
        };
      }

      return {
        id: `EQ-2024-${String(a.assetId).padStart(3, "0")}`,
        name: a.assetName,
        serial: a.serial,
        manufacturer: a.manufacturer,
        category: a.assetType,
        funding: a.funding,
        procured: a.procured,
        warranty: a.warranty,
        location: center?.campusLocation === "MANILA_CAMPUS" ? "Manila" : "Laguna",
        lab: center?.centerName ?? "CITe4D",
        status: a.status,
        condition: a.condition,
        custodian: custodianUser ? `${custodianUser.firstName} ${custodianUser.lastName}` : undefined,
        borrowedOn: a.borrowedOn,
        dueDate: a.dueDate,
        daysLeft,
        disposalId: disposal ? `DISP-${disposal.disposalId}` : undefined,
        disposalDetails,
        cost: monetary ? Number(monetary.acquisitionValue) : 0
      };
    });
    setAssets(mappedAssets);

    // Sync Transfers
    const dbTransfers = await prisma.custodianshipTransfer.findMany();
    const mappedTransfers = dbTransfers.map(t => {
      const fromUser = dbUsers.find(u => u.userId === t.previousCustodianId);
      const toUser = dbUsers.find(u => u.userId === t.newCustodianId);
      const asset = dbAssets.find(a => a.assetId === t.assetId);

      return {
        id: t.uiId,
        asset: asset?.assetName ?? "Unknown Asset",
        assetId: `EQ-2024-${String(t.assetId).padStart(3, "0")}`,
        from: fromUser ? `${fromUser.firstName} ${fromUser.lastName}` : "Unknown",
        fromRole: fromUser?.userType === "FACULTY" ? "Faculty" : "Student",
        to: toUser ? `${toUser.firstName} ${toUser.lastName}` : "Unknown",
        toRole: toUser?.userType === "FACULTY" ? "Faculty" : "Student",
        lab: t.lab,
        initiated: t.transferDate,
        status: t.approvalStatus === "PENDING" ? "Pending" : t.approvalStatus === "APPROVED" ? "Approved" : "Declined"
      };
    }) as TransferRequest[];
    setTransfers(mappedTransfers);

    // Sync Repairs
    const dbRepairs = await prisma.assetRepair.findMany();
    const mappedRepairs = dbRepairs.map(r => {
      const user = dbUsers.find(u => u.userId === r.reportedById);
      const asset = dbAssets.find(a => a.assetId === r.assetId);
      return {
        id: r.uiId,
        assetId: `EQ-2024-${String(r.assetId).padStart(3, "0")}`,
        assetName: asset?.assetName ?? "Unknown Asset",
        custodian: user ? `${user.firstName} ${user.lastName}` : "Unassigned",
        statusLabel: r.repairStatus === "COMPLETED" ? "Fixed & Completed" : r.repairStatus === "IN_PROGRESS" ? "In Progress" : "Under Maintenance",
        description: r.issueDescription,
        submittedAt: r.startDate,
        priority: r.priority,
        acknowledged: r.acknowledged,
        forwardedTo: r.forwardedTo
      };
    }) as RepairRequest[];
    setRepairRequests(mappedRepairs);

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
            if (roles.some(ur => ur.role?.roleName === "ADMIN" || ur.role?.roleName === "ADRIC_DIRECTOR" || ur.role?.roleName === "ADRIC_SECRETARY")) {
              determinedRole = "ITS";
            } else if (roles.some(ur => ur.role?.roleName === "TSG_STAFF")) {
              determinedRole = "TSG";
            } else if (roles.some(ur => ur.role?.roleName === "LAB_HEAD")) {
              determinedRole = "LabHead";
            }
            setRoleState(determinedRole);
          } else {
            setRoleState(null);
          }
        });
      }
    }
  }, []);

  const setRole = (newRole: Role | null) => {
    setRoleState(newRole);
    if (newRole === null) {
      eraseCookie("session_user_email");
      eraseCookie("session_last_activity");
      eraseCookie("session_created");
    } else {
      // Whenever a role session is explicitly set, update the activity timer
      setCookie("session_last_activity", String(Date.now()), 1);
    }
  };

  const setCycleMode = (mode: "Annual" | "Trimestral") => {
    setCycleModeState(mode);
    setCookie("pref_cycle_mode", mode, 365);
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
    const assetId = parseInt(req.assetId.split("-").pop() || "0", 10);
    const dbUsers = await prisma.user.findMany();
    const reporterUser = dbUsers.find(u => `${u.firstName} ${u.lastName}`.toLowerCase() === req.custodian.toLowerCase());

    await prisma.assetRepair.create({
      data: {
        assetId,
        reportedById: reporterUser?.userId || 4,
        issueDescription: req.description,
        startDate: req.submittedAt,
        repairStatus: req.statusLabel === "Fixed & Completed" ? "COMPLETED" : "REPORTED",
        uiId: req.id,
        priority: req.priority,
        acknowledged: req.acknowledged,
        forwardedTo: req.forwardedTo
      }
    });

    if (req.statusLabel !== "Disposal Recommendation") {
      await prisma.asset.update({
        where: { assetId },
        data: { status: "Maintenance" }
      });
    }

    await syncFromDb();
  };

  const acknowledgeRepair = async (id: string) => {
    const dbRepairs = await prisma.assetRepair.findMany();
    const match = dbRepairs.find(r => r.uiId === id);
    if (match) {
      await prisma.assetRepair.update({
        where: { repairId: match.repairId },
        data: { acknowledged: true }
      });
    }
    await syncFromDb();
  };

  const updateRepairStatus = async (id: string, statusLabel: string) => {
    const dbRepairs = await prisma.assetRepair.findMany();
    const match = dbRepairs.find(r => r.uiId === id);
    if (match) {
      const statusMapped = statusLabel === "Fixed & Completed" ? "COMPLETED" : "IN_PROGRESS";
      await prisma.assetRepair.update({
        where: { repairId: match.repairId },
        data: {
          repairStatus: statusMapped,
          completionDate: statusLabel === "Fixed & Completed" ? new Date().toISOString() : undefined
        }
      });

      if (statusLabel === "Fixed & Completed") {
        const asset = await prisma.asset.findUnique({ where: { assetId: match.assetId } });
        if (asset) {
          await prisma.asset.update({
            where: { assetId: match.assetId },
            data: {
              status: asset.custodianId ? "On Loan" : "Active"
            }
          });
        }
      } else {
        await prisma.asset.update({
          where: { assetId: match.assetId },
          data: { status: "Maintenance" }
        });
      }
    }
    await syncFromDb();
  };

  const unacknowledgedCount = repairRequests.filter(r => !r.acknowledged).length;

  const addAsset = async (asset: Omit<Asset, "id">) => {
    await prisma.asset.create({
      data: {
        qrCodeHash: `hash-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        assetName: asset.name,
        assetType: asset.category as any,
        centerId: asset.lab === "CAR" ? 2 : asset.lab === "CeHCI" ? 3 : asset.lab === "HXIL" ? 4 : asset.lab === "GAME" ? 5 : asset.lab === "CeLT" ? 6 : asset.lab === "Bio" ? 7 : 1,
        serial: asset.serial,
        manufacturer: asset.manufacturer,
        funding: asset.funding,
        procured: asset.procured,
        warranty: asset.warranty,
        condition: asset.condition,
        status: asset.status
      }
    });
    await syncFromDb();
  };

  const removeAsset = async (id: string) => {
    const assetId = parseInt(id.split("-").pop() || "0", 10);
    await prisma.asset.delete({ where: { assetId } });
    await syncFromDb();
  };

  const updateAsset = async (updated: Asset) => {
    const assetId = parseInt(updated.id.split("-").pop() || "0", 10);
    await prisma.asset.update({
      where: { assetId },
      data: {
        assetName: updated.name,
        serial: updated.serial,
        manufacturer: updated.manufacturer,
        funding: updated.funding,
        procured: updated.procured,
        warranty: updated.warranty,
        condition: updated.condition,
        status: updated.status,
        borrowedOn: updated.borrowedOn,
        dueDate: updated.dueDate
      }
    });
    await syncFromDb();
  };

  const disposeAsset = async (assetIdStr: string, details: Omit<DisposalDetails, "decommissionedBy">, activeRole: string) => {
    const assetId = parseInt(assetIdStr.split("-").pop() || "0", 10);
    const sessionEmail = getCookie("session_user_email") || "";
    const user = await prisma.user.findFirst({ where: { email: sessionEmail } });
    const userId = user?.userId || 1;

    await prisma.assetDisposal.create({
      data: {
        assetId,
        disposedById: userId,
        disposalDate: new Date().toISOString(),
        disposalReason: details.breakdownReasons,
        pathway: details.disposalPathway
      }
    });

    await prisma.asset.update({
      where: { assetId },
      data: { status: "Disposed" }
    });

    await syncFromDb();
  };

  const addTransferRequest = async (req: TransferRequest) => {
    const assetId = parseInt(req.assetId.split("-").pop() || "0", 10);
    const dbUsers = await prisma.user.findMany();
    const fromUser = dbUsers.find(u => `${u.firstName} ${u.lastName}`.toLowerCase() === req.from.toLowerCase());
    const toUser = dbUsers.find(u => `${u.firstName} ${u.lastName}`.toLowerCase() === req.to.toLowerCase());

    await prisma.custodianshipTransfer.create({
      data: {
        assetId,
        previousCustodianId: fromUser?.userId || 4,
        newCustodianId: toUser?.userId || 3,
        transferDate: req.initiated,
        approvalStatus: "PENDING",
        uiId: req.id,
        lab: req.lab
      }
    });

    await syncFromDb();
  };

  const updateTransferRequest = async (id: string, status: "Approved" | "Declined") => {
    const dbTransfers = await prisma.custodianshipTransfer.findMany();
    const tx = dbTransfers.find(t => t.uiId === id);
    if (tx) {
      await prisma.custodianshipTransfer.update({
        where: { transferId: tx.transferId },
        data: { approvalStatus: status === "Approved" ? "APPROVED" : "REJECTED" }
      });

      if (status === "Approved") {
        await prisma.asset.update({
          where: { assetId: tx.assetId },
          data: {
            custodianId: tx.newCustodianId,
            status: "On Loan"
          }
        });
      }
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
    const certId = clearanceIssued ? `CLR-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : undefined;

    setReturns(prev => {
      const next = prev.map(r =>
        r.id === id
          ? { ...r, status: "Finalized", condition, checklist, notes, clearanceIssued, certId }
          : r
      );
      localStorage.setItem("ems_returns", JSON.stringify(next));
      return next;
    });

    const assetId = parseInt(assetIdStr.split("-").pop() || "0", 10);
    const newCondition = condition === "Pristine" ? 100 : condition === "Operational" ? 90 : condition === "Degraded" ? 60 : 20;

    await prisma.asset.update({
      where: { assetId },
      data: {
        status: "Active",
        custodianId: undefined,
        condition: newCondition
      }
    });

    await syncFromDb();
  };

  const addInspectionReport = async (report: InspectionReport) => {
    setInspections(prev => {
      const next = [report, ...prev];
      localStorage.setItem("ems_inspections", JSON.stringify(next));
      return next;
    });

    const assetId = parseInt(report.assetId.split("-").pop() || "0", 10);
    const conditionMap: Record<string, number> = {
      "Perfect": 100,
      "Operational": 90,
      "Minor Drift": 78,
      "Degraded Performance": 60,
      "Critical Failure": 35,
    };
    const newCondition = conditionMap[report.status];
    if (newCondition !== undefined) {
      await prisma.asset.update({
        where: { assetId },
        data: { condition: newCondition }
      });
    }

    await syncFromDb();
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
        transfers, addTransferRequest, updateTransferRequest,
        returns, addReturnRequest, finalizeReturn,
        inspections, addInspectionReport
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
};

export const roleDefaultPath: Record<Role, string> = {
  ITS: "/its/overview",
  TSG: "/tsg/repairs",
  LabHead: "/lab-head/custody",
  Custodian: "/custodian/myassets",
};
