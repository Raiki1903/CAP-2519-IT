import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useApp, type Asset, type RepairRequest, type InspectionReport, type PendingDisposal, type AffiliateClearance } from "../context";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { prisma } from "../prismaClient";
import { cn } from "./ui/utils";
import {
  Monitor, BarChart3, ClipboardCheck, ClipboardList, TrendingUp, AlertTriangle, 
  MapPin, CheckCircle2, XCircle, Search, Download, Printer, User, Wrench, Calendar, Tag, ShieldAlert
} from "lucide-react";

interface AdRICDirectorDashboardProps {
  activeTab: "overview" | "analytics" | "clearance-disposal" | "reports";
}

const ALL_10_LABS = [
  { id: "CITe4D", name: "CITe4D - Manila", location: "Manila", isMock: false },
  { id: "CAR", name: "CAR - Laguna", location: "Laguna", isMock: false },
  { id: "CeHCI", name: "CeHCI - Manila", location: "Manila", isMock: false },
  { id: "HXIL", name: "HXIL - Laguna", location: "Laguna", isMock: false },
  { id: "GAME", name: "GAME - Manila", location: "Manila", isMock: false },
  { id: "CeLT", name: "CeLT - Laguna", location: "Laguna", isMock: false },
  { id: "Bio", name: "Bio - Manila", location: "Manila", isMock: false },
  { id: "CIVI", name: "CIVI - Laguna", location: "Laguna", isMock: true, mockAssets: 8, mockCondition: 89, mockUtilization: 75 },
  { id: "CHEM", name: "CHEM - Manila", location: "Manila", isMock: true, mockAssets: 12, mockCondition: 92, mockUtilization: 65 },
  { id: "MECH", name: "MECH - Laguna", location: "Laguna", isMock: true, mockAssets: 15, mockCondition: 84, mockUtilization: 80 }
];

