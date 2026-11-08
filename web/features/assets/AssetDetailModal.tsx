/**
 * Asset detail modal: one asset's facts, QR tag, remarks, history, and the request forms each role may open from it.
 * Layer: feature component. Called by pages/custodian/CustodianPortal.tsx, pages/lab-head/LabHeadDashboard.tsx, and pages/staff/InventoryPage.tsx
 * (also the Director's and the IT Admin's read-only Asset Inventory).
 * Calls: api/assets.api.ts getAssetHistory(), api/maintenance.api.ts reportIssue() (TSG's flag), features/lookups/useLookups.ts,
 * features/assets/AssetRemarks.tsx (the Remarks section), features/assets/AssetTsgSteps.tsx (Missing, Found, complete a
 * disposal), state/serverData.tsx reloadLoans(), and the loan, return, and repair forms.
 * Used by: Custodian requests, Lab Head custody review, TSG maintenance flagging and Record Return, and every role's remarks.
 */
import { useState, useEffect } from "react";
import { useSession } from "@web/state/session";
import { useServerData, holderLabel, type DisposalDetails } from "@web/state/serverData";
import * as assetsApi from "@web/api/assets.api";
import * as maintenanceApi from "@web/api/maintenance.api";
import { otherIssueTypeId, useFormLookups } from "@web/features/lookups/useLookups";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Wrench, CornerUpLeft,
  Tag, MapPin, Building2, Calendar, Activity, Bookmark, Clock
} from "lucide-react";
import { AssetImagePlaceholder } from "./AssetImagePlaceholder";
import { assetStatusLabel } from "./assetBadges";
import { AssetTsgSteps } from "./AssetTsgSteps";
import { AssetRemarks } from "./AssetRemarks";
import { ReturnForm } from "@web/features/returns/ReturnForm";
import { RepairForm } from "@web/features/repairs/RepairForm";
import { LoanForm } from "@web/features/loans/LoanForm";
import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/badge";
import { Separator } from "@web/components/ui/separator";
import { cn } from "@web/components/ui/utils";
import { QRCodeSVG } from "qrcode.react";
import type { AssetHistoryEvent, AssetListItem, PersonRef } from "@shared/types/assets";
import { ASSET_CONDITION_LABELS, type AssetCondition } from "@shared/enums/assetCondition";

/** Who did a history step, as this viewer may see them. */
function actorLabel(actor: PersonRef): string {
  return "userId" in actor ? actor.name : "Not shown";
}

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
  /** The owning project, or null or missing for none. */
  project?: AssetListItem["project"];
  procured?: string;
  warranty?: string;
  location?: string;
  currentLocation?: string;
  lab?: string;
  /** One of the six asset statuses, for example "ON_LOAN". */
  status: string;
  statusLabel?: string;
  /** The newest TSG inspection's condition, or null when TSG never inspected it. */
  condition?: string | null;
  healthScore?: number | null;
  isOverdue?: boolean;
  assetCondition?: string;
  custodian?: string;
  /** The holder's user id, when the server sends their name. (issue #32) */
  custodianId?: number;
  custodianHidden?: boolean;
  disposalId?: string;
  disposalDetails?: DisposalDetails;
  description?: string;
  image?: string;
  specs?: string;
}

type FormView = "detail" | "return" | "repair" | "loan";

const viewTitles: Record<FormView, string> = {
  detail: "Details",
  return: "Asset Return",
  repair: "Request Repair",
  loan: "Request Loan",
};

const STATUS_CLASS: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ON_LOAN: "bg-blue-50   text-blue-700   border-blue-200",
  MAINTENANCE: "bg-amber-50  text-amber-700  border-amber-200",
  PENDING_RETIREMENT: "bg-orange-50 text-orange-700 border-orange-200",
  RETIRED: "bg-red-50    text-red-700    border-red-200",
  MISSING: "bg-slate-100 text-slate-700  border-slate-300",
};

interface Props {
  asset: AssetDetail | null;
  onClose: () => void;
}

