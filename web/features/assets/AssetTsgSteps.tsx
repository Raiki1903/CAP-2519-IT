/**
 * TSG asset steps in the asset modal: mark an asset missing, mark a Missing asset found, and complete an approved retirement.
 * Layer: feature component. Called by features/assets/AssetDetailModal.tsx, for a TSG account only.
 * Calls: api/assets.api.ts markMissing() and markFound(), features/inspections/InspectionFields.tsx,
 * features/disposals/CompleteDisposalDialog.tsx, state/serverData.tsx (the disposal list, syncFromDb).
 * Used by: TSG, on the asset it opened.
 */
import { useState } from "react";
import * as assetsApi from "@web/api/assets.api";
import { useServerData } from "@web/state/serverData";
import { CompleteDisposalDialog } from "@web/features/disposals/CompleteDisposalDialog";
import { EMPTY_INSPECTION, InspectionFields, toInspectionInput, type InspectionFieldsValue } from "@web/features/inspections/InspectionFields";
import { Button } from "@web/components/ui/button";
import { Label } from "@web/components/ui/label";
import { Textarea } from "@web/components/ui/textarea";
import { Search, PackageX, Trash2 } from "lucide-react";

/**
 * Shows the step the asset's status allows. Available or On Loan: Mark Missing, with the reason (a held loan ends by
 * loss). Missing: Mark Found, with a Recovery inspection. Pending Retirement: the Complete Retirement button once the
 * retirement is Approved, else a note that it waits for a decision. Any other status shows nothing. A refusal shows the
 * server's sentence.
 *
 * @param asset the asset (its tag and status)
 */
export function AssetTsgSteps({ asset }: { asset: { id: string; status: string } }) {
  const { retirements, syncFromDb } = useServerData();
  const [open, setOpen] = useState<"missing" | "found" | "complete" | null>(null);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [inspection, setInspection] = useState<InspectionFieldsValue>(EMPTY_INSPECTION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disposal = retirements.find(r => r.asset.tag === asset.id && (r.status === "PENDING" || r.status === "APPROVED"));

  const save = async (step: "missing" | "found") => {
    setSaving(true);
    setError(null);
    try {
      const data = step === "missing"
        ? await assetsApi.markMissing(asset.id, reason.trim())
        : await assetsApi.markFound(asset.id, { inspection: toInspectionInput(inspection), remarks: remarks.trim() || null });
      if (!data.success) {
        setError(data.error || "The step could not be saved. Please try again.");
        return;
      }
      setOpen(null);
      setReason("");
      setRemarks("");
      setInspection(EMPTY_INSPECTION);
      await syncFromDb();
    } catch (err: any) {
      setError(err?.message || "The server could not be reached. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (asset.status === "PENDING_RETIREMENT") {
    return (
      <div className="mt-3 rounded-xl border border-red-200 bg-red-50/50 p-3 text-xs">
        {disposal?.status === "APPROVED" ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-red-800"><strong>RET-{disposal.retirementId}</strong> was approved. Complete it once the asset has left.</p>
            <Button size="sm" className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs" onClick={() => setOpen("complete")}>
              <Trash2 size={12} /> Complete Retirement
            </Button>
          </div>
        ) : (
          <p className="text-red-800">{disposal ? `RET-${disposal.retirementId} is waiting for the Director or the Secretary to decide it.` : "A retirement is waiting for a decision."}</p>
        )}
        {open === "complete" && disposal && (
          <CompleteDisposalDialog retirement={disposal} onClose={() => setOpen(null)} onDone={syncFromDb} />
        )}
      </div>
    );
  }

  if (asset.status !== "AVAILABLE" && asset.status !== "ON_LOAN" && asset.status !== "MISSING") return null;

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3 text-xs">
      {asset.status === "MISSING" ? (
        open === "found" ? (
          <div className="flex flex-col gap-3">
            <InspectionFields value={inspection} onChange={setInspection} heading="Condition when found" />
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-foreground">Where it was found (optional)</Label>
              <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} maxLength={255} className="text-xs resize-y" />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground">This asset is Missing.</p>
            <Button size="sm" variant="outline" className="font-bold text-xs" onClick={() => { setOpen("found"); setError(null); }}>
              <Search size={12} /> Mark Found
            </Button>
          </div>
        )
      ) : open === "missing" ? (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-bold text-foreground">Why is it missing?</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={255} placeholder="For example: not returned after the event, not in the stock room." className="text-xs resize-y" />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground">Cannot be found? A loan the borrower holds ends as lost.</p>
          <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 font-bold text-xs" onClick={() => { setOpen("missing"); setError(null); }}>
            <PackageX size={12} /> Mark Missing
          </Button>
        </div>
      )}

      {open && open !== "complete" && (
        <div className="flex items-center justify-end gap-2 mt-3">
          <Button size="sm" variant="outline" disabled={saving} className="text-xs" onClick={() => { setOpen(null); setError(null); }}>Cancel</Button>
          <Button
            size="sm"
            disabled={saving || (open === "missing" && !reason.trim())}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
            onClick={() => save(open)}
          >
            {saving ? "Saving…" : open === "missing" ? "Mark Missing" : "Mark Found"}
          </Button>
        </div>
      )}
      {error && <p className="text-[11px] text-red-600 mt-2">{error}</p>}
    </div>
  );
}
