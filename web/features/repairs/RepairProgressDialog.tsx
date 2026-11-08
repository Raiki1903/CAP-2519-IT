/**
 * Repair progress dialog: TSG moves a maintenance ticket through its allowed steps (receive the asset, start the work,
 * change the stage, complete, cancel), and anyone with the ticket sees its details and history.
 * Layer: feature component. Called by pages/staff/RepairsPage.tsx and features/analytics/staff/StaffAnalyticsView.tsx.
 * Calls: api/maintenance.api.ts (one function per step), features/inspections/InspectionFields.tsx.
 * Used by: Staff repair handling (TSG makes the steps; the Secretary only reads).
 */
import { useState } from "react";
import type { Maintenance } from "@shared/types/maintenance";
import * as maintenanceApi from "@web/api/maintenance.api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Textarea } from "@web/components/ui/textarea";
import { Label } from "@web/components/ui/label";
import { EMPTY_INSPECTION, InspectionFields, toInspectionInput, type InspectionFieldsValue } from "@web/features/inspections/InspectionFields";

/** The step form the dialog shows. "view" is the ticket itself. */
type Mode = "view" | "receive" | "start" | "stage" | "complete" | "cancel";

const STAGE_LABELS = { REPAIRING: "Repairing (TSG repairs it)", EXTERNAL_SERVICE: "External Service (the warranty holder or a repair shop)" } as const;

/** A date-time as "Oct 9, 2026, 02:15 PM". */
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Shows the ticket and, for TSG, the buttons for the steps its status allows. Each step is sent through its own api
 * function; a refusal shows the server's sentence and keeps the dialog open.
 *
 * @param ticket the ticket in the Maintenance shape
 * @param canAct true for TSG, which makes the physical steps; false shows the ticket read-only
 * @param startMode the step form to open first (the Receive button on the list opens straight to "receive")
 * @param onClose closes the dialog
 * @param onChanged called after a step was saved, so the page reloads the tickets and the assets
 */
