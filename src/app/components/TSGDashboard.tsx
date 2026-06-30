import { useState } from "react";
import { QrCode, Printer, Download, CheckCircle, Zap, Eye, Image as ImageIcon } from "lucide-react";
import { useApp } from "../context";
import type { RepairRequest } from "../context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ReturnForm } from "./ReturnForm";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "./ui/table";
import { Separator } from "./ui/separator";
import { cn } from "./ui/utils";

const labGroups = [
  { id: "A", name: "Group A", labs: ["CITe4D"],              assets: 312, due: 4, color: "text-blue-600"    },
  { id: "B", name: "Group B", labs: ["CAR", "CeLT"],         assets: 198, due: 2, color: "text-violet-600"  },
  { id: "C", name: "Group C", labs: ["CeHCI","Bio","HXIL"],  assets: 274, due: 7, color: "text-amber-600"   },
  { id: "D", name: "Group D", labs: ["GAME", "CIVI"],        assets: 156, due: 1, color: "text-emerald-600" },
];

const maintenanceQueues: Record<string, { id:string; asset:string; serial:string; lab:string; lastInspected:string; status:string; urgency:string }[]> = {
  A: [
    { id:"MNT-2026-0141", asset:"Dell PowerEdge R740", serial:"SN-DPE-740-001", lab:"CITe4D", lastInspected:"2025-12-10", status:"Due Soon",  urgency:"Normal"   },
    { id:"MNT-2026-0142", asset:"NVIDIA DGX A100",     serial:"SN-DGX-A100-02",  lab:"CITe4D", lastInspected:"2025-11-20", status:"Overdue",   urgency:"High"     },
    { id:"MNT-2026-0143", asset:"Leica BLK360 Scanner",serial:"SN-LBK-360-09",   lab:"CITe4D", lastInspected:"2026-02-15", status:"Inspected", urgency:"Low"      },
  ],
  B: [
    { id:"MNT-2026-0151", asset:"RPi 4 Cluster ×32",  serial:"SN-RPI4-CLU-07",  lab:"CeLT", lastInspected:"2026-03-01", status:"Inspected", urgency:"Low"    },
    { id:"MNT-2026-0152", asset:"Oculus Quest Pro ×8", serial:"OQ-PRO-DLSU",     lab:"CAR",  lastInspected:"2026-01-20", status:"Due Soon",  urgency:"Normal" },
  ],
  C: [
    { id:"MNT-2026-0161", asset:"Boston Dynamics Spot",   serial:"SN-SPOT-0178",    lab:"HXIL", lastInspected:"2025-10-15", status:"Overdue",   urgency:"Critical" },
    { id:"MNT-2026-0162", asset:"Phantom VEO4K Camera",   serial:"SN-PH-VEO-4K-01", lab:"Bio",  lastInspected:"2026-04-10", status:"Inspected", urgency:"Low"      },
  ],
  D: [
    { id:"MNT-2026-0171", asset:"Surface Pro 9 Bundle",      serial:"SN-SP9-BNDL-03", lab:"GAME", lastInspected:"2026-05-01", status:"Inspected", urgency:"Low"    },
    { id:"MNT-2026-0172", asset:"Trimble SX12 Total Station",serial:"TR-SX12-0092",   lab:"CIVI", lastInspected:"2026-01-14", status:"Due Soon",  urgency:"Normal" },
  ],
};

const qrAssets = [
  { id:"EQ-2024-001", name:"Dell PowerEdge R740",  lab:"CITe4D", location:"Manila", serial:"SN-DPE-740-001" },
  { id:"EQ-2024-002", name:"NVIDIA DGX A100",      lab:"CAR",    location:"Laguna", serial:"SN-DGX-A100-02" },
  { id:"EQ-2024-003", name:"UR10e Cobot",           lab:"CeHCI",  location:"Manila", serial:"SN-UR10e-0034"  },
  { id:"EQ-2024-005", name:"Leica BLK360",          lab:"CITe4D", location:"Manila", serial:"SN-LBK-360-09"  },
  { id:"EQ-2024-006", name:"Surface Pro 9 Bundle",  lab:"GAME",   location:"Manila", serial:"SN-SP9-BNDL-03" },
  { id:"EQ-2024-007", name:"RPi 4 Cluster ×32",     lab:"CeLT",   location:"Laguna", serial:"SN-RPI4-CLU-07" },
];