/**
 * Shows one asset, with its current custodian under the name and its asset history, and switches between its detail view and the request forms.
 * The buttons depend on role and status: a Custodian can request a loan (Active),
 * a repair or return (On Loan); Staff can send it to maintenance, and record its return
 * when it is On Loan or Overdue; a Lab Head sees the details and the history, with no buttons. Calls assetsApi.getAssetHistory() and
 * reloads the shared loan list (reloadLoans) when it opens.
 *
 * @param asset the asset to show, or null for a closed modal. It is shown as passed, the row of the list it
 *   was opened from, until the shared list reloads (for example after a form here saves); from then on the
 *   copy from useServerData() is shown, so the modal reflects the save.
 * @param onClose called when the modal closes, including after a form succeeds
 */
export function AssetDetailModal({ asset: propAsset, onClose }: Props) {
  const { role, currentUser } = useSession();
  const { assets, assetsVersion, syncFromDb, dbLoans, reloadLoans } = useServerData();
  const { lookups } = useFormLookups();
  const [flagError, setFlagError] = useState<string | null>(null);
  // The shared list can be older than the page's own list, so its copy is used only once it reloaded after
  // this asset was opened. Until then the modal shows the same status as the row that was clicked. (issue #89)
  const [openedUnder, setOpenedUnder] = useState({ tag: propAsset?.id, version: assetsVersion });
  if (openedUnder.tag !== propAsset?.id) setOpenedUnder({ tag: propAsset?.id, version: assetsVersion });
  const openedVersion = openedUnder.tag === propAsset?.id ? openedUnder.version : assetsVersion;
  const reloadedCopy = propAsset && assetsVersion > openedVersion ? assets.find(a => a.id === propAsset.id) : undefined;
  const asset = propAsset ? (reloadedCopy || propAsset) : null;

  // The server refuses a second loan request while one waits for approval or for release, so the
  // request buttons are swapped for a notice instead of leading to that refusal. (H-05)
  const isPendingFor = (r: any) => !!asset && r.assetId === asset.id && ["pending", "pending release"].includes(String(r.status).toLowerCase());
  const pendingLoan = dbLoans.find(isPendingFor);
  const pendingRequest = pendingLoan
    ? { kind: "loan", requesterId: pendingLoan.borrower_id, requesterName: pendingLoan.borrower }
    : null;
  const isOwnPendingRequest = !!pendingRequest && currentUser?.userId === pendingRequest.requesterId;
  // The Return button shows only on an asset the Custodian holds, matched by user id as My Assets matches it
  // (issue #32). The server sends a Custodian no other holder's id, so this matches only their own assets. Repair stays for all.
  const holdsThisAsset = !!asset && !!currentUser && asset.custodianId === currentUser.userId;
  // TSG record a return straight from here, with no request needed, as a walk-in return. Only on an asset that is out:
  // Overdue is On Loan past its due date. The server lets only TSG receive a return, so the button is theirs alone. (issue #99)
  const isOnLoan = !!asset && (asset.status === "ON_LOAN" || asset.isOverdue);
  const canRecordReturn = role === "Staff" && currentUser?.staffUnit === "TSG" && isOnLoan;
  const [view, setView] = useState<FormView>("detail");

  const [historyEvents, setHistoryEvents] = useState<AssetHistoryEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchAssetHistory = async (assetTag: string) => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const data = await assetsApi.getAssetHistory(assetTag);
      if (data.success) {
        setHistoryEvents(data.events || []);
      } else {
        setHistoryError(data.error || "Failed to load the asset history.");
      }
    } catch (err: any) {
      setHistoryError(err.message || "Failed to load the asset history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const resetAndClose = () => { setView("detail"); onClose(); };
  const goBack = () => setView("detail");

  // The history loads as soon as the modal opens, so the detail screen can show it.
  useEffect(() => {
    if (asset?.id) {
      fetchAssetHistory(asset.id);
    } else {
      setHistoryEvents([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id]);

  // The pending-request notice reads the shared loan list, which can be older than the list this asset was
  // opened from: a loan approved since would still show "Your request is pending". One reload per opened asset. (issue #89)
  useEffect(() => {
    if (propAsset?.id) {
      reloadLoans().catch(() => { });
    }
  }, [propAsset?.id, reloadLoans]);

  // Close the modal when the user presses Escape. (issue #119)
  useEffect(() => {
    if (!asset) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        resetAndClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [asset]);

  // Every step, newest first, for the history on the detail screen.
  const newestFirstEvents = [...historyEvents].reverse();

  // TSG flags an asset for maintenance: a ticket in Pending Receipt with the "Other" issue type. TSG then receives the
  // asset from the Repairs page, where the loan (if any) ends. The server's refusal is shown under the button.
  const handleDirectMaintenance = async () => {
    if (!asset) return;
    setFlagError(null);
    const issueTypeId = otherIssueTypeId(lookups);
    if (issueTypeId === null) {
      setFlagError("The issue types could not be loaded. Please try again.");
      return;
    }
    try {
      const data = await maintenanceApi.reportIssue(asset.id, {
        issueTypeId,
        issueDescription: `Flagged for maintenance by ${currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : "TSG"}.`,
      });
      if (!data.success) {
        setFlagError(data.error || "The ticket could not be filed. Please try again.");
        return;
      }
      await syncFromDb();
      resetAndClose();
    } catch (err: any) {
      setFlagError(err?.message || "The server could not be reached. Please try again.");
    }
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

  // The newest TSG inspection's condition; an asset TSG never inspected says so instead of guessing one.
  const conditionKey = asset?.condition ?? asset?.assetCondition;
  const descriptiveCond = conditionKey
    ? ASSET_CONDITION_LABELS[conditionKey as AssetCondition] ?? conditionKey.replace(/_/g, " ")
    : "Not inspected yet";

  // TODO(H-13): the reloaded copy's type (serverData's Asset) does not declare project, though the server sends it.
  const project = asset && "project" in asset ? asset.project : null;

  const metaRows = asset ? [
    { icon: Tag, label: "Serial No.", value: asset.serial ?? "—" },
    { icon: Tag, label: "Property Tag", value: asset.id },
    { icon: Building2, label: "Funding Source", value: asset.funding || "DOST" },
    { icon: Bookmark, label: "Owning Project", value: project ? `${project.code}: ${project.name}` : "None" },
    { icon: Activity, label: "Condition", value: descriptiveCond },
    { icon: MapPin, label: "Campus", value: asset.location ?? "—" },
    { icon: MapPin, label: "Current Location", value: asset.currentLocation ?? asset.location ?? "—" },
    { icon: Building2, label: "Lab", value: asset.lab ?? "—" },
    { icon: Calendar, label: "Procured", value: asset.procured ?? "—" },
    { icon: Calendar, label: "Warranty Exp.", value: asset.warranty ?? "—" },
  ] : [];

  // Title for each view
  const viewTitles: Record<FormView, string | null> = {
    detail: null,
      return: "Return Asset",
    repair: "Request Repair",
    loan: "Request a Loan",
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
                        {viewTitles[view]}:
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
                        {assetStatusLabel(asset.status)}
                      </Badge>
                    </div>
                  )}
                  {/* The holder at a glance; a Custodian sees "Not shown" for someone else's asset, as everywhere else. (D2) */}
                  {view === "detail" && (
                    <p className="text-xs text-muted-foreground mt-1.5 truncate">
                      Custodian: <strong className="text-foreground">{holderLabel(asset.custodian, asset.custodianHidden)}</strong>
                    </p>
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
                      <div className={cn("flex flex-wrap gap-4 mb-5", asset.status === "RETIRED" && "opacity-60 filter grayscale")}>
                        <div
                          className="rounded-xl overflow-hidden border border-border flex-shrink-0"
                          style={{ width: 148 }}
                        >
                          <AssetImagePlaceholder category={asset.category} aspectRatio="4/3" imageUrl={asset.image || (asset as any).image_url} />
                        </div>
                        <div className="flex-1 min-w-[16rem] grid grid-cols-2 gap-x-4 gap-y-3 content-start">
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

                      {/* Disposal details card */}
                      {asset.status === "RETIRED" && (
                        <div className="bg-red-50/50 border border-red-200/50 rounded-xl p-4 mt-4">
                          <p className="text-xs font-bold text-red-800">Asset Decommissioned &amp; Disposed</p>
                          <p className="text-[10px] text-red-600/80 mt-1">This hardware unit has been permanently retired and is no longer in service.</p>
                          {asset.disposalDetails && (
                            <div className="mt-3 text-left border-t border-red-200/30 pt-2.5 space-y-1 font-mono text-[10px] text-red-800">
                              <p><strong>Disposal ID:</strong> {asset.disposalId}</p>
                              <p><strong>Decommissioned By:</strong> {asset.disposalDetails.decommissionedBy ?? "Not shown"}</p>
                              <p><strong>Last Custodian:</strong> {asset.disposalDetails.lastCustodian ?? "Not shown"}</p>
                              <p><strong>Pathway:</strong> {asset.disposalDetails.disposalPathway}</p>
                              <p><strong>Justification:</strong> {asset.disposalDetails.breakdownReasons}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Staff technical service remarks */}
                      <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <p className="text-[10px] font-extrabold text-slate-700 tracking-[1.5px] uppercase">Staff Service Remarks</p>
                        <p className="text-xs text-slate-600 leading-relaxed italic bg-white p-2.5 rounded-lg border border-slate-100">
                          {(asset as any).remarks || asset.tsgRemarks || asset.itsRemarks || asset.description || "Hardware inspected & verified operational. Routine diagnostic check completed with no outstanding hardware faults."}
                        </p>
                      </div>

                      {/* Remarks, for every role: the server says who may add and who may delete each one. */}
                      <AssetRemarks assetTag={asset.id} />

                      {/* The asset's history, always shown */}
                      <div className="mt-4 bg-white border border-slate-200 rounded-xl p-3 text-xs">
                        <p className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px]">Asset History</p>
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 font-mono text-[11px] text-slate-600 max-h-56 overflow-y-auto">
                          {loadingHistory ? (
                            <p className="text-slate-400 italic py-1">Loading the history…</p>
                          ) : historyError ? (
                            <p className="text-red-500 italic py-1">{historyError}</p>
                          ) : newestFirstEvents.length === 0 ? (
                            <p className="text-slate-400 italic py-1">Nothing recorded yet.</p>
                          ) : (
                            newestFirstEvents.map((e, idx) => (
                              <div key={idx} className="py-1 border-b border-slate-50 last:border-b-0">
                                <div className="flex justify-between items-center gap-2">
                                  <span>{e.label}{e.actor ? <>: <strong>{actorLabel(e.actor)}</strong></> : null}</span>
                                  <span className="text-[10px] text-slate-400 shrink-0">{new Date(e.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                                </div>
                                {e.details && (
                                  <div className="mt-1.5 bg-white p-2 rounded-lg border border-slate-100 italic text-[11px] text-slate-600">
                                    "{e.details}"
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* ── Action panel conditional rendering ── */}
                      {asset.status !== "RETIRED" && (role === "Staff" || role === "Custodian") && (
                        <>
                          <Separator className="mb-4" />

                          {/* QR tag, Staff only */}
                          {role === "Staff" && (
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
                                <p className="text-xs font-bold text-foreground">QR Tag</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                                  Link:
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
                            {asset.status === "AVAILABLE" ? (
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

                                {/* Staff direct maintenance */}
                                {role === "Staff" && currentUser?.staffUnit === "TSG" && (
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
                                        Flag for<br />Maintenance
                                      </span>
                                    </Button>
                                    {flagError && <p className="text-[10px] text-red-600 mt-1.5 text-center">{flagError}</p>}
                                  </motion.div>
                                )}
                              </div>
                            ) : asset.status === "MAINTENANCE" ? (
                              <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 flex items-start gap-3">
                                <Wrench size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-bold text-amber-800">Asset Under Maintenance</p>
                                  <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                                    Staff are currently servicing this unit. Repair requests and returns are unavailable until maintenance is completed and the asset is handed back.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className={cn("grid gap-2.5", role === "Custodian" && holdsThisAsset ? "grid-cols-2" : canRecordReturn ? "grid-cols-2" : "grid-cols-1")}>
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
                                {role === "Staff" && currentUser?.staffUnit === "TSG" && (
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
                                        Flag for<br />Maintenance
                                      </span>
                                    </Button>
                                    {flagError && <p className="text-[10px] text-red-600 mt-1.5 text-center">{flagError}</p>}
                                  </motion.div>
                                )}

                                {/* 3a: Record Return, Staff, on an asset that is out */}
                                {canRecordReturn && (
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
                                        Record<br />Return
                                      </span>
                                    </Button>
                                  </motion.div>
                                )}

                                {/* 3: Return Asset, only for the asset's holder */}
                                {role === "Custodian" && holdsThisAsset && (
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
                          {role === "Staff" && currentUser?.staffUnit === "TSG" && <AssetTsgSteps asset={asset} />}
                        </>
                      )}
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
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}