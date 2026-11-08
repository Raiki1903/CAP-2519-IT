/**
 * Director screen: Overview, Analytics, Disposal Approvals, and the Inventory Report, one tab at a time.
 * Layer: page. Called by app/routes.tsx at /adric-director/* (the tab comes from the URL).
 * Calls: features/disposals/DisposalDecisionControls.tsx (api/retirements.api.ts decideRetirement()), features/lookups/useLookups.ts (the labs and their campus),
 * features/assets/campusCounts.ts, features/assets/assetSearch.ts (the search placeholder), features/analytics/director/DirectorAnalyticsView.tsx, state/serverData.tsx.
 * Used by: AdRIC Director (disposal decisions, inventory reports).
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import DirectorAnalyticsView from "@web/features/analytics/director/DirectorAnalyticsView";
import { useSession } from "@web/state/session";
import { useServerData, type Asset } from "@web/state/serverData";
import { assetStatusLabel } from "@web/features/assets/assetBadges";
import { countAssetsByCampus } from "@web/features/assets/campusCounts";
import { ASSET_SEARCH_PLACEHOLDER } from "@web/features/assets/assetSearch";
import { useFormLookups } from "@web/features/lookups/useLookups";
import { DisposalDecisionControls } from "@web/features/disposals/DisposalDecisionControls";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import { Button } from "@web/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { Badge } from "@web/components/ui/badge";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { cn } from "@web/components/ui/utils";
import {
  Monitor, BarChart3, ClipboardCheck, ClipboardList, TrendingUp, AlertTriangle,
  MapPin, CheckCircle2, XCircle, Search, Download, Printer, Wrench, Calendar, Tag, ShieldAlert
} from "lucide-react";

interface AdRICDirectorDashboardProps {
  activeTab: "overview" | "analytics" | "clearance-disposal" | "reports";
}

// The page title is the sidebar's name for the tab. Analytics shows its own title.
const TAB_TITLES: Record<AdRICDirectorDashboardProps["activeTab"], string> = {
  overview: "Overview",
  analytics: "Analytics",
  "clearance-disposal": "Disposal Approvals",
  reports: "Inventory Report",
};

// The funding_sources name for equipment a researcher bought with their own money (#167).
// The Inventory Report filter matches names exactly, so it must equal the seeded and migrated row.
const PERSONAL_FUNDING = "Personal (self-funded)";

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

/**
 * Turns an asset's condition into a 0 to 100 score for the health figures.
 * Accepts a numeric score, a database enum name (PERFECT, CRITICAL_DEFECT), or a display
 * label, because the asset lists this page reads do not agree on the field or its form.
 * Only this file calls it.
 *
 * @param asset an asset from any of the page's lists
 * @returns the score; 100 when the asset has no condition recorded
 */
