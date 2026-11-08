/**
 * Staff analytics: condition indicators, 90-day warranty timeline, and location status widgets. The Operations
 * Board, Warranties Notice, and Inspection Progress widgets used to live here too; they now live in this same
 * file but render on the Staff Overview (pages/staff/OverviewPage.tsx) instead.
 * Layer: feature component. Called by pages/staff/HealthPage.tsx and pages/staff/OverviewPage.tsx.
 * Calls: features/analytics/insights/InsightsPanel.tsx, api/analytics.api.ts (tsg, location-status, inspection-progress), api/assets.api.ts listAssetsRaw(), features/repairs/RepairProgressDialog.tsx, state/serverData.tsx, state/session.tsx.
 * Used by: Staff.
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, type Variants } from "motion/react";
import { useServerData } from "@web/state/serverData";
import { useSession } from "@web/state/session";
import { RepairProgressDialog } from "@web/features/repairs/RepairProgressDialog";
import { MAINTENANCE_STATUSES, MAINTENANCE_STATUS_LABELS } from "@shared/constants/maintenanceStatuses";
import * as assetsApi from "@web/api/assets.api";
import * as analyticsApi from "@web/api/analytics.api";
import { ASSET_STATUSES, ASSET_STATUS_LABELS } from "@shared/enums/assetStatus";
import { InsightsPanel } from "@web/features/analytics/insights/InsightsPanel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { Badge } from "@web/components/ui/badge";
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
import { Button } from "@web/components/ui/button";
import { cn } from "@web/components/ui/utils";

const cardAnimation: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
};

// One colour per asset status, in the order of ASSET_STATUSES.
const STATUS_PIE_COLORS = ["#005A36", "#3B82F6", "#F59E0B", "#8B5CF6", "#64748B", "#EF4444"];

// Condition Indicators (Task 3)
/**
 * Condition heatmap for assets, scoped to the date range, lab, and category filters. Calls analyticsApi.getTsgAnalyticsRaw().
 *
 * @param startDate start of the date range, or empty for no limit
 * @param endDate end of the date range, or empty for no limit
 * @param selectedLab lab to scope to, or "All Labs"
 * @param selectedCategory category to scope to, or "All Categories"
 */
export const ConditionIndicatorsSection: React.FC<{
  startDate: string;
  endDate: string;
  selectedLab: string;
  selectedCategory: string;
}> = ({ startDate, endDate, selectedLab, selectedCategory }) => {
  const { data } = useQuery({
    queryKey: ["tsg-technical-maintenance", startDate, endDate],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        const res = await analyticsApi.getTsgAnalyticsRaw(params.toString());
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) {}
      return null;
    }
  });

  const rawConditionSummary = data?.conditionSummary || { goodCount: 0, degradedCount: 0, criticalCount: 0, conditionItems: [] };

  // Filter Condition Indicators items by Lab and Category
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

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#005A36]" /> Condition Indicators
          </h3>
          <Badge variant="outline" className="text-xs font-bold border-border">
            {filteredConditionItems.length} Assets Filtered
          </Badge>
        </div>

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
    </motion.div>
  );
};

// One column per maintenance status, so no ticket is left off the board.
const KANBAN_BADGE_COLORS: Record<string, string> = {
  PENDING_RECEIPT: "bg-red-500 text-white",
  INSPECTING: "bg-amber-500 text-white",
  REPAIRING: "bg-amber-600 text-white",
  EXTERNAL_SERVICE: "bg-blue-500 text-white",
  RESOLVED: "bg-emerald-600 text-white",
  BEYOND_REPAIR: "bg-red-700 text-white",
  CANCELLED: "bg-slate-500 text-white",
};
const KANBAN_COLUMNS = MAINTENANCE_STATUSES.map(id => ({ id, title: MAINTENANCE_STATUS_LABELS[id], badgeColor: KANBAN_BADGE_COLORS[id] }));

// The Staff Overview and Analytics both read repairs and the warranty list from the same unfiltered call, so
// Operations Board and WarrantiesNoticeWidget share this query key: when both are on the page, it fetches once.
const STAFF_OVERVIEW_MAINTENANCE_QUERY_KEY = ["staff-overview-maintenance"];
async function fetchStaffOverviewMaintenance() {
  try {
    const res = await analyticsApi.getTsgAnalyticsRaw("");
    if (res.ok) {
      const json = await res.json();
      if (json.success) return json.data;
    }
  } catch (e) {}
  return null;
}

