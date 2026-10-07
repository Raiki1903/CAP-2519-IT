/**
 * Repair progress dialog: Staff move a repair ticket through its stages and, when it is fixed, record the asset's condition.
 * Layer: feature component. Called by pages/staff/RepairsPage.tsx.
 * Calls nothing itself: the save goes through the onSave prop (useRepairTickets' handleUpdateRepairStatus).
 * Used by: Staff (ITS and TSG) repair handling.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Textarea } from "@web/components/ui/textarea";
import { Label } from "@web/components/ui/label";
import { cn } from "@web/components/ui/utils";

/**
 * Shows the ticket and lets Staff pick its next progress status. Choosing "Fixed & Completed"
 * opens a second step for the post-repair condition and technician remarks before saving.
 * A completed ticket is shown read-only.
 *
 * @param ticket the ticket as useRepairTickets maps it
 * @param onClose closes the dialog
 * @param onSave saves the new status, with condition and remarks on completion
 */
export function RepairProgressDialog({ ticket, onClose, onSave }: { ticket: any; onClose: () => void; onSave: (id: string, status: string, condition?: string, remarks?: string) => void }) {
  const [status, setStatus] = useState(ticket?.statusLabel || "Inspection Phase");
  const [showConditionForm, setShowConditionForm] = useState(false);
  const [postRepairCondition, setPostRepairCondition] = useState("PERFECT");
  const [postRepairRemarks, setPostRepairRemarks] = useState("");
  const isCompleted = ticket?.statusLabel === "Fixed & Completed";

  const handleNextOrSave = () => {
    if (status === "Fixed & Completed" && !showConditionForm) {
      setShowConditionForm(true);
      return;
    }
    if (showConditionForm) {
      onSave(ticket.id, "Fixed & Completed", postRepairCondition, postRepairRemarks);
    } else {
      onSave(ticket.id, status);
    }
    onClose();
  };

  return (
    <Dialog open={!!ticket} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">
            {showConditionForm ? "Final Post-Repair Verification & Asset Condition" : "Manage Maintenance Ticket"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {showConditionForm
              ? "Select the updated operational condition of the asset and enter technician remarks before completing repair."
              : "Review diagnostics details and update repair progress status."}
          </DialogDescription>
        </DialogHeader>

        {showConditionForm ? (
          <div className="flex flex-col gap-4 py-3">
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 text-xs space-y-1">
              <p><strong className="text-emerald-900">Target Asset:</strong> {ticket.assetName} ({ticket.assetId})</p>
              <p className="text-[11px] text-emerald-700">Status transition: <strong>MAINTENANCE ➔ RE-ASSIGNED TO CUSTODIAN</strong></p>
            </div>

            {/* Condition Selection */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-foreground">Select Post-Repair Asset Condition</Label>
              <select
                value={postRepairCondition}
                onChange={e => setPostRepairCondition(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bold"
              >
                <option value="PERFECT">PERFECT — Fully Restored &amp; Verified</option>
                <option value="OPERATIONAL">OPERATIONAL — Minor Cosmetic Wear</option>
                <option value="MINOR_DRIFT">MINOR DRIFT — Functional with Secondary Anomaly</option>
                <option value="DEGRADED">DEGRADED — Requires Monitoring</option>
                <option value="CRITICAL_DEFECT">CRITICAL DEFECT — Partial Repair / Defective</option>
              </select>
            </div>

            {/* Technician Asset Remarks */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-foreground">Technician Asset Maintenance Remarks</Label>
              <Textarea
                value={postRepairRemarks}
                onChange={e => setPostRepairRemarks(e.target.value)}
                placeholder="Enter detailed maintenance remarks (e.g. Replaced faulty PSU, updated firmware, stress tested for 2 hours OK)..."
                rows={4}
                className="text-xs resize-y"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-3">
            {/* Ticket metadata */}
            <div className="bg-muted/40 rounded-xl p-3 border text-xs space-y-1.5">
              <p><strong className="text-foreground">Ticket Ref:</strong> {ticket.id}</p>
              <p><strong className="text-foreground">Asset:</strong> {ticket.assetName} ({ticket.assetId})</p>
              <p><strong className="text-foreground">Submitted By:</strong> {ticket.custodian} on {ticket.submittedAt}</p>
              <p><strong className="text-foreground">Dispatched To:</strong> {ticket.forwardedTo || "ITS/TSG"}</p>
              <p><strong className="text-foreground">Urgency Priority:</strong> <span className={cn("font-bold", ticket.priority === "Critical" ? "text-red-700" : "text-amber-700")}>{ticket.priority}</span></p>
            </div>

            {/* Diagnostic Description */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Incident Diagnostic Description</Label>
              <p className="text-xs text-foreground bg-muted/20 p-3 rounded-lg border border-dashed border-border leading-relaxed italic font-serif">
                "{ticket.description || "No specific details logged by the custodian."}"
              </p>
            </div>

            {/* Custodian Uploaded Media */}
            {ticket.imageUrl && (
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">Custodian Uploaded Media</Label>
                <div className="rounded-lg overflow-hidden border border-border max-h-48 flex justify-center bg-black/5">
                  <img src={ticket.imageUrl} alt="troubleshooting screenshot" className="max-h-48 object-contain w-full" />
                </div>
              </div>
            )}

            {/* Progress Selector */}
            {!isCompleted && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Select Current Repair Progress</Label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="Inspection Phase">Inspection Phase (Ongoing Diagnostic checks)</option>
                  <option value="Warranty Holder Possession">Warranty Holder's Possession (Under Warranty Service)</option>
                  <option value="Third-Party Repairer Possession">Third-Party Repairer's Possession (Out-of-Warranty / Expired)</option>
                  <option value="Fixed & Completed">Fixed &amp; Completed (Re-assign to Custodian)</option>
                </select>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {showConditionForm ? (
            <Button variant="outline" size="sm" onClick={() => setShowConditionForm(false)}>Back</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          )}
          {!isCompleted && (
            <Button onClick={handleNextOrSave} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9">
              {showConditionForm ? "Finalize & Update Asset Condition" : status === "Fixed & Completed" ? "Next: Set Asset Condition ➔" : "Update Progress"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
