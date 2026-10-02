import { createContext, useContext, useState } from "react";

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

export interface AffiliateClearance {
  userId: number;
  name: string;
  email: string;
  role: "Faculty" | "Student";
  holdStatus: "Hold Active" | "Cleared";
  notes?: string;
}

interface BrowserOnlyContextType {
  returns: ReturnRequest[];
  addReturnRequest: (req: ReturnRequest) => void;
  finalizeReturn: (id: string, condition: string, checklist: string[], notes: string, clearanceIssued: boolean) => void;
  inspections: InspectionReport[];
  addInspectionReport: (report: InspectionReport) => void;
  manualClearanceHolds: AffiliateClearance[];
  reloadFromStorage: () => void;
}

const BrowserOnlyContext = createContext<BrowserOnlyContextType | null>(null);

export function BrowserOnlyProvider({ children }: { children: React.ReactNode }) {
  const [returns, setReturns] = useState<ReturnRequest[]>(() => {
    const saved = localStorage.getItem("ems_returns");
    return saved ? JSON.parse(saved) : [];
  });
  const [inspections, setInspections] = useState<InspectionReport[]>(() => {
    const saved = localStorage.getItem("ems_inspections");
    return saved ? JSON.parse(saved) : [];
  });
  const [manualClearanceHolds] = useState<AffiliateClearance[]>(() => {
    const saved = localStorage.getItem("ems_manual_clearance_holds");
    return saved ? JSON.parse(saved) : [];
  });

  const reloadFromStorage = () => {
    // Sync Returns from local storage
    const savedReturns = localStorage.getItem("ems_returns");
    if (savedReturns) setReturns(JSON.parse(savedReturns));

    // Sync Inspections from local storage
    const savedInspections = localStorage.getItem("ems_inspections");
    if (savedInspections) setInspections(JSON.parse(savedInspections));
    else setInspections([]);
  };

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

  return (
    <BrowserOnlyContext.Provider
      value={{
        returns, addReturnRequest, finalizeReturn,
        inspections, addInspectionReport,
        manualClearanceHolds,
        reloadFromStorage
      }}
    >
      {children}
    </BrowserOnlyContext.Provider>
  );
}

export function useBrowserOnly() {
  const ctx = useContext(BrowserOnlyContext);
  if (!ctx) throw new Error("useBrowserOnly must be used inside BrowserOnlyProvider");
  return ctx;
}
