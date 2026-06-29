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
}

export interface BorrowRequest {
  id: string;
  assetId: string;
  assetName: string;
  assetCategory: string;
  assetSerial: string;
  assetLocation: string;
  assetLab: string;
  requestedBy: string;
  purpose: string;
  returnDate: string;
  submittedAt: string;
  status: "Pending" | "Approved" | "Denied";
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
  borrowRequests: BorrowRequest[];
  addBorrowRequest: (req: BorrowRequest) => void;
  resolveBorrowRequest: (id: string, decision: "Approved" | "Denied") => void;
  pendingBorrowCount: number;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [cycleMode, setCycleMode] = useState<"Annual" | "Trimestral">("Trimestral");
  const [repairRequests, setRepairRequests] = useState<RepairRequest[]>([]);
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequest[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const addRepairRequest = (req: RepairRequest) =>
    setRepairRequests(prev => [req, ...prev]);

  const acknowledgeRepair = (id: string) =>
    setRepairRequests(prev =>
      prev.map(r => (r.id === id ? { ...r, acknowledged: true } : r))
    );

  const addBorrowRequest = (req: BorrowRequest) =>
    setBorrowRequests(prev => [req, ...prev]);

  const resolveBorrowRequest = (id: string, decision: "Approved" | "Denied") =>
    setBorrowRequests(prev =>
      prev.map(r => (r.id === id ? { ...r, status: decision } : r))
    );

  const unacknowledgedCount = repairRequests.filter(r => !r.acknowledged).length;
  const pendingBorrowCount  = borrowRequests.filter(r => r.status === "Pending").length;

  return (
    <AppContext.Provider
      value={{
        role, setRole,
        cycleMode, setCycleMode,
        repairRequests, addRepairRequest, acknowledgeRepair,
        unacknowledgedCount,
        borrowRequests, addBorrowRequest, resolveBorrowRequest,
        pendingBorrowCount,
        sidebarCollapsed, setSidebarCollapsed,
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
  TSG: "/tsg/maintenance",
  LabHead: "/lab-head/custody",
  Custodian: "/custodian/myassets",
};
