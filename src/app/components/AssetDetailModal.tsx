import { useState } from "react";
import { useApp } from "../context";
import { motion, AnimatePresence } from "motion/react";
import {
  X, ArrowRightLeft, Wrench, CornerUpLeft,
  Tag, MapPin, Building2, Calendar, Activity, Bookmark
} from "lucide-react";
import { AssetImagePlaceholder } from "./AssetImagePlaceholder";
import { TransferForm } from "./TransferForm";
import { ReturnForm }   from "./ReturnForm";
import { RepairForm }   from "./RepairForm";
import { LoanForm }     from "./LoanForm";
import { Button } from "./ui/button";
import { Badge }  from "./ui/badge";
import { Separator } from "./ui/separator";
import { cn } from "./ui/utils";
import { QRCodeSVG } from "qrcode.react";

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

type FormView = "detail" | "transfer" | "return" | "repair" | "loan";

const STATUS_CLASS: Record<string, string> = {
  Active:               "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Loan":            "bg-blue-50   text-blue-700   border-blue-200",
  Maintenance:          "bg-amber-50  text-amber-700  border-amber-200",
  Disposed:             "bg-red-50    text-red-700    border-red-200",
};

interface Props {
  asset: AssetDetail | null;
  onClose: () => void;
}

export function AssetDetailModal({ asset: propAsset, onClose }: Props) {
  const { role, assets, addRepairRequest } = useApp();
  const asset = propAsset ? (assets.find(a => a.id === propAsset.id) || propAsset) : null;
  const [view, setView] = useState<FormView>("detail");

  const resetAndClose = () => { setView("detail"); onClose(); };
  const goBack        = () => setView("detail");

  const handleDirectMaintenance = () => {
    if (!asset) return;
    const refId = `MNT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    addRepairRequest({
      id: refId,
      assetId: asset.id,
      assetName: asset.name,
      custodian: asset.custodian || "Unassigned",
      statusLabel: "Under Maintenance",
      description: `Flagged for immediate maintenance and component servicing by ${role}.`,
      submittedAt: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      priority: "High",
      acknowledged: true,
      forwardedTo: role === "ITS" ? "ITS" : "TSG"
    });
    resetAndClose();
  };

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

  // Title for each view
  const viewTitles: Record<FormView, string | null> = {
    detail:   null,
    transfer: "Custodianship Transfer",
    return:   "Return Asset",
    repair:   "Request Repair",
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
                      <div className={cn("flex gap-4 mb-5", asset.status === "Disposed" && "opacity-60 filter grayscale")}>
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

                      {/* Decommissioned Audit Details Card */}
                      {asset.status === "Disposed" && (
                        <div className="bg-red-50/50 border border-red-200/50 rounded-xl p-4 mt-4">
                          <p className="text-xs font-bold text-red-800">Asset Decommissioned &amp; Disposed</p>
                          <p className="text-[10px] text-red-600/80 mt-1">This hardware unit has been permanently retired and is no longer in service.</p>
                          {asset.disposalDetails && (
                            <div className="mt-3 text-left border-t border-red-200/30 pt-2.5 space-y-1 font-mono text-[10px] text-red-800">
                              <p><strong>Disposal ID:</strong> {asset.disposalId}</p>
                              <p><strong>Decommissioned By:</strong> {asset.disposalDetails.decommissionedBy}</p>
                              <p><strong>Last Custodian:</strong> {asset.disposalDetails.lastCustodian}</p>
                              <p><strong>Pathway:</strong> {asset.disposalDetails.disposalPathway}</p>
                              <p><strong>Justification:</strong> {asset.disposalDetails.breakdownReasons}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Action panel conditional rendering ── */}
                      {asset.status !== "Disposed" && (role === "TSG" || role === "Custodian" || role === "LabHead" || role === "ITS") && (
                        <>
                          <Separator className="mb-4" />

                          {/* QR Tag for TSG / ITS */}
                          {(role === "TSG" || role === "ITS") && (
                            <div className="flex items-center gap-4 bg-muted/40 border border-dashed rounded-xl p-3 shadow-sm mb-4">
                              <div className="bg-white p-1 rounded-lg border flex-shrink-0 shadow-sm">
                                <QRCodeSVG
                                  value={`https://adric.dlsu.edu.ph/assets/${asset.id}`}
                                  size={80}
                                  level="H"
                                  includeMargin={true}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-foreground">Permanent QR Tag</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                                  Scannable routing node link:
                                  <span className="font-mono text-primary select-all text-[9px] block mt-1 bg-background p-1.5 rounded border border-border truncate">https://adric.dlsu.edu.ph/assets/{asset.id}</span>
                                </p>
                              </div>
                            </div>
                          )}

                          <p className="text-[10px] font-extrabold text-muted-foreground tracking-[2px] uppercase mb-3">
                            Asset Actions
                          </p>
                          <div className="w-full">
                            {asset.status === "Active" ? (
                              <div className="grid grid-cols-1 gap-2.5">
                                {/* 0 — Request Loan */}
                                {(role === "Custodian" || role === "LabHead") && (
                                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                                    <Button
                                      className="w-full h-auto flex-col py-4 px-2 gap-2 text-white shadow-sm"
                                      style={{ background: "#005A36" }}
                                      onClick={() => setView("loan")}
                                    >
                                      <Bookmark size={20} />
                                      <span
                                        className="text-[10px] font-extrabold leading-tight text-center"
                                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                                      >
                                        Request<br />Loan
                                      </span>
                                    </Button>
                                  </motion.div>
                                )}

                                {/* TSG/ITS direct maintenance */}
                                {(role === "TSG" || role === "ITS") && (
                                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                                    <Button
                                      variant="outline"
                                      className="w-full h-auto flex-col py-4 px-2 gap-2 text-amber-700 border-amber-300 hover:bg-amber-50 hover:border-amber-500"
                                      onClick={handleDirectMaintenance}
                                    >
                                      <Wrench size={20} />
                                      <span
                                        className="text-[10px] font-extrabold leading-tight text-center"
                                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                                      >
                                        Send to<br />Maintenance
                                      </span>
                                    </Button>
                                  </motion.div>
                                )}
                              </div>
                            ) : (
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

                                 {/* 2a — Request Repair (Form) */}
                                {(role === "Custodian" || role === "LabHead") && (
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
                                        Request<br />Repair
                                      </span>
                                    </Button>
                                  </motion.div>
                                )}

                                {/* 2b — Direct Send to Maintenance */}
                                {(role === "TSG" || role === "ITS") && (
                                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                                    <Button
                                      variant="outline"
                                      className="w-full h-auto flex-col py-4 px-2 gap-2 text-amber-700 border-amber-300 hover:bg-amber-50 hover:border-amber-500"
                                      onClick={handleDirectMaintenance}
                                    >
                                      <Wrench size={20} />
                                      <span
                                        className="text-[10px] font-extrabold leading-tight text-center"
                                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                                      >
                                        Send to<br />Maintenance
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
                      <RepairForm asset={asset} onBack={goBack} onClose={resetAndClose} />
                    </motion.div>
                  )}

                  {view === "loan" && (
                    <motion.div
                      key="loan"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{    opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <LoanForm asset={asset} onBack={goBack} onClose={resetAndClose} />
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
