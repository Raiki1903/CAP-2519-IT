import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useApp } from "../context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
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
  Line,
  ComposedChart
} from "recharts";
import {
  Wrench,
  MapPin,
  Activity,
  AlertTriangle,
  Settings,
  Calendar,
  Truck,
  CheckCircle2,
  ListOrdered,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";

const cardAnimation = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
};

const STATUS_PIE_COLORS = ["#005A36", "#3B82F6", "#F59E0B", "#EF4444"];

// Maintenance & Lifecycle View (Task 3: Repairs Kanban Board, Condition Heatmap with Traffic Light Indicators, 90-day Warranty Expiry Timeline)
export const TSGTechnicalMaintenanceSection: React.FC<{
  startDate: string;
  endDate: string;
  selectedLab: string;
  selectedCategory: string;
}> = ({ startDate, endDate, selectedLab, selectedCategory }) => {
  const [isKanbanOpen, setIsKanbanOpen] = React.useState<boolean>(true);

  const { data, refetch } = useQuery({
    queryKey: ["tsg-technical-maintenance", startDate, endDate],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        const res = await fetch(`http://localhost:4000/api/analytics/tsg?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          console.log("📊 [TSG API Response]:", json);
          if (json.success) return json.data;
        }
      } catch (e) {}
      return null;
    }
  });

  const [updatingRepairId, setUpdatingRepairId] = React.useState<number | null>(null);

  const moveRepairStatus = async (repairId: number, newStatus: string) => {
    setUpdatingRepairId(repairId);
    try {
      const res = await fetch(`http://localhost:4000/api/asset_repairs/${repairId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressStatus: newStatus })
      });
      const json = await res.json();
      if (json.success) {
        await refetch();
      }
    } catch (e) {
      console.error("Failed to update repair status:", e);
    } finally {
      setUpdatingRepairId(null);
    }
  };

  const rawRepairs = data?.repairs || [];
  const rawConditionSummary = data?.conditionSummary || { goodCount: 0, degradedCount: 0, criticalCount: 0, conditionItems: [] };
  const rawWarrantyExpiringSoon = data?.warrantyExpiringSoon || [];

  // Filter Repairs by Date Range, Lab, and Category
  const repairs = rawRepairs.filter((r: any) => {
    if (startDate && r.createdAt && new Date(r.createdAt) < new Date(startDate)) return false;
    if (endDate && r.createdAt && new Date(r.createdAt) > new Date(endDate + "T23:59:59")) return false;
    if (selectedLab !== "All Labs" && !r.assetId?.startsWith(selectedLab + "-") && !r.assetName?.toLowerCase().includes(selectedLab.toLowerCase())) return false;
    return true;
  });

  // Filter Condition Heatmap Items by Lab and Category
  const filteredConditionItems = rawConditionSummary.conditionItems.filter((item: any) => {
    if (selectedLab !== "All Labs") {
      const matchLoc = item.location?.toLowerCase().includes(selectedLab.toLowerCase());
      const matchPrefix = item.assetTag?.startsWith(selectedLab + "-");
      if (!matchLoc && !matchPrefix) return false;
    }
    if (selectedCategory !== "All Categories") {
      const normalizedCategory = selectedCategory.replace(/_/g, " ").toLowerCase();
      if (!item.category?.toLowerCase().includes(normalizedCategory)) return false;
    }
    return true;
  });

  const goodCount = filteredConditionItems.filter((i: any) => i.trafficLight === "GREEN").length;
  const degradedCount = filteredConditionItems.filter((i: any) => i.trafficLight === "YELLOW").length;
  const criticalCount = filteredConditionItems.filter((i: any) => i.trafficLight === "RED").length;

  const KANBAN_COLUMNS = [
    { id: "Reported", title: "Reported", badgeColor: "bg-red-500 text-white" },
    { id: "Diagnosing", title: "Diagnosing", badgeColor: "bg-amber-500 text-white" },
    { id: "Waiting for Parts", title: "Waiting for Parts", badgeColor: "bg-blue-500 text-white" },
    { id: "Resolved", title: "Resolved", badgeColor: "bg-emerald-600 text-white" }
  ];

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible" className="space-y-6">
      {/* 1. Kanban Board (Repairs) */}
      <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Wrench className="w-5 h-5 text-[#005A36]" /> Repair Operations Kanban Board (`asset_repairs`)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Move repair cards across columns: "Reported", "Diagnosing", "Waiting for Parts", "Resolved" to trigger MySQL DB progress_status updates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#005A36] text-white font-extrabold text-xs px-3 py-1">
              {repairs.length} Repair Tickets
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsKanbanOpen(!isKanbanOpen)}
              className="text-xs font-bold gap-1 border-border text-foreground hover:bg-muted"
            >
              {isKanbanOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {isKanbanOpen ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>

        {isKanbanOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {KANBAN_COLUMNS.map(col => {
              const columnTickets = repairs.filter((r: any) => {
                const st = (r.progressStatus || "Reported").toLowerCase();
                if (col.id === "Reported") return st.includes("report") || st.includes("pending");
                if (col.id === "Diagnosing") return st.includes("diagno") || st.includes("repair") || st.includes("progress");
                if (col.id === "Waiting for Parts") return st.includes("part") || st.includes("wait") || st.includes("third");
                if (col.id === "Resolved") return st.includes("resolv") || st.includes("fix") || st.includes("complet");
                return false;
              });

              return (
                <div key={col.id} className="bg-muted/30 border border-border rounded-xl p-3 flex flex-col justify-between max-h-[480px]">
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border pb-2 mb-3 shrink-0">
                      <span className="font-extrabold text-xs text-foreground uppercase tracking-wider">{col.title}</span>
                      <Badge className={cn("text-[10px] font-extrabold px-2 py-0.5", col.badgeColor)}>
                        {columnTickets.length}
                      </Badge>
                    </div>

                    <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                      {columnTickets.map((ticket: any) => (
                        <div key={ticket.repairId} className="bg-card border border-border rounded-lg p-3 shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-primary">TICKET #{ticket.repairId}</span>
                            <span className="text-[10px] text-muted-foreground">{ticket.createdAt}</span>
                          </div>
                          <p className="text-xs font-bold text-foreground leading-snug">{ticket.assetName} <span className="text-[10px] text-muted-foreground font-mono">({ticket.assetId})</span></p>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 italic">"{ticket.issueDescription}"</p>

                          <div className="pt-2 border-t border-border flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground font-semibold">Reporter: {ticket.reportedBy}</span>

                            <select
                              value={col.id}
                              disabled={updatingRepairId === ticket.repairId}
                              onChange={(e) => moveRepairStatus(ticket.repairId, e.target.value)}
                              className="text-[10px] font-bold bg-muted border border-border rounded px-1.5 py-0.5 text-foreground cursor-pointer"
                            >
                              <option value="Reported">Reported</option>
                              <option value="Diagnosing">Diagnosing</option>
                              <option value="Waiting for Parts">Waiting for Parts</option>
                              <option value="Resolved">Resolved</option>
                            </select>
                          </div>
                        </div>
                      ))}

                      {columnTickets.length === 0 && (
                        <div className="p-4 text-center text-xs text-muted-foreground italic bg-background/50 rounded-lg border border-dashed border-border">
                          No tickets in {col.title}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 2 & 3. Condition Heatmap & 90-Day Warranty Expiry Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Condition Heatmap/Grid with Traffic Light Indicators */}
        <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#005A36]" /> Condition Heatmap: Traffic Light Indicators
            </h3>
            <Badge variant="outline" className="text-xs font-bold border-border">
              {filteredConditionItems.length} Assets Filtered
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Green ('GOOD'/'PERFECT'/'OPERATIONAL'), Yellow ('DEGRADED'/'MINOR_DRIFT'), Red ('CRITICAL DEFECT').
          </p>

          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 rounded-xl">
              <span className="text-[9px] font-extrabold text-emerald-700 uppercase tracking-widest block">Green: GOOD / OPERATIONAL</span>
              <span className="text-2xl font-black text-emerald-700 font-mono">{goodCount}</span>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-xl">
              <span className="text-[9px] font-extrabold text-amber-700 uppercase tracking-widest block">Yellow: DEGRADED</span>
              <span className="text-2xl font-black text-amber-700 font-mono">{degradedCount}</span>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-xl">
              <span className="text-[9px] font-extrabold text-red-700 uppercase tracking-widest block">Red: CRITICAL DEFECT</span>
              <span className="text-2xl font-black text-red-700 font-mono">{criticalCount}</span>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
            {filteredConditionItems.map((item: any) => {
              const isGreen = item.trafficLight === "GREEN";
              const isYellow = item.trafficLight === "YELLOW";

              return (
                <div key={item.assetTag} className="flex items-center justify-between p-2.5 bg-muted/20 border border-border rounded-lg text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("w-3 h-3 rounded-full flex-shrink-0", isGreen ? "bg-emerald-500 shadow-emerald-500/50" : isYellow ? "bg-amber-500 shadow-amber-500/50" : "bg-red-500 animate-pulse")} />
                    <div>
                      <span className="font-bold text-foreground block">{item.name} ({item.assetTag})</span>
                      <span className="text-[10px] text-muted-foreground">{item.category} · {item.location}</span>
                    </div>
                  </div>
                  <Badge className={cn("text-[10px] font-bold", isGreen ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isYellow ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200")}>
                    {item.condition.replace(/_/g, " ")}
                  </Badge>
                </div>
              );
            })}

            {filteredConditionItems.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground italic bg-muted/10 rounded-xl border border-dashed border-border">
                No asset conditions matching selected filters.
              </div>
            )}
          </div>
        </Card>

        {/* Calendar/Timeline View (90-Day Warranty Expiry) */}
        <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#005A36]" /> Calendar/Timeline View: 90-Day Warranty Expiry
            </h3>
            <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-extrabold text-xs">
              {rawWarrantyExpiringSoon.length} Equipment Items
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Equipment losing manufacturer warranty support within the next 90 days.
          </p>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {rawWarrantyExpiringSoon.map((w: any) => (
              <div key={w.assetTag} className="p-3 bg-muted/20 border border-border rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-foreground block">{w.name} <span className="font-mono text-primary">({w.assetTag})</span></span>
                  <span className="text-[11px] text-muted-foreground">Manufacturer: {w.manufacturer} · Warranty Expiry: {w.warrantyExpiry}</span>
                </div>
                <Badge className={cn("text-[10px] font-extrabold px-2.5 py-1", w.isExpired ? "bg-red-600 text-white" : w.daysRemaining < 30 ? "bg-amber-600 text-white" : "bg-blue-600 text-white")}>
                  {w.isExpired ? "EXPIRED" : `${w.daysRemaining} days remaining`}
                </Badge>
              </div>
            ))}

            {rawWarrantyExpiringSoon.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground italic bg-muted/10 rounded-xl border border-dashed border-border">
                No equipment warranties expiring within the next 90 days.
              </div>
            )}
          </div>
        </Card>
      </div>
    </motion.div>
  );
};

// 1. Real-Time Tracking & Location Analytics (Stacked Bar & Doughnut)
export const LocationStatusWidget: React.FC<{
  selectedLab: string;
  selectedCategory: string;
}> = ({ selectedLab, selectedCategory }) => {
  const { assets: contextAssets } = useApp();

  const { data } = useQuery({
    queryKey: ["tsg-location-status"],
    queryFn: async () => {
      try {
        const res = await fetch("http://localhost:4000/api/analytics/location-status");
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) {}

      const locMap: Record<string, number> = {};
      contextAssets.forEach(a => {
        const loc = a.lab || "ITS Main Warehouse";
        locMap[loc] = (locMap[loc] || 0) + 1;
      });

      const locationDistribution = Object.keys(locMap).map(loc => ({
        location: loc,
        available: Math.floor(locMap[loc] * 0.6),
        onLoan: Math.floor(locMap[loc] * 0.3),
        underRepair: Math.floor(locMap[loc] * 0.1)
      }));

      const statusCounts = [
        { name: "Available", value: Math.floor(contextAssets.length * 0.6) },
        { name: "On Loan", value: Math.floor(contextAssets.length * 0.3) },
        { name: "Under Repair", value: Math.floor(contextAssets.length * 0.08) },
        { name: "Disposed", value: Math.floor(contextAssets.length * 0.02) }
      ];

      return { locationDistribution, statusCounts };
    }
  });

  const rawLocationData = data?.locationDistribution || [];
  const rawStatusData = data?.statusCounts || [];

  // Dynamically Filter Location Distribution by Selected Lab
  const locationData = rawLocationData.filter((item: any) => {
    if (selectedLab !== "All Labs" && !item.location?.toLowerCase().includes(selectedLab.toLowerCase())) return false;
    return true;
  });

  // Calculate statusCounts dynamically from contextAssets if filters are active
  const filteredContextAssets = contextAssets.filter(a => {
    if (selectedLab !== "All Labs" && !a.lab?.toLowerCase().includes(selectedLab.toLowerCase()) && !a.id?.startsWith(selectedLab + "-")) return false;
    if (selectedCategory !== "All Categories" && !a.category?.toLowerCase().includes(selectedCategory.replace(/_/g, " ").toLowerCase())) return false;
    return true;
  });

  const statusData = (selectedLab !== "All Labs" || selectedCategory !== "All Categories")
    ? [
        { name: "Available", value: filteredContextAssets.filter(a => a.status === "Active" || a.status === "Available").length },
        { name: "On Loan", value: filteredContextAssets.filter(a => a.status === "On Loan" || a.status === "Loaned").length },
        { name: "Under Repair", value: filteredContextAssets.filter(a => a.status === "Maintenance" || a.status === "Repair").length },
        { name: "Disposed", value: filteredContextAssets.filter(a => a.status === "Disposed").length }
      ]
    : rawStatusData;

  const totalAssetCount = statusData.reduce((acc: number, item: any) => acc + (item.value || 0), 0);

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#005A36]" />
            <CardTitle className="text-sm font-bold text-foreground">
              Real-Time Location & Inventory Distribution
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Equipment count per physical research laboratory & warehouse facility stacked by operational state.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="location" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="available" stackId="a" fill="#005A36" name="Available" radius={[0, 0, 0, 0]} />
                <Bar dataKey="onLoan" stackId="a" fill="#3B82F6" name="On Loan" radius={[0, 0, 0, 0]} />
                <Bar dataKey="underRepair" stackId="a" fill="#F59E0B" name="Under Repair" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl flex flex-col justify-between">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-foreground">Aggregate Operational Status</CardTitle>
          <CardDescription className="text-muted-foreground text-xs">Institute-wide asset availability state.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-4">
          <div className="relative h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={3}
                >
                  {statusData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={STATUS_PIE_COLORS[index % STATUS_PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ payload }) => {
                    if (payload && payload.length) {
                      const item = payload[0];
                      const val = item.value as number;
                      const pct = totalAssetCount > 0 ? ((val / totalAssetCount) * 100).toFixed(1) : 0;
                      return (
                        <div className="bg-popover border border-border p-2 rounded-lg shadow-md text-xs">
                          <span className="font-bold text-foreground">{item.name}</span>: <strong>{val} Assets</strong> ({pct}%)
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Donut Center Metric */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-foreground font-mono">{totalAssetCount}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Assets</span>
            </div>
          </div>

          {/* Dense Numeric Legend */}
          <div className="grid grid-cols-2 gap-2 w-full mt-3 pt-3 border-t border-border">
            {statusData.map((item: any, idx: number) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_PIE_COLORS[idx % STATUS_PIE_COLORS.length] }} />
                <span className="text-muted-foreground font-medium truncate">{item.name}:</span>
                <strong className="text-foreground font-extrabold font-mono ml-auto">{item.value}</strong>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 2. Warranty Expiration Calendar Widget (Strict 90-Day Timeline)
export const WarrantyCalendarWidget: React.FC = () => {
  const { data: expiringAssets = [] } = useQuery({
    queryKey: ["tsg-warranty-calendar"],
    queryFn: async () => {
      try {
        const res = await fetch("http://localhost:4000/api/assets");
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.assets)) {
            const now = Date.now();
            return json.assets
              .filter((a: any) => {
                if (!a.warranty) return false;
                const exp = new Date(a.warranty);
                const diffDays = Math.ceil((exp.getTime() - now) / (1000 * 60 * 60 * 24));
                return diffDays <= 90; // Strictly <= 90 days remaining or expired
              })
              .slice(0, 6)
              .map((a: any) => {
                const exp = new Date(a.warranty);
                const diffDays = Math.ceil((exp.getTime() - now) / (1000 * 60 * 60 * 24));
                return {
                  assetId: a.id,
                  assetTag: a.id,
                  name: a.name,
                  category: a.category,
                  daysRemaining: diffDays,
                  isExpired: diffDays < 0
                };
              });
          }
        }
      } catch (e) {}

      return [];
    }
  });

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-sm font-bold text-foreground">
                Warranty Expiration & Vendor Lifecycle Calendar (90-Day Filter)
              </CardTitle>
            </div>
            <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 font-extrabold text-xs">
              {expiringAssets.length} Expiring Items (≤90 Days)
            </Badge>
          </div>
          <CardDescription className="text-muted-foreground text-xs mt-1">
            Assets nearing manufacturer warranty expiration date (≤90 days) requiring service agreement checks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {expiringAssets.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground italic bg-muted/10 rounded-xl border border-dashed border-border">
              No equipment warranties expiring within the next 90 days.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {expiringAssets.map((asset: any) => {
                const isUrgent = asset.isExpired || asset.daysRemaining < 30;
                return (
                  <div key={asset.assetId} className={`p-4 rounded-xl border flex flex-col justify-between ${isUrgent ? "bg-red-50/50 border-red-200 dark:bg-red-950/20" : "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20"}`}>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-xs truncate max-w-[150px]">{asset.name}</span>
                        <Badge className={asset.isExpired ? "bg-red-700 text-white font-bold" : isUrgent ? "bg-red-600 text-white font-bold" : "bg-amber-600 text-white font-bold"}>
                          {asset.isExpired ? "EXPIRED" : `${asset.daysRemaining} Days Left`}
                        </Badge>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-1">{asset.assetTag} • {asset.category}</div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Warranty Action:</span>
                      <strong className={isUrgent ? "text-red-700 font-bold" : "text-amber-800 font-bold"}>
                        {asset.isExpired ? "Out of Warranty" : isUrgent ? "Immediate Renewal" : "Routine Check"}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 3. Staggered Routine Inspection Progress (Stepper Layout & Collapsible)
export const InspectionProgressTracker: React.FC = () => {
  const [isTrackerOpen, setIsTrackerOpen] = React.useState<boolean>(true);

  const { data: progressGroups = [] } = useQuery({
    queryKey: ["tsg-inspection-progress"],
    queryFn: async () => {
      try {
        const res = await fetch("http://localhost:4000/api/analytics/advanced/inspection-progress");
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) {}

      return [
        { group: "Group A (CITe4D, CAR, CNIS)", inspected: 42, total: 45, percent: 93 },
        { group: "Group B (CeHCI, CeLT, TE3D)", inspected: 28, total: 35, percent: 80 },
        { group: "Group C (GAME, Bio)", inspected: 19, total: 30, percent: 63 },
        { group: "Group D (CIVI, HXIL)", inspected: 25, total: 25, percent: 100 }
      ];
    }
  });

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-sm font-bold text-foreground">
                Staggered Routine Inspection Progress Tracker
              </CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTrackerOpen(!isTrackerOpen)}
              className="text-xs font-bold gap-1 border-border text-foreground hover:bg-muted"
            >
              {isTrackerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {isTrackerOpen ? "Collapse" : "Expand"}
            </Button>
          </div>
          <CardDescription className="text-muted-foreground text-xs mt-1">
            Term routine inspection completion rate categorized by defined lab asset group stepper (Groups A, B, C, D).
          </CardDescription>
        </CardHeader>
        {isTrackerOpen && (
          <CardContent>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {progressGroups.map((g: any, idx: number) => (
                <div key={idx} className="p-3.5 bg-muted/20 border border-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">{g.group}</span>
                    <Badge className={g.percent === 100 ? "bg-[#005A36] text-white font-bold" : "bg-indigo-600 text-white font-bold"}>
                      {g.inspected} / {g.total} Inspected ({g.percent}%)
                    </Badge>
                  </div>
                  <Progress value={g.percent} className="h-2.5 bg-slate-100" />
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
};

const LAB_OPTIONS = ["All Labs", "CITe4D", "CAR", "GAME", "CIVI", "CeHCI", "Bio", "TE3D", "CeLT", "HXIL", "CNIS"];
const CATEGORY_OPTIONS = ["All Categories", "DEV_KIT", "MONITOR", "WORKSTATION", "ROBOTICS", "SENSOR", "NETWORKING", "ACCESSORY"];

// Master TSG Dashboard Analytics View
export const TSGAnalyticsView: React.FC = () => {
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [selectedLab, setSelectedLab] = React.useState<string>("All Labs");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("All Categories");

  const hasActiveFilters = Boolean(startDate || endDate || selectedLab !== "All Labs" || selectedCategory !== "All Categories");

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedLab("All Labs");
    setSelectedCategory("All Categories");
  };

  return (
    <div className="space-y-8 text-foreground font-sans">
      {/* Global Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-4 bg-muted/40 border border-border rounded-xl p-4 shadow-2xs">
        <span className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-[#005A36]" /> Dashboard Filters:
        </span>

        {/* Date Filters */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground font-medium">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="bg-background border border-border rounded px-2.5 py-1 text-foreground font-semibold text-xs focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground font-medium">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="bg-background border border-border rounded px-2.5 py-1 text-foreground font-semibold text-xs focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Lab Filter Dropdown */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground font-medium">Lab:</span>
          <select
            value={selectedLab}
            onChange={e => setSelectedLab(e.target.value)}
            className="bg-background border border-border rounded px-2.5 py-1 text-foreground font-semibold text-xs cursor-pointer focus:ring-1 focus:ring-primary"
          >
            {LAB_OPTIONS.map(lab => (
              <option key={lab} value={lab}>{lab}</option>
            ))}
          </select>
        </div>

        {/* Category Filter Dropdown */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground font-medium">Category:</span>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="bg-background border border-border rounded px-2.5 py-1 text-foreground font-semibold text-xs cursor-pointer focus:ring-1 focus:ring-primary"
          >
            {CATEGORY_OPTIONS.map(cat => (
              <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        {/* Reset Action */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      <TSGTechnicalMaintenanceSection
        startDate={startDate}
        endDate={endDate}
        selectedLab={selectedLab}
        selectedCategory={selectedCategory}
      />

      <LocationStatusWidget
        selectedLab={selectedLab}
        selectedCategory={selectedCategory}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WarrantyCalendarWidget />
        <InspectionProgressTracker />
      </div>
    </div>
  );
};

export default TSGAnalyticsView;
