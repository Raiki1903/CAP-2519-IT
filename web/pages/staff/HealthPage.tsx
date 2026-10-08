/**
 * Staff Health: the Staff analytics view, and a benchmark grid for component health.
 * Layer: page. Called by app/routes.tsx at /its/health and /tsg/health.
 * Calls: features/analytics/staff/StaffAnalyticsView.tsx. The benchmark grid calls nothing.
 * Used by: Staff (ITS and TSG).
 */
import { useState } from "react";
import StaffAnalyticsView from "@web/features/analytics/staff/StaffAnalyticsView";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { cn } from "@web/components/ui/utils";
import { Wrench } from "lucide-react";

// TODO(H-09): the benchmark grid has no data source, so its table is always empty and its four summary figures are fixed text.
const healthData: any[] = [];

function MetricBar({ value, color }: { value: number; color: string }) {
  return <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1 w-12"><div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, value)}%` }} /></div>;
}

/** Switches between Advanced Analytics (the default, StaffAnalyticsView) and the benchmark grid. Takes no props. */
export function HealthPage() {
  const [healthEdits, setHealthEdits] = useState<Record<string, Record<string, string>>>({});
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(true);

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
        <StaffAnalyticsView />
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
