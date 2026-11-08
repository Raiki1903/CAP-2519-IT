/**
 * Staff Repairs: the open maintenance tickets, with the steps TSG can make on each, and the closed ones.
 * Layer: page. Called by app/routes.tsx at /staff/repairs.
 * Calls: features/repairs/useRepairTickets.ts and RepairProgressDialog.tsx; state/session.tsx (only TSG makes the steps).
 * Used by: Staff repair handling.
 */
import { useState } from "react";
import type { Maintenance } from "@shared/types/maintenance";
import { useRepairTickets } from "@web/features/repairs/useRepairTickets";
import { RepairProgressDialog } from "@web/features/repairs/RepairProgressDialog";
import { useSession } from "@web/state/session";
import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/badge";
import { Card } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { cn } from "@web/components/ui/utils";
import { CheckCircle, Clock, Wrench } from "lucide-react";

/** The badge colors of each status. */
const STATUS_BADGE: Record<string, string> = {
  PENDING_RECEIPT: "bg-red-50 text-red-700 border-red-200",
  INSPECTING: "bg-amber-50 text-amber-700 border-amber-200",
  REPAIRING: "bg-amber-50 text-amber-700 border-amber-200",
  EXTERNAL_SERVICE: "bg-blue-50 text-blue-700 border-blue-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  BEYOND_REPAIR: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-slate-50 text-slate-500 border-slate-200",
};

/** A date-time as "Oct 9, 2026, 02:15 PM". */
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** The reporter's name, or "Not shown" for a Researcher who may not see it. */
const reporterName = (t: Maintenance) => ("hidden" in t.reportedBy ? "Not shown" : t.reportedBy.name);

/**
 * Lists the open tickets (waiting ones first) and the closed ones. A ticket opens in RepairProgressDialog, which has
 * the steps its status allows; a ticket waiting for receipt has a Receive button that opens the dialog on that step.
 * Takes no props.
 */
export function RepairsPage() {
  const { openTickets, closedTickets, pendingReceiptCount, loading, reload } = useRepairTickets();
  const { currentUser } = useSession();
  // The Secretary is on the Staff view too, but the server refuses her physical steps, so she only reads.
  const canAct = currentUser?.staffUnit === "TSG";
  const [selected, setSelected] = useState<{ ticket: Maintenance; mode: "view" | "receive" } | null>(null);

  const headers = (last: string) => ["Issue type", "Ticket ID", "Asset", "Reported by", "Reported at", "Status", last];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">Repairs</h1>
        <p className="text-muted-foreground text-sm">Track physical equipment component servicing and troubleshooting.</p>
        {loading && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5"><Clock size={11} className="animate-pulse" />Loading repair tickets…</p>
        )}
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Wrench size={18} className="text-red-500" />
          <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Open Repair Tickets</h3>
          {pendingReceiptCount > 0 && (
            <Badge className="bg-red-500 hover:bg-red-600 text-white font-extrabold text-[9px] px-2 py-0.5 tracking-wider">
              {pendingReceiptCount} WAITING FOR RECEIPT
            </Badge>
          )}
        </div>

        {openTickets.length > 0 ? (
          <Card className="overflow-hidden p-0 border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {headers("Actions").map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {openTickets.map(t => (
                  <TableRow key={t.maintenanceId} className={cn(t.status === "PENDING_RECEIPT" && "bg-orange-50/15")}>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-extrabold tracking-wider uppercase px-2 bg-amber-100 text-amber-700 border-amber-200">
                        {t.issueType?.name ?? t.typeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-xs font-mono">MNT-{t.maintenanceId}</TableCell>
                    <TableCell>
                      <p className="text-xs font-bold text-foreground">{t.asset.name}</p>
                      <span className="text-[10px] text-muted-foreground font-mono">{t.asset.tag}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">{reporterName(t)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{when(t.reportedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0", STATUS_BADGE[t.status])}>{t.statusLabel}</Badge>
                      {t.provider && <p className="text-[10px] text-muted-foreground mt-0.5">With {t.provider}</p>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {canAct && t.status === "PENDING_RECEIPT" && (
                          <Button size="sm" className="h-7 text-[10px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-2" onClick={() => setSelected({ ticket: t, mode: "receive" })}>
                            <CheckCircle size={10} className="mr-1" /> Receive
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold px-2" onClick={() => setSelected({ ticket: t, mode: "view" })}>
                          <Wrench size={10} className="mr-1" /> {canAct ? "Manage" : "View"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl">
            {loading ? "Loading repair tickets…" : "No open repair tickets."}
          </div>
        )}
      </div>

      <div className="mt-8 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle size={18} className="text-emerald-600" />
          <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Closed Tickets</h3>
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-extrabold text-[9px] px-2 py-0.5 tracking-wider border-emerald-200">
            {closedTickets.length} TICKETS ARCHIVED
          </Badge>
        </div>

        {closedTickets.length > 0 ? (
          <Card className="overflow-hidden p-0 border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {headers("Details").map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedTickets.map(t => (
                  <TableRow key={t.maintenanceId}>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-extrabold tracking-wider uppercase px-2 bg-slate-50 text-slate-500 border-slate-200">
                        {t.issueType?.name ?? t.typeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-xs font-mono">MNT-{t.maintenanceId}</TableCell>
                    <TableCell>
                      <p className="text-xs font-bold text-foreground">{t.asset.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{t.asset.tag}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">{reporterName(t)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{when(t.reportedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0", STATUS_BADGE[t.status])}>{t.statusLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold px-2" onClick={() => setSelected({ ticket: t, mode: "view" })}>
                        <Wrench size={10} className="mr-1" /> View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl">
            No closed tickets yet.
          </div>
        )}
      </div>

      {selected && (
        <RepairProgressDialog
          key={`${selected.ticket.maintenanceId}-${selected.mode}`}
          ticket={selected.ticket}
          canAct={canAct}
          startMode={selected.mode}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
