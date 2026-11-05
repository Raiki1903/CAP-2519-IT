/**
 * Complete disposal dialog: TSG records how an approved disposal was carried out (the pathway and a reference), and the
 * asset is Retired.
 * Layer: feature component. Called by features/assets/AssetTsgSteps.tsx and features/notifications/NotificationCenter.tsx.
 * Calls: api/retirements.api.ts completeRetirement().
 * Used by: TSG, on an Approved disposal.
 */
import { useState } from "react";
import type { Retirement } from "@shared/types/retirements";
import { RETIREMENT_PATHWAYS, RETIREMENT_PATHWAY_LABELS, type RetirementPathway } from "@shared/constants/retirementStatuses";
import * as retirementsApi from "@web/api/retirements.api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";

/**
 * Collects the pathway (the one TSG named at the request is picked first) and the disposition reference, for example
 * the donation or sale document number, and completes the disposal. A refusal shows the server's sentence.
 *
 * @param retirement the Approved disposal
 * @param onClose closes the dialog
 * @param onDone called after the server saved the completion, so the caller reloads the shared lists
 */
export function CompleteDisposalDialog({ retirement, onClose, onDone }: { retirement: Retirement; onClose: () => void; onDone: () => Promise<void> | void }) {
  const [pathway, setPathway] = useState<RetirementPathway>((retirement.pathway as RetirementPathway | null) ?? "RECYCLE");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await retirementsApi.completeRetirement(retirement.retirementId, { pathway, dispositionReference: reference.trim() });
      if (!data.success) {
        setError(data.error || "The disposal could not be completed. Please try again.");
        return;
      }
      await onDone();
      onClose();
    } catch (err: any) {
      setError(err?.message || "The server could not be reached. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">Complete the disposal</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            DISP-{retirement.retirementId} was approved for {retirement.asset.name} ({retirement.asset.tag}). Once you complete it the asset is Retired and nothing more can be done to it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Pathway</Label>
            <select
              value={pathway}
              onChange={e => setPathway(e.target.value as RetirementPathway)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {RETIREMENT_PATHWAYS.map(p => <option key={p} value={p}>{RETIREMENT_PATHWAY_LABELS[p]}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Disposition reference</Label>
            <Input value={reference} onChange={e => setReference(e.target.value)} maxLength={255} placeholder="For example the deed of donation or the sale receipt number" className="text-xs" />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={saving || !reference.trim()} onClick={complete} className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs">
            {saving ? "Saving…" : "Complete disposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
