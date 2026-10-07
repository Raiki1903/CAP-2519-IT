import { useState } from "react";
import { useSession } from "@web/state/session";
import { useServerData } from "@web/state/serverData";
import { useBrowserOnly } from "@web/state/browserOnly";
import * as inspectionsApi from "@web/api/inspections.api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { ReturnForm } from "@web/features/returns/ReturnForm";
import TSGAnalyticsView from "@web/features/analytics/staff/TSGAnalyticsView";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import { Switch } from "@web/components/ui/switch";
import { Label } from "@web/components/ui/label";
import { Separator } from "@web/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@web/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { RepairProgressDialog } from "@web/features/repairs/RepairProgressDialog";
import { useRepairTickets } from "@web/features/repairs/useRepairTickets";
import { useStaffAssets } from "@web/features/assets/useStaffAssets";
import { useInspectionReports } from "@web/features/inspections/useInspectionReports";
import { cn } from "@web/components/ui/utils";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus, Search, Download, CheckCircle, Clock, Package, DollarSign,
  ChevronRight, LayoutGrid, Table2, MapPin, Calendar, Tag, Wrench,
  BarChart3, Bell, AlertTriangle, Shield, QrCode, Printer, Zap, Eye,
  Image as ImageIcon, XCircle, Trash2, Pencil, Archive, ClipboardCheck, RefreshCw, Camera, Upload
} from "lucide-react";

const MINT = "#10B981";

// TSG Specific Constants - 10 DB Research Centers evenly distributed across 4 groups
const labGroups = [
  { id: "A", name: "Group A", labs: ["CITe4D", "CAR", "CNIS"], color: "text-blue-600" },
  { id: "B", name: "Group B", labs: ["CeHCI", "CeLT", "TE3D"], color: "text-violet-600" },
  { id: "C", name: "Group C", labs: ["GAME", "Bio"], color: "text-amber-600" },
  { id: "D", name: "Group D", labs: ["CIVI", "HXIL"], color: "text-emerald-600" },
];

const healthData: any[] = [];

const statusBadge: Record<string, string> = {
  Inspected: "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold",
  "For Inspection": "bg-amber-50 text-amber-800 border-amber-300 font-bold",
  "Due Soon": "bg-amber-50 text-amber-700 border-amber-200",
  Overdue: "bg-red-50 text-red-700 border-red-200",
};

const urgencyBadge: Record<string, string> = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Normal: "bg-blue-50   text-blue-700   border-blue-200",
  High: "bg-amber-50  text-amber-700  border-amber-200",
  Critical: "bg-red-50    text-red-700    border-red-200",
};

// Database condition names to the labels the finalize dialog offers, so a report
// reads the same in the log as when it was filed.
const REPORT_CONDITION_LABEL: Record<string, string> = {
  PERFECT: "Perfect",
  OPERATIONAL: "Operational",
  MINOR_DRIFT: "Minor Drift",
  DEGRADED: "Degraded Performance",
  CRITICAL_DEFECT: "Critical Defect",
};

function MetricBar({ value, color }: { value: number; color: string }) {
  return <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1 w-12"><div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, value)}%` }} /></div>;
}