export function AdRICDirectorDashboard({ activeTab }: AdRICDirectorDashboardProps) {
  const navigate = useNavigate();
  const {
    assets,
    repairRequests,
    transfers,
    inspections,
    pendingDisposals,
    approveDisposal,
    rejectDisposal,
    manualClearanceHolds,
    toggleClearanceHold
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [fundingFilter, setFundingFilter] = useState("ALL");
  const [dateFilterStart, setDateFilterStart] = useState("");
  const [dateFilterEnd, setDateFilterEnd] = useState("");
  const [selectedAssetForAudit, setSelectedAssetForAudit] = useState<Asset | null>(null);
  
  // Custom states for interactive features
  const [selectedHoldAffiliate, setSelectedHoldAffiliate] = useState<any | null>(null);
  const [overrideNotes, setOverrideNotes] = useState("");

  // Calculated properties
  const activeAssets = assets.filter(a => a.status !== "Disposed");
  const degradingAssets = assets.filter(a => a.status !== "Disposed" && a.condition < 75);
  const maintenanceCount = assets.filter(a => a.status === "Maintenance" || a.status === "In Repair").length;
  
  const totalValuation = assets.reduce((sum, a) => sum + (a.cost || 0), 0);

  // 1. Overview Tab render
  const renderOverview = () => {
    // Manila vs Laguna Assets
    const manilaAssets = activeAssets.filter(a => a.location === "Manila").length;
    const lagunaAssets = activeAssets.filter(a => a.location === "Laguna").length;
    const manilaPercent = activeAssets.length ? Math.round((manilaAssets / activeAssets.length) * 100) : 0;
    const lagunaPercent = activeAssets.length ? Math.round((lagunaAssets / activeAssets.length) * 100) : 0;

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-emerald-500/20 text-white">
            <CardContent className="pt-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">Registry Valuation</p>
                <h3 className="text-xl font-extrabold mt-1">PHP {totalValuation.toLocaleString()}</h3>
              </div>
              <div className="p-2 bg-emerald-950/50 rounded-lg border border-emerald-500/20">
                <TrendingUp className="text-emerald-400 size-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-emerald-500/20 text-white">
            <CardContent className="pt-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">Active Inventory</p>
                <h3 className="text-xl font-extrabold mt-1">{activeAssets.length} Equipment</h3>
              </div>
              <div className="p-2 bg-emerald-950/50 rounded-lg border border-emerald-500/20">
                <Monitor className="text-emerald-400 size-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-emerald-500/20 text-white">
            <CardContent className="pt-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-amber-400 uppercase">Maintenance &amp; Degrading</p>
                <h3 className="text-xl font-extrabold mt-1">
                  {maintenanceCount} Mnt · {degradingAssets.length} Deg
                </h3>
              </div>
              <div className="p-2 bg-amber-950/50 rounded-lg border border-amber-500/20">
                <AlertTriangle className="text-amber-400 size-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-emerald-500/20 text-white">
            <CardContent className="pt-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-red-400 uppercase">Pending Approvals</p>
                <h3 className="text-xl font-extrabold mt-1">
                  {pendingDisposals.length} Disposals
                </h3>
              </div>
              <div className="p-2 bg-red-950/50 rounded-lg border border-red-500/20">
                <ShieldAlert className="text-red-400 size-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resource Distribution Map & Health Index */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visual Resource Mapping */}
          <Card className="bg-slate-900 border-emerald-500/10 text-white lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-slate-400">Campus Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <MapPin className="text-emerald-400 size-4" />
                  <span>Manila Campus</span>
                </div>
                <span className="font-bold">{manilaAssets} ({manilaPercent}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full" style={{ width: `${manilaPercent}%` }} />
              </div>

              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <MapPin className="text-teal-400 size-4" />
                  <span>Laguna Campus</span>
                </div>
                <span className="font-bold">{lagunaAssets} ({lagunaPercent}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-teal-400 h-full" style={{ width: `${lagunaPercent}%` }} />
              </div>
              
              <Separator className="bg-white/5" />
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/5 rounded-xl">
                <p className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">Administrative Oversight</p>
                <p className="text-xs text-slate-300 mt-1 leading-snug">
                  Active balance is maintained to allow research equipment resource sharing between locations, overseen by the AdRIC Director office.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 10 Specialized Laboratories Health & Utilization */}
          <Card className="bg-slate-900 border-emerald-500/10 text-white lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-slate-400">Specialized Laboratories Status Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="hover:bg-transparent border-b border-white/5">
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase">Laboratory ID</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase">Campus</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase text-center">Assets</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase text-center">Health index</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase text-center">Utilization</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ALL_10_LABS.map(lab => {
                      let assetCount = 0;
                      let avgCondition = 100;
                      let utilRate = 0;

                      if (lab.isMock) {
                        assetCount = lab.mockAssets || 0;
                        avgCondition = lab.mockCondition || 90;
                        utilRate = lab.mockUtilization || 50;
                      } else {
                        const labAssets = activeAssets.filter(a => a.lab === lab.id);
                        assetCount = labAssets.length;
                        if (assetCount > 0) {
                          avgCondition = Math.round(labAssets.reduce((s, a) => s + a.condition, 0) / assetCount);
                          const utilized = labAssets.filter(a => a.status === "On Loan" || a.status === "Overdue" || a.status === "Pending Return").length;
                          utilRate = Math.round((utilized / assetCount) * 100);
                        }
                      }

                      let statusBadge = <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px]">Safe</Badge>;
                      if (avgCondition < 75) {
                        statusBadge = <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px]">Critical Watch</Badge>;
                      } else if (avgCondition < 88) {
                        statusBadge = <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px]">Attention</Badge>;
                      }

                      return (
                        <TableRow key={lab.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <TableCell className="font-bold text-white text-xs">{lab.id}</TableCell>
                          <TableCell className="text-slate-300 text-xs">{lab.location}</TableCell>
                          <TableCell className="text-center font-semibold text-xs">{assetCount}</TableCell>
                          <TableCell className="text-center text-xs">
                            <span className={cn(avgCondition < 75 ? "text-red-400 font-bold" : avgCondition < 88 ? "text-amber-400" : "text-emerald-400 font-semibold")}>
                              {avgCondition}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-xs font-mono text-slate-300">{utilRate}%</TableCell>
                          <TableCell className="text-right">{statusBadge}</TableCell>
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
    );
  };

  // 2. Analytics Tab render (Hardware Degradation & Procurement Planning)
  const renderAnalytics = () => {
    // Generate Degradation List
    const degradationData = activeAssets.map(a => {
      // calculate years since procurement
      const years = Math.max(0.5, (new Date().getTime() - new Date(a.procured).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      const degradationRate = ((100 - a.condition) / years).toFixed(1);
      return {
        ...a,
        yearsInService: years.toFixed(1),
        degradationRate: Number(degradationRate)
      };
    }).sort((a, b) => b.degradationRate - a.degradationRate);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Chronological Health &amp; Hardware Degradation</h2>
            <p className="text-xs text-slate-400">Tracking resource health indexes against original baseline tests to justify future procurement.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline Tracking */}
          <Card className="bg-slate-900 border-emerald-500/10 text-white lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-slate-400">Calculated hardware degradation timelines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-white/5">
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase">Equipment ID</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase">Category / Name</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase text-center">procured</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase text-center">Service (Yrs)</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase text-center">Condition</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase text-right">Degradation Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {degradationData.map(item => (
                      <TableRow key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <TableCell className="font-mono text-xs text-emerald-400">{item.id}</TableCell>
                        <TableCell className="text-xs">
                          <p className="font-bold text-white">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{item.lab} · {item.manufacturer}</p>
                        </TableCell>
                        <TableCell className="text-center text-xs font-mono text-slate-300">{item.procured}</TableCell>
                        <TableCell className="text-center text-xs font-mono text-slate-300">{item.yearsInService}</TableCell>
                        <TableCell className="text-center text-xs">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-white">{item.condition}%</span>
                            <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                              <div 
                                className={cn("h-full", item.condition >= 90 ? "bg-emerald-400" : item.condition >= 75 ? "bg-amber-400" : "bg-red-400")} 
                                style={{ width: `${item.condition}%` }} 
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-red-400 font-mono">
                          {item.degradationRate}% / year
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Procurement Planner Justifier */}
          <Card className="bg-slate-900 border-emerald-500/10 text-white lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-slate-400">Empirical Procurement Justifier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-300">
                Identify assets degrading rapidly below the threshold (condition &lt; 75%) to justify institutional funding proposals with COA or DOST.
              </p>
              
              <div className="space-y-3">
                {degradationData.filter(d => d.condition < 75).map(item => (
                  <div key={item.id} className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-red-400">{item.id}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-bold uppercase">justified</span>
                    </div>
                    <p className="text-xs font-bold text-white">{item.name}</p>
                    <div className="text-[11px] text-slate-300 space-y-1 bg-black/30 p-2.5 rounded-lg font-mono">
                      <p><strong>Baseline Condition:</strong> 100%</p>
                      <p><strong>Current condition:</strong> {item.condition}%</p>
                      <p><strong>Degradation Rate:</strong> {item.degradationRate}% / year</p>
                      <p><strong>Research Lab:</strong> {item.lab}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 italic">
                      "Proposal justification: Decommissioning and replacement is highly recommended due to accelerated hardware breakdown rate of {item.degradationRate}%/yr, creating performance degradation bottlenecks."
                    </p>
                  </div>
                ))}
                
                {degradationData.filter(d => d.condition < 75).length === 0 && (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    All assets are currently above critical degradation thresholds (&gt;75% condition).
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // 3. Clearance Holds & Disposal Approvals render
  const renderClearanceDisposal = () => {
    // Generate affiliates lists and calculate delinquencies
    const uniqueCustodians = Array.from(new Set(activeAssets.filter(a => a.custodian).map(a => a.custodian)));
    
    const affiliatesData = uniqueCustodians.map((custName, idx) => {
      const custodianAssets = activeAssets.filter(a => a.custodian === custName);
      const overdueAssets = custodianAssets.filter(a => {
        if (!a.dueDate) return false;
        return new Date(a.dueDate).getTime() < new Date().getTime();
      });

      // Find user details from DB to see email and role context
      const userId = idx + 4; // Mock identifier matching seed custodians
      const manualHold = manualClearanceHolds.find(h => h.name === custName);
      
      const holdsActive = manualHold 
        ? manualHold.holdStatus === "Hold Active" 
        : (overdueAssets.length > 0);

      return {
        userId: manualHold?.userId || userId,
        name: custName,
        email: manualHold?.email || `${custName?.toLowerCase().replace(/\s/g, "") || "affiliate"}@dlsu.edu.ph`,
        role: custName === "Felix Torres" || custName?.startsWith("Dr.") ? "Faculty" : "Student",
        assetsCount: custodianAssets.length,
        overdueCount: overdueAssets.length,
        holdStatus: holdsActive ? "Hold Active" : "Cleared",
        notes: manualHold?.notes || (overdueAssets.length > 0 ? "System-Flagged: Overdue equipment delinquency." : "")
      };
    });

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Regulated Disposal Approvals */}
          <Card className="bg-slate-900 border-emerald-500/10 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-slate-400">Regulated Disposal Approvals Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-400">
                Assets scheduled for decommissioning by ITS/TSG cannot be purged without the Director's authorized sign-off.
              </p>

              <div className="space-y-3">
                {pendingDisposals.map(req => (
                  <div key={req.id} className="p-4 bg-slate-950/40 border border-white/5 rounded-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-white">{req.assetId} - {req.assetName}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Proposed by: {req.requestedBy} · {new Date(req.requestedAt).toLocaleDateString()}</p>
                      </div>
                      <Badge className="bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] uppercase font-bold">
                        Pending Sign-off
                      </Badge>
                    </div>

                    <div className="p-2.5 bg-black/20 rounded-lg text-[11px] text-slate-300 font-mono space-y-1">
                      <p><strong>Disposal Pathway:</strong> {req.disposalPathway}</p>
                      <p><strong>Physical Custodian:</strong> {req.lastCustodian}</p>
                      <p><strong>Breakdown Justification:</strong> {req.breakdownReasons}</p>
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="bg-red-950/20 border-red-500/30 text-red-400 hover:bg-red-950/50 hover:text-red-300 text-[10px] font-bold h-8"
                        onClick={() => rejectDisposal(req.id)}
                      >
                        Reject &amp; Recirculate
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold h-8"
                        onClick={() => approveDisposal(req.id)}
                      >
                        Authorize Disposal
                      </Button>
                    </div>
                  </div>
                ))}

                {pendingDisposals.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-center py-10 border border-dashed border-white/5 rounded-xl text-slate-400 text-xs">
                    <CheckCircle2 className="text-emerald-500/40 mb-2 size-8" />
                    <p className="font-semibold text-slate-300">Approvals Queue Empty</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">No assets require decommissioning sign-off.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Post-Project Accountability (Clearance Holds) */}
          <Card className="bg-slate-900 border-emerald-500/10 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-slate-400">Post-Project Affiliate Clearance holds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-400">
                departing or graduating affiliates must clear delinquencies before clearance sign-off is finalized by the Director.
              </p>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-white/5">
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase">Affiliate</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase text-center">Active Loans</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase text-center">Overdue</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase text-center">Status</TableHead>
                      <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliatesData.map(aff => {
                      const isDelinquent = aff.holdStatus === "Hold Active";
                      return (
                        <TableRow key={aff.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <TableCell className="text-xs">
                            <p className="font-bold text-white">{aff.name}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">{aff.role} · {aff.email}</p>
                          </TableCell>
                          <TableCell className="text-center font-semibold text-xs">{aff.assetsCount}</TableCell>
                          <TableCell className="text-center text-xs">
                            <span className={cn(aff.overdueCount > 0 ? "text-red-400 font-extrabold" : "text-slate-400")}>
                              {aff.overdueCount}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn("text-[9px] uppercase font-bold border", 
                              isDelinquent 
                                ? "bg-red-500/20 text-red-400 border-red-500/30" 
                                : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            )}>
                              {aff.holdStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className={cn("text-[10px] font-bold h-7 px-2", 
                                isDelinquent ? "text-emerald-400 hover:text-emerald-300" : "text-red-400 hover:text-red-300"
                              )}
                              onClick={() => {
                                setSelectedHoldAffiliate(aff);
                                setOverrideNotes(aff.notes);
                              }}
                            >
                              Manage
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
        </div>

        {/* Clearance holds management Dialog */}
        {selectedHoldAffiliate && (
          <Dialog open={!!selectedHoldAffiliate} onOpenChange={open => { if(!open) setSelectedHoldAffiliate(null); }}>
            <DialogContent className="max-w-md bg-slate-900 border border-emerald-500/20 text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-white uppercase tracking-wider">Manage Clearance Hold</DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Override hold statuses or flag delinquency notes for departing affiliate <strong className="text-emerald-400">{selectedHoldAffiliate.name}</strong>.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="p-3 bg-black/30 rounded-xl space-y-1 text-xs">
                  <p><strong>Institutional Account:</strong> {selectedHoldAffiliate.email}</p>
                  <p><strong>Affiliate Type:</strong> {selectedHoldAffiliate.role}</p>
                  <p><strong>Clearance Hold Status:</strong> <span className={selectedHoldAffiliate.holdStatus === "Hold Active" ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>{selectedHoldAffiliate.holdStatus}</span></p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-bold text-slate-300">Override / Hold Justification Notes</Label>
                  <textarea
                    value={overrideNotes}
                    onChange={e => setOverrideNotes(e.target.value)}
                    rows={3}
                    placeholder="Provide description notes regarding outstanding physical inventory returns, clearance sign-off exceptions, or delinquency explanations..."
                    className="w-full rounded-md border border-slate-700 bg-slate-800 text-xs text-white p-2.5 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 mt-2">
                <Button 
                  variant="outline"
                  onClick={() => setSelectedHoldAffiliate(null)}
                  className="bg-transparent hover:bg-white/5 text-slate-300 border-slate-700 text-xs font-semibold"
                >
                  Cancel
                </Button>
                
                {selectedHoldAffiliate.holdStatus === "Hold Active" ? (
                  <Button 
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                    onClick={() => {
                      toggleClearanceHold(selectedHoldAffiliate.userId, "Cleared", overrideNotes);
                      setSelectedHoldAffiliate(null);
                    }}
                  >
                    Release Hold &amp; Clear Affiliate
                  </Button>
                ) : (
                  <Button 
                    className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold"
                    onClick={() => {
                      toggleClearanceHold(selectedHoldAffiliate.userId, "Hold Active", overrideNotes);
                      setSelectedHoldAffiliate(null);
                    }}
                  >
                    Apply Clearance Hold
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  };

  // 4. Custom Report Generator (Audit Readiness) render
  const renderReports = () => {
    // Segregated based on funding source and searchQuery
    const filteredAssets = assets.filter(a => {
      const query = searchQuery.toLowerCase().trim();
      const matchQuery = 
        a.id.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query) ||
        a.serial.toLowerCase().includes(query) ||
        a.lab.toLowerCase().includes(query) ||
        a.manufacturer.toLowerCase().includes(query);

      let matchFunding = true;
      if (fundingFilter === "GOVERNMENT") {
        matchFunding = ["DOST", "CHED", "USAST"].includes(a.funding);
      } else if (fundingFilter === "PRIVATE") {
        matchFunding = ["USAID", "Internal Grants"].includes(a.funding);
      } else if (fundingFilter !== "ALL") {
        matchFunding = a.funding === fundingFilter;
      }

      let matchDate = true;
      if (dateFilterStart) {
        matchDate = matchDate && new Date(a.procured).getTime() >= new Date(dateFilterStart).getTime();
      }
      if (dateFilterEnd) {
        matchDate = matchDate && new Date(a.procured).getTime() <= new Date(dateFilterEnd).getTime();
      }

      return matchQuery && matchFunding && matchDate;
    });

    const triggerPrint = () => {
      window.print();
    };

    const triggerExportCSV = () => {
      // Mock CSV generation and file download
      const headers = ["Asset ID", "Property Tag", "Name", "Serial Number", "Manufacturer", "Category", "Funding", "Acquisition Date", "Valuation", "Status", "Custodian", "Lab"];
      const rows = filteredAssets.map(a => [
        a.id,
        a.itsPropertyTag || `DLSU-ITS-${a.id}`,
        a.name,
        a.serial,
        a.manufacturer,
        a.category,
        a.funding,
        a.procured,
        a.cost || 0,
        a.status,
        a.custodian || "Unassigned",
        a.lab
      ]);

      const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `AdRIC_Audit_Report_${fundingFilter}_Funding.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="space-y-6 print:bg-white print:text-black">
        {/* Filters Panel */}
        <Card className="bg-slate-900 border-emerald-500/10 text-white print:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-slate-400">Custom Audit Report Generator Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search Equipment</Label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input 
                    placeholder="Search ID, name, serial..." 
                    className="pl-9 text-xs bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500 h-9"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Funding Source (Segregated)</Label>
                <select
                  value={fundingFilter}
                  onChange={e => setFundingFilter(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Funding Sources</option>
                  <option value="GOVERNMENT">Government (DOST, CHED, USAST)</option>
                  <option value="PRIVATE">Private / Internal (USAID, Internal)</option>
                  <option value="DOST">DOST Funded</option>
                  <option value="CHED">CHED Funded</option>
                  <option value="USAID">USAID Funded</option>
                  <option value="USAST">USAST Funded</option>
                  <option value="Internal Grants">Internal Grants</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acquisition Start Date</Label>
                <Input 
                  type="date" 
                  className="text-xs bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500 h-9"
                  value={dateFilterStart}
                  onChange={e => setDateFilterStart(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acquisition End Date</Label>
                <Input 
                  type="date" 
                  className="text-xs bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500 h-9"
                  value={dateFilterEnd}
                  onChange={e => setDateFilterEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-white/5 pt-3">
              <Button 
                variant="outline" 
                className="bg-[#0A1F14] border-emerald-950 text-emerald-300 hover:bg-emerald-950/40 hover:text-emerald-200 text-xs font-bold"
                onClick={triggerPrint}
              >
                <Printer className="size-3.5 mr-2" />
                Print compliance report
              </Button>
              <Button 
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                onClick={triggerExportCSV}
              >
                <Download className="size-3.5 mr-2" />
                Export CSV archive
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audit Results Table */}
        <Card className="bg-slate-900 border-emerald-500/10 text-white print:border-none print:bg-white print:text-black">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-slate-400 print:text-slate-800">
                AdRIC Compliance Audit Report ({filteredAssets.length} Assets Found)
              </CardTitle>
              <p className="text-[10px] text-slate-500 print:block hidden mt-1">Generated on: {new Date().toLocaleString()} · DLSU AdRIC Director Office</p>
            </div>
            <Badge className="bg-emerald-900/30 border-emerald-500/30 text-emerald-400 font-bold text-[9px] print:hidden">
              Audit Ready
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-white/5 print:border-slate-300">
                  <TableRow className="hover:bg-transparent border-white/5 print:border-slate-300">
                    <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase print:text-slate-800">Equipment ID</TableHead>
                    <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase print:text-slate-800">Physical Tag</TableHead>
                    <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase print:text-slate-800">Details</TableHead>
                    <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase print:text-slate-800 text-center">Funding</TableHead>
                    <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase print:text-slate-800 text-center">Acquired</TableHead>
                    <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase print:text-slate-800 text-right">Valuation</TableHead>
                    <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase print:text-slate-800 text-right">Current Status / Custodian</TableHead>
                    <TableHead className="text-slate-400 text-[10px] font-bold tracking-wider uppercase print:text-slate-800 text-right print:hidden">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map(item => {
                    const isDisposed = item.status === "Disposed";
                    return (
                      <TableRow key={item.id} className="border-b border-white/5 print:border-slate-200 hover:bg-white/5 transition-colors">
                        <TableCell className="font-mono text-xs text-emerald-400 print:text-slate-900 font-bold">{item.id}</TableCell>
                        <TableCell className="text-xs">
                          <p className="font-mono text-white print:text-slate-900">{item.itsPropertyTag || `DLSU-ITS-${item.id}`}</p>
                          <p className="text-[9px] text-slate-500 font-mono">{item.tsgPropertyTag || `DLSU-TSG-${item.id}`}</p>
                        </TableCell>
                        <TableCell className="text-xs">
                          <p className="font-bold text-white print:text-slate-900">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold print:text-slate-600">{item.lab} · {item.manufacturer} · S/N: {item.serial}</p>
                        </TableCell>
                        <TableCell className="text-center text-xs font-semibold text-slate-300 print:text-slate-800">{item.funding}</TableCell>
                        <TableCell className="text-center text-xs font-mono text-slate-300 print:text-slate-800">{item.procured}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-semibold text-slate-300 print:text-slate-800">
                          PHP {(item.cost || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {isDisposed ? (
                            <div>
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px] mb-1 font-bold">Disposed</Badge>
                              <p className="text-[9px] text-slate-500 font-mono">ID: {item.disposalId}</p>
                            </div>
                          ) : (
                            <div>
                              <Badge className={cn("text-[9px] font-bold mb-1", 
                                item.status === "Active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : 
                                item.status === "On Loan" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                                "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              )}>
                                {item.status}
                              </Badge>
                              <p className="text-[9px] text-slate-400 print:text-slate-600">{item.custodian || "No custodian assigned"}</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right print:hidden">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold h-7 px-2"
                            onClick={() => setSelectedAssetForAudit(item)}
                          >
                            Full lifecycle
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filteredAssets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-slate-400 text-xs">
                        No equipment matched the filtered criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Lifecycle Modal */}
        {selectedAssetForAudit && (
          <Dialog open={!!selectedAssetForAudit} onOpenChange={open => { if(!open) setSelectedAssetForAudit(null); }}>
            <DialogContent className="max-w-2xl bg-slate-900 border border-emerald-500/20 text-white max-h-[85vh] overflow-y-auto" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Tag className="text-emerald-400 size-4" />
                  Asset Lifecycle Audit Trail: {selectedAssetForAudit.id}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Full chronological registry logs mapping physical location, history, and custody transitions.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-3">
                {/* 1. Core Metadata */}
                <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 border border-white/5 rounded-xl text-xs">
                  <div className="space-y-1.5">
                    <p><span className="text-slate-400">Equipment Name:</span> <strong className="text-white">{selectedAssetForAudit.name}</strong></p>
                    <p><span className="text-slate-400">Serial Number:</span> <span className="font-mono">{selectedAssetForAudit.serial}</span></p>
                    <p><span className="text-slate-400">Manufacturer:</span> {selectedAssetForAudit.manufacturer}</p>
                    <p><span className="text-slate-400">Funding Source:</span> <span className="font-semibold text-emerald-400">{selectedAssetForAudit.funding}</span></p>
                    <p><span className="text-slate-400">Acquisition Date:</span> {selectedAssetForAudit.procured}</p>
                  </div>
                  <div className="space-y-1.5 border-l border-white/5 pl-4">
                    <p><span className="text-slate-400">ITS property Tag:</span> <span className="font-mono text-emerald-400">{selectedAssetForAudit.itsPropertyTag || `DLSU-ITS-${selectedAssetForAudit.id}`}</span></p>
                    <p><span className="text-slate-400">TSG property Tag:</span> <span className="font-mono text-emerald-400">{selectedAssetForAudit.tsgPropertyTag || `DLSU-TSG-${selectedAssetForAudit.id}`}</span></p>
                    <p><span className="text-slate-400">Deed of Donation Ref:</span> <span className="font-semibold text-emerald-400">DOD-2024-{selectedAssetForAudit.id.split("-").pop()}</span></p>
                    <p><span className="text-slate-400">Purchase Valuation:</span> PHP {selectedAssetForAudit.cost?.toLocaleString() || "0"}</p>
                    <p><span className="text-slate-400">Current Status:</span> <span className="font-bold text-emerald-400">{selectedAssetForAudit.status}</span></p>
                  </div>
                </div>

                {/* 2. Custodian & Transfer History */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 border-b border-white/5 pb-1 flex items-center gap-1.5">
                    <User size={13} className="text-emerald-400" />
                    Custodianship &amp; Transfer History
                  </h4>
                  {transfers.filter(t => t.assetId === selectedAssetForAudit.id).length > 0 ? (
                    <div className="space-y-1.5">
                      {transfers.filter(t => t.assetId === selectedAssetForAudit.id).map(t => (
                        <div key={t.id} className="p-2.5 bg-black/20 rounded-lg text-xs flex justify-between items-center">
                          <div>
                            <span className="font-bold text-white">{t.from}</span>
                            <span className="text-slate-400 mx-2">➔</span>
                            <span className="font-bold text-emerald-400">{t.to}</span>
                            <p className="text-[10px] text-slate-500 mt-0.5">Date Initiated: {t.initiated} · Lab: {t.lab}</p>
                          </div>
                          <Badge className={cn("text-[9px] uppercase font-bold border", 
                            t.status === "Approved" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          )}>{t.status}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">No custody transfer history registered.</p>
                  )}
                </div>

                {/* 3. Repair & Maintenance History */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 border-b border-white/5 pb-1 flex items-center gap-1.5">
                    <Wrench size={13} className="text-emerald-400" />
                    Repair &amp; Maintenance Logs
                  </h4>
                  {repairRequests.filter(r => r.assetId === selectedAssetForAudit.id).length > 0 ? (
                    <div className="space-y-1.5">
                      {repairRequests.filter(r => r.assetId === selectedAssetForAudit.id).map(r => (
                        <div key={r.id} className="p-2.5 bg-black/20 rounded-lg text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white">{r.id} · Priority: <span className="text-amber-400">{r.priority}</span></span>
                            <Badge className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold">{r.statusLabel}</Badge>
                          </div>
                          <p className="text-slate-300">{r.description}</p>
                          <p className="text-[9px] text-slate-500">Reported By: {r.custodian} · Submitted At: {new Date(r.submittedAt).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">No technical repair logs registered.</p>
                  )}
                </div>

                {/* 4. Routine Inspections */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 border-b border-white/5 pb-1 flex items-center gap-1.5">
                    <ClipboardCheck size={13} className="text-emerald-400" />
                    Routine Inspection Reports
                  </h4>
                  {inspections.filter(i => i.assetId === selectedAssetForAudit.id).length > 0 ? (
                    <div className="space-y-1.5">
                      {inspections.filter(i => i.assetId === selectedAssetForAudit.id).map(i => (
                        <div key={i.id} className="p-2.5 bg-black/20 rounded-lg text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white">{i.id} · {i.cycleType} Cycle</span>
                            <Badge className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-bold">{i.status}</Badge>
                          </div>
                          <p className="text-slate-300">{i.description}</p>
                          <p className="text-[9px] text-slate-500">Inspected By: {i.custodian} · Date: {new Date(i.submittedAt).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">No physical routine inspections logged.</p>
                  )}
                </div>

                {/* 5. Disposal Details if Disposed */}
                {selectedAssetForAudit.status === "Disposed" && selectedAssetForAudit.disposalDetails && (
                  <div className="space-y-2 p-3 bg-red-950/20 border border-red-500/20 rounded-xl">
                    <h4 className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                      <XCircle size={13} />
                      Decommissioning &amp; Disposal Details
                    </h4>
                    <div className="text-xs text-slate-300 mt-1.5 font-mono space-y-1">
                      <p><strong>Disposal ID:</strong> {selectedAssetForAudit.disposalId}</p>
                      <p><strong>Decommission Date:</strong> {selectedAssetForAudit.disposalDetails.decommissionDate}</p>
                      <p><strong>Decommissioned By:</strong> {selectedAssetForAudit.disposalDetails.decommissionedBy}</p>
                      <p><strong>Disposal Pathway:</strong> {selectedAssetForAudit.disposalDetails.disposalPathway}</p>
                      <p><strong>Breakdown Reasons:</strong> {selectedAssetForAudit.disposalDetails.breakdownReasons}</p>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-2">
                <Button 
                  onClick={() => setSelectedAssetForAudit(null)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                >
                  Close Audit Trail
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-emerald-500/10 p-5 rounded-2xl text-white print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-wide uppercase">AdRIC Director Control Suite</h1>
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] uppercase tracking-widest px-2 py-0.5">ADMIN OVERWATCH</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">High-level executive oversight, health tracking, decommissioning approvals, and compliance audit trail reporting.</p>
        </div>
      </div>

      {/* Tabs rendering */}
      {activeTab === "overview" && renderOverview()}
      {activeTab === "analytics" && renderAnalytics()}
      {activeTab === "clearance-disposal" && renderClearanceDisposal()}
      {activeTab === "reports" && renderReports()}
    </div>
  );
}
