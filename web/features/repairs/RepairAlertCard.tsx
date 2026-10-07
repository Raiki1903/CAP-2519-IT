/**
 * Repair alert card: a large, pulsing card for one high-priority repair ticket.
 * Layer: feature component. Called by nothing: no page renders it today.
 * Calls nothing itself: acknowledging goes through the onAcknowledge prop.
 * Used by: no one yet (it would serve Staff repair handling).
 */
import { useState } from "react";
import type { RepairRequest } from "@web/state/serverData";
import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/badge";
import { cn } from "@web/components/ui/utils";
import { CheckCircle, Eye, Image as ImageIcon, Zap } from "lucide-react";

/**
 * Shows a ticket's asset, reporter, status, and description, with Acknowledge and a toggle for the
 * full report. Not rendered anywhere today: no page includes it.
 *
 * @param req the repair ticket
 * @param onAcknowledge called with the ticket id when Staff acknowledge it
 */
export function RepairAlertCard({ req, onAcknowledge }: { req: RepairRequest; onAcknowledge: (id: string) => void }) {
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
            <p className="text-sm font-bold text-foreground mb-0.5">{req.assetName}</p>
            <p className="text-xs text-muted-foreground mb-1">{req.assetId} · {req.submittedAt} · <strong className={isCritical ? "text-red-700" : "text-orange-700"}>{req.statusLabel}</strong></p>
            <p className="text-xs text-foreground italic leading-relaxed">"{req.description.slice(0, 100)}{req.description.length > 100 ? "…" : ""}"</p>
            <div className="flex flex-wrap items-center justify-between mt-1 gap-2 border-t pt-1.5 border-dashed border-muted-foreground/20">
              <span className="text-[11px] text-muted-foreground">Submitted by: {req.custodian}</span>
              {req.forwardedTo && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Dispatched To:</span>
                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-bold", req.forwardedTo === "ITS" ? "bg-blue-50 text-blue-700 border-blue-200" : req.forwardedTo === "TSG" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-purple-50 text-purple-700 border-purple-200")}>
                    {req.forwardedTo === "ITS" ? "ITS" : req.forwardedTo === "TSG" ? "TSG" : "TSG & ITS"}
                  </Badge>
                </div>
              )}
            </div>
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
