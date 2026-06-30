import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useApp } from "../context";
import type { Asset, TransferRequest, RepairRequest, ReturnRequest } from "../context";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { AssetImagePlaceholder } from "./AssetImagePlaceholder";
import { AssetDetailModal } from "./AssetDetailModal";
import { cn } from "./ui/utils";
import {
  Shield, Search, Plus, Pencil, Trash2, Monitor, ClipboardList,
  Users, Wrench, Tag, Activity, CheckCircle, XCircle, PlusCircle,
  Download, AlertTriangle, LayoutGrid, Table2, Package, MapPin,
  Calendar, Award
} from "lucide-react";

const BRAND = "#005A36";

const statusBadgeClass: Record<string, string> = {
  "Active":             "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Loan":            "bg-blue-50   text-blue-700   border-blue-200",
  "Maintenance":        "bg-amber-50  text-amber-700  border-amber-200",
  "Reserved":           "bg-violet-50 text-violet-700 border-violet-200",
  "Partially Deployed": "bg-orange-50 text-orange-700 border-orange-200",
  "Available":          "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Pending Return":     "bg-amber-50  text-amber-700  border-amber-200",
  "Pending Transfer":   "bg-amber-50  text-amber-700  border-amber-200",
  "Overdue":            "bg-red-50    text-red-700    border-red-200",
};

const LABS = ["CITe4D", "CAR", "CeLT", "CeHCI", "Bio", "HXIL", "GAME", "CIVI", "COMET", "CNIS"];
const CATEGORIES = ["Computing Array", "Robotic Node", "Mobile Infrastructure", "Sensor Array", "Networking", "Peripheral"];
const FUNDING_SOURCES = ["DOST", "USAID", "CHED", "Internal Grants"];

