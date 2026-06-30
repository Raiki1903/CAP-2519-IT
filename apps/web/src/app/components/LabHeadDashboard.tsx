import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, XCircle, AlertTriangle, Search, ArrowRight, Package, MapPin, Calendar, LayoutGrid, Table2, Clock, Inbox } from "lucide-react";
import { AssetImagePlaceholder } from "./AssetImagePlaceholder";
import { useApp } from "../context";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Separator } from "./ui/separator";
import { cn } from "./ui/utils";

const MINT = "#10B981";

const transitions = [
  { id:"TXN-2026-0041", asset:"MacBook Pro M2 Max",    assetId:"EQ-2024-051", from:"Juan Santos",     fromRole:"PhD Researcher",    to:"Maria Cruz",       toRole:"MS Student",       lab:"CITe4D", initiated:"Jun 08, 2026", status:"Pending"  },
  { id:"TXN-2026-0040", asset:"UR10e Cobot Arm",        assetId:"EQ-2024-003", from:"Dr. Alex Reyes",  fromRole:"Research Associate", to:"Carlo Bautista",   toRole:"Research Asst.",   lab:"CeHCI",  initiated:"Jun 06, 2026", status:"Approved" },
  { id:"TXN-2026-0039", asset:"Phantom VEO4K Camera",   assetId:"EQ-2024-008", from:"Lei Tan",          fromRole:"PhD Student",        to:"Sofia Lim",        toRole:"Lab Technician",   lab:"Bio",    initiated:"Jun 04, 2026", status:"Pending"  },
  { id:"TXN-2026-0038", asset:"Leica BLK360 Scanner",   assetId:"EQ-2024-005", from:"Marco Dela Cruz", fromRole:"Project Lead",        to:"Anna Garcia",      toRole:"PhD Researcher",   lab:"CITe4D", initiated:"Jun 01, 2026", status:"Declined" },
  { id:"TXN-2026-0037", asset:"Boston Dynamics Spot",   assetId:"EQ-2024-004", from:"Felix Torres",    fromRole:"Research Fellow",    to:"Isabelle Flores",  toRole:"PhD Candidate",    lab:"HXIL",   initiated:"May 29, 2026", status:"Approved" },
];

const delinquencies = [
  { id:"DLQ-2026-0021", student:"Kenji Yamamoto",    studentId:"11205678", asset:"Surface Pro 9",    assetId:"EQ-2024-006-07", lab:"GAME",  dueDate:"May 25, 2026", daysOverdue:17, severity:"High",     action:"2nd Notice Sent" },
  { id:"DLQ-2026-0020", student:"Patricia Ong",      studentId:"11198432", asset:"Oculus Quest Pro", assetId:"EQ-2024-021",    lab:"CAR",   dueDate:"Jun 01, 2026", daysOverdue:10, severity:"Medium",   action:"1st Notice Sent" },
  { id:"DLQ-2026-0019", student:"Ruel Mendoza",      studentId:"11312089", asset:"RPi 4 Kit ×3",     assetId:"EQ-2024-007-03", lab:"CeLT",  dueDate:"Jun 05, 2026", daysOverdue:6,  severity:"Low",      action:"Auto-Alert" },
  { id:"DLQ-2026-0018", student:"Camille Navarro",   studentId:"11189244", asset:"Haptic Glove Set", assetId:"EQ-2024-033",    lab:"CeHCI", dueDate:"May 12, 2026", daysOverdue:30, severity:"Critical", action:"Escalated to Admin" },
];

const branchInventory = [
  { id:"EQ-2024-001", name:"Dell PowerEdge R740",   category:"Computing Array",  status:"Active",  custodian:"Dr. Santos", location:"Manila", condition:96,  funding:"DOST"     },
  { id:"EQ-2024-005", name:"Leica BLK360 Scanner",  category:"Sensor Array",     status:"Reserved",custodian:"A. Garcia",  location:"Manila", condition:100, funding:"DOST"     },
  { id:"EQ-2024-051", name:"MacBook Pro M2 Max",    category:"Mobile Infrastructure",status:"On Loan",custodian:"M. Cruz", location:"Manila", condition:88,  funding:"Internal" },
  { id:"EQ-2024-014", name:"Cisco Catalyst 9300",   category:"Networking",       status:"Active",  custodian:"Lab TSG",   location:"Manila", condition:93,  funding:"CHED"     },
];

