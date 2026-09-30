import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useApp } from "../context";
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
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ComposedChart,
  Line
} from "recharts";
import {
  TrendingUp,
  Building2,
  Users,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Send,
  FileCheck,
  Info,
  Layers,
  Sparkles,
  Maximize2,
  ExternalLink
} from "lucide-react";

const cardAnimation = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
};

// Descriptive - Asset Utilization & Procurement Justifier (Maximizable Preview)
export const TopUtilizationWidget: React.FC<{ lab?: string }> = ({ lab }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const { assets: contextAssets } = useApp();

  const { data: topAssets = [] } = useQuery({
    queryKey: ["stakeholder-utilization", lab],
    queryFn: async () => {
      try {
        const url = lab ? `http://localhost:4000/api/analytics/stakeholder/utilization?lab=${encodeURIComponent(lab)}` : `http://localhost:4000/api/analytics/stakeholder/utilization`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) {
        // Fallback
      }

      const filtered = contextAssets.filter(a => !lab || (a.lab && a.lab.toLowerCase().includes(lab.toLowerCase())));
      return filtered.slice(0, 10).map((a, idx) => ({
        assetId: a.id,
        assetName: a.name,
        assetTag: a.id,
        category: a.category,
        borrowCount: Math.max(2, 10 - idx)
      }));
    }
  });

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
                  Asset Utilization Preview {lab ? `(${lab})` : ""}
                </CardTitle>
              </div>
              <CardDescription className="text-muted-foreground text-xs mt-0.5">
                High-demand equipment ranking to justify upcoming procurement decisions.
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
                  <Bar dataKey="borrowCount" fill="#005A36" radius={[0, 4, 4, 0]} name="Checkout / Borrow Frequency" />
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
              View Full Ranking <ExternalLink size={12} />
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
              Procurement Justifier — Complete Asset Utilization Ranking {lab ? `(${lab})` : ""}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Full equipment checkout & transfer frequency log used for procurement justification.
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
                  <Bar dataKey="borrowCount" fill="#005A36" radius={[0, 4, 4, 0]} name="Checkout / Borrow Frequency" />
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
                          {index < 3 ? "High Demand (Procure More)" : index < 6 ? "Moderate Demand" : "Sufficient Capacity"}
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

// Diagnostic - Audit Discrepancy Analyzer
export const AuditDiscrepancyWidget: React.FC<{ lab?: string }> = ({ lab }) => {
  const { data: discrepancies = [] } = useQuery({
    queryKey: ["stakeholder-audit-discrepancies", lab],
    queryFn: async () => {
      try {
        const url = lab ? `http://localhost:4000/api/analytics/stakeholder/audit-discrepancies?lab=${encodeURIComponent(lab)}` : `http://localhost:4000/api/analytics/stakeholder/audit-discrepancies`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) {
        // Fallback
      }

      return [
        { fundingSource: "DOST", lab: lab || "CITe4D", gapCount: 1, missingValue: 250000 },
        { fundingSource: "CHED", lab: lab || "CITe4D", gapCount: 1, missingValue: 150000 }
      ];
    }
  });

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-sm font-bold text-foreground">
              Audit Discrepancy Analyzer {lab ? `(${lab})` : ""}
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Documentation gaps (missing Deeds of Donation) grouped by funding agency and lab.
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
                <Bar dataKey="gapCount" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Missing Documentation Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Prescriptive - Disposal & Clearance Engine
export const DisposalActionList: React.FC<{ lab?: string }> = ({ lab }) => {
  const { assets: contextAssets } = useApp();

  const { data: prescriptions = [] } = useQuery({
    queryKey: ["stakeholder-disposal-prescriptions", lab],
    queryFn: async () => {
      try {
        const url = lab ? `http://localhost:4000/api/analytics/stakeholder/disposal-prescriptions?lab=${encodeURIComponent(lab)}` : `http://localhost:4000/api/analytics/stakeholder/disposal-prescriptions`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) {
        // Fallback
      }

      const filtered = contextAssets.filter(a => !lab || (a.lab && a.lab.toLowerCase().includes(lab.toLowerCase())));
      return filtered.slice(0, 3).map((a, idx) => ({
        assetId: a.id,
        assetTag: a.id,
        name: a.name,
        category: a.category,
        fundingSource: a.funding || "DOST",
        ageYears: 4,
        status: idx === 0 ? "Ready for Disposal" : "Pending Agency Approval",
        prescribedAction: idx === 0 ? "Cleared for immediate warehouse disposal & staging." : "Submit formal clearance to DOST prior to property write-off.",
        clearanceLevel: idx === 0 ? "Immediate Warehouse Disposal" : "External Agency Clearance Required"
      }));
    }
  });

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-red-600" />
            <CardTitle className="text-sm font-bold text-foreground">
              Disposal & Clearance Engine {lab ? `(${lab})` : ""}
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Prescribed legal write-off clearance vs external agency approval routing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prescriptions.map((item: any) => {
              const isReady = item.status === "Ready for Disposal";
              return (
                <div
                  key={item.assetId}
                  className={`p-4 rounded-xl border flex flex-col justify-between ${
                    isReady ? "bg-emerald-50/50 border-emerald-200" : "bg-amber-50/50 border-amber-200"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-xs">{item.name}</span>
                      <Badge className={isReady ? "bg-emerald-700 text-white font-bold" : "bg-amber-600 text-white font-bold"}>
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
                    <strong className={isReady ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
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

// Diagnostic - Accountability Bottleneck Mapper
export const BottleneckMapperWidget: React.FC<{ lab?: string }> = ({ lab }) => {
  const { data: bottlenecks = [] } = useQuery({
    queryKey: ["stakeholder-accountability-bottlenecks", lab],
    queryFn: async () => {
      try {
        const url = lab ? `http://localhost:4000/api/analytics/stakeholder/accountability-bottlenecks?lab=${encodeURIComponent(lab)}` : `http://localhost:4000/api/analytics/stakeholder/accountability-bottlenecks`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) {
        // Fallback
      }

      return [
        { lab: lab || "CITe4D", studentBatch: "ID 121 Cohort", avgOverdueDays: 12, activeLoansCount: 4 },
        { lab: lab || "CITe4D", studentBatch: "ID 122 Cohort", avgOverdueDays: 5, activeLoansCount: 2 }
      ];
    }
  });

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <CardTitle className="text-sm font-bold text-foreground">
              Accountability Bottleneck Mapper {lab ? `(${lab})` : ""}
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Average days assets remain with student cohorts post project phase conclusion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bottlenecks} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="studentBatch" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }} />
                <Bar dataKey="avgOverdueDays" fill="#6366F1" radius={[4, 4, 0, 0]} name="Avg Days Overdue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Prescriptive - Automated Project-Closure Recommender
