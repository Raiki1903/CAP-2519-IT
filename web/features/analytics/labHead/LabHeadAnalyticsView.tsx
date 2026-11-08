/**
 * Lab Head analytics: utilization, category mix, project allocation, and the overdue loans table for one lab.
 * Layer: feature component. Called by pages/lab-head/LabHeadDashboard.tsx (health tab).
 * Calls: api/analytics.api.ts getLabHeadAnalyticsRaw(), features/analytics/insights/InsightsPanel.tsx, features/analytics/utilization/LoansPerWeekChart.tsx.
 * Used by: Lab Head.
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import * as analyticsApi from "@web/api/analytics.api";
import { InsightsPanel } from "@web/features/analytics/insights/InsightsPanel";
import { LoansPerWeekChart } from "@web/features/analytics/utilization/LoansPerWeekChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@web/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Treemap,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import {
  Users,
  Clock,
  Send,
  Sparkles,
  Layers,
  Zap,
  Building,
  Maximize2,
  ExternalLink,
  Loader2
} from "lucide-react";

import { cn } from "@web/components/ui/utils";

const cardAnimation = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
};

// Operational & Localized View (Task 2: Actionable Data Table for loans with Approve/Reject buttons, Utilization Gauge, Category Breakdown Horizontal Bar Chart)
/**
 * Utilization gauge, category breakdown, and the lab's loan request list.
 * Calls analyticsApi.getLabHeadAnalyticsRaw().
 *
 * @param lab the lab the account heads, shown in the headings; the server answers for that lab whatever is sent
 */
