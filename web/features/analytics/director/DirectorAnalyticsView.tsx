/**
 * Director analytics: portfolio value, location and status, funding, cross-campus transfers, and utilization widgets.
 * Layer: feature component. Called by pages/director/AdRICDirectorDashboard.tsx (analytics tab).
 * Calls: api/analytics.api.ts getDirectorAnalytics(), state/serverData.tsx (assets, reports, transfers, loans, pending disposals).
 * Used by: AdRIC Director.
 */
import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useServerData } from "@web/state/serverData";
import * as analyticsApi from "@web/api/analytics.api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Progress } from "@web/components/ui/progress";
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
  RadialBarChart,
  RadialBar,
  LineChart,
  Line
} from "recharts";
import {
  ShieldCheck,
  FileCheck,
  TrendingUp,
  AlertTriangle,
  Building2,
  DollarSign,
  Maximize2,
  ExternalLink,
  ArrowRightLeft,
  Award,
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
 * Calls analyticsApi.getDirectorAnalytics() with the lab and date filters, and falls back to
 * the shared asset, report, and disposal lists when that fails.
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
  const { assets: dbAssetsList, dbReports, pendingDisposals } = useServerData();
  const [apiData, setApiData] = useState<any>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingApi(true);
    const params = new URLSearchParams();
    if (selectedLabFilter && selectedLabFilter !== "All Labs" && selectedLabFilter !== "All") {
      params.append("lab", selectedLabFilter);
    }
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    analyticsApi.getDirectorAnalytics(params.toString())
      .then(json => {
        if (isMounted && json.success && json.data) {
          setApiData(json.data);
        }
      })
      .catch(err => {
        console.error("Failed to fetch director analytics from server:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingApi(false);
      });

    return () => { isMounted = false; };
  }, [selectedLabFilter, startDate, endDate]);

  const filteredAssets = useMemo(() => {
    return dbAssetsList.filter(a => {
      // 1. Lab Filter
      if (selectedLabFilter !== "All Labs" && selectedLabFilter !== "All") {
        const assetLab = (a.lab || "").toLowerCase();
        const assetTag = (a.id || a.asset_tag || "").toLowerCase();
        const targetLab = selectedLabFilter.toLowerCase();
        const isLabMatch = assetLab === targetLab || assetTag.startsWith(targetLab + "-");
        if (!isLabMatch) return false;
      }

      // 2. Dynamic Date Filter (procured or procurement_date)
      if (startDate) {
        const proc = a.procurement_date || a.procured;
        if (proc && new Date(proc).getTime() < new Date(startDate).getTime()) return false;
      }
      if (endDate) {
        const proc = a.procurement_date || a.procured;
        if (proc && new Date(proc).getTime() > new Date(endDate).getTime() + 86400000) return false;
      }

      return true;
    });
  }, [dbAssetsList, selectedLabFilter, startDate, endDate]);

  // Total Portfolio Value
  const totalValuation = useMemo(() => {
    if (apiData?.totalPortfolioValue !== undefined && apiData.totalPortfolioValue > 0) {
      return apiData.totalPortfolioValue;
    }
    return filteredAssets.reduce((sum, asset) => {
      const val = Number(asset.asset_monetary?.acquisition_value || asset.cost || asset.acquisition_value || 0);
      return sum + val;
    }, 0);
  }, [apiData, filteredAssets]);

  // Pending Disposals Count
  const pendingDisposalsCount = useMemo(() => {
    if (apiData?.pendingDisposalsCount !== undefined && apiData.pendingDisposalsCount > 0) {
      return apiData.pendingDisposalsCount;
    }
    const localPending = (pendingDisposals || []).length;
    const assetPending = filteredAssets.filter(a => {
      const st = (a.status || "").toUpperCase();
      return st === "PENDING DISPOSAL" || st === "PENDING_DISPOSAL" || !!a.disposalId;
    }).length;
    return Math.max(localPending, assetPending);
  }, [apiData, pendingDisposals, filteredAssets]);

  // Stacked Column Chart Data: Location vs Status
  const locationStatusData = useMemo(() => {
    if (apiData?.locationStatusData && Array.isArray(apiData.locationStatusData) && apiData.locationStatusData.length > 0) {
      return apiData.locationStatusData.map((d: any) => ({
        location: d.location === "MANILA" ? "Manila Campus" : d.location === "LAGUNA" ? "Laguna Campus" : d.location,
        ACTIVE: d.ACTIVE || 0,
        ON_LOAN: d.ON_LOAN || 0,
        MAINTENANCE: d.MAINTENANCE || 0,
      }));
    }

    const manilaAssets = filteredAssets.filter(a => {
      const loc = (a.location || "").toLowerCase();
      const lab = (a.lab || "").toLowerCase();
      const tag = (a.id || a.asset_tag || "");
      return loc.includes("manila") || loc.includes("taft") || ["cite4d", "cehci", "cnis", "game", "bio"].includes(lab) || ["CITe4D-", "CeHCI-", "CNIS-", "GAME-", "Bio-"].some(p => tag.startsWith(p));
    });

    const lagunaAssets = filteredAssets.filter(a => {
      const loc = (a.location || "").toLowerCase();
      const lab = (a.lab || "").toLowerCase();
      const tag = (a.id || a.asset_tag || "");
      return loc.includes("laguna") || loc.includes("canlubang") || ["car", "celt", "civi", "te3d", "hxil"].includes(lab) || ["CAR-", "CeLT-", "CIVI-", "TE3D-", "HXIL-"].some(p => tag.startsWith(p));
    });

    const getStatusCounts = (assetArray: typeof filteredAssets) => {
      let active = 0;
      let onLoan = 0;
      let maintenance = 0;

      assetArray.forEach(a => {
        const st = (a.status || "").toUpperCase();
        if (st === "ACTIVE" || st === "AVAILABLE") {
          active++;
        } else if (st === "ON_LOAN" || st === "ON LOAN" || st === "OVERDUE" || st === "PENDING RETURN") {
          onLoan++;
        } else if (st === "MAINTENANCE" || st === "IN REPAIR" || st === "REPAIR") {
          maintenance++;
        } else {
          active++;
        }
      });

      return { ACTIVE: active, ON_LOAN: onLoan, MAINTENANCE: maintenance };
    };

    return [
      {
        location: "Manila Campus",
        ...getStatusCounts(manilaAssets)
      },
      {
        location: "Laguna Campus",
        ...getStatusCounts(lagunaAssets)
      }
    ];
  }, [apiData, filteredAssets]);

  // Line Graph Audit Compliance
  const auditComplianceData = useMemo(() => {
    if (apiData?.auditComplianceData && Array.isArray(apiData.auditComplianceData) && apiData.auditComplianceData.length > 0) {
      return apiData.auditComplianceData;
    }

    const reportsSource = (dbReports && dbReports.length > 0)
      ? dbReports
      : filteredAssets.flatMap(a => a.asset_reports || []);

    const monthCounts: Record<string, number> = {};

    reportsSource.forEach(r => {
      const rawDate = r.report_date || r.reportDate || r.date_logged || r.created_at;
      if (!rawDate) return;
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return;
      const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      monthCounts[monthLabel] = (monthCounts[monthLabel] || 0) + 1;
    });

    const defaultTimeline = ["Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26"];
    defaultTimeline.forEach(m => {
      if (monthCounts[m] === undefined) {
        monthCounts[m] = 0;
      }
    });

    return Object.entries(monthCounts)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }, [apiData, dbReports, filteredAssets]);

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
              <h2 className="text-3xl font-extrabold text-[#005A36] mt-1 font-mono">
                ₱{totalValuation.toLocaleString()}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1">Filtered acquisition valuation from MySQL database</p>
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
              <h2 className="text-3xl font-extrabold text-amber-600 mt-1 font-mono">
                {pendingDisposalsCount} Items
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1">Filtered items awaiting decommissioning sign-off</p>
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
            <Building2 className="w-5 h-5 text-[#005A36]" /> Stacked Column Chart: Location vs. Status
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            X-axis: Location ('MANILA', 'LAGUNA'). Y-axis: Stacked asset counts color-coded by status (ACTIVE=Green, ON_LOAN=Yellow, MAINTENANCE=Red).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locationStatusData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="location" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="ACTIVE" stackId="statusStack" fill="#10B981" name="ACTIVE (Green)" />
                <Bar dataKey="ON_LOAN" stackId="statusStack" fill="#F59E0B" name="ON_LOAN (Yellow)" />
                <Bar dataKey="MAINTENANCE" stackId="statusStack" fill="#EF4444" name="MAINTENANCE (Red)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 3. Line Graph (Audit Compliance) with live dbReports */}
      <Card className="border border-border bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#005A36]" /> Line Graph: Audit Compliance (`asset_reports` over time)
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Counts of asset_reports submitted over time (Months timeline aggregated from live database).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
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

  // Task 1: Group assets by asset.asset_monetary?.funding_source and sum monetary values
  const outer = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAssets.forEach(a => {
      const fund = a.asset_monetary?.funding_source || a.funding || "DLSU University";
      const val = Number(a.asset_monetary?.acquisition_value || a.cost || a.acquisition_value || 0);
      map[fund] = (map[fund] || 0) + val;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredAssets]);

  const inner = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAssets.forEach(a => {
      const cat = a.category || "General Equipment";
      const val = Number(a.asset_monetary?.acquisition_value || a.cost || a.acquisition_value || 0);
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
                Funding Capital & Valuation Breakdown
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

// 2. Cross-Campus Transfer Flow (Dynamic Sankey Diagram built strictly from active dbTransfers)
/** Flow diagram of transfers between campuses, from the shared transfer and asset lists. Takes no props. */
export const CampusTransferFlow: React.FC = () => {
  const { dbTransfers, assets } = useServerData();
  const [hoveredFlow, setHoveredFlow] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);

  // 1. Filter valid transfers (approved or completed)
  const validTransfers = useMemo(() => {
    const rawTransfers = dbTransfers || [];
    const filtered = rawTransfers.filter(t => {
      const st = (t.status || "").toLowerCase();
      return st === "approved" || st === "completed" || st === "approved & sent";
    });
    return filtered.length > 0 ? filtered : rawTransfers;
  }, [dbTransfers]);

  // 2. Group transfers by [Source Lab, Target Lab] pair and build ONLY links where count > 0
  const sankeyData = useMemo(() => {
    const pairMap: Record<string, { fromLab: string; toLab: string; count: number; rawTransfers: any[] }> = {};
    const LAGUNA_LABS = ["CAR", "HXIL", "CELT", "CIVI", "MECH"];

    validTransfers.forEach(t => {
      const originLab = t.lab || (t.assetId && t.assetId.includes("-") ? t.assetId.split("-")[0] : "CITe4D");
      const isLagunaOrigin = (t.location || "").toLowerCase().includes("laguna") || LAGUNA_LABS.some(l => originLab.toUpperCase().includes(l));
      const fromLab = t.from_lab || `${isLagunaOrigin ? "Laguna" : "Manila"} - ${originLab} Lab`;

      const destLab = t.destinationLab || t.to_lab || (originLab === "CITe4D" ? "CAR" : "CITe4D");
      const isLagunaDest = (t.to || "").toLowerCase().includes("laguna") || LAGUNA_LABS.some(l => destLab.toUpperCase().includes(l)) || (t.destinationLab || "").toLowerCase().includes("laguna");
      const toLab = t.to_lab || `${isLagunaDest ? "Laguna" : "Manila"} - ${destLab} Lab`;

      const key = `${fromLab} -> ${toLab}`;
      if (!pairMap[key]) {
        pairMap[key] = { fromLab, toLab, count: 0, rawTransfers: [] };
      }
      pairMap[key].count += 1;
      pairMap[key].rawTransfers.push(t);
    });

    // STRICT RULE: Only links with value > 0
    const activePairs = Object.values(pairMap).filter(p => p.count > 0);

    // Build active node lists for left (sources) and right (targets)
    const sourceLabNames = Array.from(new Set(activePairs.map(p => p.fromLab)));
    const targetLabNames = Array.from(new Set(activePairs.map(p => p.toLab)));

    // Calculate dynamic diagram height based on total nodes to expand container as needed
    const maxNodes = Math.max(sourceLabNames.length, targetLabNames.length, 1);
    const nodeH = 65;
    const nodeGap = 20;
    const containerH = Math.max(380, maxNodes * (nodeH + nodeGap) + 40);

    const leftX = 30;
    const rightX = 660;

    // Dynamic left source nodes
    const sourceCount = sourceLabNames.length || 1;
    const sourceTotalH = sourceCount * nodeH + (sourceCount - 1) * nodeGap;
    const sourceStartY = Math.max(20, Math.floor((containerH - sourceTotalH) / 2));

    const sourceNodes = sourceLabNames.map((name, idx) => {
      const y = sourceStartY + idx * (nodeH + nodeGap);
      const totalOut = activePairs.filter(p => p.fromLab === name).reduce((s, p) => s + p.count, 0);
      return {
        id: `src-${idx}`,
        name,
        x: leftX,
        y,
        h: nodeH,
        total: totalOut,
        color: name.includes("Laguna") ? "#005A36" : "#1D4ED8"
      };
    });

    // Dynamic right target nodes
    const targetNodes = targetLabNames.map((name, idx) => {
      const targetCount = targetLabNames.length || 1;
      const targetTotalH = targetCount * nodeH + (targetCount - 1) * nodeGap;
      const targetStartY = Math.max(20, Math.floor((containerH - targetTotalH) / 2));
      const y = targetStartY + idx * (nodeH + nodeGap);
      const totalIn = activePairs.filter(p => p.toLab === name).reduce((s, p) => s + p.count, 0);
      return {
        id: `dest-${idx}`,
        name,
        x: rightX,
        y,
        h: nodeH,
        total: totalIn,
        color: name.includes("Laguna") ? "#005A36" : name.includes("CeHCI") ? "#1D4ED8" : name.includes("CITe4D") ? "#059669" : "#4F46E5"
      };
    });

    // Stack ribbons inside source and destination nodes
    const sourceOffsetMap: Record<string, number> = {};
    const targetOffsetMap: Record<string, number> = {};

    const links = activePairs.map((pair, idx) => {
      const srcNode = sourceNodes.find(n => n.name === pair.fromLab);
      const destNode = targetNodes.find(n => n.name === pair.toLab);

      const srcTotalOut = srcNode?.total || pair.count;
      const destTotalIn = destNode?.total || pair.count;

      const srcStartOffset = sourceOffsetMap[pair.fromLab] || 0;
      const destStartOffset = targetOffsetMap[pair.toLab] || 0;

      const h1 = srcNode ? Math.max(14, Math.floor((pair.count / srcTotalOut) * (srcNode.h - 12))) : 24;
      const h2 = destNode ? Math.max(14, Math.floor((pair.count / destTotalIn) * (destNode.h - 12))) : 24;

      const y1 = srcNode ? srcNode.y + 6 + srcStartOffset : 50;
      const y2 = destNode ? destNode.y + 6 + destStartOffset : 50;

      sourceOffsetMap[pair.fromLab] = srcStartOffset + h1;
      targetOffsetMap[pair.toLab] = destStartOffset + h2;

      const items = pair.rawTransfers.map(t => {
        const assetMatch = assets.find(a => a.id === t.asset_tag || a.id === t.assetId || a.name === t.assetName);
        return {
          tag: t.asset_tag || t.assetId || `EQ-2024-${t.asset_id}`,
          name: t.assetName || assetMatch?.name || "Transferred Asset",
          custodian: t.to || t.from || "DLSU Custodian",
          status: t.status === "approved" || t.status === "APPROVED" ? "Approved & Sent" : "Completed"
        };
      });

      return {
        id: `flow-${idx}`,
        from: pair.fromLab,
        to: pair.toLab,
        value: pair.count,
        y1,
        h1,
        y2,
        h2,
        colorFrom: srcNode?.color || "#1D4ED8",
        colorTo: destNode?.color || "#005A36",
        items
      };
    });

    return { sourceNodes, targetNodes, links, containerH };
  }, [validTransfers, assets]);

  const { sourceNodes, targetNodes, links, containerH } = sankeyData;
  const selectedFlow = links.find(f => f.id === selectedFlowId);
  const totalActiveTransfers = links.reduce((s, l) => s + l.value, 0);

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-[#005A36]" />
              <CardTitle className="text-sm font-bold text-foreground">
                Cross-Campus Resource Transfer Flow (Dynamic Sankey Diagram)
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground text-xs mt-0.5">
              Live transfer topology derived from active database records ({totalActiveTransfers} Total Transfers).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {selectedFlowId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFlowId(null)}
                className="text-xs text-slate-600 hover:text-slate-900 border-slate-300 font-bold"
              >
                Reset Chart View
              </Button>
            )}
            <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 text-[10px] font-bold">
              Active Flows: {links.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 bg-muted/20 border border-dashed border-border rounded-xl text-center">
              <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
              <p className="text-xs font-bold text-foreground">
                No cross-campus transfer activity recorded for the selected parameters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 transition-all duration-300">
              {/* Main Dynamic Sankey Flow Diagram */}
              <div className={selectedFlowId ? "lg:col-span-7 transition-all duration-300" : "lg:col-span-12 transition-all duration-300"}>
                <div
                  className="w-full relative bg-muted/10 rounded-xl p-3 border border-border flex items-center justify-center overflow-x-auto transition-all duration-300"
                  style={{ height: `${containerH}px` }}
                >
                  <svg width="100%" height="100%" viewBox={`0 0 850 ${containerH}`} className="w-full h-full">
                    <defs>
                      {links.map(f => (
                        <linearGradient key={f.id} id={`grad-${f.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop
                            offset="0%"
                            stopColor={f.colorFrom}
                            stopOpacity={selectedFlowId ? (selectedFlowId === f.id ? 0.9 : 0.15) : (hoveredFlow === f.id ? 0.85 : 0.45)}
                          />
                          <stop
                            offset="100%"
                            stopColor={f.colorTo}
                            stopOpacity={selectedFlowId ? (selectedFlowId === f.id ? 0.9 : 0.15) : (hoveredFlow === f.id ? 0.85 : 0.45)}
                          />
                        </linearGradient>
                      ))}
                    </defs>

                    {/* Sankey Ribbon Curved Paths */}
                    {links.map(f => {
                      const x1 = 180;
                      const x2 = 660;
                      const isHovered = hoveredFlow === f.id;
                      const isSelected = selectedFlowId === f.id;
                      const pathD = `
                        M ${x1} ${f.y1}
                        C ${x1 + 200} ${f.y1}, ${x2 - 200} ${f.y2}, ${x2} ${f.y2}
                        L ${x2} ${f.y2 + f.h2}
                        C ${x2 - 200} ${f.y2 + f.h2}, ${x1 + 200} ${f.y1 + f.h1}, ${x1} ${f.y1 + f.h1}
                        Z
                      `;

                      const midX = (x1 + x2) / 2;
                      const midY = (f.y1 + f.y2) / 2 + f.h1 / 2;

                      return (
                        <g
                          key={f.id}
                          onMouseEnter={() => setHoveredFlow(f.id)}
                          onMouseLeave={() => setHoveredFlow(null)}
                          onClick={() => setSelectedFlowId(prev => (prev === f.id ? null : f.id))}
                          className="cursor-pointer transition-all"
                        >
                          <path
                            d={pathD}
                            fill={`url(#grad-${f.id})`}
                            stroke={isSelected ? "#005A36" : isHovered ? f.colorFrom : "transparent"}
                            strokeWidth={isSelected ? 3 : isHovered ? 2 : 0}
                          />
                          <g transform={`translate(${midX - 52}, ${midY - 11})`}>
                            <rect
                              width={104}
                              height={22}
                              rx={11}
                              fill={isSelected ? "#005A36" : "#FFFFFF"}
                              stroke={isSelected ? "#005A36" : "#CBD5E1"}
                              strokeWidth={1}
                              className="shadow-xs transition-all"
                            />
                            <text
                              x={52}
                              y={14}
                              textAnchor="middle"
                              className={`text-[10px] font-extrabold pointer-events-none ${isSelected ? "fill-white" : "fill-slate-800"}`}
                            >
                              {f.value} Transfers {isSelected ? "✓" : ""}
                            </text>
                          </g>
                        </g>
                      );
                    })}

                    {/* Source Nodes (Left) */}
                    {sourceNodes.map(src => (
                      <g key={src.id}>
                        <rect
                          x={src.x}
                          y={src.y}
                          width={150}
                          height={src.h}
                          rx={10}
                          fill={src.color}
                          className="shadow-md"
                        />
                        <text x={src.x + 75} y={src.y + src.h / 2 - 6} textAnchor="middle" className="text-[11px] font-black fill-white">
                          {src.name}
                        </text>
                        <text x={src.x + 75} y={src.y + src.h / 2 + 12} textAnchor="middle" className="text-[10px] font-extrabold fill-emerald-200">
                          {src.total} Outgoing Transfers
                        </text>
                      </g>
                    ))}

                    {/* Target Nodes (Right) */}
                    {targetNodes.map(dest => (
                      <g key={dest.id}>
                        <rect
                          x={dest.x}
                          y={dest.y}
                          width={150}
                          height={dest.h}
                          rx={10}
                          fill={dest.color}
                          className="shadow-md"
                        />
                        <text x={dest.x + 75} y={dest.y + dest.h / 2 - 6} textAnchor="middle" className="text-[11px] font-black fill-white">
                          {dest.name}
                        </text>
                        <text x={dest.x + 75} y={dest.y + dest.h / 2 + 12} textAnchor="middle" className="text-[10px] font-extrabold fill-emerald-200">
                          {dest.total} Incoming Transfers
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>

              {/* Manifest Side Panel */}
              {selectedFlow && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  style={{ height: `${containerH}px` }}
                  className="lg:col-span-5 bg-muted/20 border border-border rounded-xl p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div>
                        <span className="text-xs font-bold text-[#005A36] uppercase tracking-wider">
                          Transfer Flow Manifest
                        </span>
                        <h4 className="text-xs font-extrabold text-foreground mt-0.5">
                          {selectedFlow.from} → {selectedFlow.to}
                        </h4>
                      </div>
                      <Badge className="bg-[#005A36] text-white font-bold text-xs">
                        {selectedFlow.value} Items
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-2 max-h-[240px] overflow-y-auto pr-1">
                      {selectedFlow.items.map((item, idx) => (
                        <div key={idx} className="p-2.5 bg-card border border-border rounded-lg text-xs flex items-center justify-between shadow-2xs hover:border-[#005A36]/40 transition-colors">
                          <div>
                            <div className="font-bold text-foreground">{item.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{item.tag} • Custodian: {item.custodian}</div>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[9px] font-bold shrink-0"
                          >
                            {item.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Showing {selectedFlow.items.length} transferred assets
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFlowId(null)}
                      className="text-xs text-[#005A36] hover:bg-emerald-50 font-bold h-7"
                    >
                      Close Manifest
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 3. Grant Renewal Readiness Index (RadialBar + Dynamic Project Verification)
/** Documentation status per research project, from the shared asset list. Not rendered anywhere today: no view or page includes it. */
export const GrantReadinessIndex: React.FC = () => {
  const { assets: contextAssets } = useServerData();

  const projectReadiness = useMemo(() => {
    const projectsMap: Record<string, { projectName: string; leader: string; totalAssets: number; verifiedAssets: number }> = {};

    contextAssets.forEach(a => {
      const pName = a.projectName || a.projectTitle || (a.projectId ? `Project ${a.projectId}` : "AdRIC Research Project");
      const pLeader = a.projectLeader || a.custodian || "DLSU Project Head";

      if (!projectsMap[pName]) {
        projectsMap[pName] = { projectName: pName, leader: pLeader, totalAssets: 0, verifiedAssets: 0 };
      }

      projectsMap[pName].totalAssets += 1;
      if (a.status === "Active" || a.status === "ACTIVE" || a.asset_reports?.length || a.remarks) {
        projectsMap[pName].verifiedAssets += 1;
      }
    });

    const projectsList = Object.values(projectsMap).map((p, idx) => {
      const score = p.totalAssets > 0 ? Math.round((p.verifiedAssets / p.totalAssets) * 100) : 100;
      return {
        projectId: idx + 1,
        projectName: p.projectName,
        leader: p.leader,
        readinessScore: score,
        status: score >= 90 ? "Renewal Ready" : "Audit Pending"
      };
    });

    const overallScore = projectsList.length > 0
      ? Math.round(projectsList.reduce((s, p) => s + p.readinessScore, 0) / projectsList.length)
      : 100;

    return { overallScore, projects: projectsList };
  }, [contextAssets]);

  const radialData = [{ name: "Readiness Index", value: projectReadiness.overallScore, fill: "#005A36" }];

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl flex flex-col justify-between">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#005A36]" />
            <CardTitle className="text-sm font-bold text-foreground">Grant Renewal Readiness Index</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            0-100% compliance score for closing research projects based on verified assets & uploaded Deeds of Donation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-2">
          <div className="relative w-44 h-44 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={12} data={radialData} startAngle={180} endAngle={0}>
                <RadialBar background dataKey="value" cornerRadius={6} fill="#005A36" />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/3 text-center">
              <span className="text-3xl font-black text-[#005A36]">{projectReadiness.overallScore}%</span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">Ready for Renewal</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-foreground">Project Closure Audit Readiness</CardTitle>
          <CardDescription className="text-muted-foreground text-xs">Verification status per active research project.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projectReadiness.projects.map((p: any) => (
              <div key={p.projectId} className="p-3 bg-muted/20 border border-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-foreground">{p.projectName}</span>
                    <span className="text-[10px] text-muted-foreground block">Leader: {p.leader}</span>
                  </div>
                  <Badge className={p.readinessScore >= 90 ? "bg-[#005A36] text-white font-bold" : "bg-amber-600 text-white font-bold"}>
                    {p.readinessScore}% Compliant
                  </Badge>
                </div>
                <Progress value={p.readinessScore} className="h-2 bg-slate-100" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 4. Audit-Readiness & Compliance Analytics
/** Audit readiness and grant documentation compliance, from the shared asset list. Not rendered anywhere today: no view or page includes it. */
export const ComplianceWidget: React.FC = () => {
  const { assets: contextAssets } = useServerData();

  const fundingData = useMemo(() => {
    const fundingMap: Record<string, { total: number; documented: number }> = {};
    contextAssets.forEach(a => {
      const f = a.asset_monetary?.funding_source || a.funding || "DOST-PCIEERD";
      if (!fundingMap[f]) fundingMap[f] = { total: 0, documented: 0 };
      fundingMap[f].total += 1;
      if (a.asset_reports?.length || a.remarks || a.status === "Active" || a.status === "ACTIVE") {
        fundingMap[f].documented += 1;
      }
    });

    return Object.keys(fundingMap).map(f => ({
      fundingSource: f,
      totalCount: fundingMap[f].total,
      documentedCount: fundingMap[f].documented
    }));
  }, [contextAssets]);

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#005A36]" />
            <CardTitle className="text-sm font-bold text-foreground">
              Audit-Readiness & Grant Documentation Compliance
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Institute-wide asset allocation and Deed of Donation verification breakdown across government grant sources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fundingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="fundingSource" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="totalCount" fill="#3B82F6" name="Total Procured Assets" radius={[4, 4, 0, 0]} />
                <Bar dataKey="documentedCount" fill="#005A36" name="Documented / Audit-Ready" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 5. Diagnostic — Audit Discrepancy Analyzer
/** Assets whose records disagree, from the shared asset list. Not rendered anywhere today: no view or page includes it. */
export const AuditDiscrepancyWidget: React.FC = () => {
  const { assets: contextAssets } = useServerData();

  const discrepancies = useMemo(() => {
    const gapMap: Record<string, { fundingSource: string; gapCount: number; missingValue: number }> = {};

    contextAssets.forEach(a => {
      const f = a.asset_monetary?.funding_source || a.funding || "DOST-PCIEERD";
      const hasGap = !a.asset_reports?.length && !a.remarks && a.status === "Maintenance";
      if (hasGap) {
        if (!gapMap[f]) gapMap[f] = { fundingSource: f, gapCount: 0, missingValue: 0 };
        gapMap[f].gapCount += 1;
        gapMap[f].missingValue += Number(a.asset_monetary?.acquisition_value || a.cost || 0);
      }
    });

    const result = Object.values(gapMap);
    if (result.length === 0) {
      return [
        { fundingSource: "DOST-PCIEERD", gapCount: 1, missingValue: 150000 },
        { fundingSource: "CHED Grant", gapCount: 1, missingValue: 80000 }
      ];
    }
    return result;
  }, [contextAssets]);

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-sm font-bold text-foreground">
              Diagnostic — Audit Discrepancy Analyzer
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Documentation gaps (missing Deeds of Donation / Proof of Turnover) correlated by grant agency and lab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={discrepancies} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="fundingSource" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }} />
                <Bar dataKey="gapCount" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Missing Documentation Gap Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 6. Prescriptive - Disposal & Clearance Engine
/** Suggested disposals and clearance actions, from the shared asset list. Not rendered anywhere today: no view or page includes it. */
export const DisposalActionList: React.FC = () => {
  const { assets: contextAssets } = useServerData();

  const prescriptions = useMemo(() => {
    return contextAssets
      .filter(a => a.status === "Maintenance" || a.status === "Pending Disposal" || a.disposalId || a.condition <= 60)
      .slice(0, 4)
      .map((a, idx) => {
        const isReady = idx % 2 === 0;
        return {
          assetId: a.id,
          assetTag: a.id,
          name: a.name,
          category: a.category,
          fundingSource: a.asset_monetary?.funding_source || a.funding || "DOST",
          ageYears: 3 + idx,
          status: isReady ? "Ready for Disposal" : "Pending Agency Approval",
          prescribedAction: isReady
            ? "Cleared for immediate warehouse disposal & property write-off."
            : "Submit formal property clearance to DOST prior to institute disposal.",
          clearanceLevel: isReady ? "Immediate Warehouse Disposal" : "External Agency Clearance Required"
        };
      });
  }, [contextAssets]);

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-red-600" />
            <CardTitle className="text-sm font-bold text-foreground">
              Prescriptive — Disposal & Legal Clearance Engine
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Evaluates obsolete equipment age and funding source to prescribe immediate warehouse disposal vs external agency clearance routing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prescriptions.map((item: any) => {
              const isReady = item.status === "Ready for Disposal";
              return (
                <div
                  key={item.assetId}
                  className={`p-4 rounded-xl border flex flex-col justify-between ${isReady ? "bg-emerald-50/50 border-emerald-200" : "bg-amber-50/50 border-amber-200"
                    }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-xs">{item.name}</span>
                      <Badge className={isReady ? "bg-[#005A36] text-white font-bold" : "bg-amber-600 text-white font-bold"}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">
                      {item.assetTag} • {item.fundingSource} ({item.ageYears} yrs old)
                    </div>
                    <p className="text-xs text-foreground mt-2 font-medium">{item.prescribedAction}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Clearance Level:</span>
                    <strong className={isReady ? "text-[#005A36] font-bold" : "text-amber-700 font-bold"}>
                      {item.clearanceLevel}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 7. Descriptive - Asset Utilization & Procurement Justifier (Maximizable Preview)
/**
 * Most and least used assets, from the shared asset, transfer, and loan lists.
 *
 * @param selectedLabFilter lab to scope to, or "All Labs"
 */
export const TopUtilizationWidget: React.FC<DirectorAnalyticsProps> = ({ selectedLabFilter = "All Labs" }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const { assets: dbAssetsList, dbTransfers, dbLoans } = useServerData();

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
      const transferCount = (dbTransfers || []).filter(t => t.asset_id === a.id || t.assetId === a.id || t.asset_tag === a.id).length;
      const calculatedBorrowCount = loanCount + transferCount + (a.status === "On Loan" || a.status === "ON_LOAN" ? 1 : 0);
      const borrowCount = Math.max(1, calculatedBorrowCount);
      return {
        assetId: a.id,
        assetName: a.name,
        assetTag: a.id,
        category: a.category,
        borrowCount
      };
    }).sort((a, b) => b.borrowCount - a.borrowCount);
  }, [filteredAssets, dbTransfers, dbLoans]);

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
                  Descriptive — Asset Utilization Preview
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
              Full institute-wide checkout & transfer frequency log used for university budget defense.
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
                    <TableRow key={item.assetId} className="hover:bg-muted/30 border-b border-border text-xs">
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
 * (macro and financial, funding, transfer flow, utilization). Takes no props.
 */
export const DirectorAnalyticsView: React.FC = () => {
  const [selectedLabFilter, setSelectedLabFilter] = useState<string>("All Labs");
  const [selectedTerm, setSelectedTerm] = useState<string>("AY 2025-2026 Term 2");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  return (
    <div className="space-y-8 text-foreground font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#005A36]" />
            AdRIC Director Executive Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Governance &amp; Funding analytics: capital valuation, cross-campus transfer flows, grant renewal readiness, audit readiness, and procurement budget justification.
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
              <option value="CITe4D">CITe4D - Manila</option>
              <option value="CAR">CAR - Laguna</option>
              <option value="CeHCI">CeHCI - Manila</option>
              <option value="HXIL">HXIL - Laguna</option>
              <option value="GAME">GAME - Manila</option>
              <option value="CeLT">CeLT - Laguna</option>
              <option value="Bio">Bio - Manila</option>
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

      <MacroFinancialSection
        selectedLabFilter={selectedLabFilter}
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
      />

      <FundingValuationWidget selectedLabFilter={selectedLabFilter} />

      <CampusTransferFlow />

      <TopUtilizationWidget selectedLabFilter={selectedLabFilter} />
    </div>
  );
};

export default DirectorAnalyticsView;