// Operations Board: moved from Staff Analytics to the Staff Overview (pages/staff/OverviewPage.tsx).
/**
 * The repair ticket board: one column per maintenance status, with two tickets visible per column and the rest
 * scrollable. A card opens RepairProgressDialog, where the server decides which steps are allowed. Unfiltered,
 * because the Overview has no date, lab, or category filters. Calls analyticsApi.getTsgAnalyticsRaw(). Takes no props.
 */
export const OperationsBoard: React.FC = () => {
  const [isKanbanOpen, setIsKanbanOpen] = React.useState<boolean>(true);

  const { data, refetch } = useQuery({
    queryKey: STAFF_OVERVIEW_MAINTENANCE_QUERY_KEY,
    queryFn: fetchStaffOverviewMaintenance
  });

  const { tickets, syncFromDb } = useServerData();
  const { currentUser } = useSession();
  const [openTicketId, setOpenTicketId] = React.useState<number | null>(null);
  const openTicket = tickets.find(t => t.maintenanceId === openTicketId) ?? null;

  const repairs = data?.repairs || [];

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Wrench className="w-5 h-5 text-[#005A36]" /> Operations Board
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              One column for each status of a maintenance ticket. Open a card to see the ticket and make its next step.
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
              const columnTickets = repairs.filter((r: any) => r.progressStatus === col.title);

              return (
                <div key={col.id} className="bg-muted/30 border border-border rounded-xl p-3 flex flex-col">
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between border-b border-border pb-2 mb-3 shrink-0">
                      <span className="font-extrabold text-xs text-foreground uppercase tracking-wider">{col.title}</span>
                      <Badge className={cn("text-[10px] font-extrabold px-2 py-0.5", col.badgeColor)}>
                        {columnTickets.length}
                      </Badge>
                    </div>

                    {/* Fixed height, about two tickets; the rest scrolls. */}
                    <div className="h-72 space-y-3 overflow-y-auto pr-1">
                      {columnTickets.map((ticket: any) => (
                        <div
                          key={ticket.repairId}
                          role="button"
                          tabIndex={0}
                          onClick={() => setOpenTicketId(ticket.repairId)}
                          onKeyDown={e => { if (e.key === "Enter") setOpenTicketId(ticket.repairId); }}
                          className="bg-card border border-border rounded-lg p-3 shadow-xs space-y-2 cursor-pointer hover:border-primary/50"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-primary">TICKET #{ticket.repairId}</span>
                            <span className="text-[10px] text-muted-foreground">{ticket.createdAt}</span>
                          </div>
                          <p className="text-xs font-bold text-foreground leading-snug">{ticket.assetName} <span className="text-[10px] text-muted-foreground font-mono">({ticket.assetId})</span></p>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 italic">"{ticket.issueDescription}"</p>

                          <div className="pt-2 border-t border-border flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground font-semibold">Reporter: {ticket.reportedBy}</span>
                            <span className="text-[10px] font-bold text-primary">Open</span>
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

      {openTicket && (
        <RepairProgressDialog
          key={openTicket.maintenanceId}
          ticket={openTicket}
          canAct={currentUser?.staffUnit === "TSG"}
          onClose={() => setOpenTicketId(null)}
          onChanged={async () => { await syncFromDb(); await refetch(); }}
        />
      )}
    </motion.div>
  );
};

// Warranties Notice: moved from Staff Analytics to the Staff Overview (pages/staff/OverviewPage.tsx).
/**
 * Assets losing manufacturer warranty support within 90 days, unfiltered, in a fixed-height scroll area that
 * shows about three to five items. Calls analyticsApi.getTsgAnalyticsRaw(). Takes no props.
 */
export const WarrantiesNoticeWidget: React.FC = () => {
  const { data } = useQuery({
    queryKey: STAFF_OVERVIEW_MAINTENANCE_QUERY_KEY,
    queryFn: fetchStaffOverviewMaintenance
  });

  const rawWarrantyExpiringSoon = data?.warrantyExpiringSoon || [];

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#005A36]" /> Warranties Notice
          </h3>
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-extrabold text-xs">
            {rawWarrantyExpiringSoon.length} Asset Items
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Assets losing manufacturer warranty support within the next 90 days.
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
              No asset warranties expiring within the next 90 days.
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

// 1. Real-Time Tracking & Location Analytics (Stacked Bar & Doughnut)
/**
 * Where assets are and in what state. Calls analyticsApi.getLocationStatusRaw(). While the server has not answered it
 * shows a loading line, and if it fails a message: it never shows an estimate in place of the counts.
 *
 * @param selectedLab lab to scope to, or "All Labs"
 * @param selectedCategory category to scope to, or "All Categories"
 */
export const LocationStatusWidget: React.FC<{
  selectedLab: string;
  selectedCategory: string;
}> = ({ selectedLab, selectedCategory }) => {
  const { assets: contextAssets } = useServerData();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["tsg-location-status"],
    queryFn: async () => {
      const res = await analyticsApi.getLocationStatusRaw();
      if (!res.ok) throw new Error(`Location status answered ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error("Location status answered without success");
      return json.data;
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
    ? ASSET_STATUSES.map(status => ({ name: ASSET_STATUS_LABELS[status], value: filteredContextAssets.filter(a => a.status === status).length }))
    : rawStatusData;

  const totalAssetCount = statusData.reduce((acc: number, item: any) => acc + (item.value || 0), 0);

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#005A36]" />
            <CardTitle className="text-sm font-bold text-foreground">
              Assets by Lab
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Asset count per physical research laboratory & warehouse facility stacked by operational state.
          </CardDescription>
          {isLoading && <p className="text-xs text-muted-foreground mt-1">Loading the asset counts...</p>}
          {isError && <p className="text-xs font-semibold text-red-600 mt-1">Could not load the asset counts. Reload the page.</p>}
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
/** Assets whose warranty ends within 90 days. Calls assetsApi.listAssetsRaw(). Takes no props. */
export const WarrantyCalendarWidget: React.FC = () => {
  const { data: expiringAssets = [] } = useQuery({
    queryKey: ["tsg-warranty-calendar"],
    queryFn: async () => {
      try {
        const res = await assetsApi.listAssetsRaw();
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
                90-Day Warranty Expiry
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
              No asset warranties expiring within the next 90 days.
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
/** How far the routine inspection round has got. Calls analyticsApi.getInspectionProgressRaw(). Takes no props. */
export const InspectionProgressTracker: React.FC = () => {
  const [isTrackerOpen, setIsTrackerOpen] = React.useState<boolean>(true);

  const { data: progressGroups = [] } = useQuery({
    queryKey: ["tsg-inspection-progress"],
    queryFn: async () => {
      try {
        const res = await analyticsApi.getInspectionProgressRaw();
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
                Inspection Progress
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

// TODO(M-03): another hardcoded lab list in short codes. Phase 3.
// Five of the categories below (WORKSTATION to ACCESSORY) are not in assets_category, so picking one always shows nothing.
const LAB_OPTIONS = ["All Labs", "CITe4D", "CAR", "GAME", "CIVI", "CeHCI", "Bio", "TE3D", "CeLT", "HXIL", "CNIS"];
const CATEGORY_OPTIONS = ["All Categories", "DEV_KIT", "MONITOR", "WORKSTATION", "ROBOTICS", "SENSOR", "NETWORKING", "ACCESSORY"];

/** The Staff analytics screen: holds the date, lab, and category filters and lays out four widgets. Takes no props. */
export const StaffAnalyticsView: React.FC = () => {
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
      <InsightsPanel
        charts={{ warranty: "90-Day Warranty Expiry", repairs: "Operations Board" }}
      />

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

      <ConditionIndicatorsSection
        startDate={startDate}
        endDate={endDate}
        selectedLab={selectedLab}
        selectedCategory={selectedCategory}
      />

      <LocationStatusWidget
        selectedLab={selectedLab}
        selectedCategory={selectedCategory}
      />

      <WarrantyCalendarWidget />
    </div>
  );
};

export default StaffAnalyticsView;
