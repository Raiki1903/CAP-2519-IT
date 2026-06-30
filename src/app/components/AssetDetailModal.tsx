import { useState } from "react";
import { useApp } from "../context";
import { motion, AnimatePresence } from "motion/react";
import {
  X, ArrowRightLeft, Wrench, CornerUpLeft,
  Tag, MapPin, Building2, Calendar, Activity,
} from "lucide-react";
import { AssetImagePlaceholder } from "./AssetImagePlaceholder";
import { TransferForm } from "./TransferForm";
import { ReturnForm }   from "./ReturnForm";
import { RepairForm }   from "./RepairForm";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge }  from "./ui/badge";
import { Separator } from "./ui/separator";
import { cn } from "./ui/utils";

// ── Shared asset shape used by all asset lists ────────────────────────────
export interface AssetDetail {
  id: string;
  name: string;
  serial?: string;
  manufacturer?: string;
  category: string;
  funding?: string;
  procured?: string;
  warranty?: string;
  location?: string;
  lab?: string;
  status: string;
  condition?: number;
  custodian?: string;
}

type FormView = "detail" | "transfer" | "return" | "repair";

const STATUS_CLASS: Record<string, string> = {
  Active:               "bg-emerald-50 text-emerald-700 border-emerald-200",
  Available:            "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Loan":            "bg-blue-50   text-blue-700   border-blue-200",
  Maintenance:          "bg-amber-50  text-amber-700  border-amber-200",
  Reserved:             "bg-violet-50 text-violet-700 border-violet-200",
  "Partially Deployed": "bg-orange-50 text-orange-700 border-orange-200",
  Overdue:              "bg-red-50    text-red-700    border-red-200",
};

interface Props {
  asset: AssetDetail | null;
  onClose: () => void;
}

