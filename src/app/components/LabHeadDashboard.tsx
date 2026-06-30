import { useState } from "react";
import { useApp } from "../context";
import { CheckCircle, XCircle, AlertTriangle, Search, ArrowRight, Package, MapPin, Calendar, LayoutGrid, Table2, Printer, Download } from "lucide-react";
import { AssetImagePlaceholder } from "./AssetImagePlaceholder";
import { AssetDetailModal, type AssetDetail } from "./AssetDetailModal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { cn } from "./ui/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";

const MINT = "#10B981";

const statusClass: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Loan": "bg-blue-50   text-blue-700   border-blue-200",
  Reserved: "bg-violet-50 text-violet-700 border-violet-200",
};

const txnBadgeClass: Record<string, string> = {
  Pending: "bg-amber-50  text-amber-700  border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Declined: "bg-red-50    text-red-700    border-red-200",
};

const severityClass: Record<string, string> = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50  text-amber-700  border-amber-200",
  High: "bg-red-50    text-red-700    border-red-200",
  Critical: "bg-red-900   text-red-200    border-red-700",
};

function ConditionBar({ value }: { value: number }) {
  return <div className="h-1.5 w-11 bg-muted rounded-full overflow-hidden mt-1"><div className={cn("h-full rounded-full", value >= 90 ? "bg-emerald-400" : "bg-amber-400")} style={{ width: `${value}%` }} /></div>;
}

function VisualTimeline({ status }: { status: string }) {
  const steps = [
    { label: "Initiated", completed: true, active: false, failed: false },
    {
      label: status === "Declined" ? "Declined" : "Pending Approval",
      completed: status === "Approved",
      active: status === "Pending",
      failed: status === "Declined"
    },
    {
      label: "Custody Transferred",
      completed: status === "Approved",
      active: false,
      failed: status === "Declined"
    }
  ];

  return (
    <div className="flex items-center gap-2 mt-4 px-2 py-3 bg-muted/30 rounded-lg max-w-xl">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        let nodeColor = "bg-muted text-muted-foreground border-muted-foreground/20";
        if (step.completed) {
          nodeColor = "bg-emerald-500 text-white border-emerald-500";
        } else if (step.active) {
          nodeColor = "bg-amber-500 text-white border-amber-500 animate-pulse";
        } else if (step.failed) {
          nodeColor = "bg-red-500 text-white border-red-500";
        }

        let lineColor = "bg-muted";
        if (idx === 0 && (status === "Approved" || status === "Pending")) {
          lineColor = "bg-emerald-500";
        } else if (idx === 0 && status === "Declined") {
          lineColor = "bg-red-500";
        } else if (idx === 1 && status === "Approved") {
          lineColor = "bg-emerald-500";
        } else if (idx === 1 && status === "Declined") {
          lineColor = "bg-red-300";
        }

        return (
          <div key={idx} className="flex flex-1 items-center min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0", nodeColor)}>
                {step.completed ? "✓" : step.failed ? "✗" : idx + 1}
              </div>
              <span className={cn("text-[11px] font-semibold whitespace-nowrap truncate", step.completed ? "text-emerald-700" : step.active ? "text-amber-700 font-bold" : step.failed ? "text-red-700" : "text-muted-foreground")}>
                {step.label}
              </span>
            </div>
            {!isLast && <div className={cn("h-0.5 flex-1 mx-3 min-w-[15px]", lineColor)} />}
          </div>
        );
      })}
    </div>
  );
}

