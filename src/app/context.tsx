import { createContext, useContext, useState, useEffect } from "react";
import { prisma, type User, type InspectionSchedule, type MaintenanceQueueItem } from "./prismaClient";
import type { Role } from "@shared/enums/role";
import * as loansApi from "@web/api/loans.api";
import * as assetsApi from "@web/api/assets.api";
import * as transfersApi from "@web/api/transfers.api";
import * as repairsApi from "@web/api/repairs.api";
import * as disposalsApi from "@web/api/disposals.api";
import * as inspectionsApi from "@web/api/inspections.api";

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
  pendingDisposals: PendingDisposal[];
  approveDisposal: (id: string) => void;
  rejectDisposal: (id: string) => void;
  pendingRegistrations: PendingRegistration[];
  addPendingRegistration: (req: PendingRegistration) => void;
  approveRegistration: (requestId: string) => Promise<void>;
  rejectRegistration: (requestId: string) => Promise<void>;
  manualClearanceHolds: AffiliateClearance[];
  toggleClearanceHold: (userId: number, holdStatus: "Hold Active" | "Cleared", notes?: string) => void;
  currentUser: User | null;
  updateProfile: (firstName: string, lastName: string, profilePicture: string) => Promise<void>;
  inspectionSchedules: InspectionSchedule[];
  addInspectionSchedule: (groupId: string, date: string, cycleType: "Annual" | "Trimestral") => void;
  maintenanceQueue: MaintenanceQueueItem[];
  resolveMaintenanceItem: (id: string, presetStatus: string, remarks: string) => void;
  resetInspectionCycle: () => void;
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
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [inspections, setInspections] = useState<InspectionReport[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inspectionSchedules, setInspectionSchedules] = useState<InspectionSchedule[]>([]);
  const [maintenanceQueue, setMaintenanceQueue] = useState<MaintenanceQueueItem[]>([]);
  const [dbTransfers, setDbTransfers] = useState<any[]>([]);
  const [dbReports, setDbReports] = useState<any[]>([]);
  const [dbLoans, setDbLoans] = useState<any[]>([]);
  const [pendingDisposals, setPendingDisposals] = useState<PendingDisposal[]>(() => {
    const saved = localStorage.getItem("ems_pending_disposals");
    return saved ? JSON.parse(saved) : [];
  });
  const [manualClearanceHolds, setManualClearanceHolds] = useState<AffiliateClearance[]>(() => {
    const saved = localStorage.getItem("ems_manual_clearance_holds");
    return saved ? JSON.parse(saved) : [];
  });

  // Sync state from simulated database (Prisma client)
  const syncFromDb = async () => {
    setIsDbLoading(true);
    let liveAssetsFetched = false;
    try {
      // Fetch live assets, transfers, reports, loans, and disposals from MySQL server endpoints
      try {
        const jsonAssets = await assetsApi.listAssets();
        if (jsonAssets.success && Array.isArray(jsonAssets.assets)) {
          setAssets(jsonAssets.assets);
          liveAssetsFetched = true;
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
          setPendingDisposals(jsonD.disposals.map((d: any) => ({
            id: String(d.id || d.disposalId),
            assetId: d.assetId || `EQ-2024-${String(d.asset_id || 0).padStart(3, "0")}`,
            assetName: d.assetName || "Asset Scheduled for Decommissioning",
            requestedBy: d.requestedBy || "ITS/TSG Staff",
            requestedAt: d.requestedAt || new Date().toISOString(),
            reason: d.reason || d.disposal_reason || "Obsolescence",
          })));
        }
      } catch (e) {}

      const dbAssets = await prisma.asset.findMany();
      const dbUsers = await prisma.user.findMany();
      const dbCenters = await prisma.researchCenter.findMany();
      const dbDisposals = await prisma.assetDisposal.findMany();
      const dbMonetaries = await prisma.assetMonetary.findMany();
      const dbTags = await prisma.assetTag.findMany();
      const dbSchedules = await prisma.inspectionSchedule.findMany();
      setInspectionSchedules(dbSchedules);
      const dbQueue = await prisma.maintenanceQueue.findMany();
      setMaintenanceQueue(dbQueue);

      const mappedAssets = dbAssets.map(a => {
        const custodianUser = a.custodianId ? dbUsers.find(u => u.userId === a.custodianId) : null;
        const center = dbCenters.find(c => c.centerId === a.centerId);
        const disposal = dbDisposals.find(d => d.assetId === a.assetId);
        const disposerUser = disposal ? dbUsers.find(u => u.userId === disposal.disposedById) : null;
        const monetary = dbMonetaries.find(m => m.assetId === a.assetId);
        const tag = dbTags.find(t => t.assetId === a.assetId);

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
          cost: monetary ? Number(monetary.acquisitionValue) : 0,
          itsPropertyTag: tag?.itsPropertyTag,
          tsgPropertyTag: tag?.tsgPropertyTag,
          projectId: a.projectId ?? "",
          projectName: a.projectName ?? "",
          projectLeader: a.projectLeader ?? "",
          ccsLab: a.ccsLab ?? "",
          fundingAgency: a.fundingAgency ?? "",
          projectStartYear: a.projectStartYear ?? "",
          description: a.description ?? "",
          image: a.image,
          specs: a.specs
        };
      });
      if (!liveAssetsFetched) setAssets(mappedAssets);

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
        fetch(`http://localhost:4000/api/auth/me?email=${encodeURIComponent(sessionEmail)}`)
          .then(res => res.json())
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
              // Fallback to local prisma simulation
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
        fetch(`http://localhost:4000/api/auth/me?email=${encodeURIComponent(email)}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.user) {
              const img = data.user.userImg || data.user.profilePicture || data.user.avatarUrl;
              setCurrentUser({
                ...data.user,
                profilePicture: img,
                userImg: img,
                avatarUrl: img
              } as any);
            } else {
              prisma.user.findFirst({ where: { email } }).then(u => {
                if (u) setCurrentUser(u as any);
              });
            }
          })
          .catch(() => { });
      }
    }
  };

  const updateProfile = async (firstName: string, lastName: string, profilePicture: string, labAffiliation?: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch("http://localhost:4000/api/auth/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: currentUser.email,
          firstName,
          lastName,
          avatarUrl: profilePicture,
          profilePicture,
          userImg: profilePicture,
          labAffiliation
        })
      });
      const data = await res.json();
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

    try {
      const updated = await prisma.user.update({
        where: { userId: currentUser.userId },
        data: {
          firstName,
          lastName,
          profilePicture
        }
      });
      if (updated) {
        setCurrentUser(prev => prev ? ({ ...prev, firstName, lastName, profilePicture, labAffiliation } as any) : null);
        await syncFromDb();
      }
    } catch (e) { }
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
        status: asset.status,
        projectId: asset.projectId,
        projectName: asset.projectName,
        projectLeader: asset.projectLeader,
        ccsLab: asset.ccsLab,
        fundingAgency: asset.fundingAgency,
        projectStartYear: asset.projectStartYear,
        description: asset.description,
        image: asset.image,
        specs: asset.specs
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
        dueDate: updated.dueDate,
        projectId: updated.projectId,
        projectName: updated.projectName,
        projectLeader: updated.projectLeader,
        ccsLab: updated.ccsLab,
        fundingAgency: updated.fundingAgency,
        projectStartYear: updated.projectStartYear,
        description: updated.description,
        image: updated.image,
        specs: updated.specs
      }
    });
    await syncFromDb();
  };

  const disposeAsset = async (assetIdStr: string, details: Omit<DisposalDetails, "decommissionedBy">, activeRole: string) => {
    const assetId = parseInt(assetIdStr.split("-").pop() || "0", 10);

    if (activeRole === "AdRICDirector") {
      const sessionEmail = getCookie("session_user_email") || "";
      const user = await prisma.user.findFirst({ where: { email: sessionEmail } });
      const userId = user?.userId || 11;

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
    } else {
      const sessionEmail = getCookie("session_user_email") || "";
      const user = await prisma.user.findFirst({ where: { email: sessionEmail } });
      const requestedBy = user ? `${user.firstName} ${user.lastName}` : "ITS Admin";

      const matchedAsset = assets.find(a => a.id === assetIdStr);

      const newPending: PendingDisposal = {
        id: `PDISP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        assetId: assetIdStr,
        assetName: matchedAsset?.name || "Unknown Asset",
        lastCustodian: details.lastCustodian,
        breakdownReasons: details.breakdownReasons,
        disposalPathway: details.disposalPathway,
        requestedBy,
        requestedAt: new Date().toISOString()
      };

      setPendingDisposals(prev => {
        const next = [newPending, ...prev];
        localStorage.setItem("ems_pending_disposals", JSON.stringify(next));
        return next;
      });

      await prisma.asset.update({
        where: { assetId },
        data: { status: "Pending Disposal" }
      });

      await syncFromDb();
    }
  };

  const approveDisposal = async (id: string) => {
    const req = pendingDisposals.find(p => p.id === id);
    if (!req) return;

    const assetId = parseInt(req.assetId.split("-").pop() || "0", 10);
    const sessionEmail = getCookie("session_user_email") || "";
    const user = await prisma.user.findFirst({ where: { email: sessionEmail } });
    const userId = user?.userId || 11;

    await prisma.assetDisposal.create({
      data: {
        assetId,
        disposedById: userId,
        disposalDate: new Date().toISOString(),
        disposalReason: req.breakdownReasons,
        pathway: req.disposalPathway
      }
    });

    await prisma.asset.update({
      where: { assetId },
      data: { status: "Disposed" }
    });

    setPendingDisposals(prev => {
      const next = prev.filter(p => p.id !== id);
      localStorage.setItem("ems_pending_disposals", JSON.stringify(next));
      return next;
    });

    await syncFromDb();
  };

  const rejectDisposal = async (id: string) => {
    const req = pendingDisposals.find(p => p.id === id);
    if (!req) return;

    const assetId = parseInt(req.assetId.split("-").pop() || "0", 10);
    await prisma.asset.update({
      where: { assetId },
      data: { status: "Maintenance" }
    });

    setPendingDisposals(prev => {
      const next = prev.filter(p => p.id !== id);
      localStorage.setItem("ems_pending_disposals", JSON.stringify(next));
      return next;
    });

    await syncFromDb();
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
          ? { ...r, status: "Finalized" as const, condition, checklist, notes, clearanceIssued, certId }
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

    await syncFromDb();
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

    await syncFromDb();
  };

  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);

  useEffect(() => {
    fetch("http://localhost:4000/api/auth/pending-registrations")
      .then(res => res.json())
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
      const res = await fetch("http://localhost:4000/api/auth/approve-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
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
      await fetch("http://localhost:4000/api/auth/reject-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId })
      });
    } catch (err) {
      console.error("Reject registration error:", err);
    } finally {
      setPendingRegistrations(prev => prev.filter(r => r.id !== requestId));
    }
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

    await syncFromDb();
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

        assets, addAsset, removeAsset, updateAsset, disposeAsset,
        transfers, addTransferRequest, updateTransferRequest,
        returns, addReturnRequest, finalizeReturn,
        inspections, addInspectionReport,
        pendingDisposals, approveDisposal, rejectDisposal,
        pendingRegistrations, addPendingRegistration, approveRegistration, rejectRegistration,
        manualClearanceHolds, toggleClearanceHold,
        currentUser, updateProfile,
        inspectionSchedules, addInspectionSchedule,
        maintenanceQueue, resolveMaintenanceItem,
        resetInspectionCycle,
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
