import { createContext, useContext, useState } from "react";

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

interface AppContextType {
  role: Role | null;
  setRole: (role: Role | null) => void;
  cycleMode: "Annual" | "Trimestral";
  setCycleMode: (mode: "Annual" | "Trimestral") => void;
  repairRequests: RepairRequest[];
  addRepairRequest: (req: RepairRequest) => void;
  acknowledgeRepair: (id: string) => void;
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
}

const AppContext = createContext<AppContextType | null>(null);

const initialAssets: Asset[] = [
  { id: "EQ-2024-001", name: "Dell PowerEdge R740 Server", serial: "SN-DPE-740-001", manufacturer: "Dell Technologies", category: "Computing Array", funding: "DOST", procured: "2024-01-15", warranty: "2027-01-15", location: "Manila", lab: "CITe4D", status: "On Loan", condition: 96, custodian: "Dr. Santos" },
  { id: "EQ-2024-002", name: "NVIDIA DGX A100 Workstation", serial: "SN-DGX-A100-02", manufacturer: "NVIDIA Corporation", category: "Computing Array", funding: "USAID", procured: "2024-02-20", warranty: "2026-02-20", location: "Laguna", lab: "CAR", status: "Active", condition: 82 },
  { id: "EQ-2024-003", name: "UR10e Collaborative Robot", serial: "SN-UR10e-0034", manufacturer: "Universal Robots", category: "Robotic Node", funding: "CHED", procured: "2024-03-10", warranty: "2026-03-10", location: "Manila", lab: "CeHCI", status: "Active", condition: 91 },
  { id: "EQ-2024-004", name: "Boston Dynamics Spot Robot", serial: "SN-SPOT-0178", manufacturer: "Boston Dynamics", category: "Robotic Node", funding: "Internal Grants", procured: "2023-11-05", warranty: "2025-11-05", location: "Laguna", lab: "HXIL", status: "Maintenance", condition: 67 },
  { id: "EQ-2024-005", name: "Leica BLK360 3D Scanner", serial: "SN-LBK-360-09", manufacturer: "Leica Geosystems", category: "Sensor Array", funding: "DOST", procured: "2024-04-01", warranty: "2027-04-01", location: "Manila", lab: "CITe4D", status: "On Loan", condition: 99, custodian: "A. Garcia" },
  { id: "EQ-2024-006", name: "Surface Pro 9 i7 (Bundle×12)", serial: "SN-SP9-BNDL-03", manufacturer: "Microsoft", category: "Mobile Infrastructure", funding: "CHED", procured: "2024-05-22", warranty: "2026-05-22", location: "Manila", lab: "GAME", status: "Active", condition: 88 },
  { id: "EQ-2024-007", name: "Raspberry Pi 4 Cluster (×32)", serial: "SN-RPI4-CLU-07", manufacturer: "Raspberry Pi Ltd", category: "Computing Array", funding: "USAID", procured: "2024-06-01", warranty: "2026-06-01", location: "Laguna", lab: "CeLT", status: "Active", condition: 94 },
  { id: "EQ-2024-008", name: "Phantom VEO4K Ultra-HSC", serial: "SN-PH-VEO-4K-01", manufacturer: "Vision Research", category: "Sensor Array", funding: "DOST", procured: "2024-01-28", warranty: "2027-01-28", location: "Manila", lab: "Bio", status: "Active", condition: 100 },
  { id: "EQ-2024-009", name: "Cisco Catalyst 9300 Switch", serial: "FCW2549L0GR", manufacturer: "Cisco Systems", category: "Networking", funding: "CHED", procured: "2024-06-09", warranty: "2027-06-09", location: "Manila", lab: "CITe4D", status: "Active", condition: 100 },
  { id: "EQ-2024-010", name: "Vuzix M400 Smart Glasses ×4", serial: "VX-M400-DLSU", manufacturer: "Vuzix", category: "Peripheral", funding: "Internal Grants", procured: "2024-06-06", warranty: "2026-06-06", location: "Laguna", lab: "CAR", status: "Active", condition: 90 },
  
  // Custodian's own borrowed assets
  { id: "EQ-2024-051", name: "MacBook Pro M2 Max", serial: "C02Z4K01Q6LR", manufacturer: "Apple Inc.", category: "Mobile Infrastructure", funding: "Internal Grants", procured: "2024-02-15", warranty: "2027-02-15", location: "Manila", lab: "CITe4D", status: "On Loan", condition: 88, custodian: "A. Dela Cruz (Active Custodian)", borrowedOn: "Jun 01, 2026", dueDate: "Jun 30, 2026", daysLeft: 19 },
  { id: "EQ-2024-055", name: "Raspberry Pi 4 Kit ×3", serial: "RPI4-DLSU-009", manufacturer: "Raspberry Pi Ltd", category: "Computing Array", funding: "Internal Grants", procured: "2024-03-20", warranty: "2026-03-20", location: "Laguna", lab: "CeLT", status: "On Loan", condition: 85, custodian: "A. Dela Cruz (Active Custodian)", borrowedOn: "May 20, 2026", dueDate: "Jun 20, 2026", daysLeft: -1 },
  { id: "EQ-2024-012", name: "Vuzix M400 Smart Glass", serial: "VX-M400-007", manufacturer: "Vuzix", category: "Peripheral", funding: "Internal Grants", procured: "2024-04-10", warranty: "2026-04-10", location: "Laguna", lab: "CAR", status: "On Loan", condition: 90, custodian: "A. Dela Cruz (Active Custodian)", borrowedOn: "Jun 05, 2026", dueDate: "Jul 05, 2026", daysLeft: 24 },
  
  { id: "EQ-2024-015", name: "Dell PowerEdge R740 Server", serial: "SN-DPE-740-001", manufacturer: "Dell", category: "Computing Array", funding: "DOST", procured: "2024-03-15", warranty: "2027-03-15", location: "Manila", lab: "CITe4D", status: "On Loan", condition: 94, custodian: "A. Dela Cruz (Active Custodian)" },
  { id: "EQ-2024-016", name: "NVIDIA DGX A100 Workstation", serial: "SN-DGX-A100-02", manufacturer: "NVIDIA", category: "Computing Array", funding: "Internal Grants", procured: "2024-06-20", warranty: "2026-06-20", location: "Laguna", lab: "CAR", status: "On Loan", condition: 88, custodian: "M. Tan" },
  { id: "EQ-2024-017", name: "UR10e Cobot Robotic Arm", serial: "SN-UR10e-0034", manufacturer: "Universal Robots", category: "Robotic Node", funding: "USAST", procured: "2024-01-10", warranty: "2025-01-10", location: "Manila", lab: "CeHCI", status: "On Loan", condition: 72, custodian: "J. Sy" },
  { id: "EQ-2024-018", name: "Boston Dynamics Spot Robot", serial: "SN-SPOT-0178", manufacturer: "Boston Dynamics", category: "Robotic Node", funding: "CHED", procured: "2023-11-05", warranty: "2024-11-05", location: "Manila", lab: "HXIL", status: "On Loan", condition: 54, custodian: "Felix Torres" },
  { id: "EQ-2024-019", name: "Leica BLK360 Laser Scanner", serial: "SN-LBK-360-09", manufacturer: "Leica", category: "Sensor Array", funding: "USAID", procured: "2024-02-18", warranty: "2026-02-18", location: "Manila", lab: "CITe4D", status: "On Loan", condition: 91, custodian: "A. Dela Cruz (Active Custodian)" },
  { id: "EQ-2024-020", name: "Surface Pro 9 Tablet Bundle (x8)", serial: "SN-SP9-BNDL-03", manufacturer: "Microsoft", category: "Mobile Infrastructure", funding: "Internal Grants", procured: "2024-05-01", warranty: "2025-05-01", location: "Manila", lab: "GAME", status: "On Loan", condition: 83, custodian: "T. Lim" },
  { id: "EQ-2024-021", name: "Raspberry Pi 4 Cluster (32 nodes)", serial: "SN-RPI4-CLU-07", manufacturer: "Raspberry Pi", category: "Computing Array", funding: "DOST", procured: "2024-04-12", warranty: "2025-04-12", location: "Laguna", lab: "CeLT", status: "On Loan", condition: 96, custodian: "A. Dela Cruz (Active Custodian)" },
];

