/**
 * Asset detail modal: one asset's facts, QR tag, custodian history, and the request forms each role may open from it.
 * Layer: feature component. Called by pages/custodian/CustodianPortal.tsx, pages/lab-head/LabHeadDashboard.tsx, and pages/staff/InventoryPage.tsx.
 * Calls: api/assets.api.ts getCustodianHistory(), state/serverData.tsx addRepairRequest(), and the loan, transfer, return, and repair forms.
 * Used by: Custodian requests, Lab Head custody review, Staff maintenance flagging.
 */
import { useState, useEffect } from "react";
import { useSession } from "@web/state/session";
import { useServerData, type DisposalDetails } from "@web/state/serverData";
import * as assetsApi from "@web/api/assets.api";
import { motion, AnimatePresence } from "motion/react";
import {
  X, ArrowRightLeft, Wrench, CornerUpLeft,
  Tag, MapPin, Building2, Calendar, Activity, Bookmark, History, ArrowLeft, Clock
} from "lucide-react";
import { AssetImagePlaceholder } from "./AssetImagePlaceholder";
import { TransferForm } from "@web/features/transfers/TransferForm";
import { ReturnForm } from "@web/features/returns/ReturnForm";
import { RepairForm } from "@web/features/repairs/RepairForm";
import { LoanForm } from "@web/features/loans/LoanForm";
import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/badge";
import { Separator } from "@web/components/ui/separator";
import { cn } from "@web/components/ui/utils";
import { QRCodeSVG } from "qrcode.react";

/**
 * The asset shape every asset list hands to this modal and to the four request forms.
 * `id` is the asset tag (for example CITe4D-0004), not the database id.
 */
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
  currentLocation?: string;
  lab?: string;
  status: string;
  condition?: number;
  assetCondition?: string;
  custodian?: string;
  disposalId?: string;
  disposalDetails?: DisposalDetails;
  description?: string;
  image?: string;
  specs?: string;
}

type FormView = "detail" | "transfer" | "return" | "repair" | "loan" | "custodianHistory";

const viewTitles: Record<FormView, string> = {
  detail: "Details",
  transfer: "Custodianship Transfer",
  return: "Asset Return",
  repair: "Request Repair",
  loan: "Request Loan",
  custodianHistory: "Custodian History Audit Trail",
};

const STATUS_CLASS: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Loan": "bg-blue-50   text-blue-700   border-blue-200",
  Maintenance: "bg-amber-50  text-amber-700  border-amber-200",
  Disposed: "bg-red-50    text-red-700    border-red-200",
};

function getDescriptiveCondition(score: number): string {
  if (score >= 95) return "Brand New";
  if (score >= 80) return "Used";
  if (score >= 65) return "Functional";
  if (score >= 50) return "Functional with Issues";
  return "Non-Functional / Repair Needed";
}

interface Props {
  asset: AssetDetail | null;
  onClose: () => void;
}

/**
 * Shows one asset and switches between its detail view, custodian history, and the request forms.
 * The buttons depend on role and status: a Custodian can request a loan (Active),
 * a transfer, repair, or return (On Loan); Staff can send it to maintenance; a Lab Head
 * can open the full custodian history. Calls assetsApi.getCustodianHistory() when it opens.
 *
 * @param asset the asset to show, or null for a closed modal. The live copy from
 *   useServerData() is preferred when one exists, so the modal reflects a reload.
 * @param onClose called when the modal closes, including after a form succeeds
 */
