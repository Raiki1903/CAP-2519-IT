/**
 * Borrow request form shown to a Custodian from the asset detail modal.
 * Layer: feature component. Called by features/assets/AssetDetailModal.tsx.
 * Calls: api/loans.api.ts requestLoan(), then state/serverData.tsx syncFromDb().
 * Used by: Custodian borrow request (a Lab Head decides it).
 */
import { useState, useEffect } from "react";
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
import { Badge } from "@web/components/ui/badge";
import { Separator } from "@web/components/ui/separator";
import { cn } from "@web/components/ui/utils";

const BRAND = "#005A36";
// TODO(M-03): one more hardcoded lab list, in short codes, separate from shared/constants/labs.ts and research_centers. Phase 3.
const LABS = ["CITe4D", "CAR", "CeLT", "CeHCI", "Bio", "HXIL", "GAME", "CIVI", "CNIS", "TE3D"];

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
        Governance Approvals Pipeline
      </p>
      <div className="flex items-start">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0",
                step.status === "done" ? "border-emerald-500 bg-emerald-500 text-white" :
                  step.status === "active" ? "border-[#005A36] bg-white text-[#005A36]" :
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
                <div className={cn("h-0.5", step.status === "done" ? "bg-emerald-400" : "bg-border")} />
                <ChevronRight size={10} className={cn("mx-auto -mt-1.5", step.status === "done" ? "text-emerald-400" : "text-muted-foreground")} />
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
 * Collects borrower, destination lab, purpose, and due date, then submits a borrow request
 * through loansApi.requestLoan(). A refusal (for example a pending request already on the
 * asset, H-05) shows the server's message under the form. The reference shown on the
 * success screen is made up in the browser; it is not the loan's id in asset_loans.
 *
 * @param asset the asset being requested, for the tag and the header
 * @param onBack returns to the asset detail view
 * @param onClose closes the modal from the success screen
 */
export function LoanForm({ asset, onBack, onClose }: Props) {
  const { currentUser } = useSession();
  const { syncFromDb } = useServerData();
  // TODO(H-10): the server picks the borrower by matching this typed name, so editing it can file the loan under someone else. Phase 3 (borrower from the session, issue #32).
  const [borrower, setBorrower] = useState(() => {
    return currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "A. Dela Cruz (Active Custodian)";
  });

  useEffect(() => {
    if (currentUser) {
      setBorrower(`${currentUser.firstName} ${currentUser.lastName}`);
    }
  }, [currentUser]);
  const [selectedLab, setSelectedLab] = useState("CITe4D");
  const [purpose, setPurpose] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [refId] = useState(`LOAN-${Date.now().toString().slice(-6)}`);

  const pipelineSteps: PipelineStep[] = [
    { label: "Request Lodged", sublabel: "Custodian signature", status: submitted ? "done" : "active" },
    { label: "Lab Head Approval", sublabel: "Digital handshake auth", status: submitted ? "active" : "pending" },
    { label: "TSG Verification", sublabel: "Asset check-out complete", status: "pending" },
  ];

  const canSubmit = borrower && selectedLab && purpose && dueDate;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await loansApi.requestLoan(asset.id, { borrower, lab: selectedLab, purpose, dueDate });
      if (!result.success) {
        throw new Error(result.error || "Loan request failed");
      }

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
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="font-extrabold text-foreground mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Loan Request Lodged
            </h3>
            <p className="text-sm text-muted-foreground">
              Your request has been successfully submitted and forwarded to the Lab Head for approval.
            </p>
          </div>
          <div className="w-full rounded-xl bg-[#F3F4F6] border border-border p-4 text-left">
            <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase mb-2">Loan Reference</p>
            <p className="text-sm font-bold text-primary font-mono">{refId}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{asset.name} → {borrower}</p>
          </div>
          <ApprovalPipeline steps={pipelineSteps} />
          <Button size="sm" onClick={onClose} className="mt-2" style={{ background: BRAND, color: "#fff" }}>
            Close
          </Button>
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#005A36] hover:bg-emerald-50" onClick={onBack}>
              <ArrowLeft size={16} />
            </Button>
            <div>
              <h3 className="font-extrabold text-foreground text-sm leading-none" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Borrow Equipment Request
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">Initiating loan approval chain for active asset</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-[#F9FAFB] p-3 mb-5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-primary flex-shrink-0">
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
                <User size={10} /> Proposed Borrower Name
              </Label>
              <Input
                value={borrower}
                onChange={e => setBorrower(e.target.value)}
                placeholder="Enter borrower name"
                className="h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
                <MapPin size={10} /> Research Lab Destination
              </Label>
              <div className="relative">
                <select
                  value={selectedLab}
                  onChange={e => setSelectedLab(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {LABS.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
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
                <Calendar size={10} /> Expected Return Date
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <Separator className="my-2" />

            {submitError && (
              <p className="text-xs text-red-600 -mt-2">{submitError}</p>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={onBack} disabled={submitting}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="font-bold text-white shadow-md transition-all duration-200"
                style={{ background: BRAND }}
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