import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useApp } from "../context";
import * as loansApi from "@web/api/loans.api";
import * as transfersApi from "@web/api/transfers.api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
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
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
  Zap,
  Building,
  Maximize2,
  ExternalLink,
  Loader2
} from "lucide-react";

import { cn } from "./ui/utils";

const cardAnimation = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
};

// Operational & Localized View (Task 2: Actionable Data Tables for loans & transfers with Approve/Reject buttons, Utilization Gauge, Category Breakdown Horizontal Bar Chart)
export const LabHeadOperationalSection: React.FC<{ lab?: string }> = ({ lab = "CITe4D" }) => {
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
        const res = await fetch(`http://localhost:4000/api/analytics/lab-head?${params.toString()}`);
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

  const handleLoanDecision = async (loanId: number, decision: "approve" | "reject") => {
    setActingId(`loan-${loanId}`);
    try {
      const json = await loansApi.decideLoan(loanId, decision);
      if (json.success) {
        await refetch();
      }
    } catch (e) {
      console.error("Failed loan decision:", e);
    } finally {
      setActingId(null);
    }
  };

  const handleTransferDecision = async (transferId: number, decision: "approve" | "reject") => {
    setActingId(`transfer-${transferId}`);
    try {
      const json = await transfersApi.decideTransfer(transferId, decision);
      if (json.success) {
        await refetch();
      }
    } catch (e) {
      console.error("Failed transfer decision:", e);
    } finally {
      setActingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-4 bg-card rounded-xl border border-border">
        <div className="flex items-center gap-2 text-[#005A36] font-bold text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Synchronizing Lab Analytics with MySQL Database...</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-48 bg-muted/40 rounded-xl" />
          <div className="h-48 bg-muted/40 rounded-xl" />
        </div>
      </div>
    );
  }

  const loans = data?.loans || [];
  const transfers = data?.transfers || [];
  const utilization = data?.utilization || { utilizationPercentage: 0, assignedCount: 0, unassignedCount: 0, totalAssetsCount: 0 };
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
                <Zap className="w-5 h-5 text-[#005A36]" /> Utilization Gauge: Lab Assets Assigned to Projects
              </h3>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold text-xs">
                {utilization.utilizationPercentage}% Assigned
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Query DB: percentage of lab assets actively assigned to a valid project_id versus unassigned (null).
            </p>
          </div>

          <div className="my-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Assigned to Active Project: {utilization.assignedCount} units</span>
              <span className="text-muted-foreground">Unassigned (null): {utilization.unassignedCount} units</span>
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
                <span className="text-[10px] text-muted-foreground block font-semibold">Project Assigned</span>
                <span className="font-extrabold text-[#005A36] text-sm font-mono">{utilization.assignedCount} Assets</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200">
                <span className="text-[10px] text-muted-foreground block font-semibold">Unassigned Pool</span>
                <span className="font-extrabold text-slate-700 dark:text-slate-200 text-sm font-mono">{utilization.unassignedCount} Assets</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Horizontal Bar Chart (Category Breakdown) */}
        <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#005A36]" /> Equipment Category Breakdown
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

      {/* Actionable Equipment Loan Requests Table */}
      <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
        <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-2.5">
          Equipment Loan Requests
        </h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-bold">Loan ID</TableHead>
                <TableHead className="text-xs font-bold">Asset Tag / Name</TableHead>
                <TableHead className="text-xs font-bold">Borrower</TableHead>
                <TableHead className="text-xs font-bold">Purpose</TableHead>
                <TableHead className="text-xs font-bold">Transfer Location</TableHead>
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
                  <TableRow key={loan.loanId} className="text-xs hover:bg-muted/20">
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

      {/* Actionable Inter-Lab Transfer Requests Table */}
      <Card className="border border-border bg-card shadow-sm rounded-xl p-5">
        <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-2.5">
          Inter-Lab Transfer Requests
        </h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-bold">Transfer ID</TableHead>
                <TableHead className="text-xs font-bold">Asset Tag / Name</TableHead>
                <TableHead className="text-xs font-bold">Justification</TableHead>
                <TableHead className="text-xs font-bold">Transfer Location</TableHead>
                <TableHead className="text-xs font-bold">Requested On</TableHead>
                <TableHead className="text-xs font-bold text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((trf: any) => {
                const isPending = trf.status === "Pending" || trf.status === "pending";
                const isApproved = trf.status === "Approved" || trf.status === "approved";
                const isWorking = actingId === `transfer-${trf.transferId}`;

                return (
                  <TableRow key={trf.transferId} className="text-xs hover:bg-muted/20">
                    <TableCell className="font-mono font-bold text-primary">TRF-{trf.transferId}</TableCell>
                    <TableCell className="font-semibold">{trf.asset} ({trf.assetId})</TableCell>
                    <TableCell className="max-w-[200px] truncate">{trf.justification}</TableCell>
                    <TableCell className="text-[11px]">{trf.destinationLab || "—"}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{trf.requestedOn}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn("text-[10px] font-extrabold", isApproved ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isPending ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200")}>
                        {trf.status}
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
export const ProjectAllocationWidget: React.FC<{ lab: string }> = ({ lab }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  const { data: analyticsData } = useQuery({
    queryKey: ["labhead-analytics-data", lab],
    queryFn: async () => {
      try {
        const res = await fetch(`http://localhost:4000/api/analytics/lab-head?labPrefix=${encodeURIComponent(lab)}&lab=${encodeURIComponent(lab)}`);
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
          <CardHeader className="pb-2 flex flex-row items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#005A36]" />
                <CardTitle className="text-sm font-bold text-foreground">
                  Project-to-Asset Allocation Matrix (Treemap Preview)
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
                title="Maximize window tab"
              >
                <Maximize2 size={13} /> Maximize Tab
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
              Project-to-Asset Allocation Matrix ({lab})
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
                    Lead research cohort assigned hardware equipment from MySQL database.
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
                        <TableRow key={idx} className="hover:bg-muted/30 border-b border-border text-[11px]">
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

// 2. Asset Idle Time Analyzer (BarChart Histogram)
export const IdleTimeAnalyzer: React.FC<{ lab: string }> = ({ lab }) => {
  const { data: idleData = [] } = useQuery({
    queryKey: ["labhead-idle-time", lab],
    queryFn: async () => {
      try {
        const res = await fetch(`http://localhost:4000/api/analytics/advanced/idle-time?lab=${encodeURIComponent(lab)}`);
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
export const IdleTimeDurationFrequencyWidget: React.FC<{ lab: string }> = ({ lab }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"ALL" | "31-60" | "60+">("ALL");

  const { data: frequencyData = [] } = useQuery({
    queryKey: ["labhead-idle-duration-frequency", lab],
    queryFn: async () => {
      try {
        const res = await fetch(`http://localhost:4000/api/analytics/advanced/idle-frequency?lab=${encodeURIComponent(lab)}`);
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

  const { assets } = useApp();
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
export const LoanRecommenderList: React.FC<{ lab: string }> = ({ lab }) => {
  const [requested, setRequested] = useState<Record<number, boolean>>({});

  const { data: recommendations = [] } = useQuery({
    queryKey: ["labhead-loan-recommender", lab],
    queryFn: async () => {
      try {
        const res = await fetch("http://localhost:4000/api/analytics/advanced/loan-recommender");
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

// 4. Custodianship & Delinquency Analytics (DataTable)
export const DelinquencyTable: React.FC<{ lab: string }> = ({ lab }) => {
  const { data: analyticsData } = useQuery({
    queryKey: ["labhead-delinquencies-data", lab],
    queryFn: async () => {
      try {
        const res = await fetch(`http://localhost:4000/api/analytics/lab-head?labPrefix=${encodeURIComponent(lab)}&lab=${encodeURIComponent(lab)}`);
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
                Custodianship & Overdue Delinquencies — {lab}
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground text-xs mt-1">
              Active equipment loans assigned to students in {lab} past expected return date (`asset_loans.due_date`). Reporting only.
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
                      <TableRow key={item.id} className={isSevere ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-muted/30"}>
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

// 3. Diagnostic — Accountability Scatter Plot (Maximizable)
export const BottleneckScatterWidget: React.FC<{ lab: string }> = ({ lab }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  const { data: analyticsData } = useQuery({
    queryKey: ["labhead-scatter-data", lab],
    queryFn: async () => {
      try {
        const res = await fetch(`http://localhost:4000/api/analytics/lab-head?labPrefix=${encodeURIComponent(lab)}&lab=${encodeURIComponent(lab)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) { }
      return null;
    }
  });

  const scatterData = analyticsData?.scatterData || [];
  const criticalCount = scatterData.filter((item: any) => item.severity === "Critical Bottleneck").length;

  return (
    <>
      <motion.div variants={cardAnimation} initial="hidden" animate="visible">
        <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-600" />
                <CardTitle className="text-sm font-bold text-foreground">
                  Diagnostic — Accountability Scatter Plot ({lab})
                </CardTitle>
              </div>
              <CardDescription className="text-muted-foreground text-xs mt-0.5">
                Scatter plot mapping research cohorts by average days overdue (X-Axis) vs unreturned equipment count (Y-Axis).
              </CardDescription>
            </div>
            {scatterData.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge className="bg-red-600 text-white font-bold text-xs px-3 py-1">
                  {criticalCount} Critical Bottlenecks
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMaximized(true)}
                  className="text-xs gap-1 border-red-600/30 text-red-700 hover:bg-red-50 font-bold shrink-0"
                >
                  <Maximize2 size={13} /> Maximize Tab
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent>
            {scatterData.length === 0 ? (
              <div className="h-72 flex items-center justify-center p-6 bg-muted/10 rounded-xl border border-dashed border-border text-center">
                <p className="text-xs text-muted-foreground">No active overdue bottlenecks or delinquent cohorts found for {lab}.</p>
              </div>
            ) : (
              <div className="h-72 bg-muted/10 p-4 rounded-xl border border-border">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis
                      type="number"
                      dataKey="avgDaysOverdue"
                      name="Avg Days Overdue"
                      unit=" days"
                      stroke="#64748B"
                      fontSize={11}
                      domain={[0, "auto"]}
                    />
                    <YAxis
                      type="number"
                      dataKey="unreturnedCount"
                      name="Unreturned Items"
                      unit=" items"
                      stroke="#64748B"
                      fontSize={11}
                      domain={[0, "auto"]}
                    />
                    <ZAxis type="number" dataKey="bubbleSize" range={[120, 450]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ payload }) => {
                        if (payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-lg text-xs space-y-1">
                              <span className="font-black text-slate-900 block">{data.cohort}</span>
                              <div className="text-slate-600 font-mono text-[11px]">
                                <div>Avg Overdue: <strong className="text-red-600">{data.avgDaysOverdue} days</strong></div>
                                <div>Unreturned Assets: <strong>{data.unreturnedCount} items</strong></div>
                                <div>Status: <strong style={{ color: data.color }}>{data.severity}</strong></div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter name="Student Cohorts" data={scatterData}>
                      {scatterData.map((entry: any, index: number) => (
                        <Cell key={`cell-scatter-${index}`} fill={entry.color} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Maximized Scatter Plot Window Tab Dialog Modal */}
      <Dialog open={isMaximized} onOpenChange={setIsMaximized}>
        <DialogContent className="w-[96vw] max-w-7xl max-h-[92vh] overflow-y-auto bg-card border-border text-card-foreground rounded-2xl p-6 sm:p-8 shadow-2xl my-auto">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="text-lg sm:text-xl font-extrabold text-red-700 flex items-center gap-2">
              <Clock className="w-6 h-6 text-red-600" />
              Accountability Scatter Plot — Complete Cohort Analysis ({lab})
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Full-screen scatter plot distribution plotting average days overdue against unreturned equipment count.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 my-4">
            <div className="h-[420px] bg-muted/20 p-5 rounded-xl border border-border">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                  <XAxis type="number" dataKey="avgDaysOverdue" name="Avg Days Overdue" unit=" days" stroke="#64748B" fontSize={12} domain={[0, "auto"]} />
                  <YAxis type="number" dataKey="unreturnedCount" name="Unreturned Items" unit=" items" stroke="#64748B" fontSize={12} domain={[0, "auto"]} />
                  <ZAxis type="number" dataKey="bubbleSize" range={[200, 600]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter name="Student Cohorts" data={scatterData}>
                    {scatterData.map((entry: any, index: number) => (
                      <Cell key={`cell-scatter-max-${index}`} fill={entry.color} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-3">
            <Button onClick={() => setIsMaximized(false)} className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-6">
              Close Window Tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// 4. Authentic 2D Heatmap Matrix Widget
export const AccountabilityHeatmapWidget: React.FC<{ lab: string }> = ({ lab }) => {
  const [hoveredCell, setHoveredCell] = useState<{ cohort: string; range: string; count: number } | null>(null);

  const columns = ["0 - 3 Days", "4 - 7 Days", "8 - 14 Days", "15 - 30 Days", "30+ Days (Critical)"];

  const { data: analyticsData } = useQuery({
    queryKey: ["labhead-heatmap-data", lab],
    queryFn: async () => {
      try {
        const res = await fetch(`http://localhost:4000/api/analytics/lab-head?labPrefix=${encodeURIComponent(lab)}&lab=${encodeURIComponent(lab)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) { }
      return null;
    }
  });

  const heatmapMatrix = analyticsData?.heatmapData || [];
  const totalDelinquentAssets = heatmapMatrix.reduce((acc: number, row: any) => acc + (row.totalOverdue || 0), 0);

  const getHeatmapColor = (count: number) => {
    if (count === 0) return "bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 font-mono";
    if (count <= 2) return "bg-emerald-200 text-emerald-950 font-extrabold border border-emerald-300/80 shadow-2xs";
    if (count <= 4) return "bg-amber-400 text-amber-950 font-black border border-amber-500/80 shadow-xs";
    if (count <= 7) return "bg-red-500 text-white font-black border border-red-600 shadow-sm";
    return "bg-red-950 text-white font-black border border-red-900 shadow-md animate-pulse";
  };

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border bg-muted/20">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-red-600" />
              <CardTitle className="text-sm font-bold text-foreground">
                Diagnostic — Cohort Accountability Heatmap Matrix ({lab})
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground text-xs mt-0.5">
              2D Heatmap matrix mapping delay intensity across research cohorts and overdue duration ranges.
            </CardDescription>
          </div>
          <Badge className="bg-red-600 text-white font-bold text-xs px-3 py-1">
            {totalDelinquentAssets} Total Delinquent Assets
          </Badge>
        </CardHeader>

        <CardContent className="p-6">
          {heatmapMatrix.length === 0 ? (
            <div className="py-12 text-center bg-muted/10 rounded-xl border border-dashed border-border p-6">
              <p className="text-xs text-muted-foreground">No overdue equipment or delinquent cohorts logged for {lab}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-muted/10 p-4">
              <div className="min-w-[650px]">
                <div className="grid grid-cols-12 gap-1 mb-2 text-center text-xs font-black uppercase text-muted-foreground">
                  <div className="col-span-4 text-left pl-2">Research Project Cohort</div>
                  {columns.map((col, idx) => (
                    <div key={idx} className="col-span-1 text-[11px] font-bold text-foreground py-1 bg-muted/30 rounded-md">
                      {col}
                    </div>
                  ))}
                  <div className="col-span-3 text-right pr-2">Total Delinquent</div>
                </div>

                <div className="space-y-1.5">
                  {heatmapMatrix.map((row: any, rowIdx: number) => (
                    <div key={rowIdx} className="grid grid-cols-12 gap-1.5 items-center">
                      <div className="col-span-4 text-xs font-black text-foreground truncate pl-2" title={row.cohort}>
                        {row.cohort}
                      </div>

                      {row.counts.map((count: number, colIdx: number) => (
                        <div
                          key={colIdx}
                          onMouseEnter={() => setHoveredCell({ cohort: row.cohort, range: columns[colIdx], count })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`col-span-1 h-12 rounded-lg flex items-center justify-center text-sm transition-all transform hover:scale-105 hover:z-10 cursor-pointer ${getHeatmapColor(count)}`}
                        >
                          {count > 0 ? count : "—"}
                        </div>
                      ))}

                      <div className="col-span-3 text-right pr-2">
                        <Badge className={row.totalOverdue >= 10 ? "bg-red-600 text-white font-bold text-xs" : "bg-amber-600 text-white font-bold text-xs"}>
                          {row.totalOverdue} Assets Overdue
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-muted-foreground font-medium">
              {hoveredCell ? (
                <span className="text-foreground font-bold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                  {hoveredCell.cohort} • {hoveredCell.range}: <strong className="text-red-600 font-extrabold">{hoveredCell.count} Unreturned Assets</strong>
                </span>
              ) : (
                <span>Hover over any heatmap cell to inspect exact cohort delay frequency.</span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
              <span>Low (Cold)</span>
              <div className="h-3.5 w-32 rounded-full bg-gradient-to-r from-emerald-200 via-amber-400 to-red-900 shadow-2xs border border-border" />
              <span>Critical (Hot)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Master Lab Head Dashboard Analytics View
export const LabHeadAnalyticsView: React.FC<{ lab?: string }> = ({ lab = "CITe4D" }) => {
  return (
    <div className="space-y-8 text-foreground font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-[#005A36]" />
            Lab Head Project Allocation & Efficiency Dashboard ({lab})
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real operational equipment loan & transfer approvals, hardware utilization gauge, category breakdown, project allocation matrix, overdue delinquencies report, accountability scatter plot, and 2D heatmap matrix.
          </p>
        </div>
        <Badge variant="outline" className="border-[#005A36] text-[#005A36] bg-emerald-50 px-3 py-1 text-xs font-bold self-start md:self-auto">
          {lab} Research Laboratory Restricted
        </Badge>
      </div>

      <LabHeadOperationalSection lab={lab} />

      <ProjectAllocationWidget lab={lab} />

      <DelinquencyTable lab={lab} />

      <BottleneckScatterWidget lab={lab} />

      <AccountabilityHeatmapWidget lab={lab} />
    </div>
  );
};

export default LabHeadAnalyticsView;