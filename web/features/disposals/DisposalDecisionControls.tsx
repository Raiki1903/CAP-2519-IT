/**
 * Disposal decision controls: Approve and Deny (with the reason written) for a Pending disposal, for the Director and
 * the Secretary.
 * Layer: feature component. Called by pages/director/AdRICDirectorDashboard.tsx and features/notifications/NotificationCenter.tsx.
 * Calls: api/retirements.api.ts decideRetirement(), state/session.tsx (who is signed in).
 * Used by: the Director's Disposal Approvals tab and the bell of the Director and the Secretary.
 */
import { useState } from "react";
import type { Retirement } from "@shared/types/retirements";
import * as retirementsApi from "@web/api/retirements.api";
import { useSession } from "@web/state/session";
import { Button } from "@web/components/ui/button";

/**
 * Shows Approve and Deny for a Pending disposal. Deny opens a remarks box and needs the reason. Someone who requested
 * the disposal themself sees a note instead of the buttons; the server refuses them anyway. A refusal shows the server's
 * sentence under the buttons.
 *
 * @param retirement the Pending disposal
 * @param onDecided called after the server saved the decision, so the caller reloads the shared lists
 */
export function DisposalDecisionControls({ retirement, onDecided }: { retirement: Retirement; onDecided: () => Promise<void> | void }) {
  const { currentUser } = useSession();
  const [denying, setDenying] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRequester = !("hidden" in retirement.requestedBy) && retirement.requestedBy.userId === currentUser?.userId;
  if (isRequester) {
    return <p className="text-[10px] text-muted-foreground italic">You requested this disposal, so someone else decides it.</p>;
  }

  const decide = async (decision: "approve" | "deny") => {
    setWorking(true);
    setError(null);
    try {
      const data = await retirementsApi.decideRetirement(retirement.retirementId, { decision, decisionRemarks: remarks.trim() || null });
      if (!data.success) {
        setError(data.error || "The decision could not be saved. Please try again.");
        return;
      }
      await onDecided();
    } catch (err: any) {
      setError(err?.message || "The server could not be reached. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2 w-full" onClick={e => e.stopPropagation()}>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" disabled={working} className="border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-bold h-8"
          onClick={() => { setDenying(true); setError(null); }}>
          Deny
        </Button>
        <Button size="sm" disabled={working} className="bg-[#005A36] hover:bg-[#004225] text-white text-[10px] font-bold h-8 border-none" onClick={() => decide("approve")}>
          {working && !denying ? "Working…" : "Approve Disposal"}
        </Button>
      </div>
      {denying && (
        <div className="w-full flex flex-col gap-1.5">
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Reason for denying"
            aria-label="Reason for denying"
            className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-[11px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="outline" className="text-[10px] font-bold h-7" onClick={() => setDenying(false)}>Cancel</Button>
            <Button size="sm" disabled={working || !remarks.trim()} className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold h-7" onClick={() => decide("deny")}>
              {working ? "Working…" : "Send denial"}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-[10px] text-red-600 text-right">{error}</p>}
    </div>
  );
}
