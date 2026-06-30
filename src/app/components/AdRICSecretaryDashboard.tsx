import { useState, useMemo } from "react";
import { useApp } from "../context";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { AssetDetailModal as AssetModal } from "./AssetDetailModal";
import { cn } from "./ui/utils";
import {
  Search, ClipboardList, Users, Wrench,
  CheckCircle, AlertTriangle,
  Package, BookOpen, Inbox, Shield
} from "lucide-react";

const BRAND = "#005A36";
const BRAND_LIGHT = "#F0FDF4";

const statusBadgeClass: Record<string, string> = {
  "Active":             "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Loan":            "bg-blue-50   text-blue-700   border-blue-200",
  "Maintenance":        "bg-amber-50  text-amber-700  border-amber-200",
  "Reserved":           "bg-violet-50 text-violet-700 border-violet-200",
  "Partially Deployed": "bg-orange-50 text-orange-700 border-orange-200",
  "Available":          "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Pending Return":     "bg-amber-50  text-amber-700  border-amber-200",
  "Pending Transfer":   "bg-amber-50  text-amber-700  border-amber-200",
  "Overdue":            "bg-red-50    text-red-700    border-red-200",
};

function SummaryTile({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number | string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND_LIGHT }}>
        <Icon size={18} style={{ color: BRAND }} />
      </div>
      <div>
        <p className={cn("text-xl font-extrabold leading-none", accent || "text-foreground")}>{value}</p>
        <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

