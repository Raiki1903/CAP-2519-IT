import { useState, useMemo } from "react";
import { useApp } from "../context";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { AssetDetailModal } from "./AssetDetailModal";
import { cn } from "./ui/utils";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import {
  Shield, TrendingUp, BarChart3, PieChart,
  ClipboardList, Users, Wrench,
  Download, Package,
  Activity, Printer,
  Landmark, Eye, Search
} from "lucide-react";

const BRAND = "#005A36";
const BRAND_LIGHT = "#F0FDF4";

const statusBadgeClass: Record<string, string> = {
  "Active": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Loan": "bg-blue-50   text-blue-700   border-blue-200",
  "Maintenance": "bg-amber-50  text-amber-700  border-amber-200",
  "Reserved": "bg-violet-50 text-violet-700 border-violet-200",
  "Partially Deployed": "bg-orange-50 text-orange-700 border-orange-200",
  "Available": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Pending Return": "bg-amber-50  text-amber-700  border-amber-200",
  "Pending Transfer": "bg-amber-50  text-amber-700  border-amber-200",
  "Overdue": "bg-red-50    text-red-700    border-red-200",
};

const FUNDING_COLORS: Record<string, string> = {
  DOST: "bg-emerald-500",
  USAID: "bg-blue-500",
  CHED: "bg-violet-500",
  "Internal Grants": "bg-amber-500",
};

const LABS = ["CITe4D", "CAR", "CeLT", "CeHCI", "Bio", "HXIL", "GAME", "CIVI", "COMET", "CNIS"];

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  accent?: string;
  delta?: string;
  deltaPositive?: boolean;
}

