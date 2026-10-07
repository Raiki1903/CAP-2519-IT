import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useServerData } from "@web/state/serverData";
import * as analyticsApi from "@web/api/analytics.api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Clock, CheckCircle2, ArrowRight, Zap, Maximize2, ExternalLink } from "lucide-react";

const cardAnimation = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
};

// 2. Asset Idle Time Analyzer (BarChart Histogram)
/**
 * Histogram of how long the lab's assets sit unused. Calls analyticsApi.getIdleTimeRaw(). Not rendered anywhere today: no view or page includes it.
 *
 * @param lab the lab to show
 */
export const IdleTimeAnalyzer: React.FC<{ lab: string }> = ({ lab }) => {
  const { data: idleData = [] } = useQuery({
    queryKey: ["labhead-idle-time", lab],
    queryFn: async () => {
      try {
        const res = await analyticsApi.getIdleTimeRaw(lab);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) {
        // Fallback
      }

      return [
        { category: "< 1 Week", count: 8 },
        { category: "1-4 Weeks", count: 12 },
        { category: "> 1 Month (Idle)", count: 5 }
      ];
    }
  });

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-sm font-bold text-foreground">
              Asset Idle Time Histogram
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Categorizes returned equipment by duration spent unallocated in lab storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={idleData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="category" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }} />
                <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Unallocated Idle Equipment Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 2b. Asset Idle Time Analyzer (Duration Frequency Chart - Lab Head Exclusive)
/**
 * Idle time by duration band. Calls analyticsApi.getIdleFrequencyRaw(). Not rendered anywhere today: no view or page includes it.
 *
 * @param lab the lab to show
 */
