/**
 * Staff Repairs: the active repair tickets by priority, and the completed ones.
 * Layer: page. Called by app/routes.tsx at /staff/repairs.
 * Calls: features/repairs/useRepairTickets.ts and RepairProgressDialog.tsx.
 * Used by: Staff repair handling.
 */
import { useState } from "react";
import { useRepairTickets } from "@web/features/repairs/useRepairTickets";
import { RepairProgressDialog } from "@web/features/repairs/RepairProgressDialog";
import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/badge";
import { Card } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { cn } from "@web/components/ui/utils";
import { CheckCircle, Clock, Wrench, AlertTriangle } from "lucide-react";

/**
 * Shows unacknowledged tickets first, then by priority, then newest. Acknowledge and Manage Request
 * save through useRepairTickets. Takes no props.
 */
export function RepairsPage() {
  const {
    dbRepairs, loadingDbRepairs, dbRepairsError,
    combinedRepairs, handleAcknowledgeRepair, handleUpdateRepairStatus,
  } = useRepairTickets();
  const [updatingTicket, setUpdatingTicket] = useState<any | null>(null);

  const unacknowledged = combinedRepairs.filter(r => !r.acknowledged);

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
