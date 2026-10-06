import { useState, useRef } from "react";
import { useServerData } from "@web/state/serverData";
import * as repairsApi from "@web/api/repairs.api";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, CheckCircle, Wrench, Trash2,
  FileText, Calendar, DollarSign, ChevronRight,
} from "lucide-react";
import type { AssetDetail } from "./AssetDetailModal";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Badge } from "@web/components/ui/badge";
import { Separator } from "@web/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@web/components/ui/select";
import { cn } from "@web/components/ui/utils";

const BRAND = "#005A36";

type RequestType = "repair";
type OutcomeType = "repaired" | "disposed" | null;

type PipelineStatus = "pending" | "active" | "done";
interface PipelineStep { label: string; sublabel: string; status: PipelineStatus; }

function ApprovalPipeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold text-muted-foreground tracking-[2px] uppercase mb-3">
        Approvals Pipeline Monitor
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
              <div className="text-center mt-1.5 px-0.5">
                <p className={cn(
                  "text-[10px] font-bold leading-tight",
                  step.status === "pending" ? "text-muted-foreground" : "text-foreground"
                )}>{step.label}</p>
                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{step.sublabel}</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-shrink-0 mt-3.5 mx-0.5" style={{ width: 24 }}>
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

const DISPOSAL_METHODS = [
  "Decommission — Scrap / Recycle",
  "Decommission — Donate to Partner Institution",
  "Decommission — Warranty Return to Vendor",
  "Decommission — Institutional Auction",
  "Decommission — Secure Data Wipe + Disposal",
];

interface Props {
  asset: AssetDetail;
  onBack: () => void;
  onClose: () => void;
}

