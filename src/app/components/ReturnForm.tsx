import { useState } from "react";
import { useApp } from "../context";
import { motion, AnimatePresence } from "motion/react";
import {
  X, ArrowLeft, CheckCircle, CornerUpLeft,
  User, Calendar, ClipboardCheck, ToggleLeft, Hash, FileText
} from "lucide-react";
import type { AssetDetail } from "./AssetDetailModal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import { Checkbox } from "./ui/checkbox";
import { cn } from "./ui/utils";

const BRAND = "#005A36";

const CONDITIONS = ["Pristine", "Operational", "Degraded", "Complete Failure"];

const ACCESSORIES: { id: string; label: string }[] = [
  { id: "power_adapter",    label: "Power Adapter / Charger"   },
  { id: "connecting_links", label: "Connecting Linkages / Cables" },
  { id: "calibration_kit",  label: "Calibration Kit"            },
  { id: "protective_case",  label: "Protective Case / Bag"      },
  { id: "documentation",    label: "Original Documentation"     },
  { id: "accessories_box",  label: "Accessories Box / Bundle"   },
];

interface Props {
  asset: AssetDetail;
  onBack: () => void;
  onClose: () => void;
}

export function ReturnForm({ asset, onBack, onClose }: Props) {
  const { role, addReturnRequest, finalizeReturn, returns } = useApp();

  const [returnDate, setReturnDate]       = useState(new Date().toISOString().split("T")[0]);
  const [condition, setCondition]         = useState("");
  const [accessories, setAccessories]     = useState<Record<string, boolean>>({});
  const [inspection, setInspection]       = useState(""); // Custodian turn-in comments OR TSG notes
  const [clearanceIssued, setClearance]   = useState(false);
  const [submitted, setSubmitted]         = useState(false);
  const [submitting, setSubmitting]       = useState(false);

  const pendingReturn = returns.find(r => r.assetId === asset.id && r.status === "Pending");

  const toggleAccessory = (id: string) =>
    setAccessories(prev => ({ ...prev, [id]: !prev[id] }));

  const checkedCount = Object.values(accessories).filter(Boolean).length;
  
  const isCustodian = role === "Custodian";
  const canSubmit = isCustodian ? !!returnDate : (!!returnDate && !!condition);

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setTimeout(() => {
      if (isCustodian) {
        addReturnRequest({
          id: `RET-${Date.now().toString().slice(-6)}`,
          assetId: asset.id,
          assetName: asset.name,
          custodian: asset.custodian || "Active Custodian",
          returnDate,
          comments: inspection,
          status: "Pending"
        });
      } else {
        const reqId = pendingReturn ? pendingReturn.id : `RET-${Date.now().toString().slice(-6)}`;
        finalizeReturn(
          reqId,
          asset.id,
          condition,
          Object.keys(accessories).filter(k => accessories[k]),
          inspection,
          clearanceIssued
        );
      }
      setSubmitting(false);
      setSubmitted(true);
    }, 1400);
  };

  const conditionColor: Record<string, string> = {
    Pristine:          "text-emerald-700",
    Operational:       "text-blue-700",
    Degraded:          "text-amber-700",
    "Complete Failure": "text-red-700",
  };

  // Find certId if finalized
  const finalizedRequest = returns.find(r => r.assetId === asset.id && r.status === "Finalized");
  const displayCertId = finalizedRequest?.certId || `CLR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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
              {isCustodian ? "Return Initiated" : "Return Ledger Closed"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isCustodian
                ? "Return request submitted. Please hand over the physical device to TSG."
                : "Asset return has been finalized and registry status set to Available."}
            </p>
          </div>
          <div className="w-full rounded-xl bg-[#F3F4F6] border border-border p-4 text-left space-y-2">
            <div>
              <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Asset</p>
              <p className="text-xs font-semibold text-foreground">{asset.name} ({asset.id})</p>
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Return Date</p>
              <p className="text-xs font-semibold text-foreground">{returnDate}</p>
            </div>
            {!isCustodian && (
              <>
                <div>
                  <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Condition</p>
                  <p className={cn("text-xs font-bold", conditionColor[condition] ?? "")}>{condition}</p>
                </div>
                {clearanceIssued && (
                  <div>
                    <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Clearance Certificate</p>
                    <p className="text-xs font-bold text-primary font-mono">{displayCertId}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Badge className={clearanceIssued
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                    : "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                  }>
                    {clearanceIssued ? "Clearance Issued" : "Pending Clearance Review"}
                  </Badge>
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                    {checkedCount}/{ACCESSORIES.length} items returned
                  </Badge>
                </div>
              </>
            )}
            {isCustodian && (
              <div>
                <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Turn-In Comments</p>
                <p className="text-xs font-semibold text-foreground italic">"{inspection || "No comments."}"</p>
              </div>
            )}
          </div>
          <Button size="sm" onClick={onClose} className="mt-2" style={{ background: BRAND, color: "#fff" }}>
            Close
          </Button>
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
          {/* Sub-header */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F0FDF4" }}>
              <CornerUpLeft size={15} style={{ color: BRAND }} />
            </div>
            <div>
              <p className="text-sm font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Asset Return
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isCustodian
                  ? "Initiate formal property turn-in request"
                  : "Finalize property inspection and close asset ledger"}
              </p>
            </div>
          </div>

          <Separator />

          {/* Pending return info for TSG */}
          {!isCustodian && pendingReturn && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 space-y-1">
              <p className="font-extrabold uppercase tracking-wider text-[9px] text-blue-700">Custodian Turn-in Comments</p>
              <p><strong>Proposed Date:</strong> {pendingReturn.returnDate}</p>
              <p className="italic">"{pendingReturn.comments || "No comments."}"</p>
            </div>
          )}

          {/* Asset Tag */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase">Asset Tag</Label>
            <Input value={asset.id} disabled className="font-mono bg-[#F3F4F6] text-muted-foreground" />
          </div>

          {/* Responsible Person */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
              <User size={10} /> Responsible Custodian
            </Label>
            <Input
              value={asset.custodian ?? "Current Active Custodian"}
              disabled
              className="bg-[#F3F4F6] text-muted-foreground"
            />
          </div>

          {/* Return Date */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
              <Calendar size={10} /> Return Date
            </Label>
            <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
          </div>

          {/* Role-Based Forms Partitioning */}
          {isCustodian ? (
            /* Custodian View: Turn-in comments only */
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
                <FileText size={10} /> Custodian Turn-In Comments
              </Label>
              <textarea
                value={inspection}
                onChange={e => setInspection(e.target.value)}
                rows={3}
                placeholder="List accessories returned, state of the device, or turn-in justification..."
                className="w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          ) : (
            /* TSG / ITS View: Full inspection checklist and diagnostics */
            <>
              {/* Condition on Return */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase">
                  Condition on Return
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {CONDITIONS.map(c => (
                    <motion.button
                      key={c}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setCondition(c)}
                      className={cn(
                        "rounded-lg border-2 py-2.5 text-xs font-bold transition-colors",
                        condition === c
                          ? c === "Pristine" || c === "Operational"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : c === "Degraded"
                              ? "border-amber-500 bg-amber-50 text-amber-700"
                              : "border-red-500 bg-red-50 text-red-700"
                          : "border-border bg-white text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {condition === c && <CheckCircle size={10} className="inline mr-1" />}
                      {c}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Accessories Checklist */}
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center justify-between">
                  <span>Accessories / Bundle Items</span>
                  <Badge className="bg-[#F3F4F6] text-muted-foreground border-border text-[9px] font-bold">
                    {checkedCount} / {ACCESSORIES.length} checked
                  </Badge>
                </Label>
                <div className="rounded-xl bg-[#F3F4F6] border border-border p-3 grid grid-cols-2 gap-2">
                  {ACCESSORIES.map(({ id, label }) => (
                    <label
                      key={id}
                      className="flex items-center gap-2.5 cursor-pointer group"
                    >
                      <Checkbox
                        checked={accessories[id] ?? false}
                        onCheckedChange={() => toggleAccessory(id)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <span className="text-xs text-foreground group-hover:text-primary transition-colors leading-tight">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* TSG Inspection Result */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
                  <ClipboardCheck size={10} /> TSG Inspection Notes
                </Label>
                <textarea
                  value={inspection}
                  onChange={e => setInspection(e.target.value)}
                  rows={3}
                  placeholder="Hardware performance analytics, physical condition observations, test results, anomalies detected during turn-in inspection…"
                  className="w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              {/* Clearance Issued Toggle */}
              <div className="rounded-xl bg-[#F3F4F6] border border-border p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <ToggleLeft size={15} style={{ color: BRAND }} />
                    Clearance Issued
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Toggle to confirm no outstanding holds or academic encumbrances
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <span className={cn("text-xs font-bold", clearanceIssued ? "text-muted-foreground" : "text-foreground")}>No</span>
                  <Switch
                    checked={clearanceIssued}
                    onCheckedChange={setClearance}
                    className="data-[state=checked]:bg-primary"
                  />
                  <span className={cn("text-xs font-bold", clearanceIssued ? "text-foreground" : "text-muted-foreground")}>Yes</span>
                </div>
              </div>

              {/* Clearance Certificate ID — conditional reveal */}
              <AnimatePresence>
                {clearanceIssued && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-1.5 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3">
                      <Label className="text-[10px] font-extrabold tracking-[1.5px] text-emerald-700 uppercase flex items-center gap-1.5">
                        <Hash size={10} /> Clearance Certificate ID — Auto-Generated
                      </Label>
                      <Input
                        value={displayCertId}
                        disabled
                        className="font-mono font-bold text-primary bg-white border-emerald-200"
                      />
                      <p className="text-[10px] text-emerald-700">
                        This reference is permanently bound to the return ledger record.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-2.5">
            <Button
              variant="outline"
              onClick={onBack}
              className="gap-1.5 bg-foreground/5 text-foreground border-border hover:bg-foreground/10"
            >
              <ArrowLeft size={13} /> Back
            </Button>
            <Button
              className="flex-1 gap-2 font-bold"
              style={{ background: canSubmit ? BRAND : undefined, color: canSubmit ? "#fff" : undefined }}
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full" /> {isCustodian ? "Submitting..." : "Finalizing..."}</>
              ) : (
                <><CornerUpLeft size={14} /> {isCustodian ? "Submit Return Request" : "Finalize Return and Close Ledger"}</>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