export const ProjectClosureAlert: React.FC<{ lab?: string }> = ({ lab }) => {
  const [recalled, setRecalled] = useState(false);

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Alert className="bg-indigo-50/50 border-indigo-200 text-indigo-950 p-4 rounded-xl shadow-xs">
        <div className="flex items-start justify-between gap-4 w-full">
          <div>
            <AlertTitle className="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Automated Project-Closure Recommender {lab ? `(${lab})` : ""}
            </AlertTitle>
            <AlertDescription className="text-xs text-indigo-800/80 mt-1 leading-relaxed">
              Nearing term end date. Mass "Handshake Recall" recommended for graduating cohort student equipment loans.
            </AlertDescription>
          </div>
          <Button
            onClick={() => setRecalled(true)}
            disabled={recalled}
            className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold px-4 py-2 rounded-lg"
          >
            {recalled ? <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-400" /> : <Send className="w-4 h-4 mr-1" />}
            {recalled ? "Recall Sent" : "1-Click Mass Recall"}
          </Button>
        </div>
      </Alert>
    </motion.div>
  );
};

// Diagnostic - Degradation Root-Cause Tracker
export const DegradationTracker: React.FC<{ lab?: string }> = ({ lab }) => {
  const { assets: contextAssets } = useApp();

  const { data: degradationData = [] } = useQuery({
    queryKey: ["stakeholder-degradation-tracker", lab],
    queryFn: async () => {
      try {
        const url = lab ? `http://localhost:4000/api/analytics/stakeholder/degradation-tracker?lab=${encodeURIComponent(lab)}` : `http://localhost:4000/api/analytics/stakeholder/degradation-tracker`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) {
        // Fallback
      }

      const filtered = contextAssets.filter(a => !lab || (a.lab && a.lab.toLowerCase().includes(lab.toLowerCase())));
      return filtered.slice(0, 6).map((a, idx) => ({
        assetTag: a.id,
        name: a.name,
        category: a.category,
        handoverEvents: idx + 2,
        healthScore: a.condition || 85
      }));
    }
  });

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-cyan-600" />
            <CardTitle className="text-sm font-bold text-foreground">
              Degradation Root-Cause Tracker {lab ? `(${lab})` : ""}
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Chronological health score degradation vs handover transfer frequency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={degradationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="assetTag" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="handoverEvents" fill="#0284C7" name="Handover / Transfer Count" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="healthScore" stroke="#005A36" strokeWidth={3} name="Health Score %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Prescriptive - Preventative Maintenance Scheduler
export const PreventativeScheduleTable: React.FC<{ lab?: string }> = ({ lab }) => {
  const { assets: contextAssets } = useApp();

  const { data: schedules = [] } = useQuery({
    queryKey: ["stakeholder-preventative-schedule", lab],
    queryFn: async () => {
      try {
        const url = lab ? `http://localhost:4000/api/analytics/stakeholder/preventative-schedule?lab=${encodeURIComponent(lab)}` : `http://localhost:4000/api/analytics/stakeholder/preventative-schedule`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch (e) {
        // Fallback
      }

      const filtered = contextAssets.filter(a => !lab || (a.lab && a.lab.toLowerCase().includes(lab.toLowerCase())));
      return filtered.slice(0, 5).map((a, idx) => ({
        assetId: a.id,
        assetTag: a.id,
        name: a.name,
        category: a.category,
        repairCount: idx,
        prescribedAction: a.category === "CPU" ? "Thermal repasting & dust blowout before Term 2" : "Routine Optical Inspection & recalibration",
        priority: idx === 0 ? "High" : "Medium"
      }));
    }
  });

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-[#005A36]" />
            <CardTitle className="text-sm font-bold text-foreground">
              Preventative Maintenance Scheduler {lab ? `(${lab})` : ""}
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Statistical failure risk thresholds & prescribed preventative actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs font-bold text-foreground">Asset Tag / Name</TableHead>
                  <TableHead className="text-xs font-bold text-foreground">Category</TableHead>
                  <TableHead className="text-xs font-bold text-foreground">Prescribed Maintenance Action</TableHead>
                  <TableHead className="text-right text-xs font-bold text-foreground">Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((item: any) => (
                  <TableRow key={item.assetId} className="hover:bg-muted/30 border-b border-border">
                    <TableCell className="font-medium text-xs text-foreground">
                      <div>{item.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{item.assetTag}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.category}</TableCell>
                    <TableCell className="text-emerald-700 text-xs font-bold">{item.prescribedAction}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={item.priority === "Critical" ? "bg-red-600 text-white" : item.priority === "High" ? "bg-amber-600 text-white" : "bg-emerald-700 text-white"}>
                        {item.priority}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Diagnostic - Chain of Custody Defect Isolator
export const CustodyTimeline: React.FC<{ assetId?: number }> = () => {
  const timeline = [
    { step: 1, date: "2026-01-10", event: "Initial Deployment", custodian: "ITS Admin", condition: "Pristine (100%)", isDefectPoint: false },
    { step: 2, date: "2026-03-15", event: "Handshake Transfer", custodian: "Dr. Juan Dela Cruz", condition: "Minor Scuffing (92%)", isDefectPoint: false },
    { step: 3, date: "2026-05-20", event: "Handshake Transfer", custodian: "A. Custodian", condition: "Pre-existing Port Loose (80%)", isDefectPoint: true },
    { step: 4, date: "2026-06-12", event: "Reported Defect", custodian: "Current Borrower", condition: "Port Connector Damage", isDefectPoint: false }
  ];

  return (
    <motion.div variants={cardAnimation} initial="hidden" animate="visible">
      <Card className="border border-border bg-card text-card-foreground shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#005A36]" />
            <CardTitle className="text-sm font-bold text-foreground">Chain of Custody Defect Isolator</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            Handshake digital inspection timeline isolating pre-existing damage provenance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative border-l-2 border-slate-200 ml-4 space-y-4">
            {timeline.map((step: any) => (
              <div key={step.step} className="relative pl-6">
                <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 ${step.isDefectPoint ? "bg-red-500 border-white animate-pulse" : "bg-slate-300 border-white"}`} />
                <div className={`p-3 rounded-lg border ${step.isDefectPoint ? "bg-red-50/60 border-red-200" : "bg-slate-50/50 border-slate-200"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">{step.event}</span>
                    <span className="text-[10px] text-muted-foreground">{step.date}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Custodian: {step.custodian}</div>
                  <div className="text-[11px] font-bold text-emerald-700 mt-0.5">Condition: {step.condition}</div>
                  {step.isDefectPoint && (
                    <Badge className="bg-red-600 text-white text-[9px] mt-1 font-bold">
                      Pre-existing Defect Identified Here
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Prescriptive - Contextual Stewardship Prompts (Modal)
export const StewardshipModal: React.FC<{ isOpen: boolean; onClose: () => void; category?: string }> = ({
  isOpen,
  onClose,
  category = "DEV_KIT"
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-card-foreground max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#005A36] text-base font-bold">
            <Info className="w-5 h-5" />
            Checkout Stewardship Protocol ({category})
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Required equipment handling & calibration guidelines upon handshake completion.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs text-foreground">
          <div className="p-3 bg-muted/40 rounded-lg border border-border">
            <strong className="text-[#005A36] block mb-1">Safe Storage:</strong>
            Store in anti-static ESD bag at room temperature in assigned CITe4D storage locker.
          </div>
          <div className="p-3 bg-muted/40 rounded-lg border border-border">
            <strong className="text-[#005A36] block mb-1">Handling Protocol:</strong>
            Ground yourself with anti-static wrist strap before pin connection and sensor mounting.
          </div>
          <div className="p-3 bg-muted/40 rounded-lg border border-border">
            <strong className="text-[#005A36] block mb-1">Calibration Requirement:</strong>
            Verify GPIO pin voltage baseline prior to sensor load.
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="bg-[#005A36] hover:bg-[#005A36]/90 text-white text-xs w-full font-bold">
            Acknowledge & Complete Handshake
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Master Module View
export const RoleAnalyticsModule: React.FC<{ lab?: string }> = ({ lab }) => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-8 text-foreground font-sans">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-foreground tracking-tight">
            Stakeholder Diagnostic & Prescriptive Analytics {lab ? `— ${lab}` : ""}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Role-tailored dashboards for AdRIC Admin, Lab Heads, TSG, and Students.</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-[#005A36] hover:bg-[#005A36]/90 text-white text-xs font-bold">
          Trigger Stewardship Prompt Demo
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-[#005A36] flex items-center gap-2 uppercase tracking-wider">
          <Building2 className="w-4 h-4 text-[#005A36]" /> 1. AdRIC Administrators & Lab Heads
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopUtilizationWidget lab={lab} />
          <AuditDiscrepancyWidget lab={lab} />
        </div>
        <DisposalActionList lab={lab} />
      </div>

      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-bold text-indigo-700 flex items-center gap-2 uppercase tracking-wider">
          <Users className="w-4 h-4 text-indigo-600" /> 2. Lab Heads (Closure & Accountability)
        </h3>
        <ProjectClosureAlert lab={lab} />
        <BottleneckMapperWidget lab={lab} />
      </div>

      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-bold text-cyan-700 flex items-center gap-2 uppercase tracking-wider">
          <Wrench className="w-4 h-4 text-cyan-600" /> 3. TSG Maintenance Engine
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DegradationTracker lab={lab} />
          <PreventativeScheduleTable lab={lab} />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-bold text-amber-700 flex items-center gap-2 uppercase tracking-wider">
          <Layers className="w-4 h-4 text-amber-600" /> 4. Student Researchers (Custody & Provenance)
        </h3>
        <CustodyTimeline assetId={1} />
      </div>

      <StewardshipModal isOpen={modalOpen} onClose={() => setModalOpen(false)} category="DEV_KIT" />
    </div>
  );
};

export default RoleAnalyticsModule;
