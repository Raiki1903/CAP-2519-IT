/**
 * Pending returns: the loans TSG may receive, loaded from the server.
 * Layer: feature component (data hook). Called by pages/staff/ReturnsPage.tsx and pages/staff/OverviewPage.tsx.
 * Calls: api/loans.api.ts listLoansByStatus(), state/session.tsx (who is asking), state/serverData.tsx (the reload signal).
 * Used by: Staff pending returns, the Staff overview count.
 */
import { useCallback, useEffect, useState } from "react";
import type { Loan } from "@shared/types/loans";
import * as loansApi from "@web/api/loans.api";
import { useSession } from "@web/state/session";
import { useServerData } from "@web/state/serverData";

/**
 * Loads GET /api/loans?status=RETURN_REQUESTED,ON_LOAN for TSG, and again each time the shared lists reload (every
 * save reloads them, Record Return included). Only TSG may read that list, so any other account gets empty lists and no
 * request is sent.
 *
 * @returns `isTsg`; `requested`, the loans whose borrower asked to return, oldest request first; `walkIns`, the other On
 *   Loan loans, which TSG can still receive; `loading`; `error` (the server's sentence, or null); and `reload()`
 */
export function usePendingReturns() {
  const { role, currentUser } = useSession();
  const { assetsVersion } = useServerData();
  const isTsg = role === "Staff" && currentUser?.staffUnit === "TSG";
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isTsg) {
      setLoans([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await loansApi.listLoansByStatus(["RETURN_REQUESTED", "ON_LOAN"]);
      if (data.success && Array.isArray(data.loans)) setLoans(data.loans);
      else setError(data.error || "Could not load the pending returns.");
    } catch {
      setError("Could not reach the server. Reload the page.");
    } finally {
      setLoading(false);
    }
  }, [isTsg]);

  useEffect(() => {
    reload();
  }, [reload, assetsVersion]);

  return {
    isTsg,
    requested: loans.filter(l => l.status === "RETURN_REQUESTED"),
    walkIns: loans.filter(l => l.status === "ON_LOAN"),
    loading,
    error,
    reload,
  };
}
