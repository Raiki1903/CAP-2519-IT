import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useSession, roleToSlug } from "@web/state/session";
import { useServerData } from "@web/state/serverData";
import { useBrowserOnly } from "@web/state/browserOnly";
import * as assetsApi from "@web/api/assets.api";
import * as repairsApi from "@web/api/repairs.api";
import * as disposalsApi from "@web/api/disposals.api";
import * as inspectionsApi from "@web/api/inspections.api";
import type { RepairRequest } from "@web/state/serverData";
import { ASSET_CATEGORIES } from "@shared/enums/assetCategory";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { ReturnForm } from "@web/features/returns/ReturnForm";
import TSGAnalyticsView from "@web/features/analytics/staff/TSGAnalyticsView";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Textarea } from "@web/components/ui/textarea";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import { Switch } from "@web/components/ui/switch";
import { Label } from "@web/components/ui/label";
import { Separator } from "@web/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@web/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { AssetImagePlaceholder } from "@web/features/assets/AssetImagePlaceholder";
import { AssetDetailModal, type AssetDetail } from "@web/features/assets/AssetDetailModal";
import { EditAssetDialog } from "@web/features/assets/EditAssetDialog";
import { statusBadgeClass, CONDITION_DOT_CLASS, ConditionState } from "@web/features/assets/assetBadges";
import { cn } from "@web/components/ui/utils";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus, Search, Download, CheckCircle, Clock, Package, DollarSign,
  ChevronRight, LayoutGrid, Table2, MapPin, Calendar, Tag, Wrench,
  BarChart3, Bell, AlertTriangle, Shield, QrCode, Printer, Zap, Eye,
  Image as ImageIcon, XCircle, Trash2, Pencil, Archive, ClipboardCheck, RefreshCw, Camera, Upload
} from "lucide-react";

const MINT = "#10B981";
const fundingSources = ["DOST", "USAID", "CHED", "Internal Grants"];

// TSG Specific Constants - 10 DB Research Centers evenly distributed across 4 groups
const labGroups = [
  { id: "A", name: "Group A", labs: ["CITe4D", "CAR", "CNIS"], color: "text-blue-600" },
  { id: "B", name: "Group B", labs: ["CeHCI", "CeLT", "TE3D"], color: "text-violet-600" },
  { id: "C", name: "Group C", labs: ["GAME", "Bio"], color: "text-amber-600" },
  { id: "D", name: "Group D", labs: ["CIVI", "HXIL"], color: "text-emerald-600" },
];

const healthData: any[] = [];

const statusBadge: Record<string, string> = {
  Inspected: "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold",
  "For Inspection": "bg-amber-50 text-amber-800 border-amber-300 font-bold",
  "Due Soon": "bg-amber-50 text-amber-700 border-amber-200",
  Overdue: "bg-red-50 text-red-700 border-red-200",
};

const urgencyBadge: Record<string, string> = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Normal: "bg-blue-50   text-blue-700   border-blue-200",
  High: "bg-amber-50  text-amber-700  border-amber-200",
  Critical: "bg-red-50    text-red-700    border-red-200",
};

// Database condition names to the labels the finalize dialog offers, so a report
// reads the same in the log as when it was filed.
const REPORT_CONDITION_LABEL: Record<string, string> = {
  PERFECT: "Perfect",
  OPERATIONAL: "Operational",
  MINOR_DRIFT: "Minor Drift",
  DEGRADED: "Degraded Performance",
  CRITICAL_DEFECT: "Critical Defect",
};

interface IntakeForm {
  name: string;
  serial: string;
  manufacturer: string;
  category: string;
  funding: string;
  acquisitionValue: number;
  procured: string;
  warranty: string;
  location: string;
  lab: string;
  image?: string;
  remarks?: string;
}

const generateAdricSerial = () => {
  const year = new Date().getFullYear();
  const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, "0").toUpperCase();
  return `ADRIC-${year}-${hex}`;
};

const emptyForm: IntakeForm = {
  name: "", serial: generateAdricSerial(), manufacturer: "", category: "CPU",
  funding: "DOST", acquisitionValue: 0, procured: new Date().toISOString().split("T")[0],
  warranty: "", location: "Manila", lab: "CITe4D", image: "", remarks: ""
};

function MetricBar({ value, color }: { value: number; color: string }) {
  return <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1 w-12"><div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, value)}%` }} /></div>;
}

function AssetGalleryCard({ eq, onSelect, onDelete, onEdit, onDecommission }: { eq: any; onSelect: () => void; onDelete?: () => void; onEdit?: () => void; onDecommission?: () => void }) {
  const isDisposed = eq.status === "Disposed";
  return (
    <Card onClick={onSelect} className={cn("overflow-hidden p-0 gap-0 transition-all relative cursor-pointer", isDisposed ? "opacity-85 bg-red-50/20 border-dashed border-red-200 shadow-none hover:opacity-100" : "hover:shadow-md")}>
      <div className="relative">
        <AssetImagePlaceholder category={eq.category} aspectRatio="4/3" imageUrl={eq.image || eq.image_url} />
        <Badge className={cn("absolute top-2.5 right-2.5 text-[9px] border font-bold uppercase tracking-wider", statusBadgeClass[eq.status])}>{eq.status}</Badge>
        {
          isDisposed && eq.disposalId && (
            <Badge className="absolute top-2.5 left-2.5 text-[9px] font-mono font-extrabold bg-red-100 text-red-800 border-red-300 shadow-sm">
              {eq.disposalId}
            </Badge>
          )
        }
        {
          !isDisposed && (
            <div className="absolute top-2.5 left-2.5 flex gap-1 z-10">
              {onEdit && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 rounded-md bg-white hover:bg-blue-50 text-blue-600 border-blue-200 opacity-90 shadow-sm"
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  title="Edit Asset"
                >
                  <Pencil size={11} />
                </Button>
              )}
              {onDecommission && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 rounded-md bg-white hover:bg-amber-50 text-amber-600 border-amber-200 opacity-90 shadow-sm"
                  onClick={(e) => { e.stopPropagation(); onDecommission(); }}
                  title="Decommission Asset"
                >
                  <Archive size={11} />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-6 w-6 rounded-md hover:bg-red-600 opacity-90 shadow-sm"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  title="Remove Asset"
                >
                  <Trash2 size={11} />
                </Button>
              )}
            </div>
          )
        }
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border">
          <div className={cn("h-full w-full", CONDITION_DOT_CLASS[eq.assetCondition] ?? "bg-emerald-400")} />
        </div>
      </div >
      <CardContent className="px-4 py-3.5 flex flex-col justify-between h-[115px]">
        <div>
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <p className="text-[10px] font-bold text-primary tracking-wide uppercase">{eq.id}</p>
            {isDisposed && eq.disposalId && (
              <span className="text-[10px] font-mono font-extrabold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                {eq.disposalId}
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-foreground leading-snug line-clamp-1">{eq.name}</p>
        </div>
        {isDisposed ? (
          <div className="flex items-center justify-between text-[10px] text-red-700 pt-2 border-t border-red-100 font-mono mt-1">
            <span>By: {eq.disposalDetails?.decommissionedBy || "AdRIC Director"}</span>
            <span className="font-bold">{eq.disposalDetails?.decommissionDate || "Disposed"}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border mt-1">
            <span>{eq.custodian || "No custodian"}</span>
            <ConditionState value={eq.assetCondition} />
          </div>
        )}
      </CardContent>
    </Card >
  );
}

function RepairAlertCard({ req, onAcknowledge }: { req: RepairRequest; onAcknowledge: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isCritical = req.priority === "Critical";
  return (
    <div className={cn("rounded-xl overflow-hidden border-2", isCritical ? "border-red-400" : "border-orange-400")}
      style={{ animation: !req.acknowledged ? "pulseAlert 2s ease-in-out infinite" : "none" }}>
      <div className={cn("px-4 py-1.5 flex items-center gap-2", isCritical ? "bg-red-500" : "bg-orange-500")}>
        <Zap size={11} className="text-white" />
        <span className="text-[10px] font-extrabold text-white tracking-widest flex-1">
          {isCritical ? "CRITICAL" : "HIGH PRIORITY"} REPAIR REQUEST · {req.id}
        </span>
        {!req.acknowledged && <Badge className="text-[9px] bg-white/20 text-white border-white/20">NEW</Badge>}
      </div>
      <div className={cn("p-4", isCritical ? "bg-red-50" : "bg-orange-50")}>
        <div className="flex gap-3 items-start">
          <div className="w-16 h-14 rounded-lg border-2 border-border bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            {req.imageUrl ? <img src={req.imageUrl} alt="asset" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-muted-foreground" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground mb-0.5">{req.assetName}</p>
            <p className="text-xs text-muted-foreground mb-1">{req.assetId} · {req.submittedAt} · <strong className={isCritical ? "text-red-700" : "text-orange-700"}>{req.statusLabel}</strong></p>
            <p className="text-xs text-foreground italic leading-relaxed">"{req.description.slice(0, 100)}{req.description.length > 100 ? "…" : ""}"</p>
            <div className="flex flex-wrap items-center justify-between mt-1 gap-2 border-t pt-1.5 border-dashed border-muted-foreground/20">
              <span className="text-[11px] text-muted-foreground">Submitted by: {req.custodian}</span>
              {req.forwardedTo && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Dispatched To:</span>
                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-bold", req.forwardedTo === "ITS" ? "bg-blue-50 text-blue-700 border-blue-200" : req.forwardedTo === "TSG" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-purple-50 text-purple-700 border-purple-200")}>
                    {req.forwardedTo === "ITS" ? "ITS" : req.forwardedTo === "TSG" ? "TSG" : "TSG & ITS"}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {!req.acknowledged
            ? <Button size="sm" className="flex-1 text-xs" onClick={() => onAcknowledge(req.id)}><CheckCircle size={11} />Acknowledge & Assign Technician</Button>
            : <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-semibold"><CheckCircle size={11} />Acknowledged</div>
          }
          <Button size="sm" variant="outline" onClick={() => setExpanded(!expanded)} className="text-xs"><Eye size={11} />{expanded ? "Collapse" : "Full Report"}</Button>
        </div>
        {expanded && (
          <div className="mt-3 rounded-lg border border-border bg-white p-3">
            <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-2">FULL CUSTODIAN DESCRIPTION</p>
            <p className="text-xs text-foreground leading-relaxed">{req.description || "No description provided."}</p>
            {req.imageUrl && <img src={req.imageUrl} alt="condition" className="mt-2 rounded-lg max-w-full border border-border" />}
          </div>
        )}
      </div>
    </div>
  );
}

