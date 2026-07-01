import { useState } from "react";
import { useNavigate } from "react-router";
import { useApp } from "../context";
import type { RepairRequest } from "../context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { ReturnForm } from "./ReturnForm";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { AssetImagePlaceholder } from "./AssetImagePlaceholder";
import { AssetDetailModal, type AssetDetail } from "./AssetDetailModal";
import { cn } from "./ui/utils";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus, Search, Download, CheckCircle, Clock, Package, DollarSign,
  ChevronRight, LayoutGrid, Table2, MapPin, Calendar, Tag, Wrench,
  BarChart3, Bell, AlertTriangle, Shield, QrCode, Printer, Zap, Eye,
  Image as ImageIcon, XCircle, Trash2, Pencil, Archive, ClipboardCheck
} from "lucide-react";

const MINT = "#10B981";
const fundingSources = ["DOST", "USAID", "CHED", "Internal Grants"];

const statusBadgeClass: Record<string, string> = {
  "Active":             "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Loan":            "bg-blue-50   text-blue-700   border-blue-200",
  "Maintenance":        "bg-amber-50  text-amber-700  border-amber-200",
  "Disposed":           "bg-red-50    text-red-700    border-red-200",
};

// TSG Specific Constants
const labGroups = [
  { id: "A", name: "Group A", labs: ["CITe4D"],              assets: 312, due: 4, color: "text-blue-600"    },
  { id: "B", name: "Group B", labs: ["CAR", "CeLT"],         assets: 198, due: 2, color: "text-violet-600"  },
  { id: "C", name: "Group C", labs: ["CeHCI","Bio","HXIL"],  assets: 274, due: 7, color: "text-amber-600"   },
  { id: "D", name: "Group D", labs: ["GAME", "CIVI"],        assets: 156, due: 1, color: "text-emerald-600" },
];

const maintenanceQueues: Record<string, { id:string; asset:string; serial:string; lab:string; lastInspected:string; status:string; urgency:string }[]> = {
  A: [
    { id:"MNT-2026-0141", asset:"Dell PowerEdge R740", serial:"SN-DPE-740-001", lab:"CITe4D", lastInspected:"2025-12-10", status:"Due Soon",  urgency:"Normal"   },
    { id:"MNT-2026-0142", asset:"NVIDIA DGX A100",     serial:"SN-DGX-A100-02",  lab:"CITe4D", lastInspected:"2025-11-20", status:"Overdue",   urgency:"High"     },
    { id:"MNT-2026-0143", asset:"Leica BLK360 Scanner",serial:"SN-LBK-360-09",   lab:"CITe4D", lastInspected:"2026-02-15", status:"Inspected", urgency:"Low"      },
  ],
  B: [
    { id:"MNT-2026-0151", asset:"RPi 4 Cluster ×32",  serial:"SN-RPI4-CLU-07",  lab:"CeLT", lastInspected:"2026-03-01", status:"Inspected", urgency:"Low"    },
    { id:"MNT-2026-0152", asset:"Oculus Quest Pro ×8", serial:"OQ-PRO-DLSU",     lab:"CAR",  lastInspected:"2026-01-20", status:"Due Soon",  urgency:"Normal" },
  ],
  C: [
    { id:"MNT-2026-0161", asset:"Boston Dynamics Spot",   serial:"SN-SPOT-0178",    lab:"HXIL", lastInspected:"2025-10-15", status:"Overdue",   urgency:"Critical" },
    { id:"MNT-2026-0162", asset:"Phantom VEO4K Camera",   serial:"SN-PH-VEO-4K-01", lab:"Bio",  lastInspected:"2026-04-10", status:"Inspected", urgency:"Low"      },
  ],
  D: [
    { id:"MNT-2026-0171", asset:"Surface Pro 9 Bundle",      serial:"SN-SP9-BNDL-03", lab:"GAME", lastInspected:"2026-05-01", status:"Inspected", urgency:"Low"    },
    { id:"MNT-2026-0172", asset:"Trimble SX12 Total Station",serial:"TR-SX12-0092",   lab:"CIVI", lastInspected:"2026-01-14", status:"Due Soon",  urgency:"Normal" },
  ],
};

// Deterministic unique QR grid generator
const generateUniqueQRGrid = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const grid: boolean[][] = [];
  for (let r = 0; r < 8; r++) {
    grid[r] = [];
    for (let c = 0; c < 8; c++) {
      const val = Math.abs(Math.sin(hash + r * 8 + c)) * 1000;
      grid[r][c] = (Math.floor(val) % 2) === 0;
    }
  }
  return grid;
};