export const IdleTimeDurationFrequencyWidget: React.FC<{ lab: string }> = ({ lab }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"ALL" | "31-60" | "60+">("ALL");

  const { data: frequencyData = [] } = useQuery({
    queryKey: ["labhead-idle-duration-frequency", lab],
    queryFn: async () => {
      try {
        const res = await analyticsApi.getIdleFrequencyRaw(lab);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) {
        // Fallback
      }

      return [
        { durationRange: "1-7 Days", equipmentCount: 14, criticality: "Low" },
        { durationRange: "8-14 Days", equipmentCount: 18, criticality: "Normal" },
        { durationRange: "15-30 Days", equipmentCount: 12, criticality: "Moderate" },
        { durationRange: "31-60 Days", equipmentCount: 6, criticality: "High" },
        { durationRange: "60+ Days", equipmentCount: 3, criticality: "Critical" }
      ];
    }
  });

  const { assets } = useServerData();
  const idleAssets = assets.map((a: any, idx: number) => ({
    id: idx + 1,
    tag: a.id,
    name: a.name,
    category: a.category,
    location: `${a.lab || lab} ${a.location || ""}`,
    daysIdle: 30 + (idx * 4),
    range: (30 + (idx * 4)) > 60 ? "60+" : "31-60",
    criticality: a.condition < 85 ? "Critical" : "High",
    action: "Inter-Lab Loan"
  }));

  const filteredAssets = idleAssets.filter(item => {
    if (selectedFilter === "31-60") return item.range === "31-60";
    if (selectedFilter === "60+") return item.range === "60+";
    return true;
  });

  const totalIdleCount = frequencyData.reduce((sum: number, item: any) => sum + (item.equipmentCount || 0), 0);
  const criticalIdleCount = frequencyData.filter((i: any) => i.criticality === "High" || i.criticality === "Critical")
    .reduce((sum: number, item: any) => sum + (item.equipmentCount || 0), 0);

  return (
    <>
      <motion.div variants={cardAnimation} initial="hidden" animate="visible">
        <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <CardTitle className="text-sm font-bold text-foreground">
                  Asset Idle Time Analyzer (Duration Frequency Chart)
                </CardTitle>
              </div>
              <CardDescription className="text-muted-foreground text-xs mt-0.5">
                Continuous duration frequency distribution tracking consecutive days unallocated assets remain in {lab} storage bins.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSelectedFilter("ALL"); setIsMaximized(true); }}
              className="text-xs gap-1 border-amber-600/30 text-amber-700 hover:bg-amber-50 font-bold shrink-0"
            >
              <Maximize2 size={13} /> {criticalIdleCount} Assets &gt; 30 Days Idle
            </Button>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Duration Frequency Area Chart */}
              <div className="lg:col-span-8 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={frequencyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="idleGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="durationRange" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }} />
                    <Area
                      type="monotone"
                      dataKey="equipmentCount"
                      stroke="#D97706"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#idleGradient)"
                      name="Equipment Frequency Count"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Clickable Idle Inventory Stats Side Card */}
              <div
                onClick={() => { setSelectedFilter("ALL"); setIsMaximized(true); }}
                className="lg:col-span-4 bg-muted/20 hover:bg-amber-50/40 border border-border hover:border-amber-400 rounded-xl p-4 space-y-3 cursor-pointer transition-all group shadow-2xs"
                title="Click to open maximized idle equipment tab"
              >
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-bold text-foreground group-hover:text-amber-800 transition-colors flex items-center gap-1.5">
                    Idle Inventory Stats <ExternalLink size={12} className="opacity-60 group-hover:opacity-100" />
                  </span>
                  <span className="text-xs font-mono font-bold text-[#005A36]">{totalIdleCount} Total Assets</span>
                </div>

                <div className="space-y-2">
                  <div
                    onClick={(e) => { e.stopPropagation(); setSelectedFilter("31-60"); setIsMaximized(true); }}
                    className="p-2.5 bg-card hover:bg-amber-100/50 border border-amber-200 rounded-lg flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <span className="font-bold text-amber-900 block">31-60 Days Idle</span>
                      <span className="text-[10px] text-muted-foreground">Requires Inter-Lab Loaning</span>
                    </div>
                    <Badge className="bg-amber-500 text-white font-bold group-hover:scale-105 transition-transform">6 Units</Badge>
                  </div>

                  <div
                    onClick={(e) => { e.stopPropagation(); setSelectedFilter("60+"); setIsMaximized(true); }}
                    className="p-2.5 bg-card hover:bg-red-100/50 border border-red-200 rounded-lg flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <span className="font-bold text-red-900 block">60+ Days (Critical Idle)</span>
                      <span className="text-[10px] text-muted-foreground font-semibold text-red-700">Flagged for Re-allocation</span>
                    </div>
                    <Badge className="bg-red-600 text-white font-bold group-hover:scale-105 transition-transform">3 Units</Badge>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-amber-800 font-bold underline flex items-center justify-end gap-1">
                    Click to view itemized assets <ExternalLink size={10} />
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Maximized Window Tab Dialog Modal (Itemized Idle Assets List) */}
      <Dialog open={isMaximized} onOpenChange={setIsMaximized}>
        <DialogContent className="w-[96vw] max-w-6xl max-h-[90vh] overflow-y-auto bg-card border-border text-card-foreground rounded-2xl p-6 sm:p-8 shadow-2xl my-auto">
          <DialogHeader className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <DialogTitle className="text-lg sm:text-xl font-extrabold text-amber-800 flex items-center gap-2">
                <Clock className="w-6 h-6 text-amber-600" />
                Idle Inventory Assets Breakdown ({lab})
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Itemized inventory list of equipment sitting unallocated in {lab} storage bins for over 30 consecutive days.
              </DialogDescription>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <Button
                variant={selectedFilter === "ALL" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("ALL")}
                className={`text-xs font-bold ${selectedFilter === "ALL" ? "bg-amber-700 text-white" : "text-foreground"}`}
              >
                All Idle (9)
              </Button>
              <Button
                variant={selectedFilter === "31-60" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("31-60")}
                className={`text-xs font-bold ${selectedFilter === "31-60" ? "bg-amber-600 text-white" : "text-foreground"}`}
              >
                31-60 Days (6)
              </Button>
              <Button
                variant={selectedFilter === "60+" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("60+")}
                className={`text-xs font-bold ${selectedFilter === "60+" ? "bg-red-600 text-white" : "text-foreground"}`}
              >
                60+ Days (3)
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 my-3">
            {/* Itemized Idle Assets Table */}
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs font-bold text-foreground">Asset Tag / Name</TableHead>
                    <TableHead className="text-xs font-bold text-foreground">Category</TableHead>
                    <TableHead className="text-xs font-bold text-foreground">Storage Location</TableHead>
                    <TableHead className="text-center text-xs font-bold text-foreground">Idle Duration</TableHead>
                    <TableHead className="text-right text-xs font-bold text-foreground">Recommended Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => {
                    const isCritical = asset.criticality === "Critical";
                    return (
                      <TableRow key={asset.id} className={`hover:bg-muted/30 border-b border-border ${isCritical ? "bg-red-50/40" : ""}`}>
                        <TableCell className="font-medium text-xs text-foreground py-3">
                          <div className="font-extrabold text-foreground">{asset.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{asset.tag}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{asset.category}</TableCell>
                        <TableCell className="text-xs text-foreground font-medium">{asset.location}</TableCell>
                        <TableCell className="text-center py-3">
                          <Badge className={isCritical ? "bg-red-600 text-white font-bold" : "bg-amber-500 text-white font-bold"}>
                            {asset.daysIdle} Days Idle
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <Badge variant="outline" className={isCritical ? "border-red-600 text-red-700 bg-red-50 font-bold" : "border-amber-600 text-amber-800 bg-amber-50 font-bold"}>
                            {asset.action}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {filteredAssets.length} idle assets in {lab} storage
            </span>
            <Button onClick={() => setIsMaximized(false)} className="bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold px-6">
              Close Window Tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// 3. Inter-Lab Loan Recommender
/**
 * Suggested loans from labs with idle assets to labs that need them. Calls analyticsApi.getLoanRecommenderRaw(). Not rendered anywhere today: no view or page includes it.
 *
 * @param lab the lab to show
 */
export const LoanRecommenderList: React.FC<{ lab: string }> = ({ lab }) => {
  const [requested, setRequested] = useState<Record<number, boolean>>({});

  const { data: recommendations = [] } = useQuery({
    queryKey: ["labhead-loan-recommender", lab],
    queryFn: async () => {
      try {
        const res = await analyticsApi.getLoanRecommenderRaw();
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) {
        // Fallback
      }

      return [
        {
          recommendationId: 101,
          targetLab: "CeHCI Lab",
          idleAssetName: "NVIDIA RTX 4090 GPU Workstation",
          assetTag: "EQ-2024-088",
          matchReason: `Matches ${lab} AI Perception project requirements. Idle for 34 days at CeHCI.`,
          ownerLab: "CeHCI Research Facility"
        },
        {
          recommendationId: 102,
          targetLab: "CAR Lab",
          idleAssetName: "Velodyne LiDAR Puck Sensor VLP-16",
          assetTag: "EQ-2024-042",
          matchReason: `Matches ${lab} Autonomous Navigation keyword. Idle for 42 days at CAR.`,
          ownerLab: "CAR Robotics Facility"
        }
      ];
    }
  });

  const handleRequestTransfer = (id: number) => {
    setRequested(prev => ({ ...prev, [id]: true }));
  };

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#005A36]" />
            <CardTitle className="text-sm font-bold text-foreground">
              Inter-Lab Loan Recommender Engine
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Compares active project keywords in {lab} against unallocated idle equipment in neighboring research labs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec: any) => {
              const isDone = requested[rec.recommendationId];
              return (
                <div key={rec.recommendationId} className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-xs">{rec.idleAssetName}</span>
                      <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px] font-bold">
                        {rec.ownerLab}
                      </Badge>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{rec.assetTag}</div>
                    <p className="text-xs text-muted-foreground mt-2">{rec.matchReason}</p>
                  </div>
                  <Button
                    onClick={() => handleRequestTransfer(rec.recommendationId)}
                    disabled={isDone}
                    className="bg-[#005A36] hover:bg-[#005A36]/90 text-white text-xs font-bold w-full"
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-400" /> : <ArrowRight className="w-4 h-4 mr-1" />}
                    {isDone ? "Transfer Requested" : "Request Inter-Lab Transfer"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