function MetricCard({ title, value, subtitle, icon: Icon, accent = "text-foreground", delta, deltaPositive }: MetricCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-extrabold tracking-[2px] uppercase text-muted-foreground">{title}</p>
            <p className={cn("text-3xl font-extrabold leading-none", accent)}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {delta && (
              <p className={cn("text-[11px] font-semibold flex items-center gap-0.5 mt-1",
                deltaPositive ? "text-emerald-600" : "text-red-500")}>
                {deltaPositive ? "↑" : "↓"} {delta}
              </p>
            )}
          </div>
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", BRAND_LIGHT)}>
            <Icon size={22} style={{ color: BRAND }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground font-medium">{count} <span className="text-[10px]">({pct}%)</span></span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function AdRICDirectorDashboard({ activeTab }: { activeTab: string }) {
  const { assets, transfers, repairRequests, returns } = useApp();

  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);

  // ── Computed Metrics ──────────────────────────────────────────────────────
  const totalAssets = assets.length;
  const activeAssets = assets.filter(a => a.status === "Active").length;
  const onLoanAssets = assets.filter(a => a.status === "On Loan").length;
  const maintenanceAssets = assets.filter(a => a.status === "Maintenance").length;
  const pendingTransfers = transfers.filter(t => t.status === "Pending").length;
  const approvedTransfers = transfers.filter(t => t.status === "Approved").length;
  const openRepairs = repairRequests.filter(r => !r.acknowledged).length;
  const finalizedReturns = returns.filter(r => r.status === "Finalized").length;

  // Funding breakdown
  const fundingBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach(a => {
      counts[a.funding] = (counts[a.funding] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [assets]);

  // Lab breakdown
  const labBreakdown = useMemo(() => {
    return LABS.map(lab => ({
      lab,
      count: assets.filter(a => a.lab === lab).length
    })).filter(x => x.count > 0).sort((a, b) => b.count - a.count);
  }, [assets]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach(a => { counts[a.category] = (counts[a.category] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [assets]);

  // Health index
  const avgCondition = useMemo(() => {
    if (!assets.length) return 0;
    return Math.round(assets.reduce((s, a) => s + a.condition, 0) / assets.length);
  }, [assets]);

  // Filtered assets for Inventory tab
  const filteredAssets = useMemo(() => assets.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.id.toLowerCase().includes(search.toLowerCase()) ||
    a.lab.toLowerCase().includes(search.toLowerCase())
  ), [assets, search]);

  // ── Overview Tab ──────────────────────────────────────────────────────────
  if (activeTab === "overview") {
    return (
      <div className="space-y-7">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BRAND }}>
                <Landmark size={16} className="text-white" />
              </div>
              <span className="text-[10px] font-extrabold tracking-[2.5px] uppercase text-muted-foreground">
                AdRIC EXECUTIVE CONSOLE
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Strategic Overview
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Aggregate intelligence on DLSU AdRIC laboratory infrastructure and asset lifecycle.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Report Snapshot</p>
            <p className="text-xs font-semibold text-foreground mt-0.5">
              {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
            <Badge className="mt-1 bg-emerald-50 text-emerald-800 border-emerald-200 text-[9px] font-bold uppercase tracking-wider">
              Live Data · Synced
            </Badge>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard title="Total Assets" value={totalAssets} icon={Package} accent="text-foreground"
            subtitle="Across all DLSU hubs" delta="All campuses" deltaPositive={true} />
          <MetricCard title="Fleet Health Index" value={`${avgCondition}%`} icon={Activity}
            accent={avgCondition >= 85 ? "text-emerald-600" : "text-amber-600"}
            subtitle="Mean condition across inventory" />
          <MetricCard title="Pending Transfers" value={pendingTransfers} icon={Users}
            accent={pendingTransfers > 0 ? "text-amber-600" : "text-foreground"}
            subtitle="Awaiting Lab Head sign-off" />
          <MetricCard title="Open Repairs" value={openRepairs} icon={Wrench}
            accent={openRepairs > 0 ? "text-red-600" : "text-foreground"}
            subtitle="Tickets pending resolution" />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-emerald-50 border-emerald-100">
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-extrabold text-emerald-700">{activeAssets}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mt-0.5">Active Devices</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-extrabold text-blue-700">{onLoanAssets}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mt-0.5">On Loan</p>
            </CardContent>
          </Card>
          <Card className="bg-violet-50 border-violet-100">
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-extrabold text-violet-700">{approvedTransfers}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 mt-0.5">Transfers Approved</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-100">
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-extrabold text-amber-700">{finalizedReturns}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mt-0.5">Returns Finalized</p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Funding Breakdown */}
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <PieChart size={15} className="text-primary" /> Procurement Funding Sources
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              {fundingBreakdown.map(([source, count]) => (
                <MiniBar key={source} label={source} count={count} total={totalAssets}
                  color={FUNDING_COLORS[source] || "bg-gray-400"} />
              ))}
              <Separator />
              <p className="text-[10px] text-muted-foreground">
                Multi-funded portfolio across {fundingBreakdown.length} external and institutional sources.
              </p>
            </CardContent>
          </Card>

          {/* Lab Distribution */}
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BarChart3 size={15} className="text-primary" /> Lab Hub Allocations
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              {labBreakdown.slice(0, 6).map(({ lab, count }) => (
                <MiniBar key={lab} label={lab} count={count} total={totalAssets} color="bg-emerald-600" />
              ))}
              {labBreakdown.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No assets registered.</p>
              )}
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp size={15} className="text-primary" /> Hardware Category Mix
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              {categoryBreakdown.map(([cat, count]) => (
                <MiniBar key={cat} label={cat} count={count} total={totalAssets} color="bg-blue-600" />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent Transfer Activity (Read-Only) */}
        <Card>
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Users size={15} className="text-primary" /> Recent Custody Handshakes
            </CardTitle>
            <Badge className="text-[9px] uppercase font-bold bg-blue-50 text-blue-700 border-blue-200">
              Read-Only View
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {transfers.slice(0, 5).length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No custody transitions logged.</div>
            ) : (
              <div className="divide-y divide-border">
                {transfers.slice(0, 5).map(txn => (
                  <div key={txn.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold text-primary">{txn.id}</span>
                        <Badge className={cn("text-[8px] uppercase font-bold",
                          txn.status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            txn.status === "Declined" ? "bg-red-50 text-red-700 border-red-200" :
                              "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {txn.status}
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-foreground truncate">{txn.asset}</p>
                      <p className="text-[10px] text-muted-foreground">{txn.from} → {txn.to} · {txn.lab}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{txn.initiated}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      </div>
    );
  }

  // ── Inventory Tab (Read-Only + Generate Report) ───────────────────────────
  if (activeTab === "inventory") {
    // Stats for the report summary block
    const avgCond = assets.length
      ? Math.round(assets.reduce((s, a) => s + a.condition, 0) / assets.length)
      : 0;

    return (
      <div className="space-y-6">
        {/* Header row: title + actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Global Asset Inventory
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Read-only view of all registered laboratory equipment across DLSU AdRIC.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="gap-1.5 text-xs font-bold h-8 text-white"
              style={{ background: BRAND }}
              onClick={() => setShowReportModal(true)}
            >
              <Download size={13} /> Generate Executive Report
            </Button>
            <Badge className="text-[9px] uppercase font-bold bg-blue-50 text-blue-700 border-blue-200">
              <Eye size={9} className="mr-1" /> Read-Only Access
            </Badge>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search asset name, ID, or lab…" className="pl-9" />
        </div>

        <Card className="overflow-hidden border border-border bg-white rounded-xl">
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase whitespace-nowrap">Asset ID</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase">Equipment Name</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase whitespace-nowrap">Category</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase whitespace-nowrap">Funding</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase whitespace-nowrap">Lab · Campus</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase whitespace-nowrap">Custodian</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase whitespace-nowrap">Status</TableHead>
                  <TableHead className="font-extrabold text-[10px] tracking-wider uppercase whitespace-nowrap">Condition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map(asset => (
                  <TableRow key={asset.id} className="cursor-pointer hover:bg-muted/10"
                    onClick={() => setSelectedAsset(asset)}>
                    <TableCell className="font-bold text-primary text-xs whitespace-nowrap">{asset.id}</TableCell>
                    <TableCell>
                      <p className="font-semibold text-xs text-foreground min-w-[140px]">{asset.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{asset.serial}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{asset.category}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[9px] font-bold whitespace-nowrap",
                        asset.funding === "DOST" ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
                          asset.funding === "USAID" ? "border-blue-200 text-blue-700 bg-blue-50" :
                            asset.funding === "CHED" ? "border-violet-200 text-violet-700 bg-violet-50" :
                              "border-amber-200 text-amber-700 bg-amber-50"
                      )}>{asset.funding}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-foreground whitespace-nowrap">
                      <span className="font-semibold">{asset.lab}</span>
                      <span className="text-muted-foreground"> · {asset.location}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{asset.custodian || "Unassigned"}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[9px] uppercase font-bold whitespace-nowrap", statusBadgeClass[asset.status] || "bg-muted text-muted-foreground")}>
                        {asset.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-xs font-extrabold",
                          asset.condition >= 90 ? "text-emerald-700" :
                            asset.condition >= 60 ? "text-amber-600" : "text-red-600")}>
                          {asset.condition}%
                        </span>
                        <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full",
                            asset.condition >= 90 ? "bg-emerald-500" :
                              asset.condition >= 60 ? "bg-amber-500" : "bg-red-500")}
                            style={{ width: `${asset.condition}%` }} />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredAssets.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">No assets match your search query.</div>
          )}
        </Card>

        <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />

        {/* ── Executive Report Modal ─────────────────────────────────────── */}
        <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
          <DialogContent className="w-full max-w-[85vw] lg:max-w-7xl max-h-[90vh] overflow-y-auto print:max-h-none print:max-w-none print:p-0 print:border-none">

            <style dangerouslySetInnerHTML={{
              __html: `
              @media print {
                @page { size: landscape; margin: 15mm; }
                body { background: white; color: black; }
                #director-report { border: none !important; padding: 0 !important; width: 100% !important; max-width: none !important; }
              }
            `}} />

            <DialogHeader className="print:hidden">
              <DialogTitle className="text-sm font-bold text-foreground">Generate Executive Asset Report</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Preview the executive-level inventory report for DLSU AdRIC — all laboratories and campuses.
              </DialogDescription>
            </DialogHeader>

            {/* ── Report Document ── */}
            <div id="director-report" className="border rounded-xl p-6 bg-white text-black font-sans leading-relaxed space-y-6 w-full">

              {/* Report Header */}
              <div className="flex flex-row justify-between items-start gap-4 border-b-2 border-emerald-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-wide text-emerald-800 font-sans">DLSU AdRIC Research Laboratories</h2>
                  <p className="text-xs text-gray-500 mt-0.5 font-sans">De La Salle University · Animo Research and Innovation Center · All Hub Facilities</p>
                  <p className="text-[10px] text-gray-400 mt-1 font-sans">
                    Report ID: EXEC-ADRIC-{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, "0")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest font-sans">GLOBAL INVENTORY REPORT</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 font-sans">
                    Date Generated: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="text-[11px] text-gray-500 font-semibold font-sans">Generated By: AdRIC Director</p>
                </div>
              </div>

              {/* Summary Statistics */}
              <div className="grid grid-cols-4 gap-4 bg-emerald-50/50 p-4 border border-emerald-100 rounded-xl">
                {[
                  { label: "Total Assets Across All Labs", val: assets.length },
                  { label: "Pending Custody Transfers", val: transfers.filter(t => t.status === "Pending").length },
                  { label: "Open Maintenance Incidents", val: repairRequests.filter(r => !r.acknowledged).length },
                  { label: "Average Fleet Health Score", val: `${avgCond}%` },
                ].map(({ label, val }) => (
                  <div key={label} className="text-center p-2">
                    <p className="text-xl font-bold text-emerald-950 font-sans">{val}</p>
                    <p className="text-[10px] text-emerald-800/80 font-bold uppercase tracking-wider mt-0.5 font-sans leading-tight">{label}</p>
                  </div>
                ))}
              </div>

              {/* Section I — Global Asset Registry */}
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold text-emerald-900 border-b pb-1.5 mb-1 uppercase tracking-widest font-sans">
                  I. Global Asset Registry — All DLSU AdRIC Laboratories
                </h3>
                <div className="overflow-x-auto border rounded-lg w-full">
                  <Table className="min-w-full text-[11px]">
                    <TableHeader>
                      <TableRow className="bg-emerald-50/30">
                        {["Asset ID", "Equipment Name", "Serial Number", "Manufacturer", "Category", "Lab", "Campus", "Funding", "Condition", "Status", "Custodian"].map(h => (
                          <TableHead key={h} className="text-[10px] font-bold text-emerald-900 whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assets.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="font-bold text-emerald-800 whitespace-nowrap">{a.id}</TableCell>
                          <TableCell className="font-semibold min-w-[150px]">{a.name}</TableCell>
                          <TableCell className="font-mono whitespace-nowrap">{a.serial}</TableCell>
                          <TableCell className="whitespace-nowrap">{a.manufacturer}</TableCell>
                          <TableCell className="whitespace-nowrap">{a.category}</TableCell>
                          <TableCell className="font-semibold whitespace-nowrap">{a.lab}</TableCell>
                          <TableCell className="whitespace-nowrap">{a.location}</TableCell>
                          <TableCell className="whitespace-nowrap">{a.funding}</TableCell>
                          <TableCell className="font-bold whitespace-nowrap">{a.condition}%</TableCell>
                          <TableCell className="whitespace-nowrap">{a.status}</TableCell>
                          <TableCell className="font-medium text-emerald-950 whitespace-nowrap">{a.custodian || "Unassigned"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Section II — Cross-Lab Custody Transitions */}
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold text-emerald-900 border-b pb-1.5 mb-1 uppercase tracking-widest font-sans">
                  II. Cross-Laboratory Custody Transitions &amp; Transfer Trail
                </h3>
                <div className="overflow-x-auto border rounded-lg w-full">
                  <Table className="min-w-full text-[11px]">
                    <TableHeader>
                      <TableRow className="bg-emerald-50/30">
                        {["Transaction ID", "Asset Name", "Lab Hub", "From Custodian", "To Custodian", "Initiated Date", "Status"].map(h => (
                          <TableHead key={h} className="text-[10px] font-bold text-emerald-900 whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-gray-400 py-4 font-sans">No custody transfer operations on record.</TableCell>
                        </TableRow>
                      ) : (
                        transfers.map(t => (
                          <TableRow key={t.id}>
                            <TableCell className="font-bold text-emerald-800 whitespace-nowrap">{t.id}</TableCell>
                            <TableCell className="font-semibold min-w-[150px]">{t.asset}</TableCell>
                            <TableCell className="whitespace-nowrap">{t.lab}</TableCell>
                            <TableCell className="whitespace-nowrap">{t.from} ({t.fromRole})</TableCell>
                            <TableCell className="whitespace-nowrap">{t.to} ({t.toRole})</TableCell>
                            <TableCell className="whitespace-nowrap">{t.initiated}</TableCell>
                            <TableCell className="font-bold whitespace-nowrap">{t.status}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Section III — Maintenance & Incident Log */}
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold text-emerald-900 border-b pb-1.5 mb-1 uppercase tracking-widest font-sans">
                  III. Maintenance &amp; Incident Operations Log — All Laboratories
                </h3>
                <div className="overflow-x-auto border rounded-lg w-full">
                  <Table className="min-w-full text-[11px]">
                    <TableHeader>
                      <TableRow className="bg-emerald-50/30">
                        {["Ticket ID", "Asset ID", "Asset Name", "Issue Description", "Submitted At", "Priority", "Resolution State"].map(h => (
                          <TableHead key={h} className="text-[10px] font-bold text-emerald-900 whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repairRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-gray-400 py-4 font-sans">No maintenance incidents on record.</TableCell>
                        </TableRow>
                      ) : (
                        repairRequests.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-bold text-emerald-800 whitespace-nowrap">{r.id}</TableCell>
                            <TableCell className="font-mono whitespace-nowrap">{r.assetId}</TableCell>
                            <TableCell className="font-semibold min-w-[150px]">{r.assetName}</TableCell>
                            <TableCell className="italic max-w-[280px] truncate" title={r.description}>"{r.description}"</TableCell>
                            <TableCell className="whitespace-nowrap">{r.submittedAt}</TableCell>
                            <TableCell className="font-bold whitespace-nowrap">{r.priority}</TableCell>
                            <TableCell className="font-medium min-w-[140px]">{r.acknowledged ? "Resolved & Acknowledged" : "Pending Evaluation"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Compliance Footer */}
              <div className="flex flex-row justify-between items-end gap-6 border-t border-emerald-200 pt-6 mt-8">
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-sans">Director's Signature</p>
                  <div className="h-10 w-48 border-b border-gray-400 mt-2 flex items-center justify-center italic text-xs text-gray-500 font-sans">
                    Digital Signature Verified
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1 font-sans">AdRIC Director / Executive Officer</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest font-sans">Compliance Status</p>
                  <p className="text-xs font-bold text-emerald-700 mt-1 font-sans">✓ AdRIC Assets Compliant</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-sans">DLSU Engineering &amp; Research Standards</p>
                </div>
              </div>
            </div>

            <DialogFooter className="print:hidden gap-2">
              <Button variant="outline" onClick={() => setShowReportModal(false)}>Close</Button>
              <Button
                className="text-white font-bold gap-1.5"
                style={{ background: BRAND }}
                onClick={() => window.print()}
              >
                <Printer size={13} /> Print Executive Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return null;
}

