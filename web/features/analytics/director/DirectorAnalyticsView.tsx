/**
 * Director analytics: portfolio value, location and status, funding, and utilization widgets.
 * Layer: feature component. Called by pages/director/AdRICDirectorDashboard.tsx (analytics tab).
 * Calls: features/analytics/insights/InsightsPanel.tsx, features/analytics/utilization/LoansPerWeekChart.tsx, api/analytics.api.ts getDirectorAnalytics(), state/serverData.tsx (assets, reports, loans, pending disposals).
 * Used by: AdRIC Director.
 */
import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useServerData } from "@web/state/serverData";
import * as analyticsApi from "@web/api/analytics.api";
import { InsightsPanel } from "@web/features/analytics/insights/InsightsPanel";
import { LoansPerWeekChart } from "@web/features/analytics/utilization/LoansPerWeekChart";
import { CAMPUS_LABELS } from "@shared/constants/campuses";
import { useFormLookups } from "@web/features/lookups/useLookups";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line
} from "recharts";
import {
  FileCheck,
  TrendingUp,
  AlertTriangle,
  Building2,
  DollarSign,
  Maximize2,
  ExternalLink,
  ArrowRightLeft,
  PieChart as PieIcon
} from "lucide-react";

const cardAnimation = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
};

const PIE_COLORS_OUTER = ["#005A36", "#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899"];
const PIE_COLORS_INNER = ["#047857", "#34D399", "#60A5FA", "#FBBF24", "#A7F3D0", "#93C5FD"];

/** Filters the Director view passes down to its widgets. */
export interface DirectorAnalyticsProps {
  selectedLabFilter?: string;
  startDate?: string;
  endDate?: string;
  setStartDate?: (val: string) => void;
  setEndDate?: (val: string) => void;
}

// Macro & Financial View (Task 1: Portfolio Value KPI, Pending Disposal Count, Location vs Status Stacked Column, Line Graph Audit Compliance)
/**
 * Portfolio value and pending disposal KPIs, the location by status chart, and audit compliance over time.
 * Calls analyticsApi.getDirectorAnalytics() with the lab and date filters. Shows a loading state until the server
 * answers, and a message when it fails: it never shows an estimate from the shared lists first.
 *
 * @param selectedLabFilter lab to scope to, or "All Labs"
 * @param startDate start of the date range, or empty for no limit
 * @param endDate end of the date range, or empty for no limit
 */
