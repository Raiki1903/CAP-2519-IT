import { useState } from "react";
import { useApp } from "../context";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, CheckCircle, ArrowRightLeft,
  User, MapPin, Calendar, FileText, ChevronRight,
} from "lucide-react";
import type { AssetDetail } from "./AssetDetailModal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import { cn } from "./ui/utils";

const BRAND = "#005A36";

const LABS = ["CITe4D", "CAR", "CeLT", "CeHCI", "Bio", "HXIL", "GAME", "CIVI", "COMET", "CNIS"];

type PipelineStatus = "pending" | "active" | "done";

interface PipelineStep {
  label: string;
  sublabel: string;
  status: PipelineStatus;
}

function ApprovalPipeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold text-muted-foreground tracking-[2px] uppercase mb-3">
        Governance Approvals Pipeline
      </p>
      <div className="flex items-start">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-1">
              {/* Node */}
              <div className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0",
                step.status === "done"   ? "border-emerald-500 bg-emerald-500 text-white" :
                step.status === "active" ? "border-[#005A36] bg-white text-[#005A36]" :
                "border-border bg-muted/40 text-muted-foreground"
              )}>
                {step.status === "done" ? <CheckCircle size={14} /> : i + 1}
              </div>
              {/* Label */}
              <div className="text-center mt-1.5 px-1">
                <p className={cn(
                  "text-[10px] font-bold leading-tight",
                  step.status === "pending" ? "text-muted-foreground" : "text-foreground"
                )}>{step.label}</p>
                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{step.sublabel}</p>
              </div>
            </div>
            {/* Connector */}
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

export function TransferForm({ asset, onBack, onClose }: Props) {
  const { addTransferRequest } = useApp();
  const [toField, setToField]       = useState("");
  const [location, setLocation]     = useState("");
  const [reason, setReason]         = useState("");
  const [effectiveDate, setEffDate] = useState("");
  const [submitted, setSubmitted]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refId] = useState(`TRF-${Date.now().toString().slice(-6)}`);

  const pipelineSteps: PipelineStep[] = [
    { label: "Current Owner Sign-off", sublabel: "Custodian confirmation", status: submitted ? "done" : "active" },
    { label: "Lab Head Approval",      sublabel: "Digital handshake auth",  status: submitted ? "active" : "pending" },
    { label: "TSG Log Verification",   sublabel: "Registry update",         status: "pending" },
  ];

  const canSubmit = toField && location && reason && effectiveDate;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setTimeout(() => {
      addTransferRequest({
        id: refId,
        asset: asset.name,
        assetId: asset.id,
        from: asset.custodian || "Active Custodian",
        fromRole: "Active Custodian",
        to: toField,
        toRole: "Researcher",
        lab: location,
        initiated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        status: "Pending"
      });
      setSubmitting(false);
      setSubmitted(true);
    }, 1400);
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
              Handshake Initiated
            </h3>
            <p className="text-sm text-muted-foreground">
              Transfer request logged. Lab Head approval is now pending.
            </p>
          </div>
          <div className="w-full rounded-xl bg-[#F3F4F6] border border-border p-4 text-left">
            <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase mb-2">Transfer Reference</p>
            <p className="text-sm font-bold text-primary font-mono">{refId}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{asset.name} → {toField.split(" —")[0]}</p>
          </div>
          <ApprovalPipeline steps={pipelineSteps} />
          <Button size="sm" onClick={onClose} className="mt-2" style={{ background: BRAND, color: "#fff" }}>
            Close
          </Button>
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Sub-header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F0FDF4" }}>
              <ArrowRightLeft size={15} style={{ color: BRAND }} />
            </div>
            <div>
              <p className="text-sm font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Custodianship Transfer
              </p>
              <p className="text-[11px] text-muted-foreground">Initiate formal liability handoff between research personnel</p>
            </div>
          </div>

          <Separator className="mb-4" />

          <div className="flex flex-col gap-4">
            {/* Asset Tag — disabled */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase">
                Asset Tag
              </Label>
              <Input value={asset.id} disabled className="font-mono bg-[#F3F4F6] text-muted-foreground" />
            </div>

            {/* FROM — read-only */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
                <User size={10} /> Current Custodian / Origin Lab
              </Label>
              <Input
                value={asset.custodian ?? asset.lab ?? "Current Assigned Custodian"}
                disabled
                className="bg-[#F3F4F6] text-muted-foreground"
              />
            </div>

            {/* TO — text Input */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
                <User size={10} /> Transfer To — Research Personnel
              </Label>
              <Input
                value={toField}
                onChange={e => setToField(e.target.value)}
                placeholder="Enter recipient's full name…"
              />
            </div>

            {/* Destination Laboratory */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
                <MapPin size={10} /> Destination Laboratory
              </Label>
              <select
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
              >
                <option value="" disabled>Select destination lab…</option>
                {LABS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* Effective Date */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
                <Calendar size={10} /> Effective Transfer Date
              </Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={e => setEffDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            {/* Reason */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
                <FileText size={10} /> Reason for Transfer
              </Label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="Provide justification — project transition, lab reallocation, research role change, etc."
                className="w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* Approval pipeline */}
            <div className="rounded-xl bg-[#F3F4F6] border border-border p-4">
              <ApprovalPipeline steps={pipelineSteps} />
            </div>
          </div>

          <Separator className="my-4" />

          {/* Actions */}
          <div className="flex gap-2.5">
            <Button variant="outline" onClick={onBack} className="gap-1.5 text-muted-foreground">
              <ArrowLeft size={13} /> Back
            </Button>
            <Button
              className="flex-1 gap-2 font-bold tracking-wide"
              style={{ background: canSubmit ? BRAND : undefined, color: canSubmit ? "#fff" : undefined }}
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full" /> Submitting…</>
              ) : (
                <><ArrowRightLeft size={14} /> Initiate Handshake</>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