export function AssetDetailModal({ asset: propAsset, onClose }: Props) {
  const { role, currentUser } = useSession();
  const { assets, addRepairRequest, dbLoans, dbTransfers } = useServerData();
  const asset = propAsset ? (assets.find(a => a.id === propAsset.id) || propAsset) : null;

  // The server refuses a second loan or transfer while either is pending, so the
  // request buttons are swapped for a notice instead of leading to that refusal. (H-05)
  const isPendingFor = (r: any) => !!asset && r.assetId === asset.id && String(r.status).toLowerCase() === "pending";
  const pendingLoan = dbLoans.find(isPendingFor);
  const pendingTransfer = dbTransfers.find(isPendingFor);
  const pendingRequest = pendingLoan
    ? { kind: "loan", requesterId: pendingLoan.borrower_id, requesterName: pendingLoan.borrower }
    : pendingTransfer
      ? { kind: "transfer", requesterId: pendingTransfer.fromCustodianId, requesterName: pendingTransfer.from }
      : null;
  const isOwnPendingRequest = !!pendingRequest && currentUser?.userId === pendingRequest.requesterId;
  const [view, setView] = useState<FormView>("detail");

  const [custodianHistoryList, setCustodianHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchCustodianHistory = async (assetTag: string) => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const data = await assetsApi.getCustodianHistory(assetTag);
      if (data.success) {
        setCustodianHistoryList(data.custodianHistory || []);
      } else {
        setHistoryError(data.error || "Failed to load custodian history.");
      }
    } catch (err: any) {
      setHistoryError(err.message || "Failed to load custodian history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const resetAndClose = () => { setView("detail"); onClose(); };
  const goBack = () => setView("detail");

  // Fetch real custody history as soon as the modal opens for an asset, so
  // the inline "Custodian History & Lifecycle Audit Trail" preview on the
  // detail screen has live data — not just when the dedicated (LabHead-only)
  // full-history button is clicked.
  useEffect(() => {
    if (asset?.id) {
      fetchCustodianHistory(asset.id);
    } else {
      setCustodianHistoryList([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id]);

  // History comes back oldest -> newest, with the current holder flagged.
  // "Previous custodian" walks back from just before the current entry to
  // the most recent one under a *different* custodian, so records that
  // only logged a condition/status change (custody unchanged) are skipped.
  const currentHistoryEntry = custodianHistoryList.find(h => h.isCurrent) || custodianHistoryList[custodianHistoryList.length - 1];
  const priorHistoryEntry = currentHistoryEntry
    ? [...custodianHistoryList].reverse().find(h => h.sequence < currentHistoryEntry.sequence && h.custodianName !== currentHistoryEntry.custodianName)
    : undefined;
  const originalHistoryEntry = custodianHistoryList[0];

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

  // A custodian never sees who filed someone else's request, only that one exists. (D2)
  const requestPendingTile = (
    <Button
      variant="outline"
      disabled
      title={isOwnPendingRequest
        ? `Your ${pendingRequest?.kind} request for this asset is waiting for a decision.`
        : "Another user already has a pending request for this asset."}
      className="w-full h-auto flex-col py-4 px-2 gap-2 text-muted-foreground"
    >
      <Clock size={20} />
      <span
        className="text-[10px] font-extrabold leading-tight text-center"
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        {isOwnPendingRequest ? <>Your request<br />is pending</> : <>Requested by<br />another user</>}
      </span>
    </Button>
  );

  const descriptiveCond = asset?.assetCondition
    ? asset.assetCondition.replace(/_/g, " ")
    : asset?.condition !== undefined
      ? getDescriptiveCondition(asset.condition)
      : "Functional";

  const metaRows = asset ? [
    { icon: Tag, label: "Serial No.", value: asset.serial ?? "—" },
    { icon: Tag, label: "Property Tag", value: asset.id },
    { icon: Building2, label: "Funding Org.", value: asset.funding || "DOST" },
    { icon: Activity, label: "Condition State", value: descriptiveCond },
    { icon: MapPin, label: "Campus", value: asset.location ?? "—" },
    { icon: MapPin, label: "Current Location", value: asset.currentLocation ?? asset.location ?? "—" },
    { icon: Building2, label: "Lab", value: asset.lab ?? "—" },
    { icon: Calendar, label: "Procured", value: asset.procured ?? "—" },
    { icon: Calendar, label: "Warranty Exp.", value: asset.warranty ?? "—" },
  ] : [];

  // Title for each view
  const viewTitles: Record<FormView, string | null> = {
    detail: null,
    transfer: "Custodianship Transfer",
    return: "Return Asset",
    repair: "Request Repair",
    loan: "Request Equipment Loan",
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
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 18 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "fixed", inset: 0, zIndex: 51,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "16px", pointerEvents: "none",
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl overflow-hidden"
              style={{
                pointerEvents: "auto",
                width: "100%", maxWidth: "min(92vw, 680px)",
                maxHeight: "90vh", overflowY: "auto",
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
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.18 }}
                    >
                      {/* Image + metadata */}
                      <div className={cn("flex gap-4 mb-5", asset.status === "Disposed" && "opacity-60 filter grayscale")}>
                        <div
                          className="rounded-xl overflow-hidden border border-border flex-shrink-0"
                          style={{ width: 148 }}
                        >
                          <AssetImagePlaceholder category={asset.category} aspectRatio="4/3" imageUrl={asset.image || (asset as any).image_url} />
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

                      {/* TSG & ITS Technical Service Remarks */}
                      <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <p className="text-[10px] font-extrabold text-slate-700 tracking-[1.5px] uppercase">TSG &amp; ITS Service Remarks</p>
                        <p className="text-xs text-slate-600 leading-relaxed italic bg-white p-2.5 rounded-lg border border-slate-100">
                          {(asset as any).remarks || asset.tsgRemarks || asset.itsRemarks || asset.description || "Hardware inspected & verified operational. Routine diagnostic check completed with no outstanding hardware faults."}
                        </p>
                      </div>

                      {/* Collapsible Custodian History Lifecycle View */}
                      <details className="mt-4 bg-white border border-slate-200 rounded-xl p-3 text-xs group">
                        <summary className="font-extrabold text-slate-700 cursor-pointer flex items-center justify-between uppercase tracking-wider text-[10px]">
                          <span>Custodian History &amp; Lifecycle Audit Trail</span>
                          <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 font-mono text-[11px] text-slate-600">
                          {loadingHistory ? (
                            <p className="text-slate-400 italic py-1">Loading custody history…</p>
                          ) : historyError ? (
                            <p className="text-red-500 italic py-1">{historyError}</p>
                          ) : (
                            <>
                              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                                <span>Current Custodian: <strong className="text-emerald-700">{currentHistoryEntry?.custodianName || asset.custodian || "Unassigned"}</strong></span>
                                <span className="text-[10px] text-slate-400">Present</span>
                              </div>
                              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                                <span>Prior Custodian: <strong>{priorHistoryEntry?.custodianName || "No prior custodian on record"}</strong></span>
                                <span className="text-[10px] text-slate-400">{priorHistoryEntry?.dateLogged || "—"}</span>
                              </div>
                              <div className="flex justify-between items-center py-1">
                                <span>Original Intake: <strong>{originalHistoryEntry?.custodianName || "ITS Tagging Registry"}</strong></span>
                                <span className="text-[10px] text-slate-400">{originalHistoryEntry?.dateLogged || asset.procured || "—"}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </details>

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
                          {pendingRequest && role !== "Custodian" && (
                            <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1.5">
                              <Clock size={12} />
                              Pending {pendingRequest.kind} request from <strong className="text-foreground">{pendingRequest.requesterName}</strong>
                            </p>
                          )}
                          <div className="w-full">
                            {role === "LabHead" ? (
                              <div className="grid grid-cols-1 gap-2.5">
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                                  <Button
                                    variant="outline"
                                    className="w-full h-auto flex-col py-3.5 px-2 gap-2 text-[#005A36] border-[#005A36]/30 hover:bg-emerald-50 hover:border-[#005A36] shadow-sm cursor-pointer"
                                    onClick={() => {
                                      setView("custodianHistory");
                                      if (asset) fetchCustodianHistory(asset.id);
                                    }}
                                  >
                                    <History size={20} className="text-[#005A36]" />
                                    <span
                                      className="text-[10px] font-extrabold leading-tight text-center uppercase tracking-wider"
                                      style={{ fontFamily: "'Montserrat', sans-serif" }}
                                    >
                                      Custodian<br />History
                                    </span>
                                  </Button>
                                </motion.div>
                              </div>
                            ) : asset.status === "Active" ? (
                              <div className="grid grid-cols-1 gap-2.5">
                                {/* 0 — Request Loan */}
                                {role === "Custodian" && pendingRequest && requestPendingTile}
                                {role === "Custodian" && !pendingRequest && (
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
                            ) : asset.status === "Maintenance" && (role === "Custodian" || role === "LabHead") ? (
                              <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 flex items-start gap-3">
                                <Wrench size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-bold text-amber-800">Asset Under Maintenance</p>
                                  <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                                    TSG is currently servicing this unit. Custodianship transfer, repair requests, and returns are unavailable until maintenance is completed and the asset is handed back.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className={cn("grid gap-2.5", role === "Custodian" ? "grid-cols-3" : "grid-cols-1")}>
                                {/* 1 — Custodianship Transfer */}
                                {role === "Custodian" && pendingRequest && requestPendingTile}
                                {role === "Custodian" && !pendingRequest && (
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
                                {(role === "Custodian") && (
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
                      exit={{ opacity: 0, x: -20 }}
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
                      exit={{ opacity: 0, x: -20 }}
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
                      exit={{ opacity: 0, x: -20 }}
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
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <LoanForm asset={asset} onBack={goBack} onClose={resetAndClose} />
                    </motion.div>
                  )}

                  {view === "custodianHistory" && (
                    <motion.div
                      key="custodianHistory"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                          <div>
                            <h3 className="text-sm font-extrabold text-[#005A36] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                              <History size={16} /> Custodian History Audit Trail
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5 font-sans">
                              Chronological record of all custodians pulled from database (from oldest to newest).
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={goBack} className="text-xs font-bold gap-1 cursor-pointer">
                            <ArrowLeft size={13} /> Back
                          </Button>
                        </div>

                        {loadingHistory ? (
                          <div className="py-8 text-center text-xs text-muted-foreground animate-pulse font-mono">
                            Fetching custodian records from MySQL database…
                          </div>
                        ) : historyError ? (
                          <div className="p-3 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
                            {historyError}
                          </div>
                        ) : custodianHistoryList.length === 0 ? (
                          <div className="py-8 text-center text-xs text-muted-foreground font-mono">
                            No historical custodian records logged for this asset in the database.
                          </div>
                        ) : (
                          <div className="relative pl-6 space-y-4 pt-1 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                            {custodianHistoryList.map((entry, idx) => (
                              <div key={entry.sequence || idx} className="relative bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                                {/* Timeline Node Indicator */}
                                <div className={cn(
                                  "absolute -left-6 top-3.5 w-3 h-3 rounded-full border-2 border-white flex-shrink-0",
                                  entry.isCurrent ? "bg-emerald-600 ring-2 ring-emerald-100" : "bg-slate-400"
                                )} />

                                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge className={cn(
                                      "text-[9px] font-extrabold uppercase px-2 py-0.5",
                                      entry.isCurrent ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-700"
                                    )}>
                                      {entry.isCurrent ? `#${entry.sequence} (Current Custodian)` : `#${entry.sequence} (Prior Custodian)`}
                                    </Badge>
                                    <span className="font-bold text-slate-800 text-sm">{entry.custodianName}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-500">{entry.dateLogged}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-sans">
                                  <div>
                                    <span className="text-slate-400 font-semibold block text-[9px] uppercase">Email / Institutional Contact:</span>
                                    <span className="font-mono text-slate-700 font-bold">{entry.custodianEmail || "—"}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 font-semibold block text-[9px] uppercase">Status / Asset Condition:</span>
                                    <span className="font-semibold text-slate-700">{entry.status} · {entry.condition || "Functional"}</span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-slate-400 font-semibold block text-[9px] uppercase">Location:</span>
                                    <span className="text-slate-700">{entry.currentLocation || entry.location || "DLSU Campus"}</span>
                                  </div>
                                  {entry.remarks && (
                                    <div className="col-span-2 bg-white p-2 rounded-lg border border-slate-100 italic text-[11px] text-slate-600">
                                      "{entry.remarks}"
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-2 flex justify-end">
                          <Button variant="outline" size="sm" onClick={goBack} className="text-xs font-bold cursor-pointer">
                            Close History
                          </Button>
                        </div>
                      </div>
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