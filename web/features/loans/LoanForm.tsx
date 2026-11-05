/**
 * Borrow request form shown to a Custodian from the asset detail modal.
 * Layer: feature component. Called by features/assets/AssetDetailModal.tsx.
 * Calls: api/loans.api.ts requestLoan(), then state/serverData.tsx syncFromDb(); state/session.tsx (the borrower's labs).
 * Used by: Custodian borrow request (the Head of the asset's lab decides it).
 */
import { useState } from "react";
import { useSession } from "@web/state/session";
import { useServerData } from "@web/state/serverData";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, CheckCircle, User, MapPin, Calendar, FileText, ChevronRight, Bookmark
} from "lucide-react";
import type { AssetDetail } from "@web/features/assets/AssetDetailModal";
import * as loansApi from "@web/api/loans.api";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { Badge } from "@web/components/ui/badge";
import { Separator } from "@web/components/ui/separator";
import { cn } from "@web/components/ui/utils";

/** Today as yyyy-mm-dd in the browser's time zone. toISOString() would give the UTC date, a day early before 8 AM in Manila. */
function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type PipelineStatus = "pending" | "active" | "done";

interface PipelineStep {
  label: string;
  sublabel: string;
  status: PipelineStatus;
}

function ApprovalPipeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold text-muted-foreground tracking-[2px] uppercase mb-3 text-center">
        Approval Steps
      </p>
      <div className="flex items-start">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0",
                step.status === "done" ? "border-primary bg-primary text-primary-foreground" :
                  step.status === "active" ? "border-primary bg-background text-primary" :
                    "border-border bg-muted/40 text-muted-foreground"
              )}>
                {step.status === "done" ? <CheckCircle size={14} /> : i + 1}
              </div>
              <div className="text-center mt-1.5 px-1">
                <p className={cn(
                  "text-[10px] font-bold leading-tight",
                  step.status === "pending" ? "text-muted-foreground" : "text-foreground"
                )}>{step.label}</p>
                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{step.sublabel}</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-shrink-0 mt-3.5 mx-0.5" style={{ width: 28 }}>
                <div className={cn("h-0.5", step.status === "done" ? "bg-primary" : "bg-border")} />
                <ChevronRight size={10} className={cn("mx-auto -mt-1.5", step.status === "done" ? "text-primary" : "text-muted-foreground")} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  asset: AssetDetail;
  onBack: () => void;
  onClose: () => void;
}

/**
 * Collects the destination lab (one of the borrower's own labs), an optional room, purpose, and return-by date, then
 * submits a loan request through loansApi.requestLoan(). The borrower is the logged-in user, shown read-only: the
 * server takes it from the session (issue #32). A refusal (for example a loan already waiting on the asset, H-05)
 * shows the server's sentence under the form. The reference on the success screen is the new loan's id.
 *
 * @param asset the asset being requested, for the tag and the header
 * @param onBack returns to the asset detail view
 * @param onClose closes the modal from the success screen
 */
export function LoanForm({ asset, onBack, onClose }: Props) {
  const { currentUser } = useSession();
  const { syncFromDb } = useServerData();
  const borrower = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "";
  // Only the borrower's own labs can be the destination; the server refuses any other.
  const myLabs = currentUser?.labs ?? [];
  const [selectedLabId, setSelectedLabId] = useState<number | null>(myLabs[0]?.centerId ?? null);
  const [room, setRoom] = useState("");
  const [purpose, setPurpose] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [refId, setRefId] = useState("");

  const pipelineSteps: PipelineStep[] = [
    { label: "Request Sent", sublabel: "By you", status: submitted ? "done" : "active" },
    { label: "Lab Head Approval", sublabel: "Approve or decline", status: submitted ? "active" : "pending" },
    { label: "Collect the Asset", sublabel: "After approval, get it from the lab", status: "pending" },
  ];

  const today = localToday();
  // The picker's min stops a click on a past day, but a typed date still gets through, so it is checked here too.
  const dueDateInPast = !!dueDate && dueDate < today;
  const canSubmit = selectedLabId !== null && purpose && dueDate && !dueDateInPast;

  const handleSubmit = async () => {
    if (!canSubmit || selectedLabId === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await loansApi.requestLoan(asset.id, {
        destinationCenterId: selectedLabId,
        destinationRoom: room.trim() || null,
        returnBy: dueDate,
        purpose,
      });
      if (!result.success) {
        throw new Error(result.error || "Loan request failed");
      }

      setRefId(`LOAN-${result.loan.loanId}`);
      syncFromDb();
      setSubmitted(true);
    } catch (err: any) {
      console.error("❌ Loan request failed:", err);
      setSubmitError(err.message || "Could not reach the server. Please try again.");
    } finally {
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
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle size={32} className="text-primary" />
          </div>
          <div>
            <h3 className="font-extrabold text-foreground mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Loan Request Sent
            </h3>
            <p className="text-sm text-muted-foreground">
              Your request went to the Lab Head for approval.
            </p>
          </div>
          <div className="w-full rounded-xl bg-muted/40 border border-border p-4 text-left">
            <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase mb-2">Loan Reference</p>
            <p className="text-sm font-bold text-primary font-mono">{refId}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{asset.name} → {borrower}</p>
          </div>
          <ApprovalPipeline steps={pipelineSteps} />
          <Button size="sm" onClick={onClose} className="mt-2">
            Close
          </Button>
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={onBack}>
              <ArrowLeft size={16} />
            </Button>
            <div>
              <h3 className="font-extrabold text-foreground text-sm leading-none" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Request a Loan
              </h3>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-3 mb-5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <Bookmark size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground line-clamp-1">{asset.name}</p>
              <p className="text-[10px] text-muted-foreground">{asset.id} · Serial: {asset.serial || "N/A"}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
                <User size={10} /> Borrower (you)
              </Label>
              <Input
                value={borrower}
                readOnly
                aria-readonly="true"
                className="h-9 text-xs bg-muted/40 text-muted-foreground cursor-default"
              />
            </div>

            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
                <MapPin size={10} /> Research Lab Destination
              </Label>
              <Select
                value={selectedLabId !== null ? String(selectedLabId) : ""}
                onValueChange={v => setSelectedLabId(Number(v))}
                disabled={myLabs.length === 0}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select a lab" />
                </SelectTrigger>
                <SelectContent>
                  {myLabs.map(l => (
                    <SelectItem key={l.centerId} value={String(l.centerId)}>{l.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {myLabs.length === 0 && <p className="text-[10px] text-destructive mt-1">You are not in any lab yet, so you cannot request a loan.</p>}
            </div>

            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
                <MapPin size={10} /> Room (optional)
              </Label>
              <Input
                value={room}
                maxLength={100}
                onChange={e => setRoom(e.target.value)}
                placeholder="e.g. Room 301"
                className="h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
                <FileText size={10} /> Purpose / Project Details
              </Label>
              <Input
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="e.g. Thesis data collection, Deep Learning model testing"
                className="h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
                <Calendar size={10} /> Return By
              </Label>
              <Input
                type="date"
                value={dueDate}
                min={today}
                onChange={e => setDueDate(e.target.value)}
                className="h-9 text-xs"
              />
              {dueDateInPast && (
                <p className="text-xs text-destructive mt-1">The return-by date cannot be in the past.</p>
              )}
            </div>

            <Separator className="my-2" />

            {submitError && (
              <p className="text-xs text-destructive -mt-2">{submitError}</p>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={onBack} disabled={submitting}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}