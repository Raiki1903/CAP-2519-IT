/**
 * Disposal request dialog: TSG ask the Director or the Secretary to approve the disposal of an asset.
 * Layer: feature component. Called by pages/staff/InventoryPage.tsx.
 * Calls: api/retirements.api.ts requestRetirement(), then state/serverData.tsx syncFromDb().
 * Used by: TSG disposal requests; the Director or the Secretary decides, and TSG then completes it.
 */
import { useState } from "react";
import { RETIREMENT_PATHWAYS, RETIREMENT_PATHWAY_LABELS } from "@shared/constants/retirementStatuses";
import * as retirementsApi from "@web/api/retirements.api";
import { useServerData } from "@web/state/serverData";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Archive } from "lucide-react";

/**
 * Collects the reason and, if TSG already knows it, the pathway, and requests the disposal through
 * retirementsApi.requestRetirement(). The asset moves to Pending Retirement and stays there until it is decided and
 * completed. A refusal (an asset on loan, one in Maintenance that is not beyond repair, a second request) shows the
 * server's sentence and keeps the dialog open. The success screen shows the database id (`DISP-<n>`).
 *
 * @param asset the asset to dispose of
 * @param onClose closes the dialog
 * @param onSubmitted optional, called after the request is saved
 */
export function DisposalFormDialog({ asset, onClose, onSubmitted }: { asset: any; onClose: () => void; onSubmitted?: () => void }) {
  const { syncFromDb } = useServerData();
  const [reason, setReason] = useState("");
  const [pathway, setPathway] = useState("");
  const [successId, setSuccessId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSave = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = await retirementsApi.requestRetirement(asset.id, { reason: reason.trim(), pathway: pathway || null });
      if (!data.success) {
        setSubmitError(data.error || "The disposal request could not be saved. Please try again.");
        return;
      }
      setSuccessId(`DISP-${data.retirement.retirementId}`);
      syncFromDb();
      onSubmitted?.();
    } catch (err: any) {
      setSubmitError(err?.message || "The server could not be reached. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!asset} onOpenChange={open => { if (!open && !successId) onClose(); }}>
      <DialogContent className="max-w-md">
        {successId ? (
          <div className="flex flex-col items-center text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
              <Archive size={30} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Disposal Request Submitted</h3>
              <p className="text-xs text-muted-foreground mt-1">Sent to the AdRIC Director and the Secretary for approval. The asset is Pending Retirement until it is decided and you complete it.</p>
            </div>
            <div className="w-full bg-muted/40 rounded-xl p-3 border text-left text-xs font-mono space-y-1">
              <p><strong className="text-foreground">Asset ID:</strong> {asset.id}</p>
              <p><strong className="text-foreground">Disposal ID:</strong> {successId}</p>
              {pathway && <p><strong className="text-foreground">Pathway:</strong> {RETIREMENT_PATHWAY_LABELS[pathway as keyof typeof RETIREMENT_PATHWAY_LABELS]}</p>}
            </div>
            <Button onClick={onClose} className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-9">Close Dialog</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground">Retire Asset</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Write why the asset is being disposed of. The Director or the Secretary approves or denies it; you complete it after it is approved.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Asset ID / Name</Label>
                <Input value={`${asset.id} - ${asset.name}`} disabled className="bg-muted text-xs font-semibold" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Reason for the disposal</Label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={2000} placeholder="Describe the breakdown, the damage, or why repair is not worth it." className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Disposal Pathway (optional)</Label>
                <select value={pathway} onChange={e => setPathway(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Not decided yet</option>
                  {RETIREMENT_PATHWAYS.map(p => <option key={p} value={p}>{RETIREMENT_PATHWAY_LABELS[p]}</option>)}
                </select>
              </div>
              {submitError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{submitError}</p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSave} disabled={submitting || !reason.trim()} className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-9">
                {submitting ? "Submitting…" : "Submit for Approval"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