export function LabHeadDashboard({ activeTab }: { activeTab: string }) {
  const { assets, transfers, repairRequests, updateTransferRequest } = useApp();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "gallery">("gallery");
  const [selectedAsset, setSelectedAsset] = useState<AssetDetail | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);

  const getStatus = (txn: any) => txn.status;
  const approve = (id: string) => updateTransferRequest(id, "Approved");
  const decline = (id: string) => updateTransferRequest(id, "Declined");

  const branchInventory = assets.filter(a => a.lab === "CITe4D");
  const branchTransfers = transfers.filter(t => t.lab === "CITe4D");

  const branchAssetIds = new Set(branchInventory.map(a => a.id));
  const branchRepairs = repairRequests.filter(r => branchAssetIds.has(r.assetId));

  // ── Custody ───────────────────────────────────────────────────────────────
  if (activeTab === "custody") {
    const pendingCount = transfers.filter(t => getStatus(t) === "Pending").length;
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">Digital Handshake Monitoring</h1>
          <p className="text-muted-foreground text-sm">Device custody transitions and authorization control for CITe4D research branch.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <Card><CardContent className="pt-4 pb-4"><p className="text-2xl font-extrabold text-amber-600">{pendingCount}</p><p className="text-xs text-muted-foreground">Pending Authorization</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4"><p className="text-2xl font-extrabold text-emerald-700">{transfers.filter(t => t.status === "Approved").length}</p><p className="text-xs text-muted-foreground">Approved This Period</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4"><p className="text-2xl font-extrabold text-red-700">{transfers.filter(t => t.status === "Declined").length}</p><p className="text-xs text-muted-foreground">Declined Requests</p></CardContent></Card>
        </div>
        <div className="flex flex-col gap-3">
          {transfers.map(txn => {
            const status = getStatus(txn);
            const isPending = status === "Pending";
            return (
              <Card key={txn.id} className={cn("border-l-4", status === "Approved" ? "border-l-emerald-500" : status === "Declined" ? "border-l-red-500" : "border-l-amber-500")} style={{ borderLeftWidth: 4 }}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 w-full min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-primary">{txn.id}</span>
                        <Badge className={cn("text-[10px]", txnBadgeClass[status])}>{status}</Badge>
                      </div>
                      <p className="text-sm font-bold text-foreground mb-2">{txn.asset}</p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-3">
                        <div>
                          <p className="text-[9px] font-bold text-muted-foreground tracking-widest mb-0.5">FROM</p>
                          <p className="font-semibold text-foreground">{txn.from}</p>
                          <p>{txn.fromRole}</p>
                        </div>
                        <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-[9px] font-bold text-muted-foreground tracking-widest mb-0.5">TO</p>
                          <p className="font-semibold text-foreground">{txn.to}</p>
                          <p>{txn.toRole}</p>
                        </div>
                        <div className="sm:ml-auto text-left sm:text-right">
                          <p>{txn.lab}</p>
                          <p>{txn.initiated}</p>
                        </div>
                      </div>
                      <VisualTimeline status={status} />
                    </div>
                    {isPending && (
                      <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
                        <Button size="sm" className="text-xs" onClick={() => approve(txn.id)}><CheckCircle size={11} />Authorize</Button>
                        <Button size="sm" variant="outline" className="text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={() => decline(txn.id)}><XCircle size={11} />Decline</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Branch Inventory ──────────────────────────────────────────────────────
  const filtered = branchInventory.filter(eq => eq.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-foreground mb-1">Branch Inventory — CITe4D</h1>
          <p className="text-muted-foreground text-sm">Filtered view — other research centers are masked.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-8" onClick={() => setShowAuditModal(true)}>
            <Download size={13} />Generate Audit Report
          </Button>
          <div className="flex rounded-lg overflow-hidden border border-border">
            <Button variant={viewMode === "gallery" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("gallery")} className="rounded-none text-xs gap-1.5"><LayoutGrid size={13} />Gallery</Button>
            <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("table")} className="rounded-none text-xs gap-1.5"><Table2 size={13} />Table</Button>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-3 py-1">BRANCH-SCOPED VIEW</Badge>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search branch assets…" className="pl-8" />
      </div>

      {viewMode === "gallery" && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
          {filtered.map(eq => (
            <Card key={eq.id} className="overflow-hidden p-0 gap-0 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedAsset({ id: eq.id, name: eq.name, category: eq.category, status: eq.status, custodian: eq.custodian, location: eq.location, condition: eq.condition, funding: eq.funding })}>
              <div className="relative">
                <AssetImagePlaceholder category={eq.category} aspectRatio="4/3" />
                <Badge className={cn("absolute top-2 right-2 text-[9px]", statusClass[eq.status] ?? statusClass["Active"])}>{eq.status}</Badge>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-border">
                  <div className={cn("h-full", eq.condition >= 90 ? "bg-emerald-400" : "bg-amber-400")} style={{ width: `${eq.condition}%` }} />
                </div>
              </div>
              <CardContent className="px-3.5 py-3">
                <p className="text-[10px] font-bold text-primary mb-1">{eq.id}</p>
                <p className="text-sm font-bold text-foreground leading-snug mb-2">{eq.name}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{eq.custodian}</span>
                  <span className={cn("font-bold", eq.condition >= 90 ? "text-emerald-700" : "text-amber-700")}>{eq.condition}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{eq.category} · {eq.location}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewMode === "table" && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {["", "Asset ID", "Name", "Category", "Status", "Custodian", "Location", "Cond.", "Funding"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider whitespace-nowrap">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(eq => (
                  <TableRow key={eq.id} className="cursor-pointer" onClick={() => setSelectedAsset({ id: eq.id, name: eq.name, category: eq.category, status: eq.status, custodian: eq.custodian, location: eq.location, condition: eq.condition, funding: eq.funding })}>
                    <TableCell><div className="w-10 h-7 rounded overflow-hidden"><AssetImagePlaceholder category={eq.category} aspectRatio="4/3" /></div></TableCell>
                    <TableCell className="font-bold text-primary text-xs whitespace-nowrap">{eq.id}</TableCell>
                    <TableCell className="text-xs font-semibold text-foreground min-w-[140px]">{eq.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{eq.category}</TableCell>
                    <TableCell><Badge className={cn("text-[10px] whitespace-nowrap", statusClass[eq.status] ?? statusClass["Active"])}>{eq.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{eq.custodian}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{eq.location}</TableCell>
                    <TableCell><p className={cn("text-xs font-bold", eq.condition >= 90 ? "text-emerald-700" : "text-amber-700")}>{eq.condition}%</p><ConditionBar value={eq.condition} /></TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap">{eq.funding}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />

      {/* Audit Document Dialog */}
      <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
        {/* Changed max-w-4xl to max-w-[90vw] or max-w-7xl to give it full landscape screen real estate */}
        <DialogContent className="w-full max-w-[85vw] lg:max-w-7xl max-h-[90vh] overflow-y-auto print:max-h-none print:max-w-none print:p-0 print:border-none">
          
          {/* Injected explicit Landscape Printing Rules to eliminate standard portrait snapping */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page { size: landscape; margin: 15mm; }
              body { background: white; color: black; }
              #audit-document { border: none !important; p: 0 !important; width: 100% !important; max-width: none !important; }
            }
          `}} />

          <DialogHeader className="print:hidden">
            <DialogTitle className="text-sm font-bold text-foreground">Generate Lab Audit Report</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Preview the audit report for DLSU AdRIC CITe4D research center equipment.</DialogDescription>
          </DialogHeader>

          {/* Audit Document Content */}
          <div id="audit-document" className="border rounded-xl p-6 bg-white text-black font-sans leading-relaxed space-y-6 w-full">
            {/* Header */}
            <div className="flex flex-row justify-between items-start gap-4 border-b-2 border-emerald-800 pb-4">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-wide text-emerald-800 font-sans">DLSU AdRIC Research Laboratory</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-sans">De La Salle University · Center for Integration of Technology for Development (CITe4D)</p>
                <p className="text-[10px] text-gray-400 mt-1 font-sans">Audit Ledger ID: AUD-CITe4D-2026-06</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest font-sans">EQUIPMENT AUDIT REPORT</p>
                <p className="text-[11px] text-gray-500 mt-0.5 font-sans">Date Generated: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                <p className="text-[11px] text-gray-500 font-semibold font-sans">Generated By: CITe4D Lab Head / Project Leader</p>
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-4 gap-4 bg-emerald-50/50 p-4 border border-emerald-100 rounded-xl">
              {[
                { label: "Active Equipment Count", val: branchInventory.length },
                { label: "Pending Custody Handshakes", val: transfers.filter(t => t.lab === "CITe4D" && t.status === "Pending").length },
                { label: "Maintenance Operations Logged", val: branchRepairs.length },
                { label: "Average Equipment Health Score", val: `${Math.round(branchInventory.reduce((acc, a) => acc + a.condition, 0) / (branchInventory.length || 1))}%` }
              ].map(({ label, val }) => (
                <div key={label} className="text-center p-2">
                  <p className="text-xl font-bold text-emerald-950 font-sans">{val}</p>
                  <p className="text-[10px] text-emerald-800/80 font-bold uppercase tracking-wider mt-0.5 font-sans leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* Section 1: Active Asset Inventory */}
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold text-emerald-900 border-b pb-1.5 mb-1 uppercase tracking-widest font-sans">I. Branch Asset Registry</h3>
              <div className="overflow-x-auto border rounded-lg w-full">
                <Table className="min-w-full text-[11px]">
                  <TableHeader>
                    <TableRow className="bg-emerald-50/30">
                      {["Asset ID", "Name", "Serial Number", "Manufacturer", "Category", "Funding", "Condition", "Status", "Custodian"].map(h => (
                        <TableHead key={h} className="text-[10px] font-bold text-emerald-900 whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchInventory.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-bold text-emerald-800 whitespace-nowrap">{a.id}</TableCell>
                        <TableCell className="font-semibold min-w-[150px]">{a.name}</TableCell>
                        <TableCell className="font-mono whitespace-nowrap">{a.serial}</TableCell>
                        <TableCell className="whitespace-nowrap">{a.manufacturer}</TableCell>
                        <TableCell className="whitespace-nowrap">{a.category}</TableCell>
                        <TableCell className="whitespace-nowrap">{a.funding}</TableCell>
                        <TableCell className="font-bold whitespace-nowrap">{a.condition}%</TableCell>
                        <TableCell className="whitespace-nowrap">{a.status}</TableCell>
                        <TableCell className="font-medium text-emerald-950 whitespace-nowrap">{a.custodian || "Unassigned"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Section 2: Custody Handshake Logs */}
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold text-emerald-900 border-b pb-1.5 mb-1 uppercase tracking-widest font-sans">II. Custody Transitions &amp; Transfer Trail</h3>
              <div className="overflow-x-auto border rounded-lg w-full">
                <Table className="min-w-full text-[11px]">
                  <TableHeader>
                    <TableRow className="bg-emerald-50/30">
                      {["Transaction ID", "Asset Name", "From Custodian", "To Custodian", "Initiated Date", "Transition Status"].map(h => (
                        <TableHead key={h} className="text-[10px] font-bold text-emerald-900 whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchTransfers.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-4 font-sans">No transfer operations logged for CITe4D branch.</TableCell></TableRow>
                    ) : (
                      branchTransfers.map(t => (
                        <TableRow key={t.id}>
                          <TableCell className="font-bold text-emerald-800 whitespace-nowrap">{t.id}</TableCell>
                          <TableCell className="font-semibold min-w-[150px]">{t.asset}</TableCell>
                          <TableCell className="whitespace-nowrap">{t.from} ({t.fromRole})</TableCell>
                          <TableCell className="whitespace-nowrap">{t.to} ({t.toRole})</TableCell>
                          <TableCell className="whitespace-nowrap">{t.initiated}</TableCell>
                          <TableCell className="font-bold whitespace-nowrap">{t.status}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Section 3: Repair & Maintenance Operations History */}
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold text-emerald-900 border-b pb-1.5 mb-1 uppercase tracking-widest font-sans">III. Component Maintenance &amp; Troubleshooting Operations</h3>
              <div className="overflow-x-auto border rounded-lg w-full">
                <Table className="min-w-full text-[11px]">
                  <TableHeader>
                    <TableRow className="bg-emerald-50/30">
                      {["Ticket ID", "Asset ID", "Asset Name", "Issue Description", "Submitted At", "Urgency Status", "Acknowledge State"].map(h => (
                        <TableHead key={h} className="text-[10px] font-bold text-emerald-900 whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchRepairs.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-4 font-sans">No maintenance tickets logged for CITe4D branch.</TableCell></TableRow>
                    ) : (
                      branchRepairs.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-bold text-emerald-800 whitespace-nowrap">{r.id}</TableCell>
                          <TableCell className="font-mono whitespace-nowrap">{r.assetId}</TableCell>
                          <TableCell className="font-semibold min-w-[150px]">{r.assetName}</TableCell>
                          <TableCell className="italic max-w-[300px] truncate" title={r.description}>"{r.description}"</TableCell>
                          <TableCell className="whitespace-nowrap">{r.submittedAt}</TableCell>
                          <TableCell className="font-bold whitespace-nowrap">{r.priority}</TableCell>
                          <TableCell className="font-medium min-w-[140px]">{r.acknowledged ? "Resolved & Acknowledged" : "Pending Evaluation"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Compliance & Approvals Footer */}
            <div className="flex flex-row justify-between items-end gap-6 border-t border-emerald-200 pt-6 mt-8">
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-sans">Auditor Signature</p>
                <div className="h-10 w-40 border-b border-gray-400 mt-2 flex items-center justify-center italic text-xs text-gray-500 font-sans">Digital Signature Verified</div>
                <p className="text-[10px] text-gray-500 mt-1 font-sans">CITe4D Lab Head / Project Leader</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest font-sans">Compliance Status</p>
                <p className="text-xs font-bold text-emerald-700 mt-1 font-sans">✓ AdRIC Assets Compliant</p>
                <p className="text-[10px] text-gray-400 mt-0.5 font-sans">DLSU Engineering Standards</p>
              </div>
            </div>
          </div>

          <DialogFooter className="print:hidden gap-2">
            <Button variant="outline" onClick={() => setShowAuditModal(false)}>Close</Button>
            <Button className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold gap-1.5" onClick={() => window.print()}>
              <Printer size={13} />Print Audit Ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