const healthData = [
  { id:"EQ-2024-001", asset:"Dell PowerEdge R740", battery:null, storage_health:94,   thermal:42,   sensor_drift:null, uptime:99.8, notes:"SSD sector accumulation within tolerance"            },
  { id:"EQ-2024-002", asset:"NVIDIA DGX A100",     battery:null, storage_health:88,   thermal:68,   sensor_drift:null, uptime:97.3, notes:"GPU thermal slightly elevated — check airflow"         },
  { id:"EQ-2024-003", asset:"UR10e Cobot",          battery:72,   storage_health:null, thermal:null, sensor_drift:0.8,  uptime:98.1, notes:"Joint encoder drift within 0.8° — acceptable"          },
  { id:"EQ-2024-004", asset:"Boston Dynamics Spot", battery:54,   storage_health:null, thermal:null, sensor_drift:2.4,  uptime:71.2, notes:"Battery degraded below 60% — flag for replacement"     },
  { id:"EQ-2024-005", asset:"Leica BLK360",          battery:91,   storage_health:null, thermal:null, sensor_drift:0.2,  uptime:100,  notes:"All sensors nominal"                                    },
];

const statusBadge: Record<string,string> = {
  Inspected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Due Soon": "bg-amber-50 text-amber-700 border-amber-200",
  Overdue:    "bg-red-50 text-red-700 border-red-200",
};

const urgencyBadge: Record<string,string> = {
  Low:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  Normal:   "bg-blue-50   text-blue-700   border-blue-200",
  High:     "bg-amber-50  text-amber-700  border-amber-200",
  Critical: "bg-red-50    text-red-700    border-red-200",
};

interface IntakeForm {
  name: string;
  serial: string;
  manufacturer: string;
  category: string;
  funding: string;
  procured: string;
  warranty: string;
  location: string;
  lab: string;
  specs: string;
}

const emptyForm: IntakeForm = {
  name: "", serial: "", manufacturer: "", category: "Computing Array",
  funding: "DOST", procured: new Date().toISOString().split("T")[0],
  warranty: "", location: "Manila", lab: "CITe4D", specs: "",
};

function ConditionBar({ value }: { value: number }) {
  return <div className="h-1.5 w-11 bg-muted rounded-full overflow-hidden mt-1"><div className={cn("h-full rounded-full", value>=90?"bg-emerald-400":"bg-amber-400")} style={{width:`${value}%`}} /></div>;
}

function MetricBar({ value, color }: { value: number; color: string }) {
  return <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1 w-12"><div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100,value)}%` }} /></div>;
}

function AssetGalleryCard({ eq, onSelect, onDelete, onEdit, onDecommission }: { eq: any; onSelect: () => void; onDelete?: () => void; onEdit?: () => void; onDecommission?: () => void }) {
  const isDisposed = eq.status === "Disposed";
  return (
    <Card onClick={onSelect} className={cn("overflow-hidden p-0 gap-0 transition-all relative cursor-pointer", isDisposed ? "opacity-60 grayscale bg-muted/20 border-dashed border-muted-foreground/30 shadow-none hover:opacity-75" : "hover:shadow-md")}>
      <div className="relative">
        <AssetImagePlaceholder category={eq.category} aspectRatio="4/3" />
        <Badge className={cn("absolute top-2.5 right-2.5 text-[9px] border font-bold uppercase tracking-wider", statusBadgeClass[eq.status])}>{eq.status}</Badge>
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
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border">
          <div className={cn("h-full", eq.condition >= 90 ? "bg-emerald-400" : "bg-amber-400")} style={{ width: `${eq.condition}%` }} />
        </div>
      </div>
      <CardContent className="px-4 py-3.5 flex flex-col justify-between h-[105px]">
        <div>
          <p className="text-[10px] font-bold text-primary mb-1 tracking-wide uppercase">{eq.id}</p>
          <p className="text-sm font-bold text-foreground leading-snug line-clamp-1">{eq.name}</p>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border mt-1">
          <span>{eq.custodian || "No custodian"}</span>
          <span className="font-semibold text-foreground">{eq.condition}% cond.</span>
        </div>
      </CardContent>
    </Card>
  );
}

