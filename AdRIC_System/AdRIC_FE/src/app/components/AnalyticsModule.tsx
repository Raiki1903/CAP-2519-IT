import { useState, useEffect } from "react";
import { useApp, type Asset, type RepairRequest, type InspectionReport } from "../context";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { cn } from "./ui/utils";
import { diagnoseAsset, recommendAction, synthesizeDiagnosticInsight, synthesizePrescriptiveInsight } from "../lib/analyticsReasoning";
import {
  TrendingUp, AlertTriangle, ShieldCheck, DollarSign, Settings,
  Wrench, Activity, BarChart3, HelpCircle, ArrowRight,
  ClipboardCheck, Clock, Layers, Users, PackageCheck, PackageX, Repeat2, TrendingDown, Lightbulb, Brain, Table2
} from "lucide-react";

type ViewMode = "graph" | "simple";

// Small per-card control that lets the user flip a data category between its chart rendering and a plain table.
function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
      <button
        type="button"
        onClick={() => onChange("graph")}
        title="Graph view"
        aria-pressed={mode === "graph"}
        className={cn("p-1.5 rounded-md transition-colors", mode === "graph" ? "bg-white shadow-sm text-[#005A36]" : "text-slate-400 hover:text-slate-600")}
      >
        <BarChart3 size={12} />
      </button>
      <button
        type="button"
        onClick={() => onChange("simple")}
        title="Simple view"
        aria-pressed={mode === "simple"}
        className={cn("p-1.5 rounded-md transition-colors", mode === "simple" ? "bg-white shadow-sm text-[#005A36]" : "text-slate-400 hover:text-slate-600")}
      >
        <Table2 size={12} />
      </button>
    </div>
  );
}