export function ITSDashboard({ activeTab }: { activeTab: string }) {
  const navigate = useNavigate();
  const { role, currentUser } = useSession();
  const {
    assets, syncFromDb,
    repairRequests, acknowledgeRepair, updateRepairStatus
  } = useServerData();
  const { returns } = useBrowserOnly();
  const [itemInspectedState, setItemInspectedState] = useState<Record<string, boolean>>({});
  const [selectedQueueItem, setSelectedQueueItem] = useState<any | null>(null);
  const [inspectionStatusOption, setInspectionStatusOption] = useState<string>("Operational");
  const [inspectionNotesOption, setInspectionNotesOption] = useState<string>("");
  const [inspectorRoleOption, setInspectorRoleOption] = useState<string>("TSG Staff");
  const [tsgRemarksOption, setTsgRemarksOption] = useState<string>("");
  const [itsRemarksOption, setItsRemarksOption] = useState<string>("");
  const [inspectionImgOption, setInspectionImgOption] = useState<string>("");

  const [dbAssets, setDbAssets] = useState<any[]>([]);
  const [loadingDbAssets, setLoadingDbAssets] = useState(false);
  const [dbAssetsError, setDbAssetsError] = useState<string | null>(null);

  // ITS specific states
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<IntakeForm>(emptyForm);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [filterFunding, setFilterFunding] = useState("All");
  const [filterLoc, setFilterLoc] = useState("All");
  const [submitted, setSubmitted] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "gallery">("gallery");
  const [selectedAsset, setSelectedAsset] = useState<AssetDetail | null>(null);

  const [dbReports, setDbReports] = useState<any[]>([]);

  const fetchDbReports = async () => {
    try {
      const data = await inspectionsApi.listInspectionReports();
      if (data.success) {
        setDbReports(data.reports || []);
      }
    } catch (err) {
      console.error("Failed to fetch asset reports from DB:", err);
    }
  };

  const [sortBy, setSortBy] = useState<"name" | "category" | "procured">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchDbAssets();
    fetchDbReports();
  }, []);

  useEffect(() => {
    if (activeTab === "register" || showModal) {
      if (!form.serial || form.serial.trim() === "") {
        setForm(prev => ({
          ...prev,
          serial: generateAdricSerial()
        }));
      }
    }
  }, [activeTab, showModal]);

  const fetchDbAssets = async () => {
    setLoadingDbAssets(true);
    setDbAssetsError(null);
    try {
      const data = await assetsApi.listAssets();
      if (data.success) {
        setDbAssets(data.assets);
      } else {
        throw new Error(data.error || "Failed to fetch assets from server");
      }
    } catch (err: any) {
      console.error("❌ Failed to fetch database assets:", err);
      setDbAssetsError(err.message || "Could not load assets from DB.");
    } finally {
      setLoadingDbAssets(false);
    }
  };

  useEffect(() => {
    fetchDbAssets();
  }, []);

  const displayedAssets = dbAssets.length > 0 ? dbAssets : assets;

  // Live repair/maintenance tickets from the MySQL-backed API (RepairForm and
  // ReturnForm's "flag for repair" both write here via POST /api/assets/:tag/repair).
  const [dbRepairs, setDbRepairs] = useState<any[]>([]);
  const [loadingDbRepairs, setLoadingDbRepairs] = useState(false);
  const [dbRepairsError, setDbRepairsError] = useState<string | null>(null);

  const fetchDbRepairs = async () => {
    setLoadingDbRepairs(true);
    setDbRepairsError(null);
    try {
      const data = await repairsApi.listRepairs();
      if (data.success) {
        setDbRepairs(data.repairs);
      } else {
        throw new Error(data.error || "Failed to fetch repairs from server");
      }
    } catch (err: any) {
      console.error("❌ Failed to fetch database repairs:", err);
      setDbRepairsError(err.message || "Could not load repair tickets from DB.");
    } finally {
      setLoadingDbRepairs(false);
    }
  };

  useEffect(() => {
    fetchDbRepairs();
  }, []);

  // Refresh whenever ITS looks at a repair-related tab, so a new ticket from
  // RepairForm/ReturnForm shows up without a full page reload.
  useEffect(() => {
    if (activeTab === "repairs" || activeTab === "overview" || activeTab === "inventory") {
      fetchDbRepairs();
    }
  }, [activeTab]);

  const DB_PENDING_STATUSES = ["Pending TSG Review", "Awaiting Immediate Dispatch"];

  // Shape DB-sourced tickets to match the RepairRequest interface the existing
  // UI (RepairAlertCard, the priority table, RepairProgressDialog) expects.
  // _source/_repairId let the acknowledge/update handlers below route the
  // action to the real backend instead of the local mock context.
  const mappedDbRepairs = dbRepairs.map(r => ({
    id: r.id,
    _source: "db" as const,
    _repairId: r.repairId,
    assetId: r.assetId,
    assetName: r.asset,
    custodian: r.reportedBy,
    statusLabel: r.progressStatus,
    description: r.description,
    submittedAt: new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    priority: r.isImmediate ? "Critical" : "Medium",
    acknowledged: !DB_PENDING_STATUSES.includes(r.progressStatus),
    forwardedTo: undefined as string | undefined,
  }));

  // Repair Operations Manager reads only from the database now — no mock/demo
  // tickets mixed in. (acknowledgeRepair/updateRepairStatus from context are
  // kept as a fallback in the handlers below but should never fire in
  // practice, since every ticket here is DB-sourced.)
  const combinedRepairs = mappedDbRepairs;

  const updateDbRepairStatus = async (repairId: number, status: string, condition?: string, remarks?: string) => {
    try {
      const data = await repairsApi.updateRepair(repairId, { progressStatus: status, assetCondition: condition, assetRemarks: remarks });
      if (!data.success) {
        console.error("❌ Failed to update repair status:", data.error);
      }
    } catch (err: any) {
      console.error("❌ Failed to reach the server:", err.message);
    }
    // The endpoint also flips the underlying asset's status (e.g. into
    // MAINTENANCE on acknowledge, back to ON_LOAN on Fixed & Completed), so
    // both lists need to refresh — not just the repair ticket.
    await Promise.all([fetchDbRepairs(), fetchDbAssets()]);
  };

  // Unified handlers — route to the real API for DB-sourced tickets, and to
  // the existing mock context functions for the legacy demo tickets.
  const handleAcknowledgeRepair = (id: string) => {
    const target = combinedRepairs.find(r => r.id === id) as any;
    if (target?._source === "db") {
      updateDbRepairStatus(target._repairId, "Inspection Phase");
    } else {
      acknowledgeRepair(id);
    }
  };

  const handleUpdateRepairStatus = (id: string, status: string, condition?: string, remarks?: string) => {
    const target = combinedRepairs.find(r => r.id === id) as any;
    if (target?._source === "db") {
      updateDbRepairStatus(target._repairId, status, condition, remarks);
    } else {
      updateRepairStatus(id, status);
    }
  };

  // Edit, Delete confirmation & Disposal states
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null);
  const [disposalAsset, setDisposalAsset] = useState<any | null>(null);
  const [updatingTicket, setUpdatingTicket] = useState<any | null>(null);
  const [inventorySubTab, setInventorySubTab] = useState<"active" | "disposed">("active");
  const [selectedInspection, setSelectedInspection] = useState<any | null>(null);

  // TSG specific states
  const [activeGroup, setActiveGroup] = useState("A");
  const [selectedQR, setSelectedQR] = useState<string[]>([]);
  const [healthEdits, setHealthEdits] = useState<Record<string, Record<string, string>>>({});
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(true);
  const [selectedReturnAsset, setSelectedReturnAsset] = useState<any | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    if (!assetToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await assetsApi.deleteAsset(assetToDelete);
      if (!result.success) {
        throw new Error(result.error || "Delete failed");
      }
      syncFromDb();
      setAssetToDelete(null);
      await fetchDbAssets();
    } catch (err: any) {
      console.error("❌ Asset delete failed:", err);
      setDeleteError(err.message || "Could not reach the server. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const unacknowledged = combinedRepairs.filter(r => !r.acknowledged);
  const pendingReturns = returns.filter(r => r.status === "Pending");

  const priorityWeight: Record<string, number> = {
    "Critical": 3,
    "High": 2,
    "Medium": 1
  };

  const sortedRepairs = [...combinedRepairs].sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) {
      return a.acknowledged ? 1 : -1;
    }
    const pA = priorityWeight[a.priority] || 0;
    const pB = priorityWeight[b.priority] || 0;
    if (pA !== pB) return pB - pA;
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });

  const activeRepairs = sortedRepairs.filter(r => r.statusLabel !== "Fixed & Completed");
  const completedRepairs = sortedRepairs.filter(r => r.statusLabel === "Fixed & Completed");

  const openAsset = (eq: any): AssetDetail => ({
    id: eq.id, name: eq.name, serial: eq.serial, manufacturer: eq.manufacturer,
    category: eq.category, funding: eq.funding, procured: eq.procured,
    warranty: eq.warranty, location: eq.location, currentLocation: eq.currentLocation, lab: eq.lab,
    status: eq.status, condition: eq.condition, assetCondition: eq.assetCondition, custodian: eq.custodian,
    description: eq.description || eq.remarks || "No additional TSG/ITS remarks recorded.",
    image: eq.image || eq.image_url,
    disposalId: eq.disposalId,
    disposalDetails: eq.disposalDetails
  });

  const filtered = displayedAssets.filter(eq => {
    const matchSearch = eq.name.toLowerCase().includes(search.toLowerCase()) || eq.serial.toLowerCase().includes(search.toLowerCase());
    const matchFunding = filterFunding === "All" || eq.funding === filterFunding;
    const matchLoc = filterLoc === "All" || eq.location === filterLoc;

    // Decommissioned subtab filtering
    const matchSubTab = inventorySubTab === "disposed"
      ? eq.status === "Disposed"
      : eq.status !== "Disposed";

    return matchSearch && matchFunding && matchLoc && matchSubTab;
  });

  const qrAssets = displayedAssets.filter(a => a.status !== "Disposed");

  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitted(true);
    setRegistrationError(null);
    try {
      const res = await assetsApi.createAssetRaw(form);
      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        const errText = await res.text();
        throw new Error(`Server returned error (${res.status}): ${errText.slice(0, 120)}`);
      }
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "Registration failed");
      }

      syncFromDb();
      await fetchDbAssets();
      setShowModal(false);
      setForm(emptyForm);
      setStep(1);
    } catch (err: any) {
      console.error("❌ Asset registration failed:", err);
      setRegistrationError(err.message || "Could not reach the server. Please try again.");
    } finally {
      setSubmitted(false);
    }
  };

  // ── Overview ──────────────────────────────────────────────────────────────
  if (activeTab === "overview") {
    const overviewSlug = roleToSlug[role] || ((typeof window !== "undefined" && window.location.pathname.startsWith("/tsg")) || role === "TSG" ? "tsg" : "its");

    const manilaAssetsCount = displayedAssets.filter(a => {
      const loc = (a.location || "").toLowerCase();
      const labName = (a.lab || "").toLowerCase();
      return loc.includes("manila") || loc.includes("taft") || labName.includes("cite4d") || labName.includes("car") || (!loc.includes("laguna") && !loc.includes("canlubang"));
    }).length;

    const lagunaAssetsCount = displayedAssets.filter(a => {
      const loc = (a.location || "").toLowerCase();
      const labName = (a.lab || "").toLowerCase();
      return loc.includes("laguna") || loc.includes("canlubang") || labName.includes("civi") || labName.includes("bio");
    }).length;

    const nowMs = Date.now();
    const expiring30Days = displayedAssets.filter(a => {
      if (!a.warranty) return false;
      const expMs = new Date(a.warranty).getTime();
      const daysLeft = Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 30;
    });

    const recentAssets = [...displayedAssets].slice(-3).reverse();

    return (
      <div className="space-y-6">
        <div className="mb-2">
          <h1 className="text-foreground text-2xl font-extrabold tracking-tight mb-1">System Overview</h1>
          <p className="text-muted-foreground text-xs">Real-time status summaries, operational telemetry, and quick action routing controls.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border border-border bg-card shadow-sm rounded-xl">
            <CardContent className="pt-4 pb-4">
              <p className="text-3xl font-extrabold text-foreground font-mono">{displayedAssets.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">Total Assets Registered</p>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card shadow-sm rounded-xl">
            <CardContent className="pt-4 pb-4">
              <p className={cn("text-3xl font-extrabold font-mono", unacknowledged.length > 0 ? "text-red-600 animate-pulse" : "text-foreground")}>
                {combinedRepairs.length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">Maintenance Requests</p>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card shadow-sm rounded-xl">
            <CardContent className="pt-4 pb-4">
              <p className="text-3xl font-extrabold text-foreground font-mono">{pendingReturns.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">Pending Return Ledgers</p>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card shadow-sm rounded-xl">
            <CardContent className="pt-4 pb-4">
              <p className="text-3xl font-extrabold text-emerald-700 font-mono">97.8%</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">System Operational Index</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-2 border border-border bg-card shadow-sm rounded-xl">
            <CardHeader><CardTitle className="text-sm font-bold text-foreground">Quick Action Operations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
                <div>
                  <p className="text-xs font-bold text-foreground">Asset Procurement Registration</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Log new hardware items into AdRIC databases</p>
                </div>
                <Button size="sm" onClick={() => navigate(`/${overviewSlug}/register`)} className="gap-1 text-xs font-bold bg-[#005A36] text-white hover:bg-[#005A36]/90">
                  Intake Wizard <ChevronRight size={13} />
                </Button>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
                <div>
                  <p className="text-xs font-bold text-foreground">Repair Operations Manager</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Handle queued repair tickets and component servicing</p>
                </div>
                <Button size="sm" onClick={() => navigate(`/${overviewSlug}/repairs`)} className="gap-1 text-xs font-bold bg-[#005A36] text-white hover:bg-[#005A36]/90">
                  Manage Repairs <ChevronRight size={13} />
                </Button>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
                <div>
                  <p className="text-xs font-bold text-foreground">Inspection Operations Manager</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Inspect assets and review custodian condition reports</p>
                </div>
                <Button size="sm" onClick={() => navigate(`/${overviewSlug}/inspections`)} className="gap-1 text-xs font-bold bg-[#005A36] text-white hover:bg-[#005A36]/90">
                  Manage Inspections <ChevronRight size={13} />
                </Button>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
                <div>
                  <p className="text-xs font-bold text-foreground">Barcoding &amp; QR Tag Wizards</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Generate, select, and preview barcode stickers</p>
                </div>
                <Button size="sm" onClick={() => navigate(`/${overviewSlug}/qrtags`)} className="gap-1 text-xs font-bold bg-[#005A36] text-white hover:bg-[#005A36]/90">
                  Generate Tags <ChevronRight size={13} />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card shadow-sm rounded-xl">
            <CardHeader><CardTitle className="text-sm font-bold text-foreground">Campus Affiliations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Manila (Taft) Campus</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono font-bold">
                  {manilaAssetsCount} assets
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Laguna (Canlubang) Campus</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono font-bold">
                  {lagunaAssetsCount} assets
                </Badge>
              </div>
              <Separator />
              <div className="p-3 bg-muted/30 rounded-xl border border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Campus Registry</p>
                <p className="text-xs font-extrabold text-foreground mt-0.5">{displayedAssets.length} Hardware Assets Logged</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dynamic Pulse: System Alerts & Recent Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border border-border bg-card shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" /> System Alerts &amp; Action Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {unacknowledged.length > 0 ? (
                <div className="p-3 bg-red-50/70 dark:bg-red-950/30 border border-red-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 animate-pulse shrink-0" />
                    <div>
                      <span className="font-extrabold text-red-800 dark:text-red-300 block">{unacknowledged.length} Unacknowledged Repair Tickets</span>
                      <span className="text-[11px] text-red-700 dark:text-red-400">Requires technician assignment &amp; progress update</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/${overviewSlug}/repairs`)} className="text-[11px] font-bold border-red-300 text-red-700 hover:bg-red-100 shrink-0">
                    Review
                  </Button>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> All repair tickets acknowledged &amp; assigned.
                </div>
              )}

              {expiring30Days.length > 0 ? (
                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-extrabold text-amber-900 dark:text-amber-300 block">{expiring30Days.length} Assets Expiring Warranty (≤30 Days)</span>
                      <span className="text-[11px] text-amber-700 dark:text-amber-400">Service agreement renewal checks recommended</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/${overviewSlug}/health`)} className="text-[11px] font-bold border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0">
                    Inspect
                  </Button>
                </div>
              ) : (
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300 font-semibold">
                  <Shield className="w-4 h-4 text-blue-600 shrink-0" /> No hardware warranties expiring within 30 days.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border bg-card shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Package className="w-4 h-4 text-[#005A36]" /> Recent Equipment Registrations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {recentAssets.map(asset => (
                <div key={asset.id} className="p-2.5 bg-muted/20 border border-border rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-foreground block">{asset.name} <span className="font-mono text-primary text-[11px]">({asset.id})</span></span>
                    <span className="text-[10px] text-muted-foreground">{asset.category} · {asset.location || asset.lab || "ITS Warehouse"}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
                    {asset.status || "Active"}
                  </Badge>
                </div>
              ))}
              {recentAssets.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground italic bg-muted/10 rounded-xl">
                  No assets logged in system.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Register ──────────────────────────────────────────────────────────────
  if (activeTab === "register") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">Equipment Procurement Registration</h1>
          <p className="text-muted-foreground text-sm">Register newly acquired computing assets, sensors, and network devices.</p>
        </div>

        <Card className="max-w-xl mx-auto">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border pb-4 px-5">
            <div>
              <CardTitle className="text-sm">Procurement Intake Wizard</CardTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">Complete all fields to compile hardware records</p>
            </div>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-extrabold">STEP {step} OF 3</Badge>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-bold text-foreground">Asset Name</Label>
                  <Input placeholder="e.g. MacBook Pro M3 Max" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Manufacturer</Label>
                    <Input placeholder="Apple Inc." value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Serial Number</Label>
                    <Input placeholder="SN-C02Z4..." value={form.serial} onChange={e => setForm({ ...form, serial: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Asset Category</Label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {ASSET_CATEGORIES.map(t => (
                        <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground">Upload Asset Photo (.jpg or .png)</Label>
                      {form.image && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, image: "" })}
                          className="text-[10px] text-red-600 hover:underline font-semibold"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                    <Input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!/\.(jpg|jpeg|png)$/i.test(file.name)) {
                          alert("Security Error: Only valid .jpg and .png image files are permitted!");
                          e.target.value = "";
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = ev => {
                          setForm({ ...form, image: ev.target?.result as string });
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="text-xs text-slate-500 cursor-pointer"
                    />
                    {form.image && (
                      <div className="mt-1 flex items-center gap-2 bg-muted/30 p-1.5 rounded border border-border">
                        <img src={form.image} alt="Preview" className="w-8 h-8 object-cover rounded border" />
                        <span className="text-[10px] text-emerald-700 font-bold">Image loaded successfully</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Procurement Date</Label>
                    <Input type="date" value={form.procured} onChange={e => setForm({ ...form, procured: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Warranty Expiration</Label>
                    <Input type="date" value={form.warranty} onChange={e => setForm({ ...form, warranty: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Funding Origin</Label>
                    <select value={form.funding} onChange={e => setForm({ ...form, funding: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {fundingSources.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Acquisition Value (₱)</Label>
                    <Input type="number" min={0} placeholder="e.g. 50000" value={form.acquisitionValue || ""} onChange={e => setForm({ ...form, acquisitionValue: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Campus Location</Label>
                    <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="Manila">Manila Campus</option>
                      <option value="Laguna">Laguna Campus</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Responsible Laboratory Group</Label>
                    <select value={form.lab} onChange={e => setForm({ ...form, lab: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {["CITe4D", "CAR", "CeLT", "CeHCI", "Bio", "HXIL", "GAME", "CIVI", "CNIS", "TE3D"].map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-bold text-foreground">TSG / ITS Comments &amp; Remarks</Label>
                  <textarea
                    value={form.remarks || ""}
                    onChange={e => setForm({ ...form, remarks: e.target.value })}
                    placeholder="Freely input any comments, technical notes, or initial remarks on this specific asset..."
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
                <div className="p-4 bg-muted/40 rounded-xl border border-border text-xs space-y-1.5 text-muted-foreground">
                  <p className="font-bold text-foreground">Procurement Compliance Checklist:</p>
                  <p>✓ Registry tagging matches barcode guidelines</p>
                  <p>✓ Campus location matches real-time room assignments</p>
                  <p>✓ Funding boundaries bound to academic allocations</p>
                </div>
              </div>
            )}

            <Separator className="my-4" />

            <div className="flex justify-between">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
              ) : <div />}

              {step < 3 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!form.name || !form.serial}>Continue Step {step + 1}</Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitted}>
                  {submitted ? "Compiling registry..." : "Commit Intake Registry"}
                </Button>
              )}
            </div>
            {registrationError && (
              <p className="text-xs text-red-600 font-semibold mt-2">⚠️ {registrationError}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Inventory ─────────────────────────────────────────────────────────────
  if (activeTab === "inventory") {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-foreground mb-1">Asset Inventory</h1>
            <p className="text-muted-foreground text-sm">Complete hardware registry · {displayedAssets.filter(a => a.status !== "Disposed").length} active assets across 2 campuses</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-border">
              <Button variant={viewMode === "gallery" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("gallery")} className="rounded-none text-xs gap-1.5"><LayoutGrid size={13} />Gallery</Button>
              <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("table")} className="rounded-none text-xs gap-1.5"><Table2 size={13} />Table</Button>
            </div>
          </div>
        </div>

        {/* Sub-tab selection bar */}
        <div className="flex border-b border-border mb-5 gap-4">
          <button
            onClick={() => setInventorySubTab("active")}
            className={cn("pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all", inventorySubTab === "active" ? "border-emerald-700 text-emerald-800" : "border-transparent text-muted-foreground")}
          >
            Active Registry ({displayedAssets.filter(a => a.status !== "Disposed").length})
          </button>
          <button
            onClick={() => setInventorySubTab("disposed")}
            className={cn("pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all", inventorySubTab === "disposed" ? "border-emerald-700 text-emerald-800" : "border-transparent text-muted-foreground")}
          >
            Decommissioned Archive ({displayedAssets.filter(a => a.status === "Disposed").length})
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
            <Input className="pl-8" placeholder="Search by name or serial..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={filterFunding} onChange={e => setFilterFunding(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="All">All Funding Origins</option>
            {fundingSources.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={filterLoc} onChange={e => setFilterLoc(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="All">All Campuses</option>
            <option value="Manila">Manila</option>
            <option value="Laguna">Laguna</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="name">Sort by Name</option>
            <option value="category">Sort by Category</option>
            <option value="procured">Sort by Procurement Date</option>
          </select>
          <Button variant="outline" onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")} className="h-10 text-xs font-bold">
            {sortOrder === "asc" ? "↑ Ascending" : "↓ Descending"}
          </Button>
        </div>

        {(() => {
          const sortedAssets = [...filtered].sort((a, b) => {
            let comp = 0;
            if (sortBy === "category") {
              comp = (a.category || "").localeCompare(b.category || "");
            } else if (sortBy === "procured") {
              const dateA = a.procured ? new Date(a.procured).getTime() : 0;
              const dateB = b.procured ? new Date(b.procured).getTime() : 0;
              comp = dateA - dateB;
            } else {
              comp = (a.name || "").localeCompare(b.name || "");
            }
            return sortOrder === "asc" ? comp : -comp;
          });

          return sortedAssets.length === 0 ? (
            <Card className="text-center py-10 text-muted-foreground">No assets matched your active filters</Card>
          ) : viewMode === "gallery" ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
              {sortedAssets.map(eq => (
                <AssetGalleryCard
                  key={eq.id}
                  eq={eq}
                  onSelect={() => setSelectedAsset(openAsset(eq))}
                  onDelete={inventorySubTab === "active" ? () => setAssetToDelete(eq.id) : undefined}
                  onEdit={inventorySubTab === "active" ? () => setEditingAsset(eq) : undefined}
                  onDecommission={inventorySubTab === "active" ? () => setDisposalAsset(eq) : undefined}
                />
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {["", "Asset ID", "Name", "Category", "Status", "Custodian", "Location", "Cond.", "Funding", "Action"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAssets.map(eq => (
                    <TableRow key={eq.id} className={cn("cursor-pointer transition-colors", eq.status === "Disposed" ? "opacity-50 grayscale bg-muted/10 hover:bg-muted/20" : "")} onClick={() => setSelectedAsset(openAsset(eq))}>
                      <TableCell><div className="w-10 h-7 rounded overflow-hidden"><AssetImagePlaceholder category={eq.category} aspectRatio="4/3" imageUrl={eq.image || eq.image_url} /></div></TableCell>
                      <TableCell className="font-bold text-primary text-xs">{eq.id}</TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">{eq.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{eq.category}</TableCell>
                      <TableCell><Badge className={cn("text-[10px]", statusBadgeClass[eq.status])}>{eq.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{eq.custodian || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{eq.currentLocation || eq.location}</TableCell>
                      <TableCell><ConditionState value={eq.assetCondition} /></TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{eq.funding}</Badge></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {inventorySubTab === "active" ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => setEditingAsset(eq)}
                              title="Edit Asset"
                            >
                              <Pencil size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                              onClick={() => setDisposalAsset(eq)}
                              title="Decommission Asset"
                            >
                              <Archive size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setAssetToDelete(eq.id)}
                              title="Remove Asset"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[10px] uppercase font-bold text-red-500 tracking-wider">Decommissioned</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          );
        })()}

        <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />

        {/* Edit Asset Dialog */}
        {editingAsset && (
          <EditAssetDialog
            key={editingAsset.id}
            asset={editingAsset}
            onClose={() => setEditingAsset(null)}
            onSave={() => {
              syncFromDb();
              fetchDbAssets();
            }}
          />
        )}

        {/* Disposal Form Dialog */}
        {disposalAsset && (
          <DisposalFormDialog
            key={disposalAsset.id}
            asset={disposalAsset}
            onClose={() => setDisposalAsset(null)}
            requestedBy={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "ITS Staff"}
            onSubmitted={() => fetchDbAssets()}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={assetToDelete !== null} onOpenChange={open => { if (!open) { setAssetToDelete(null); setDeleteError(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground">Confirm Asset Deletion</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Are you sure you want to permanently delete asset <strong className="text-primary">{assetToDelete}</strong> from the AdRIC registry? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {deleteError && <p className="text-xs text-red-600 font-semibold">⚠️ {deleteError}</p>}
            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => { setAssetToDelete(null); setDeleteError(null); }}>Cancel</Button>
              <Button variant="destructive" size="sm" disabled={deleting} onClick={handleDeleteConfirm}>
                {deleting ? "Deleting..." : "Permanently Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Repair Progress Dialog */}
        {updatingTicket && (
          <RepairProgressDialog
            ticket={updatingTicket}
            onClose={() => setUpdatingTicket(null)}
            onSave={handleUpdateRepairStatus}
          />
        )}
      </div>
    );
  }

  // ── Repairs ───────────────────────────────────────────────────────────────
  if (activeTab === "repairs") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">Repair Operations Manager</h1>
          <p className="text-muted-foreground text-sm">Track physical equipment component servicing and troubleshooting.</p>
          {loadingDbRepairs && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5"><Clock size={11} className="animate-pulse" />Loading repair tickets from database…</p>
          )}
          {!loadingDbRepairs && dbRepairsError && (
            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1.5"><AlertTriangle size={11} />{dbRepairsError} — showing local data only.</p>
          )}
        </div>

        {/* Repair Requests Priority Table */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Wrench size={18} className="text-red-500 animate-pulse" />
              <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Maintenance Request &amp; Priority Matrix</h3>
              {unacknowledged.length > 0 && (
                <Badge className="bg-red-500 hover:bg-red-600 text-white font-extrabold text-[9px] px-2 py-0.5 tracking-wider">
                  {unacknowledged.length} ATTENTION REQUIRED
                </Badge>
              )}
            </div>
            {activeRepairs.length > 0 && (
              <div className="text-[11px] text-muted-foreground font-semibold">
                Sorted by: <span className="text-emerald-700">Urgency Severity ➔ Date</span>
              </div>
            )}
          </div>

          {activeRepairs.length > 0 ? (
            <Card className="overflow-hidden p-0 border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {["Priority", "Ticket ID", "Asset", "Custodian", "Submitted At", "Dispatched To", "Acknowledge State", "Actions"].map(h => (
                      <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeRepairs.map(req => {
                    const isCritical = req.priority === "Critical";
                    const isHigh = req.priority === "High";

                    const priorityBadgeClass = isCritical
                      ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100"
                      : isHigh
                        ? "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100"
                        : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100";

                    return (
                      <TableRow
                        key={req.id}
                        className={cn(
                          "transition-colors hover:bg-muted/10",
                          !req.acknowledged ? (isCritical ? "bg-red-50/20 hover:bg-red-50/30" : "bg-orange-50/15 hover:bg-orange-50/25") : ""
                        )}
                      >
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[9px] font-extrabold tracking-wider uppercase px-2", priorityBadgeClass)}>
                            {req.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-xs font-mono">{req.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs font-bold text-foreground">{req.assetName}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-muted-foreground font-mono">{req.assetId}</span>
                              <span className="text-muted-foreground text-[10px]">·</span>
                              <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0",
                                req.statusLabel === "Fixed & Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  req.statusLabel === "Warranty Holder Possession" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                    req.statusLabel === "Third-Party Repairer Possession" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                      "bg-amber-50 text-amber-700 border-amber-200"
                              )}>
                                {req.statusLabel || "Under Maintenance"}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">{req.custodian}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{req.submittedAt}</TableCell>
                        <TableCell>
                          {req.forwardedTo ? (
                            <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0", req.forwardedTo === "ITS" ? "bg-blue-50 text-blue-700 border-blue-200" : req.forwardedTo === "TSG" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-purple-50 text-purple-700 border-purple-200")}>
                              {req.forwardedTo}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {req.acknowledged ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold">
                              Active In Queue
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500 text-white border-red-500 text-[9px] font-extrabold animate-pulse">
                              Pending Action
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            {!req.acknowledged && (
                              <Button
                                size="sm"
                                className="h-7 text-[10px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-2"
                                onClick={() => handleAcknowledgeRepair(req.id)}
                              >
                                <CheckCircle size={10} className="mr-1" /> Acknowledge
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="h-7 text-[10px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-2"
                              onClick={() => setUpdatingTicket(req)}
                            >
                              <Wrench size={10} className="mr-1" /> {req.statusLabel === "Fixed & Completed" ? "View Details" : "Manage Request"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl">
              {dbRepairs.length === 0 ? (
                loadingDbRepairs ? (
                  "Loading repair tickets…"
                ) : dbRepairsError ? (
                  `Couldn't load repair tickets: ${dbRepairsError}`
                ) : (
                  "No repair tickets exist yet — none have been filed via Report Issue or a return's \"Flag for Repair\" toggle."
                )
              ) : (
                "All equipment repairs are completed. There are no active tickets in the priority matrix queue."
              )}
            </div>
          )}
        </div>

        {/* Completed Repairs History Section */}
        <div className="mt-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle size={18} className="text-emerald-600" />
            <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Completed Repairs History</h3>
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-extrabold text-[9px] px-2 py-0.5 tracking-wider border-emerald-200">
              {completedRepairs.length} TICKETS ARCHIVED
            </Badge>
          </div>

          {completedRepairs.length > 0 ? (
            <Card className="overflow-hidden p-0 border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {["Priority", "Ticket ID", "Asset", "Custodian", "Submitted At", "Dispatched To", "Completion State", "Actions"].map(h => (
                      <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedRepairs.map(req => {
                    return (
                      <TableRow key={req.id} className="transition-colors hover:bg-muted/10">
                        <TableCell>
                          <Badge variant="outline" className="text-[9px] font-extrabold tracking-wider uppercase px-2 bg-slate-50 text-slate-500 border-slate-200">
                            {req.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-xs font-mono">{req.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs font-bold text-foreground">{req.assetName}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{req.assetId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">{req.custodian}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{req.submittedAt}</TableCell>
                        <TableCell>
                          {req.forwardedTo ? (
                            <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0", req.forwardedTo === "ITS" ? "bg-blue-50 text-blue-700 border-blue-200" : req.forwardedTo === "TSG" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-purple-50 text-purple-700 border-purple-200")}>
                              {req.forwardedTo}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold">
                            Fixed &amp; Re-assigned
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            className="h-7 text-[10px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-2"
                            onClick={() => setUpdatingTicket(req)}
                          >
                            <Wrench size={10} className="mr-1" /> View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl">
              No completed repairs recorded in the history log yet.
            </div>
          )}
        </div>

        {/* Repair Progress Dialog */}
        {updatingTicket && (
          <RepairProgressDialog
            ticket={updatingTicket}
            onClose={() => setUpdatingTicket(null)}
            onSave={handleUpdateRepairStatus}
          />
        )}
      </div>
    );
  }

  // ── Inspections ────────────────────────────────────────────────────────────
  if (activeTab === "inspections") {
    // The log shows the reports saved in asset_reports, newest first, whoever filed
    // them and from whichever browser. The database stores no cycle type, so the
    // log has no cycle column. (F-28, issue #34)
    const reportLog = dbReports.map(r => ({
      id: `RPT-${r.reportId}`,
      assetId: r.assetId,
      assetName: r.assetName,
      reportedBy: r.reportedBy,
      status: REPORT_CONDITION_LABEL[r.reportCondition] || r.reportCondition,
      description: r.reportRemarks || "",
      images: r.reportImg ? [r.reportImg] : [],
      submittedAt: r.reportDate,
    }));

    return (
      <div>
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-foreground mb-1">Inspection Operations Manager</h1>
            <p className="text-muted-foreground text-sm">Inspect assets one lab group at a time and review the condition reports on file.</p>
          </div>
        </div>

        {/* Group tabs using shadcn Tabs */}
        {(() => {
          const allKnownLabs = ["CITe4D", "CAR", "CeHCI", "CeLT", "CNIS", "GAME", "Bio", "CIVI", "TE3D", "HXIL"];

          const matchesLab = (assetLab: string | undefined, groupLabs: string[]) => {
            if (!assetLab) return false;
            const labStr = assetLab.trim().toLowerCase();
            return groupLabs.some(l => {
              const lLower = l.toLowerCase();
              return labStr === lLower || labStr.includes(lLower) || (lLower === "bio" && labStr.includes("bioinformatics")) || (lLower === "game" && labStr.includes("game"));
            });
          };

          const getGroupAssets = (groupId: string, labs: string[]) => {
            return displayedAssets.filter(a => {
              if (matchesLab(a.lab, labs)) return true;
              if (groupId === "A" && (!a.lab || !allKnownLabs.some(kl => matchesLab(a.lab, [kl])))) {
                return true;
              }
              return false;
            });
          };

          const dynamicGroups = labGroups.map(g => {
            const gAssets = getGroupAssets(g.id, g.labs);
            const due = gAssets.filter(a => a.status === "Maintenance" || a.status === "Overdue" || (a.condition !== undefined && a.condition < 80)).length;
            return { ...g, assets: gAssets.length, due };
          });

          return (
            <Tabs value={activeGroup} onValueChange={setActiveGroup}>
              <TabsList className="mb-4 h-auto gap-1 bg-muted/40">
                {dynamicGroups.map(g => (
                  <TabsTrigger key={g.id} value={g.id} className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                    <span className={cn("w-2 h-2 rounded-full", g.color.replace("text-", "bg-"))} />
                    {g.name}
                    {g.due > 0 && <Badge className="text-[9px] bg-red-100 text-red-700 border-red-200 ml-0.5">{g.due}</Badge>}
                  </TabsTrigger>
                ))}
              </TabsList>

              {dynamicGroups.map(g => {
                const groupAssets = getGroupAssets(g.id, g.labs);
                const queueItems = groupAssets.map(a => {
                  const isInspected = itemInspectedState[a.id] === true;
                  const status = isInspected ? "Inspected" : "For Inspection";
                  const urgency = a.status === "Maintenance" || a.status === "Overdue" ? "Critical" : (a.condition !== undefined && a.condition < 80 ? "High" : "Normal");

                  return {
                    id: `MNT-${String(a.id).replace(/^[^\d]+/, "").padStart(4, "0")}`,
                    asset: a.name,
                    serial: a.serial || a.id,
                    lab: a.lab || g.labs[0] || "CITe4D",
                    lastInspected: a.procured || "Jan 15, 2024",
                    status,
                    urgency,
                    rawAsset: a
                  };
                });

                return (
                  <TabsContent key={g.id} value={g.id}>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[{ val: String(g.assets), label: "Total Assets" }, { val: String(g.due), label: "Due / Overdue" }, { val: g.labs.join(", "), label: "Labs" }].map(({ val, label }) => (
                        <Card key={label}><CardContent className="pt-4 pb-4"><p className="text-xl font-extrabold text-foreground">{val}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>
                      ))}
                    </div>
                    <Card className="overflow-hidden p-0 mb-8">
                      <CardHeader className="px-5 py-4 flex-row items-center justify-between space-y-0 border-b border-border">
                        <div>
                          <CardTitle className="text-sm">Inspection Queue — Group {g.id} ({g.labs.join(", ")})</CardTitle>
                        </div>
                      </CardHeader>
                      {queueItems.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              {["Ticket ID", "Asset", "Lab", "Last Inspected", "Status", "Urgency", "Action"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {queueItems.map(item => (
                              <TableRow key={item.id} className="transition-colors hover:bg-muted/10">
                                <TableCell className="font-bold text-primary text-xs font-mono">{item.id}</TableCell>
                                <TableCell><p className="text-xs font-semibold text-foreground">{item.asset}</p><p className="text-[10px] text-muted-foreground font-mono">{item.serial}</p></TableCell>
                                <TableCell className="text-xs text-muted-foreground">{item.lab}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{item.lastInspected}</TableCell>
                                <TableCell><Badge className={cn("text-[10px]", statusBadge[item.status])}>{item.status}</Badge></TableCell>
                                <TableCell><Badge className={cn("text-[10px]", urgencyBadge[item.urgency])}>{item.urgency}</Badge></TableCell>
                                <TableCell>
                                  {item.status === "Inspected" ? (
                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold gap-1">
                                      <CheckCircle size={11} /> Inspected
                                    </Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedQueueItem(item);
                                        setInspectionStatusOption("Operational");
                                        setInspectionNotesOption("");
                                      }}
                                      className="bg-[#005A36] hover:bg-[#004225] text-white font-bold text-[10px] h-7 px-2.5 gap-1 shadow-sm"
                                    >
                                      <ClipboardCheck size={11} /> Inspect / Log Report
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="p-6 text-center text-xs text-muted-foreground bg-muted/10">
                          No registered equipment currently assigned to Group {g.id} ({g.labs.join(", ")}).
                        </div>
                      )}
                    </Card>
                  </TabsContent>
                );
              })}
            </Tabs>
          );
        })()}

        {/* Inspection Report Log Section */}
        {reportLog.length > 0 ? (
          <div className="mt-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <ClipboardCheck size={18} className="text-[#005A36]" />
              <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Inspection Report Log</h3>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-extrabold text-[9px] px-2 py-0.5 tracking-wider border-emerald-200">
                {reportLog.length} REPORTS SUBMITTED
              </Badge>
            </div>

            <Card className="overflow-hidden p-0 border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {["Report ID", "Asset", "Reported By", "Preset Status", "Date Submitted", "Actions"].map(h => (
                      <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportLog.map(rep => {
                    const isPerfect = rep.status === "Perfect";
                    const isOperational = rep.status === "Operational";
                    const isDrift = rep.status === "Minor Drift";
                    const isDegraded = rep.status === "Degraded Performance";

                    const statusBadge = isPerfect
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : isOperational
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : isDrift
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : isDegraded
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : "bg-red-50 text-red-700 border-red-200";

                    return (
                      <TableRow key={rep.id} className="transition-colors hover:bg-muted/10">
                        <TableCell className="font-bold text-xs font-mono">{rep.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs font-bold text-foreground">{rep.assetName}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{rep.assetId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">{rep.reportedBy}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[9px] font-extrabold px-1.5 py-0", statusBadge)}>
                            {rep.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{rep.submittedAt}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => setSelectedInspection(rep)}
                          >
                            <Eye size={10} className="mr-1" /> View Report
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl mb-6">
            No inspection reports have been saved yet.
          </div>
        )}

        {/* Log Inspection Report Dialog for Queue Item */}
        <Dialog open={!!selectedQueueItem} onOpenChange={(open) => !open && setSelectedQueueItem(null)}>
          {selectedQueueItem && (
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ClipboardCheck className="text-[#005A36]" size={16} /> Log Asset Inspection Report
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Record technical inspection details, condition ratings, and role remarks for {selectedQueueItem.asset} ({selectedQueueItem.rawAsset?.id || selectedQueueItem.id}).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3.5 my-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold text-foreground">Inspector Role</Label>
                    <Select value={inspectorRoleOption} onValueChange={setInspectorRoleOption}>
                      <SelectTrigger className="mt-1 h-9 text-xs">
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TSG Staff">TSG Staff (Technical Operations)</SelectItem>
                        <SelectItem value="ITS Staff">ITS Staff (Central Asset Admin)</SelectItem>
                        <SelectItem value="Lab Head">Lab Head / Approver</SelectItem>
                        <SelectItem value="Custodian">Custodian Auditor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-foreground">Condition Rating</Label>
                    <Select value={inspectionStatusOption} onValueChange={setInspectionStatusOption}>
                      <SelectTrigger className="mt-1 h-9 text-xs">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Perfect">Perfect (Brand New / 100%)</SelectItem>
                        <SelectItem value="Operational">Operational (Standard Wear / 90%)</SelectItem>
                        <SelectItem value="Minor Drift">Minor Drift (Functional / 78%)</SelectItem>
                        <SelectItem value="Degraded Performance">Degraded Performance (Needs Service / 60%)</SelectItem>
                        <SelectItem value="Critical Defect">Critical Defect (Non-Functional / 35%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground">TSG Technical &amp; Hardware Remarks</Label>
                  <textarea
                    value={tsgRemarksOption}
                    onChange={(e) => setTsgRemarksOption(e.target.value)}
                    placeholder="Enter physical hardware metrics, component diagnostics, fan noise, thermal readings, or maintenance notes..."
                    rows={2}
                    className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1 resize-none"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground">ITS Governance &amp; Compliance Remarks</Label>
                  <textarea
                    value={itsRemarksOption}
                    onChange={(e) => setItsRemarksOption(e.target.value)}
                    placeholder="Enter asset tag verification, warranty claim status, software license check, or audit compliance notes..."
                    rows={2}
                    className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1 resize-none"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                    <Camera size={13} className="text-[#005A36]" /> Inspection Photo Evidence / Proof (Optional)
                  </Label>
                  <div className="mt-1 flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      id="inspection-img-input"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setInspectionImgOption(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label
                      htmlFor="inspection-img-input"
                      className="px-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer hover:bg-slate-100 flex items-center gap-1.5"
                    >
                      <Upload size={13} /> {inspectionImgOption ? "Change Photo Proof" : "Upload Inspection Photo"}
                    </label>
                    {inspectionImgOption && (
                      <div className="flex items-center gap-2">
                        <img src={inspectionImgOption} alt="Inspection Proof" className="w-8 h-8 object-cover rounded border border-slate-300" />
                        <button
                          type="button"
                          onClick={() => setInspectionImgOption("")}
                          className="text-[10px] text-red-600 hover:underline font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedQueueItem(null)}>Cancel</Button>
                <Button
                  size="sm"
                  className="bg-[#005A36] hover:bg-[#004225] text-white font-bold text-xs"
                  onClick={async () => {
                    const fullNotes = [
                      tsgRemarksOption ? `[TSG Remarks]: ${tsgRemarksOption}` : "",
                      itsRemarksOption ? `[ITS Remarks]: ${itsRemarksOption}` : "",
                      inspectionNotesOption ? `[Notes]: ${inspectionNotesOption}` : ""
                    ].filter(Boolean).join(" | ") || "Routine periodic physical inspection verified.";

                    await syncFromDb();

                    // Save report under asset_reports table in MySQL database
                    if (selectedQueueItem.rawAsset?.id || selectedQueueItem.id) {
                      try {
                        const conditionEnumMap: Record<string, string> = {
                          "Perfect": "PERFECT",
                          "Operational": "OPERATIONAL",
                          "Minor Drift": "MINOR_DRIFT",
                          "Degraded Performance": "DEGRADED",
                          "Critical Defect": "CRITICAL_DEFECT",
                        };
                        const targetTag = selectedQueueItem.rawAsset?.id || selectedQueueItem.id;
                        await inspectionsApi.submitInspectionRaw(targetTag, {
                          reporterEmail: currentUser?.email,
                          reportedById: currentUser?.user_id,
                          reportCondition: conditionEnumMap[inspectionStatusOption] || "PERFECT",
                          reportRemarks: fullNotes,
                          reportImg: inspectionImgOption || null,
                        });
                        await fetchDbAssets();
                        await fetchDbReports();
                      } catch (e) {
                        console.error("Failed to save asset inspection report in MySQL asset_reports:", e);
                      }
                    }

                    if (selectedQueueItem.rawAsset) {
                      syncFromDb();
                    }

                    setItemInspectedState(prev => ({ ...prev, [selectedQueueItem.rawAsset?.id || selectedQueueItem.id]: true }));
                    setSelectedQueueItem(null);
                    setInspectionImgOption("");
                    setTsgRemarksOption("");
                    setItsRemarksOption("");
                    alert(`Inspection Report logged & saved under asset_reports table in MySQL for ${selectedQueueItem.asset}!`);
                  }}
                >
                  Submit &amp; Finalize Inspection
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>

        {/* Inspection Details Dialog */}
        <Dialog open={!!selectedInspection} onOpenChange={(open) => !open && setSelectedInspection(null)}>
          {selectedInspection && (
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-foreground">Inspection Report Details</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">Condition report saved in the inspection records.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-2">
                <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-[9px] font-extrabold text-muted-foreground tracking-widest uppercase">Report reference</p>
                    <p className="text-sm font-bold text-primary font-mono mt-0.5">{selectedInspection.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="border border-border rounded-lg p-2.5 bg-background">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Asset Information</p>
                    <p className="font-bold mt-1 text-foreground">{selectedInspection.assetName}</p>
                    <p className="font-mono text-muted-foreground mt-0.5">{selectedInspection.assetId}</p>
                  </div>
                  <div className="border border-border rounded-lg p-2.5 bg-background">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Reported By</p>
                    <p className="font-semibold mt-1 text-foreground">{selectedInspection.reportedBy}</p>
                    <p className="text-muted-foreground mt-0.5">{selectedInspection.submittedAt}</p>
                  </div>
                </div>

                <div className="border border-border rounded-lg p-3 bg-background">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Condition Status Check-in</span>
                    <Badge variant="outline" className={cn("text-[9px] font-extrabold",
                      selectedInspection.status === "Perfect" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        selectedInspection.status === "Operational" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          selectedInspection.status === "Minor Drift" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            selectedInspection.status === "Degraded Performance" ? "bg-orange-50 text-orange-700 border-orange-200" :
                              "bg-red-50 text-red-700 border-red-200"
                    )}>
                      {selectedInspection.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed italic">"{selectedInspection.description || "No manual remarks provided."}"</p>
                </div>

                {selectedInspection.images && selectedInspection.images.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Uploaded Physical Verification Image(s)</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedInspection.images.map((img: string, i: number) => (
                        <div key={i} className="border border-border rounded-lg overflow-hidden max-w-full">
                          <img src={img} alt="inspection asset" className="max-h-64 object-contain rounded-lg" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedInspection(null)}>Close View</Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </div>
    );
  }

  // ── Pending Returns ───────────────────────────────────────────────────────
  if (activeTab === "returns") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">Pending Returns Ledger</h1>
          <p className="text-muted-foreground text-sm">Verify physical equipment presence, condition check, and close borrow records.</p>
        </div>

        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                {["Asset ID", "Asset Name", "Custodian", "Proposed Return Date", "Custodian Comments", "Action"].map(h => (
                  <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingReturns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No pending return requests in queue.
                  </TableCell>
                </TableRow>
              ) : (
                pendingReturns.map(req => {
                  const matchingAsset = displayedAssets.find(a => a.id === req.assetId);
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-bold text-primary text-xs">{req.assetId}</TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">{req.assetName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{req.custodian}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{req.returnDate}</TableCell>
                      <TableCell className="text-xs text-muted-foreground italic max-w-[200px] truncate" title={req.comments}>
                        "{req.comments || "—"}"
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => {
                            if (matchingAsset) {
                              setSelectedReturnAsset(matchingAsset);
                            } else {
                              setSelectedReturnAsset({
                                id: req.assetId,
                                name: req.assetName,
                                custodian: req.custodian,
                                status: "Pending Return",
                                category: "Computing Array"
                              });
                            }
                          }}
                        >
                          Evaluate &amp; Finalize
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Dialog for Finalizing Returns */}
        <Dialog open={selectedReturnAsset !== null} onOpenChange={open => { if (!open) setSelectedReturnAsset(null); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground">Evaluate &amp; Finalize Return</DialogTitle>
            </DialogHeader>
            {selectedReturnAsset && (
              <ReturnForm
                asset={selectedReturnAsset}
                onBack={() => setSelectedReturnAsset(null)}
                onClose={() => setSelectedReturnAsset(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── QR Tags ───────────────────────────────────────────────────────────────
  if (activeTab === "qrtags") {
    const toggleQR = (id: string) => setSelectedQR(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const handlePrintTags = () => {
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;

      const tagsHtml = selectedQR.map(id => {
        const a = qrAssets.find(x => x.id === id);
        if (!a) return "";

        const svgElement = document.getElementById(`qr-svg-${id}`);
        const svgMarkup = svgElement ? svgElement.outerHTML : "";

        return `
          <div class="tag-card">
            <div class="tag-body">
              <div class="qr-container">
                ${svgMarkup}
              </div>
              <div class="text-container">
                <div class="tag-title">${a.name}</div>
                <div class="tag-meta">ID: ${a.id}</div>
                <div class="tag-meta">Lab: ${a.lab} &middot; ${a.location}</div>
                <div class="tag-link">adric.dlsu.edu.ph/assets/${a.id}</div>
              </div>
            </div>
            <div class="tag-footer">DLSU AdRIC EQUIPMENT MANAGEMENT SYSTEM</div>
          </div>
        `;
      }).join("");

      printWindow.document.write(`
        <html>
          <head>
            <title>Print Assets QR Codes</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Montserrat:wght@700;800&display=swap');
              body {
                font-family: 'Inter', sans-serif;
                margin: 0;
                padding: 20px;
                background: #ffffff;
              }
              .tags-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
              }
              .tag-card {
                border: 2px solid #111111;
                border-radius: 8px;
                padding: 12px;
                background: #ffffff;
                box-sizing: border-box;
                page-break-inside: avoid;
              }
              .tag-body {
                display: flex;
                gap: 12px;
                align-items: center;
              }
              .qr-container {
                width: 64px;
                height: 64px;
                padding: 4px;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                background: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              }
              .qr-container svg {
                width: 100% !important;
                height: 100% !important;
              }
              .text-container {
                flex: 1;
                min-width: 0;
              }
              .tag-title {
                font-family: 'Montserrat', sans-serif;
                font-size: 10px;
                font-weight: 800;
                color: #111827;
                margin-bottom: 3px;
                line-height: 1.2;
                text-transform: uppercase;
              }
              .tag-meta {
                font-size: 8px;
                color: #4b5563;
                margin-bottom: 2px;
                font-weight: 600;
              }
              .tag-link {
                font-size: 7px;
                color: #005a36;
                font-family: monospace;
                font-weight: 700;
                margin-top: 4px;
              }
              .tag-footer {
                text-align: center;
                font-size: 7px;
                color: #9ca3af;
                margin-top: 10px;
                padding-top: 6px;
                border-top: 1px solid #f3f4f6;
                font-weight: 700;
                letter-spacing: 0.05em;
              }
              @media print {
                body {
                  padding: 0;
                }
                .tag-card {
                  border-color: #000000;
                }
              }
            </style>
          </head>
          <body>
            <div class="tags-grid">
              ${tagsHtml}
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 300);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    };
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">QR Tag Layout Wizard</h1>
          <p className="text-muted-foreground text-sm">Generate and export printable physical tracking barcodes for laboratory assets.</p>
        </div>
        <div className="flex gap-4">
          <Card className="flex-1 overflow-hidden p-0">
            <CardHeader className="px-5 py-4 border-b border-border flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Select Assets</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => setSelectedQR(qrAssets.map(a => a.id))}>Select All</Button>
            </CardHeader>
            {qrAssets.map(asset => (
              <div key={asset.id} onClick={() => toggleQR(asset.id)}
                className={cn("flex items-center gap-3 px-5 py-3 cursor-pointer border-b border-border last:border-0 transition-colors", selectedQR.includes(asset.id) ? "bg-emerald-50" : "hover:bg-muted/30")}>
                <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0", selectedQR.includes(asset.id) ? "border-primary bg-primary" : "border-border bg-background")}>
                  {selectedQR.includes(asset.id) && <CheckCircle size={10} className="text-white" />}
                </div>
                <div className="flex-1"><p className="text-xs font-semibold text-foreground">{asset.name}</p><p className="text-[10px] text-muted-foreground">{asset.id} · {asset.lab} · {asset.location}</p></div>
                <QrCode size={14} className="text-muted-foreground" />
              </div>
            ))}
          </Card>

          <div className="w-72 flex-shrink-0 flex flex-col gap-3">
            <Card className="flex-1">
              <CardHeader><CardTitle className="text-sm">Tag Preview</CardTitle></CardHeader>
              <CardContent>
                {selectedQR.length === 0
                  ? <div className="flex flex-col items-center py-8 text-muted-foreground gap-2"><QrCode size={36} /><p className="text-xs">Select assets to preview</p></div>
                  : <div className="flex flex-col gap-3 max-h-72 overflow-y-auto">
                    {selectedQR.map(id => {
                      const a = qrAssets.find(x => x.id === id)!;
                      return (
                        <div key={id} className="border-2 border-foreground rounded-lg p-2.5">
                          <div className="flex gap-2">
                            <div className="w-14 h-14 bg-white rounded flex items-center justify-center flex-shrink-0 p-1 border border-border">
                              <QRCodeSVG
                                id={`qr-svg-${a.id}`}
                                value={`https://adric.dlsu.edu.ph/assets/${a.id}`}
                                size={48}
                                bgColor={"#ffffff"}
                                fgColor={"#111111"}
                                level={"M"}
                              />
                            </div>
                            <div>
                              <p className="text-[9px] font-extrabold text-foreground leading-snug">{a.name}</p>
                              <p className="text-[8px] text-muted-foreground">{a.id}</p>
                              <p className="text-[8px] text-muted-foreground">{a.lab} · {a.location}</p>
                              <p className="text-[7px] text-primary/70 font-mono mt-0.5 select-all">adric.dlsu.edu.ph/assets/{a.id}</p>
                            </div>
                          </div>
                          <p className="text-center text-[7px] text-muted-foreground tracking-wide mt-2 pt-1.5 border-t border-border">DLSU AdRIC EQUIPMENT MANAGEMENT SYSTEM</p>
                        </div>
                      );
                    })}
                  </div>
                }
              </CardContent>
            </Card>
            <Button disabled={!selectedQR.length} onClick={handlePrintTags} className="w-full gap-2 bg-[#005A36] hover:bg-[#004225] text-white"><Printer size={13} />Print {selectedQR.length > 0 ? `${selectedQR.length} Tag${selectedQR.length > 1 ? "s" : ""}` : "Tags"}</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Health Benchmarking ───────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-[#005A36]" />
            {showAdvancedAnalytics ? "TSG Maintenance & Workflows Dashboard" : "Numeric Health Benchmarking Grid"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {showAdvancedAnalytics
              ? "Real-time tracking, repair operations, condition traffic light heatmap, 90-day warranty calendar, and staggered routine inspection progress."
              : "Track physical component breakdown relative to Day 1 baseline performance logs."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {showAdvancedAnalytics && (
            <Badge variant="outline" className="border-[#005A36] text-[#005A36] bg-emerald-50 px-3 py-1 text-xs font-bold">
              Technical Support Group Active
            </Badge>
          )}
          <div className="flex items-center gap-1.5 bg-[#0A1F14]/20 border border-emerald-500/10 p-1 rounded-xl">
            <Button
              size="sm"
              variant={showAdvancedAnalytics ? "ghost" : "default"}
              onClick={() => setShowAdvancedAnalytics(false)}
              className={cn("text-xs h-8 font-bold", !showAdvancedAnalytics ? "bg-[#10B981] text-white hover:bg-[#10B981]/90" : "text-muted-foreground")}
            >
              Benchmarks Grid
            </Button>
            <Button
              size="sm"
              variant={showAdvancedAnalytics ? "default" : "ghost"}
              onClick={() => setShowAdvancedAnalytics(true)}
              className={cn("text-xs h-8 font-bold", showAdvancedAnalytics ? "bg-[#10B981] text-white hover:bg-[#10B981]/90" : "text-muted-foreground")}
            >
              Advanced Analytics
            </Button>
          </div>
        </div>
      </div>

      {showAdvancedAnalytics ? (
        <TSGAnalyticsView />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[{ label: "Within Tolerance", val: "4", col: "text-emerald-700" }, { label: "Flagged", val: "1", col: "text-red-600" }, { label: "Avg Battery Health", val: "73.8%", col: "text-blue-600" }, { label: "Avg Storage Health", val: "92.7%", col: "text-violet-600" }].map(({ label, val, col }) => (
              <Card key={label}><CardContent className="pt-4 pb-4"><p className={cn("text-2xl font-extrabold", col)}>{val}</p><p className="text-xs text-muted-foreground mt-0.5">{label}</p></CardContent></Card>
            ))}
          </div>
          <Card className="overflow-hidden p-0">
            <CardHeader className="px-5 py-4 border-b border-border">
              <CardTitle className="text-sm">Component Health Matrix — Editable Benchmarks</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {["Asset", "Battery/Power Health", "Storage Integrity", "Sensor Drift", "Uptime", "Notes", "Score"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider whitespace-nowrap">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthData.map(row => {
                  const e = healthEdits[row.id] || {};
                  const battery = parseFloat(e.battery ?? String(row.battery ?? ""));
                  const storage = parseFloat(e.storage_health ?? String(row.storage_health ?? ""));
                  const drift = parseFloat(e.sensor_drift ?? String(row.sensor_drift ?? ""));
                  const uptime = parseFloat(e.uptime ?? String(row.uptime));
                  const issues = [row.battery !== null && battery < 70, row.storage_health !== null && storage < 85, row.sensor_drift !== null && drift > 2, uptime < 80].filter(Boolean).length;
                  const score = Math.max(0, 100 - issues * 15 - (row.battery !== null && battery < 60 ? 15 : 0));
                  return (
                    <TableRow key={row.id}>
                      <TableCell><p className="text-xs font-semibold text-foreground">{row.asset}</p><p className="text-[10px] text-muted-foreground">{row.id}</p></TableCell>
                      <TableCell>
                        {row.battery !== null ? <div><div className="flex items-center gap-1"><Input type="number" min={0} max={100} value={e.battery ?? String(row.battery)} onChange={ev => setHealthEdits(p => ({ ...p, [row.id]: { ...p[row.id], battery: ev.target.value } }))} className="w-14 h-7 text-xs px-2" /><span className="text-[10px] text-muted-foreground">%</span></div><MetricBar value={battery} color={battery >= 70 ? "bg-emerald-400" : "bg-red-400"} /></div> : <span className="text-xs text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell>
                        {row.storage_health !== null ? <div><div className="flex items-center gap-1"><Input type="number" min={0} max={100} value={e.storage_health ?? String(row.storage_health)} onChange={ev => setHealthEdits(p => ({ ...p, [row.id]: { ...p[row.id], storage_health: ev.target.value } }))} className="w-14 h-7 text-xs px-2" /><span className="text-[10px] text-muted-foreground">%</span></div><MetricBar value={storage} color={storage >= 85 ? "bg-emerald-400" : "bg-amber-400"} /></div> : <span className="text-xs text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell>
                        {row.sensor_drift !== null ? <div><div className="flex items-center gap-1"><Input type="number" min={0} step={0.1} value={e.sensor_drift ?? String(row.sensor_drift)} onChange={ev => setHealthEdits(p => ({ ...p, [row.id]: { ...p[row.id], sensor_drift: ev.target.value } }))} className="w-14 h-7 text-xs px-2" /><span className="text-[10px] text-muted-foreground">°</span></div><p className={cn("text-[10px] font-semibold", drift > 2 ? "text-red-600" : drift > 1 ? "text-amber-600" : "text-emerald-600")}>{drift <= 1 ? "Nominal" : drift <= 2 ? "Monitor" : "ALERT"}</p></div> : <span className="text-xs text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell><p className={cn("text-xs font-bold", uptime >= 95 ? "text-emerald-700" : uptime >= 80 ? "text-amber-700" : "text-red-700")}>{uptime}%</p><MetricBar value={uptime} color={uptime >= 95 ? "bg-emerald-400" : uptime >= 80 ? "bg-[#10B981]" : "bg-red-400"} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px]">{row.notes}</TableCell>
                      <TableCell><p className={cn("text-lg font-extrabold", score >= 85 ? "text-emerald-700" : score >= 70 ? "text-amber-700" : "text-red-700")}>{score}</p><p className="text-[10px] text-muted-foreground">/ 100</p></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

function DisposalFormDialog({ asset, onClose, requestedBy, onSubmitted }: { asset: any; onClose: () => void; requestedBy: string; onSubmitted?: () => void }) {
  const [form, setForm] = useState({
    lastCustodian: asset?.custodian || "",
    breakdownReasons: "",
    disposalPathway: "Decommission — Scrap / Recycle",
    decommissionDate: new Date().toISOString().split("T")[0]
  });
  const [successId, setSuccessId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSave = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = await disposalsApi.requestDisposal(asset.id, {
        requestedBy,
        lastCustodian: form.lastCustodian || "Unassigned",
        breakdownReasons: form.breakdownReasons.trim() || "Decommissioned due to physical breakdown or end of servicing lifecycle.",
        disposalPathway: form.disposalPathway,
        decommissionDate: form.decommissionDate,
      });
      if (!data.success) {
        setSubmitError(data.error || "Failed to log disposal request to the database.");
        return;
      }
      setSuccessId(`DISP-${data.disposal.disposal_id}`);
      onSubmitted?.();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to reach the server.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!asset} onOpenChange={open => { if (!open && !successId) onClose(); }}>
      <DialogContent className="max-w-md">
        {successId ? (
          <div className="flex flex-col items-center text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
              <Archive size={30} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Disposal Request Submitted</h3>
              <p className="text-xs text-muted-foreground mt-1">Sent to the AdRIC Director for approval. The asset stays active until it's authorized.</p>
            </div>
            <div className="w-full bg-muted/40 rounded-xl p-3 border text-left text-xs font-mono space-y-1">
              <p><strong className="text-foreground">Asset ID:</strong> {asset.id}</p>
              <p><strong className="text-foreground">Disposal ID:</strong> {successId}</p>
              <p><strong className="text-foreground">Decommission Date:</strong> {form.decommissionDate}</p>
              <p><strong className="text-foreground">Disposal Pathway:</strong> {form.disposalPathway}</p>
            </div>
            <Button onClick={onClose} className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-9">Close Dialog</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground">Decommission &amp; Dispose Asset</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Log physical breakdown reasons and specify the disposal pathway. This request is sent to the AdRIC Director for sign-off before the asset is marked Disposed.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Asset ID / Name</Label>
                <Input value={`${asset.id} - ${asset.name}`} disabled className="bg-muted text-xs font-semibold" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Last Custodian Assignment</Label>
                <Input value={form.lastCustodian} onChange={e => setForm({ ...form, lastCustodian: e.target.value })} placeholder="e.g. Dr. Juan Dela Cruz" className="text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Main Issues / Breakdown Justification</Label>
                <textarea value={form.breakdownReasons} onChange={e => setForm({ ...form, breakdownReasons: e.target.value })} rows={3} placeholder="Describe diagnostic metrics, breakdown causes, physical damages, or reasons repair is not financially viable..." className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Disposal Pathway</Label>
                <select value={form.disposalPathway} onChange={e => setForm({ ...form, disposalPathway: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {["Decommission — Scrap / Recycle", "Decommission — Donate to Partner Institution", "Decommission — Warranty Return to Vendor", "Decommission — Institutional Auction", "Decommission — Secure Landfill"].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Final Decommission Date</Label>
                <Input type="date" value={form.decommissionDate} onChange={e => setForm({ ...form, decommissionDate: e.target.value })} className="text-xs h-9" />
              </div>
              {submitError && (
                <p className="text-xs text-red-600">{submitError}</p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSave} disabled={submitting || !form.breakdownReasons.trim()} className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-9">
                {submitting ? "Submitting…" : "Submit for Director Approval"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RepairProgressDialog({ ticket, onClose, onSave }: { ticket: any; onClose: () => void; onSave: (id: string, status: string, condition?: string, remarks?: string) => void }) {
  const [status, setStatus] = useState(ticket?.statusLabel || "Inspection Phase");
  const [showConditionForm, setShowConditionForm] = useState(false);
  const [postRepairCondition, setPostRepairCondition] = useState("PERFECT");
  const [postRepairRemarks, setPostRepairRemarks] = useState("");
  const isCompleted = ticket?.statusLabel === "Fixed & Completed";

  const handleNextOrSave = () => {
    if (status === "Fixed & Completed" && !showConditionForm) {
      setShowConditionForm(true);
      return;
    }
    if (showConditionForm) {
      onSave(ticket.id, "Fixed & Completed", postRepairCondition, postRepairRemarks);
    } else {
      onSave(ticket.id, status);
    }
    onClose();
  };

  return (
    <Dialog open={!!ticket} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">
            {showConditionForm ? "Final Post-Repair Verification & Asset Condition" : "Manage Maintenance Ticket"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {showConditionForm
              ? "Select the updated operational condition of the asset and enter technician remarks before completing repair."
              : "Review diagnostics details and update repair progress status."}
          </DialogDescription>
        </DialogHeader>

        {showConditionForm ? (
          <div className="flex flex-col gap-4 py-3">
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 text-xs space-y-1">
              <p><strong className="text-emerald-900">Target Asset:</strong> {ticket.assetName} ({ticket.assetId})</p>
              <p className="text-[11px] text-emerald-700">Status transition: <strong>MAINTENANCE ➔ RE-ASSIGNED TO CUSTODIAN</strong></p>
            </div>

            {/* Condition Selection */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-foreground">Select Post-Repair Asset Condition</Label>
              <select
                value={postRepairCondition}
                onChange={e => setPostRepairCondition(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bold"
              >
                <option value="PERFECT">PERFECT — Fully Restored &amp; Verified</option>
                <option value="OPERATIONAL">OPERATIONAL — Minor Cosmetic Wear</option>
                <option value="MINOR_DRIFT">MINOR DRIFT — Functional with Secondary Anomaly</option>
                <option value="DEGRADED">DEGRADED — Requires Monitoring</option>
                <option value="CRITICAL_DEFECT">CRITICAL DEFECT — Partial Repair / Defective</option>
              </select>
            </div>

            {/* Technician Asset Remarks */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-foreground">Technician Asset Maintenance Remarks</Label>
              <Textarea
                value={postRepairRemarks}
                onChange={e => setPostRepairRemarks(e.target.value)}
                placeholder="Enter detailed maintenance remarks (e.g. Replaced faulty PSU, updated firmware, stress tested for 2 hours OK)..."
                rows={4}
                className="text-xs resize-y"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-3">
            {/* Ticket metadata */}
            <div className="bg-muted/40 rounded-xl p-3 border text-xs space-y-1.5">
              <p><strong className="text-foreground">Ticket Ref:</strong> {ticket.id}</p>
              <p><strong className="text-foreground">Asset:</strong> {ticket.assetName} ({ticket.assetId})</p>
              <p><strong className="text-foreground">Submitted By:</strong> {ticket.custodian} on {ticket.submittedAt}</p>
              <p><strong className="text-foreground">Dispatched To:</strong> {ticket.forwardedTo || "ITS/TSG"}</p>
              <p><strong className="text-foreground">Urgency Priority:</strong> <span className={cn("font-bold", ticket.priority === "Critical" ? "text-red-700" : "text-amber-700")}>{ticket.priority}</span></p>
            </div>

            {/* Diagnostic Description */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Incident Diagnostic Description</Label>
              <p className="text-xs text-foreground bg-muted/20 p-3 rounded-lg border border-dashed border-border leading-relaxed italic font-serif">
                "{ticket.description || "No specific details logged by the custodian."}"
              </p>
            </div>

            {/* Custodian Uploaded Media */}
            {ticket.imageUrl && (
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">Custodian Uploaded Media</Label>
                <div className="rounded-lg overflow-hidden border border-border max-h-48 flex justify-center bg-black/5">
                  <img src={ticket.imageUrl} alt="troubleshooting screenshot" className="max-h-48 object-contain w-full" />
                </div>
              </div>
            )}

            {/* Progress Selector */}
            {!isCompleted && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Select Current Repair Progress</Label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="Inspection Phase">Inspection Phase (Ongoing Diagnostic checks)</option>
                  <option value="Warranty Holder Possession">Warranty Holder's Possession (Under Warranty Service)</option>
                  <option value="Third-Party Repairer Possession">Third-Party Repairer's Possession (Out-of-Warranty / Expired)</option>
                  <option value="Fixed & Completed">Fixed &amp; Completed (Re-assign to Custodian)</option>
                </select>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {showConditionForm ? (
            <Button variant="outline" size="sm" onClick={() => setShowConditionForm(false)}>Back</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          )}
          {!isCompleted && (
            <Button onClick={handleNextOrSave} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9">
              {showConditionForm ? "Finalize & Update Asset Condition" : status === "Fixed & Completed" ? "Next: Set Asset Condition ➔" : "Update Progress"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}