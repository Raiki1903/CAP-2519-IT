/**
 * Staff Overview: asset, repair, and return counts, quick links to the other tabs, campus totals, recent
 * registrations, the warranties notice, inspection progress, and the Operations Board at the bottom.
 * Layer: page. Called by app/routes.tsx at /staff/overview.
 * Calls: features/assets/useStaffAssets.ts, features/repairs/useRepairTickets.ts, features/returns/usePendingReturns.ts
 * (the Pending Returns count), features/assets/campusCounts.ts, state/session.tsx,
 * features/analytics/staff/StaffAnalyticsView.tsx (WarrantiesNoticeWidget, InspectionProgressTracker, OperationsBoard).
 * Used by: Staff.
 */
import { useNavigate } from "react-router";
import { roleToSlug, useSession } from "@web/state/session";
import { usePendingReturns } from "@web/features/returns/usePendingReturns";
import { useStaffAssets } from "@web/features/assets/useStaffAssets";
import { countAssetsByCampus } from "@web/features/assets/campusCounts";
import { useRepairTickets } from "@web/features/repairs/useRepairTickets";
import { WarrantiesNoticeWidget, InspectionProgressTracker, OperationsBoard } from "@web/features/analytics/staff/StaffAnalyticsView";
import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import { Separator } from "@web/components/ui/separator";
import { cn } from "@web/components/ui/utils";
import { Package, ChevronRight } from "lucide-react";

/** The Staff landing tab. Reads only; every action is a link to another tab. Takes no props. */
export function OverviewPage() {
  const navigate = useNavigate();
  const { currentUser } = useSession();
  // Only TSG registers and receives returns; the Secretary sees the same Overview without those links.
  const isTsg = currentUser?.staffUnit === "TSG";
  // The count is only the loans whose borrower asked to return; walk-ins on the Pending Returns page are not counted.
  const { requested: pendingReturns } = usePendingReturns();
  const { displayedAssets } = useStaffAssets();
  const { openTickets, pendingReceiptCount } = useRepairTickets();

  const overviewSlug = roleToSlug.Staff;

  // Assets in service per campus, from each asset's home lab: the same count as the Director Overview.
  const campusCounts = countAssetsByCampus(displayedAssets.filter(a => a.status !== "RETIRED"));
  const CAMPUS_BADGE_CLASSES = [
    "bg-emerald-50 text-emerald-700 border-emerald-200",
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-sky-50 text-sky-700 border-sky-200",
  ];

  const recentAssets = [...displayedAssets].slice(-3).reverse();

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h1 className="text-foreground text-2xl font-extrabold tracking-tight mb-1">Overview</h1>
        <p className="text-muted-foreground text-xs">Assets, repairs, and returns at a glance, with shortcuts.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border bg-card shadow-sm rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-3xl font-extrabold text-foreground font-mono">{displayedAssets.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Total Assets Registered</p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card shadow-sm rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className={cn("text-3xl font-extrabold font-mono", pendingReceiptCount > 0 ? "text-red-600 animate-pulse" : "text-foreground")}>
              {openTickets.length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Open Maintenance Tickets</p>
          </CardContent>
        </Card>
        <Card
          className={`border border-border bg-card shadow-sm rounded-xl ${isTsg ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}`}
          onClick={isTsg ? () => navigate(`/${overviewSlug}/loans`) : undefined}
        >
          <CardContent className="pt-4 pb-4">
            <p className="text-3xl font-extrabold text-foreground font-mono">{pendingReturns.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Pending Returns</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-2 border border-border bg-card shadow-sm rounded-xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-foreground">Shortcuts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {isTsg && <div className="flex items-center justify-between p-2.5 bg-muted/30 border border-border rounded-xl">
              <div>
                <p className="text-xs font-bold text-foreground">Register Asset</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Add newly acquired equipment to the inventory</p>
              </div>
              <Button size="sm" onClick={() => navigate(`/${overviewSlug}/register`)} className="gap-1 text-xs font-bold bg-[#005A36] text-white hover:bg-[#005A36]/90">
                Intake Wizard <ChevronRight size={13} />
              </Button>
            </div>}
            <div className="flex items-center justify-between p-2.5 bg-muted/30 border border-border rounded-xl">
              <div>
                <p className="text-xs font-bold text-foreground">Repairs</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Handle queued repair tickets and component servicing</p>
              </div>
              <Button size="sm" onClick={() => navigate(`/${overviewSlug}/repairs`)} className="gap-1 text-xs font-bold bg-[#005A36] text-white hover:bg-[#005A36]/90">
                Manage Repairs <ChevronRight size={13} />
              </Button>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-muted/30 border border-border rounded-xl">
              <div>
                <p className="text-xs font-bold text-foreground">Inspections</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Inspect assets and review custodian condition reports</p>
              </div>
              <Button size="sm" onClick={() => navigate(`/${overviewSlug}/inspections`)} className="gap-1 text-xs font-bold bg-[#005A36] text-white hover:bg-[#005A36]/90">
                Manage Inspections <ChevronRight size={13} />
              </Button>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-muted/30 border border-border rounded-xl">
              <div>
                <p className="text-xs font-bold text-foreground">QR Tags</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Pick assets and print their QR tags</p>
              </div>
              <Button size="sm" onClick={() => navigate(`/${overviewSlug}/qrtags`)} className="gap-1 text-xs font-bold bg-[#005A36] text-white hover:bg-[#005A36]/90">
                Generate Tags <ChevronRight size={13} />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-sm rounded-xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-foreground">Assets by Campus</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {campusCounts.map((c, i) => (
              <div key={c.campus} className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">{c.label} Campus</span>
                <Badge variant="outline" className={cn("font-mono font-bold", CAMPUS_BADGE_CLASSES[i])}>
                  {c.count} assets
                </Badge>
              </div>
            ))}
            <Separator />
            <div className="p-2.5 bg-muted/30 rounded-xl border border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Campus Registry</p>
              <p className="text-xs font-extrabold text-foreground mt-0.5">{displayedAssets.length} Hardware Assets Logged</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-[#005A36]" /> Recent Asset Registrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentAssets.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground italic bg-muted/10 rounded-xl">
              No assets logged in system.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {recentAssets.map(asset => (
                <div key={asset.id} className="p-2.5 bg-muted/20 border border-border rounded-xl flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-foreground block truncate">{asset.name} <span className="font-mono text-primary text-[11px]">({asset.id})</span></span>
                    <span className="text-[10px] text-muted-foreground block truncate">{asset.category} · {asset.location || asset.lab || "Unknown location"}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                    {asset.statusLabel || asset.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Moved here from Staff Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WarrantiesNoticeWidget />
        <InspectionProgressTracker />
      </div>

      <OperationsBoard />
    </div>
  );
}
