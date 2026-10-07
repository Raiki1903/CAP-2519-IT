/**
 * Browser-only state: two lists that are saved in this browser's localStorage and never reach the database.
 * Layer: shared (web state). Called by App.tsx (the provider), serverData.tsx, and screens through useBrowserOnly().
 * Calls nothing: no API, no server.
 * Used by: Custodian return request, Staff pending returns, the notification bell.
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
  manualClearanceHolds: AffiliateClearance[];
  reloadFromStorage: () => void;
}

const BrowserOnlyContext = createContext<BrowserOnlyContextType | null>(null);

/**
 * Holds the two browser-only lists and shares them through useBrowserOnly().
 * Calls no api function: everything is read from and written to localStorage
 * (keys `ems_returns`, `ems_manual_clearance_holds`).
 *
 * What it shares:
 * - `returns`, `addReturnRequest(req)`, `finalizeReturn(...)`: custodian return requests.
 * - `manualClearanceHolds`: read only. Nothing writes this list.
 * - `reloadFromStorage()`: reads returns again.
 *
 * @param children the rest of the app
 */
export function BrowserOnlyProvider({ children }: { children: React.ReactNode }) {
  const [returns, setReturns] = useState<ReturnRequest[]>(() => {
    const saved = localStorage.getItem("ems_returns");
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

  return (
    <BrowserOnlyContext.Provider
      value={{
        returns, addReturnRequest, finalizeReturn,
        manualClearanceHolds,
        reloadFromStorage
      }}
    >
      {children}
    </BrowserOnlyContext.Provider>
  );
}

/**
 * Gives a component the two browser-only lists and their actions.
 *
 * @returns returns, manualClearanceHolds, and the actions that change returns
 * @throws Error if the component is not inside BrowserOnlyProvider
 */
export function useBrowserOnly() {
  const ctx = useContext(BrowserOnlyContext);
  if (!ctx) throw new Error("useBrowserOnly must be used inside BrowserOnlyProvider");
  return ctx;
}
