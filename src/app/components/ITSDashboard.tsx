import { useState } from "react";
import { useBrowserOnly } from "@web/state/browserOnly";
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
import { useStaffAssets } from "@web/features/assets/useStaffAssets";
import { cn } from "@web/components/ui/utils";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus, Search, Download, CheckCircle, Clock, Package, DollarSign,
  ChevronRight, LayoutGrid, Table2, MapPin, Calendar, Tag, Wrench,
  BarChart3, Bell, AlertTriangle, Shield, QrCode, Printer, Zap, Eye,
  Image as ImageIcon, XCircle, Trash2, Pencil, Archive, ClipboardCheck, RefreshCw, Camera, Upload
} from "lucide-react";

const MINT = "#10B981";

const healthData: any[] = [];

function MetricBar({ value, color }: { value: number; color: string }) {
  return <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1 w-12"><div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, value)}%` }} /></div>;
}

export function ITSDashboard({ activeTab }: { activeTab: string }) {
  const { returns } = useBrowserOnly();
  const { displayedAssets } = useStaffAssets();

  // TSG specific states
  const [selectedQR, setSelectedQR] = useState<string[]>([]);
  const [healthEdits, setHealthEdits] = useState<Record<string, Record<string, string>>>({});
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(true);
  const [selectedReturnAsset, setSelectedReturnAsset] = useState<any | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  const pendingReturns = returns.filter(r => r.status === "Pending");

  const qrAssets = displayedAssets.filter(a => a.status !== "Disposed");

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
