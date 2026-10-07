import { useState } from "react";
import * as disposalsApi from "@web/api/disposals.api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Archive } from "lucide-react";

export function DisposalFormDialog({ asset, onClose, requestedBy, onSubmitted }: { asset: any; onClose: () => void; requestedBy: string; onSubmitted?: () => void }) {
  const [form, setForm] = useState({
    lastCustodian: asset?.custodian || "",
    breakdownReasons: "",
    disposalPathway: "Decommission — Scrap / Recycle",
    decommissionDate: new Date().toISOString().split("T")[0]
  });
  const [successId, setSuccessId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSave = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = await disposalsApi.requestDisposal(asset.id, {
        requestedBy,
        lastCustodian: form.lastCustodian || "Unassigned",
        breakdownReasons: form.breakdownReasons.trim() || "Decommissioned due to physical breakdown or end of servicing lifecycle.",
        disposalPathway: form.disposalPathway,
        decommissionDate: form.decommissionDate,
      });
      if (!data.success) {
        setSubmitError(data.error || "Failed to log disposal request to the database.");
        return;
      }
      setSuccessId(`DISP-${data.disposal.disposal_id}`);
      onSubmitted?.();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to reach the server.");
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
              <p className="text-xs text-muted-foreground mt-1">Sent to the AdRIC Director for approval. The asset stays active until it's authorized.</p>
            </div>
            <div className="w-full bg-muted/40 rounded-xl p-3 border text-left text-xs font-mono space-y-1">
              <p><strong className="text-foreground">Asset ID:</strong> {asset.id}</p>
              <p><strong className="text-foreground">Disposal ID:</strong> {successId}</p>
              <p><strong className="text-foreground">Decommission Date:</strong> {form.decommissionDate}</p>
              <p><strong className="text-foreground">Disposal Pathway:</strong> {form.disposalPathway}</p>
            </div>
            <Button onClick={onClose} className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-9">Close Dialog</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground">Decommission &amp; Dispose Asset</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Log physical breakdown reasons and specify the disposal pathway. This request is sent to the AdRIC Director for sign-off before the asset is marked Disposed.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Asset ID / Name</Label>
                <Input value={`${asset.id} - ${asset.name}`} disabled className="bg-muted text-xs font-semibold" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Last Custodian Assignment</Label>
                <Input value={form.lastCustodian} onChange={e => setForm({ ...form, lastCustodian: e.target.value })} placeholder="e.g. Dr. Juan Dela Cruz" className="text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Main Issues / Breakdown Justification</Label>
                <textarea value={form.breakdownReasons} onChange={e => setForm({ ...form, breakdownReasons: e.target.value })} rows={3} placeholder="Describe diagnostic metrics, breakdown causes, physical damages, or reasons repair is not financially viable..." className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Disposal Pathway</Label>
                <select value={form.disposalPathway} onChange={e => setForm({ ...form, disposalPathway: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {["Decommission — Scrap / Recycle", "Decommission — Donate to Partner Institution", "Decommission — Warranty Return to Vendor", "Decommission — Institutional Auction", "Decommission — Secure Landfill"].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Final Decommission Date</Label>
                <Input type="date" value={form.decommissionDate} onChange={e => setForm({ ...form, decommissionDate: e.target.value })} className="text-xs h-9" />
              </div>
              {submitError && (
                <p className="text-xs text-red-600">{submitError}</p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSave} disabled={submitting || !form.breakdownReasons.trim()} className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-9">
                {submitting ? "Submitting…" : "Submit for Director Approval"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