const initialTransfers: TransferRequest[] = [
  { id: "TXN-2026-0035", asset: "Dell PowerEdge R740 Server", assetId: "EQ-2024-001", from: "A. Dela Cruz (Active Custodian)", fromRole: "Lead Researcher", to: "Dr. Juan Dela Cruz", toRole: "Lab Head", lab: "CITe4D", initiated: "Jun 20, 2026", status: "Pending" },
  { id: "TXN-2026-0036", asset: "NVIDIA DGX A100 Workstation", assetId: "EQ-2024-002", from: "M. Tan", fromRole: "Assistant Professor", to: "C. Santos", toRole: "Researcher", lab: "CAR", initiated: "Jun 18, 2026", status: "Approved" },
  { id: "TXN-2026-0037", asset: "Boston Dynamics Spot Robot", assetId: "EQ-2024-004", from: "Felix Torres", fromRole: "Research Fellow", to: "Isabelle Flores", toRole: "PhD Candidate", lab: "HXIL", initiated: "May 29, 2026", status: "Approved" },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [cycleMode, setCycleMode] = useState<"Annual" | "Trimestral">("Trimestral");
  const [repairRequests, setRepairRequests] = useState<RepairRequest[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Stateful inventories and registries
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [transfers, setTransfers] = useState<TransferRequest[]>(initialTransfers);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);

  const addRepairRequest = (req: RepairRequest) => {
    setRepairRequests(prev => [req, ...prev]);
    // Also set the asset's status to "Maintenance" if request type is repair
    if (req.statusLabel !== "Disposal Recommendation") {
      setAssets(prev => prev.map(a => a.id === req.assetId ? { ...a, status: "Maintenance" } : a));
    }
  };

  const acknowledgeRepair = (id: string) =>
    setRepairRequests(prev =>
      prev.map(r => (r.id === id ? { ...r, acknowledged: true } : r))
    );

  const updateRepairStatus = (id: string, statusLabel: string) => {
    setRepairRequests(prev => {
      const match = prev.find(r => r.id === id);
      if (match) {
        if (statusLabel === "Fixed & Completed") {
          setAssets(prevAssets => prevAssets.map(a => a.id === match.assetId ? {
            ...a,
            status: match.custodian && match.custodian !== "Unassigned" && match.custodian !== "No custodian" && match.custodian !== "No Custodian" ? "On Loan" : "Active",
            custodian: (match.custodian === "Unassigned" || match.custodian === "No custodian" || match.custodian === "No Custodian") ? "" : match.custodian
          } : a));
        } else {
          setAssets(prevAssets => prevAssets.map(a => a.id === match.assetId ? {
            ...a,
            status: "Maintenance"
          } : a));
        }
      }
      return prev.map(r => r.id === id ? { ...r, statusLabel, acknowledged: true } : r);
    });
  };

  const unacknowledgedCount = repairRequests.filter(r => !r.acknowledged).length;

  const addAsset = (asset: Asset) => {
    setAssets(prev => [asset, ...prev]);
  };

  const removeAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const updateAsset = (updated: Asset) => {
    setAssets(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  const disposeAsset = (assetId: string, details: Omit<DisposalDetails, "decommissionedBy">, role: string) => {
    const disposalId = `DISP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setAssets(prev => prev.map(a => a.id === assetId ? {
      ...a,
      status: "Disposed",
      disposalId,
      disposalDetails: {
        ...details,
        decommissionedBy: role
      }
    } : a));
  };

  const addTransferRequest = (req: TransferRequest) => {
    setTransfers(prev => [req, ...prev]);
  };

  const updateTransferRequest = (id: string, status: "Approved" | "Declined") => {
    setTransfers(prev => {
      const req = prev.find(t => t.id === id);
      if (req) {
        setAssets(prevAssets =>
          prevAssets.map(a =>
            a.id === req.assetId
              ? {
                  ...a,
                  custodian: status === "Approved" ? req.to : a.custodian,
                  lab: status === "Approved" ? req.lab : a.lab,
                  status: status === "Approved" ? "On Loan" : (a.custodian ? "On Loan" : "Active")
                }
              : a
          )
        );
      }
      return prev.map(t => t.id === id ? { ...t, status } : t);
    });
  };

  const addReturnRequest = (req: ReturnRequest) => {
    setReturns(prev => [req, ...prev]);
  };

  const finalizeReturn = (id: string, assetId: string, condition: string, checklist: string[], notes: string, clearanceIssued: boolean) => {
    const certId = clearanceIssued ? `CLR-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : undefined;
    setReturns(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: "Finalized", condition, checklist, notes, clearanceIssued, certId }
          : r
      )
    );
    setAssets(prev =>
      prev.map(a =>
        a.id === assetId
          ? {
              ...a,
              status: "Active",
              custodian: "",
              condition: condition === "Pristine" ? 100 : condition === "Operational" ? 90 : condition === "Degraded" ? 60 : 20
            }
          : a
      )
    );
  };

  return (
    <AppContext.Provider
      value={{
        role, setRole,
        cycleMode, setCycleMode,
        repairRequests, addRepairRequest, acknowledgeRepair, updateRepairStatus,
        unacknowledgedCount,
        sidebarCollapsed, setSidebarCollapsed,

        assets, addAsset, removeAsset, updateAsset, disposeAsset,
        transfers, addTransferRequest, updateTransferRequest,
        returns, addReturnRequest, finalizeReturn
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
  ITS:       "its",
  TSG:       "tsg",
  LabHead:   "lab-head",
  Custodian: "custodian",
};

export const roleDefaultPath: Record<Role, string> = {
  ITS:       "/its/overview",
  TSG:       "/tsg/maintenance",
  LabHead:   "/lab-head/custody",
  Custodian: "/custodian/myassets",
};