export const LabHeadOperationalSection: React.FC<{ lab?: string }> = ({ lab = "" }) => {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["labhead-operational-analytics", lab, startDate, endDate],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (lab) {
          params.set("labPrefix", lab);
          params.set("lab", lab);
        }
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        const res = await analyticsApi.getLabHeadAnalyticsRaw(params.toString());
        if (res.ok) {
          const json = await res.json();
          console.log("📊 [LabHead API Response]:", json);
          if (json.success) return json.data;
        }
      } catch (e) { }
      return null;
    }
  });

  const [actingId, setActingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-4 bg-card rounded-xl border border-border">
        <div className="flex items-center gap-2 text-[#005A36] font-bold text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading analytics...</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-48 bg-muted/40 rounded-xl" />
          <div className="h-48 bg-muted/40 rounded-xl" />
        </div>
      </div>
    );
  }

  const loans = data?.loans || [];
  const utilization = data?.utilization || { utilizationPercentage: 0, onLoanCount: 0, notOnLoanCount: 0, totalAssetsCount: 0 };
  const categoryData = data?.categoryData || [];

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible" className="space-y-6">
      {/* Dynamic Date Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-muted/30 border border-border rounded-xl p-3">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">Dynamic Date Filters ({lab}):</span>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground font-medium">From:</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-background border border-border rounded px-2 py-1 text-foreground font-semibold" />
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground font-medium">To:</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-background border border-border rounded px-2 py-1 text-foreground font-semibold" />
        </div>
        {(startDate || endDate) && (
          <button onClick={() => { setStartDate(""); setEndDate(""); }} className="text-xs font-bold text-red-600 hover:underline">
            Reset Filters
          </button>
        )}
      </div>
      {/* 1 & 2. Utilization Gauge & Category Horizontal Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Bar / Gauge Chart (Utilization) */}
        <Card className="border border-border bg-card shadow-sm rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#005A36]" /> Assets On Loan
              </h3>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold text-xs">
                {utilization.utilizationPercentage}% On Loan
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Share of your lab's assets that are on loan now.
            </p>
          </div>

          <div className="my-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>On Loan: {utilization.onLoanCount} units</span>
              <span className="text-muted-foreground">Not on loan: {utilization.notOnLoanCount} units</span>
            </div>

            <div className="w-full h-6 bg-muted rounded-full overflow-hidden p-1 border border-border flex">
              <div
                className="h-full bg-gradient-to-r from-[#005A36] to-[#10B981] rounded-full transition-all duration-500 flex items-center justify-end pr-2 text-[10px] font-black text-white"
                style={{ width: `${Math.max(utilization.utilizationPercentage, 5)}%` }}
              >
                {utilization.utilizationPercentage}%
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-center text-xs">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200">
                <span className="text-[10px] text-muted-foreground block font-semibold">On Loan</span>
                <span className="font-extrabold text-[#005A36] text-sm font-mono">{utilization.onLoanCount} Assets</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200">
                <span className="text-[10px] text-muted-foreground block font-semibold">Not on loan</span>
                <span className="font-extrabold text-slate-700 dark:text-slate-200 text-sm font-mono">{utilization.notOnLoanCount} Assets</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Horizontal Bar Chart (Category Breakdown) */}
        <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#005A36]" /> Asset Category Breakdown
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Count of assets by category across the active inventory.
          </p>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={categoryData} margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" stroke="#64748B" fontSize={11} />
                <YAxis type="category" dataKey="category" stroke="#64748B" fontSize={10} width={110} />
                <Tooltip />
                <Bar dataKey="count" fill="#005A36" radius={[0, 4, 4, 0]} name="Asset Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Actionable Asset Loan Requests Table */}
      <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
        <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-2.5">
          Asset Loan Requests
        </h3>
        {/* Fixed height: the list scrolls, and the header stays. The table's own sideways scroll moves to this box. */}
        <div className="max-h-80 overflow-auto rounded-lg border border-border [&_[data-slot=table-container]]:overflow-visible">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="text-xs font-bold">Loan ID</TableHead>
                <TableHead className="text-xs font-bold">Asset Tag / Name</TableHead>
                <TableHead className="text-xs font-bold">Borrower</TableHead>
                <TableHead className="text-xs font-bold">Purpose</TableHead>
                <TableHead className="text-xs font-bold">Destination Lab</TableHead>
                <TableHead className="text-xs font-bold">Due Date</TableHead>
                <TableHead className="text-xs font-bold text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((loan: any) => {
                const isPending = loan.status === "Pending" || loan.status === "pending";
                const isApproved = loan.status === "Approved" || loan.status === "approved";
                const isWorking = actingId === `loan-${loan.loanId}`;

                return (
                  <TableRow key={loan.loanId} className="text-xs">
                    <TableCell className="font-mono font-bold text-primary">LOAN-{loan.loanId}</TableCell>
                    <TableCell className="font-semibold">{loan.asset} ({loan.assetId})</TableCell>
                    <TableCell>{loan.borrower}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{loan.purpose}</TableCell>
                    <TableCell className="text-[11px]">{loan.destinationLab || "—"}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{loan.dueDate}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn("text-[10px] font-extrabold", isApproved ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isPending ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200")}>
                        {loan.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

    </motion.div>
  );
};

// 1. Project-to-Asset Allocation Matrix (Treemap + Detail Modal)
/**
 * Which projects hold which of the lab's assets. Calls analyticsApi.getLabHeadAnalyticsRaw().
 *
 * @param lab the lab to show
 */
export const ProjectAllocationWidget: React.FC<{ lab: string }> = ({ lab }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  const { data: analyticsData } = useQuery({
    queryKey: ["labhead-analytics-data", lab],
    queryFn: async () => {
      try {
        const res = await analyticsApi.getLabHeadAnalyticsRaw(`labPrefix=${encodeURIComponent(lab)}&lab=${encodeURIComponent(lab)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) { }
      return null;
    }
  });

  const allocationItems = analyticsData?.projectAllocation || [];
  const previewItems = allocationItems.slice(0, 3);
  const totalUnits = allocationItems.reduce((acc: number, item: any) => acc + (item.count || item.size || 0), 0);

  return (
    <>
      <motion.div variants={cardAnimation} initial="hidden" animate="visible">
        <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl flex flex-col justify-between h-full">
          <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#005A36]" />
                <CardTitle className="text-sm font-bold text-foreground">
                  Assets by Project
                </CardTitle>
              </div>
              <CardDescription className="text-muted-foreground text-xs mt-0.5">
                Treemap blocks displaying in-use hardware proportion allocated across active research projects in {lab}.
              </CardDescription>
            </div>
            {allocationItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMaximized(true)}
                className="text-xs gap-1 border-[#005A36]/30 text-[#005A36] hover:bg-emerald-50 font-bold shrink-0"
                title="Expand"
              >
                <Maximize2 size={13} /> Expand
              </Button>
            )}
          </CardHeader>

          <CardContent className="pt-0 pb-2">
            {allocationItems.length === 0 ? (
              <div className="h-48 flex items-center justify-center p-6 bg-muted/10 rounded-xl border border-dashed border-border text-center">
                <p className="text-xs text-muted-foreground">No active project allocations found for {lab}.</p>
              </div>
            ) : (
              /* Visual Treemap Tile Block Matrix Preview */
              <div className="h-48 grid grid-cols-12 gap-2 p-2 bg-muted/10 rounded-xl border border-border">
                <div className="col-span-6 bg-[#005A36] text-white p-3.5 rounded-lg flex flex-col justify-between shadow-xs">
                  <span className="text-xs font-black truncate">{previewItems[0]?.name || "Primary Project"}</span>
                  <div>
                    <span className="text-xl font-extrabold block">{previewItems[0]?.count || 0} Units</span>
                    <span className="text-[10px] text-emerald-200 font-mono">{previewItems[0]?.pct || "0%"} Allocation Share</span>
                  </div>
                </div>

                <div className="col-span-6 grid grid-rows-2 gap-2">
                  <div className="bg-[#059669] text-white p-2.5 rounded-lg flex flex-col justify-between shadow-xs">
                    <span className="text-[11px] font-bold truncate">{previewItems[1]?.name || "Secondary Project"}</span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">{previewItems[1]?.count || 0} Units</span>
                      <span className="text-[9px] text-emerald-100 font-mono">{previewItems[1]?.pct || "0%"}</span>
                    </div>
                  </div>
                  <div className="bg-[#10B981] text-white p-2.5 rounded-lg flex flex-col justify-between shadow-xs">
                    <span className="text-[11px] font-bold truncate">{previewItems[2]?.name || "Tertiary Project"}</span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">{previewItems[2]?.count || 0} Units</span>
                      <span className="text-[9px] text-emerald-100 font-mono">{previewItems[2]?.pct || "0%"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <div className="px-6 pb-4 pt-1 flex items-center justify-between border-t border-border text-xs">
            <span className="text-muted-foreground text-[11px]">Showing project hardware allocations in {lab}</span>
            {allocationItems.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMaximized(true)}
                className="text-xs text-[#005A36] hover:text-[#005A36]/80 font-bold p-0 h-auto gap-1"
              >
                View Full Allocation Matrix <ExternalLink size={12} />
              </Button>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Maximized Window Tab Dialog Modal (75% Treemap Left / 25% Matrix Right) */}
      <Dialog open={isMaximized} onOpenChange={setIsMaximized}>
        <DialogContent className="w-[98vw] max-w-[1600px] max-h-[94vh] overflow-y-auto bg-card border-border text-card-foreground rounded-2xl p-6 sm:p-8 shadow-2xl my-auto">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="text-lg sm:text-xl font-extrabold text-[#005A36] flex items-center gap-2">
              <Layers className="w-6 h-6 text-[#005A36]" />
              Assets by Project ({lab})
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-4 items-stretch">
            {/* Left Column (75% Width = 9/12 Cols): Visual Treemap Tile Matrix */}
            <div className="lg:col-span-9 h-[500px] grid grid-cols-12 gap-4 p-4 bg-muted/20 rounded-xl border border-border">
              <div className="col-span-12 lg:col-span-7 bg-[#005A36] text-white p-6 rounded-2xl flex flex-col justify-between shadow-md">
                <div>
                  <Badge className="bg-white/20 text-white font-bold text-xs mb-2">
                    Primary Allocation ({allocationItems[0]?.pct || "36.3%"} Share)
                  </Badge>
                  <h4 className="text-xl sm:text-2xl font-black leading-tight">{allocationItems[0]?.name}</h4>
                  <p className="text-xs sm:text-sm text-emerald-100 mt-2 leading-relaxed">
                    The project with the most assets from your lab.
                  </p>
                </div>
                <div className="flex items-end justify-between border-t border-emerald-600/50 pt-4">
                  <div>
                    <span className="text-3xl sm:text-4xl font-black">{allocationItems[0]?.count || 45} Hardware Units</span>
                    <span className="text-xs sm:text-sm text-emerald-200 block font-mono mt-0.5">Valuation: ₱{(Number(allocationItems[0]?.value || 12500000) / 1000000).toFixed(1)}M</span>
                  </div>
                  <Badge className="bg-emerald-700 text-white font-bold text-xs px-3 py-1">Active Allocation</Badge>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-5 grid grid-rows-3 gap-3">
                <div className="bg-[#059669] text-white p-4 rounded-xl flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="font-extrabold text-sm sm:text-base">{allocationItems[1]?.name}</div>
                    <div className="text-xs text-emerald-100 mt-0.5">{allocationItems[1]?.count || 32} Units • {allocationItems[1]?.pct} Share</div>
                  </div>
                  <span className="font-mono text-sm font-black text-right">₱{(Number(allocationItems[1]?.value || 8200000) / 1000000).toFixed(1)}M</span>
                </div>

                <div className="bg-[#10B981] text-white p-4 rounded-xl flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="font-extrabold text-sm sm:text-base">{allocationItems[2]?.name}</div>
                    <div className="text-xs text-emerald-100 mt-0.5">{allocationItems[2]?.count || 28} Units • {allocationItems[2]?.pct} Share</div>
                  </div>
                  <span className="font-mono text-sm font-black text-right">₱{(Number(allocationItems[2]?.value || 6400000) / 1000000).toFixed(1)}M</span>
                </div>

                <div className="bg-[#34D399] text-slate-900 p-4 rounded-xl flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="font-extrabold text-sm sm:text-base">{allocationItems[3]?.name}</div>
                    <div className="text-xs text-slate-700 mt-0.5">{allocationItems[3]?.count || 19} Units • {allocationItems[3]?.pct} Share</div>
                  </div>
                  <span className="font-mono text-sm font-black text-right">₱{(Number(allocationItems[3]?.value || 3100000) / 1000000).toFixed(1)}M</span>
                </div>
              </div>
            </div>

            {/* Right Column (25% Width = 3/12 Cols): Itemized Matrix Table */}
            <div className="lg:col-span-3 h-[500px] flex flex-col justify-between bg-muted/10 border border-border rounded-xl p-4 overflow-y-auto space-y-3">
              <div>
                <div className="border-b border-border pb-2.5 mb-3">
                  <span className="text-[10px] font-extrabold text-[#005A36] uppercase tracking-wider block">
                    Matrix Breakdown (25%)
                  </span>
                  <h4 className="text-xs font-extrabold text-foreground mt-0.5">
                    Project Allocation Summary
                  </h4>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border bg-card">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold text-foreground px-2">Project</TableHead>
                        <TableHead className="text-[10px] font-bold text-foreground text-center px-1">Units</TableHead>
                        <TableHead className="text-[10px] font-bold text-foreground text-right px-2">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocationItems.map((item: any, idx: number) => (
                        <TableRow key={idx} className="border-b border-border text-[11px]">
                          <TableCell className="font-bold text-[#005A36] py-2 px-2 truncate max-w-[110px]" title={item.name}>
                            {item.name}
                          </TableCell>
                          <TableCell className="text-center font-bold text-foreground py-2 px-1">{item.count || item.size}</TableCell>
                          <TableCell className="text-right font-mono text-[10px] font-bold text-foreground py-2 px-2">
                            {item.pct}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="pt-2 border-t border-border flex flex-col gap-2">
                <Badge variant="outline" className="border-[#005A36] text-[#005A36] font-bold text-[10px] justify-center py-1">
                  Total: {totalUnits} Hardware Units
                </Badge>
                <Button onClick={() => setIsMaximized(false)} className="bg-[#005A36] hover:bg-[#005A36]/90 text-white text-xs font-bold w-full h-8">
                  Close Window Tab
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// 4. Custodianship & Delinquency Analytics (DataTable)
/**
 * Custodians with overdue assets in the lab. Calls analyticsApi.getLabHeadAnalyticsRaw().
 *
 * @param lab the lab to show
 */
export const DelinquencyTable: React.FC<{ lab: string }> = ({ lab }) => {
  const { data: analyticsData } = useQuery({
    queryKey: ["labhead-delinquencies-data", lab],
    queryFn: async () => {
      try {
        const res = await analyticsApi.getLabHeadAnalyticsRaw(`labPrefix=${encodeURIComponent(lab)}&lab=${encodeURIComponent(lab)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) { }
      return null;
    }
  });

  const delinquencies = analyticsData?.delinquencies || [];

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-600" />
              <CardTitle className="text-sm font-bold text-foreground">
                Overdue Loans: {lab}
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground text-xs mt-1">
              Active asset loans assigned to students in {lab} past expected return date (`asset_loans.return_by`). Reporting only.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50 font-bold text-xs">
            {delinquencies.length} Overdue Items
          </Badge>
        </CardHeader>
        <CardContent>
          {delinquencies.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No overdue student loans currently flagged in {lab}.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs font-bold text-foreground">Asset Name / Tag</TableHead>
                    <TableHead className="text-xs font-bold text-foreground">Student Custodian</TableHead>
                    <TableHead className="text-xs font-bold text-foreground">Research Cohort / Project</TableHead>
                    <TableHead className="text-xs font-bold text-foreground">Due Date</TableHead>
                    <TableHead className="text-right text-xs font-bold text-foreground">Days Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {delinquencies.map((item: any) => {
                    const isSevere = item.daysOverdue > 14;
                    return (
                      <TableRow key={item.id} className={isSevere ? "bg-red-50/50" : ""}>
                        <TableCell className="font-medium text-xs text-foreground">
                          <div>{item.assetName}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{item.assetTag}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium text-foreground">{item.custodian}</div>
                          <div className="text-[10px] text-muted-foreground">{item.email}</div>
                        </TableCell>
                        <TableCell className="text-xs text-foreground font-semibold">
                          {item.project}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(item.dueDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={isSevere ? "bg-red-600 text-white font-bold" : "bg-amber-500 text-white"}>
                            {item.daysOverdue} days overdue
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Master Lab Head Dashboard Analytics View
/**
 * The Lab Head's analytics screen: lays out the remaining widgets for one lab.
 *
 * @param lab the lab the account heads, shown in the headings; the server answers for that lab whatever is sent
 */
// TODO(M-01): all widgets fetch GET /api/analytics/lab-head on their own, most with the same query, so one screen sends that request several times. Step 12 (analytics).
export const LabHeadAnalyticsView: React.FC<{ lab?: string }> = ({ lab = "" }) => {
  return (
    <div className="space-y-8 text-foreground font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-[#005A36]" />
            Analytics: {lab}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Loans, project use, and overdue items for your lab.
          </p>
        </div>
      </div>

      <InsightsPanel charts={{ overdueLoans: "Overdue Loans" }} />

      <LabHeadOperationalSection lab={lab} />

      <LoansPerWeekChart />

      <ProjectAllocationWidget lab={lab} />

      <DelinquencyTable lab={lab} />
    </div>
  );
};

export default LabHeadAnalyticsView;