const healthData = [
  { id:"EQ-2024-001", asset:"Dell PowerEdge R740", battery:null, storage_health:94,   thermal:42,   sensor_drift:null, uptime:99.8, notes:"SSD sector accumulation within tolerance"            },
  { id:"EQ-2024-002", asset:"NVIDIA DGX A100",     battery:null, storage_health:88,   thermal:68,   sensor_drift:null, uptime:97.3, notes:"GPU thermal slightly elevated — check airflow"         },
  { id:"EQ-2024-003", asset:"UR10e Cobot",          battery:72,   storage_health:null, thermal:null, sensor_drift:0.8,  uptime:98.1, notes:"Joint encoder drift within 0.8° — acceptable"          },
  { id:"EQ-2024-004", asset:"Boston Dynamics Spot", battery:54,   storage_health:null, thermal:null, sensor_drift:2.4,  uptime:71.2, notes:"Battery degraded below 60% — flag for replacement"     },
  { id:"EQ-2024-005", asset:"Leica BLK360",         battery:91,   storage_health:null, thermal:null, sensor_drift:0.2,  uptime:100,  notes:"All sensors nominal"                                    },
];

const statusBadge: Record<string,string> = {
  Inspected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Due Soon": "bg-amber-50 text-amber-700 border-amber-200",
  Overdue:    "bg-red-50 text-red-700 border-red-200",
};
const urgencyBadge: Record<string,string> = {
  Low:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  Normal:   "bg-blue-50   text-blue-700   border-blue-200",
  High:     "bg-amber-50  text-amber-700  border-amber-200",
  Critical: "bg-red-50    text-red-700    border-red-200",
};

function MetricBar({ value, color }: { value: number; color: string }) {
  return <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1 w-12"><div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100,value)}%` }} /></div>;
}

