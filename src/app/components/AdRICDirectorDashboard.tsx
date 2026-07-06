import { useState } from "react";
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
    const manilaAssets = activeAssets.filter(a => a.location === "Manila").length;
    const lagunaAssets = activeAssets.filter(a => a.location === "Laguna").length;
    const manilaPercent = activeAssets.length ? Math.round((manilaAssets / activeAssets.length) * 100) : 0;
    const lagunaPercent = activeAssets.length ? Math.round((lagunaAssets / activeAssets.length) * 100) : 0;

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Registry Valuation</p>
                <h3 className="text-2xl font-extrabold mt-1 text-foreground">PHP {totalValuation.toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={20} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Active Inventory</p>
                <h3 className="text-2xl font-extrabold mt-1 text-foreground">{activeAssets.length} Equipment</h3>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Monitor size={20} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Maintenance &amp; Degrading</p>
                <h3 className="text-2xl font-extrabold mt-1 text-foreground">
                  {maintenanceCount} Mnt · {degradingAssets.length} Deg
                </h3>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={20} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Pending Approvals</p>
                <h3 className="text-2xl font-extrabold mt-1 text-foreground">
                  {pendingDisposals.length} Disposals
                </h3>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-100 dark:border-red-500/20 text-red-650 dark:text-red-400">
                <ShieldAlert size={20} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resource Distribution Map & Health Index */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visual Resource Mapping */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Campus Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <MapPin className="text-[#005A36] size-4" />
                  <span>Manila Campus</span>
                </div>
                <span className="font-bold text-foreground">{manilaAssets} ({manilaPercent}%)</span>
              </div>
              <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                <div className="bg-[#005A36] h-full" style={{ width: `${manilaPercent}%` }} />
              </div>

              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <MapPin className="text-[#10B981] size-4" />
                  <span>Laguna Campus</span>
                </div>
                <span className="font-bold text-foreground">{lagunaAssets} ({lagunaPercent}%)</span>
              </div>
              <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                <div className="bg-[#10B981] h-full" style={{ width: `${lagunaPercent}%` }} />
              </div>
              
              <Separator />
              <div className="p-4 bg-muted/40 border border-border rounded-xl">
                <p className="text-[10px] font-bold text-primary tracking-wider uppercase">Administrative Oversight</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Active balance is maintained to allow research equipment resource sharing between locations, overseen by the AdRIC Director office.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 10 Specialized Laboratories Health & Utilization */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Specialized Laboratories Status Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase">Laboratory ID</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase">Campus</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Assets</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Health Index</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Utilization</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-right">Status</TableHead>
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

                      let statusBadge = <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-250 text-[9px] font-bold uppercase">Safe</Badge>;
                      if (avgCondition < 75) {
                        statusBadge = <Badge className="bg-red-50 text-red-700 border border-red-255 text-[9px] font-bold uppercase">Critical Watch</Badge>;
                      } else if (avgCondition < 88) {
                        statusBadge = <Badge className="bg-amber-50 text-amber-700 border border-amber-250 text-[9px] font-bold uppercase">Attention</Badge>;
                      }

                      return (
                        <TableRow key={lab.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-bold text-foreground text-xs">{lab.id}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{lab.location}</TableCell>
                          <TableCell className="text-center font-semibold text-xs text-foreground">{assetCount}</TableCell>
                          <TableCell className="text-center text-xs">
                            <span className={cn(avgCondition < 75 ? "text-red-600 font-bold" : avgCondition < 88 ? "text-amber-600" : "text-[#005A36] font-semibold")}>
                              {avgCondition}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-xs font-mono text-muted-foreground">{utilRate}%</TableCell>
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
    const degradationData = activeAssets.map(a => {
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
        <div>
          <h2 className="text-lg font-bold text-foreground">Chronological Health &amp; Hardware Degradation</h2>
          <p className="text-xs text-muted-foreground">Tracking resource health indexes against original baseline tests to justify future procurement.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline Tracking */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Calculated hardware degradation timelines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase">Equipment ID</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase">Category / Name</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Procured</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Service (Yrs)</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Condition</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-right">Degradation Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {degradationData.map(item => (
                      <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-xs text-[#005A36] font-bold">{item.id}</TableCell>
                        <TableCell className="text-xs">
                          <p className="font-bold text-foreground">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold">{item.lab} · {item.manufacturer}</p>
                        </TableCell>
                        <TableCell className="text-center text-xs font-mono text-muted-foreground">{item.procured}</TableCell>
                        <TableCell className="text-center text-xs font-mono text-muted-foreground">{item.yearsInService}</TableCell>
                        <TableCell className="text-center text-xs">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-foreground">{item.condition}%</span>
                            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden mt-1">
                              <div 
                                className={cn("h-full", item.condition >= 90 ? "bg-emerald-500" : item.condition >= 75 ? "bg-amber-500" : "bg-red-500")} 
                                style={{ width: `${item.condition}%` }} 
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-red-600 font-mono">
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
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Empirical Procurement Justifier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Identify assets degrading rapidly below the threshold (condition &lt; 75%) to justify funding proposals.
              </p>
              
              <div className="space-y-3">
                {degradationData.filter(d => d.condition < 75).map(item => (
                  <div key={item.id} className="p-4 bg-red-50/50 border border-red-155 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-red-750">{item.id}</span>
                      <Badge className="bg-red-100 border border-red-200 text-red-750 text-[8px] font-bold uppercase tracking-wider">justified</Badge>
                    </div>
                    <p className="text-xs font-bold text-foreground">{item.name}</p>
                    <div className="text-[10px] text-muted-foreground space-y-1 bg-background border border-border p-2.5 rounded-lg font-mono leading-relaxed">
                      <p><strong className="text-foreground">Baseline Condition:</strong> 100%</p>
                      <p><strong className="text-foreground">Current Condition:</strong> {item.condition}%</p>
                      <p><strong className="text-foreground">Degradation Rate:</strong> {item.degradationRate}% / year</p>
                      <p><strong className="text-foreground">Research Lab:</strong> {item.lab}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground/80 italic leading-relaxed">
                      "Proposal justification: Decommissioning and replacement is highly recommended due to accelerated hardware breakdown rate of {item.degradationRate}%/yr, creating performance degradation bottlenecks."
                    </p>
                  </div>
                ))}
                
                {degradationData.filter(d => d.condition < 75).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-xs italic">
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
    const uniqueCustodians = Array.from(new Set(activeAssets.filter(a => a.custodian).map(a => a.custodian)));
    
    const affiliatesData = uniqueCustodians.map((custName, idx) => {
      const custodianAssets = activeAssets.filter(a => a.custodian === custName);
      const overdueAssets = custodianAssets.filter(a => {
        if (!a.dueDate) return false;
        return new Date(a.dueDate).getTime() < new Date().getTime();
      });

      const userId = idx + 4;
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
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Regulated Disposal Approvals Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Assets scheduled for decommissioning by ITS/TSG cannot be purged without the Director's authorized sign-off.
              </p>

              <div className="space-y-3.5">
                {pendingDisposals.map(req => (
                  <Card key={req.id} className="border-l-4 border-l-amber-500 overflow-hidden shadow-sm" style={{ borderLeftWidth: 4 }}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{req.assetId} - {req.assetName}</h4>
                          <p className="text-[10px] text-muted-foreground mt-1">Proposed by: {req.requestedBy} · {new Date(req.requestedAt).toLocaleDateString()}</p>
                        </div>
                        <Badge className="bg-amber-50 border border-amber-200 text-amber-700 text-[9px] uppercase font-bold">
                          Pending Sign-off
                        </Badge>
                      </div>

                      <div className="p-3 bg-muted/40 border border-border rounded-lg text-[10px] text-muted-foreground font-mono space-y-1.5 leading-relaxed">
                        <p><strong className="text-foreground">Disposal Pathway:</strong> {req.disposalPathway}</p>
                        <p><strong className="text-foreground">Physical Custodian:</strong> {req.lastCustodian}</p>
                        <p><strong className="text-foreground">Breakdown Justification:</strong> {req.breakdownReasons}</p>
                      </div>

                      <div className="flex gap-2 justify-end pt-1">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-red-200 text-red-650 hover:bg-red-50 text-[10px] font-bold h-8"
                          onClick={() => rejectDisposal(req.id)}
                        >
                          Reject &amp; Recirculate
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-[#005A36] hover:bg-[#004225] text-white text-[10px] font-bold h-8 border-none"
                          onClick={() => approveDisposal(req.id)}
                        >
                          Authorize Disposal
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {pendingDisposals.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground text-xs bg-muted/10">
                    <CheckCircle2 className="text-[#005A36]/40 mb-2.5 size-9" />
                    <p className="font-semibold text-foreground">Approvals Queue Empty</p>
                    <p className="text-[10px] text-muted-foreground mt-1">No assets require decommissioning sign-off.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Post-Project Accountability (Clearance Holds) */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Post-Project Affiliate Clearance Holds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Departing or graduating affiliates must clear delinquencies before clearance sign-off is finalized by the Director.
              </p>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase">Affiliate</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Active Loans</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Overdue</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-center">Status</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider uppercase text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliatesData.map(aff => {
                      const isDelinquent = aff.holdStatus === "Hold Active";
                      return (
                        <TableRow key={aff.name} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-xs">
                            <p className="font-bold text-foreground">{aff.name}</p>
                            <p className="text-[10px] text-muted-foreground font-semibold">{aff.role} · {aff.email}</p>
                          </TableCell>
                          <TableCell className="text-center font-semibold text-xs text-foreground">{aff.assetsCount}</TableCell>
                          <TableCell className="text-center text-xs">
                            <span className={cn(aff.overdueCount > 0 ? "text-red-650 font-extrabold" : "text-muted-foreground")}>
                              {aff.overdueCount}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn("text-[9px] uppercase font-bold border", 
                              isDelinquent 
                                ? "bg-red-50 text-red-750 border-red-200" 
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            )}>
                              {aff.holdStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className={cn("text-[10px] font-bold h-7 px-2", 
                                isDelinquent ? "text-emerald-700 hover:text-emerald-800" : "text-red-700 hover:text-red-800"
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

        {/* Clearance Holds Management Dialog */}
        {selectedHoldAffiliate && (
          <Dialog open={!!selectedHoldAffiliate} onOpenChange={open => { if(!open) setSelectedHoldAffiliate(null); }}>
            <DialogContent className="max-w-md bg-card border border-border text-card-foreground">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-foreground uppercase tracking-wider">Manage Clearance Hold</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Override hold statuses or flag delinquency notes for departing affiliate <strong className="text-[#005A36]">{selectedHoldAffiliate.name}</strong>.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                  <p><strong className="text-foreground">Institutional Account:</strong> {selectedHoldAffiliate.email}</p>
                  <p><strong className="text-foreground">Affiliate Type:</strong> {selectedHoldAffiliate.role}</p>
                  <p><strong className="text-foreground">Clearance Hold Status:</strong> <span className={selectedHoldAffiliate.holdStatus === "Hold Active" ? "text-red-655 font-bold" : "text-emerald-700 font-bold"}>{selectedHoldAffiliate.holdStatus}</span></p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-bold text-foreground">Override / Hold Justification Notes</Label>
                  <textarea
                    value={overrideNotes}
                    onChange={e => setOverrideNotes(e.target.value)}
                    rows={3}
                    placeholder="Provide description notes regarding outstanding physical inventory returns, clearance sign-off exceptions, or delinquency explanations..."
                    className="w-full rounded-md border border-border bg-background text-xs text-foreground p-3 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 mt-2">
                <Button 
                  variant="outline"
                  onClick={() => setSelectedHoldAffiliate(null)}
                  className="border-border text-xs font-semibold"
                >
                  Cancel
                </Button>
                
                {selectedHoldAffiliate.holdStatus === "Hold Active" ? (
                  <Button 
                    className="bg-[#005A36] hover:bg-[#004225] text-white text-xs font-bold border-none"
                    onClick={() => {
                      toggleClearanceHold(selectedHoldAffiliate.userId, "Cleared", overrideNotes);
                      setSelectedHoldAffiliate(null);
                    }}
                  >
                    Release Hold &amp; Clear Affiliate
                  </Button>
                ) : (
                  <Button 
                    variant="destructive"
                    className="text-xs font-bold"
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
        <Card className="shadow-sm print:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Custom Audit Report Generator Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Search Equipment</Label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                  <Input 
                    placeholder="Search ID, name, serial..." 
                    className="pl-9 text-xs bg-muted/40 border-border text-foreground focus-visible:ring-[#005A36] h-9"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Funding Source (Segregated)</Label>
                <select
                  value={fundingFilter}
                  onChange={e => setFundingFilter(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Acquisition Start Date</Label>
                <Input 
                  type="date" 
                  className="text-xs bg-muted/40 border-border text-foreground focus-visible:ring-[#005A36] h-9"
                  value={dateFilterStart}
                  onChange={e => setDateFilterStart(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Acquisition End Date</Label>
                <Input 
                  type="date" 
                  className="text-xs bg-muted/40 border-border text-foreground focus-visible:ring-[#005A36] h-9"
                  value={dateFilterEnd}
                  onChange={e => setDateFilterEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-border pt-4">
              <Button 
                variant="outline" 
                className="bg-emerald-50/50 border-emerald-250 text-emerald-700 hover:bg-emerald-100 text-xs font-bold h-9"
                onClick={triggerPrint}
              >
                <Printer className="size-3.5 mr-2" />
                Print Compliance Report
              </Button>
              <Button 
                className="bg-[#005A36] hover:bg-[#004225] text-white text-xs font-bold border-none h-9"
                onClick={triggerExportCSV}
              >
                <Download className="size-3.5 mr-2" />
                Export CSV Archive
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audit Results Table */}
        <Card className="shadow-sm print:border-none print:bg-white print:text-black">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground print:text-slate-800">
                AdRIC Compliance Audit Report ({filteredAssets.length} Assets Found)
              </CardTitle>
              <p className="text-[10px] text-muted-foreground/60 print:block hidden mt-1">Generated on: {new Date().toLocaleString()} · DLSU AdRIC Director Office</p>
            </div>
            <Badge className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[9px] uppercase print:hidden">
              Audit Ready
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="print:border-slate-300">
                  <TableRow className="print:border-slate-300">
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850">Equipment ID</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850">Physical Tag</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850">Details</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-center">Funding</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-center">Acquired</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-right">Valuation</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-right font-bold">Status / Custodian</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase print:text-slate-850 text-right print:hidden">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map(item => {
                    const isDisposed = item.status === "Disposed";
                    return (
                      <TableRow key={item.id} className="print:border-slate-200 hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-xs text-[#005A36] print:text-slate-900 font-bold">{item.id}</TableCell>
                        <TableCell className="text-xs">
                          <p className="font-mono text-foreground print:text-slate-900 font-semibold">{item.itsPropertyTag || `DLSU-ITS-${item.id}`}</p>
                          <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">{item.tsgPropertyTag || `DLSU-TSG-${item.id}`}</p>
                        </TableCell>
                        <TableCell className="text-xs">
                          <p className="font-bold text-foreground print:text-slate-900">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold print:text-slate-600 mt-0.5">{item.lab} · {item.manufacturer} · S/N: {item.serial}</p>
                        </TableCell>
                        <TableCell className="text-center text-xs font-semibold text-muted-foreground print:text-slate-800">{item.funding}</TableCell>
                        <TableCell className="text-center text-xs font-mono text-muted-foreground print:text-slate-800">{item.procured}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-semibold text-muted-foreground print:text-slate-800">
                          PHP {(item.cost || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {isDisposed ? (
                            <div className="space-y-0.5">
                              <Badge className="bg-red-50 text-red-750 border border-red-200 text-[9px] font-bold uppercase">Disposed</Badge>
                              <p className="text-[9px] text-muted-foreground/60 font-mono">ID: {item.disposalId}</p>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <Badge className={cn("text-[9px] font-bold border uppercase", 
                                item.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
                                item.status === "On Loan" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                "bg-amber-50 text-amber-700 border-amber-200"
                              )}>
                                {item.status}
                              </Badge>
                              <p className="text-[9px] text-muted-foreground print:text-slate-600 font-semibold">{item.custodian || "No custodian assigned"}</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right print:hidden">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[#005A36] hover:text-[#004225] text-[10px] font-bold h-7 px-2"
                            onClick={() => setSelectedAssetForAudit(item)}
                          >
                            Full Lifecycle
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filteredAssets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-xs italic">
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
            <DialogContent className="max-w-2xl bg-card border border-border text-card-foreground max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Tag className="text-[#005A36] size-4" />
                  Asset Lifecycle Audit Trail: {selectedAssetForAudit.id}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Full chronological registry logs mapping physical location, history, and custody transitions.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-3">
                {/* 1. Core Metadata */}
                <div className="grid grid-cols-2 gap-4 bg-muted/45 p-4 border border-border rounded-xl text-xs text-muted-foreground leading-relaxed">
                  <div className="space-y-1.5">
                    <p><span>Equipment Name:</span> <strong className="text-foreground">{selectedAssetForAudit.name}</strong></p>
                    <p><span>Serial Number:</span> <span className="font-mono">{selectedAssetForAudit.serial}</span></p>
                    <p><span>Manufacturer:</span> {selectedAssetForAudit.manufacturer}</p>
                    <p><span>Funding Source:</span> <span className="font-semibold text-[#005A36]">{selectedAssetForAudit.funding}</span></p>
                    <p><span>Acquisition Date:</span> {selectedAssetForAudit.procured}</p>
                  </div>
                  <div className="space-y-1.5 border-l border-border pl-4">
                    <p><span>ITS Property Tag:</span> <span className="font-mono text-[#005A36] font-semibold">{selectedAssetForAudit.itsPropertyTag || `DLSU-ITS-${selectedAssetForAudit.id}`}</span></p>
                    <p><span>TSG Property Tag:</span> <span className="font-mono text-[#005A36] font-semibold">{selectedAssetForAudit.tsgPropertyTag || `DLSU-TSG-${selectedAssetForAudit.id}`}</span></p>
                    <p><span>Deed of Donation Ref:</span> <span className="font-semibold text-[#005A36]">DOD-2024-{selectedAssetForAudit.id.split("-").pop()}</span></p>
                    <p><span>Purchase Valuation:</span> PHP {selectedAssetForAudit.cost?.toLocaleString() || "0"}</p>
                    <p><span>Current Status:</span> <span className="font-bold text-[#005A36]">{selectedAssetForAudit.status}</span></p>
                  </div>
                </div>

                {/* 2. Custodian & Transfer History */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground border-b border-border pb-1.5 flex items-center gap-1.5">
                    <User size={13} className="text-[#005A36]" />
                    Custodianship &amp; Transfer History
                  </h4>
                  {transfers.filter(t => t.assetId === selectedAssetForAudit.id).length > 0 ? (
                    <div className="space-y-2">
                      {transfers.filter(t => t.assetId === selectedAssetForAudit.id).map(t => (
                        <div key={t.id} className="p-3 bg-muted/30 border border-border rounded-lg text-xs flex justify-between items-center">
                          <div>
                            <span className="font-bold text-foreground">{t.from}</span>
                            <span className="text-muted-foreground mx-2.5">➔</span>
                            <span className="font-bold text-[#005A36]">{t.to}</span>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">Date Initiated: {t.initiated} · Lab: {t.lab}</p>
                          </div>
                          <Badge className={cn("text-[9px] uppercase font-bold border", 
                            t.status === "Approved" ? "bg-emerald-50 border-emerald-255 text-emerald-700" : "bg-amber-50 border-amber-255 text-amber-700"
                          )}>{t.status}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/60 italic p-1">No custody transfer history registered.</p>
                  )}
                </div>

                {/* 3. Repair & Maintenance History */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground border-b border-border pb-1.5 flex items-center gap-1.5">
                    <Wrench size={13} className="text-[#005A36]" />
                    Repair &amp; Maintenance Logs
                  </h4>
                  {repairRequests.filter(r => r.assetId === selectedAssetForAudit.id).length > 0 ? (
                    <div className="space-y-2">
                      {repairRequests.filter(r => r.assetId === selectedAssetForAudit.id).map(r => (
                        <div key={r.id} className="p-3 bg-muted/30 border border-border rounded-lg text-xs space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-foreground">{r.id} · Priority: <span className="text-amber-600">{r.priority}</span></span>
                            <Badge className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold uppercase">{r.statusLabel}</Badge>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{r.description}</p>
                          <p className="text-[9px] text-muted-foreground/60">Reported By: {r.custodian} · Submitted At: {new Date(r.submittedAt).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/60 italic p-1">No technical repair logs registered.</p>
                  )}
                </div>

                {/* 4. Routine Inspections */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground border-b border-border pb-1.5 flex items-center gap-1.5">
                    <ClipboardCheck size={13} className="text-[#005A36]" />
                    Routine Inspection Reports
                  </h4>
                  {inspections.filter(i => i.assetId === selectedAssetForAudit.id).length > 0 ? (
                    <div className="space-y-2">
                      {inspections.filter(i => i.assetId === selectedAssetForAudit.id).map(i => (
                        <div key={i.id} className="p-3 bg-muted/30 border border-border rounded-lg text-xs space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-foreground">{i.id} · {i.cycleType} Cycle</span>
                            <Badge className="bg-blue-50 border border-blue-200 text-blue-700 text-[9px] font-bold uppercase">{i.status}</Badge>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{i.description}</p>
                          <p className="text-[9px] text-muted-foreground/60">Inspected By: {i.custodian} · Date: {new Date(i.submittedAt).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/60 italic p-1">No physical routine inspections logged.</p>
                  )}
                </div>

                {/* 5. Disposal Details if Disposed */}
                {selectedAssetForAudit.status === "Disposed" && selectedAssetForAudit.disposalDetails && (
                  <div className="space-y-2.5 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <h4 className="text-xs font-bold text-red-755 flex items-center gap-1.5">
                      <XCircle size={13} />
                      Decommissioning &amp; Disposal Details
                    </h4>
                    <div className="text-xs text-muted-foreground mt-2 font-mono space-y-1.5 leading-relaxed">
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
                  className="bg-[#005A36] hover:bg-[#004225] text-white text-xs font-bold border-none"
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
      <div className="mb-6 print:hidden">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">AdRIC Director Control Suite</h1>
          <Badge className="bg-[#005A36] hover:bg-[#004225] text-white font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 border-none">ADMIN OVERWATCH</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">High-level executive oversight, health tracking, decommissioning approvals, and compliance audit trail reporting.</p>
      </div>

      {/* Tabs rendering */}
      {activeTab === "overview" && renderOverview()}
      {activeTab === "analytics" && renderAnalytics()}
      {activeTab === "clearance-disposal" && renderClearanceDisposal()}
      {activeTab === "reports" && renderReports()}
    </div>
  );
}
