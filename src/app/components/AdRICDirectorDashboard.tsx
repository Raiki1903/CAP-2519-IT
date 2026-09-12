import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import DirectorAnalyticsView from "./DirectorAnalyticsView";
import { useApp, type Asset, type RepairRequest, type InspectionReport, type PendingDisposal, type AffiliateClearance } from "../context";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { cn } from "./ui/utils";
import {
  Monitor, BarChart3, ClipboardCheck, ClipboardList, TrendingUp, AlertTriangle,
  MapPin, CheckCircle2, XCircle, Search, Download, Printer, User, Wrench, Calendar, Tag, ShieldAlert
} from "lucide-react";

interface AdRICDirectorDashboardProps {
  activeTab: "overview" | "analytics" | "clearance-disposal" | "reports";
}

const ALL_10_LABS = [
  { id: "CITe4D", name: "CITe4D - Manila", location: "Manila" },
  { id: "CAR", name: "CAR - Laguna", location: "Laguna" },
  { id: "CeHCI", name: "CeHCI - Manila", location: "Manila" },
  { id: "CeLT", name: "CeLT - Laguna", location: "Laguna" },
  { id: "CNIS", name: "CNIS - Manila", location: "Manila" },
  { id: "GAME", name: "GAME - Manila", location: "Manila" },
  { id: "Bio", name: "Bio - Manila", location: "Manila" },
  { id: "CIVI", name: "CIVI - Laguna", location: "Laguna" },
  { id: "TE3D", name: "TE3D - Laguna", location: "Laguna" },
  { id: "HXIL", name: "HXIL - Laguna", location: "Laguna" }
];

const CONDITION_SCORE_MAP: Record<string, number> = {
  "Perfect (Brand New / 100%)": 100,
  "Operational (Standard Wear / 90%)": 90,
  "Minor Drift (Functional / 78%)": 78,
  "Degraded Performance (Needs Service / 60%)": 60,
  "Critical Defect (Non-Functional / 35%)": 35,
  "PERFECT": 100,
  "BRAND_NEW": 100,
  "Brand New": 100,
  "OPERATIONAL": 90,
  "Operational": 90,
  "MINOR_DRIFT": 78,
  "Functional": 78,
  "DEGRADED": 60,
  "DEGRADED_PERFORMANCE": 60,
  "Degraded": 60,
  "CRITICAL_DEFECT": 35,
  "CRITICAL": 35,
  "Critical": 35
};

export function getLatestRecordConditionScore(asset: any): number {
  if (asset.condition !== undefined && typeof asset.condition === "number" && asset.condition > 0 && asset.condition !== 100) {
    return asset.condition;
  }
  const condStr = String(asset.assetCondition || asset.asset_condition || asset.descriptiveCondition || asset.condition || "");
  if (!condStr || condStr === "undefined") return 100; // Default if ZERO entries in asset_records
  if (CONDITION_SCORE_MAP[condStr] !== undefined) {
    return CONDITION_SCORE_MAP[condStr];
  }
  if (condStr.includes("35") || condStr.includes("CRITICAL")) return 35;
  if (condStr.includes("60") || condStr.includes("DEGRADED")) return 60;
  if (condStr.includes("78") || condStr.includes("MINOR")) return 78;
  if (condStr.includes("90") || condStr.includes("OPERATIONAL")) return 90;
  if (condStr.includes("100") || condStr.includes("PERFECT") || condStr.includes("BRAND")) return 100;

  return 100; // Default if unlogged/no entry
}