export function AdRICSecretaryDashboard({ activeTab }: { activeTab: string }) {
  const { assets, transfers, repairRequests, returns } = useApp();

  const [search, setSearch] = useState("");
  const [filterTransferStatus, setFilterTransferStatus] = useState<"All" | "Pending" | "Approved" | "Declined">("All");
  const [filterRepairPriority, setFilterRepairPriority] = useState<"All" | "Critical" | "High" | "Medium">("All");
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);

  // Computed data
  const pendingTransfers = transfers.filter(t => t.status === "Pending");
  const pendingRepairs = repairRequests.filter(r => !r.acknowledged);
  const pendingReturns = returns.filter(r => r.status === "Pending");

  const filteredTransfers = useMemo(() =>
    transfers.filter(t =>
      (filterTransferStatus === "All" || t.status === filterTransferStatus) &&
      (t.asset.toLowerCase().includes(search.toLowerCase()) ||
       t.from.toLowerCase().includes(search.toLowerCase()) ||
       t.to.toLowerCase().includes(search.toLowerCase()))
    ),
    [transfers, filterTransferStatus, search]
  );

  const filteredRepairs = useMemo(() =>
    repairRequests.filter(r =>
      (filterRepairPriority === "All" || r.priority === filterRepairPriority) &&
      (r.assetName.toLowerCase().includes(search.toLowerCase()) ||
       r.custodian.toLowerCase().includes(search.toLowerCase()))
    ),
    [repairRequests, filterRepairPriority, search]
  );

  const filteredAssets = useMemo(() =>
    assets.filter(a =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase()) ||
      (a.custodian || "").toLowerCase().includes(search.toLowerCase())
    ),
    [assets, search]
  );

  // ── Overview Tab ──────────────────────────────────────────────────────────
  if (activeTab === "overview") {
    return (
      <div className="space-y-7">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BRAND }}>
              <BookOpen size={16} className="text-white" />
            </div>
            <span className="text-[10px] font-extrabold tracking-[2.5px] uppercase text-muted-foreground">
              AdRIC SECRETARIAT SUITE
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Secretariat Operations Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Asset documentation, custody tracking, and administrative coordination.
          </p>
        </div>

        {/* Inbox Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryTile icon={Users} label="Pending Transfers" value={pendingTransfers.length}
            accent={pendingTransfers.length > 0 ? "text-amber-600" : "text-foreground"} />
          <SummaryTile icon={Wrench} label="Open Repairs" value={pendingRepairs.length}
            accent={pendingRepairs.length > 0 ? "text-red-600" : "text-foreground"} />
          <SummaryTile icon={ClipboardList} label="Pending Returns" value={pendingReturns.length}
            accent={pendingReturns.length > 0 ? "text-amber-600" : "text-foreground"} />
          <SummaryTile icon={Package} label="Total Assets" value={assets.length} />
        </div>

        {/* Action Inbox */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Transfer Queue */}
          <Card>
            <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Inbox size={14} style={{ color: BRAND }} /> Transfer Request Queue
              </CardTitle>
              <Badge className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 font-bold">
                {pendingTransfers.length} Pending
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {pendingTransfers.length === 0 ? (
                <div className="p-6 flex flex-col items-center gap-2 text-muted-foreground">
                  <CheckCircle size={22} className="text-emerald-500" />
                  <p className="text-xs font-medium">All transfer requests have been processed.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {pendingTransfers.slice(0, 4).map(txn => (
                    <div key={txn.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Users size={12} className="text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-xs font-bold text-foreground truncate">{txn.asset}</p>
                          <span className="text-[9px] text-muted-foreground flex-shrink-0">{txn.initiated}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {txn.from} <span className="mx-1 text-primary">→</span> {txn.to} · {txn.lab}
                        </p>
                        <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{txn.id}</p>
                      </div>
                    </div>
                  ))}
                  {pendingTransfers.length > 4 && (
                    <div className="px-4 py-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground font-medium">
                        +{pendingTransfers.length - 4} more requests
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Repair Queue */}
          <Card>
            <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Wrench size={14} style={{ color: BRAND }} /> Maintenance Incident Queue
              </CardTitle>
              <Badge className="text-[9px] bg-red-50 text-red-700 border-red-200 font-bold">
                {pendingRepairs.length} Unresolved
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {pendingRepairs.length === 0 ? (
                <div className="p-6 flex flex-col items-center gap-2 text-muted-foreground">
                  <CheckCircle size={22} className="text-emerald-500" />
                  <p className="text-xs font-medium">No open maintenance incidents.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {pendingRepairs.slice(0, 4).map(req => (
                    <div key={req.id} className="px-4 py-3 flex items-start gap-3">
                      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                        req.priority === "Critical" ? "bg-red-50" : req.priority === "High" ? "bg-orange-50" : "bg-blue-50")}>
                        <AlertTriangle size={12} className={
                          req.priority === "Critical" ? "text-red-600" :
                          req.priority === "High" ? "text-orange-600" : "text-blue-600"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-xs font-bold text-foreground truncate">{req.assetName}</p>
                          <Badge className={cn("text-[8px] uppercase font-bold flex-shrink-0",
                            req.priority === "Critical" ? "bg-red-50 text-red-700 border-red-200" :
                            req.priority === "High" ? "bg-orange-50 text-orange-700 border-orange-200" :
                            "bg-blue-50 text-blue-700 border-blue-200"
                          )}>
                            {req.priority}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{req.statusLabel} · {req.custodian}</p>
                        <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{req.id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Return Queue */}
        <Card>
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ClipboardList size={14} style={{ color: BRAND }} /> Equipment Return Ledger
            </CardTitle>
            <Badge className="text-[9px] bg-violet-50 text-violet-700 border-violet-200 font-bold">
              {pendingReturns.length} Pending Finalization
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {returns.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No return ledgers on record.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[9px] uppercase tracking-wider font-extrabold">Reference</TableHead>
                    <TableHead className="text-[9px] uppercase tracking-wider font-extrabold">Asset</TableHead>
                    <TableHead className="text-[9px] uppercase tracking-wider font-extrabold">Custodian</TableHead>
                    <TableHead className="text-[9px] uppercase tracking-wider font-extrabold">Return Date</TableHead>
                    <TableHead className="text-[9px] uppercase tracking-wider font-extrabold">Condition</TableHead>
                    <TableHead className="text-[9px] uppercase tracking-wider font-extrabold">Clearance</TableHead>
                    <TableHead className="text-[9px] uppercase tracking-wider font-extrabold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map(ret => (
                    <TableRow key={ret.id}>
                      <TableCell className="font-bold text-primary text-xs">{ret.id}</TableCell>
                      <TableCell>
                        <p className="text-xs font-semibold text-foreground">{ret.assetName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{ret.assetId}</p>
                      </TableCell>
                      <TableCell className="text-xs text-foreground font-medium">{ret.custodian}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{ret.returnDate}</TableCell>
                      <TableCell className="text-xs font-medium">{ret.condition || "—"}</TableCell>
                      <TableCell className="text-xs font-bold text-primary font-mono">{ret.certId || "Not Issued"}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-[9px] uppercase font-bold",
                          ret.status === "Finalized" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {ret.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Transfers Tab (Read-Only) ─────────────────────────────────────────────
  if (activeTab === "transfers") {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Custody Transition Records
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              View all equipment handoff requests. Route escalations to Lab Head as needed.
            </p>
          </div>
          <Badge className="mt-2 text-[9px] font-bold uppercase bg-blue-50 text-blue-700 border-blue-200 flex-shrink-0">
            Read-Only
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search asset, custodian, or recipient…" className="pl-9" />
          </div>
          <div className="flex gap-2">
            {(["All", "Pending", "Approved", "Declined"] as const).map(s => (
              <Button key={s} size="sm" variant={filterTransferStatus === s ? "default" : "outline"}
                onClick={() => setFilterTransferStatus(s)}
                className={cn("text-xs", filterTransferStatus === s && "text-white")}
                style={filterTransferStatus === s ? { background: BRAND } : {}}>
                {s}
              </Button>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden border border-border bg-white">
          {filteredTransfers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No transfer records match your criteria.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Reference ID</TableHead>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Asset</TableHead>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">From</TableHead>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">To</TableHead>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Hub</TableHead>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Date</TableHead>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map(txn => (
                  <TableRow key={txn.id}>
                    <TableCell className="font-bold text-primary text-xs">{txn.id}</TableCell>
                    <TableCell>
                      <p className="text-xs font-semibold text-foreground">{txn.asset}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{txn.assetId}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground">{txn.from}</p>
                      <p className="text-[10px] text-muted-foreground">{txn.fromRole}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground">{txn.to}</p>
                      <p className="text-[10px] text-muted-foreground">{txn.toRole}</p>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">{txn.lab}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{txn.initiated}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[9px] uppercase font-bold",
                        txn.status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        txn.status === "Declined" ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {txn.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    );
  }

  // ── Maintenance Log Tab (Read-Only) ───────────────────────────────────────
  if (activeTab === "maintenance") {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Maintenance &amp; Incident Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Read-only log of all equipment faults and repair tickets.
            </p>
          </div>
          <Badge className="mt-2 text-[9px] font-bold uppercase bg-blue-50 text-blue-700 border-blue-200 flex-shrink-0">
            Read-Only
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search asset or custodian…" className="pl-9" />
          </div>
          <div className="flex gap-2">
            {(["All", "Critical", "High", "Medium"] as const).map(p => (
              <Button key={p} size="sm" variant={filterRepairPriority === p ? "default" : "outline"}
                onClick={() => setFilterRepairPriority(p)}
                className={cn("text-xs", filterRepairPriority === p && "text-white")}
                style={filterRepairPriority === p ? { background: BRAND } : {}}>
                {p}
              </Button>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden border border-border bg-white">
          {filteredRepairs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No incident reports found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Ticket ID</TableHead>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Asset</TableHead>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Reporter</TableHead>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Incident Type</TableHead>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Priority</TableHead>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Logged</TableHead>
                  <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRepairs.map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="font-bold text-primary text-xs">{req.id}</TableCell>
                    <TableCell>
                      <p className="text-xs font-semibold text-foreground">{req.assetName}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{req.assetId}</p>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground">{req.custodian}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{req.statusLabel}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[9px] uppercase font-bold",
                        req.priority === "Critical" ? "bg-red-50 text-red-700 border-red-200" :
                        req.priority === "High" ? "bg-orange-50 text-orange-700 border-orange-200" :
                        "bg-blue-50 text-blue-700 border-blue-200"
                      )}>
                        {req.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {req.submittedAt ? req.submittedAt.split(",")[0] : "Jun 30, 2026"}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[9px] uppercase font-bold",
                        req.acknowledged ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {req.acknowledged ? "Resolved" : "Pending Triage"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    );
  }

  // ── Inventory Tab (Read-Only) ─────────────────────────────────────────────
  if (activeTab === "inventory") {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Asset Registry Browse
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Search and review all registered lab equipment. Documentation reference only.
            </p>
          </div>
          <Badge className="mt-2 text-[9px] font-bold uppercase bg-blue-50 text-blue-700 border-blue-200 flex-shrink-0">
            Read-Only
          </Badge>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, ID, or custodian…" className="pl-9" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            { label: "Total Assets", value: assets.length, color: "text-foreground" },
            { label: "Active", value: assets.filter(a => a.status === "Active").length, color: "text-emerald-700" },
            { label: "On Loan", value: assets.filter(a => a.status === "On Loan").length, color: "text-blue-700" },
            { label: "Maintenance", value: assets.filter(a => a.status === "Maintenance").length, color: "text-amber-700" },
          ].map(item => (
            <Card key={item.label}>
              <CardContent className="pt-4 pb-4">
                <p className={cn("text-2xl font-extrabold", item.color)}>{item.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-0.5">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Asset ID</TableHead>
                <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Equipment Name</TableHead>
                <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Category</TableHead>
                <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Funding</TableHead>
                <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Lab · Campus</TableHead>
                <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Custodian</TableHead>
                <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Warranty</TableHead>
                <TableHead className="font-extrabold text-[9px] uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map(asset => (
                <TableRow key={asset.id} className="cursor-pointer hover:bg-muted/10"
                  onClick={() => setSelectedAsset(asset)}>
                  <TableCell className="font-bold text-primary text-xs">{asset.id}</TableCell>
                  <TableCell>
                    <p className="text-xs font-semibold text-foreground">{asset.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{asset.serial}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{asset.category}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[9px] font-bold",
                      asset.funding === "DOST" ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
                      asset.funding === "USAID" ? "border-blue-200 text-blue-700 bg-blue-50" :
                      asset.funding === "CHED" ? "border-violet-200 text-violet-700 bg-violet-50" :
                      "border-amber-200 text-amber-700 bg-amber-50"
                    )}>{asset.funding}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="font-semibold text-foreground">{asset.lab}</span>
                    <span className="text-muted-foreground"> · {asset.location}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{asset.custodian || "Unassigned"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{asset.warranty}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-[9px] uppercase font-bold",
                      statusBadgeClass[asset.status] || "bg-muted text-muted-foreground")}>
                      {asset.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredAssets.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No assets match your search.</div>
          )}
        </Card>

        <AssetModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      </div>
    );
  }

  return null;
}