export function AssetDetailModal({ asset: propAsset, onClose }: Props) {
  const { role, assets } = useApp();
  const asset = propAsset ? (assets.find(a => a.id === propAsset.id) || propAsset) : null;
  const [view, setView] = useState<FormView>("detail");

  const resetAndClose = () => { setView("detail"); onClose(); };
  const goBack        = () => setView("detail");

  const degradation = asset?.condition !== undefined
    ? `${(100 - asset.condition).toFixed(0)}% delta`
    : null;

  const metaRows = asset ? [
    { icon: Tag,       label: "Serial No.",     value: asset.serial      ?? "—" },
    { icon: Tag,       label: "Property Tag",   value: asset.id                  },
    { icon: Building2, label: "Funding Origin", value: asset.funding     ?? "—" },
    { icon: Activity,  label: "Degradation",    value: degradation       ?? "—" },
    { icon: MapPin,    label: "Campus",         value: asset.location    ?? "—" },
    { icon: Building2, label: "Lab",            value: asset.lab         ?? "—" },
    { icon: Calendar,  label: "Procured",       value: asset.procured    ?? "—" },
    { icon: Calendar,  label: "Warranty Exp.",  value: asset.warranty    ?? "—" },
  ] : [];

  const isStaff = role === "TSG" || role === "ITS";

  // Title for each view
  const viewTitles: Record<FormView, string | null> = {
    detail:   null,
    transfer: "Custodianship Transfer",
    return:   "Return Asset",
    repair:   isStaff ? "Send to Maintenance" : "Request Repair",
  };

  return (
    <AnimatePresence onExitComplete={() => setView("detail")}>
      {asset && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={resetAndClose}
            style={{
              position: "fixed", inset: 0, zIndex: 50,
              background: "rgba(17,24,39,0.40)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          />

          {/* ── Modal card ── */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.94, y: 18 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "fixed", inset: 0, zIndex: 51,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "20px", pointerEvents: "none",
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl overflow-hidden"
              style={{
                pointerEvents: "auto",
                width: "100%", maxWidth: 560,
                maxHeight: "92vh", overflowY: "auto",
                border: "1px solid #E5E7EB",
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* ── Persistent header ── */}
              <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-border sticky top-0 bg-white z-10">
                <div className="flex-1 pr-3 min-w-0">
                  <p className="text-[10px] font-extrabold text-primary tracking-[2px] uppercase mb-0.5">
                    {asset.id}
                  </p>
                  <h2
                    className="text-foreground text-base font-extrabold leading-tight truncate"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {view !== "detail" && (
                      <span className="text-muted-foreground font-normal mr-1.5 text-sm">
                        {viewTitles[view]} —
                      </span>
                    )}
                    {asset.name}
                  </h2>
                  {view === "detail" && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {asset.manufacturer && (
                        <span className="text-xs text-muted-foreground">{asset.manufacturer}</span>
                      )}
                      {asset.manufacturer && <span className="text-muted-foreground text-xs">·</span>}
                      <Badge className="text-[10px] bg-muted/60 text-muted-foreground border-border">
                        {asset.category}
                      </Badge>
                      <Badge className={cn("text-[10px]", STATUS_CLASS[asset.status] ?? "bg-muted text-muted-foreground")}>
                        {asset.status}
                      </Badge>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost" size="icon"
                  onClick={resetAndClose}
                  className="flex-shrink-0 text-muted-foreground"
                >
                  <X size={16} />
                </Button>
              </div>

              {/* ── Body — animated view transition ── */}
              <div className="px-5 pb-5 pt-4">
                <AnimatePresence mode="wait">
                  {view === "detail" && (
                    <motion.div
                      key="detail"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{    opacity: 0, x: 12 }}
                      transition={{ duration: 0.18 }}
                    >
                      {/* Image + metadata */}
                      <div className="flex gap-4 mb-5">
                        <div
                          className="rounded-xl overflow-hidden border border-border flex-shrink-0"
                          style={{ width: 148 }}
                        >
                          <AssetImagePlaceholder category={asset.category} aspectRatio="4/3" />
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-3 content-start">
                          {metaRows.map(({ icon: Icon, label, value }) => (
                            <div key={label}>
                              <p className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase flex items-center gap-1 mb-0.5">
                                <Icon size={8} />{label}
                              </p>
                              <p className="text-xs font-semibold text-foreground truncate" title={value}>
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── Action panel conditional rendering ── */}
                      {(role === "TSG" || role === "Custodian" || role === "LabHead" || role === "ITS") && (
                        <>
                          <Separator className="mb-4" />
                          <p className="text-[10px] font-extrabold text-muted-foreground tracking-[2px] uppercase mb-3">
                            Asset Actions
                          </p>
                          <div className={cn("grid gap-2.5", role === "Custodian" ? "grid-cols-3" : "grid-cols-1")}>
                            {/* 1 — Custodianship Transfer */}
                            {role === "Custodian" && (
                              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                                <Button
                                  variant="outline"
                                  className="w-full h-auto flex-col py-4 px-2 gap-2 text-[#005A36] border-[#005A36]/25 hover:bg-emerald-50 hover:border-[#005A36]/60"
                                  onClick={() => setView("transfer")}
                                >
                                  <ArrowRightLeft size={20} />
                                  <span
                                    className="text-[10px] font-extrabold leading-tight text-center"
                                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                                  >
                                    Custodianship<br />Transfer
                                  </span>
                                </Button>
                              </motion.div>
                            )}

                            {/* 2 — Request Repair */}
                            {(role === "Custodian" || role === "LabHead" || role === "TSG" || role === "ITS") && (
                              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                                <Button
                                  variant="outline"
                                  className="w-full h-auto flex-col py-4 px-2 gap-2 text-amber-700 border-amber-300 hover:bg-amber-50 hover:border-amber-500"
                                  onClick={() => setView("repair")}
                                >
                                  <Wrench size={20} />
                                  <span
                                    className="text-[10px] font-extrabold leading-tight text-center"
                                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                                  >
                                    {isStaff ? (
                                      <>Send to<br />Maintenance</>
                                    ) : (
                                      <>Request<br />Repair</>
                                    )}
                                  </span>
                                </Button>
                              </motion.div>
                            )}

                            {/* 3 — Return Asset */}
                            {role === "Custodian" && (
                              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                                <Button
                                  className="w-full h-auto flex-col py-4 px-2 gap-2 text-white"
                                  style={{ background: "#005A36" }}
                                  onClick={() => setView("return")}
                                >
                                  <CornerUpLeft size={20} />
                                  <span
                                    className="text-[10px] font-extrabold leading-tight text-center"
                                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                                  >
                                    Return<br />Asset
                                  </span>
                                </Button>
                              </motion.div>
                            )}
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}

                  {view === "transfer" && (
                    <motion.div
                      key="transfer"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{    opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <TransferForm asset={asset} onBack={goBack} onClose={resetAndClose} />
                    </motion.div>
                  )}

                  {view === "return" && (
                    <motion.div
                      key="return"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{    opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ReturnForm asset={asset} onBack={goBack} onClose={resetAndClose} />
                    </motion.div>
                  )}

                  {view === "repair" && (
                    <motion.div
                      key="repair"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{    opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      {isStaff ? (
                        <DirectMaintenanceForm asset={asset} onBack={goBack} onClose={resetAndClose} />
                      ) : (
                        <RepairForm asset={asset} onBack={goBack} onClose={resetAndClose} />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DirectMaintenanceForm({ asset, onBack, onClose }: { asset: any; onBack: () => void; onClose: () => void }) {
  const { addRepairRequest } = useApp();
  const [priority, setPriority] = useState<"Medium" | "High" | "Critical" >("Medium");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleConfirm = () => {
    addRepairRequest({
      id: `MNT-DISP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      assetId: asset.id,
      assetName: asset.name,
      custodian: asset.custodian || "Unassigned",
      statusLabel: "In Maintenance",
      description: notes.trim() || "Hardware flagged directly for maintenance dispatch.",
      submittedAt: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      priority: priority,
      acknowledged: true, // Auto-acknowledged as it is logged by TSG/ITS directly
      forwardedTo: "Both"
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
          <Wrench size={30} className="text-amber-500" />
        </div>
        <div>
          <h3 className="font-extrabold text-foreground mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Dispatched to Maintenance
          </h3>
          <p className="text-sm text-muted-foreground">
            Asset {asset.name} has been placed directly in the maintenance priority queue.
          </p>
        </div>
        <Button size="sm" onClick={onClose} className="bg-emerald-700 text-white font-bold">
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50">
          <Wrench size={15} className="text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Direct Maintenance Dispatch
          </p>
          <p className="text-[11px] text-muted-foreground">Flag asset status to Maintenance directly</p>
        </div>
      </div>
      <Separator />

      <div className="flex flex-col gap-1.5">
        <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase">Asset ID</Label>
        <Input value={asset.id} disabled className="font-mono bg-[#F3F4F6]" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase">Priority Level</Label>
        <select
          value={priority}
          onChange={e => setPriority(e.target.value as any)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="Medium">Medium Priority</option>
          <option value="High">High Priority</option>
          <option value="Critical">Critical Priority</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase">Maintenance Dispatch Notes</Label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Enter notes about diagnostics or reasons for immediate dispatch..."
          className="w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none font-sans"
        />
      </div>

      <Separator />

      <div className="flex gap-2.5">
        <Button variant="outline" onClick={onBack} className="text-muted-foreground">
          Back
        </Button>
        <Button onClick={handleConfirm} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold">
          Confirm Dispatch to Maintenance
        </Button>
      </div>
    </div>
  );
}