export function AdRICDirectorDashboard({ activeTab }: AdRICDirectorDashboardProps) {
  const navigate = useNavigate();
  const {
    assets,
    transfers = [],
    repairRequests = [],
    inspections = [],
    currentUser,
    manualClearanceHolds,
    toggleClearanceHold,
    isDbLoading: isGlobalDbLoading,
    syncFromDb
  } = useApp();

  const [dbAssets, setDbAssets] = useState<any[]>([]);
  const [loadingDbAssets, setLoadingDbAssets] = useState(false);
  const [dbDisposals, setDbDisposals] = useState<any[]>([]);
  const [loadingDbDisposals, setLoadingDbDisposals] = useState(false);
  const [dbDisposalsError, setDbDisposalsError] = useState<string | null>(null);
  const [disposalActionId, setDisposalActionId] = useState<number | null>(null);

  const isDashboardLoading = isGlobalDbLoading || loadingDbAssets;

  const exportLifecycleCSV = (asset: any) => {
    if (!asset) return;

    const assetTransfers = (asset.asset_transfers && asset.asset_transfers.length > 0)
      ? asset.asset_transfers
      : (transfers || []).filter(t => t.assetId === asset.id);

    const assetRepairs = (repairRequests || []).filter(r => r.assetId === asset.id);

    const assetReports = (asset.asset_reports && asset.asset_reports.length > 0)
      ? asset.asset_reports
      : (inspections || []).filter(i => i.assetId === asset.id);

    let csvContent = `Asset Lifecycle Audit Trail Report\n`;
    csvContent += `Generated On,"${new Date().toLocaleString()}"\n\n`;

    csvContent += `CORE METADATA\n`;
    csvContent += `Asset ID,"${asset.id}"\n`;
    csvContent += `Asset Name,"${(asset.name || "").replace(/"/g, '""')}"\n`;
    csvContent += `Serial Number,"${asset.serial || asset.serial_number || ""}"\n`;
    csvContent += `Manufacturer,"${(asset.manufacturer || "").replace(/"/g, '""')}"\n`;
    csvContent += `Funding Source,"${(asset.asset_monetary?.funding_source || asset.funding || "").replace(/"/g, '""')}"\n`;
    csvContent += `Acquisition Date,"${asset.procurement_date || asset.procured || ""}"\n`;
    csvContent += `Purchase Valuation,"PHP ${(asset.asset_monetary?.acquisition_value || asset.cost || 0).toLocaleString()}"\n`;
    csvContent += `ITS Property Tag,"${asset.itsPropertyTag || `DLSU-ITS-${asset.id}`}"\n`;
    csvContent += `TSG Property Tag,"${asset.tsgPropertyTag || `DLSU-TSG-${asset.id}`}"\n`;
    csvContent += `Current Status,"${asset.status || ""}"\n\n`;

    csvContent += `CUSTODIANSHIP & TRANSFER HISTORY\n`;
    csvContent += `Transfer ID,Requested On,From Custodian,To Custodian,Justification,Status\n`;

    if (assetTransfers.length > 0) {
      assetTransfers.forEach((t: any) => {
        csvContent += `"${t.transfer_id || t.id || ""}","${t.requested_on || t.initiated || ""}","${(t.from || `Custodian ID #${t.from_custodian_id}`).replace(/"/g, '""')}","${(t.to || `Custodian ID #${t.to_custodian_id}`).replace(/"/g, '""')}","${(t.justification || "").replace(/"/g, '""')}","${t.status || ""}"\n`;
      });
    } else {
      csvContent += `No custody transfer history registered.\n`;
    }

    csvContent += `\nREPAIR & MAINTENANCE LOGS\n`;
    csvContent += `Repair ID,Priority,Status,Description,Custodian,Submitted At\n`;
    if (assetRepairs.length > 0) {
      assetRepairs.forEach((r: any) => {
        csvContent += `"${r.id}","${r.priority}","${r.statusLabel}","${(r.description || "").replace(/"/g, '""')}","${r.custodian}","${r.submittedAt}"\n`;
      });
    } else {
      csvContent += `No technical repair logs registered.\n`;
    }

    csvContent += `\nROUTINE INSPECTION REPORTS\n`;
    csvContent += `Report ID,Inspector,Date Logged,Condition / Status,Remarks\n`;
    if (assetReports.length > 0) {
      assetReports.forEach((rpt: any) => {
        csvContent += `"${rpt.reportId || rpt.id || ""}","${(rpt.reportedBy || rpt.inspector || "TSG Technical Staff").replace(/"/g, '""')}","${rpt.reportDate || rpt.date_logged || rpt.date || "N/A"}","${rpt.condition || rpt.status || "VERIFIED"}","${(rpt.remarks || rpt.description || rpt.notes || "").replace(/"/g, '""')}"\n`;
      });
    } else {
      csvContent += `No physical routine inspections logged.\n`;
    }

    if (asset.status === "Disposed" && asset.disposalDetails) {
      csvContent += `\nDECOMMISSIONING & DISPOSAL DETAILS\n`;
      csvContent += `Disposal ID,${asset.disposalId}\n`;
      csvContent += `Decommission Date,${asset.disposalDetails.decommissionDate}\n`;
      csvContent += `Decommissioned By,"${asset.disposalDetails.decommissionedBy}"\n`;
      csvContent += `Disposal Pathway,"${asset.disposalDetails.disposalPathway}"\n`;
      csvContent += `Breakdown Reasons,"${asset.disposalDetails.breakdownReasons}"\n`;
    }

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Asset_Lifecycle_${asset.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchDbAssets = async () => {
    setLoadingDbAssets(true);
    try {
      const res = await fetch("http://localhost:4000/api/assets");
      const data = await res.json();
      if (data.success && Array.isArray(data.assets)) {
        setDbAssets(data.assets);
      }
    } catch (err) {
      console.error("❌ Failed to fetch database assets in Director Dashboard:", err);
    } finally {
      setLoadingDbAssets(false);
    }
  };

  const fetchDbDisposals = async () => {
    setLoadingDbDisposals(true);
    setDbDisposalsError(null);
    try {
      const res = await fetch("http://localhost:4000/api/asset_disposals");
      const data = await res.json();
      if (data.success) {
        setDbDisposals(data.disposals);
      } else {
        throw new Error(data.error || "Failed to fetch disposals from server");
      }
    } catch (err: any) {
      console.error("❌ Failed to fetch database disposals:", err);
      setDbDisposalsError(err.message || "Could not load disposal requests from DB.");
    } finally {
      setLoadingDbDisposals(false);
    }
  };

  useEffect(() => {
    fetchDbAssets();
    fetchDbDisposals();
    syncFromDb();
  }, []);

  useEffect(() => {
    fetchDbAssets();
    fetchDbDisposals();
    syncFromDb();
  }, [activeTab]);

  const decideDisposal = async (disposalId: number, decision: "approve" | "reject") => {
    setDisposalActionId(disposalId);
    try {
      const res = await fetch(`http://localhost:4000/api/asset_disposals/${disposalId}/decision`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!data.success) {
        setDbDisposalsError(data.error || `Failed to ${decision} disposal.`);
        return;
      }
      await fetchDbDisposals();
    } catch (err: any) {
      setDbDisposalsError(err.message || `Failed to ${decision} disposal.`);
    } finally {
      setDisposalActionId(null);
    }
  };

  // pendingDisposals now sourced from the database, mapped onto the shape
  // the render below already expects.
  const pendingDisposals = dbDisposals
    .filter(d => d.status === "Pending")
    .map(d => ({
      id: d.id,
      _disposalId: d.disposalId,
      assetId: d.assetId,
      assetName: d.assetName,
      requestedBy: d.requestedBy,
      requestedAt: d.requestedAt,
      reason: d.reason,
    }));

  const [searchQuery, setSearchQuery] = useState("");
  const [fundingFilter, setFundingFilter] = useState("ALL");
  const [dateFilterStart, setDateFilterStart] = useState("");
  const [dateFilterEnd, setDateFilterEnd] = useState("");
  const [selectedAssetForAudit, setSelectedAssetForAudit] = useState<Asset | null>(null);

  // Custom states for interactive features
  const [selectedHoldAffiliate, setSelectedHoldAffiliate] = useState<any | null>(null);
  const [overrideNotes, setOverrideNotes] = useState("");

  // Calculated properties using live dbAssets fetched from MySQL API
  const activeAssetList = dbAssets.length > 0 ? dbAssets : assets;
  const activeAssets = activeAssetList.filter(a => a.status !== "Disposed");
  const degradingAssets = activeAssets.filter(a => getLatestRecordConditionScore(a) <= 60);
  const maintenanceCount = activeAssets.filter(a => a.status === "Maintenance" || a.status === "In Repair").length;

  const totalValuation = activeAssetList.reduce((sum, a) => {
    const val = Number(a.asset_monetary?.acquisition_value || a.cost || a.acquisition_value || a.acquisitionValue || 0);
    return sum + val;
  }, 0);

  // 1. Overview Tab render
  const renderOverview = () => {
    const manilaAssets = activeAssets.filter(a => {
      const loc = (a.location || "").toLowerCase();
      const lab = (a.lab || "").toLowerCase();
      const tag = (a.asset_tag || a.id || "");
      return loc.includes("manila") || loc.includes("taft") || ["cite4d", "cehci", "cnis", "game", "bio"].includes(lab) || ["CITe4D-", "CeHCI-", "CNIS-", "GAME-", "Bio-"].some(p => tag.startsWith(p));
    }).length;

    const lagunaAssets = activeAssets.filter(a => {
      const loc = (a.location || "").toLowerCase();
      const lab = (a.lab || "").toLowerCase();
      const tag = (a.asset_tag || a.id || "");
      return loc.includes("laguna") || loc.includes("canlubang") || ["car", "celt", "civi", "te3d", "hxil"].includes(lab) || ["CAR-", "CeLT-", "CIVI-", "TE3D-", "HXIL-"].some(p => tag.startsWith(p));
    }).length;

    const totalCampusCount = activeAssets.length || 1;
    const manilaPercent = activeAssets.length ? Math.round((manilaAssets / totalCampusCount) * 100) : 0;
    const lagunaPercent = activeAssets.length ? Math.round((lagunaAssets / totalCampusCount) * 100) : 0;

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Registry Valuation</p>
                {isDashboardLoading ? (
                  <div className="h-7 w-32 bg-muted/60 animate-pulse rounded-md mt-1" />
                ) : (
                  <h3 className="text-2xl font-extrabold mt-1 text-foreground font-mono">
                    {`PHP ${totalValuation.toLocaleString()}`}
                  </h3>
                )}
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={20} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Active Inventory</p>
                {isDashboardLoading ? (
                  <div className="h-7 w-28 bg-muted/60 animate-pulse rounded-md mt-1" />
                ) : (
                  <h3 className="text-2xl font-extrabold mt-1 text-foreground font-mono">
                    {activeAssetList.filter(a => a.status !== "Disposed" && a.status !== "DISPOSED").length || activeAssetList.length} Equipment
                  </h3>
                )}
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Monitor size={20} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Maintenance &amp; Degrading</p>
                {isDashboardLoading ? (
                  <div className="h-7 w-44 bg-muted/60 animate-pulse rounded-md mt-1" />
                ) : (
                  <h3 className="text-lg font-extrabold mt-1 text-foreground font-mono leading-tight">
                    {maintenanceCount} in Maintenance · {degradingAssets.length} Degraded
                  </h3>
                )}
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle size={20} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Pending Approvals</p>
                <h3 className="text-2xl font-extrabold mt-1 text-foreground font-mono">
                  {pendingDisposals.length} Disposals
                </h3>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-100 dark:border-red-500/20 text-red-650 dark:text-red-400">
                <ShieldAlert size={20} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resource Distribution Map & Health Index */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visual Resource Mapping */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Campus Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <MapPin className="text-[#005A36] size-4" />
                  <span>Manila Campus</span>
                </div>
                <span className="font-bold text-foreground font-mono">{manilaAssets} ({manilaPercent}%)</span>
              </div>
              <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                <div className="bg-[#005A36] h-full transition-all duration-500" style={{ width: `${manilaPercent}%` }} />
              </div>

              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <MapPin className="text-[#10B981] size-4" />
                  <span>Laguna Campus</span>
                </div>
                <span className="font-bold text-foreground font-mono">{lagunaAssets} ({lagunaPercent}%)</span>
              </div>
              <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                <div className="bg-[#10B981] h-full transition-all duration-500" style={{ width: `${lagunaPercent}%` }} />
              </div>

              <Separator />
              <div className="p-4 bg-muted/40 border border-border rounded-xl">
                <p className="text-[10px] font-bold text-primary tracking-wider uppercase">Administrative Oversight</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Active balance is maintained to allow research equipment resource sharing between locations, overseen by the AdRIC Director office.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 10 Specialized Laboratories Health & Utilization */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Specialized Laboratories Status Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase">Laboratory ID</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase">Campus</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Assets</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Health Index</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Utilization</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ALL_10_LABS.map(lab => {
                      const labAssets = activeAssets.filter(a => {
                        const tag = (a.asset_tag || a.id || "");
                        return a.lab === lab.id || tag.startsWith(lab.id + "-");
                      });
                      const assetCount = labAssets.length;
                      let avgConditionStr = "0%";
                      let utilRateStr = "0%";
                      let avgConditionNum = 100;

                      if (assetCount > 0) {
                        const totalScore = labAssets.reduce((s, a) => s + getLatestRecordConditionScore(a), 0);
                        avgConditionNum = Math.round(totalScore / assetCount);
                        avgConditionStr = `${avgConditionNum}%`;

                        const utilized = labAssets.filter(a => a.status === "On Loan" || a.status === "Overdue" || a.status === "Pending Return" || a.projectId || a.project_id).length;
                        utilRateStr = `${Math.round((utilized / assetCount) * 100)}%`;
                      } else {
                        avgConditionStr = "N/A";
                        utilRateStr = "0%";
                      }

                      let statusBadge = <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-250 text-[9px] font-bold uppercase">Safe</Badge>;
                      if (assetCount === 0) {
                        statusBadge = <Badge variant="outline" className="text-muted-foreground text-[9px] font-bold uppercase">Unassigned</Badge>;
                      } else if (avgConditionNum <= 60) {
                        statusBadge = <Badge className="bg-red-50 text-red-700 border border-red-255 text-[9px] font-bold uppercase">Critical Watch</Badge>;
                      } else if (avgConditionNum <= 78) {
                        statusBadge = <Badge className="bg-amber-50 text-amber-700 border border-amber-250 text-[9px] font-bold uppercase">Attention</Badge>;
                      }

                      return (
                        <TableRow key={lab.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-bold text-foreground text-xs">{lab.id}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{lab.location}</TableCell>
                          <TableCell className="text-center font-semibold text-xs text-foreground font-mono">{assetCount}</TableCell>
                          <TableCell className="text-center text-xs font-mono">
                            <span className={cn(assetCount === 0 ? "text-muted-foreground" : avgConditionNum <= 60 ? "text-red-600 font-bold" : avgConditionNum <= 78 ? "text-amber-600" : "text-[#005A36] font-semibold")}>
                              {avgConditionStr}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-xs font-mono text-muted-foreground">{utilRateStr}</TableCell>
                          <TableCell className="text-right">{statusBadge}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderAnalytics = () => {
    return <DirectorAnalyticsView />;
  };

  // 3. Regulated Disposal Approvals Queue render
  const renderClearanceDisposal = () => {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Regulated Disposal Approvals */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Regulated Disposal Approvals Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Assets scheduled for decommissioning by ITS/TSG cannot be purged without the Director's authorized sign-off.
            </p>

            {loadingDbDisposals && pendingDisposals.length === 0 && (
              <p className="text-xs text-muted-foreground">Loading disposal requests…</p>
            )}
            {dbDisposalsError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{dbDisposalsError}</div>
            )}

            <div className="space-y-3.5">
              {pendingDisposals.map(req => {
                const isActing = disposalActionId === req._disposalId;
                return (
                  <Card key={req.id} className="border-l-4 border-l-amber-500 overflow-hidden shadow-sm" style={{ borderLeftWidth: 4 }}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{req.assetId} - {req.assetName}</h4>
                          <p className="text-[10px] text-muted-foreground mt-1">Proposed by: {req.requestedBy} · {new Date(req.requestedAt).toLocaleDateString()}</p>
                        </div>
                        <Badge className="bg-amber-50 border border-amber-200 text-amber-700 text-[9px] uppercase font-bold">
                          Pending Sign-off
                        </Badge>
                      </div>

                      <div className="p-3 bg-muted/40 border border-border rounded-lg text-[10px] text-muted-foreground font-mono leading-relaxed whitespace-pre-line">
                        {req.reason}
                      </div>

                      <div className="flex gap-2 justify-end pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isActing}
                          className="border-red-200 text-red-650 hover:bg-red-50 text-[10px] font-bold h-8"
                          onClick={() => decideDisposal(req._disposalId, "reject")}
                        >
                          {isActing ? "Working…" : "Reject & Recirculate"}
                        </Button>
                        <Button
                          size="sm"
                          disabled={isActing}
                          className="bg-[#005A36] hover:bg-[#004225] text-white text-[10px] font-bold h-8 border-none"
                          onClick={() => decideDisposal(req._disposalId, "approve")}
                        >
                          {isActing ? "Working…" : "Authorize Disposal"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {!loadingDbDisposals && pendingDisposals.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground text-xs bg-muted/10">
                  <CheckCircle2 className="text-[#005A36]/40 mb-2.5 size-9" />
                  <p className="font-semibold text-foreground">Approvals Queue Empty</p>
                  <p className="text-[10px] text-muted-foreground mt-1">No assets require decommissioning sign-off.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // 4. Custom Report Generator (Audit Readiness) render
  const renderReports = () => {
    const assetSourceList = dbAssets.length > 0 ? dbAssets : assets;

    const filteredAssets = assetSourceList.filter(a => {
      const query = searchQuery.toLowerCase().trim();
      const fundingVal = a.asset_monetary?.funding_source || a.funding || "";
      const matchQuery =
        (a.id || "").toLowerCase().includes(query) ||
        (a.name || "").toLowerCase().includes(query) ||
        (a.serial || a.serial_number || "").toLowerCase().includes(query) ||
        (a.lab || "").toLowerCase().includes(query) ||
        (a.itsPropertyTag || "").toLowerCase().includes(query) ||
        (a.tsgPropertyTag || "").toLowerCase().includes(query) ||
        (a.manufacturer || "").toLowerCase().includes(query);

      let matchFunding = true;
      if (fundingFilter === "GOVERNMENT") {
        matchFunding = ["DOST", "CHED", "USAST"].includes(fundingVal);
      } else if (fundingFilter === "PRIVATE") {
        matchFunding = ["USAID", "Internal Grants"].includes(fundingVal);
      } else if (fundingFilter !== "ALL") {
        matchFunding = fundingVal === fundingFilter;
      }

      let matchDate = true;
      const pDate = a.procurement_date || a.procured;
      if (dateFilterStart && pDate) {
        matchDate = matchDate && new Date(pDate).getTime() >= new Date(dateFilterStart).getTime();
      }
      if (dateFilterEnd && pDate) {
        matchDate = matchDate && new Date(pDate).getTime() <= new Date(dateFilterEnd).getTime();
      }

      return matchQuery && matchFunding && matchDate;
    });

    const triggerPrint = () => {
      window.print();
    };

    const triggerExportCSV = () => {
      const headers = ["Asset ID", "Property Tag", "Name", "Serial Number", "Manufacturer", "Category", "Funding", "Acquisition Date", "Valuation", "Status", "Custodian", "Lab"];
      const rows = filteredAssets.map(a => [
        a.id,
        a.itsPropertyTag || `DLSU-ITS-${a.id}`,
        a.name,
        a.serial || a.serial_number || "",
        a.manufacturer || "",
        a.category || "",
        a.asset_monetary?.funding_source || a.funding || "Unspecified",
        a.procurement_date || a.procured || "",
        a.asset_monetary?.acquisition_value || a.cost || 0,
        a.status,
        a.custodian || "Unassigned",
        a.lab || "CITe4D"
      ]);

      const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `AdRIC_Audit_Report_${fundingFilter}_Funding.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="space-y-6 print:bg-white print:text-black">
        {/* Filters Panel */}
        <Card className="shadow-sm print:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Custom Audit Report Generator Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Search Equipment</Label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    placeholder="Search ID, name, serial..."
                    className="pl-9 text-xs bg-muted/40 border-border text-foreground focus-visible:ring-[#005A36] h-9"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Funding Source (Segregated)</Label>
                <select
                  value={fundingFilter}
                  onChange={e => setFundingFilter(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">All Funding Sources</option>
                  <option value="GOVERNMENT">Government (DOST, CHED, USAST)</option>
                  <option value="PRIVATE">Private / Internal (USAID, Internal)</option>
                  <option value="DOST">DOST Funded</option>
                  <option value="CHED">CHED Funded</option>
                  <option value="USAID">USAID Funded</option>
                  <option value="USAST">USAST Funded</option>
                  <option value="Internal Grants">Internal Grants</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Acquisition Start Date</Label>
                <Input
                  type="date"
                  className="text-xs bg-muted/40 border-border text-foreground focus-visible:ring-[#005A36] h-9"
                  value={dateFilterStart}
                  onChange={e => setDateFilterStart(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Acquisition End Date</Label>
                <Input
                  type="date"
                  className="text-xs bg-muted/40 border-border text-foreground focus-visible:ring-[#005A36] h-9"
                  value={dateFilterEnd}
                  onChange={e => setDateFilterEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-border pt-4">
              <Button
                className="bg-[#005A36] hover:bg-[#004225] text-white text-xs font-bold border-none h-9"
                onClick={triggerExportCSV}
              >
                <Download className="size-3.5 mr-2" />
                Export CSV Archive
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audit Results Table */}
        <Card className="shadow-sm print:border-none print:bg-white print:text-black">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground print:text-slate-800">
                AdRIC Compliance Audit Report ({isDashboardLoading ? "..." : `${filteredAssets.length} ASSETS FOUND`})
              </CardTitle>
              <p className="text-[10px] text-muted-foreground/60 print:block hidden mt-1">Generated on: {new Date().toLocaleString()} · DLSU AdRIC Director Office</p>
            </div>
            <Badge className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[9px] uppercase print:hidden">
              Audit Ready
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="print:border-slate-300">
                  <TableRow className="print:border-slate-300">
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850">Equipment ID</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850">Physical Tag</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850">Details</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-center">Funding</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-center">Acquired</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-right">Valuation</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-right font-bold">Status / Custodian</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-right print:hidden">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isDashboardLoading ? (
                    <>
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <TableRow key={i}>
                          <TableCell colSpan={8} className="p-3">
                            <div className="h-10 w-full bg-muted/60 animate-pulse rounded-md" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  ) : filteredAssets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-xs italic">
                        0 ASSETS FOUND matching the active filter criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAssets.map(item => {
                      const isDisposed = item.status === "Disposed";
                      const itemValuation = Number(item.asset_monetary?.acquisition_value || item.cost || item.acquisition_value || 0);
                      const itemFunding = item.asset_monetary?.funding_source || item.funding || "Unspecified";
                      const itemProcured = item.procurement_date || item.procured || "N/A";

                      return (
                        <TableRow key={item.id} className="print:border-slate-200 hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-xs text-[#005A36] print:text-slate-900 font-bold">{item.id}</TableCell>
                          <TableCell className="text-xs">
                            <p className="font-mono text-foreground print:text-slate-900 font-semibold">{item.itsPropertyTag || `DLSU-ITS-${item.id}`}</p>
                            <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">{item.tsgPropertyTag || `DLSU-TSG-${item.id}`}</p>
                          </TableCell>
                          <TableCell className="text-xs">
                            <p className="font-bold text-foreground print:text-slate-900">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground font-semibold print:text-slate-600 mt-0.5">{item.lab} · {item.manufacturer} · S/N: {item.serial || item.serial_number}</p>
                          </TableCell>
                          <TableCell className="text-center text-xs font-semibold text-muted-foreground print:text-slate-800">{itemFunding}</TableCell>
                          <TableCell className="text-center text-xs font-mono text-muted-foreground print:text-slate-800">{itemProcured}</TableCell>
                          <TableCell className="text-right text-xs font-mono font-semibold text-muted-foreground print:text-slate-800">
                            PHP {itemValuation.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {isDisposed ? (
                              <div className="space-y-0.5">
                                <Badge className="bg-red-50 text-red-750 border border-red-200 text-[9px] font-bold uppercase">Disposed</Badge>
                                <p className="text-[9px] text-muted-foreground/60 font-mono">ID: {item.disposalId}</p>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <Badge className={cn("text-[9px] font-bold border uppercase",
                                  item.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                    item.status === "On Loan" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                      "bg-amber-50 text-amber-700 border-amber-200"
                                )}>
                                  {item.status}
                                </Badge>
                                <p className="text-[9px] text-muted-foreground print:text-slate-600 font-semibold">{item.custodian || "No custodian assigned"}</p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right print:hidden">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[#005A36] hover:text-[#004225] text-[10px] font-bold h-7 px-2"
                              onClick={() => setSelectedAssetForAudit(item)}
                            >
                              Full Lifecycle
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Lifecycle Modal */}
        {selectedAssetForAudit && (
          <Dialog open={!!selectedAssetForAudit} onOpenChange={open => { if (!open) setSelectedAssetForAudit(null); }}>
            <DialogContent className="max-w-2xl bg-card border border-border text-card-foreground max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <div>
                    <DialogTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                      <Tag className="text-[#005A36] size-4" />
                      Asset Lifecycle Audit Trail: {selectedAssetForAudit.id}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Full chronological registry logs mapping physical location, history, and custody transitions.
                    </DialogDescription>
                  </div>
                  <Button
                    size="sm"
                    className="bg-[#005A36] hover:bg-[#004225] text-white text-xs font-bold gap-1.5 shrink-0"
                    onClick={() => exportLifecycleCSV(selectedAssetForAudit)}
                  >
                    <Download size={14} />
                    Export CSV
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-3">
                {/* 1. Core Metadata */}
                <div className="grid grid-cols-2 gap-4 bg-muted/45 p-4 border border-border rounded-xl text-xs text-muted-foreground leading-relaxed">
                  <div className="space-y-1.5">
                    <p><span>Equipment Name:</span> <strong className="text-foreground">{selectedAssetForAudit.name}</strong></p>
                    <p><span>Serial Number:</span> <span className="font-mono">{selectedAssetForAudit.serial}</span></p>
                    <p><span>Manufacturer:</span> {selectedAssetForAudit.manufacturer}</p>
                    <p><span>Funding Source:</span> <span className="font-semibold text-[#005A36]">{selectedAssetForAudit.funding}</span></p>
                    <p><span>Acquisition Date:</span> {selectedAssetForAudit.procured}</p>
                  </div>
                  <div className="space-y-1.5 border-l border-border pl-4">
                    <p><span>ITS Property Tag:</span> <span className="font-mono text-[#005A36] font-semibold">{selectedAssetForAudit.itsPropertyTag || `DLSU-ITS-${selectedAssetForAudit.id}`}</span></p>
                    <p><span>TSG Property Tag:</span> <span className="font-mono text-[#005A36] font-semibold">{selectedAssetForAudit.tsgPropertyTag || `DLSU-TSG-${selectedAssetForAudit.id}`}</span></p>
                    <p><span>Deed of Donation Ref:</span> <span className="font-semibold text-[#005A36]">DOD-2024-{selectedAssetForAudit.id.split("-").pop()}</span></p>
                    <p><span>Purchase Valuation:</span> PHP {selectedAssetForAudit.cost?.toLocaleString() || "0"}</p>
                    <p><span>Current Status:</span> <span className="font-bold text-[#005A36]">{selectedAssetForAudit.status}</span></p>
                  </div>
                </div>

                {/* 2. Custodian & Transfer History */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground border-b border-border pb-1.5 flex items-center gap-1.5">
                    <User size={13} className="text-[#005A36]" />
                    Custodianship &amp; Transfer History
                  </h4>
                  {((selectedAssetForAudit.asset_transfers && selectedAssetForAudit.asset_transfers.length > 0) ||
                    (transfers || []).filter(t => t.assetId === selectedAssetForAudit.id).length > 0) ? (
                    <div className="space-y-2">
                      {/* Render asset_transfers relation */}
                      {(selectedAssetForAudit.asset_transfers || []).map((t: any) => (
                        <div key={t.transfer_id || t.id} className="p-3 bg-card border border-border rounded-lg text-xs space-y-1 shadow-2xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-foreground">Transfer ID: #{t.transfer_id || t.id}</span>
                            <Badge className={cn("text-[9px] uppercase font-bold border",
                              (t.status || "").toLowerCase() === "approved" || (t.status || "").toLowerCase() === "completed" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"
                            )}>{t.status}</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono">Requested On: {t.requested_on || t.initiated || "N/A"}</p>
                          <p className="text-xs">
                            <span className="font-bold text-foreground">{t.from || `Custodian ID #${t.from_custodian_id}`}</span>
                            <span className="text-muted-foreground mx-2">➔</span>
                            <span className="font-bold text-[#005A36]">{t.to || `Custodian ID #${t.to_custodian_id}`}</span>
                          </p>
                          {t.justification && <p className="text-[11px] italic text-muted-foreground">Justification: "{t.justification}"</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/60 italic p-1">No custody transfer history registered.</p>
                  )}
                </div>

                {/* 3. Repair & Maintenance Logs */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground border-b border-border pb-1.5 flex items-center gap-1.5">
                    <Wrench size={13} className="text-[#005A36]" />
                    Repair &amp; Maintenance Logs
                  </h4>
                  {(repairRequests || []).filter(r => r.assetId === selectedAssetForAudit.id).length > 0 ? (
                    <div className="space-y-2">
                      {(repairRequests || []).filter(r => r.assetId === selectedAssetForAudit.id).map(r => (
                        <div key={r.id} className="p-3 bg-muted/30 border border-border rounded-lg text-xs space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-foreground">{r.id} · Priority: <span className="text-amber-600">{r.priority}</span></span>
                            <Badge className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold uppercase">{r.statusLabel}</Badge>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{r.description}</p>
                          <p className="text-[9px] text-muted-foreground/60">Reported By: {r.custodian} · Submitted At: {new Date(r.submittedAt).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/60 italic p-1">No technical repair logs registered.</p>
                  )}
                </div>

                {/* 4. Routine Inspections */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground border-b border-border pb-1.5 flex items-center gap-1.5">
                    <ClipboardCheck size={13} className="text-[#005A36]" />
                    Routine Inspection Reports
                  </h4>
                  {((selectedAssetForAudit.asset_reports && selectedAssetForAudit.asset_reports.length > 0) ||
                    (inspections || []).filter(i => i.assetId === selectedAssetForAudit.id).length > 0) ? (
                    <div className="space-y-2">
                      {((selectedAssetForAudit.asset_reports && selectedAssetForAudit.asset_reports.length > 0)
                        ? selectedAssetForAudit.asset_reports
                        : (inspections || []).filter(i => i.assetId === selectedAssetForAudit.id)
                      ).map((rpt: any, idx: number) => (
                        <div key={rpt.id || rpt.reportId || idx} className="p-3 bg-muted/30 border border-border rounded-lg text-xs flex justify-between items-center shadow-2xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{rpt.reportedBy || rpt.inspector || "TSG Technical Staff"}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">({rpt.reportDate || rpt.date_logged || rpt.date || "N/A"})</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">{rpt.remarks || rpt.description || rpt.notes || "Routine physical inspection logged."}</p>
                          </div>
                          <Badge className="bg-emerald-50 border-emerald-200 text-emerald-700 text-[9px] uppercase font-bold">
                            {rpt.condition || rpt.status || "VERIFIED"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/60 italic p-1">No physical routine inspections logged.</p>
                  )}
                </div>

                {/* 5. Disposal Details if Disposed */}
                {selectedAssetForAudit.status === "Disposed" && selectedAssetForAudit.disposalDetails && (
                  <div className="space-y-2.5 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <h4 className="text-xs font-bold text-red-755 flex items-center gap-1.5">
                      <XCircle size={13} />
                      Decommissioning &amp; Disposal Details
                    </h4>
                    <div className="text-xs text-muted-foreground mt-2 font-mono space-y-1.5 leading-relaxed">
                      <p><strong>Disposal ID:</strong> {selectedAssetForAudit.disposalId}</p>
                      <p><strong>Decommission Date:</strong> {selectedAssetForAudit.disposalDetails.decommissionDate}</p>
                      <p><strong>Decommissioned By:</strong> {selectedAssetForAudit.disposalDetails.decommissionedBy}</p>
                      <p><strong>Disposal Pathway:</strong> {selectedAssetForAudit.disposalDetails.disposalPathway}</p>
                      <p><strong>Breakdown Reasons:</strong> {selectedAssetForAudit.disposalDetails.breakdownReasons}</p>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-2">
                <Button
                  onClick={() => setSelectedAssetForAudit(null)}
                  className="bg-[#005A36] hover:bg-[#004225] text-white text-xs font-bold border-none"
                >
                  Close Audit Trail
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="mb-6 print:hidden">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">AdRIC Director Control Suite</h1>
          <Badge className="bg-[#005A36] hover:bg-[#004225] text-white font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 border-none">ADMIN OVERWATCH</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">High-level executive oversight, health tracking, decommissioning approvals, and compliance audit trail reporting.</p>
      </div>

      {/* Tabs rendering */}
      {activeTab === "overview" && renderOverview()}
      {activeTab === "analytics" && renderAnalytics()}
      {activeTab === "clearance-disposal" && renderClearanceDisposal()}
      {activeTab === "reports" && renderReports()}
    </div>
  );
}