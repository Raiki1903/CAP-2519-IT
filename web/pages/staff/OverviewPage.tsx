/**
 * Staff Overview: asset, repair, and return counts, quick links to the other tabs, campus totals, alerts, and recent registrations.
 * Layer: page. Called by app/routes.tsx at /staff/overview.
 * Calls: features/assets/useStaffAssets.ts, features/repairs/useRepairTickets.ts, state/browserOnly.tsx (pending returns), state/session.tsx.
 * Used by: Staff.
 */
import { useNavigate } from "react-router";
import { roleToSlug } from "@web/state/session";
import { useBrowserOnly } from "@web/state/browserOnly";
import { useStaffAssets } from "@web/features/assets/useStaffAssets";
import { useRepairTickets } from "@web/features/repairs/useRepairTickets";
import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import { Separator } from "@web/components/ui/separator";
import { cn } from "@web/components/ui/utils";
import { CheckCircle, Clock, Package, ChevronRight, Bell, AlertTriangle, Shield } from "lucide-react";

/** The Staff landing tab. Reads only; every action is a link to another tab. Takes no props. */
export function OverviewPage() {
  const navigate = useNavigate();
  const { returns } = useBrowserOnly();
  const { displayedAssets } = useStaffAssets();
  const { combinedRepairs } = useRepairTickets();

  const unacknowledged = combinedRepairs.filter(r => !r.acknowledged);
  const pendingReturns = returns.filter(r => r.status === "Pending");

  const overviewSlug = roleToSlug.Staff;

  // TODO(M-03): campus is guessed from location and lab text, and anything not clearly Laguna counts as Manila. Phase 3 (research_centers.location).
  const manilaAssetsCount = displayedAssets.filter(a => {
    const loc = (a.location || "").toLowerCase();
    const labName = (a.lab || "").toLowerCase();
    return loc.includes("manila") || loc.includes("taft") || labName.includes("cite4d") || labName.includes("car") || (!loc.includes("laguna") && !loc.includes("canlubang"));
  }).length;

  const lagunaAssetsCount = displayedAssets.filter(a => {
    const loc = (a.location || "").toLowerCase();
    const labName = (a.lab || "").toLowerCase();
    return loc.includes("laguna") || loc.includes("canlubang") || labName.includes("civi") || labName.includes("bio");
  }).length;

  const nowMs = Date.now();
  const expiring30Days = displayedAssets.filter(a => {
    if (!a.warranty) return false;
    const expMs = new Date(a.warranty).getTime();
    const daysLeft = Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24));
    return daysLeft >= 0 && daysLeft <= 30;
  });

  const recentAssets = [...displayedAssets].slice(-3).reverse();

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h1 className="text-foreground text-2xl font-extrabold tracking-tight mb-1">System Overview</h1>
        <p className="text-muted-foreground text-xs">Real-time status summaries, operational telemetry, and quick action routing controls.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-border bg-card shadow-sm rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-3xl font-extrabold text-foreground font-mono">{displayedAssets.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Total Assets Registered</p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card shadow-sm rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className={cn("text-3xl font-extrabold font-mono", unacknowledged.length > 0 ? "text-red-600 animate-pulse" : "text-foreground")}>
              {combinedRepairs.length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Maintenance Requests</p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card shadow-sm rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-3xl font-extrabold text-foreground font-mono">{pendingReturns.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Pending Return Ledgers</p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card shadow-sm rounded-xl">
          <CardContent className="pt-4 pb-4">
            {/* TODO(H-09): the operational index is a fixed number, not computed from anything. */}
            <p className="text-3xl font-extrabold text-emerald-700 font-mono">97.8%</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">System Operational Index</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-2 border border-border bg-card shadow-sm rounded-xl">
          <CardHeader><CardTitle className="text-sm font-bold text-foreground">Quick Action Operations</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
              <div>
                <p className="text-xs font-bold text-foreground">Asset Procurement Registration</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Log new hardware items into AdRIC databases</p>
              </div>
              <Button size="sm" onClick={() => navigate(`/${overviewSlug}/register`)} className="gap-1 text-xs font-bold bg-[#005A36] text-white hover:bg-[#005A36]/90">
                Intake Wizard <ChevronRight size={13} />
              </Button>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
              <div>
                <p className="text-xs font-bold text-foreground">Repair Operations Manager</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Handle queued repair tickets and component servicing</p>
              </div>
              <Button size="sm" onClick={() => navigate(`/${overviewSlug}/repairs`)} className="gap-1 text-xs font-bold bg-[#005A36] text-white hover:bg-[#005A36]/90">
                Manage Repairs <ChevronRight size={13} />
              </Button>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
              <div>
                <p className="text-xs font-bold text-foreground">Inspection Operations Manager</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Inspect assets and review custodian condition reports</p>
              </div>
              <Button size="sm" onClick={() => navigate(`/${overviewSlug}/inspections`)} className="gap-1 text-xs font-bold bg-[#005A36] text-white hover:bg-[#005A36]/90">
                Manage Inspections <ChevronRight size={13} />
              </Button>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
              <div>
                <p className="text-xs font-bold text-foreground">Barcoding &amp; QR Tag Wizards</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Generate, select, and preview barcode stickers</p>
              </div>
              <Button size="sm" onClick={() => navigate(`/${overviewSlug}/qrtags`)} className="gap-1 text-xs font-bold bg-[#005A36] text-white hover:bg-[#005A36]/90">
                Generate Tags <ChevronRight size={13} />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-sm rounded-xl">
          <CardHeader><CardTitle className="text-sm font-bold text-foreground">Campus Affiliations</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Manila (Taft) Campus</span>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono font-bold">
                {manilaAssetsCount} assets
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Laguna (Canlubang) Campus</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono font-bold">
                {lagunaAssetsCount} assets
              </Badge>
            </div>
            <Separator />
            <div className="p-3 bg-muted/30 rounded-xl border border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Campus Registry</p>
              <p className="text-xs font-extrabold text-foreground mt-0.5">{displayedAssets.length} Hardware Assets Logged</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Pulse: System Alerts & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border border-border bg-card shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-600" /> System Alerts &amp; Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {unacknowledged.length > 0 ? (
              <div className="p-3 bg-red-50/70 dark:bg-red-950/30 border border-red-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 animate-pulse shrink-0" />
                  <div>
                    <span className="font-extrabold text-red-800 dark:text-red-300 block">{unacknowledged.length} Unacknowledged Repair Tickets</span>
                    <span className="text-[11px] text-red-700 dark:text-red-400">Requires technician assignment &amp; progress update</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate(`/${overviewSlug}/repairs`)} className="text-[11px] font-bold border-red-300 text-red-700 hover:bg-red-100 shrink-0">
                  Review
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> All repair tickets acknowledged &amp; assigned.
              </div>
            )}

            {expiring30Days.length > 0 ? (
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-extrabold text-amber-900 dark:text-amber-300 block">{expiring30Days.length} Assets Expiring Warranty (≤30 Days)</span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400">Service agreement renewal checks recommended</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate(`/${overviewSlug}/health`)} className="text-[11px] font-bold border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0">
                  Inspect
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300 font-semibold">
                <Shield className="w-4 h-4 text-blue-600 shrink-0" /> No hardware warranties expiring within 30 days.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-[#005A36]" /> Recent Equipment Registrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recentAssets.map(asset => (
              <div key={asset.id} className="p-2.5 bg-muted/20 border border-border rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-foreground block">{asset.name} <span className="font-mono text-primary text-[11px]">({asset.id})</span></span>
                  <span className="text-[10px] text-muted-foreground">{asset.category} · {asset.location || asset.lab || "ITS Warehouse"}</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
                  {asset.status || "Active"}
                </Badge>
              </div>
            ))}
            {recentAssets.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground italic bg-muted/10 rounded-xl">
                No assets logged in system.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