const statusClass: Record<string, string> = {
  Active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Loan":"bg-blue-50   text-blue-700   border-blue-200",
  Reserved: "bg-violet-50 text-violet-700 border-violet-200",
};

const txnBadgeClass: Record<string, string> = {
  Pending:  "bg-amber-50  text-amber-700  border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Declined: "bg-red-50    text-red-700    border-red-200",
};

const severityClass: Record<string, string> = {
  Low:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium:   "bg-amber-50  text-amber-700  border-amber-200",
  High:     "bg-red-50    text-red-700    border-red-200",
  Critical: "bg-red-900   text-red-200    border-red-700",
};

function ConditionBar({ value }: { value: number }) {
  return <div className="h-1.5 w-11 bg-muted rounded-full overflow-hidden mt-1"><div className={cn("h-full rounded-full", value>=90?"bg-emerald-400":"bg-amber-400")} style={{width:`${value}%`}} /></div>;
}

export function LabHeadDashboard({ activeTab }: { activeTab: string }) {
  const [txnStates, setTxnStates] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table"|"gallery">("gallery");

  const getStatus = (txn: typeof transitions[0]) => txnStates[txn.id] || txn.status;
  const approve = (id: string) => setTxnStates(p => ({...p, [id]:"Approved"}));
  const decline = (id: string) => setTxnStates(p => ({...p, [id]:"Declined"}));
  const { borrowRequests, resolveBorrowRequest } = useApp();

  // ── Borrow Requests ───────────────────────────────────────────────────────
  if (activeTab === "requests") {
    const pending  = borrowRequests.filter(r => r.status === "Pending");
    const resolved = borrowRequests.filter(r => r.status !== "Pending");

    return (
      <div>
        <div className="mb-6">
          <h1 style={{ fontFamily: "'Montserrat', sans-serif" }} className="text-foreground mb-1">Borrow Requests</h1>
          <p className="text-muted-foreground text-sm">Review and approve or deny equipment borrow requests from custodians and students.</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-extrabold text-amber-600" style={{ fontFamily: "'Montserrat', sans-serif" }}>{pending.length}</p>
              <p className="text-xs text-muted-foreground">Awaiting Decision</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-extrabold text-emerald-700" style={{ fontFamily: "'Montserrat', sans-serif" }}>{borrowRequests.filter(r => r.status === "Approved").length}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-extrabold text-red-700" style={{ fontFamily: "'Montserrat', sans-serif" }}>{borrowRequests.filter(r => r.status === "Denied").length}</p>
              <p className="text-xs text-muted-foreground">Denied</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending */}
        {pending.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={15} className="text-amber-500" />
              <h3 className="font-semibold text-foreground text-sm">Pending Approval</h3>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">{pending.length}</Badge>
            </div>
            <div className="flex flex-col gap-3">
              <AnimatePresence>
                {pending.map(req => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 60 }}
                    transition={{ duration: 0.22 }}
                  >
                    <Card className="border-l-4 border-l-amber-400 p-0 gap-0" style={{ borderLeftWidth: 4 }}>
                      <CardContent className="pt-4 pb-4 px-5">
                        <div className="flex items-start gap-3">
                          {/* Asset thumbnail */}
                          <div className="w-14 h-11 rounded-lg overflow-hidden flex-shrink-0">
                            <AssetImagePlaceholder category={req.assetCategory} aspectRatio="4/3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-bold text-primary">{req.id}</span>
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[9px]">Pending</Badge>
                            </div>
                            <p className="text-sm font-bold text-foreground truncate">{req.assetName}</p>
                            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1"><Package size={9} />{req.assetId}</span>
                              <span className="flex items-center gap-1"><MapPin size={9} />{req.assetLab} · {req.assetLocation}</span>
                              <span className="flex items-center gap-1"><Calendar size={9} />Return by: {req.returnDate}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 rounded-lg bg-muted/40 border border-border p-3">
                          <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1">REQUEST PURPOSE</p>
                          <p className="text-xs text-foreground leading-relaxed">{req.purpose}</p>
                          <p className="text-[10px] text-muted-foreground mt-1.5">Requested by: <strong>{req.requestedBy}</strong> · {req.submittedAt}</p>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => resolveBorrowRequest(req.id, "Approved")}
                          >
                            <CheckCircle size={11} /> Approve Request
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => resolveBorrowRequest(req.id, "Denied")}
                          >
                            <XCircle size={11} /> Deny Request
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Resolved history */}
        {resolved.length > 0 && (
          <div>
            <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
              <Inbox size={14} className="text-muted-foreground" /> Decision History
            </h3>
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {["Request ID", "Asset", "Requested By", "Return Date", "Submitted", "Decision"].map(h => (
                      <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resolved.map(req => (
                    <TableRow key={req.id}>
                      <TableCell className="font-bold text-primary text-xs">{req.id}</TableCell>
                      <TableCell>
                        <p className="text-xs font-semibold text-foreground">{req.assetName}</p>
                        <p className="text-[10px] text-muted-foreground">{req.assetId}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{req.requestedBy}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{req.returnDate}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{req.submittedAt}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-[10px]",
                          req.status === "Approved"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        )}>
                          {req.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {borrowRequests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Inbox size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">No borrow requests yet</p>
            <p className="text-xs mt-1">Requests from custodians will appear here</p>
          </div>
        )}
      </div>
    );
  }

  // ── Custody ───────────────────────────────────────────────────────────────
  if (activeTab === "custody") {
    const pendingCount = transitions.filter(t => getStatus(t) === "Pending").length;
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">Digital Handshake Monitoring</h1>
          <p className="text-muted-foreground text-sm">Device custody transitions and authorization control for CITe4D research branch.</p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <Card><CardContent className="pt-4 pb-4"><p className="text-2xl font-extrabold text-amber-600">{pendingCount}</p><p className="text-xs text-muted-foreground">Pending Authorization</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4"><p className="text-2xl font-extrabold text-emerald-700">{transitions.filter(t=>(txnStates[t.id]||t.status)==="Approved").length}</p><p className="text-xs text-muted-foreground">Approved This Period</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4"><p className="text-2xl font-extrabold text-red-700">{transitions.filter(t=>(txnStates[t.id]||t.status)==="Declined").length}</p><p className="text-xs text-muted-foreground">Declined Requests</p></CardContent></Card>
        </div>
        <div className="flex flex-col gap-3">
          {transitions.map(txn => {
            const status = getStatus(txn);
            const isPending = status === "Pending";
            return (
              <Card key={txn.id} className={cn("border-l-4", status==="Approved"?"border-l-emerald-500":status==="Declined"?"border-l-red-500":"border-l-amber-500")} style={{ borderLeftWidth: 4 }}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-primary">{txn.id}</span>
                        <Badge className={cn("text-[10px]", txnBadgeClass[status])}>{status}</Badge>
                      </div>
                      <p className="text-sm font-bold text-foreground mb-2">{txn.asset}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
                        <div className="ml-auto text-right">
                          <p>{txn.lab}</p>
                          <p>{txn.initiated}</p>
                        </div>
                      </div>
                    </div>
                    {isPending && (
                      <div className="flex gap-2 flex-shrink-0">
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

  // ── Delinquency ───────────────────────────────────────────────────────────
  if (activeTab === "delinquency") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">Delinquency Alert Matrix</h1>
          <p className="text-muted-foreground text-sm">Overdue asset returns and handling anomalies — CITe4D branch.</p>
        </div>
        <div className="rounded-xl p-4 mb-5 flex items-center gap-3 bg-red-950 border border-red-800">
          <AlertTriangle size={16} className="text-red-300 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-300">1 Critical Delinquency Requiring Immediate Escalation</p>
            <p className="text-xs text-red-400 opacity-80 mt-0.5">Camille Navarro — Haptic Glove Set — 30 days overdue. Escalated to Administration.</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {delinquencies.map(dlq => (
            <Card key={dlq.id} className={cn("border-l-4", dlq.severity==="Critical"?"border-l-red-700":dlq.severity==="High"?"border-l-red-500":dlq.severity==="Medium"?"border-l-amber-500":"border-l-emerald-500")} style={{ borderLeftWidth: 4 }}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-bold text-primary">{dlq.id}</span>
                      <Badge className={cn("text-[10px]", severityClass[dlq.severity])}>{dlq.severity}</Badge>
                      <Badge variant="destructive" className="text-[10px]">{dlq.daysOverdue}d overdue</Badge>
                    </div>
                    <p className="text-sm font-bold text-foreground mb-1">{dlq.student}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Package size={10} />{dlq.asset}</span>
                      <span className="flex items-center gap-1"><MapPin size={10} />{dlq.lab}</span>
                      <span className="flex items-center gap-1"><Calendar size={10} />Due: {dlq.dueDate}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-xs font-semibold text-foreground">{dlq.action}</p>
                    <Button size="sm" className="mt-2 text-xs h-7">Send Notice</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ── Branch Inventory ──────────────────────────────────────────────────────
  const filtered = branchInventory.filter(eq => eq.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-foreground mb-1">Branch Inventory — CITe4D</h1>
          <p className="text-muted-foreground text-sm">Filtered view — other research centers are masked.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-border">
            <Button variant={viewMode==="gallery"?"default":"ghost"} size="sm" onClick={()=>setViewMode("gallery")} className="rounded-none text-xs gap-1.5"><LayoutGrid size={13} />Gallery</Button>
            <Button variant={viewMode==="table"?"default":"ghost"} size="sm" onClick={()=>setViewMode("table")} className="rounded-none text-xs gap-1.5"><Table2 size={13} />Table</Button>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-3 py-1">BRANCH-SCOPED VIEW</Badge>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search branch assets…" className="pl-8" />
      </div>

      {viewMode === "gallery" && (
        <div className="grid gap-4" style={{ gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))" }}>
          {filtered.map(eq => (
            <Card key={eq.id} className="overflow-hidden p-0 gap-0">
              <div className="relative">
                <AssetImagePlaceholder category={eq.category} aspectRatio="4/3" />
                <Badge className={cn("absolute top-2 right-2 text-[9px]", statusClass[eq.status]??statusClass["Active"])}>{eq.status}</Badge>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-border">
                  <div className={cn("h-full", eq.condition>=90?"bg-emerald-400":"bg-amber-400")} style={{width:`${eq.condition}%`}} />
                </div>
              </div>
              <CardContent className="px-3.5 py-3">
                <p className="text-[10px] font-bold text-primary mb-1">{eq.id}</p>
                <p className="text-sm font-bold text-foreground leading-snug mb-2">{eq.name}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{eq.custodian}</span>
                  <span className={cn("font-bold", eq.condition>=90?"text-emerald-700":"text-amber-700")}>{eq.condition}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{eq.category} · {eq.location}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewMode === "table" && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                {["","Asset ID","Name","Category","Status","Custodian","Location","Cond.","Funding"].map(h=><TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(eq => (
                <TableRow key={eq.id}>
                  <TableCell><div className="w-10 h-7 rounded overflow-hidden"><AssetImagePlaceholder category={eq.category} aspectRatio="4/3" /></div></TableCell>
                  <TableCell className="font-bold text-primary text-xs">{eq.id}</TableCell>
                  <TableCell className="text-xs font-semibold text-foreground">{eq.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{eq.category}</TableCell>
                  <TableCell><Badge className={cn("text-[10px]",statusClass[eq.status]??statusClass["Active"])}>{eq.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{eq.custodian}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{eq.location}</TableCell>
                  <TableCell><p className={cn("text-xs font-bold",eq.condition>=90?"text-emerald-700":"text-amber-700")}>{eq.condition}%</p><ConditionBar value={eq.condition} /></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{eq.funding}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