// Part-to-whole: one bar, colored segments, always sums to 100%. Preferred over a pie/donut —
// length is easier to judge accurately than angle, and it scales past 2-3 categories cleanly.
function StackedBar({ segments }: { segments: { label: string; count: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.count, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="w-full h-6 rounded-md overflow-hidden flex bg-slate-100">
        {segments.filter(s => s.count > 0).map(seg => (
          <div
            key={seg.label}
            className={cn("h-full first:rounded-l-md last:rounded-r-md", seg.color)}
            style={{ width: `${(seg.count / total) * 100}%` }}
            title={`${seg.label}: ${seg.count} (${Math.round((seg.count / total) * 100)}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
            <span className={cn("w-2.5 h-2.5 rounded-sm flex-shrink-0", seg.color)} />
            {seg.label}: <span className="font-bold text-slate-800">{seg.count}</span>
            <span className="text-slate-400">({Math.round((seg.count / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Benchmark an actual value against a target, inside qualitative bands (Stephen Few bullet-graph pattern).
function BulletBar({ value, target, max, zones, valueSuffix = "" }: {
  value: number; target: number; max: number; zones: { end: number; color: string }[]; valueSuffix?: string;
}) {
  const pct = (v: number) => Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div className="relative w-full h-5 rounded-md overflow-hidden bg-slate-100">
      {zones.map((z, i) => {
        const prevEnd = i === 0 ? 0 : zones[i - 1].end;
        return (
          <div
            key={i}
            className={cn("absolute top-0 bottom-0", z.color)}
            style={{ left: `${pct(prevEnd)}%`, width: `${pct(z.end) - pct(prevEnd)}%` }}
          />
        );
      })}
      <div
        className="absolute top-1/2 -translate-y-1/2 left-0 h-2 rounded-r-sm bg-slate-800"
        style={{ width: `${pct(value)}%` }}
        title={`Actual: ${value}${valueSuffix}`}
      />
      <div
        className="absolute top-0.5 bottom-0.5 w-0.5 bg-red-600"
        style={{ left: `${pct(target)}%` }}
        title={`Target: ${target}${valueSuffix}`}
      />
    </div>
  );
}

// A single floating bridge segment — the minimal building block of a waterfall chart: where a
// value started, where it ended, and whether the step was a gain or a loss.
function WaterfallStep({ from, to, max = 100 }: { from: number; to: number; max?: number }) {
  const lo = Math.min(from, to), hi = Math.max(from, to);
  const isUp = to >= from;
  const pct = (v: number) => Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div className="space-y-1">
      <div className="relative w-full h-4 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn("absolute top-0 bottom-0 rounded-full", isUp ? "bg-emerald-500" : "bg-red-500")}
          style={{ left: `${pct(lo)}%`, width: `${Math.max(2, pct(hi) - pct(lo))}%` }}
        />
        <div className="absolute top-0 bottom-0 w-0.5 bg-slate-500" style={{ left: `${pct(from)}%` }} title={`Start: ${from}%`} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-slate-900" style={{ left: `${pct(to)}%` }} title={`End: ${to}%`} />
      </div>
      <div className="flex justify-between text-[9px] text-slate-500 font-mono">
        <span>Start {from}%</span>
        <span className={cn("font-bold", isUp ? "text-emerald-700" : "text-red-700")}>{isUp ? "+" : ""}{to - from} pts</span>
        <span>End {to}%</span>
      </div>
    </div>
  );
}

// Slice-and-dice treemap: recursively splits a rectangle by value share, alternating the cut axis.
// Simpler than a squarified layout, but a correct treemap — tile AREA (not length) encodes value.
interface TreemapInput { key: string; value: number; }
interface TreemapTile extends TreemapInput { x: number; y: number; w: number; h: number; }
function computeTreemap(items: TreemapInput[], x = 0, y = 0, w = 100, h = 100, horizontal = true): TreemapTile[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], x, y, w, h }];
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  let acc = 0, splitIdx = 1;
  const half = total / 2;
  for (let i = 0; i < items.length; i++) {
    acc += items[i].value;
    if (acc >= half) { splitIdx = i + 1; break; }
  }
  splitIdx = Math.max(1, Math.min(items.length - 1, splitIdx));
  const left = items.slice(0, splitIdx), right = items.slice(splitIdx);
  const leftFrac = left.reduce((s, i) => s + i.value, 0) / total;
  if (horizontal) {
    const w1 = w * leftFrac;
    return [...computeTreemap(left, x, y, w1, h, false), ...computeTreemap(right, x + w1, y, w - w1, h, false)];
  }
  const h1 = h * leftFrac;
  return [...computeTreemap(left, x, y, w, h1, true), ...computeTreemap(right, x, y + h1, w, h - h1, true)];
}

export function AnalyticsModule() {
  const { assets: allAssets, repairRequests: allRepairs, inspections: allInspections, transfers: allTransfers, addRepairRequest, role } = useApp();
  const [activeTier, setActiveTier] = useState<"descriptive" | "diagnostic" | "prescriptive">("descriptive");
  const [selectedAssetId, setSelectedAssetId] = useState<string>("EQ-2024-004");
  const [whatIfDelay, setWhatIfDelay] = useState<number>(6); // months

  // Per-widget graph/simple view toggles
  const [fleetStatusView, setFleetStatusView] = useState<ViewMode>("graph");
  const [ageView, setAgeView] = useState<ViewMode>("graph");
  const [healthBreakdownView, setHealthBreakdownView] = useState<ViewMode>("graph");
  const [healthTrendView, setHealthTrendView] = useState<ViewMode>("graph");
  const [rootCauseView, setRootCauseView] = useState<ViewMode>("graph");
  const [costCorrelationView, setCostCorrelationView] = useState<ViewMode>("simple");
  const [dispatchView, setDispatchView] = useState<ViewMode>("simple");
  const [budgetView, setBudgetView] = useState<ViewMode>("simple");
  const [hoveredHistIdx, setHoveredHistIdx] = useState<number | null>(null);

  // 1. Role filtering logic - Lab Head only has access to CITe4D equipment
  const isLabHead = role === "LabHead";
  const targetLab = "CITe4D";

  const assets = isLabHead 
    ? allAssets.filter(a => a.lab === targetLab) 
    : allAssets;

  const repairRequests = isLabHead
    ? allRepairs.filter(r => {
        const asset = allAssets.find(a => a.id === r.assetId);
        return asset && asset.lab === targetLab;
      })
    : allRepairs;

  const inspections = isLabHead
    ? allInspections.filter(i => {
        const asset = allAssets.find(a => a.id === i.assetId);
        return asset && asset.lab === targetLab;
      })
    : allInspections;

  const transfers = isLabHead
    ? allTransfers.filter(t => t.lab === targetLab)
    : allTransfers;

  // Sync selected asset state to a valid ID when list changes
  useEffect(() => {
    if (assets.length > 0 && !assets.some(a => a.id === selectedAssetId)) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  // Helper: check if asset has multiple inspections
  const getAssetInspections = (assetId: string) => {
    return inspections
      .filter(i => i.assetId === assetId)
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  };

  const statusScoreMap: Record<string, number> = {
    "Perfect": 100,
    "Operational": 90,
    "Minor Drift": 78,
    "Degraded Performance": 60,
    "Critical Failure": 35,
  };

  // Early return if loading database
  if (allAssets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <Activity size={24} className="text-[#10B981] animate-pulse" />
        <p className="text-xs text-muted-foreground font-semibold">Loading predictive analytics records...</p>
      </div>
    );
  }

  // Early return if no branch assets exist (for this Lab Head)
  if (assets.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-slate-200/50 rounded-xl bg-slate-50/50">
        <p className="text-xs text-muted-foreground font-semibold">No active equipment assets are registered under CITe4D research center.</p>
      </div>
    );
  }

  // Find selected asset (guaranteed to exist because assets.length > 0)
  const selectedAsset = assets.find(a => a.id === selectedAssetId) || assets[0];

  // ---------------------------------------------------------
  // TIER 1: DESCRIPTIVE CALCULATIONS
  // ---------------------------------------------------------
  const totalAssets = assets.length;
  
  // Statuses
  const activeCount = assets.filter(a => a.status === "Active" || a.status === "Available").length;
  const loanCount = assets.filter(a => a.status === "On Loan").length;
  const maintenanceCount = assets.filter(a => a.status === "Maintenance" || a.status === "In Repair").length;
  const disposedCount = assets.filter(a => a.status === "Disposed").length;

  // Conditions
  const healthyCount = assets.filter(a => a.condition >= 80 && a.status !== "Disposed").length;
  const warningCount = assets.filter(a => a.condition >= 50 && a.condition < 80 && a.status !== "Disposed").length;
  const criticalCount = assets.filter(a => a.condition < 50 && a.status !== "Disposed").length;

  // Averages
  const avgHealth = Math.round(assets.reduce((sum, a) => sum + (a.condition || 0), 0) / (totalAssets || 1));

  // Avg by Category
  const categories = Array.from(new Set(assets.map(a => a.category)));
  const categoryStats = categories.map(cat => {
    const catAssets = assets.filter(a => a.category === cat);
    const avg = Math.round(catAssets.reduce((sum, a) => sum + (a.condition || 0), 0) / (catAssets.length || 1));
    return { name: cat, avg, count: catAssets.length };
  });

  // Avg by Lab
  const labs = Array.from(new Set(assets.map(a => a.lab)));
  const labStats = labs.map(lab => {
    const labAssets = assets.filter(a => a.lab === lab);
    const avg = Math.round(labAssets.reduce((sum, a) => sum + (a.condition || 0), 0) / (labAssets.length || 1));
    return { name: lab, avg, count: labAssets.length };
  });

  // Age calculation and Expected Service Life
  // We assume Current Year = 2026 based on metadata
  const getExpectedLife = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes("robot") || cat.includes("simulator")) return 7;
    if (cat.includes("vr") || cat.includes("tablet")) return 3;
    return 5; // CPU, Server, Camera, Switch default to 5
  };

  const ageData = assets.map(a => {
    const procuredYear = a.procured ? new Date(a.procured).getFullYear() : 2024;
    const age = Math.max(0, 2026 - procuredYear);
    const expected = getExpectedLife(a.category);
    return { id: a.id, name: a.name, category: a.category, age, expected };
  });

  // Per-category actual-age-vs-expected-service-life benchmark, feeds the bullet chart view
  const categoryAgeBullets = Array.from(new Set(ageData.map(d => d.category))).map(cat => {
    const catAgeData = ageData.filter(d => d.category === cat);
    const avgAge = Math.round((catAgeData.reduce((sum, d) => sum + d.age, 0) / (catAgeData.length || 1)) * 10) / 10;
    const expected = getExpectedLife(cat);
    return { category: cat, avgAge, expected, count: catAgeData.length };
  });

  // Compliance (condition >= 70)
  const complianceRate = Math.round(
    (assets.filter(a => a.condition >= 70 && a.status !== "Disposed").length /
     (assets.filter(a => a.status !== "Disposed").length || 1)) * 100
  );

  // Currently In-Use vs. Vacant/Available snapshot
  const inUseStatuses = ["On Loan", "Reserved", "Partially Deployed", "Pending Return", "Overdue"];
  const inUseCount = assets.filter(a => inUseStatuses.includes(a.status)).length;
  const vacantCount = assets.filter(a => a.status === "Active" || a.status === "Available").length;
  const deployableAssets = assets.filter(a => a.status !== "Disposed").length;
  const utilizationRate = Math.round((inUseCount / (deployableAssets || 1)) * 100);

  // Asset usage frequency — derived from approved custodianship transfer/deployment history
  const usageRanking = assets
    .filter(a => a.status !== "Disposed")
    .map(a => ({
      id: a.id,
      name: a.name,
      lab: a.lab,
      category: a.category,
      status: a.status,
      timesDeployed: transfers.filter(t => t.assetId === a.id && t.status === "Approved").length
    }))
    .sort((a, b) => b.timesDeployed - a.timesDeployed);

  const mostUsedAssets = usageRanking.slice(0, 5);
  const leastUsedAssets = [...usageRanking].sort((a, b) => a.timesDeployed - b.timesDeployed).slice(0, 5);

  // ---------------------------------------------------------
  // TIER 2: DIAGNOSTIC CALCULATIONS
  // ---------------------------------------------------------
  
  // Failure / issue clustering (Root causes parsed from repair requests)
  const rootCauses = {
    Battery: 0,
    Mechanical: 0,
    Thermal: 0,
    Storage: 0,
    Other: 0
  };
  repairRequests.forEach(r => {
    const desc = r.description.toLowerCase();
    if (desc.includes("battery") || desc.includes("power")) rootCauses.Battery++;
    else if (desc.includes("joint") || desc.includes("drift") || desc.includes("calibration") || desc.includes("encoder")) rootCauses.Mechanical++;
    else if (desc.includes("thermal") || desc.includes("temperature") || desc.includes("cooling") || desc.includes("fan")) rootCauses.Thermal++;
    else if (desc.includes("storage") || desc.includes("ssd") || desc.includes("disk") || desc.includes("sector")) rootCauses.Storage++;
    else rootCauses.Other++;
  });

  // Correlation: Acquisition Cost vs. Maintenance Count
  const costCorrelation = assets.map(a => {
    const repairCount = repairRequests.filter(r => r.assetId === a.id).length;
    return { name: a.name, cost: a.cost || 0, repairs: repairCount };
  }).filter(c => c.cost > 0);

  // Helper: full rule-based diagnosis for any asset (health deviation + likely root cause + confidence)
  const getAssetDiagnosis = (a: Asset) => {
    const peerAvg = categoryStats.find(cs => cs.name === a.category)?.avg || 85;
    const aRepairs = repairRequests.filter(r => r.assetId === a.id);
    const aInspections = getAssetInspections(a.id);
    return diagnoseAsset(a, peerAvg, aRepairs, aInspections);
  };

  // Anomaly Detection: Health score significantly below peer average (> 20 points drop)
  const anomalies = assets
    .filter(a => a.status !== "Disposed")
    .map(a => {
      const peerAvg = categoryStats.find(cs => cs.name === a.category)?.avg || 85;
      const deviation = peerAvg - a.condition;

      // Also check historical drop
      const hist = getAssetInspections(a.id);
      let histDrop = 0;
      if (hist.length >= 2) {
        const baseline = statusScoreMap[hist[0].status] ?? 100;
        histDrop = baseline - a.condition;
      }

      return {
        id: a.id,
        name: a.name,
        condition: a.condition,
        peerAvg,
        histDrop,
        deviation,
        flagged: deviation > 20 || histDrop > 20,
        diagnosis: getAssetDiagnosis(a)
      };
    })
    .filter(an => an.flagged);

  // selected asset inspection history (used by the health-history trend chart)
  const selectedHist = getAssetInspections(selectedAsset.id);

  // Selected asset peer comparison
  const selectedCategoryAvg = categoryStats.find(c => c.name === selectedAsset.category)?.avg || 80;

  // Rule-based diagnosis narrative for the selected asset
  const selectedDiagnosis = getAssetDiagnosis(selectedAsset);

  // Fleet-wide diagnostic synthesis (what pattern dominates the current failure landscape, and why)
  const diagnosticInsight = synthesizeDiagnosticInsight(rootCauses, anomalies.length, totalAssets, categoryStats);

  // ---------------------------------------------------------
  // TIER 3: PRESCRIPTIVE CALCULATIONS
  // ---------------------------------------------------------

  // Degradation rate (points/month) derived from inspection history, used by both the scheduler and the reasoning model
  const getDegradationRate = (a: Asset) => {
    const hist = getAssetInspections(a.id);
    if (hist.length < 2) return 0.3; // conservative default drift when no inspection history exists
    const firstScore = statusScoreMap[hist[0].status] ?? 100;
    const lastScore = a.condition;
    const firstDate = new Date(hist[0].submittedAt);
    const lastDate = new Date(hist[hist.length - 1].submittedAt);
    const diffMonths = Math.max(0.5, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return Math.max(0.1, (firstScore - lastScore) / diffMonths);
  };

  // Next service scheduler based on degradation rate
  const getNextServiceRecommendation = (a: Asset) => {
    const hist = getAssetInspections(a.id);
    if (hist.length < 2) return "Routine (3 months)";

    const firstScore = statusScoreMap[hist[0].status] ?? 100;
    const lastScore = a.condition;
    const firstDate = new Date(hist[0].submittedAt);
    const lastDate = new Date(hist[hist.length - 1].submittedAt);

    const diffMonths = Math.max(0.5, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    const degradationRate = Math.max(0.1, (firstScore - lastScore) / diffMonths); // points per month

    if (lastScore <= 50) return "IMMEDIATE REPAIR";

    const monthsToLimit = (lastScore - 70) / degradationRate;
    if (monthsToLimit <= 0) return "Urgent Service (Next 15 days)";
    if (monthsToLimit <= 2) return `Required in ${Math.round(monthsToLimit * 30)} days`;

    return `Service in ${Math.round(monthsToLimit)} months`;
  };

  // Full rule-based prescription (urgency + action + written justification) for any asset
  const getAssetPrescription = (a: Asset) => {
    const diagnosis = getAssetDiagnosis(a);
    const rate = getDegradationRate(a);
    const expected = getExpectedLife(a.category);
    const age = Math.max(0, 2026 - (a.procured ? new Date(a.procured).getFullYear() : 2024));
    return recommendAction(a, diagnosis, rate, expected, age);
  };

  // Replacement Planner (Condition < 60)
  const replacementCandidates = assets
    .filter(a => a.condition < 60 && a.status !== "Disposed")
    .map(a => ({
      id: a.id,
      name: a.name,
      condition: a.condition,
      cost: a.cost || 150000,
      expected: getExpectedLife(a.category),
      age: 2026 - (a.procured ? new Date(a.procured).getFullYear() : 2024)
    }))
    .sort((a, b) => a.condition - b.condition);

  const totalReplacementBudget = replacementCandidates.reduce((sum, c) => sum + c.cost, 0);

  // Treemap tiles for the budget planner's graph view — tile area is proportional to replacement cost
  const budgetTreemapTiles = computeTreemap(replacementCandidates.map(c => ({ key: c.id, value: c.cost })));

  // Resource Allocation suggestions (labs sorted by critical warning count)
  const labPriorities = labStats.map(ls => {
    const labAssets = assets.filter(a => a.lab === ls.name);
    const alertsCount = labAssets.filter(a => a.condition < 70 && a.status !== "Disposed").length;
    return { name: ls.name, alertsCount, score: ls.avg };
  }).sort((a, b) => b.alertsCount - a.alertsCount || a.score - b.score);

  // Fleet-wide prescriptive synthesis (where budget/dispatch attention should go next, and why)
  const prescriptiveInsight = synthesizePrescriptiveInsight(replacementCandidates.length, totalReplacementBudget, labPriorities);

  // Rule-based prescription for the asset selected in the What-If simulator
  const selectedPrescription = getAssetPrescription(selectedAsset);

  // Auto-drafting repair action
  const handleAutoDraftRepair = (asset: Asset) => {
    const refId = `WO-AUTO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    addRepairRequest({
      id: refId,
      assetId: asset.id,
      assetName: asset.name,
      custodian: asset.custodian || "Unassigned",
      statusLabel: "Under Maintenance",
      description: `[Auto-Generated Preventive Work Order] Asset health dropped to ${asset.condition}%. Initiated automated diagnostic servicing.`,
      submittedAt: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      priority: asset.condition < 50 ? "Critical" : "High",
      acknowledged: false,
      forwardedTo: "TSG"
    });
    alert(`Preventive maintenance ticket draft ${refId} has been successfully created in the system!`);
  };

  // ---------------------------------------------------------
  // Shared data groupings — feed both the graph and simple-form rendering of each widget
  // ---------------------------------------------------------
  const fleetStatusData = [
    { label: "Active & Available", count: activeCount + loanCount, color: "bg-emerald-500" },
    { label: "Servicing / In Repair", count: maintenanceCount, color: "bg-amber-500" },
    { label: "Decommissioned / Disposed", count: disposedCount, color: "bg-red-500" }
  ];

  const healthBreakdownData = [
    { label: "Healthy (≥ 80%)", count: healthyCount, color: "bg-emerald-500" },
    { label: "Warning (50–79%)", count: warningCount, color: "bg-amber-500" },
    { label: "Critical (< 50%)", count: criticalCount, color: "bg-red-500" }
  ];

  const rootCauseData = [
    { label: "Battery / Power Failures", val: rootCauses.Battery },
    { label: "Mechanical / Calibration Drift", val: rootCauses.Mechanical },
    { label: "Thermal / Heat Profiles", val: rootCauses.Thermal },
    { label: "Storage sector integrity", val: rootCauses.Storage },
    { label: "Other logs", val: rootCauses.Other }
  ];

  return (
    <div className="space-y-6">
      {/* ── Tabs selector ─────────────────────────────────────────────── */}
      <div className="flex bg-[#0A1F14] border border-emerald-500/10 p-1.5 rounded-xl justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant={activeTier === "descriptive" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTier("descriptive")}
            className={cn("text-xs gap-1.5 px-4 font-bold rounded-lg transition-colors", 
              activeTier !== "descriptive" && "text-[#9CA3AF] hover:text-white"
            )}
          >
            <BarChart3 size={13} /> Tier 1: Descriptive
          </Button>
          <Button
            variant={activeTier === "diagnostic" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTier("diagnostic")}
            className={cn("text-xs gap-1.5 px-4 font-bold rounded-lg transition-colors", 
              activeTier !== "diagnostic" && "text-[#9CA3AF] hover:text-white"
            )}
          >
            <Activity size={13} /> Tier 2: Diagnostic
          </Button>
          <Button
            variant={activeTier === "prescriptive" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTier("prescriptive")}
            className={cn("text-xs gap-1.5 px-4 font-bold rounded-lg transition-colors", 
              activeTier !== "prescriptive" && "text-[#9CA3AF] hover:text-white"
            )}
          >
            <Settings size={13} /> Tier 3: Prescriptive
          </Button>
        </div>
        <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#34D399] px-3">
          Predictive Analytics Engine
        </div>
      </div>

      {/* ── Tier 1 content ────────────────────────────────────────────── */}
      {activeTier === "descriptive" && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          {/* Snapshots metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-5 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Fleet</p>
                  <h3 className="text-2xl font-extrabold text-[#005A36] mt-1">{totalAssets}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[#10B981]">
                  <Layers size={18} />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-5 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Avg Health Index</p>
                  <h3 className="text-2xl font-extrabold text-[#005A36] mt-1">{avgHealth}%</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[#10B981]">
                  <TrendingUp size={18} />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-5 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Alert Level Density</p>
                  <h3 className="text-2xl font-extrabold text-amber-600 mt-1">
                    {warningCount + criticalCount} <span className="text-xs text-muted-foreground font-semibold">({criticalCount} critical)</span>
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <AlertTriangle size={18} />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-5 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Compliance rate</p>
                  <h3 className="text-2xl font-extrabold text-[#005A36] mt-1">{complianceRate}%</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[#10B981]">
                  <ShieldCheck size={18} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Utilization snapshot: currently used vs. vacant assets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-5 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Currently In Use</p>
                  <h3 className="text-2xl font-extrabold text-[#005A36] mt-1">{inUseCount}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">On loan, reserved, or deployed</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[#10B981]">
                  <PackageCheck size={18} />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-5 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Vacant / Available</p>
                  <h3 className="text-2xl font-extrabold text-slate-700 mt-1">{vacantCount}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Idle and ready for checkout</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                  <PackageX size={18} />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-100 shadow-sm">
              <CardContent className="p-5 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Utilization Rate</p>
                  <h3 className="text-2xl font-extrabold text-[#005A36] mt-1">{utilizationRate}%</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Share of deployable fleet in active use</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[#10B981]">
                  <Repeat2 size={18} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Status distribution bar chart */}
            <Card className="lg:col-span-1 border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fleet Status Distribution</CardTitle>
                <ViewToggle mode={fleetStatusView} onChange={setFleetStatusView} />
              </CardHeader>
              <CardContent className="p-5">
                {fleetStatusView === "graph" ? (
                  <StackedBar segments={fleetStatusData} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        {["Status", "Count", "Percent"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fleetStatusData.map(item => (
                        <TableRow key={item.label} className="text-xs">
                          <TableCell className="font-semibold">{item.label}</TableCell>
                          <TableCell>{item.count}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{Math.round((item.count / (totalAssets || 1)) * 100)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* expected service life vs age data */}
            <Card className="lg:col-span-2 border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Asset Age Distribution vs. Service Life</CardTitle>
                <ViewToggle mode={ageView} onChange={setAgeView} />
              </CardHeader>
              <CardContent className="p-5 flex flex-col md:flex-row gap-6 justify-between items-center">
                {ageView === "graph" ? (
                  <div className="flex-1 w-full space-y-3.5">
                    {categoryAgeBullets.map(b => {
                      const max = Math.max(b.expected * 1.4, b.avgAge * 1.15, 1);
                      return (
                        <div key={b.category} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-slate-700">
                            <span>{b.category} <span className="text-slate-400 font-normal">({b.count})</span></span>
                            <span>{b.avgAge} yrs avg &bull; target {b.expected} yrs</span>
                          </div>
                          <BulletBar
                            value={b.avgAge}
                            target={b.expected}
                            max={max}
                            valueSuffix=" yrs"
                            zones={[
                              { end: b.expected * 0.6, color: "bg-emerald-200" },
                              { end: b.expected, color: "bg-amber-200" },
                              { end: max, color: "bg-red-200" },
                            ]}
                          />
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-slate-400 pt-1">Bar = actual average age. Red tick = expected service life (the benchmark target).</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        {["Category", "Assets", "Avg Age (yrs)", "Expected Life (yrs)"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryAgeBullets.map(b => (
                        <TableRow key={b.category} className="text-xs">
                          <TableCell className="font-semibold">{b.category}</TableCell>
                          <TableCell>{b.count}</TableCell>
                          <TableCell>{b.avgAge}</TableCell>
                          <TableCell>{b.expected}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-500/10 text-xs leading-relaxed max-w-[280px]">
                  <p className="font-bold text-[#005A36] mb-1">Expectancy Framework</p>
                  <p className="text-slate-600">The system calculates age expectancies based on laboratory deployment constraints:</p>
                  <ul className="list-disc pl-4 mt-1.5 space-y-1 text-slate-500">
                    <li>Robotic Nodes: 7 Years</li>
                    <li>IT / Servers: 5 Years</li>
                    <li>VR / Peripherals: 3 Years</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Collective health / condition breakdown */}
            <Card className="lg:col-span-1 border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Collective Health &amp; Condition</CardTitle>
                <ViewToggle mode={healthBreakdownView} onChange={setHealthBreakdownView} />
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {healthBreakdownView === "graph" ? (
                  <StackedBar segments={healthBreakdownData} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        {["Bucket", "Count", "Percent"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {healthBreakdownData.map(item => {
                        const base = healthyCount + warningCount + criticalCount;
                        return (
                          <TableRow key={item.label} className="text-xs">
                            <TableCell className="font-semibold">{item.label}</TableCell>
                            <TableCell>{item.count}</TableCell>
                            <TableCell className="font-mono text-muted-foreground">{Math.round((item.count / (base || 1)) * 100)}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
                <Separator className="bg-slate-100" />
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-600">Collective Avg. Health Index</span>
                  <span className="font-extrabold text-[#005A36]">{avgHealth}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Most / least used assets */}
            <Card className="lg:col-span-2 border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Asset Usage Ranking (by Deployment History)</CardTitle>
              </CardHeader>
              <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp size={12} /> Most Used
                  </p>
                  {mostUsedAssets.length > 0 ? mostUsedAssets.map((u, idx) => (
                    <div key={u.id} className="flex items-center gap-2.5 text-xs p-2 bg-emerald-50/30 border border-emerald-500/10 rounded-lg">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0">{idx + 1}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-500">{u.lab} Lab</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] flex-shrink-0 bg-emerald-50 border-emerald-200 text-emerald-700">{u.timesDeployed}x</Badge>
                    </div>
                  )) : (
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-center text-[11px] text-muted-foreground">No deployment history recorded.</div>
                  )}
                </div>

                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingDown size={12} /> Least Used / Idle
                  </p>
                  {leastUsedAssets.length > 0 ? leastUsedAssets.map(u => (
                    <div key={u.id} className="flex items-center gap-2.5 text-xs p-2 bg-slate-50 border border-slate-100 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-500">{u.lab} Lab &bull; {u.status}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] flex-shrink-0 bg-slate-50 border-slate-200 text-slate-600">{u.timesDeployed}x</Badge>
                    </div>
                  )) : (
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-center text-[11px] text-muted-foreground">No deployment history recorded.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-slate-100 shadow-sm">
            <CardHeader className="py-4 border-b border-slate-50 flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Individual Health History Trend</CardTitle>
              <div className="flex items-center gap-2">
                <select
                  value={selectedAssetId}
                  onChange={e => setSelectedAssetId(e.target.value)}
                  className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 text-slate-800"
                >
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                  ))}
                </select>
                <ViewToggle mode={healthTrendView} onChange={setHealthTrendView} />
              </div>
            </CardHeader>
            <CardContent className="p-5 flex flex-col md:flex-row gap-6">
              {/* Chart / table panel */}
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 rounded-xl p-4 border border-slate-100 min-h-[220px]">
                {selectedHist.length > 0 ? (
                  healthTrendView === "graph" ? (
                    <div className="w-full">
                      {/* SVG Chart Drawing */}
                      <svg className="w-full h-40 overflow-visible" viewBox="0 0 500 100" role="img" aria-label={`Health score trend for ${selectedAsset.name}`}>
                        {(() => {
                          const PLOT_LEFT = 28, PLOT_RIGHT = 495;
                          const xFor = (idx: number) => PLOT_LEFT + (idx / Math.max(1, selectedHist.length - 1)) * (PLOT_RIGHT - PLOT_LEFT);
                          const yFor = (score: number) => 90 - score * 0.8;

                          const points = selectedHist.map((item, idx) =>
                            `${xFor(idx)},${yFor(statusScoreMap[item.status] ?? 100)}`
                          ).join(" ");

                          return (
                            <>
                              {/* Y-axis gridlines + value labels (0 / 50 / 100) */}
                              {[{ score: 100, label: "100" }, { score: 50, label: "50" }, { score: 0, label: "0" }].map(g => (
                                <g key={g.label}>
                                  <line x1={PLOT_LEFT} y1={yFor(g.score)} x2={PLOT_RIGHT} y2={yFor(g.score)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3" />
                                  <text x={PLOT_LEFT - 6} y={yFor(g.score) + 2.5} fontSize="7" fill="#94a3b8" textAnchor="end">{g.label}</text>
                                </g>
                              ))}

                              {/* Trend Line — brand green, validated for 3:1+ contrast against the panel surface */}
                              <polyline fill="none" stroke="#005A36" strokeWidth="2" points={points} />

                              {/* Dots — score is direct-labeled only at the endpoints and on hover; every point carries a native tooltip */}
                              {selectedHist.map((item, idx) => {
                                const x = xFor(idx);
                                const score = statusScoreMap[item.status] ?? 100;
                                const y = yFor(score);
                                const isEndpoint = idx === 0 || idx === selectedHist.length - 1;
                                const isHovered = hoveredHistIdx === idx;
                                return (
                                  <g
                                    key={item.id}
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHoveredHistIdx(idx)}
                                    onMouseLeave={() => setHoveredHistIdx(null)}
                                  >
                                    <title>{new Date(item.submittedAt).toLocaleDateString()} — {item.status} ({score}%)</title>
                                    {/* Larger invisible hit target, easier to hover than the visible 5px dot */}
                                    <circle cx={x} cy={y} r="10" fill="transparent" />
                                    <circle cx={x} cy={y} r={isHovered ? 6.5 : 5} fill="#ffffff" stroke="#005A36" strokeWidth="2.5" />
                                    {(isEndpoint || isHovered) && (
                                      <text x={x} y={y - 11} fontSize="8" fontWeight="bold" fill="#005A36" textAnchor="middle">{score}</text>
                                    )}
                                  </g>
                                );
                              })}
                            </>
                          );
                        })()}
                      </svg>
                      <div className="flex justify-between w-full px-2 mt-4 text-[10px] text-muted-foreground font-mono">
                        <span>Baseline: {new Date(selectedHist[0].submittedAt).toLocaleDateString()}</span>
                        <span>Current: {new Date(selectedHist[selectedHist.length - 1].submittedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          {["Date", "Cycle", "Status", "Score"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedHist.map(item => (
                          <TableRow key={item.id} className="text-xs">
                            <TableCell className="font-mono text-muted-foreground">{new Date(item.submittedAt).toLocaleDateString()}</TableCell>
                            <TableCell>{item.cycleType}</TableCell>
                            <TableCell className="font-semibold">{item.status}</TableCell>
                            <TableCell className="font-mono">{statusScoreMap[item.status] ?? 100}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                ) : (
                  <div className="text-center py-10">
                    <p className="text-xs text-muted-foreground">No historical inspection data is recorded in the system for this asset.</p>
                    <Badge variant="outline" className="mt-2 text-[10px] text-slate-500 border-slate-200">Insufficient History</Badge>
                  </div>
                )}
              </div>

              {/* Maintenance list */}
              <div className="w-full md:w-80 space-y-3">
                <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Asset Maintenance Timeline</p>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {repairRequests.filter(r => r.assetId === selectedAssetId).length > 0 ? (
                    repairRequests.filter(r => r.assetId === selectedAssetId).map(rep => (
                      <div key={rep.id} className="p-2.5 bg-white border border-slate-100 rounded-lg shadow-sm flex items-start gap-3">
                        <Wrench size={13} className="text-emerald-700 mt-1 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 leading-tight">{rep.statusLabel}</p>
                          <p className="text-[10px] text-muted-foreground truncate leading-relaxed">{rep.description}</p>
                          <p className="text-[8px] text-slate-400 font-mono mt-0.5">{rep.submittedAt}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-center">
                      <p className="text-[11px] text-muted-foreground">No maintenance reports logged.</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tier 2 content ────────────────────────────────────────────── */}
      {activeTier === "diagnostic" && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          {/* Fleet-wide diagnostic reasoning, generated by the rule-based reasoning model */}
          <Card className="border border-emerald-500/20 bg-[#0A1F14] shadow-sm">
            <CardContent className="p-5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-[#34D399] flex-shrink-0">
                <Brain size={16} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#34D399] mb-1">Fleet Diagnostic Insight</p>
                <p className="text-xs text-slate-200 leading-relaxed">{diagnosticInsight}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Deviation attribution and peer check */}
            <Card className="border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Diagnosis: {selectedAsset?.name}</CardTitle>
                <Badge className={cn("text-[9px] uppercase font-bold", 
                  selectedAsset?.condition >= 80 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                  selectedAsset?.condition >= 50 ? "bg-amber-50 text-amber-700 border border-amber-200" :
                  "bg-red-50 text-red-700 border border-red-200"
                )}>{selectedAsset?.condition >= 80 ? "Nominal" : selectedAsset?.condition >= 50 ? "Warning" : "Critical"}</Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {/* Bullet chart: actual condition vs. peer-category benchmark, inside the same critical/warning/nominal bands used everywhere else */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-600">Asset Health Score</span>
                    <span className="font-extrabold text-[#005A36]">{selectedAsset?.condition}% <span className="font-normal text-slate-400">vs. peer avg {selectedCategoryAvg}%</span></span>
                  </div>
                  <BulletBar
                    value={selectedAsset?.condition ?? 0}
                    target={selectedCategoryAvg}
                    max={100}
                    valueSuffix="%"
                    zones={[
                      { end: 50, color: "bg-red-200" },
                      { end: 80, color: "bg-amber-200" },
                      { end: 100, color: "bg-emerald-200" },
                    ]}
                  />
                  <p className="text-[9px] text-slate-400">Bar = actual score. Red tick = peer category ({selectedAsset?.category}) average.</p>
                </div>

                <Separator className="bg-slate-100" />

                {/* Root cause analysis — generated by the rule-based reasoning model */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Diagnostic Reasoning</p>
                    <Badge variant="outline" className={cn("text-[8px] uppercase font-bold",
                      selectedDiagnosis.confidence === "High" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                      selectedDiagnosis.confidence === "Medium" ? "bg-amber-50 border-amber-200 text-amber-700" :
                      "bg-slate-50 border-slate-200 text-slate-500"
                    )}>{selectedDiagnosis.confidence} Confidence</Badge>
                  </div>
                  <div className={cn("p-3 border rounded-xl space-y-2",
                    selectedDiagnosis.severity === "Nominal" ? "bg-emerald-50/50 border-emerald-200/50 text-emerald-800" : "bg-red-50/50 border-red-200/50 text-red-800"
                  )}>
                    <p className="text-slate-600 leading-relaxed">{selectedDiagnosis.narrative}</p>
                    {selectedDiagnosis.contributingFactors.length > 0 && (
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-500">
                        {selectedDiagnosis.contributingFactors.map(f => <li key={f}>{f}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Failure clustering */}
            <Card className="border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Failure Cluster Aggregates (Repairs Log)</CardTitle>
                <ViewToggle mode={rootCauseView} onChange={setRootCauseView} />
              </CardHeader>
              <CardContent className="p-5">
                {rootCauseView === "graph" ? (
                  <div className="space-y-3">
                    {rootCauseData.map(rc => {
                      const maxVal = Math.max(1, rootCauses.Battery, rootCauses.Mechanical, rootCauses.Thermal, rootCauses.Storage, rootCauses.Other);
                      const pct = Math.round((rc.val / maxVal) * 100);
                      return (
                        <div key={rc.label} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-slate-700">
                            <span>{rc.label}</span>
                            <span>{rc.val} counts</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div className="bg-[#10B981] h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        {["Failure Cause", "Count"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rootCauseData.map(rc => (
                        <TableRow key={rc.label} className="text-xs">
                          <TableCell className="font-semibold">{rc.label}</TableCell>
                          <TableCell>{rc.val}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Anomaly Detection */}
            <Card className="lg:col-span-1 border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Health Anomalies &amp; Deviations</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {anomalies.length > 0 ? (
                    anomalies.map(an => (
                      <div key={an.id} className="p-2.5 bg-red-50/20 border border-red-500/10 rounded-lg flex items-start gap-2.5 text-xs">
                        <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{an.name}</p>
                          <p className="text-slate-500 text-[10px]">Condition: {an.condition}% (Peer: {an.peerAvg}%)</p>
                          <Badge variant="outline" className="mt-1 text-[8px] bg-red-50 border-red-200 text-red-700">Dev: -{Math.round(an.deviation)} pts</Badge>
                          <p className="text-slate-500 text-[10px] leading-relaxed mt-1.5">
                            Likely driver: <span className="font-semibold text-slate-700">{an.diagnosis.primaryFactor}</span> ({an.diagnosis.confidence.toLowerCase()} confidence)
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-center text-xs text-muted-foreground">
                      No health score anomalies or significant peer deviations detected.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cost vs repairs correlation */}
            <Card className="lg:col-span-2 border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cost vs. Maintenance Correlation Matrix</CardTitle>
                <ViewToggle mode={costCorrelationView} onChange={setCostCorrelationView} />
              </CardHeader>
              <CardContent className="p-5">
                {costCorrelationView === "simple" ? (
                  <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          {["Asset Name","Acquisition Cost","Repairs Count","Maintenance Ratio"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {costCorrelation.map(cc => {
                          const ratio = cc.repairs > 0 ? Math.round((cc.cost / cc.repairs) / 1000) : 0;
                          return (
                            <TableRow key={cc.name} className="text-xs">
                              <TableCell className="font-semibold">{cc.name}</TableCell>
                              <TableCell className="font-mono">₱{cc.cost.toLocaleString()}</TableCell>
                              <TableCell className="font-semibold text-center">{cc.repairs}</TableCell>
                              <TableCell className="text-muted-foreground font-mono">
                                {ratio > 0 ? `₱${ratio}k / repair` : "No repairs"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  (() => {
                    const PLOT_LEFT = 34, PLOT_RIGHT = 495, PLOT_TOP = 8, PLOT_BOTTOM = 92;
                    const maxCost = Math.max(1, ...costCorrelation.map(c => c.cost)) * 1.08;
                    const maxRepairs = Math.max(1, ...costCorrelation.map(c => c.repairs));
                    const xFor = (cost: number) => PLOT_LEFT + (cost / maxCost) * (PLOT_RIGHT - PLOT_LEFT);
                    const yFor = (repairs: number) => PLOT_BOTTOM - (repairs / maxRepairs) * (PLOT_BOTTOM - PLOT_TOP);
                    return (
                      <div>
                        <svg className="w-full h-56 overflow-visible" viewBox="0 0 500 100" preserveAspectRatio="none" role="img" aria-label="Scatter plot of acquisition cost versus repair count per asset">
                          {/* Y-axis gridlines (repair counts) — capped at 6 ticks so dense data stays readable */}
                          {(() => {
                            const step = Math.max(1, Math.ceil(maxRepairs / 6));
                            return Array.from({ length: Math.floor(maxRepairs / step) + 1 }, (_, i) => i * step);
                          })().map(r => (
                            <g key={r}>
                              <line x1={PLOT_LEFT} y1={yFor(r)} x2={PLOT_RIGHT} y2={yFor(r)} stroke="#f1f5f9" strokeWidth="0.5" />
                              <text x={PLOT_LEFT - 4} y={yFor(r) + 2} fontSize="6" fill="#94a3b8" textAnchor="end">{r}</text>
                            </g>
                          ))}
                          {/* X-axis */}
                          <line x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT} y2={PLOT_BOTTOM} stroke="#cbd5e1" strokeWidth="0.75" />
                          <line x1={PLOT_LEFT} y1={PLOT_TOP} x2={PLOT_LEFT} y2={PLOT_BOTTOM} stroke="#cbd5e1" strokeWidth="0.75" />
                          {[0, 0.5, 1].map(f => (
                            <text key={f} x={PLOT_LEFT + f * (PLOT_RIGHT - PLOT_LEFT)} y={PLOT_BOTTOM + 8} fontSize="6" fill="#94a3b8" textAnchor="middle">₱{Math.round((f * maxCost) / 1000)}k</text>
                          ))}
                          {/* Points — one per asset, sized/colored by repair count (outliers pop visually) */}
                          {costCorrelation.map(cc => {
                            const x = xFor(cc.cost), y = yFor(cc.repairs);
                            const isOutlier = cc.repairs >= Math.max(2, maxRepairs * 0.7);
                            return (
                              <g key={cc.name} className="cursor-pointer">
                                <title>{cc.name}: ₱{cc.cost.toLocaleString()} acquisition &bull; {cc.repairs} repairs</title>
                                <circle cx={x} cy={y} r={isOutlier ? 5 : 3.5} fill={isOutlier ? "#ef4444" : "#005A36"} fillOpacity={isOutlier ? 0.85 : 0.6} stroke="#ffffff" strokeWidth="0.75" />
                              </g>
                            );
                          })}
                        </svg>
                        <div className="flex justify-between text-[9px] text-slate-400 mt-1 px-1">
                          <span>x-axis: acquisition cost &bull; y-axis: repair count &bull; red = high-repair outlier</span>
                        </div>
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Tier 3 content ────────────────────────────────────────────── */}
      {activeTier === "prescriptive" && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          {/* Fleet-wide prescriptive reasoning, generated by the rule-based reasoning model */}
          <Card className="border border-emerald-500/20 bg-[#0A1F14] shadow-sm">
            <CardContent className="p-5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-[#34D399] flex-shrink-0">
                <Lightbulb size={16} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#34D399] mb-1">Fleet Prescriptive Insight</p>
                <p className="text-xs text-slate-200 leading-relaxed">{prescriptiveInsight}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Scheduling and scheduler engine */}
            <Card className="border border-slate-100 shadow-sm md:col-span-2">
              <CardHeader className="py-4 border-b border-slate-50">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Condition-Based Maintenance Scheduler</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        {["Asset","Current Health","Last Service","Degradation Rate","Next Service Recommendation","Actions"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assets.filter(a => a.status !== "Disposed").slice(0, 5).map(a => {
                        const rec = getNextServiceRecommendation(a);
                        const isCritical = rec.includes("IMMEDIATE") || rec.includes("Urgent");
                        const prescription = getAssetPrescription(a);
                        const rate = getDegradationRate(a);
                        return (
                          <TableRow key={a.id} className="text-xs">
                            <TableCell><p className="font-semibold">{a.name}</p><p className="text-[10px] text-muted-foreground">{a.id}</p></TableCell>
                            <TableCell><Badge variant="outline" className={cn("text-[10px]", a.condition >= 85 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200")}>{a.condition}%</Badge></TableCell>
                            <TableCell className="font-mono text-muted-foreground">{a.procured}</TableCell>
                            <TableCell className="text-center font-semibold text-slate-700">
                              -{rate.toFixed(1)} pts / mo
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Badge className={cn("text-[9px] uppercase font-bold", isCritical ? "bg-red-50 text-red-700 border border-red-200" : "bg-blue-50 text-blue-700 border border-blue-200")}>
                                  {rec}
                                </Badge>
                                <HelpCircle size={12} className="text-slate-400 flex-shrink-0 cursor-help" title={prescription.justification} />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAutoDraftRepair(a)}
                                className="h-7 text-[10px] border-[#005A36] text-[#005A36] hover:bg-emerald-50/40"
                              >
                                Draft WO
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* budget replacement rank */}
            <Card className="border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Procurement &amp; Budget Planner</CardTitle>
                <ViewToggle mode={budgetView} onChange={setBudgetView} />
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Required Replacement Budget</p>
                  <h3 className="text-2xl font-extrabold text-[#005A36]">₱{totalReplacementBudget.toLocaleString()}</h3>
                  <p className="text-[10px] text-slate-500">Based on {replacementCandidates.length} assets identified with critical index score (&lt; 60).</p>
                </div>

                <Separator className="bg-slate-100" />

                {budgetView === "simple" ? (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {replacementCandidates.map(c => (
                      <div key={c.id} className="flex justify-between items-center text-xs p-1.5 bg-slate-50 rounded-lg">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{c.name}</p>
                          <p className="text-[10px] text-red-600">Condition: {c.condition}%</p>
                        </div>
                        <span className="font-mono font-bold text-slate-700 flex-shrink-0">₱{c.cost.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : replacementCandidates.length > 0 ? (
                  <div className="relative w-full h-[220px] rounded-lg overflow-hidden border border-slate-100">
                    {budgetTreemapTiles.map(tile => {
                      const candidate = replacementCandidates.find(c => c.id === tile.key);
                      if (!candidate) return null;
                      const tone = candidate.condition < 30 ? "bg-red-600" : candidate.condition < 45 ? "bg-red-400" : "bg-amber-400";
                      const isSmall = tile.w < 16 || tile.h < 16;
                      return (
                        <div
                          key={tile.key}
                          className={cn("absolute flex flex-col justify-end p-1.5 border border-white/60 overflow-hidden", tone)}
                          style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.w}%`, height: `${tile.h}%` }}
                          title={`${candidate.name}: ₱${candidate.cost.toLocaleString()} (condition ${candidate.condition}%)`}
                        >
                          {!isSmall && (
                            <>
                              <p className="text-white text-[10px] font-bold leading-tight truncate">{candidate.name}</p>
                              <p className="text-white/80 text-[9px] font-mono leading-tight">₱{candidate.cost.toLocaleString()}</p>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-center text-[11px] text-muted-foreground">No assets currently meet the replacement threshold.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recommendation reasoning — why each scheduled asset was prioritized the way it was */}
          <Card className="border border-slate-100 shadow-sm">
            <CardHeader className="py-4 border-b border-slate-50">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recommendation Reasoning</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {assets.filter(a => a.status !== "Disposed").slice(0, 5).map(a => {
                const prescription = getAssetPrescription(a);
                return (
                  <div key={a.id} className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-800">{a.name}</p>
                      <Badge className={cn("text-[9px] uppercase font-bold",
                        prescription.urgency === "Immediate" || prescription.urgency === "Urgent" ? "bg-red-50 text-red-700 border border-red-200" :
                        prescription.urgency === "Scheduled" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-blue-50 text-blue-700 border border-blue-200"
                      )}>{prescription.urgency}</Badge>
                    </div>
                    <p className="text-slate-600 leading-relaxed"><span className="font-semibold text-slate-700">Action:</span> {prescription.action}</p>
                    <p className="text-slate-500 leading-relaxed">{prescription.justification}</p>
                    <p className="text-emerald-700 leading-relaxed">{prescription.expectedOutcome}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Resource allocation suggestions */}
            <Card className="border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Technician Dispatch Priorities</CardTitle>
                <ViewToggle mode={dispatchView} onChange={setDispatchView} />
              </CardHeader>
              <CardContent className="p-5">
                {dispatchView === "simple" ? (
                  <div className="space-y-3">
                    {labPriorities.map((lp, idx) => (
                      <div key={lp.name} className="flex items-center gap-3">
                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs",
                          idx === 0 ? "bg-red-500 text-white" :
                          idx === 1 ? "bg-amber-500 text-white" :
                          "bg-slate-100 text-slate-600"
                        )}>{idx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800">{lp.name} Research Lab</p>
                          <p className="text-[10px] text-slate-500">Average health: {lp.score}%</p>
                        </div>
                        <Badge className={cn("text-[9px] uppercase font-bold", lp.alertsCount > 0 ? "bg-red-50 text-red-700 border border-red-200" : "bg-slate-50 text-slate-600 border border-slate-200")}>
                          {lp.alertsCount > 0 ? `${lp.alertsCount} Alerts` : "Nominal"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {labPriorities.map(lp => {
                      const maxAlerts = Math.max(1, ...labPriorities.map(l => l.alertsCount));
                      const pct = Math.round((lp.alertsCount / maxAlerts) * 100);
                      return (
                        <div key={lp.name} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-slate-700">
                            <span>{lp.name} Lab</span>
                            <span>{lp.alertsCount} alerts</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", lp.alertsCount > 0 ? "bg-red-500" : "bg-slate-300")} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* What If Simulator */}
            <Card className="border border-slate-100 shadow-sm md:col-span-2">
              <CardHeader className="py-4 border-b border-slate-50">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What-If Intervention Timing Simulator</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-600">Simulate delay in maintenance window for: <strong className="text-slate-800">{selectedAsset?.name}</strong></p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={whatIfDelay}
                      onChange={e => setWhatIfDelay(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 h-8 text-xs text-center"
                    />
                    <span className="text-xs text-slate-500 font-bold">Months</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-emerald-50/40 border border-emerald-200/50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">Intervene Now</span>
                      <Badge className="bg-emerald-500 text-white text-[9px] font-bold">RECOMMENDED</Badge>
                    </div>
                    <WaterfallStep from={selectedAsset.condition} to={95} />
                    <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                      <p>Estimated Cost: <strong className="text-emerald-800">₱{(selectedAsset?.cost ? Math.round(selectedAsset.cost * 0.1) : 15000).toLocaleString()}</strong></p>
                      <p>Useful Lifespan Extension: <strong className="text-emerald-800">+3 Years</strong></p>
                      <p>Risk Profile: <strong className="text-emerald-700">Low (Nominal Uptime)</strong></p>
                    </div>
                  </div>

                  <div className="p-4 bg-red-50/40 border border-red-200/50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-red-800 uppercase tracking-wider">Delay {whatIfDelay} Months</span>
                      <Badge className="bg-red-500 text-white text-[9px] font-bold">CRITICAL RISK</Badge>
                    </div>
                    <WaterfallStep from={selectedAsset.condition} to={Math.max(10, selectedAsset.condition - whatIfDelay * 4)} />
                    <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                      <p>Potential Cost: <strong className="text-red-800">₱{(selectedAsset?.cost ? Math.round(selectedAsset.cost * 0.9) : 135000).toLocaleString()}</strong></p>
                      <p>Useful Lifespan Extension: <strong className="text-red-800">0 Years (Requires Replacement)</strong></p>
                      <p>Risk Profile: <strong className="text-red-700">High (Complete Failure/Disposal)</strong></p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl flex items-start gap-2.5">
                  <Lightbulb size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {selectedAsset.name}'s decline is primarily attributed to <strong className="text-slate-800">{selectedDiagnosis.primaryFactor}</strong>. {selectedPrescription.justification} Delaying intervention lets that same root cause continue compounding, {selectedPrescription.urgency === "Routine"
                      ? "though the risk of a compliance breach is currently low given the asset's stable trend."
                      : "increasing both the eventual repair cost and the odds that repair is no longer viable versus outright replacement."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