export function RepairForm({ asset, onBack, onClose }: Props) {
  const { addRepairRequest } = useServerData();
  const [justification, setJustification] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [outcomeTab, setOutcomeTab] = useState<OutcomeType>(null);
  const [forwardTarget, setForwardTarget] = useState<"TSG" | "ITS" | "Both">("TSG");

  // Resolution fields
  const [dateCompleted, setDateCompleted] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [disposalMethod, setDisposalMethod] = useState("");
  const [decommDate, setDecommDate] = useState("");

  const [refId] = useState(`MNT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
  const submitLockRef = useRef(false);

  const pipelineSteps: PipelineStep[] = [
    { label: "Lab Head Validation", sublabel: "Priority classification", status: "active" },
    { label: "TSG Core Assignment", sublabel: "Technician dispatch", status: "pending" },
    { label: "ITS Central Override", sublabel: "Conditional if required", status: "pending" },
  ];

  const canSubmit = justification.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = await repairsApi.requestRepair(asset.id, {
        reportedBy: asset.custodian || "Active Custodian",
        description: justification,
        isImmediate: false,
      });
      if (!data.success) {
        setSubmitError(data.error || "Failed to log repair request to the database.");
      }
    } catch (err: any) {
      setSubmitError(err.message || "Failed to reach the server.");
    } finally {
      submitLockRef.current = false;
    }

    addRepairRequest({
      id: refId,
      assetId: asset.id,
      assetName: asset.name,
      custodian: asset.custodian || "Active Custodian",
      statusLabel: "Under Evaluation",
      description: justification,
      submittedAt: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      priority: "Medium",
      acknowledged: false,
      forwardedTo: forwardTarget
    });
    setSubmitting(false);
    setSubmitted(true);
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
              Incident Logged
            </h3>
            <p className="text-sm text-muted-foreground">
              Repair request queued. TSG technician will be assigned shortly.
            </p>
          </div>
          {submitError && (
            <div className="w-full rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 text-left">
              Logged locally, but couldn't reach the ITS database: {submitError}
            </div>
          )}
          <div className="w-full rounded-xl bg-[#F3F4F6] border border-border p-4 text-left space-y-2">
            <div>
              <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Incident Reference</p>
              <p className="text-sm font-bold text-primary font-mono">{refId}</p>
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Asset</p>
              <p className="text-xs font-semibold text-foreground">{asset.name} ({asset.id})</p>
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Type</p>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                Repair Request
              </Badge>
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Forward Destination</p>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                {forwardTarget === "TSG" ? "Technical Support Group (TSG)" : forwardTarget === "ITS" ? "Information Technology Services (ITS)" : "Both (TSG & ITS)"}
              </Badge>
            </div>
          </div>

          {/* Post-evaluation outcome tabs */}
          <div className="w-full">
            <p className="text-[10px] font-extrabold text-muted-foreground tracking-[2px] uppercase mb-2">
              Resolution Outcome (Post-Evaluation)
            </p>
            <div className="flex gap-2 mb-3">
              <Button
                size="sm"
                variant={outcomeTab === "repaired" ? "default" : "outline"}
                className={cn("flex-1 text-xs", outcomeTab === "repaired" ? "" : "text-muted-foreground")}
                onClick={() => setOutcomeTab(outcomeTab === "repaired" ? null : "repaired")}
              >
                <CheckCircle size={11} /> If Repaired
              </Button>
              <Button
                size="sm"
                variant={outcomeTab === "disposed" ? "default" : "outline"}
                className={cn("flex-1 text-xs", outcomeTab === "disposed" ? "bg-red-600 hover:bg-red-700 border-red-600" : "text-muted-foreground")}
                onClick={() => setOutcomeTab(outcomeTab === "disposed" ? null : "disposed")}
              >
                <Trash2 size={11} /> If Disposed
              </Button>
            </div>

            <AnimatePresence>
              {outcomeTab === "repaired" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-extrabold tracking-[1.5px] text-emerald-700 uppercase flex items-center gap-1.5">
                        <Calendar size={9} /> Date Completed
                      </Label>
                      <Input type="date" value={dateCompleted} onChange={e => setDateCompleted(e.target.value)} className="bg-white border-emerald-200" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-extrabold tracking-[1.5px] text-emerald-700 uppercase flex items-center gap-1.5">
                        <DollarSign size={9} /> Total Financial Repair Cost (₱)
                      </Label>
                      <Input
                        type="number"
                        value={repairCost}
                        onChange={e => setRepairCost(e.target.value)}
                        placeholder="0.00"
                        className="bg-white border-emerald-200"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
              {outcomeTab === "disposed" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-extrabold tracking-[1.5px] text-red-700 uppercase">
                        Disposal Method
                      </Label>
                      <Select value={disposalMethod} onValueChange={setDisposalMethod}>
                        <SelectTrigger className="bg-white border-red-200 text-sm">
                          <SelectValue placeholder="Select disposal pathway…" />
                        </SelectTrigger>
                        <SelectContent>
                          {DISPOSAL_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-extrabold tracking-[1.5px] text-red-700 uppercase flex items-center gap-1.5">
                        <Calendar size={9} /> Final Decommission Date
                      </Label>
                      <Input type="date" value={decommDate} onChange={e => setDecommDate(e.target.value)} className="bg-white border-red-200" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button size="sm" onClick={onClose} style={{ background: BRAND, color: "#fff" }}>
            Close
          </Button>
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
          {/* Sub-header */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FFFBEB" }}>
              <Wrench size={15} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Repair &amp; Maintenance Request
              </p>
              <p className="text-[11px] text-muted-foreground">Log hardware anomalies to the core optimization track</p>
            </div>
          </div>

          <Separator />

          {/* Asset Tag */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase">Asset Tag</Label>
            <Input value={asset.id} disabled className="font-mono bg-[#F3F4F6] text-muted-foreground" />
          </div>

          {/* Request Type Label (Fixed to Repair Request) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase">
              Request Type
            </Label>
            <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-extrabold flex items-center gap-2">
              <Wrench size={14} className="text-amber-600" /> Repair Request
            </div>
          </div>

          {/* Forward Target Department */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase">
              Forward Target Department
            </Label>
            <select
              value={forwardTarget}
              onChange={e => setForwardTarget(e.target.value as any)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bold"
            >
              <option value="TSG">Technical Support Group (TSG)</option>
              <option value="ITS">Information Technology Services (ITS)</option>
              <option value="Both">Both Departments (TSG &amp; ITS)</option>
            </select>
          </div>

          {/* Justification */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
              <FileText size={10} /> Justification / Fault Description
            </Label>
            <textarea
              value={justification}
              onChange={e => setJustification(e.target.value)}
              rows={4}
              placeholder="Describe the fault, anomaly, or performance degradation observed. Include when it occurred, diagnostic test results, error codes, physical damage, etc."
              className="w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Approval pipeline */}
          <div className="rounded-xl bg-[#F3F4F6] border border-border p-4">
            <ApprovalPipeline steps={pipelineSteps} />
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2.5">
            <Button variant="outline" onClick={onBack} className="gap-1.5 text-muted-foreground">
              <ArrowLeft size={13} /> Back
            </Button>
            <Button
              className="flex-1 gap-2 font-bold"
              style={{
                background: canSubmit ? BRAND : undefined,
                color: canSubmit ? "#fff" : undefined,
              }}
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full" /> Logging…</>
              ) : (
                <><Wrench size={14} /> Log Incident to Maintenance Queue</>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}