function RepairAlertCard({ req, onAcknowledge }: { req: RepairRequest; onAcknowledge: (id:string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isCritical = req.priority === "Critical";
  return (
    <div className={cn("rounded-xl overflow-hidden border-2", isCritical ? "border-red-400" : "border-orange-400")}
      style={{ animation: !req.acknowledged ? "pulseAlert 2s ease-in-out infinite" : "none" }}>
      <div className={cn("px-4 py-1.5 flex items-center gap-2", isCritical ? "bg-red-500" : "bg-orange-500")}>
        <Zap size={11} className="text-white" />
        <span className="text-[10px] font-extrabold text-white tracking-widest flex-1">
          {isCritical ? "CRITICAL" : "HIGH PRIORITY"} REPAIR REQUEST · {req.id}
        </span>
        {!req.acknowledged && <Badge className="text-[9px] bg-white/20 text-white border-white/20">NEW</Badge>}
      </div>
      <div className={cn("p-4", isCritical ? "bg-red-50" : "bg-orange-50")}>
        <div className="flex gap-3 items-start">
          <div className="w-16 h-14 rounded-lg border-2 border-border bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            {req.imageUrl ? <img src={req.imageUrl} alt="asset" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-muted-foreground" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-foreground mb-0.5">{req.assetName}</p>
            <p className="text-xs text-muted-foreground mb-1">{req.assetId} · {req.submittedAt} · <strong className={isCritical ? "text-red-700" : "text-orange-700"}>{req.statusLabel}</strong></p>
            <p className="text-xs text-foreground italic leading-relaxed">"{req.description.slice(0, 100)}{req.description.length > 100 ? "…" : ""}"</p>
            <p className="text-[11px] text-muted-foreground mt-1">Submitted by: {req.custodian}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {!req.acknowledged
            ? <Button size="sm" className="flex-1 text-xs" onClick={() => onAcknowledge(req.id)}><CheckCircle size={11} />Acknowledge & Assign Technician</Button>
            : <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-semibold"><CheckCircle size={11} />Acknowledged</div>
          }
          <Button size="sm" variant="outline" onClick={() => setExpanded(!expanded)} className="text-xs"><Eye size={11} />{expanded ? "Collapse" : "Full Report"}</Button>
        </div>
        {expanded && (
          <div className="mt-3 rounded-lg border border-border bg-white p-3">
            <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-2">FULL CUSTODIAN DESCRIPTION</p>
            <p className="text-xs text-foreground leading-relaxed">{req.description || "No description provided."}</p>
            {req.imageUrl && <img src={req.imageUrl} alt="condition" className="mt-2 rounded-lg max-w-full border border-border" />}
          </div>
        )}
      </div>
    </div>
  );
}

export function TSGDashboard({ activeTab }: { activeTab: string }) {
  const { cycleMode, setCycleMode, repairRequests, acknowledgeRepair, assets, returns } = useApp();
  const [activeGroup, setActiveGroup] = useState("A");
  const [selectedQR, setSelectedQR] = useState<string[]>([]);
  const [healthEdits, setHealthEdits] = useState<Record<string, Record<string, string>>>({});
  const [selectedReturnAsset, setSelectedReturnAsset] = useState<any | null>(null);

  const unacknowledged = repairRequests.filter(r => !r.acknowledged);
  const pendingReturns = returns.filter(r => r.status === "Pending");

  // ── Maintenance ───────────────────────────────────────────────────────────
  if (activeTab === "maintenance") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">Asset Longevity & Physical Registry Upkeep</h1>
          <p className="text-muted-foreground text-sm">Scheduled inspection management across all laboratory groups.</p>
        </div>

        {/* Repair requests */}
        {repairRequests.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Zap size={16} className="text-red-500" />
              <h3 className="text-foreground font-semibold">On-Demand Repair Requests</h3>
              {unacknowledged.length > 0 && <Badge className="bg-red-500 text-white border-red-500 text-[10px]">{unacknowledged.length} UNACKNOWLEDGED</Badge>}
            </div>
            <div className="flex flex-col gap-3">
              {repairRequests.map(req => <RepairAlertCard key={req.id} req={req} onAcknowledge={acknowledgeRepair} />)}
            </div>
            <Separator className="my-5" />
          </div>
        )}

        {/* Frequency toggle */}
        <Card className="mb-5">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="font-bold text-foreground text-sm">Inspection Frequency Engine</p>
              <p className="text-xs text-muted-foreground mt-0.5">Active cycle: <strong className="text-primary">{cycleMode === "Annual" ? "Annual Cycle (once per year)" : "Trimestral Cycle (every trimester)"}</strong></p>
            </div>
            <div className="flex items-center gap-3">
              <Label className={cn("text-xs font-semibold", cycleMode === "Annual" ? "text-foreground" : "text-muted-foreground")}>Annual</Label>
              <Switch checked={cycleMode === "Trimestral"} onCheckedChange={c => setCycleMode(c ? "Trimestral" : "Annual")} className="data-[state=checked]:bg-primary" />
              <Label className={cn("text-xs font-semibold", cycleMode === "Trimestral" ? "text-foreground" : "text-muted-foreground")}>Trimestral</Label>
            </div>
          </CardContent>
        </Card>

        {/* Group tabs using shadcn Tabs */}
        <Tabs value={activeGroup} onValueChange={setActiveGroup}>
          <TabsList className="mb-4 h-auto gap-1 bg-muted/40">
            {labGroups.map(g => (
              <TabsTrigger key={g.id} value={g.id} className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                <span className={cn("w-2 h-2 rounded-full", g.color.replace("text-","bg-"))} />
                {g.name}
                {g.due > 0 && <Badge className="text-[9px] bg-red-100 text-red-700 border-red-200 ml-0.5">{g.due}</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>

          {labGroups.map(g => (
            <TabsContent key={g.id} value={g.id}>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[{val:String(g.assets),label:"Total Assets"},{val:String(g.due),label:"Due / Overdue"},{val:g.labs.join(", "),label:"Labs"}].map(({val,label}) => (
                  <Card key={label}><CardContent className="pt-4 pb-4"><p className="text-xl font-extrabold text-foreground">{val}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>
                ))}
              </div>
              <Card className="overflow-hidden p-0">
                <CardHeader className="px-5 py-4 flex-row items-center justify-between space-y-0 border-b border-border">
                  <CardTitle className="text-sm">Inspection Queue — Group {g.id} ({g.labs.join(", ")})</CardTitle>
                  <span className="text-xs text-muted-foreground">{cycleMode} Schedule</span>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      {["Ticket ID","Asset","Lab","Last Inspected","Status","Urgency","Action"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(maintenanceQueues[g.id] ?? []).map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-bold text-primary text-xs">{item.id}</TableCell>
                        <TableCell><p className="text-xs font-semibold text-foreground">{item.asset}</p><p className="text-[10px] text-muted-foreground">{item.serial}</p></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.lab}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.lastInspected}</TableCell>
                        <TableCell><Badge className={cn("text-[10px]", statusBadge[item.status])}>{item.status}</Badge></TableCell>
                        <TableCell><Badge className={cn("text-[10px]", urgencyBadge[item.urgency])}>{item.urgency}</Badge></TableCell>
                        <TableCell><Button size="sm" className="text-xs h-7">Schedule</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
        <style>{`@keyframes pulseAlert { 0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,0); } 50% { box-shadow:0 0 0 4px rgba(239,68,68,0.15); } }`}</style>
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
                  const matchingAsset = assets.find(a => a.id === req.assetId);
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
          <DialogContent className="max-w-lg">
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
                              <div className="w-14 h-14 bg-foreground rounded flex items-center justify-center flex-shrink-0">
                                <svg width="40" height="40" viewBox="0 0 40 40">
                                  <rect x="2" y="2" width="14" height="14" rx="2" fill="white"/><rect x="24" y="2" width="14" height="14" rx="2" fill="white"/><rect x="2" y="24" width="14" height="14" rx="2" fill="white"/>
                                  <rect x="5" y="5" width="8" height="8" rx="1" fill="#111"/><rect x="27" y="5" width="8" height="8" rx="1" fill="#111"/><rect x="5" y="27" width="8" height="8" rx="1" fill="#111"/>
                                  <rect x="22" y="22" width="16" height="16" rx="2" fill="white"/><rect x="25" y="25" width="4" height="4" fill="#111"/><rect x="31" y="25" width="4" height="4" fill="#111"/><rect x="25" y="31" width="10" height="4" fill="#111"/>
                                </svg>
                              </div>
                              <div><p className="text-[9px] font-extrabold text-foreground leading-snug">{a.name}</p><p className="text-[8px] text-muted-foreground">{a.id}</p><p className="text-[8px] text-muted-foreground">{a.lab} · {a.location}</p></div>
                            </div>
                            <p className="text-center text-[7px] text-muted-foreground tracking-wide mt-2 pt-1.5 border-t border-border">DLSU AdRIC EQUIPMENT MANAGEMENT SYSTEM</p>
                          </div>
                        );
                      })}
                    </div>
                }
              </CardContent>
            </Card>
            <Button disabled={!selectedQR.length} className="gap-2"><Printer size={13} />Print {selectedQR.length > 0 ? `${selectedQR.length} Tag${selectedQR.length > 1 ? "s" : ""}` : "Tags"}</Button>
            <Button variant="outline" disabled={!selectedQR.length} className="gap-2"><Download size={13} />Export PDF</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Health Benchmarking ───────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">Numeric Health Benchmarking Grid</h1>
        <p className="text-muted-foreground text-sm">Track physical component breakdown relative to Day 1 baseline performance logs.</p>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[{label:"Within Tolerance",val:"4",col:"text-emerald-700"},{label:"Flagged",val:"1",col:"text-red-600"},{label:"Avg Battery Health",val:"73.8%",col:"text-blue-600"},{label:"Avg Storage Health",val:"92.7%",col:"text-violet-600"}].map(({label,val,col}) => (
          <Card key={label}><CardContent className="pt-4 pb-4"><p className={cn("text-2xl font-extrabold",col)}>{val}</p><p className="text-xs text-muted-foreground mt-0.5">{label}</p></CardContent></Card>
        ))}
      </div>
      <Card className="overflow-hidden p-0">
        <CardHeader className="px-5 py-4 border-b border-border">
          <CardTitle className="text-sm">Component Health Matrix — Editable Benchmarks</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {["Asset","Battery/Power Health","Storage Integrity","Sensor Drift","Uptime","Notes","Score"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider whitespace-nowrap">{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {healthData.map(row => {
              const e = healthEdits[row.id] || {};
              const battery = parseFloat(e.battery ?? String(row.battery ?? ""));
              const storage = parseFloat(e.storage_health ?? String(row.storage_health ?? ""));
              const drift = parseFloat(e.sensor_drift ?? String(row.sensor_drift ?? ""));
              const uptime = parseFloat(e.uptime ?? String(row.uptime));
              const issues = [row.battery !== null && battery<70, row.storage_health !== null && storage<85, row.sensor_drift !== null && drift>2, uptime<80].filter(Boolean).length;
              const score = Math.max(0, 100 - issues*15 - (row.battery !== null && battery<60 ? 15 : 0));
              return (
                <TableRow key={row.id}>
                  <TableCell><p className="text-xs font-semibold text-foreground">{row.asset}</p><p className="text-[10px] text-muted-foreground">{row.id}</p></TableCell>
                  <TableCell>
                    {row.battery !== null ? <div><div className="flex items-center gap-1"><Input type="number" min={0} max={100} value={e.battery ?? String(row.battery)} onChange={ev => setHealthEdits(p => ({...p,[row.id]:{...p[row.id],battery:ev.target.value}}))} className="w-14 h-7 text-xs px-2" /><span className="text-[10px] text-muted-foreground">%</span></div><MetricBar value={battery} color={battery >= 70 ? "bg-emerald-400" : "bg-red-400"} /></div> : <span className="text-xs text-muted-foreground">N/A</span>}
                  </TableCell>
                  <TableCell>
                    {row.storage_health !== null ? <div><div className="flex items-center gap-1"><Input type="number" min={0} max={100} value={e.storage_health ?? String(row.storage_health)} onChange={ev => setHealthEdits(p => ({...p,[row.id]:{...p[row.id],storage_health:ev.target.value}}))} className="w-14 h-7 text-xs px-2" /><span className="text-[10px] text-muted-foreground">%</span></div><MetricBar value={storage} color={storage >= 85 ? "bg-emerald-400" : "bg-amber-400"} /></div> : <span className="text-xs text-muted-foreground">N/A</span>}
                  </TableCell>
                  <TableCell>
                    {row.sensor_drift !== null ? <div><div className="flex items-center gap-1"><Input type="number" min={0} step={0.1} value={e.sensor_drift ?? String(row.sensor_drift)} onChange={ev => setHealthEdits(p => ({...p,[row.id]:{...p[row.id],sensor_drift:ev.target.value}}))} className="w-14 h-7 text-xs px-2" /><span className="text-[10px] text-muted-foreground">°</span></div><p className={cn("text-[10px] font-semibold", drift>2?"text-red-600":drift>1?"text-amber-600":"text-emerald-600")}>{drift<=1?"Nominal":drift<=2?"Monitor":"ALERT"}</p></div> : <span className="text-xs text-muted-foreground">N/A</span>}
                  </TableCell>
                  <TableCell><p className={cn("text-xs font-bold", uptime>=95?"text-emerald-700":uptime>=80?"text-amber-700":"text-red-700")}>{uptime}%</p><MetricBar value={uptime} color={uptime>=95?"bg-emerald-400":uptime>=80?"bg-amber-400":"bg-red-400"} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px]">{row.notes}</TableCell>
                  <TableCell><p className={cn("text-lg font-extrabold",score>=85?"text-emerald-700":score>=70?"text-amber-700":"text-red-700")}>{score}</p><p className="text-[10px] text-muted-foreground">/ 100</p></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