export function ITSDashboard({ activeTab }: { activeTab: string }) {
  const { currentUser } = useSession();
  const { syncFromDb } = useServerData();
  const { returns } = useBrowserOnly();
  const { displayedAssets, fetchDbAssets } = useStaffAssets();
  const { dbReports, fetchDbReports } = useInspectionReports();
  const {
    dbRepairs, loadingDbRepairs, dbRepairsError,
    combinedRepairs, handleAcknowledgeRepair, handleUpdateRepairStatus,
  } = useRepairTickets(fetchDbAssets);
  const [itemInspectedState, setItemInspectedState] = useState<Record<string, boolean>>({});
  const [selectedQueueItem, setSelectedQueueItem] = useState<any | null>(null);
  const [inspectionStatusOption, setInspectionStatusOption] = useState<string>("Operational");
  const [inspectionNotesOption, setInspectionNotesOption] = useState<string>("");
  const [inspectorRoleOption, setInspectorRoleOption] = useState<string>("TSG Staff");
  const [tsgRemarksOption, setTsgRemarksOption] = useState<string>("");
  const [itsRemarksOption, setItsRemarksOption] = useState<string>("");
  const [inspectionImgOption, setInspectionImgOption] = useState<string>("");

  const [updatingTicket, setUpdatingTicket] = useState<any | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<any | null>(null);

  // TSG specific states
  const [activeGroup, setActiveGroup] = useState("A");
  const [selectedQR, setSelectedQR] = useState<string[]>([]);
  const [healthEdits, setHealthEdits] = useState<Record<string, Record<string, string>>>({});
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(true);
  const [selectedReturnAsset, setSelectedReturnAsset] = useState<any | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  const unacknowledged = combinedRepairs.filter(r => !r.acknowledged);
  const pendingReturns = returns.filter(r => r.status === "Pending");

  const priorityWeight: Record<string, number> = {
    "Critical": 3,
    "High": 2,
    "Medium": 1
  };

  const sortedRepairs = [...combinedRepairs].sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) {
      return a.acknowledged ? 1 : -1;
    }
    const pA = priorityWeight[a.priority] || 0;
    const pB = priorityWeight[b.priority] || 0;
    if (pA !== pB) return pB - pA;
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });

  const activeRepairs = sortedRepairs.filter(r => r.statusLabel !== "Fixed & Completed");
  const completedRepairs = sortedRepairs.filter(r => r.statusLabel === "Fixed & Completed");

  const qrAssets = displayedAssets.filter(a => a.status !== "Disposed");

  // ── Repairs ───────────────────────────────────────────────────────────────
  if (activeTab === "repairs") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">Repair Operations Manager</h1>
          <p className="text-muted-foreground text-sm">Track physical equipment component servicing and troubleshooting.</p>
          {loadingDbRepairs && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5"><Clock size={11} className="animate-pulse" />Loading repair tickets from database…</p>
          )}
          {!loadingDbRepairs && dbRepairsError && (
            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1.5"><AlertTriangle size={11} />{dbRepairsError} — showing local data only.</p>
          )}
        </div>

        {/* Repair Requests Priority Table */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Wrench size={18} className="text-red-500 animate-pulse" />
              <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Maintenance Request &amp; Priority Matrix</h3>
              {unacknowledged.length > 0 && (
                <Badge className="bg-red-500 hover:bg-red-600 text-white font-extrabold text-[9px] px-2 py-0.5 tracking-wider">
                  {unacknowledged.length} ATTENTION REQUIRED
                </Badge>
              )}
            </div>
            {activeRepairs.length > 0 && (
              <div className="text-[11px] text-muted-foreground font-semibold">
                Sorted by: <span className="text-emerald-700">Urgency Severity ➔ Date</span>
              </div>
            )}
          </div>

          {activeRepairs.length > 0 ? (
            <Card className="overflow-hidden p-0 border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {["Priority", "Ticket ID", "Asset", "Custodian", "Submitted At", "Dispatched To", "Acknowledge State", "Actions"].map(h => (
                      <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeRepairs.map(req => {
                    const isCritical = req.priority === "Critical";
                    const isHigh = req.priority === "High";

                    const priorityBadgeClass = isCritical
                      ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100"
                      : isHigh
                        ? "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100"
                        : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100";

                    return (
                      <TableRow
                        key={req.id}
                        className={cn(
                          "transition-colors hover:bg-muted/10",
                          !req.acknowledged ? (isCritical ? "bg-red-50/20 hover:bg-red-50/30" : "bg-orange-50/15 hover:bg-orange-50/25") : ""
                        )}
                      >
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[9px] font-extrabold tracking-wider uppercase px-2", priorityBadgeClass)}>
                            {req.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-xs font-mono">{req.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs font-bold text-foreground">{req.assetName}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-muted-foreground font-mono">{req.assetId}</span>
                              <span className="text-muted-foreground text-[10px]">·</span>
                              <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0",
                                req.statusLabel === "Fixed & Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  req.statusLabel === "Warranty Holder Possession" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                    req.statusLabel === "Third-Party Repairer Possession" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                      "bg-amber-50 text-amber-700 border-amber-200"
                              )}>
                                {req.statusLabel || "Under Maintenance"}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">{req.custodian}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{req.submittedAt}</TableCell>
                        <TableCell>
                          {req.forwardedTo ? (
                            <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0", req.forwardedTo === "ITS" ? "bg-blue-50 text-blue-700 border-blue-200" : req.forwardedTo === "TSG" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-purple-50 text-purple-700 border-purple-200")}>
                              {req.forwardedTo}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {req.acknowledged ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold">
                              Active In Queue
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500 text-white border-red-500 text-[9px] font-extrabold animate-pulse">
                              Pending Action
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            {!req.acknowledged && (
                              <Button
                                size="sm"
                                className="h-7 text-[10px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-2"
                                onClick={() => handleAcknowledgeRepair(req.id)}
                              >
                                <CheckCircle size={10} className="mr-1" /> Acknowledge
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="h-7 text-[10px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-2"
                              onClick={() => setUpdatingTicket(req)}
                            >
                              <Wrench size={10} className="mr-1" /> {req.statusLabel === "Fixed & Completed" ? "View Details" : "Manage Request"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl">
              {dbRepairs.length === 0 ? (
                loadingDbRepairs ? (
                  "Loading repair tickets…"
                ) : dbRepairsError ? (
                  `Couldn't load repair tickets: ${dbRepairsError}`
                ) : (
                  "No repair tickets exist yet — none have been filed via Report Issue or a return's \"Flag for Repair\" toggle."
                )
              ) : (
                "All equipment repairs are completed. There are no active tickets in the priority matrix queue."
              )}
            </div>
          )}
        </div>

        {/* Completed Repairs History Section */}
        <div className="mt-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle size={18} className="text-emerald-600" />
            <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Completed Repairs History</h3>
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-extrabold text-[9px] px-2 py-0.5 tracking-wider border-emerald-200">
              {completedRepairs.length} TICKETS ARCHIVED
            </Badge>
          </div>

          {completedRepairs.length > 0 ? (
            <Card className="overflow-hidden p-0 border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {["Priority", "Ticket ID", "Asset", "Custodian", "Submitted At", "Dispatched To", "Completion State", "Actions"].map(h => (
                      <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedRepairs.map(req => {
                    return (
                      <TableRow key={req.id} className="transition-colors hover:bg-muted/10">
                        <TableCell>
                          <Badge variant="outline" className="text-[9px] font-extrabold tracking-wider uppercase px-2 bg-slate-50 text-slate-500 border-slate-200">
                            {req.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-xs font-mono">{req.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs font-bold text-foreground">{req.assetName}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{req.assetId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">{req.custodian}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{req.submittedAt}</TableCell>
                        <TableCell>
                          {req.forwardedTo ? (
                            <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0", req.forwardedTo === "ITS" ? "bg-blue-50 text-blue-700 border-blue-200" : req.forwardedTo === "TSG" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-purple-50 text-purple-700 border-purple-200")}>
                              {req.forwardedTo}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold">
                            Fixed &amp; Re-assigned
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            className="h-7 text-[10px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-2"
                            onClick={() => setUpdatingTicket(req)}
                          >
                            <Wrench size={10} className="mr-1" /> View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl">
              No completed repairs recorded in the history log yet.
            </div>
          )}
        </div>

        {/* Repair Progress Dialog */}
        {updatingTicket && (
          <RepairProgressDialog
            ticket={updatingTicket}
            onClose={() => setUpdatingTicket(null)}
            onSave={handleUpdateRepairStatus}
          />
        )}
      </div>
    );
  }

  // ── Inspections ────────────────────────────────────────────────────────────
  if (activeTab === "inspections") {
    // The log shows the reports saved in asset_reports, newest first, whoever filed
    // them and from whichever browser. The database stores no cycle type, so the
    // log has no cycle column. (F-28, issue #34)
    const reportLog = dbReports.map(r => ({
      id: `RPT-${r.reportId}`,
      assetId: r.assetId,
      assetName: r.assetName,
      reportedBy: r.reportedBy,
      status: REPORT_CONDITION_LABEL[r.reportCondition] || r.reportCondition,
      description: r.reportRemarks || "",
      images: r.reportImg ? [r.reportImg] : [],
      submittedAt: r.reportDate,
    }));

    return (
      <div>
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-foreground mb-1">Inspection Operations Manager</h1>
            <p className="text-muted-foreground text-sm">Inspect assets one lab group at a time and review the condition reports on file.</p>
          </div>
        </div>

        {/* Group tabs using shadcn Tabs */}
        {(() => {
          const allKnownLabs = ["CITe4D", "CAR", "CeHCI", "CeLT", "CNIS", "GAME", "Bio", "CIVI", "TE3D", "HXIL"];

          const matchesLab = (assetLab: string | undefined, groupLabs: string[]) => {
            if (!assetLab) return false;
            const labStr = assetLab.trim().toLowerCase();
            return groupLabs.some(l => {
              const lLower = l.toLowerCase();
              return labStr === lLower || labStr.includes(lLower) || (lLower === "bio" && labStr.includes("bioinformatics")) || (lLower === "game" && labStr.includes("game"));
            });
          };

          const getGroupAssets = (groupId: string, labs: string[]) => {
            return displayedAssets.filter(a => {
              if (matchesLab(a.lab, labs)) return true;
              if (groupId === "A" && (!a.lab || !allKnownLabs.some(kl => matchesLab(a.lab, [kl])))) {
                return true;
              }
              return false;
            });
          };

          const dynamicGroups = labGroups.map(g => {
            const gAssets = getGroupAssets(g.id, g.labs);
            const due = gAssets.filter(a => a.status === "Maintenance" || a.status === "Overdue" || (a.condition !== undefined && a.condition < 80)).length;
            return { ...g, assets: gAssets.length, due };
          });

          return (
            <Tabs value={activeGroup} onValueChange={setActiveGroup}>
              <TabsList className="mb-4 h-auto gap-1 bg-muted/40">
                {dynamicGroups.map(g => (
                  <TabsTrigger key={g.id} value={g.id} className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                    <span className={cn("w-2 h-2 rounded-full", g.color.replace("text-", "bg-"))} />
                    {g.name}
                    {g.due > 0 && <Badge className="text-[9px] bg-red-100 text-red-700 border-red-200 ml-0.5">{g.due}</Badge>}
                  </TabsTrigger>
                ))}
              </TabsList>

              {dynamicGroups.map(g => {
                const groupAssets = getGroupAssets(g.id, g.labs);
                const queueItems = groupAssets.map(a => {
                  const isInspected = itemInspectedState[a.id] === true;
                  const status = isInspected ? "Inspected" : "For Inspection";
                  const urgency = a.status === "Maintenance" || a.status === "Overdue" ? "Critical" : (a.condition !== undefined && a.condition < 80 ? "High" : "Normal");

                  return {
                    id: `MNT-${String(a.id).replace(/^[^\d]+/, "").padStart(4, "0")}`,
                    asset: a.name,
                    serial: a.serial || a.id,
                    lab: a.lab || g.labs[0] || "CITe4D",
                    lastInspected: a.procured || "Jan 15, 2024",
                    status,
                    urgency,
                    rawAsset: a
                  };
                });

                return (
                  <TabsContent key={g.id} value={g.id}>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[{ val: String(g.assets), label: "Total Assets" }, { val: String(g.due), label: "Due / Overdue" }, { val: g.labs.join(", "), label: "Labs" }].map(({ val, label }) => (
                        <Card key={label}><CardContent className="pt-4 pb-4"><p className="text-xl font-extrabold text-foreground">{val}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>
                      ))}
                    </div>
                    <Card className="overflow-hidden p-0 mb-8">
                      <CardHeader className="px-5 py-4 flex-row items-center justify-between space-y-0 border-b border-border">
                        <div>
                          <CardTitle className="text-sm">Inspection Queue — Group {g.id} ({g.labs.join(", ")})</CardTitle>
                        </div>
                      </CardHeader>
                      {queueItems.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              {["Ticket ID", "Asset", "Lab", "Last Inspected", "Status", "Urgency", "Action"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {queueItems.map(item => (
                              <TableRow key={item.id} className="transition-colors hover:bg-muted/10">
                                <TableCell className="font-bold text-primary text-xs font-mono">{item.id}</TableCell>
                                <TableCell><p className="text-xs font-semibold text-foreground">{item.asset}</p><p className="text-[10px] text-muted-foreground font-mono">{item.serial}</p></TableCell>
                                <TableCell className="text-xs text-muted-foreground">{item.lab}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{item.lastInspected}</TableCell>
                                <TableCell><Badge className={cn("text-[10px]", statusBadge[item.status])}>{item.status}</Badge></TableCell>
                                <TableCell><Badge className={cn("text-[10px]", urgencyBadge[item.urgency])}>{item.urgency}</Badge></TableCell>
                                <TableCell>
                                  {item.status === "Inspected" ? (
                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold gap-1">
                                      <CheckCircle size={11} /> Inspected
                                    </Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedQueueItem(item);
                                        setInspectionStatusOption("Operational");
                                        setInspectionNotesOption("");
                                      }}
                                      className="bg-[#005A36] hover:bg-[#004225] text-white font-bold text-[10px] h-7 px-2.5 gap-1 shadow-sm"
                                    >
                                      <ClipboardCheck size={11} /> Inspect / Log Report
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="p-6 text-center text-xs text-muted-foreground bg-muted/10">
                          No registered equipment currently assigned to Group {g.id} ({g.labs.join(", ")}).
                        </div>
                      )}
                    </Card>
                  </TabsContent>
                );
              })}
            </Tabs>
          );
        })()}

        {/* Inspection Report Log Section */}
        {reportLog.length > 0 ? (
          <div className="mt-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <ClipboardCheck size={18} className="text-[#005A36]" />
              <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Inspection Report Log</h3>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-extrabold text-[9px] px-2 py-0.5 tracking-wider border-emerald-200">
                {reportLog.length} REPORTS SUBMITTED
              </Badge>
            </div>

            <Card className="overflow-hidden p-0 border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {["Report ID", "Asset", "Reported By", "Preset Status", "Date Submitted", "Actions"].map(h => (
                      <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportLog.map(rep => {
                    const isPerfect = rep.status === "Perfect";
                    const isOperational = rep.status === "Operational";
                    const isDrift = rep.status === "Minor Drift";
                    const isDegraded = rep.status === "Degraded Performance";

                    const statusBadge = isPerfect
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : isOperational
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : isDrift
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : isDegraded
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : "bg-red-50 text-red-700 border-red-200";

                    return (
                      <TableRow key={rep.id} className="transition-colors hover:bg-muted/10">
                        <TableCell className="font-bold text-xs font-mono">{rep.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs font-bold text-foreground">{rep.assetName}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{rep.assetId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">{rep.reportedBy}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[9px] font-extrabold px-1.5 py-0", statusBadge)}>
                            {rep.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{rep.submittedAt}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => setSelectedInspection(rep)}
                          >
                            <Eye size={10} className="mr-1" /> View Report
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl mb-6">
            No inspection reports have been saved yet.
          </div>
        )}

        {/* Log Inspection Report Dialog for Queue Item */}
        <Dialog open={!!selectedQueueItem} onOpenChange={(open) => !open && setSelectedQueueItem(null)}>
          {selectedQueueItem && (
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ClipboardCheck className="text-[#005A36]" size={16} /> Log Asset Inspection Report
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Record technical inspection details, condition ratings, and role remarks for {selectedQueueItem.asset} ({selectedQueueItem.rawAsset?.id || selectedQueueItem.id}).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3.5 my-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold text-foreground">Inspector Role</Label>
                    <Select value={inspectorRoleOption} onValueChange={setInspectorRoleOption}>
                      <SelectTrigger className="mt-1 h-9 text-xs">
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TSG Staff">TSG Staff (Technical Operations)</SelectItem>
                        <SelectItem value="ITS Staff">ITS Staff (Central Asset Admin)</SelectItem>
                        <SelectItem value="Lab Head">Lab Head / Approver</SelectItem>
                        <SelectItem value="Custodian">Custodian Auditor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-foreground">Condition Rating</Label>
                    <Select value={inspectionStatusOption} onValueChange={setInspectionStatusOption}>
                      <SelectTrigger className="mt-1 h-9 text-xs">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Perfect">Perfect (Brand New / 100%)</SelectItem>
                        <SelectItem value="Operational">Operational (Standard Wear / 90%)</SelectItem>
                        <SelectItem value="Minor Drift">Minor Drift (Functional / 78%)</SelectItem>
                        <SelectItem value="Degraded Performance">Degraded Performance (Needs Service / 60%)</SelectItem>
                        <SelectItem value="Critical Defect">Critical Defect (Non-Functional / 35%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground">TSG Technical &amp; Hardware Remarks</Label>
                  <textarea
                    value={tsgRemarksOption}
                    onChange={(e) => setTsgRemarksOption(e.target.value)}
                    placeholder="Enter physical hardware metrics, component diagnostics, fan noise, thermal readings, or maintenance notes..."
                    rows={2}
                    className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1 resize-none"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground">ITS Governance &amp; Compliance Remarks</Label>
                  <textarea
                    value={itsRemarksOption}
                    onChange={(e) => setItsRemarksOption(e.target.value)}
                    placeholder="Enter asset tag verification, warranty claim status, software license check, or audit compliance notes..."
                    rows={2}
                    className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1 resize-none"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                    <Camera size={13} className="text-[#005A36]" /> Inspection Photo Evidence / Proof (Optional)
                  </Label>
                  <div className="mt-1 flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      id="inspection-img-input"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setInspectionImgOption(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label
                      htmlFor="inspection-img-input"
                      className="px-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer hover:bg-slate-100 flex items-center gap-1.5"
                    >
                      <Upload size={13} /> {inspectionImgOption ? "Change Photo Proof" : "Upload Inspection Photo"}
                    </label>
                    {inspectionImgOption && (
                      <div className="flex items-center gap-2">
                        <img src={inspectionImgOption} alt="Inspection Proof" className="w-8 h-8 object-cover rounded border border-slate-300" />
                        <button
                          type="button"
                          onClick={() => setInspectionImgOption("")}
                          className="text-[10px] text-red-600 hover:underline font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedQueueItem(null)}>Cancel</Button>
                <Button
                  size="sm"
                  className="bg-[#005A36] hover:bg-[#004225] text-white font-bold text-xs"
                  onClick={async () => {
                    const fullNotes = [
                      tsgRemarksOption ? `[TSG Remarks]: ${tsgRemarksOption}` : "",
                      itsRemarksOption ? `[ITS Remarks]: ${itsRemarksOption}` : "",
                      inspectionNotesOption ? `[Notes]: ${inspectionNotesOption}` : ""
                    ].filter(Boolean).join(" | ") || "Routine periodic physical inspection verified.";

                    await syncFromDb();

                    // Save report under asset_reports table in MySQL database
                    if (selectedQueueItem.rawAsset?.id || selectedQueueItem.id) {
                      try {
                        const conditionEnumMap: Record<string, string> = {
                          "Perfect": "PERFECT",
                          "Operational": "OPERATIONAL",
                          "Minor Drift": "MINOR_DRIFT",
                          "Degraded Performance": "DEGRADED",
                          "Critical Defect": "CRITICAL_DEFECT",
                        };
                        const targetTag = selectedQueueItem.rawAsset?.id || selectedQueueItem.id;
                        await inspectionsApi.submitInspectionRaw(targetTag, {
                          reporterEmail: currentUser?.email,
                          reportedById: currentUser?.user_id,
                          reportCondition: conditionEnumMap[inspectionStatusOption] || "PERFECT",
                          reportRemarks: fullNotes,
                          reportImg: inspectionImgOption || null,
                        });
                        await fetchDbAssets();
                        await fetchDbReports();
                      } catch (e) {
                        console.error("Failed to save asset inspection report in MySQL asset_reports:", e);
                      }
                    }

                    if (selectedQueueItem.rawAsset) {
                      syncFromDb();
                    }

                    setItemInspectedState(prev => ({ ...prev, [selectedQueueItem.rawAsset?.id || selectedQueueItem.id]: true }));
                    setSelectedQueueItem(null);
                    setInspectionImgOption("");
                    setTsgRemarksOption("");
                    setItsRemarksOption("");
                    alert(`Inspection Report logged & saved under asset_reports table in MySQL for ${selectedQueueItem.asset}!`);
                  }}
                >
                  Submit &amp; Finalize Inspection
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>

        {/* Inspection Details Dialog */}
        <Dialog open={!!selectedInspection} onOpenChange={(open) => !open && setSelectedInspection(null)}>
          {selectedInspection && (
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-foreground">Inspection Report Details</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">Condition report saved in the inspection records.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-2">
                <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-[9px] font-extrabold text-muted-foreground tracking-widest uppercase">Report reference</p>
                    <p className="text-sm font-bold text-primary font-mono mt-0.5">{selectedInspection.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="border border-border rounded-lg p-2.5 bg-background">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Asset Information</p>
                    <p className="font-bold mt-1 text-foreground">{selectedInspection.assetName}</p>
                    <p className="font-mono text-muted-foreground mt-0.5">{selectedInspection.assetId}</p>
                  </div>
                  <div className="border border-border rounded-lg p-2.5 bg-background">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Reported By</p>
                    <p className="font-semibold mt-1 text-foreground">{selectedInspection.reportedBy}</p>
                    <p className="text-muted-foreground mt-0.5">{selectedInspection.submittedAt}</p>
                  </div>
                </div>

                <div className="border border-border rounded-lg p-3 bg-background">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Condition Status Check-in</span>
                    <Badge variant="outline" className={cn("text-[9px] font-extrabold",
                      selectedInspection.status === "Perfect" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        selectedInspection.status === "Operational" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          selectedInspection.status === "Minor Drift" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            selectedInspection.status === "Degraded Performance" ? "bg-orange-50 text-orange-700 border-orange-200" :
                              "bg-red-50 text-red-700 border-red-200"
                    )}>
                      {selectedInspection.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed italic">"{selectedInspection.description || "No manual remarks provided."}"</p>
                </div>

                {selectedInspection.images && selectedInspection.images.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Uploaded Physical Verification Image(s)</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedInspection.images.map((img: string, i: number) => (
                        <div key={i} className="border border-border rounded-lg overflow-hidden max-w-full">
                          <img src={img} alt="inspection asset" className="max-h-64 object-contain rounded-lg" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedInspection(null)}>Close View</Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </div>
    );
  }

  // ── Pending Returns ───────────────────────────────────────────────────────
  if (activeTab === "returns") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">Pending Returns Ledger</h1>
          <p className="text-muted-foreground text-sm">Verify physical equipment presence, condition check, and close borrow records.</p>
        </div>

        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                {["Asset ID", "Asset Name", "Custodian", "Proposed Return Date", "Custodian Comments", "Action"].map(h => (
                  <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingReturns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No pending return requests in queue.
                  </TableCell>
                </TableRow>
              ) : (
                pendingReturns.map(req => {
                  const matchingAsset = displayedAssets.find(a => a.id === req.assetId);
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-bold text-primary text-xs">{req.assetId}</TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">{req.assetName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{req.custodian}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{req.returnDate}</TableCell>
                      <TableCell className="text-xs text-muted-foreground italic max-w-[200px] truncate" title={req.comments}>
                        "{req.comments || "—"}"
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => {
                            if (matchingAsset) {
                              setSelectedReturnAsset(matchingAsset);
                            } else {
                              setSelectedReturnAsset({
                                id: req.assetId,
                                name: req.assetName,
                                custodian: req.custodian,
                                status: "Pending Return",
                                category: "Computing Array"
                              });
                            }
                          }}
                        >
                          Evaluate &amp; Finalize
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Dialog for Finalizing Returns */}
        <Dialog open={selectedReturnAsset !== null} onOpenChange={open => { if (!open) setSelectedReturnAsset(null); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground">Evaluate &amp; Finalize Return</DialogTitle>
            </DialogHeader>
            {selectedReturnAsset && (
              <ReturnForm
                asset={selectedReturnAsset}
                onBack={() => setSelectedReturnAsset(null)}
                onClose={() => setSelectedReturnAsset(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── QR Tags ───────────────────────────────────────────────────────────────
  if (activeTab === "qrtags") {
    const toggleQR = (id: string) => setSelectedQR(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const handlePrintTags = () => {
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;

      const tagsHtml = selectedQR.map(id => {
        const a = qrAssets.find(x => x.id === id);
        if (!a) return "";

        const svgElement = document.getElementById(`qr-svg-${id}`);
        const svgMarkup = svgElement ? svgElement.outerHTML : "";

        return `
          <div class="tag-card">
            <div class="tag-body">
              <div class="qr-container">
                ${svgMarkup}
              </div>
              <div class="text-container">
                <div class="tag-title">${a.name}</div>
                <div class="tag-meta">ID: ${a.id}</div>
                <div class="tag-meta">Lab: ${a.lab} &middot; ${a.location}</div>
                <div class="tag-link">adric.dlsu.edu.ph/assets/${a.id}</div>
              </div>
            </div>
            <div class="tag-footer">DLSU AdRIC EQUIPMENT MANAGEMENT SYSTEM</div>
          </div>
        `;
      }).join("");

      printWindow.document.write(`
        <html>
          <head>
            <title>Print Assets QR Codes</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Montserrat:wght@700;800&display=swap');
              body {
                font-family: 'Inter', sans-serif;
                margin: 0;
                padding: 20px;
                background: #ffffff;
              }
              .tags-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
              }
              .tag-card {
                border: 2px solid #111111;
                border-radius: 8px;
                padding: 12px;
                background: #ffffff;
                box-sizing: border-box;
                page-break-inside: avoid;
              }
              .tag-body {
                display: flex;
                gap: 12px;
                align-items: center;
              }
              .qr-container {
                width: 64px;
                height: 64px;
                padding: 4px;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                background: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              }
              .qr-container svg {
                width: 100% !important;
                height: 100% !important;
              }
              .text-container {
                flex: 1;
                min-width: 0;
              }
              .tag-title {
                font-family: 'Montserrat', sans-serif;
                font-size: 10px;
                font-weight: 800;
                color: #111827;
                margin-bottom: 3px;
                line-height: 1.2;
                text-transform: uppercase;
              }
              .tag-meta {
                font-size: 8px;
                color: #4b5563;
                margin-bottom: 2px;
                font-weight: 600;
              }
              .tag-link {
                font-size: 7px;
                color: #005a36;
                font-family: monospace;
                font-weight: 700;
                margin-top: 4px;
              }
              .tag-footer {
                text-align: center;
                font-size: 7px;
                color: #9ca3af;
                margin-top: 10px;
                padding-top: 6px;
                border-top: 1px solid #f3f4f6;
                font-weight: 700;
                letter-spacing: 0.05em;
              }
              @media print {
                body {
                  padding: 0;
                }
                .tag-card {
                  border-color: #000000;
                }
              }
            </style>
          </head>
          <body>
            <div class="tags-grid">
              ${tagsHtml}
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 300);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    };
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">QR Tag Layout Wizard</h1>
          <p className="text-muted-foreground text-sm">Generate and export printable physical tracking barcodes for laboratory assets.</p>
        </div>
        <div className="flex gap-4">
          <Card className="flex-1 overflow-hidden p-0">
            <CardHeader className="px-5 py-4 border-b border-border flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Select Assets</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => setSelectedQR(qrAssets.map(a => a.id))}>Select All</Button>
            </CardHeader>
            {qrAssets.map(asset => (
              <div key={asset.id} onClick={() => toggleQR(asset.id)}
                className={cn("flex items-center gap-3 px-5 py-3 cursor-pointer border-b border-border last:border-0 transition-colors", selectedQR.includes(asset.id) ? "bg-emerald-50" : "hover:bg-muted/30")}>
                <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0", selectedQR.includes(asset.id) ? "border-primary bg-primary" : "border-border bg-background")}>
                  {selectedQR.includes(asset.id) && <CheckCircle size={10} className="text-white" />}
                </div>
                <div className="flex-1"><p className="text-xs font-semibold text-foreground">{asset.name}</p><p className="text-[10px] text-muted-foreground">{asset.id} · {asset.lab} · {asset.location}</p></div>
                <QrCode size={14} className="text-muted-foreground" />
              </div>
            ))}
          </Card>

          <div className="w-72 flex-shrink-0 flex flex-col gap-3">
            <Card className="flex-1">
              <CardHeader><CardTitle className="text-sm">Tag Preview</CardTitle></CardHeader>
              <CardContent>
                {selectedQR.length === 0
                  ? <div className="flex flex-col items-center py-8 text-muted-foreground gap-2"><QrCode size={36} /><p className="text-xs">Select assets to preview</p></div>
                  : <div className="flex flex-col gap-3 max-h-72 overflow-y-auto">
                    {selectedQR.map(id => {
                      const a = qrAssets.find(x => x.id === id)!;
                      return (
                        <div key={id} className="border-2 border-foreground rounded-lg p-2.5">
                          <div className="flex gap-2">
                            <div className="w-14 h-14 bg-white rounded flex items-center justify-center flex-shrink-0 p-1 border border-border">
                              <QRCodeSVG
                                id={`qr-svg-${a.id}`}
                                value={`https://adric.dlsu.edu.ph/assets/${a.id}`}
                                size={48}
                                bgColor={"#ffffff"}
                                fgColor={"#111111"}
                                level={"M"}
                              />
                            </div>
                            <div>
                              <p className="text-[9px] font-extrabold text-foreground leading-snug">{a.name}</p>
                              <p className="text-[8px] text-muted-foreground">{a.id}</p>
                              <p className="text-[8px] text-muted-foreground">{a.lab} · {a.location}</p>
                              <p className="text-[7px] text-primary/70 font-mono mt-0.5 select-all">adric.dlsu.edu.ph/assets/{a.id}</p>
                            </div>
                          </div>
                          <p className="text-center text-[7px] text-muted-foreground tracking-wide mt-2 pt-1.5 border-t border-border">DLSU AdRIC EQUIPMENT MANAGEMENT SYSTEM</p>
                        </div>
                      );
                    })}
                  </div>
                }
              </CardContent>
            </Card>
            <Button disabled={!selectedQR.length} onClick={handlePrintTags} className="w-full gap-2 bg-[#005A36] hover:bg-[#004225] text-white"><Printer size={13} />Print {selectedQR.length > 0 ? `${selectedQR.length} Tag${selectedQR.length > 1 ? "s" : ""}` : "Tags"}</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Health Benchmarking ───────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-[#005A36]" />
            {showAdvancedAnalytics ? "TSG Maintenance & Workflows Dashboard" : "Numeric Health Benchmarking Grid"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {showAdvancedAnalytics
              ? "Real-time tracking, repair operations, condition traffic light heatmap, 90-day warranty calendar, and staggered routine inspection progress."
              : "Track physical component breakdown relative to Day 1 baseline performance logs."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {showAdvancedAnalytics && (
            <Badge variant="outline" className="border-[#005A36] text-[#005A36] bg-emerald-50 px-3 py-1 text-xs font-bold">
              Technical Support Group Active
            </Badge>
          )}
          <div className="flex items-center gap-1.5 bg-[#0A1F14]/20 border border-emerald-500/10 p-1 rounded-xl">
            <Button
              size="sm"
              variant={showAdvancedAnalytics ? "ghost" : "default"}
              onClick={() => setShowAdvancedAnalytics(false)}
              className={cn("text-xs h-8 font-bold", !showAdvancedAnalytics ? "bg-[#10B981] text-white hover:bg-[#10B981]/90" : "text-muted-foreground")}
            >
              Benchmarks Grid
            </Button>
            <Button
              size="sm"
              variant={showAdvancedAnalytics ? "default" : "ghost"}
              onClick={() => setShowAdvancedAnalytics(true)}
              className={cn("text-xs h-8 font-bold", showAdvancedAnalytics ? "bg-[#10B981] text-white hover:bg-[#10B981]/90" : "text-muted-foreground")}
            >
              Advanced Analytics
            </Button>
          </div>
        </div>
      </div>

      {showAdvancedAnalytics ? (
        <TSGAnalyticsView />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[{ label: "Within Tolerance", val: "4", col: "text-emerald-700" }, { label: "Flagged", val: "1", col: "text-red-600" }, { label: "Avg Battery Health", val: "73.8%", col: "text-blue-600" }, { label: "Avg Storage Health", val: "92.7%", col: "text-violet-600" }].map(({ label, val, col }) => (
              <Card key={label}><CardContent className="pt-4 pb-4"><p className={cn("text-2xl font-extrabold", col)}>{val}</p><p className="text-xs text-muted-foreground mt-0.5">{label}</p></CardContent></Card>
            ))}
          </div>
          <Card className="overflow-hidden p-0">
            <CardHeader className="px-5 py-4 border-b border-border">
              <CardTitle className="text-sm">Component Health Matrix — Editable Benchmarks</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {["Asset", "Battery/Power Health", "Storage Integrity", "Sensor Drift", "Uptime", "Notes", "Score"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider whitespace-nowrap">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthData.map(row => {
                  const e = healthEdits[row.id] || {};
                  const battery = parseFloat(e.battery ?? String(row.battery ?? ""));
                  const storage = parseFloat(e.storage_health ?? String(row.storage_health ?? ""));
                  const drift = parseFloat(e.sensor_drift ?? String(row.sensor_drift ?? ""));
                  const uptime = parseFloat(e.uptime ?? String(row.uptime));
                  const issues = [row.battery !== null && battery < 70, row.storage_health !== null && storage < 85, row.sensor_drift !== null && drift > 2, uptime < 80].filter(Boolean).length;
                  const score = Math.max(0, 100 - issues * 15 - (row.battery !== null && battery < 60 ? 15 : 0));
                  return (
                    <TableRow key={row.id}>
                      <TableCell><p className="text-xs font-semibold text-foreground">{row.asset}</p><p className="text-[10px] text-muted-foreground">{row.id}</p></TableCell>
                      <TableCell>
                        {row.battery !== null ? <div><div className="flex items-center gap-1"><Input type="number" min={0} max={100} value={e.battery ?? String(row.battery)} onChange={ev => setHealthEdits(p => ({ ...p, [row.id]: { ...p[row.id], battery: ev.target.value } }))} className="w-14 h-7 text-xs px-2" /><span className="text-[10px] text-muted-foreground">%</span></div><MetricBar value={battery} color={battery >= 70 ? "bg-emerald-400" : "bg-red-400"} /></div> : <span className="text-xs text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell>
                        {row.storage_health !== null ? <div><div className="flex items-center gap-1"><Input type="number" min={0} max={100} value={e.storage_health ?? String(row.storage_health)} onChange={ev => setHealthEdits(p => ({ ...p, [row.id]: { ...p[row.id], storage_health: ev.target.value } }))} className="w-14 h-7 text-xs px-2" /><span className="text-[10px] text-muted-foreground">%</span></div><MetricBar value={storage} color={storage >= 85 ? "bg-emerald-400" : "bg-amber-400"} /></div> : <span className="text-xs text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell>
                        {row.sensor_drift !== null ? <div><div className="flex items-center gap-1"><Input type="number" min={0} step={0.1} value={e.sensor_drift ?? String(row.sensor_drift)} onChange={ev => setHealthEdits(p => ({ ...p, [row.id]: { ...p[row.id], sensor_drift: ev.target.value } }))} className="w-14 h-7 text-xs px-2" /><span className="text-[10px] text-muted-foreground">°</span></div><p className={cn("text-[10px] font-semibold", drift > 2 ? "text-red-600" : drift > 1 ? "text-amber-600" : "text-emerald-600")}>{drift <= 1 ? "Nominal" : drift <= 2 ? "Monitor" : "ALERT"}</p></div> : <span className="text-xs text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell><p className={cn("text-xs font-bold", uptime >= 95 ? "text-emerald-700" : uptime >= 80 ? "text-amber-700" : "text-red-700")}>{uptime}%</p><MetricBar value={uptime} color={uptime >= 95 ? "bg-emerald-400" : uptime >= 80 ? "bg-[#10B981]" : "bg-red-400"} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px]">{row.notes}</TableCell>
                      <TableCell><p className={cn("text-lg font-extrabold", score >= 85 ? "text-emerald-700" : score >= 70 ? "text-amber-700" : "text-red-700")}>{score}</p><p className="text-[10px] text-muted-foreground">/ 100</p></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