export function getLatestRecordConditionScore(asset: any): number {
  if (asset.condition !== undefined && typeof asset.condition === "number" && asset.condition > 0 && asset.condition !== 100) {
    return asset.condition;
  }
  const condStr = String(asset.assetCondition || asset.asset_condition || asset.descriptiveCondition || asset.condition || "");
  if (!condStr || condStr === "undefined") return 100; // Default when TSG never inspected the asset
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

/**
 * Shows one Director tab.
 * - overview: campus distribution (three campuses) and the status of every lab, with skeletons until the lists load.
 * - analytics: the Director analytics view.
 * - clearance-disposal: the pending disposal queue, approved or denied (with a reason) through DisposalDecisionControls.
 * - reports: the inventory report, with a per-asset history and CSV export.
 * Shows the shared asset list and the shared disposal list. Each time a tab opens it reloads the shared lists once
 * (refreshSharedLists), so the bell and the analytics show other people's changes.
 *
 * @param activeTab "overview", "analytics", "clearance-disposal", or "reports"
 */
export function AdRICDirectorDashboard({ activeTab }: AdRICDirectorDashboardProps) {
  const navigate = useNavigate();
  const { currentUser } = useSession();
  const {
    assets,
    tickets = [],
    retirements = [],
    isDbLoading: isGlobalDbLoading,
    syncFromDb,
    refreshSharedLists
  } = useServerData();

  const isDashboardLoading = isGlobalDbLoading;
  const { lookups, failed: lookupsFailed } = useFormLookups();
  // The Labs table needs the lab list as well as the assets.
  const labsLoading = isDashboardLoading || (!lookups && !lookupsFailed);

  const exportLifecycleCSV = (asset: any) => {
    if (!asset) return;

    const assetRepairs = tickets.filter(t => t.asset.tag === asset.id);

    // Only the reports saved in asset_inspections, the same ones the Staff inspection log shows. (F-28)
    const assetReports = asset.asset_reports || [];

    let csvContent = `Asset History Report\n`;
    csvContent += `Generated On,"${new Date().toLocaleString()}"\n\n`;

    csvContent += `CORE METADATA\n`;
    csvContent += `Asset ID,"${asset.id}"\n`;
    csvContent += `Asset Name,"${(asset.name || "").replace(/"/g, '""')}"\n`;
    csvContent += `Serial Number,"${asset.serial || asset.serial_number || ""}"\n`;
    csvContent += `Manufacturer,"${(asset.manufacturer || "").replace(/"/g, '""')}"\n`;
    csvContent += `Funding Source,"${(asset.funding || "").replace(/"/g, '""')}"\n`;
    csvContent += `Acquisition Date,"${asset.procurement_date || asset.procured || ""}"\n`;
    csvContent += `Purchase Valuation,"PHP ${(asset.cost || 0).toLocaleString()}"\n`;
    csvContent += `ITS Property Tag,"${asset.itsPropertyTag || "None"}"\n`;
    csvContent += `TSG Property Tag,"${asset.tsgPropertyTag || "None"}"\n`;
    csvContent += `Availability,"${assetStatusLabel(asset.status)}"\n`;

    csvContent += `\nREPAIR & MAINTENANCE LOGS\n`;
    csvContent += `Repair ID,Issue Type,Status,Description,Reported By,Reported At\n`;
    if (assetRepairs.length > 0) {
      assetRepairs.forEach(r => {
        csvContent += `"MNT-${r.maintenanceId}","${r.issueType?.name ?? r.typeLabel}","${r.statusLabel}","${r.issueDescription.replace(/"/g, '""')}","${"hidden" in r.reportedBy ? "Not shown" : r.reportedBy.name}","${r.reportedAt}"\n`;
      });
    } else {
      csvContent += `No technical repair logs registered.\n`;
    }

    csvContent += `\nROUTINE INSPECTION REPORTS\n`;
    csvContent += `Report ID,Inspector,Date Logged,Condition / Status,Remarks\n`;
    if (assetReports.length > 0) {
      assetReports.forEach((rpt: any) => {
        csvContent += `"${rpt.reportId || rpt.id || ""}","${(rpt.reportedBy || rpt.inspector || "Staff").replace(/"/g, '""')}","${rpt.reportDate || rpt.date_logged || rpt.date || "N/A"}","${rpt.condition || rpt.status || "VERIFIED"}","${(rpt.remarks || rpt.description || rpt.notes || "").replace(/"/g, '""')}"\n`;
      });
    } else {
      csvContent += `No physical routine inspections logged.\n`;
    }

    if (asset.status === "RETIRED" && asset.disposalDetails) {
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

  // One load per tab: every tab change mounts this screen again (RootLayout keys the page by its URL).
  // The shared reload is skipped when one started moments ago, as at login. (issue #92)
  useEffect(() => {
    refreshSharedLists();
  }, [activeTab]);

  // The disposals waiting for a decision. The Director never requests one, so each of them is theirs to decide.
  const pendingDisposals = retirements.filter(r => r.status === "PENDING");

  const [searchQuery, setSearchQuery] = useState("");
  const [fundingFilter, setFundingFilter] = useState("ALL");
  const [dateFilterStart, setDateFilterStart] = useState("");
  const [dateFilterEnd, setDateFilterEnd] = useState("");
  const [selectedAssetForAudit, setSelectedAssetForAudit] = useState<Asset | null>(null);

  // Custom states for interactive features
  // TODO(F-37): unused, left from a clearance holds screen that no longer exists. Holds are an open team decision.
  const [selectedHoldAffiliate, setSelectedHoldAffiliate] = useState<any | null>(null);
  const [overrideNotes, setOverrideNotes] = useState("");

  // The shared asset list. Typed loosely because the server sends fields the Asset type does not declare (H-13).
  const activeAssetList: any[] = assets;
  const activeAssets = activeAssetList.filter(a => a.status !== "RETIRED");
  const degradingAssets = activeAssets.filter(a => getLatestRecordConditionScore(a) <= 60);
  const maintenanceCount = activeAssets.filter(a => a.status === "MAINTENANCE" || a.status === "In Repair").length;

  const totalValuation = activeAssetList.reduce((sum, a) => {
    const val = Number(a.cost || a.acquisition_value || a.acquisitionValue || 0);
    return sum + val;
  }, 0);

  // 1. Overview Tab render
  const renderOverview = () => {
    const campusCounts = countAssetsByCampus(activeAssetList.filter(a => a.status !== "RETIRED"));
    const campusTotal = activeAssets.length;
    const CAMPUS_BAR_COLORS = ["#005A36", "#10B981", "#0EA5E9"];

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Total Value</p>
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
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Assets in Service</p>
                {isDashboardLoading ? (
                  <div className="h-7 w-28 bg-muted/60 animate-pulse rounded-md mt-1" />
                ) : (
                  <h3 className="text-2xl font-extrabold mt-1 text-foreground font-mono">
                    {activeAssetList.filter(a => a.status !== "RETIRED" && a.status !== "DISPOSED").length || activeAssetList.length} assets
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
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">In Maintenance or Degraded</p>
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
              {isDashboardLoading ? (
                <div className="space-y-4 py-1">
                  {campusCounts.map(c => (
                    <div key={c.campus} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                      </div>
                      <div className="w-full bg-muted/60 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-muted h-full animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                campusCounts.map((c, i) => {
                  const percent = campusTotal ? Math.round((c.count / campusTotal) * 100) : 0;
                  return (
                    <div key={c.campus} className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <MapPin className="size-4" style={{ color: CAMPUS_BAR_COLORS[i] }} />
                          <span>{c.label} Campus</span>
                        </div>
                        <span className="font-bold text-foreground font-mono">{c.count} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                        <div className="h-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: CAMPUS_BAR_COLORS[i] }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Health and utilization of every laboratory */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Labs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase">Lab</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase">Campus</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Assets</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Health Index</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Utilization</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-right">Condition</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labsLoading ? (
                      Array.from({ length: 5 }, (_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={6}><div className="h-4 w-full bg-muted/60 animate-pulse rounded" /></TableCell>
                        </TableRow>
                      ))
                    ) : lookupsFailed ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-xs font-semibold text-red-600">Could not load the labs. Reload the page.</TableCell>
                      </TableRow>
                    ) : (lookups?.labs ?? []).map(lab => {
                      const labAssets = activeAssets.filter(a => a.homeLab?.centerId === lab.centerId);
                      const assetCount = labAssets.length;
                      let avgConditionStr = "0%";
                      let utilRateStr = "0%";
                      let avgConditionNum = 100;

                      if (assetCount > 0) {
                        const totalScore = labAssets.reduce((s, a) => s + getLatestRecordConditionScore(a), 0);
                        avgConditionNum = Math.round(totalScore / assetCount);
                        avgConditionStr = `${avgConditionNum}%`;

                        // Utilization is the share of the lab's assets that are On Loan now.
                        const utilized = labAssets.filter(a => a.status === "ON_LOAN").length;
                        utilRateStr = `${Math.round((utilized / assetCount) * 100)}%`;
                      } else {
                        avgConditionStr = "N/A";
                        utilRateStr = "0%";
                      }

                      let statusBadge = <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-250 text-[9px] font-bold uppercase">Good</Badge>;
                      if (assetCount === 0) {
                        statusBadge = <Badge variant="outline" className="text-muted-foreground text-[9px] font-bold uppercase">No assets</Badge>;
                      } else if (avgConditionNum <= 60) {
                        statusBadge = <Badge className="bg-red-50 text-red-700 border border-red-255 text-[9px] font-bold uppercase">Critical</Badge>;
                      } else if (avgConditionNum <= 78) {
                        statusBadge = <Badge className="bg-amber-50 text-amber-700 border border-amber-250 text-[9px] font-bold uppercase">Attention</Badge>;
                      }

                      return (
                        <TableRow key={lab.centerId} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-bold text-foreground text-xs">{lab.code}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{lab.campusLabel}</TableCell>
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

  // 3. Disposal Approvals render
  const renderClearanceDisposal = () => {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Regulated Disposal Approvals */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Disposal Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              TSG asked to dispose of these assets. Each one needs your approval or your denial.
            </p>

            {isGlobalDbLoading && pendingDisposals.length === 0 && (
              <p className="text-xs text-muted-foreground">Loading disposal requests…</p>
            )}

            <div className="space-y-3.5">
              {pendingDisposals.map(req => (
                <Card key={req.retirementId} className="border-l-4 border-l-amber-500 overflow-hidden shadow-sm" style={{ borderLeftWidth: 4 }}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{req.asset.tag} - {req.asset.name}</h4>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Requested by: {"hidden" in req.requestedBy ? "Not shown" : req.requestedBy.name} · {new Date(req.requestedAt).toLocaleDateString()}
                          {req.pathwayLabel ? ` · Pathway: ${req.pathwayLabel}` : ""}
                        </p>
                      </div>
                      <Badge className="bg-amber-50 border border-amber-200 text-amber-700 text-[9px] uppercase font-bold">
                        {req.statusLabel}
                      </Badge>
                    </div>

                    <div className="p-3 bg-muted/40 border border-border rounded-lg text-[10px] text-muted-foreground font-mono leading-relaxed whitespace-pre-line">
                      {req.reason}
                    </div>

                    <div className="pt-1">
                      <DisposalDecisionControls retirement={req} onDecided={syncFromDb} />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {!isGlobalDbLoading && pendingDisposals.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground text-xs bg-muted/10">
                  <CheckCircle2 className="text-[#005A36]/40 mb-2.5 size-9" />
                  <p className="font-semibold text-foreground">No Disposal Requests</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Nothing is waiting for your approval.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // 4. Inventory Report render
  const renderReports = () => {
    const assetSourceList: any[] = assets;

    const filteredAssets = assetSourceList.filter(a => {
      const query = searchQuery.toLowerCase().trim();
      const fundingVal = a.funding || "";
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
        matchFunding = ["USAID", "Internal Grants", PERSONAL_FUNDING].includes(fundingVal);
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
      const headers = ["Asset ID", "ITS Property Tag", "Name", "Serial Number", "Manufacturer", "Category", "Funding", "Acquisition Date", "Valuation", "Availability", "Custodian", "Lab"];
      const rows = filteredAssets.map(a => [
        a.id,
        a.itsPropertyTag || "None",
        a.name,
        a.serial || a.serial_number || "",
        a.manufacturer || "",
        a.category || "",
        a.funding || "Unspecified",
        a.procurement_date || a.procured || "",
        a.cost || 0,
        assetStatusLabel(a.status),
        a.custodian || "None",
        a.lab || ""
      ]);

      const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `AdRIC_Inventory_Report_${fundingFilter}_Funding.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="space-y-6 print:bg-white print:text-black">
        {/* Filters Panel */}
        <Card className="shadow-sm print:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Inventory Report Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Search Equipment</Label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    placeholder={ASSET_SEARCH_PLACEHOLDER}
                    className="pl-9 text-xs bg-muted/40 border-border text-foreground focus-visible:ring-[#005A36] h-9"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Funding Source</Label>
                <select
                  value={fundingFilter}
                  onChange={e => setFundingFilter(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">All Funding Sources</option>
                  <option value="GOVERNMENT">Government (DOST, CHED, USAST)</option>
                  <option value="PRIVATE">Private / Internal (USAID, Internal, Personal)</option>
                  <option value="DOST">DOST Funded</option>
                  <option value="CHED">CHED Funded</option>
                  <option value="USAID">USAID Funded</option>
                  <option value="USAST">USAST Funded</option>
                  <option value="Internal Grants">Internal Grants</option>
                  <option value={PERSONAL_FUNDING}>{PERSONAL_FUNDING}</option>
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
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Report Table */}
        <Card className="shadow-sm print:border-none print:bg-white print:text-black">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground print:text-slate-800">
                Inventory Report ({isDashboardLoading ? "..." : `${filteredAssets.length} assets`})
              </CardTitle>
              <p className="text-[10px] text-muted-foreground/60 print:block hidden mt-1">Generated on: {new Date().toLocaleString()} · DLSU AdRIC Director Office</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="print:border-slate-300">
                  <TableRow className="print:border-slate-300">
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850">Asset ID</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850">Property Tags</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850">Details</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-center">Funding</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-center">Acquired</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-right">Valuation</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-right font-bold">Availability / Custodian</TableHead>
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
                        No assets match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAssets.map(item => {
                      const isDisposed = item.status === "RETIRED";
                      const itemValuation = Number(item.cost || item.acquisition_value || 0);
                      const itemFunding = item.funding || "Unspecified";
                      const itemProcured = item.procurement_date || item.procured || "N/A";

                      return (
                        <TableRow key={item.id} className="print:border-slate-200 hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-xs text-[#005A36] print:text-slate-900 font-bold">{item.id}</TableCell>
                          <TableCell className="text-xs">
                            <p className="font-mono text-foreground print:text-slate-900 font-semibold">ITS: {item.itsPropertyTag || "None"}</p>
                            <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">TSG: {item.tsgPropertyTag || "None"}</p>
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
                                  item.status === "AVAILABLE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                    item.status === "ON_LOAN" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                      "bg-amber-50 text-amber-700 border-amber-200"
                                )}>
                                  {assetStatusLabel(item.status)}
                                </Badge>
                                <p className="text-[9px] text-muted-foreground print:text-slate-600 font-semibold">{item.custodian || "None"}</p>
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
                              History
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
                      Asset History: {selectedAssetForAudit.id}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Repairs, inspections, and disposal of this asset.
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
                    <p><span>ITS Property Tag:</span> <span className="font-mono text-[#005A36] font-semibold">{selectedAssetForAudit.itsPropertyTag || "None"}</span></p>
                    <p><span>TSG Property Tag:</span> <span className="font-mono text-[#005A36] font-semibold">{selectedAssetForAudit.tsgPropertyTag || "None"}</span></p>
                    <p><span>Purchase Valuation:</span> PHP {selectedAssetForAudit.cost?.toLocaleString() || "0"}</p>
                    <p><span>Availability:</span> <span className="font-bold text-[#005A36]">{assetStatusLabel(selectedAssetForAudit.status)}</span></p>
                  </div>
                </div>

                {/* 3. Repair & Maintenance Logs */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground border-b border-border pb-1.5 flex items-center gap-1.5">
                    <Wrench size={13} className="text-[#005A36]" />
                    Repair &amp; Maintenance Logs
                  </h4>
                  {tickets.filter(t => t.asset.tag === selectedAssetForAudit.id).length > 0 ? (
                    <div className="space-y-2">
                      {tickets.filter(t => t.asset.tag === selectedAssetForAudit.id).map(r => (
                        <div key={r.maintenanceId} className="p-3 bg-muted/30 border border-border rounded-lg text-xs space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-foreground">MNT-{r.maintenanceId} · Issue: <span className="text-amber-600">{r.issueType?.name ?? r.typeLabel}</span></span>
                            <Badge className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold uppercase">{r.statusLabel}</Badge>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{r.issueDescription}</p>
                          <p className="text-[9px] text-muted-foreground/60">Reported By: {"hidden" in r.reportedBy ? "Not shown" : r.reportedBy.name} · Reported At: {new Date(r.reportedAt).toLocaleDateString()}</p>
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
                  {(selectedAssetForAudit.asset_reports && selectedAssetForAudit.asset_reports.length > 0) ? (
                    <div className="space-y-2">
                      {selectedAssetForAudit.asset_reports.map((rpt: any, idx: number) => (
                        <div key={rpt.id || rpt.reportId || idx} className="p-3 bg-muted/30 border border-border rounded-lg text-xs flex justify-between items-center shadow-2xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{rpt.reportedBy || rpt.inspector || "Staff"}</span>
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
                {selectedAssetForAudit.status === "RETIRED" && selectedAssetForAudit.disposalDetails && (
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
                  Close
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
      {activeTab !== "analytics" && (
        <div className="mb-6 print:hidden">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{TAB_TITLES[activeTab]}</h1>
        </div>
      )}

      {/* Tabs rendering */}
      {activeTab === "overview" && renderOverview()}
      {activeTab === "analytics" && renderAnalytics()}
      {activeTab === "clearance-disposal" && renderClearanceDisposal()}
      {activeTab === "reports" && renderReports()}
    </div>
  );
}