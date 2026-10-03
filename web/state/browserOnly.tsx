/**
 * Browser-only state: three lists that are saved in this browser's localStorage and never reach the database.
 * Layer: shared (web state). Called by App.tsx (the provider), serverData.tsx, and screens through useBrowserOnly().
 * Calls nothing: no API, no server.
 * Used by: Custodian return request, Staff pending returns and inspection log, the notification bell.
 *
 * Temporary. Each list is an open team decision (see 02-restructure-log.md, notes).
 * Do not add a new list here: new data goes through web/api to the server.
 */
import { createContext, useContext, useState } from "react";

/** A custodian's request to hand an asset back, and what Staff recorded when they finalized it. */
// TODO(H-02): a request exists only in the browser that made it, so Staff on another machine never see it. Phase 3 (needs a table or a status column).
export interface ReturnRequest {
  id: string;
  /** The asset tag. */
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
  /** Clearance certificate number, made up in the browser when clearance is issued. */
  certId?: string;
}

/** The browser's own copy of an inspection report, shown in the Staff inspection log. */
// TODO(F-28): the real report is saved to asset_reports through the API, but the Staff log table reads this copy instead. Team decision pending.
export interface InspectionReport {
  id: string;
  /** The asset tag. */
  assetId: string;
  assetName: string;
  /** Display name of whoever filed the report, a custodian or a Staff inspector. */
  custodian: string;
  status: string;
  description: string;
  images: string[];
  submittedAt: string;
  cycleType: "Trimestral" | "Annual";
}

/** A clearance hold the Director placed on a person by hand. */
// TODO(F-37): holds are not in the database, and no screen can create one. Phase 3 (panel comment D2).
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

/**
 * Holds the three browser-only lists and shares them through useBrowserOnly().
 * Calls no api function: everything is read from and written to localStorage
 * (keys `ems_returns`, `ems_inspections`, `ems_manual_clearance_holds`).
 *
 * What it shares:
 * - `returns`, `addReturnRequest(req)`, `finalizeReturn(...)`: custodian return requests.
 * - `inspections`, `addInspectionReport(report)`: the Staff inspection log.
 * - `manualClearanceHolds`: read only. Nothing writes this list.
 * - `reloadFromStorage()`: reads returns and inspections again.
 *
 * @param children the rest of the app
 */
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

  // serverData.tsx calls this at the end of every server reload. That is how a
  // request saved in another tab of the same browser shows up without a page reload.
  const reloadFromStorage = () => {
    const savedReturns = localStorage.getItem("ems_returns");
    if (savedReturns) setReturns(JSON.parse(savedReturns));

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

  // Marks the browser's request as finalized, which takes it off the Staff
  // pending returns list. The database write is separate: ReturnForm calls
  // returnsApi.finalizeReturn before this.
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

/**
 * Gives a component the three browser-only lists and their actions.
 *
 * @returns returns, inspections, manualClearanceHolds, and the actions that change the first two
 * @throws Error if the component is not inside BrowserOnlyProvider
 */
export function useBrowserOnly() {
  const ctx = useContext(BrowserOnlyContext);
  if (!ctx) throw new Error("useBrowserOnly must be used inside BrowserOnlyProvider");
  return ctx;
}