export function RepairProgressDialog({ ticket, canAct, startMode = "view", onClose, onChanged }: {
  ticket: Maintenance;
  canAct: boolean;
  startMode?: Mode;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>(startMode);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [inspection, setInspection] = useState<InspectionFieldsValue>(EMPTY_INSPECTION);
  const [stage, setStage] = useState<"REPAIRING" | "EXTERNAL_SERVICE">("REPAIRING");
  const [provider, setProvider] = useState(ticket.provider ?? "");
  const [overrideReason, setOverrideReason] = useState("");
  const [outcome, setOutcome] = useState<"RESOLVED" | "BEYOND_REPAIR">("RESOLVED");
  const [remarks, setRemarks] = useState("");

  const status = ticket.status;
  const warrantyUntil = ticket.asset.warrantyExpiry;
  // The stage change goes to the other stage, so it has no stage select.
  const targetStage = mode === "stage" ? (status === "REPAIRING" ? "EXTERNAL_SERVICE" : "REPAIRING") : stage;

  const steps: { mode: Mode; label: string }[] = [];
  if (canAct) {
    if (status === "PENDING_RECEIPT") steps.push({ mode: "receive", label: "Receive the asset" }, { mode: "cancel", label: "Cancel ticket" });
    if (status === "INSPECTING") steps.push({ mode: "start", label: "Start the work" }, { mode: "complete", label: "Complete" }, { mode: "cancel", label: "Cancel ticket" });
    if (status === "REPAIRING" || status === "EXTERNAL_SERVICE") {
      steps.push({ mode: "stage", label: status === "REPAIRING" ? "Send to External Service" : "Back to Repairing" }, { mode: "complete", label: "Complete" });
    }
  }

  const open = (next: Mode) => { setError(null); setMode(next); };

  /** Sends the step for the current form; on success reloads the page's lists and closes. */
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = ticket.maintenanceId;
      const stageBody = {
        stage: targetStage,
        provider: targetStage === "EXTERNAL_SERVICE" ? provider : null,
        warrantyOverrideReason: overrideReason.trim() || null,
      };
      const data =
        mode === "receive" ? await maintenanceApi.receiveTicket(id, { inspection: toInspectionInput(inspection) })
        : mode === "start" ? await maintenanceApi.startTicket(id, stageBody)
        : mode === "stage" ? await maintenanceApi.changeTicketStage(id, stageBody)
        : mode === "complete" ? await maintenanceApi.completeTicket(id, { outcome, resolutionRemarks: remarks, inspection: toInspectionInput(inspection) })
        : await maintenanceApi.cancelTicket(id, { remarks: remarks.trim() || null });
      if (!data.success) {
        setError(data.error || "The step could not be saved. Please try again.");
        return;
      }
      await onChanged();
      onClose();
    } catch (err: any) {
      setError(err?.message || "The server could not be reached. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const needsProvider = (mode === "start" || mode === "stage") && targetStage === "EXTERNAL_SERVICE";
  const needsReason = (mode === "start" || mode === "stage") && targetStage === "REPAIRING" && ticket.underWarranty && !ticket.warrantyOverrideReason;
  const canSubmit =
    mode === "complete" ? remarks.trim().length > 0
    : needsProvider ? provider.trim().length > 0
    : needsReason ? overrideReason.trim().length > 0
    : true;

  const titles: Record<Mode, string> = {
    view: `MNT-${ticket.maintenanceId}: ${ticket.statusLabel}`,
    receive: "Receive the asset",
    start: "Start the work",
    stage: "Change the stage",
    complete: "Complete the work",
    cancel: "Cancel this ticket",
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">{titles[mode]}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {ticket.asset.name} ({ticket.asset.tag})
          </DialogDescription>
        </DialogHeader>

        {mode === "view" ? (
          <div className="flex flex-col gap-3 py-2 text-xs">
            <div className="bg-muted/40 rounded-xl p-3 border space-y-1.5">
              <p><strong className="text-foreground">Issue type:</strong> {ticket.issueType?.name ?? "Not recorded"} ({ticket.typeLabel})</p>
              <p><strong className="text-foreground">Reported by:</strong> {"hidden" in ticket.reportedBy ? "Not shown" : ticket.reportedBy.name} on {when(ticket.reportedAt)}</p>
              {ticket.receivedAt && <p><strong className="text-foreground">Received by TSG:</strong> {when(ticket.receivedAt)}</p>}
              {warrantyUntil && (
                <p className={ticket.underWarranty ? "font-bold text-blue-700" : "text-muted-foreground"}>
                  {ticket.underWarranty ? `Under warranty until ${warrantyUntil}` : `Warranty ended ${warrantyUntil}`}
                </p>
              )}
              {ticket.provider && <p><strong className="text-foreground">With:</strong> {ticket.provider}</p>}
              {ticket.warrantyOverrideReason && <p><strong className="text-foreground">Why TSG repairs it under warranty:</strong> {ticket.warrantyOverrideReason}</p>}
            </div>
            {ticket.issueType && status === "PENDING_RECEIPT" && (
              <p className="text-[11px] text-muted-foreground">Suggested first step: {ticket.issueType.suggestedAction}</p>
            )}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">What was reported</Label>
              <p className="text-xs text-foreground bg-muted/20 p-3 rounded-lg border border-dashed border-border leading-relaxed italic">"{ticket.issueDescription}"</p>
            </div>
            {ticket.completedAt && (
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">{status === "CANCELLED" ? "Cancelled" : "Closed"} on {when(ticket.completedAt)}</Label>
                {ticket.resolutionRemarks && <p className="text-xs text-foreground bg-muted/20 p-3 rounded-lg border border-border">{ticket.resolutionRemarks}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            {mode === "receive" && (
              <>
                <p className="text-[11px] text-muted-foreground">Check the asset as it arrives. If a borrower holds it, the loan ends and the asset stays with TSG.</p>
                <InspectionFields value={inspection} onChange={setInspection} heading="Condition on arrival" />
              </>
            )}

            {(mode === "start" || mode === "stage") && (
              <>
                {warrantyUntil && ticket.underWarranty && (
                  <p className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    Under warranty until {warrantyUntil}. Send it to the warranty holder, or write why TSG repairs it.
                  </p>
                )}
                {mode === "start" ? (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Stage</Label>
                    <select
                      value={stage}
                      onChange={e => setStage(e.target.value as "REPAIRING" | "EXTERNAL_SERVICE")}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bold"
                    >
                      {(Object.keys(STAGE_LABELS) as (keyof typeof STAGE_LABELS)[]).map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-foreground">Move this ticket to <strong>{STAGE_LABELS[targetStage]}</strong>.</p>
                )}
                {needsProvider && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Provider</Label>
                    <Input value={provider} onChange={e => setProvider(e.target.value)} maxLength={255} placeholder="The warranty holder or the repair shop" className="text-xs" />
                  </div>
                )}
                {needsReason && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Why TSG repairs it under warranty</Label>
                    <Textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} rows={3} className="text-xs resize-y" />
                  </div>
                )}
              </>
            )}

            {mode === "complete" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-bold text-foreground">Outcome</Label>
                  <select
                    value={outcome}
                    onChange={e => setOutcome(e.target.value as "RESOLVED" | "BEYOND_REPAIR")}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bold"
                  >
                    <option value="RESOLVED">Resolved (the asset is Available again, back home)</option>
                    <option value="BEYOND_REPAIR">Beyond Repair (the asset stays in Maintenance until a retirement is requested)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-bold text-foreground">What was done</Label>
                  <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} maxLength={2000} placeholder="For example: replaced the PSU, stress tested for 2 hours." className="text-xs resize-y" />
                </div>
                <InspectionFields value={inspection} onChange={setInspection} heading="Condition after the work" />
              </>
            )}

            {mode === "cancel" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-foreground">Remarks (optional)</Label>
                <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} maxLength={2000} className="text-xs resize-y" />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

        <DialogFooter className="gap-2 flex-wrap">
          {mode === "view" ? (
            <>
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              {steps.map(s => (
                <Button key={s.mode} size="sm" variant={s.mode === "cancel" ? "outline" : "default"} onClick={() => open(s.mode)}
                  className={s.mode === "cancel" ? "text-red-600 border-red-200 hover:bg-red-50 font-bold text-xs" : "bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"}>
                  {s.label}
                </Button>
              ))}
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" disabled={saving} onClick={() => (startMode === "view" ? open("view") : onClose())}>Back</Button>
              <Button size="sm" disabled={saving || !canSubmit} onClick={submit} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs">
                {saving ? "Saving…" : titles[mode]}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