export const MacroFinancialSection: React.FC<DirectorAnalyticsProps> = ({
  selectedLabFilter = "All Labs",
  startDate = "",
  endDate = "",
  setStartDate,
  setEndDate,
}) => {
  const [apiData, setApiData] = useState<any>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    // The old answer goes at once, so no figure from another filter stays on screen while this one loads.
    setApiData(null);
    setLoadFailed(false);
    setIsLoadingApi(true);
    const params = new URLSearchParams();
    if (selectedLabFilter && selectedLabFilter !== "All Labs" && selectedLabFilter !== "All") {
      params.append("lab", selectedLabFilter);
    }
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    analyticsApi.getDirectorAnalytics(params.toString())
      .then(json => {
        if (!isMounted) return;
        if (json.success && json.data) setApiData(json.data);
        else setLoadFailed(true);
      })
      .catch(err => {
        console.error("Failed to fetch director analytics from server:", err);
        if (isMounted) setLoadFailed(true);
      })
      .finally(() => {
        if (isMounted) setIsLoadingApi(false);
      });

    return () => { isMounted = false; };
  }, [selectedLabFilter, startDate, endDate]);

  const waiting = isLoadingApi || !apiData;
  const totalValuation: number = apiData?.totalPortfolioValue ?? 0;
  const pendingDisposalsCount: number = apiData?.pendingDisposalsCount ?? 0;

  // Stacked column chart: the three campuses by status, as the server counted them.
  const locationStatusData = useMemo(() => {
    return (apiData?.locationStatusData ?? []).map((d: any) => ({
      location: `${CAMPUS_LABELS[d.location as keyof typeof CAMPUS_LABELS] ?? d.location} Campus`,
      AVAILABLE: d.AVAILABLE || 0,
      ON_LOAN: d.ON_LOAN || 0,
      MAINTENANCE: d.MAINTENANCE || 0,
    }));
  }, [apiData]);

  // Inspection reports per month, as the server counted them (empty when none is in the range).
  const auditComplianceData: { month: string; count: number }[] = apiData?.auditComplianceData ?? [];

  /** What a figure shows while the server has not answered: a pulse bar, or the failure message. */
  const waitingFor = (barClass: string) =>
    loadFailed
      ? <p className="text-xs font-semibold text-red-600 mt-2">Could not load. Reload the page.</p>
      : <div className={`${barClass} bg-muted/60 animate-pulse rounded-md mt-1`} />;

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible" className="space-y-6">
      {/* Date Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-muted/30 border border-border rounded-xl p-3">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">Dynamic Date Filters:</span>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground font-medium">From:</span>
          <input type="date" value={startDate} onChange={e => setStartDate && setStartDate(e.target.value)} className="bg-background border border-border rounded px-2 py-1 text-foreground font-semibold" />
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground font-medium">To:</span>
          <input type="date" value={endDate} onChange={e => setEndDate && setEndDate(e.target.value)} className="bg-background border border-border rounded px-2 py-1 text-foreground font-semibold" />
        </div>
        {(startDate || endDate) && (
          <button onClick={() => { setStartDate && setStartDate(""); setEndDate && setEndDate(""); }} className="text-xs font-bold text-red-600 hover:underline">
            Reset Date Filters
          </button>
        )}
      </div>

      {/* 1. KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Portfolio Value</p>
              {waiting ? waitingFor("h-9 w-40") : (
                <h2 className="text-3xl font-extrabold text-[#005A36] mt-1 font-mono">
                  ₱{totalValuation.toLocaleString()}
                </h2>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">Total value of the filtered assets</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-[#005A36]">
              <DollarSign size={28} />
            </div>
          </div>
        </Card>

        <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pending Disposal Items</p>
              {waiting ? waitingFor("h-9 w-28") : (
                <h2 className="text-3xl font-extrabold text-amber-600 mt-1 font-mono">
                  {pendingDisposalsCount} Items
                </h2>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">Filtered disposal requests waiting for your approval</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-amber-600">
              <AlertTriangle size={28} />
            </div>
          </div>
        </Card>
      </div>

      {/* 2. Expanded Full-Width Stacked Column Chart (Location vs Status) */}
      <Card className="border border-border bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#005A36]" /> Assets by Campus and Availability
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {waiting ? (
            <div className="h-72 w-full bg-muted/30 animate-pulse rounded-lg flex items-center justify-center text-xs text-muted-foreground">
              {loadFailed ? "Could not load the campus counts. Reload the page." : "Loading campus availability data..."}
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationStatusData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="location" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="AVAILABLE" stackId="statusStack" fill="#10B981" name="Available" />
                  <Bar dataKey="ON_LOAN" stackId="statusStack" fill="#F59E0B" name="On Loan" />
                  <Bar dataKey="MAINTENANCE" stackId="statusStack" fill="#EF4444" name="Maintenance" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {(startDate || endDate) && (
            <p className="text-[11px] text-muted-foreground mt-2">
              With a date range, only assets procured in the range are counted. An asset with no procurement date is left out.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3. Inspection reports per month */}
      <Card className="border border-border bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#005A36]" /> Inspection Reports per Month
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Inspection reports filed each month.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {waiting ? (
            <div className="h-64 w-full bg-muted/30 animate-pulse rounded-lg flex items-center justify-center text-xs text-muted-foreground">
              {loadFailed ? "Could not load the inspection reports. Reload the page." : "Loading inspection reports timeline..."}
            </div>
          ) : auditComplianceData.length === 0 ? (
            <div className="h-64 w-full flex items-center justify-center text-xs text-muted-foreground">
              No inspection reports in this range
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={auditComplianceData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#005A36" strokeWidth={3} dot={{ r: 5, fill: "#005A36" }} name="Asset Reports Logged" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 1. Funding Capital & Valuation Breakdown (Nested PieChart + Values Breakdown Side Panel)
/**
 * Asset value broken down by funding source, from the shared asset list.
 *
 * @param selectedLabFilter lab to scope to, or "All Labs"
 */
export const FundingValuationWidget: React.FC<DirectorAnalyticsProps> = ({ selectedLabFilter = "All Labs" }) => {
  const { assets: dbAssetsList } = useServerData();

  const filteredAssets = useMemo(() => {
    if (selectedLabFilter === "All Labs" || selectedLabFilter === "All") return dbAssetsList;
    const targetLab = selectedLabFilter.toLowerCase();
    return dbAssetsList.filter(a => {
      const assetLab = (a.lab || "").toLowerCase();
      const assetTag = (a.id || a.asset_tag || "").toLowerCase();
      return assetLab === targetLab || assetTag.startsWith(targetLab + "-");
    });
  }, [dbAssetsList, selectedLabFilter]);

  // Task 1: Group assets by funding source and sum their values
  const outer = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAssets.forEach(a => {
      const fund = a.funding || "DLSU University";
      const val = Number(a.cost || a.acquisition_value || 0);
      map[fund] = (map[fund] || 0) + val;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredAssets]);

  const inner = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAssets.forEach(a => {
      const cat = a.category || "General Equipment";
      const val = Number(a.cost || a.acquisition_value || 0);
      map[cat] = (map[cat] || 0) + val;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredAssets]);

  const totalValuation = outer.reduce((sum: number, item: any) => sum + Number(item.value || 0), 0);

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-[#005A36]" />
              <CardTitle className="text-sm font-bold text-foreground">
                Value by Funding Source
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground text-xs mt-0.5">
              Capital allocation breakdown showing total monetary valuation grouped by grant agency source (outer ring) and equipment category (inner ring).
            </CardDescription>
          </div>
          <Badge className="bg-[#005A36] text-white font-bold text-xs px-3 py-1">
            Total Capital: ₱{totalValuation.toLocaleString()}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left Column: Prominent Nested Pie Chart */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center bg-muted/10 rounded-xl p-4 border border-border">
              <div className="h-72 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={outer} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={70} paddingAngle={3}>
                      {outer.map((entry: any, index: number) => (
                        <Cell key={`outer-${index}`} fill={PIE_COLORS_OUTER[index % PIE_COLORS_OUTER.length]} />
                      ))}
                    </Pie>
                    <Pie data={inner} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={60}>
                      {inner.map((entry: any, index: number) => (
                        <Cell key={`inner-${index}`} fill={PIE_COLORS_INNER[index % PIE_COLORS_INNER.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `₱${Number(value).toLocaleString()}`} contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 mt-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#005A36] inline-block" /> Outer Ring: Grant Source
                </span>
                <span className="flex items-center gap-1 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#34D399] inline-block" /> Inner Ring: Category
                </span>
              </div>
            </div>

            {/* Right Column: Itemized Valuation Breakdown Values List */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <h4 className="text-xs font-extrabold text-[#005A36] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <DollarSign size={14} /> Grant Agency Capital Allocations (Outer Ring)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {outer.map((item: any, idx: number) => {
                    const pct = totalValuation ? ((item.value / totalValuation) * 100).toFixed(1) : "0";
                    const color = PIE_COLORS_OUTER[idx % PIE_COLORS_OUTER.length];
                    return (
                      <div key={idx} className="p-3 bg-muted/20 border border-border rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: color }} />
                          <div>
                            <span className="font-bold text-xs text-foreground block">{item.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{pct}% of total grant funding</span>
                          </div>
                        </div>
                        <span className="font-black text-xs text-foreground shrink-0">
                          ₱{Number(item.value).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider mb-2">
                  Equipment Category Sub-Allocations (Inner Ring)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {inner.map((item: any, idx: number) => {
                    const color = PIE_COLORS_INNER[idx % PIE_COLORS_INNER.length];
                    return (
                      <div key={idx} className="p-2.5 bg-card border border-border rounded-lg flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-medium text-foreground text-[11px] truncate max-w-[150px]">{item.name}</span>
                        </div>
                        <span className="font-bold text-foreground font-mono text-[11px]">
                          ₱{Number(item.value).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 7. Descriptive - Asset Utilization & Procurement Justifier (Maximizable Preview)
/**
 * Most and least used assets, from the shared asset and loan lists.
 *
 * @param selectedLabFilter lab to scope to, or "All Labs"
 */
export const TopUtilizationWidget: React.FC<DirectorAnalyticsProps> = ({ selectedLabFilter = "All Labs" }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const { assets: dbAssetsList, dbLoans } = useServerData();

  const filteredAssets = useMemo(() => {
    if (selectedLabFilter === "All Labs" || selectedLabFilter === "All") return dbAssetsList;
    const targetLab = selectedLabFilter.toLowerCase();
    return dbAssetsList.filter(a => {
      const assetLab = (a.lab || "").toLowerCase();
      const assetTag = (a.id || a.asset_tag || "").toLowerCase();
      return assetLab === targetLab || assetTag.startsWith(targetLab + "-");
    });
  }, [dbAssetsList, selectedLabFilter]);

  const topAssets = useMemo(() => {
    return filteredAssets.slice(0, 10).map((a, idx) => {
      const loanCount = (dbLoans || []).filter(l => l.asset_id === a.id || l.assetId === a.id || l.asset_tag === a.id || l.asset_tag === a.asset_tag).length;
      const calculatedBorrowCount = loanCount + (a.status === "ON_LOAN" ? 1 : 0);
      const borrowCount = Math.max(1, calculatedBorrowCount);
      return {
        assetId: a.id,
        assetName: a.name,
        assetTag: a.id,
        category: a.category,
        borrowCount
      };
    }).sort((a, b) => b.borrowCount - a.borrowCount);
  }, [filteredAssets, dbLoans]);

  const previewData = topAssets.slice(0, 3); // Compact Top 3 bars preview

  return (
    <>
      <motion.div variants={cardAnimation} initial="hidden" animate="visible">
        <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl flex flex-col justify-between h-full">
          <CardHeader className="pb-2 flex flex-row items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#005A36]" />
                <CardTitle className="text-sm font-bold text-foreground">
                  Asset Use
                </CardTitle>
              </div>
              <CardDescription className="text-muted-foreground text-xs mt-0.5">
                Top utilized assets ranking to justify upcoming procurement budget allocation.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMaximized(true)}
              className="text-xs gap-1 border-[#005A36]/30 text-[#005A36] hover:bg-emerald-50 font-bold shrink-0"
              title="Maximize window tab"
            >
              <Maximize2 size={13} /> Maximize Tab
            </Button>
          </CardHeader>

          <CardContent className="pt-0 pb-2">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={previewData} margin={{ top: 5, right: 20, left: 35, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                  <XAxis type="number" stroke="#64748B" fontSize={11} />
                  <YAxis type="category" dataKey="assetName" stroke="#64748B" fontSize={10} width={120} />
                  <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }} />
                  <Bar dataKey="borrowCount" fill="#005A36" radius={[0, 4, 4, 0]} name="Checkout / Loan Frequency" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>

          <div className="px-6 pb-4 pt-1 flex items-center justify-between border-t border-border text-xs">
            <span className="text-muted-foreground text-[11px]">Showing top 3 of {topAssets.length} tracked items</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMaximized(true)}
              className="text-xs text-[#005A36] hover:text-[#005A36]/80 font-bold p-0 h-auto gap-1"
            >
              View Full {topAssets.length}-Item Ranking <ExternalLink size={12} />
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Maximized Window Tab Dialog Modal */}
      <Dialog open={isMaximized} onOpenChange={setIsMaximized}>
        <DialogContent className="w-[96vw] max-w-7xl max-h-[92vh] overflow-y-auto bg-card border-border text-card-foreground rounded-2xl p-6 sm:p-8 shadow-2xl my-auto">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="text-base sm:text-lg font-extrabold text-[#005A36] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#005A36]" />
              Procurement Justifier — Complete {topAssets.length}-Item Asset Utilization Ranking
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Full institute-wide checkout frequency log used for university budget defense.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 my-3">
            <div className="h-64 bg-muted/20 p-3 rounded-xl border border-border">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={topAssets} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                  <XAxis type="number" stroke="#64748B" fontSize={11} />
                  <YAxis type="category" dataKey="assetName" stroke="#64748B" fontSize={10} width={175} />
                  <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }} />
                  <Bar dataKey="borrowCount" fill="#005A36" radius={[0, 4, 4, 0]} name="Checkout / Loan Frequency" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs font-bold text-foreground">Rank</TableHead>
                    <TableHead className="text-xs font-bold text-foreground">Asset Tag / Name</TableHead>
                    <TableHead className="text-xs font-bold text-foreground">Category</TableHead>
                    <TableHead className="text-xs font-bold text-foreground text-center">Loan Frequency</TableHead>
                    <TableHead className="text-right text-xs font-bold text-foreground">Procurement Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topAssets.map((item: any, index: number) => (
                    <TableRow key={item.assetId} className="border-b border-border text-xs">
                      <TableCell className="font-extrabold text-[#005A36]">#{index + 1}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div>{item.assetName}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{item.assetTag}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.category}</TableCell>
                      <TableCell className="text-center font-bold text-foreground">{item.borrowCount} Checkouts</TableCell>
                      <TableCell className="text-right">
                        <Badge className={index < 3 ? "bg-red-600 text-white font-bold" : index < 6 ? "bg-amber-600 text-white font-bold" : "bg-emerald-700 text-white font-bold"}>
                          {index < 3 ? "High Duplicate Demand (Procure More)" : index < 6 ? "Moderate Demand" : "Sufficient Capacity"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-3">
            <Button onClick={() => setIsMaximized(false)} className="bg-[#005A36] hover:bg-[#005A36]/90 text-white text-xs font-bold px-6">
              Close Window Tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Master AdRIC Director Dashboard Analytics View
/**
 * The Director's analytics screen: holds the lab and date filters and lays out four widgets
 * (macro and financial, funding, utilization). Takes no props.
 */
export const DirectorAnalyticsView: React.FC = () => {
  const [selectedLabFilter, setSelectedLabFilter] = useState<string>("All Labs");
  const [selectedTerm, setSelectedTerm] = useState<string>("AY 2025-2026 Term 2");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const { lookups } = useFormLookups();

  return (
    <div className="space-y-8 text-foreground font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#005A36]" />
            Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Value, funding, and use of assets across AdRIC.
          </p>
        </div>

        {/* Dynamic Lab & Term Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider pl-1">Lab Filter:</span>
            <select
              value={selectedLabFilter}
              onChange={e => setSelectedLabFilter(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 rounded px-2 py-1 text-slate-800 dark:text-slate-100"
            >
              <option value="All Labs">All Laboratories (DLSU Combined)</option>
              {(lookups?.labs ?? []).map(l => <option key={l.centerId} value={l.code}>{l.code} - {l.campusLabel}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider pl-1">Term Filter:</span>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 rounded px-2 py-1 text-slate-800 dark:text-slate-100"
            >
              <option value="AY 2025-2026 Term 2">AY 2025-2026 Term 2 (Current)</option>
              <option value="AY 2025-2026 Term 1">AY 2025-2026 Term 1</option>
              <option value="AY 2024-2025 Full Year">AY 2024-2025 Full Year</option>
              <option value="Custom Year Range">Custom Range (2023 - 2026)</option>
            </select>
          </div>

          <Badge variant="outline" className="border-[#005A36] text-[#005A36] bg-emerald-50 px-3 py-1 text-xs font-bold">
            Executive View
          </Badge>
        </div>
      </div>

      <InsightsPanel
        centerId={(lookups?.labs ?? []).find(l => l.code === selectedLabFilter)?.centerId ?? null}
      />

      <MacroFinancialSection
        selectedLabFilter={selectedLabFilter}
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
      />

      <FundingValuationWidget selectedLabFilter={selectedLabFilter} />


      <TopUtilizationWidget selectedLabFilter={selectedLabFilter} />

      <LoansPerWeekChart centerId={(lookups?.labs ?? []).find(l => l.code === selectedLabFilter)?.centerId ?? null} />
    </div>
  );
};

export default DirectorAnalyticsView;