function RepairAlertCard({ req, onAcknowledge }: { req: RepairRequest; onAcknowledge: (id:string) => void }) {
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
  const {
    assets, addAsset, removeAsset, updateAsset, disposeAsset,
    cycleMode, setCycleMode,
    repairRequests, acknowledgeRepair, updateRepairStatus,
    returns, role, inspections
  } = useApp();
  const navigate = useNavigate();

  // ITS specific states
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<IntakeForm>(emptyForm);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [filterFunding, setFilterFunding] = useState("All");
  const [filterLoc, setFilterLoc] = useState("All");
  const [submitted, setSubmitted] = useState(false);
  const [viewMode, setViewMode] = useState<"table"|"gallery">("gallery");
  const [selectedAsset, setSelectedAsset] = useState<AssetDetail | null>(null);

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
  const [selectedReturnAsset, setSelectedReturnAsset] = useState<any | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  const unacknowledged = repairRequests.filter(r => !r.acknowledged);
  const pendingReturns = returns.filter(r => r.status === "Pending");

  const priorityWeight: Record<string, number> = {
    "Critical": 3,
    "High": 2,
    "Medium": 1
  };

  const sortedRepairs = [...repairRequests].sort((a, b) => {
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
    warranty: eq.warranty, location: eq.location, lab: eq.lab,
    status: eq.status, condition: eq.condition, custodian: eq.custodian
  });

  const filtered = assets.filter(eq => {
    const matchSearch = eq.name.toLowerCase().includes(search.toLowerCase()) || eq.serial.toLowerCase().includes(search.toLowerCase());
    const matchFunding = filterFunding === "All" || eq.funding === filterFunding;
    const matchLoc = filterLoc === "All" || eq.location === filterLoc;
    
    // Decommissioned subtab filtering
    const matchSubTab = inventorySubTab === "disposed" 
      ? eq.status === "Disposed" 
      : eq.status !== "Disposed";
      
    return matchSearch && matchFunding && matchLoc && matchSubTab;
  });

  const qrAssets = assets.filter(a => a.status !== "Disposed");

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => {
      addAsset({
        id: `EQ-2026-${String(Math.floor(Math.random()*900+100))}`,
        name: form.name,
        serial: form.serial,
        manufacturer: form.manufacturer,
        category: form.category,
        funding: form.funding,
        procured: form.procured,
        warranty: form.warranty,
        location: form.location,
        lab: form.lab,
        status: "Active",
        condition: 100,
        specs: form.specs
      });
      setShowModal(false);
      setForm(emptyForm);
      setStep(1);
      setSubmitted(false);
    }, 1800);
  };

  // ── Overview ──────────────────────────────────────────────────────────────
  if (activeTab === "overview") {
    const overviewSlug = role === "TSG" ? "tsg" : "its";
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">System Overview</h1>
          <p className="text-muted-foreground text-sm">Real-time status summaries and hardware telemetry controls.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-3xl font-extrabold text-foreground">{assets.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Assets Registered</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className={cn("text-3xl font-extrabold", unacknowledged.length > 0 ? "text-red-600 animate-pulse" : "text-foreground")}>
                {repairRequests.length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Maintenance Requests</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-3xl font-extrabold text-foreground">{pendingReturns.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pending Return Ledgers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-3xl font-extrabold text-emerald-700">97.8%</p>
              <p className="text-xs text-muted-foreground mt-0.5">System Operational Index</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-2">
            <CardHeader><CardTitle className="text-sm font-bold text-foreground">Quick Action Operations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
                <div>
                  <p className="text-xs font-bold text-foreground">Asset Procurement Registration</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Log new hardware items into AdRIC databases</p>
                </div>
                <Button size="sm" onClick={() => navigate(`/${overviewSlug}/register`)} className="gap-1 text-xs">
                  Intake Wizard <ChevronRight size={13} />
                </Button>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
                <div>
                  <p className="text-xs font-bold text-foreground">Repair Operations Manager</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Handle queued repair tickets and component servicing</p>
                </div>
                <Button size="sm" onClick={() => navigate(`/${overviewSlug}/repairs`)} className="gap-1 text-xs">
                  Manage Repairs <ChevronRight size={13} />
                </Button>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
                <div>
                  <p className="text-xs font-bold text-foreground">Inspection Operations Manager</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Configure periodic schedules and monitor custodian check-in logs</p>
                </div>
                <Button size="sm" onClick={() => navigate(`/${overviewSlug}/inspections`)} className="gap-1 text-xs">
                  Manage Inspections <ChevronRight size={13} />
                </Button>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
                <div>
                  <p className="text-xs font-bold text-foreground">Barcoding &amp; QR Tag Wizards</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Generate, select, and preview barcode stickers</p>
                </div>
                <Button size="sm" onClick={() => navigate(`/${overviewSlug}/qrtags`)} className="gap-1 text-xs">
                  Generate Tags <ChevronRight size={13} />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-bold text-foreground">Campus Affiliations</CardTitle></CardHeader>
            <CardContent className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Manila (Taft) Campus</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">624 assets</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Laguna (Canlubang) Campus</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">624 assets</Badge>
              </div>
              <Separator />
              <div className="p-3 bg-[#F9FAFB] rounded-xl border border-border">
                <p className="text-[9px] font-bold tracking-[1.5px] text-muted-foreground uppercase">Sync Status</p>
                <p className="text-xs font-semibold text-primary mt-1">Registry state synchronized with DLSU central databases</p>
              </div>
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

        <Card className="max-w-xl">
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
                  <Input placeholder="e.g. MacBook Pro M3 Max" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Manufacturer</Label>
                    <Input placeholder="Apple Inc." value={form.manufacturer} onChange={e=>setForm({...form, manufacturer:e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Serial Number</Label>
                    <Input placeholder="SN-C02Z4..." value={form.serial} onChange={e=>setForm({...form, serial:e.target.value})} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-bold text-foreground">Asset Category</Label>
                  <select value={form.category} onChange={e=>setForm({...form, category:e.target.value})}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {["Computing Array", "Robotic Node", "Mobile Infrastructure", "Sensor Array", "Networking", "Peripheral"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-bold text-foreground">Manufacturer Specifications</Label>
                  <textarea placeholder="Processor core count, RAM allocation, GPU configurations, thermal limits..." value={form.specs} onChange={e=>setForm({...form, specs:e.target.value})} rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Procurement Date</Label>
                    <Input type="date" value={form.procured} onChange={e=>setForm({...form, procured:e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Warranty Expiration</Label>
                    <Input type="date" value={form.warranty} onChange={e=>setForm({...form, warranty:e.target.value})} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-bold text-foreground">Funding Origin</Label>
                  <select value={form.funding} onChange={e=>setForm({...form, funding:e.target.value})}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {fundingSources.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Campus Location</Label>
                    <select value={form.location} onChange={e=>setForm({...form, location:e.target.value})}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="Manila">Manila Campus</option>
                      <option value="Laguna">Laguna Campus</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Responsible Laboratory Group</Label>
                    <select value={form.lab} onChange={e=>setForm({...form, lab:e.target.value})}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {["CITe4D", "CAR", "CeLT", "CeHCI", "Bio", "HXIL", "GAME", "CIVI", "COMET", "CNIS"].map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="p-4 bg-muted/40 rounded-xl border border-border text-xs space-y-1.5 text-muted-foreground">
                  <p className="font-bold text-foreground">Procurement Compliance Checklist:</p>
                  <p>✓ Registry tagging matches barcode guidelines</p>
                  <p>✓ Campus location matches real-time room assignments</p>
                  <p>✓ Funding boundaries bound to academic project allocations</p>
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
            <p className="text-muted-foreground text-sm">Complete hardware registry · {assets.filter(a => a.status !== "Disposed").length} active assets across 2 campuses</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-border">
              <Button variant={viewMode==="gallery"?"default":"ghost"} size="sm" onClick={()=>setViewMode("gallery")} className="rounded-none text-xs gap-1.5"><LayoutGrid size={13} />Gallery</Button>
              <Button variant={viewMode==="table"?"default":"ghost"} size="sm" onClick={()=>setViewMode("table")} className="rounded-none text-xs gap-1.5"><Table2 size={13} />Table</Button>
            </div>
          </div>
        </div>

        {/* Sub-tab selection bar */}
        <div className="flex border-b border-border mb-5 gap-4">
          <button
            onClick={() => setInventorySubTab("active")}
            className={cn("pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all", inventorySubTab === "active" ? "border-emerald-700 text-emerald-800" : "border-transparent text-muted-foreground")}
          >
            Active Registry ({assets.filter(a => a.status !== "Disposed").length})
          </button>
          <button
            onClick={() => setInventorySubTab("disposed")}
            className={cn("pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all", inventorySubTab === "disposed" ? "border-emerald-700 text-emerald-800" : "border-transparent text-muted-foreground")}
          >
            Decommissioned Archive ({assets.filter(a => a.status === "Disposed").length})
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
            <Input className="pl-8" placeholder="Search by name or serial..." value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <select value={filterFunding} onChange={e=>setFilterFunding(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="All">All Funding Origins</option>
            {fundingSources.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={filterLoc} onChange={e=>setFilterLoc(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="All">All Campuses</option>
            <option value="Manila">Manila</option>
            <option value="Laguna">Laguna</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <Card className="text-center py-10 text-muted-foreground">No assets matched your active filters</Card>
        ) : viewMode === "gallery" ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {filtered.map(eq => (
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
                  {["","Asset ID","Name","Category","Status","Custodian","Location","Cond.","Funding","Action"].map(h=><TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(eq => (
                  <TableRow key={eq.id} className={cn("cursor-pointer transition-colors", eq.status === "Disposed" ? "opacity-50 grayscale bg-muted/10 hover:bg-muted/20" : "")} onClick={() => setSelectedAsset(openAsset(eq))}>
                    <TableCell><div className="w-10 h-7 rounded overflow-hidden"><AssetImagePlaceholder category={eq.category} aspectRatio="4/3" /></div></TableCell>
                    <TableCell className="font-bold text-primary text-xs">{eq.id}</TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">{eq.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{eq.category}</TableCell>
                    <TableCell><Badge className={cn("text-[10px]", statusBadgeClass[eq.status])}>{eq.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{eq.custodian || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{eq.location}</TableCell>
                    <TableCell><p className={cn("text-xs font-bold", eq.condition>=90?"text-emerald-700":"text-amber-700")}>{eq.condition}%</p><ConditionBar value={eq.condition} /></TableCell>
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
        )}

        <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />

        {/* Edit Asset Dialog */}
        {editingAsset && (
          <EditAssetDialog
            key={editingAsset.id}
            asset={editingAsset}
            onClose={() => setEditingAsset(null)}
            onSave={updateAsset}
          />
        )}

        {/* Disposal Form Dialog */}
        {disposalAsset && (
          <DisposalFormDialog
            key={disposalAsset.id}
            asset={disposalAsset}
            onClose={() => setDisposalAsset(null)}
            onDispose={disposeAsset}
            role={role}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={assetToDelete !== null} onOpenChange={open => { if(!open) setAssetToDelete(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground">Confirm Asset Deletion</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Are you sure you want to permanently delete asset <strong className="text-primary">{assetToDelete}</strong> from the AdRIC registry? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setAssetToDelete(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => {
                if (assetToDelete) {
                  removeAsset(assetToDelete);
                  setAssetToDelete(null);
                }
              }}>Permanently Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Repair Progress Dialog */}
        {updatingTicket && (
          <RepairProgressDialog
            ticket={updatingTicket}
            onClose={() => setUpdatingTicket(null)}
            onSave={updateRepairStatus}
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
                                onClick={() => acknowledgeRepair(req.id)}
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
              All equipment repairs are completed. There are no active tickets in the priority matrix queue.
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
            onSave={updateRepairStatus}
          />
        )}
      </div>
    );
  }

  // ── Inspections ────────────────────────────────────────────────────────────
  if (activeTab === "inspections") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">Inspection Operations Manager</h1>
          <p className="text-muted-foreground text-sm">Configure periodic schedules and monitor periodic custodian check-in logs.</p>
        </div>

        {/* Frequency toggle */}
        <Card className="mb-5">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="font-bold text-foreground text-sm">Inspection Frequency Engine</p>
              <p className="text-xs text-muted-foreground mt-0.5">Active cycle: <strong className="text-primary">{cycleMode === "Annual" ? "Annual Cycle (once per year)" : "Trimestral Cycle (every trimester)"}</strong></p>
            </div>
            <div className="flex items-center gap-3">
              <Label className={cn("text-xs font-semibold", cycleMode === "Annual" ? "text-foreground" : "text-muted-foreground")}>Annual</Label>
              <Switch checked={cycleMode === "Trimestral"} onCheckedChange={c => setCycleMode(c ? "Trimestral" : "Annual")} className="data-[state=checked]:bg-primary" />
              <Label className={cn("text-xs font-semibold", cycleMode === "Trimestral" ? "text-foreground" : "text-muted-foreground")}>Trimestral</Label>
            </div>
          </CardContent>
        </Card>

        {/* Group tabs using shadcn Tabs */}
        <Tabs value={activeGroup} onValueChange={setActiveGroup}>
          <TabsList className="mb-4 h-auto gap-1 bg-muted/40">
            {labGroups.map(g => (
              <TabsTrigger key={g.id} value={g.id} className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                <span className={cn("w-2 h-2 rounded-full", g.color.replace("text-","bg-"))} />
                {g.name}
                {g.due > 0 && <Badge className="text-[9px] bg-red-100 text-red-700 border-red-200 ml-0.5">{g.due}</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>

          {labGroups.map(g => (
            <TabsContent key={g.id} value={g.id}>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[{val:String(g.assets),label:"Total Assets"},{val:String(g.due),label:"Due / Overdue"},{val:g.labs.join(", "),label:"Labs"}].map(({val,label}) => (
                  <Card key={label}><CardContent className="pt-4 pb-4"><p className="text-xl font-extrabold text-foreground">{val}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>
                ))}
              </div>
              <Card className="overflow-hidden p-0 mb-8">
                <CardHeader className="px-5 py-4 flex-row items-center justify-between space-y-0 border-b border-border">
                  <CardTitle className="text-sm">Inspection Queue — Group {g.id} ({g.labs.join(", ")})</CardTitle>
                  <span className="text-xs text-muted-foreground">{cycleMode} Schedule</span>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      {["Ticket ID","Asset","Lab","Last Inspected","Status","Urgency","Action"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(maintenanceQueues[g.id] ?? []).map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-bold text-primary text-xs">{item.id}</TableCell>
                        <TableCell><p className="text-xs font-semibold text-foreground">{item.asset}</p><p className="text-[10px] text-muted-foreground">{item.serial}</p></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.lab}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.lastInspected}</TableCell>
                        <TableCell><Badge className={cn("text-[10px]", statusBadge[item.status])}>{item.status}</Badge></TableCell>
                        <TableCell><Badge className={cn("text-[10px]", urgencyBadge[item.urgency])}>{item.urgency}</Badge></TableCell>
                        <TableCell><Button size="sm" className="text-xs h-7">Schedule</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Termly & Annual Inspections Log Section */}
        {inspections.length > 0 ? (
          <div className="mt-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <ClipboardCheck size={18} className="text-[#005A36]" />
              <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Termly &amp; Annual Inspection Logs</h3>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-extrabold text-[9px] px-2 py-0.5 tracking-wider border-emerald-200">
                {inspections.length} REPORTS SUBMITTED
              </Badge>
            </div>

            <Card className="overflow-hidden p-0 border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {["Cycle Type", "Report ID", "Asset", "Custodian", "Preset Status", "Date Submitted", "Actions"].map(h => (
                      <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspections.map(rep => {
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
                        <TableCell>
                          <Badge className={cn("text-[9px] font-extrabold px-1.5 py-0.5", rep.cycleType === "Trimestral" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                            {rep.cycleType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-xs font-mono">{rep.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs font-bold text-foreground">{rep.assetName}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{rep.assetId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">{rep.custodian}</TableCell>
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
            No custodian health check-in reports have been submitted for this cycle.
          </div>
        )}

        {/* Inspection Details Dialog */}
        <Dialog open={!!selectedInspection} onOpenChange={(open) => !open && setSelectedInspection(null)}>
          {selectedInspection && (
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-foreground">Inspection Report Details</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">Detailed health check-in logged by custodian.</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 my-2">
                <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-[9px] font-extrabold text-muted-foreground tracking-widest uppercase">Report reference</p>
                    <p className="text-sm font-bold text-primary font-mono mt-0.5">{selectedInspection.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-extrabold text-muted-foreground tracking-widest uppercase">Cycle Type</p>
                    <Badge className={cn("text-[9px] font-extrabold px-1.5 py-0.5 mt-0.5", selectedInspection.cycleType === "Trimestral" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                      {selectedInspection.cycleType} Inspection
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="border border-border rounded-lg p-2.5 bg-background">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Asset Information</p>
                    <p className="font-bold mt-1 text-foreground">{selectedInspection.assetName}</p>
                    <p className="font-mono text-muted-foreground mt-0.5">{selectedInspection.assetId}</p>
                  </div>
                  <div className="border border-border rounded-lg p-2.5 bg-background">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Custodian Reporter</p>
                    <p className="font-semibold mt-1 text-foreground">{selectedInspection.custodian}</p>
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
                  const matchingAsset = assets.find(a => a.id === req.assetId);
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
          <DialogContent className="max-w-lg">
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
            <Button disabled={!selectedQR.length} onClick={handlePrintTags} className="gap-2"><Printer size={13} />Print {selectedQR.length > 0 ? `${selectedQR.length} Tag${selectedQR.length > 1 ? "s" : ""}` : "Tags"}</Button>
            <Button variant="outline" disabled={!selectedQR.length} className="gap-2"><Download size={13} />Export PDF</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Health Benchmarking ───────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">Numeric Health Benchmarking Grid</h1>
        <p className="text-muted-foreground text-sm">Track physical component breakdown relative to Day 1 baseline performance logs.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[{label:"Within Tolerance",val:"4",col:"text-emerald-700"},{label:"Flagged",val:"1",col:"text-red-600"},{label:"Avg Battery Health",val:"73.8%",col:"text-blue-600"},{label:"Avg Storage Health",val:"92.7%",col:"text-violet-600"}].map(({label,val,col}) => (
          <Card key={label}><CardContent className="pt-4 pb-4"><p className={cn("text-2xl font-extrabold",col)}>{val}</p><p className="text-xs text-muted-foreground mt-0.5">{label}</p></CardContent></Card>
        ))}
      </div>
      <Card className="overflow-hidden p-0">
        <CardHeader className="px-5 py-4 border-b border-border">
          <CardTitle className="text-sm">Component Health Matrix — Editable Benchmarks</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {["Asset","Battery/Power Health","Storage Integrity","Sensor Drift","Uptime","Notes","Score"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider whitespace-nowrap">{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {healthData.map(row => {
              const e = healthEdits[row.id] || {};
              const battery = parseFloat(e.battery ?? String(row.battery ?? ""));
              const storage = parseFloat(e.storage_health ?? String(row.storage_health ?? ""));
              const drift = parseFloat(e.sensor_drift ?? String(row.sensor_drift ?? ""));
              const uptime = parseFloat(e.uptime ?? String(row.uptime));
              const issues = [row.battery !== null && battery<70, row.storage_health !== null && storage<85, row.sensor_drift !== null && drift>2, uptime<80].filter(Boolean).length;
              const score = Math.max(0, 100 - issues*15 - (row.battery !== null && battery<60 ? 15 : 0));
              return (
                <TableRow key={row.id}>
                  <TableCell><p className="text-xs font-semibold text-foreground">{row.asset}</p><p className="text-[10px] text-muted-foreground">{row.id}</p></TableCell>
                  <TableCell>
                    {row.battery !== null ? <div><div className="flex items-center gap-1"><Input type="number" min={0} max={100} value={e.battery ?? String(row.battery)} onChange={ev => setHealthEdits(p => ({...p,[row.id]:{...p[row.id],battery:ev.target.value}}))} className="w-14 h-7 text-xs px-2" /><span className="text-[10px] text-muted-foreground">%</span></div><MetricBar value={battery} color={battery >= 70 ? "bg-emerald-400" : "bg-red-400"} /></div> : <span className="text-xs text-muted-foreground">N/A</span>}
                  </TableCell>
                  <TableCell>
                    {row.storage_health !== null ? <div><div className="flex items-center gap-1"><Input type="number" min={0} max={100} value={e.storage_health ?? String(row.storage_health)} onChange={ev => setHealthEdits(p => ({...p,[row.id]:{...p[row.id],storage_health:ev.target.value}}))} className="w-14 h-7 text-xs px-2" /><span className="text-[10px] text-muted-foreground">%</span></div><MetricBar value={storage} color={storage >= 85 ? "bg-emerald-400" : "bg-amber-400"} /></div> : <span className="text-xs text-muted-foreground">N/A</span>}
                  </TableCell>
                  <TableCell>
                    {row.sensor_drift !== null ? <div><div className="flex items-center gap-1"><Input type="number" min={0} step={0.1} value={e.sensor_drift ?? String(row.sensor_drift)} onChange={ev => setHealthEdits(p => ({...p,[row.id]:{...p[row.id],sensor_drift:ev.target.value}}))} className="w-14 h-7 text-xs px-2" /><span className="text-[10px] text-muted-foreground">°</span></div><p className={cn("text-[10px] font-semibold", drift>2?"text-red-600":drift>1?"text-amber-600":"text-emerald-600")}>{drift<=1?"Nominal":drift<=2?"Monitor":"ALERT"}</p></div> : <span className="text-xs text-muted-foreground">N/A</span>}
                  </TableCell>
                  <TableCell><p className={cn("text-xs font-bold", uptime>=95?"text-emerald-700":uptime>=80?"text-amber-700":"text-red-700")}>{uptime}%</p><MetricBar value={uptime} color={uptime>=95?"bg-emerald-400":uptime>=80?"bg-amber-400":"bg-red-400"} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px]">{row.notes}</TableCell>
                  <TableCell><p className={cn("text-lg font-extrabold",score>=85?"text-emerald-700":score>=70?"text-amber-700":"text-red-700")}>{score}</p><p className="text-[10px] text-muted-foreground">/ 100</p></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function EditAssetDialog({ asset, onClose, onSave }: { asset: any; onClose: () => void; onSave: (updated: any) => void }) {
  const [form, setForm] = useState({
    name: asset?.name || "",
    serial: asset?.serial || "",
    manufacturer: asset?.manufacturer || "",
    category: asset?.category || "IT Equipment",
    funding: asset?.funding || "Internal Grants",
    procured: asset?.procured || "",
    warranty: asset?.warranty || "",
    location: asset?.location || "Manila",
    lab: asset?.lab || "CITe4D",
    condition: asset?.condition || 100,
    custodian: asset?.custodian || "",
    status: asset?.status || "Active"
  });

  const handleSave = () => {
    onSave({
      ...asset,
      ...form
    });
    onClose();
  };

  return (
    <Dialog open={!!asset} onOpenChange={open => { if(!open) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">Edit Registry Asset — {asset?.id}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Modify registry information to correct configuration errors or entry mistakes.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-3">
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label className="text-xs font-bold text-foreground">Asset Name</Label>
            <Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Serial Number</Label>
            <Input value={form.serial} onChange={e=>setForm({...form, serial:e.target.value})} className="text-xs font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Manufacturer</Label>
            <Input value={form.manufacturer} onChange={e=>setForm({...form, manufacturer:e.target.value})} className="text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Category</Label>
            <select value={form.category} onChange={e=>setForm({...form, category:e.target.value})}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {["IT Equipment", "Laboratory Equipment", "Chemical Apparatus", "Mechanical Testing Tools", "Computing Nodes", "Electronics & Kits"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Funding Origin</Label>
            <select value={form.funding} onChange={e=>setForm({...form, funding:e.target.value})}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {["DOST", "USAID", "CHED", "Internal Grants"].map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Procurement Date</Label>
            <Input type="date" value={form.procured} onChange={e=>setForm({...form, procured:e.target.value})} className="text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Warranty Expiration</Label>
            <Input type="date" value={form.warranty} onChange={e=>setForm({...form, warranty:e.target.value})} className="text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Campus Location</Label>
            <select value={form.location} onChange={e=>setForm({...form, location:e.target.value})}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="Manila">Manila</option>
              <option value="Laguna">Laguna</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Responsible Laboratory Group</Label>
            <select value={form.lab} onChange={e=>setForm({...form, lab:e.target.value})}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {["CITe4D", "CAR", "CeLT", "CeHCI", "Bio", "HXIL", "GAME", "CIVI", "COMET", "CNIS"].map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Asset Status</Label>
            <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {["Active", "On Loan", "Maintenance"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-foreground">Condition Score ({form.condition}%)</Label>
            <Input type="number" min={0} max={100} value={form.condition} onChange={e=>setForm({...form, condition:Math.max(0, Math.min(100, parseInt(e.target.value)||0))})} className="text-xs" />
          </div>
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label className="text-xs font-bold text-foreground">Current Custodian Assignment</Label>
            <Input value={form.custodian} onChange={e=>setForm({...form, custodian:e.target.value})} placeholder="None / Custodian Name" className="text-xs" />
          </div>
        </div>
        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">Save Modifications</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DisposalFormDialog({ asset, onClose, onDispose, role }: { asset: any; onClose: () => void; onDispose: (assetId: string, details: any, role: string) => void; role: string }) {
  const [form, setForm] = useState({
    lastCustodian: asset?.custodian || "",
    breakdownReasons: "",
    disposalPathway: "Decommission — Scrap / Recycle",
    decommissionDate: new Date().toISOString().split("T")[0]
  });
  const [successId, setSuccessId] = useState<string | null>(null);

  const handleSave = () => {
    const dispId = asset.id.replace("EQ", "DISP");
    onDispose(asset.id, {
      lastCustodian: form.lastCustodian || "Unassigned",
      breakdownReasons: form.breakdownReasons.trim() || "Decommissioned due to physical breakdown or end of servicing lifecycle.",
      disposalPathway: form.disposalPathway,
      decommissionDate: form.decommissionDate
    }, role);
    setSuccessId(dispId);
  };

  return (
    <Dialog open={!!asset} onOpenChange={open => { if(!open && !successId) onClose(); }}>
      <DialogContent className="max-w-md">
        {successId ? (
          <div className="flex flex-col items-center text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600">
              <Archive size={30} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Asset Successfully Decommissioned</h3>
              <p className="text-xs text-muted-foreground mt-1">Registry updated. Asset is now listed in the Decommissioned Archive.</p>
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
              <DialogDescription className="text-xs text-muted-foreground">Log physical breakdown reasons and specify the disposal pathway. This record is permanent for audit validation.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Asset ID / Name</Label>
                <Input value={`${asset.id} - ${asset.name}`} disabled className="bg-muted text-xs font-semibold" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Last Custodian Assignment</Label>
                <Input value={form.lastCustodian} onChange={e=>setForm({...form, lastCustodian:e.target.value})} placeholder="e.g. Dr. Juan Dela Cruz" className="text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Main Issues / Breakdown Justification</Label>
                <textarea value={form.breakdownReasons} onChange={e=>setForm({...form, breakdownReasons:e.target.value})} rows={3} placeholder="Describe diagnostic metrics, breakdown causes, physical damages, or reasons repair is not financially viable..." className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Disposal Pathway</Label>
                <select value={form.disposalPathway} onChange={e=>setForm({...form, disposalPathway:e.target.value})}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {["Decommission — Scrap / Recycle", "Decommission — Donate to Partner Institution", "Decommission — Warranty Return to Vendor", "Decommission — Institutional Auction", "Decommission — Secure Landfill"].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold text-foreground">Final Decommission Date</Label>
                <Input type="date" value={form.decommissionDate} onChange={e=>setForm({...form, decommissionDate:e.target.value})} className="text-xs h-9" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-9">Commit Decommission</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RepairProgressDialog({ ticket, onClose, onSave }: { ticket: any; onClose: () => void; onSave: (id: string, status: string) => void }) {
  const [status, setStatus] = useState(ticket?.statusLabel || "Inspection Phase");
  const isCompleted = ticket?.statusLabel === "Fixed & Completed";
  
  const handleSave = () => {
    onSave(ticket.id, status);
    onClose();
  };

  return (
    <Dialog open={!!ticket} onOpenChange={open => { if(!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">Manage Maintenance Ticket</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Review diagnostics details and update repair progress status.</DialogDescription>
        </DialogHeader>
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
              <select value={status} onChange={e=>setStatus(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="Inspection Phase">Inspection Phase (Ongoing Diagnostic checks)</option>
                <option value="Warranty Holder Possession">Warranty Holder's Possession (Under Warranty Service)</option>
                <option value="Third-Party Repairer Possession">Third-Party Repairer's Possession (Out-of-Warranty / Expired)</option>
                <option value="Fixed & Completed">Fixed &amp; Completed (Re-assign to Custodian)</option>
              </select>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          {!isCompleted && (
            <Button onClick={handleSave} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9">Update Progress</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
