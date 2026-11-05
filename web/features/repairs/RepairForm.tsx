/**
 * Report an issue form, shown to the holder of an asset (or a Lab Head) from the asset detail modal.
 * Layer: feature component. Called by features/assets/AssetDetailModal.tsx.
 * Calls: api/maintenance.api.ts reportIssue(), features/lookups/useLookups.ts (the issue types), then state/serverData.tsx
 * syncFromDb().
 * Used by: Researcher and Lab Head issue reports (TSG receives the asset and handles the ticket).
 */
import { useState, useRef } from "react";
import { useServerData } from "@web/state/serverData";
import { useFormLookups } from "@web/features/lookups/useLookups";
import * as maintenanceApi from "@web/api/maintenance.api";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, CheckCircle, Wrench, FileText } from "lucide-react";
import type { AssetDetail } from "@web/features/assets/AssetDetailModal";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Badge } from "@web/components/ui/badge";
import { Separator } from "@web/components/ui/separator";

const BRAND = "#005A36";

interface Props {
  asset: AssetDetail;
  onBack: () => void;
  onClose: () => void;
}

/**
 * Collects an issue type and a description and files a ticket through maintenanceApi.reportIssue(). The issue type's
 * suggested action shows under the select. The success screen appears only when the server accepted the ticket; a
 * refusal shows the server's sentence and keeps the form open.
 *
 * @param asset the asset with the fault; the ticket is filed under the signed-in person
 * @param onBack returns to the asset detail view
 * @param onClose closes the modal from the success screen
 */
export function RepairForm({ asset, onBack, onClose }: Props) {
  const { syncFromDb } = useServerData();
  const { lookups, failed } = useFormLookups();
  const [issueTypeId, setIssueTypeId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  const issueTypes = lookups?.issueTypes ?? [];
  const chosen = issueTypes.find(t => t.issueTypeId === issueTypeId) ?? null;
  const canSubmit = chosen !== null && description.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = await maintenanceApi.reportIssue(asset.id, { issueTypeId: chosen!.issueTypeId, issueDescription: description.trim() });
      if (!data.success) {
        setSubmitError(data.error || "The issue could not be reported. Please try again.");
        return;
      }
      setSubmitted(`MNT-${data.maintenance.maintenanceId}`);
      // Reload the shared lists so the bell and the Staff screens see the new ticket.
      syncFromDb();
    } catch (err: any) {
      setSubmitError(err?.message || "The server could not be reached. Please try again.");
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {submitted ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 py-8 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
            <Wrench size={30} className="text-amber-500" />
          </div>
          <div>
            <h3 className="font-extrabold text-foreground mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Issue Reported
            </h3>
            <p className="text-sm text-muted-foreground">
              TSG will receive the asset and check it. Until then the asset stays with you.
            </p>
          </div>
          <div className="w-full rounded-xl bg-[#F3F4F6] border border-border p-4 text-left space-y-2">
            <div>
              <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Ticket</p>
              <p className="text-sm font-bold text-primary font-mono">{submitted}</p>
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Asset</p>
              <p className="text-xs font-semibold text-foreground">{asset.name} ({asset.id})</p>
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Issue type</p>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">{chosen?.name}</Badge>
            </div>
          </div>
          <Button size="sm" onClick={onClose} style={{ background: BRAND, color: "#fff" }}>
            <CheckCircle size={13} /> Close
          </Button>
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FFFBEB" }}>
              <Wrench size={15} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Report an Issue
              </p>
              <p className="text-[11px] text-muted-foreground">The asset stays with you until TSG receives it.</p>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase">Asset Tag</Label>
            <Input value={asset.id} disabled className="font-mono bg-[#F3F4F6] text-muted-foreground" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase">Issue Type</Label>
            <select
              value={issueTypeId ?? ""}
              onChange={e => setIssueTypeId(e.target.value ? Number(e.target.value) : null)}
              disabled={!lookups}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bold"
            >
              <option value="">{lookups ? "Pick an issue type" : failed ? "The issue types could not be loaded" : "Loading…"}</option>
              {issueTypes.map(t => <option key={t.issueTypeId} value={t.issueTypeId}>{t.name}</option>)}
            </select>
            {chosen && (
              <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <strong>Suggested first step:</strong> {chosen.suggestedAction}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
              <FileText size={10} /> Describe the Issue
            </Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="What happens, and when did it start? Include error messages or visible damage."
              className="w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {submitError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{submitError}</p>
          )}

          <Separator />

          <div className="flex gap-2.5">
            <Button variant="outline" onClick={onBack} className="gap-1.5 text-muted-foreground">
              <ArrowLeft size={13} /> Back
            </Button>
            <Button
              className="flex-1 gap-2 font-bold"
              style={{ background: canSubmit ? BRAND : undefined, color: canSubmit ? "#fff" : undefined }}
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full" /> Sending…</>
              ) : (
                <><Wrench size={14} /> Report Issue</>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