export function SystemAdminDashboard({ activeTab }: { activeTab: string }) {
  const navigate = useNavigate();
  const {
    role,
    assets,
    addAsset,
    removeAsset,
    updateAsset,
    transfers,
    updateTransferRequest,
    repairRequests,
    acknowledgeRepair,
    returns,
    finalizeReturn
  } = useApp();

  const isAdmin = role === "SystemAdmin";

  // Filter States
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterLab, setFilterLab] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [viewMode, setViewMode] = useState<"table" | "gallery">("table");

  // Selected asset for detail modal
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null);

  // Form States
  const [newAssetForm, setNewAssetForm] = useState({
    name: "",
    serial: "",
    manufacturer: "",
    category: "Computing Array",
    funding: "DOST",
    procured: new Date().toISOString().split("T")[0],
    warranty: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 3).toISOString().split("T")[0], // 3 years
    location: "Manila",
    lab: "CITe4D",
    status: "Available",
    condition: 100,
    custodian: ""
  });

  const [editAssetForm, setEditAssetForm] = useState<Asset | null>(null);

  // Audit Logs State (combined dynamic event stream)
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    // Generate a set of dynamic audit logs from active backend collections
    const logs: any[] = [];

    // Add logs for transfers
    transfers.forEach(t => {
      logs.push({
        id: `LOG-TR-${t.id}`,
        timestamp: t.initiated,
        type: "transfer",
        message: `Custodianship transition requested: ${t.asset} (ID: ${t.assetId}) from ${t.from} to ${t.to}. Status: ${t.status}`,
        user: t.from,
        icon: Users,
        color: t.status === "Approved" ? "text-emerald-600" : t.status === "Declined" ? "text-red-500" : "text-amber-500"
      });
    });

    // Add logs for repairs
    repairRequests.forEach(r => {
      logs.push({
        id: `LOG-RP-${r.id}`,
        timestamp: r.submittedAt ? r.submittedAt.split(",")[0] : "Jun 30, 2026",
        type: "repair",
        message: `Maintenance logged: ${r.assetName} (ID: ${r.assetId}) by ${r.custodian}. Status: ${r.acknowledged ? 'Acknowledged' : 'Pending'} (${r.priority} Priority)`,
        user: r.custodian,
        icon: Wrench,
        color: "text-amber-600"
      });
    });

    // Add logs for returns
    returns.forEach(ret => {
      logs.push({
        id: `LOG-RET-${ret.id}`,
        timestamp: ret.returnDate,
        type: "return",
        message: `Return ledger processed: ${ret.assetName} (ID: ${ret.assetId}) by ${ret.custodian}. Status: ${ret.status}`,
        user: ret.custodian,
        icon: ClipboardList,
        color: ret.status === "Finalized" ? "text-emerald-600" : "text-amber-500"
      });
    });

    // Add static system entries to fill out
    logs.push({
      id: "LOG-SYS-001",
      timestamp: "Jun 30, 2026",
      type: "system",
      message: "Database synchronization completed with Central IT Services.",
      user: "System Daemon",
      icon: Shield,
      color: "text-emerald-700"
    });
    logs.push({
      id: "LOG-SYS-002",
      timestamp: "Jun 29, 2026",
      type: "system",
      message: "Enterprise security policy v4.2 applied to node infrastructure.",
      user: "System Daemon",
      icon: Shield,
      color: "text-primary"
    });

    // Sort logs (mock timestamp sorts since timestamps are text, we order by type/id to keep consistent)
    logs.sort((a, b) => b.id.localeCompare(a.id));
    setAuditLogs(logs.slice(0, 10)); // Top 10
  }, [transfers, repairRequests, returns]);

  // Actions
  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetForm.name || !newAssetForm.serial || !newAssetForm.manufacturer) return;

    const generatedId = `EQ-2026-${Math.floor(100 + Math.random() * 900)}`;
    addAsset({
      id: generatedId,
      ...newAssetForm
    });

    // Reset Form & Close
    setNewAssetForm({
      name: "",
      serial: "",
      manufacturer: "",
      category: "Computing Array",
      funding: "DOST",
      procured: new Date().toISOString().split("T")[0],
      warranty: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 3).toISOString().split("T")[0],
      location: "Manila",
      lab: "CITe4D",
      status: "Available",
      condition: 100,
      custodian: ""
    });
    setIsAddOpen(false);
  };

  const handleEditAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAssetForm) return;
    updateAsset(editAssetForm);
    setIsEditOpen(false);
    setEditAssetForm(null);
  };

  const handleDeleteConfirm = () => {
    if (assetToDelete) {
      removeAsset(assetToDelete);
      setAssetToDelete(null);
      setIsDeleteConfirmOpen(false);
    }
  };

  // Filter logic for assets
  const filteredAssets = assets.filter(a => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase()) ||
      a.serial.toLowerCase().includes(search.toLowerCase()) ||
      (a.custodian && a.custodian.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = filterCategory === "All" || a.category === filterCategory;
    const matchesLab = filterLab === "All" || a.lab === filterLab;
    const matchesStatus = filterStatus === "All" || a.status === filterStatus;

    return matchesSearch && matchesCategory && matchesLab && matchesStatus;
  });

  // Render components based on activeTab

  // 1. Overview Tab
  if (activeTab === "overview") {
    const pendingTransfersCount = transfers.filter(t => t.status === "Pending").length;
    const activeMaintenanceCount = assets.filter(a => a.status === "Maintenance").length;
    const activeReturnsCount = returns.filter(r => r.status === "Pending").length;

    // Calculate lab stats
    const labCounts = LABS.map(l => ({
      name: l,
      count: assets.filter(a => a.lab === l).length
    })).sort((a, b) => b.count - a.count);

    // Calculate category stats
    const catCounts = CATEGORIES.map(c => ({
      name: c,
      count: assets.filter(a => a.category === c).length
    })).sort((a, b) => b.count - a.count);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-foreground font-extrabold mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Enterprise System Console
            </h1>
            <p className="text-muted-foreground text-sm">
              Global dashboard for DLSU Laboratory Infrastructure and equipment lifecycle monitoring.
            </p>
          </div>
          {isAdmin && (
            <Button
              className="gap-1.5 self-start text-white"
              style={{ background: BRAND }}
              onClick={() => setIsAddOpen(true)}
            >
              <PlusCircle size={15} /> Register Equipment
            </Button>
          )}
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-extrabold text-foreground">{assets.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Assets Registered</p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-700">
                  <ClipboardList size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-extrabold text-foreground">{pendingTransfersCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Active Custody Handshakes</p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50 text-blue-700">
                  <Users size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-extrabold text-foreground">{activeMaintenanceCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Devices Under Repair</p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600">
                  <Wrench size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-extrabold text-foreground">{activeReturnsCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Returns in Progress</p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-violet-50 text-violet-700">
                  <Monitor size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main system logs */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Activity size={16} className="text-primary" /> Live Audit Log
              </CardTitle>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800">
                Central Registry Sync: Operational
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {auditLogs.map((log) => {
                  const LogIcon = log.icon;
                  return (
                    <div key={log.id} className="p-4 flex gap-3 hover:bg-muted/15 transition-colors">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center bg-muted/40", log.color)}>
                        <LogIcon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground leading-relaxed font-semibold">
                          {log.message}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1.5 font-medium">
                          <span className="bg-muted px-1.5 py-0.5 rounded text-foreground font-semibold uppercase text-[8px] tracking-wider">{log.type}</span>
                          <span>Actor: {log.user}</span>
                          <span>•</span>
                          <span>{log.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Right Statistics panel */}
          <div className="space-y-6">
            {/* Lab-wise distributions */}
            <Card>
              <CardHeader className="pb-3 border-b border-border"><CardTitle className="text-sm font-bold text-foreground">Lab Allocations</CardTitle></CardHeader>
              <CardContent className="pt-4 space-y-3">
                {labCounts.slice(0, 5).map(lab => {
                  const percentage = assets.length ? Math.round((lab.count / assets.length) * 100) : 0;
                  return (
                    <div key={lab.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-foreground">{lab.name} Lab</span>
                        <span className="text-muted-foreground">{lab.count} units ({percentage}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Category Allocations */}
            <Card>
              <CardHeader className="pb-3 border-b border-border"><CardTitle className="text-sm font-bold text-foreground">Hardware Categories</CardTitle></CardHeader>
              <CardContent className="pt-4 space-y-3">
                {catCounts.slice(0, 5).map(cat => {
                  const percentage = assets.length ? Math.round((cat.count / assets.length) * 100) : 0;
                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-foreground truncate pr-2">{cat.name}</span>
                        <span className="text-muted-foreground flex-shrink-0">{cat.count} units</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Asset Registration Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Register Equipment</DialogTitle>
              <DialogDescription>Input new procured equipment information. This will sync globally.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddAsset} className="space-y-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-name">Asset Name</Label>
                <Input id="add-name" required placeholder="e.g. NVIDIA Jetson Orin Nano" value={newAssetForm.name} onChange={e => setNewAssetForm({ ...newAssetForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-mfr">Manufacturer</Label>
                  <Input id="add-mfr" required placeholder="NVIDIA" value={newAssetForm.manufacturer} onChange={e => setNewAssetForm({ ...newAssetForm, manufacturer: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-serial">Serial Number</Label>
                  <Input id="add-serial" required placeholder="SN-JON-892" value={newAssetForm.serial} onChange={e => setNewAssetForm({ ...newAssetForm, serial: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-cat">Category</Label>
                  <select id="add-cat" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newAssetForm.category} onChange={e => setNewAssetForm({ ...newAssetForm, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-funding">Funding Source</Label>
                  <select id="add-funding" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newAssetForm.funding} onChange={e => setNewAssetForm({ ...newAssetForm, funding: e.target.value })}>
                    {FUNDING_SOURCES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-loc">Campus Location</Label>
                  <select id="add-loc" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newAssetForm.location} onChange={e => setNewAssetForm({ ...newAssetForm, location: e.target.value })}>
                    <option value="Manila">Manila</option>
                    <option value="Laguna">Laguna</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-lab">Laboratory Hub</Label>
                  <select id="add-lab" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newAssetForm.lab} onChange={e => setNewAssetForm({ ...newAssetForm, lab: e.target.value })}>
                    {LABS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <DialogFooter className="pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" className="text-white" style={{ background: BRAND }}>Save Asset</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // 2. Global Inventory Tab
  if (activeTab === "inventory") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-foreground font-extrabold mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Global Asset Registry
            </h1>
            <p className="text-muted-foreground text-sm">
              Search, filter, edit, or register all hardware assets across Taft and Laguna lab systems.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex rounded-lg overflow-hidden border border-border">
              <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("table")} className="rounded-none text-xs gap-1.5"><Table2 size={13} />Table</Button>
              <Button variant={viewMode === "gallery" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("gallery")} className="rounded-none text-xs gap-1.5"><LayoutGrid size={13} />Grid</Button>
            </div>
            {isAdmin && (
              <Button
                className="gap-1.5 text-white text-xs font-bold"
                style={{ background: BRAND }}
                onClick={() => setIsAddOpen(true)}
              >
                <Plus size={14} /> Add Asset
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ID, name, serial..."
              className="pl-9"
            />
          </div>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterLab}
            onChange={e => setFilterLab(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="All">All Laboratory Hubs</option>
            {LABS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="All">All Statuses</option>
            {Object.keys(statusBadgeClass).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {filteredAssets.length === 0 ? (
          <Card className="text-center py-12 text-muted-foreground bg-white border border-border">
            No equipment registries found matching current filter parameters.
          </Card>
        ) : viewMode === "table" ? (
          <Card className="overflow-hidden border border-border bg-white rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Asset ID</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Equipment Name</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Category</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Lab / Campus</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Custodian</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Status</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Condition</TableHead>
                  {isAdmin && <TableHead className="w-[100px] text-right font-extrabold text-[10px] tracking-wider uppercase">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map(asset => (
                  <TableRow key={asset.id} className="cursor-pointer hover:bg-muted/10" onClick={() => setSelectedAsset(asset)}>
                    <TableCell className="font-bold text-primary text-xs">{asset.id}</TableCell>
                    <TableCell className="font-semibold text-xs text-foreground">
                      <div>{asset.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{asset.serial}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">{asset.category}</TableCell>
                    <TableCell className="text-xs text-foreground">
                      <div className="font-semibold">{asset.lab}</div>
                      <div className="text-[10px] text-muted-foreground">{asset.location}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">{asset.custodian || "Unassigned"}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[9px] uppercase font-bold", statusBadgeClass[asset.status] || "bg-muted text-muted-foreground")}>
                        {asset.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-xs font-extrabold", asset.condition >= 90 ? "text-emerald-700" : asset.condition >= 60 ? "text-amber-600" : "text-red-600")}>
                          {asset.condition}%
                        </span>
                        <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", asset.condition >= 90 ? "bg-emerald-500" : asset.condition >= 60 ? "bg-amber-500" : "bg-red-500")}
                            style={{ width: `${asset.condition}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200"
                            onClick={() => {
                              setEditAssetForm({ ...asset });
                              setIsEditOpen(true);
                            }}>
                            <Pencil size={12} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200"
                            onClick={() => {
                              setAssetToDelete(asset.id);
                              setIsDeleteConfirmOpen(true);
                            }}>
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredAssets.map(asset => (
              <Card key={asset.id} className="overflow-hidden border-t-4 p-0 gap-0 cursor-pointer hover:shadow-md transition-shadow flex flex-col border-t-primary"
                style={{ borderTopWidth: 4, borderLeftWidth: 0 }} onClick={() => setSelectedAsset(asset)}>
                <div className="w-full h-28 overflow-hidden flex-shrink-0 relative">
                  <AssetImagePlaceholder category={asset.category} aspectRatio="16/9" />
                  <Badge className={cn("absolute top-2 right-2 text-[9px] uppercase font-bold", statusBadgeClass[asset.status])}>{asset.status}</Badge>
                </div>
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-primary uppercase mb-1">{asset.id}</div>
                    <p className="text-xs font-bold text-foreground mb-1 line-clamp-1">{asset.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{asset.serial} · {asset.lab}</p>
                  </div>
                  <div className="flex justify-between items-center text-[10px] border-t pt-2 mt-3" onClick={e => e.stopPropagation()}>
                    <span className="text-muted-foreground">{asset.custodian || "Unassigned"}</span>
                    {isAdmin ? (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600" onClick={() => { setEditAssetForm({ ...asset }); setIsEditOpen(true); }}><Pencil size={10} /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600" onClick={() => { setAssetToDelete(asset.id); setIsDeleteConfirmOpen(true); }}><Trash2 size={10} /></Button>
                      </div>
                    ) : (
                      <span className="text-emerald-700 font-semibold">{asset.condition}% condition</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />

        {/* Add Asset Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Register Equipment</DialogTitle>
              <DialogDescription>Input new procured equipment information. This will sync globally.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddAsset} className="space-y-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-inv-name">Asset Name</Label>
                <Input id="add-inv-name" required placeholder="e.g. NVIDIA Jetson Orin Nano" value={newAssetForm.name} onChange={e => setNewAssetForm({ ...newAssetForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-inv-mfr">Manufacturer</Label>
                  <Input id="add-inv-mfr" required placeholder="NVIDIA" value={newAssetForm.manufacturer} onChange={e => setNewAssetForm({ ...newAssetForm, manufacturer: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-inv-serial">Serial Number</Label>
                  <Input id="add-inv-serial" required placeholder="SN-JON-892" value={newAssetForm.serial} onChange={e => setNewAssetForm({ ...newAssetForm, serial: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-inv-cat">Category</Label>
                  <select id="add-inv-cat" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newAssetForm.category} onChange={e => setNewAssetForm({ ...newAssetForm, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-inv-funding">Funding Source</Label>
                  <select id="add-inv-funding" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newAssetForm.funding} onChange={e => setNewAssetForm({ ...newAssetForm, funding: e.target.value })}>
                    {FUNDING_SOURCES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-inv-loc">Campus Location</Label>
                  <select id="add-inv-loc" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newAssetForm.location} onChange={e => setNewAssetForm({ ...newAssetForm, location: e.target.value })}>
                    <option value="Manila">Manila</option>
                    <option value="Laguna">Laguna</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-inv-lab">Laboratory Hub</Label>
                  <select id="add-inv-lab" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newAssetForm.lab} onChange={e => setNewAssetForm({ ...newAssetForm, lab: e.target.value })}>
                    {LABS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <DialogFooter className="pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" className="text-white" style={{ background: BRAND }}>Save Asset</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Asset Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Equipment Details</DialogTitle>
              <DialogDescription>Modify parameters for registered lab asset registry record.</DialogDescription>
            </DialogHeader>
            {editAssetForm && (
              <form onSubmit={handleEditAsset} className="space-y-4 pt-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-name">Asset Name</Label>
                  <Input id="edit-name" required value={editAssetForm.name} onChange={e => setEditAssetForm({ ...editAssetForm, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-mfr">Manufacturer</Label>
                    <Input id="edit-mfr" required value={editAssetForm.manufacturer} onChange={e => setEditAssetForm({ ...editAssetForm, manufacturer: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-serial">Serial Number</Label>
                    <Input id="edit-serial" required value={editAssetForm.serial} onChange={e => setEditAssetForm({ ...editAssetForm, serial: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-cat">Category</Label>
                    <select id="edit-cat" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={editAssetForm.category} onChange={e => setEditAssetForm({ ...editAssetForm, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-funding">Funding Source</Label>
                    <select id="edit-funding" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={editAssetForm.funding} onChange={e => setEditAssetForm({ ...editAssetForm, funding: e.target.value })}>
                      {FUNDING_SOURCES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-loc">Campus Location</Label>
                    <select id="edit-loc" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={editAssetForm.location} onChange={e => setEditAssetForm({ ...editAssetForm, location: e.target.value })}>
                      <option value="Manila">Manila</option>
                      <option value="Laguna">Laguna</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-lab">Laboratory Hub</Label>
                    <select id="edit-lab" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={editAssetForm.lab} onChange={e => setEditAssetForm({ ...editAssetForm, lab: e.target.value })}>
                      {LABS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-status">Status</Label>
                    <select id="edit-status" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={editAssetForm.status} onChange={e => setEditAssetForm({ ...editAssetForm, status: e.target.value })}>
                      {Object.keys(statusBadgeClass).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-custodian">Custodian</Label>
                    <Input id="edit-custodian" value={editAssetForm.custodian || ""} onChange={e => setEditAssetForm({ ...editAssetForm, custodian: e.target.value })} placeholder="e.g. Dr. Santos" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-cond">Condition Index ({editAssetForm.condition}%)</Label>
                  <input id="edit-cond" type="range" min="10" max="100" className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                    value={editAssetForm.condition} onChange={e => setEditAssetForm({ ...editAssetForm, condition: parseInt(e.target.value) })} />
                </div>
                <DialogFooter className="pt-4 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                  <Button type="submit" className="text-white" style={{ background: BRAND }}>Update Asset</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle size={18} /> Delete Equipment Record</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete asset record <strong className="text-foreground">{assetToDelete}</strong>? This action cannot be undone and will update central databases.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>Delete Record</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // 3. Custody Handoffs Tab
  if (activeTab === "transfers") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-foreground font-extrabold mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Custody Handshake Controls
          </h1>
          <p className="text-muted-foreground text-sm">
            Monitor and resolve equipment custody handoffs between DLSU researchers.
          </p>
        </div>

        <Card className="overflow-hidden border border-border bg-white rounded-xl">
          {transfers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No active handoff requests logged.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Reference ID</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Asset Name</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">From (Origin)</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">To (Recipient)</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Destination Hub</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Date Logged</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Status</TableHead>
                  {isAdmin && <TableHead className="text-right font-extrabold text-[10px] tracking-wider uppercase">Override Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map(txn => {
                  const isPending = txn.status === "Pending";
                  return (
                    <TableRow key={txn.id}>
                      <TableCell className="font-bold text-primary text-xs">{txn.id}</TableCell>
                      <TableCell className="font-semibold text-xs text-foreground">
                        <div>{txn.asset}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{txn.assetId}</div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        <div className="font-medium">{txn.from}</div>
                        <div className="text-[10px] text-muted-foreground">{txn.fromRole}</div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        <div className="font-medium">{txn.to}</div>
                        <div className="text-[10px] text-muted-foreground">{txn.toRole}</div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground font-medium">{txn.lab}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">{txn.initiated}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-[9px] uppercase font-bold",
                          txn.status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          txn.status === "Declined" ? "bg-red-50 text-red-700 border-red-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {txn.status}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => updateTransferRequest(txn.id, "Approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => updateTransferRequest(txn.id, "Declined")}
                              >
                                Decline
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-semibold">Resolved</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    );
  }

  // 4. Maintenance Log Tab
  if (activeTab === "maintenance") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-foreground font-extrabold mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Maintenance &amp; Incident Log
          </h1>
          <p className="text-muted-foreground text-sm">
            View queued hardware faults and override/resolve equipment failures.
          </p>
        </div>

        <Card className="overflow-hidden border border-border bg-white rounded-xl">
          {repairRequests.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No equipment faults or incidents currently reported.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Request ID</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Asset Name</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Reporter (Custodian)</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Incident / Fault Type</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Priority</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Date Logged</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Status</TableHead>
                  {isAdmin && <TableHead className="text-right font-extrabold text-[10px] tracking-wider uppercase">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {repairRequests.map(req => {
                  const asset = assets.find(a => a.id === req.assetId);
                  const isAwaitingResolution = asset && asset.status === "Maintenance";
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-bold text-primary text-xs">{req.id}</TableCell>
                      <TableCell className="font-semibold text-xs text-foreground">
                        <div>{req.assetName}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{req.assetId}</div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground font-medium">{req.custodian}</TableCell>
                      <TableCell className="text-xs text-foreground font-medium">
                        <div>{req.statusLabel}</div>
                        <div className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">{req.description}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-[9px] uppercase font-bold",
                          req.priority === "Critical" ? "bg-red-50 text-red-700 border-red-200" :
                          req.priority === "High" ? "bg-orange-50 text-orange-700 border-orange-200" :
                          "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          {req.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">{req.submittedAt ? req.submittedAt.split(",")[0] : "Jun 30, 2026"}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-[9px] uppercase font-bold",
                          req.acknowledged ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {req.acknowledged ? "Resolved / Completed" : "Awaiting Triage"}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {!req.acknowledged ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => {
                                  // Mark repair ticket as acknowledged
                                  acknowledgeRepair(req.id);
                                  // Restore asset status to Active
                                  if (asset) {
                                    updateAsset({
                                      ...asset,
                                      status: asset.custodian ? "On Loan" : "Available"
                                    });
                                  }
                                }}
                              >
                                Mark Complete
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-emerald-700 font-bold flex items-center justify-end gap-1"><CheckCircle size={10} /> Complete</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    );
  }

  // 5. Return Registry Tab
  if (activeTab === "returns") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-foreground font-extrabold mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Equipment Return Registry
          </h1>
          <p className="text-muted-foreground text-sm">
            Process returns and clear research personnel liability records.
          </p>
        </div>

        <Card className="overflow-hidden border border-border bg-white rounded-xl">
          {returns.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No equipment returns currently logged.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Reference ID</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Asset Name</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Custodian</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Logged Date</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Condition</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Clearance Cert</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Status</TableHead>
                  {isAdmin && <TableHead className="text-right font-extrabold text-[10px] tracking-wider uppercase">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map(ret => {
                  const isPending = ret.status === "Pending";
                  return (
                    <TableRow key={ret.id}>
                      <TableCell className="font-bold text-primary text-xs">{ret.id}</TableCell>
                      <TableCell className="font-semibold text-xs text-foreground">
                        <div>{ret.assetName}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{ret.assetId}</div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground font-medium">{ret.custodian}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">{ret.returnDate}</TableCell>
                      <TableCell className="text-xs text-foreground font-semibold">{ret.condition || "Not checked"}</TableCell>
                      <TableCell className="text-xs font-mono font-bold text-primary">{ret.certId || "N/A"}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-[9px] uppercase font-bold",
                          ret.status === "Finalized" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {ret.status}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="h-7 text-xs text-white"
                                style={{ background: BRAND }}
                                onClick={() => {
                                  finalizeReturn(
                                    ret.id,
                                    ret.assetId,
                                    "Pristine", // default condition for override
                                    ["Physical integrity verified", "All peripherals accounted for"], // checklist
                                    "System Administrator global override bypass.", // notes
                                    true // issue clearance certificate
                                  );
                                }}
                              >
                                Finalize Return
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-emerald-700 font-bold flex items-center justify-end gap-1"><Award size={10} /> Cleared</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    );
  }

  return null;
}
