import { useState, useEffect } from "react";
import { useApp, type Asset, type RepairRequest, type InspectionReport } from "../context";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { cn } from "./ui/utils";
import { 
  TrendingUp, AlertTriangle, ShieldCheck, DollarSign, Settings,
  Wrench, Activity, BarChart3, HelpCircle, ArrowRight,
  ClipboardCheck, Clock, Layers, Users
} from "lucide-react";

export function AnalyticsModule() {
  const { assets: allAssets, repairRequests: allRepairs, inspections: allInspections, addRepairRequest, role } = useApp();
  const [activeTier, setActiveTier] = useState<"descriptive" | "diagnostic" | "prescriptive">("descriptive");
  const [selectedAssetId, setSelectedAssetId] = useState<string>("EQ-2024-004");
  const [whatIfDelay, setWhatIfDelay] = useState<number>(6); // months

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

  const ageGroups = {
    new: ageData.filter(d => d.age <= 1).length,
    active: ageData.filter(d => d.age > 1 && d.age <= 3).length,
    aging: ageData.filter(d => d.age > 3 && d.age <= 5).length,
    eol: ageData.filter(d => d.age > 5).length,
  };

  // Compliance (condition >= 70)
  const complianceRate = Math.round(
    (assets.filter(a => a.condition >= 70 && a.status !== "Disposed").length / 
     (assets.filter(a => a.status !== "Disposed").length || 1)) * 100
  );

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
        flagged: deviation > 20 || histDrop > 20 
      };
    })
    .filter(an => an.flagged);

  // selected asset degradation calculation
  const selectedHist = getAssetInspections(selectedAsset.id);
  const selectedBaseline = selectedHist.length > 0 ? (statusScoreMap[selectedHist[0].status] ?? 100) : 100;
  const selectedDecline = selectedBaseline - selectedAsset.condition;

  // Selected asset peer comparison
  const selectedCategoryAvg = categoryStats.find(c => c.name === selectedAsset.category)?.avg || 80;

  // ---------------------------------------------------------
  // TIER 3: PRESCRIPTIVE CALCULATIONS
  // ---------------------------------------------------------

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

  // Resource Allocation suggestions (labs sorted by critical warning count)
  const labPriorities = labStats.map(ls => {
    const labAssets = assets.filter(a => a.lab === ls.name);
    const alertsCount = labAssets.filter(a => a.condition < 70 && a.status !== "Disposed").length;
    return { name: ls.name, alertsCount, score: ls.avg };
  }).sort((a, b) => b.alertsCount - a.alertsCount || a.score - b.score);

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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Status distribution bar chart */}
            <Card className="lg:col-span-1 border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fleet Status Distribution</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {[
                  { label: "Active & Available", count: activeCount + loanCount, color: "bg-emerald-500" },
                  { label: "Servicing / In Repair", count: maintenanceCount, color: "bg-amber-500" },
                  { label: "Decommissioned / Disposed", count: disposedCount, color: "bg-red-500" }
                ].map(item => {
                  const percent = Math.round((item.count / (totalAssets || 1)) * 100);
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>{item.label}</span>
                        <span>{item.count} assets ({percent}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", item.color)} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* expected service life vs age data */}
            <Card className="lg:col-span-2 border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Asset Age Distribution vs. Service Life</CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex flex-col md:flex-row gap-6 justify-between items-center">
                {/* SVG age distribution bar charts */}
                <div className="flex-1 w-full space-y-2">
                  {[
                    { label: "New (0-1 yr)", val: ageGroups.new },
                    { label: "Active (1-3 yrs)", val: ageGroups.active },
                    { label: "Aging (3-5 yrs)", val: ageGroups.aging },
                    { label: "EOL (> 5 yrs)", val: ageGroups.eol },
                  ].map(g => {
                    const maxVal = Math.max(1, ageGroups.new, ageGroups.active, ageGroups.aging, ageGroups.eol);
                    const pct = Math.round((g.val / maxVal) * 100);
                    return (
                      <div key={g.label} className="flex items-center gap-4 text-xs font-semibold">
                        <span className="w-28 text-slate-600">{g.label}</span>
                        <div className="flex-1 bg-slate-100 h-6 rounded-md overflow-hidden relative flex items-center px-2">
                          <div className="absolute left-0 top-0 bottom-0 bg-emerald-700/15" style={{ width: `${pct}%` }} />
                          <span className="z-10 text-emerald-800 font-bold">{g.val} assets</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
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

          <Card className="border border-slate-100 shadow-sm">
            <CardHeader className="py-4 border-b border-slate-50 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Individual Health History Trend</CardTitle>
              <select
                value={selectedAssetId}
                onChange={e => setSelectedAssetId(e.target.value)}
                className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 text-slate-800"
              >
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                ))}
              </select>
            </CardHeader>
            <CardContent className="p-5 flex flex-col md:flex-row gap-6">
              {/* SVG Line Chart */}
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 rounded-xl p-4 border border-slate-100 min-h-[220px]">
                {selectedHist.length > 0 ? (
                  <div className="w-full">
                    {/* SVG Chart Drawing */}
                    <svg className="w-full h-40 overflow-visible" viewBox="0 0 500 100">
                      {/* Grid Lines */}
                      <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" />
                      <line x1="0" y1="50" x2="500" y2="50" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" />
                      <line x1="0" y1="80" x2="500" y2="80" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" />
                      
                      {/* Trend Line */}
                      {(() => {
                        const points = selectedHist.map((item, idx) => {
                          const x = (idx / Math.max(1, selectedHist.length - 1)) * 480 + 10;
                          const y = 90 - (statusScoreMap[item.status] ?? 100) * 0.8;
                          return `${x},${y}`;
                        }).join(" ");
                        return (
                          <>
                            <polyline
                              fill="none"
                              stroke="#10B981"
                              strokeWidth="3.5"
                              points={points}
                            />
                            {/* Dots */}
                            {selectedHist.map((item, idx) => {
                              const x = (idx / Math.max(1, selectedHist.length - 1)) * 480 + 10;
                              const score = statusScoreMap[item.status] ?? 100;
                              const y = 90 - score * 0.8;
                              return (
                                <g key={item.id} className="cursor-pointer">
                                  <circle cx={x} cy={y} r="5" fill="#ffffff" stroke="#005A36" strokeWidth="2.5" />
                                  <text x={x} y={y - 10} fontSize="8" fontWeight="bold" fill="#005A36" textAnchor="middle">{score}</text>
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
                {/* Peer comparison bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-600">Asset Health Score</span>
                    <span className="font-extrabold text-[#005A36]">{selectedAsset?.condition}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-600">Peer Category Avg ({selectedAsset?.category})</span>
                    <span className="font-bold text-slate-600">{selectedCategoryAvg}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden relative flex items-center">
                    <div className="absolute left-0 top-0 bottom-0 bg-[#10B981]" style={{ width: `${selectedAsset?.condition}%` }} />
                    <div className="absolute w-1 h-4 bg-slate-900 top-[-2px] bottom-[-2px]" style={{ left: `${selectedCategoryAvg}%` }} title="Category Peer Average" />
                  </div>
                </div>

                <Separator className="bg-slate-100" />

                {/* Root cause analysis */}
                <div className="space-y-1.5 text-xs">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Primary Defect Attribution</p>
                  {selectedDecline > 0 ? (
                    <div className="p-3 bg-red-50/50 border border-red-200/50 rounded-xl space-y-1 text-red-800">
                      <p className="font-bold">Total Health Drop: -{selectedDecline} Points</p>
                      <p className="text-slate-600 leading-relaxed">
                        The score fell from a baseline of {selectedBaseline}% down to {selectedAsset.condition}%. 
                        {selectedAsset.category.toLowerCase().includes("simulator") || selectedAsset.category.toLowerCase().includes("robot") ? 
                          " Largest contributing factor: Mechanical joint sensor drift and leg motor alignment warning." :
                          selectedAsset.category.toLowerCase().includes("cpu") || selectedAsset.category.toLowerCase().includes("server") ?
                          " Largest contributing factor: Storage array sector accumulation and read/write lag." :
                          " Largest contributing factor: Component degradation log from inspection cycle."}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50/50 border border-emerald-200/50 rounded-xl text-emerald-800 font-bold">
                      Asset is operating within nominal parameters. Zero health deviation detected.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Failure clustering */}
            <Card className="border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Failure Cluster Aggregates (Repairs Log)</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-3">
                  {[
                    { label: "Battery / Power Failures", val: rootCauses.Battery },
                    { label: "Mechanical / Calibration Drift", val: rootCauses.Mechanical },
                    { label: "Thermal / Heat Profiles", val: rootCauses.Thermal },
                    { label: "Storage sector integrity", val: rootCauses.Storage },
                    { label: "Other logs", val: rootCauses.Other }
                  ].map(rc => {
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
              <CardHeader className="py-4 border-b border-slate-50">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cost vs. Maintenance Correlation Matrix</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
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
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Tier 3 content ────────────────────────────────────────────── */}
      {activeTier === "prescriptive" && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
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
                        return (
                          <TableRow key={a.id} className="text-xs">
                            <TableCell><p className="font-semibold">{a.name}</p><p className="text-[10px] text-muted-foreground">{a.id}</p></TableCell>
                            <TableCell><Badge variant="outline" className={cn("text-[10px]", a.condition >= 85 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200")}>{a.condition}%</Badge></TableCell>
                            <TableCell className="font-mono text-muted-foreground">{a.procured}</TableCell>
                            <TableCell className="text-center font-semibold text-slate-700">
                              {a.condition < 90 ? "-2.4 pts / mo" : "-0.8 pts / mo"}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn("text-[9px] uppercase font-bold", isCritical ? "bg-red-50 text-red-700 border border-red-200" : "bg-blue-50 text-blue-700 border border-blue-200")}>
                                {rec}
                              </Badge>
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
              <CardHeader className="py-4 border-b border-slate-50">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Procurement &amp; Budget Planner</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Required Replacement Budget</p>
                  <h3 className="text-2xl font-extrabold text-[#005A36]">₱{totalReplacementBudget.toLocaleString()}</h3>
                  <p className="text-[10px] text-slate-500">Based on {replacementCandidates.length} assets identified with critical index score (&lt; 60).</p>
                </div>
                
                <Separator className="bg-slate-100" />
                
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
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Resource allocation suggestions */}
            <Card className="border border-slate-100 shadow-sm">
              <CardHeader className="py-4 border-b border-slate-50">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Technician Dispatch Priorities</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
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
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <p>Estimated Cost: <strong className="text-emerald-800">₱{(selectedAsset?.cost ? Math.round(selectedAsset.cost * 0.1) : 15000).toLocaleString()}</strong></p>
                      <p>Condition Index Restoration: <strong className="text-emerald-800">95%</strong></p>
                      <p>Useful Lifespan Extension: <strong className="text-emerald-800">+3 Years</strong></p>
                      <p>Risk Profile: <strong className="text-emerald-700">Low (Nominal Uptime)</strong></p>
                    </div>
                  </div>

                  <div className="p-4 bg-red-50/40 border border-red-200/50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-red-800 uppercase tracking-wider">Delay {whatIfDelay} Months</span>
                      <Badge className="bg-red-500 text-white text-[9px] font-bold">CRITICAL RISK</Badge>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <p>Potential Cost: <strong className="text-red-800">₱{(selectedAsset?.cost ? Math.round(selectedAsset.cost * 0.9) : 135000).toLocaleString()}</strong></p>
                      <p>Condition Index Projection: <strong className="text-red-800">{Math.max(10, selectedAsset?.condition - whatIfDelay * 4)}%</strong></p>
                      <p>Useful Lifespan Extension: <strong className="text-red-800">0 Years (Requires Replacement)</strong></p>
                      <p>Risk Profile: <strong className="text-red-700">High (Complete Failure/Disposal)</strong></p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
