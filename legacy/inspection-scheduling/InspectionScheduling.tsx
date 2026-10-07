import { useState } from "react";
import { useSession } from "@web/state/session";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent } from "@web/components/ui/card";
import { Switch } from "@web/components/ui/switch";
import { Label } from "@web/components/ui/label";
import { cn } from "@web/components/ui/utils";
import { Calendar, CheckCircle, Eye, RefreshCw } from "lucide-react";

const labGroups = [
  { id: "A", name: "Group A", labs: ["CITe4D", "CAR", "CNIS"], color: "text-blue-600" },
  { id: "B", name: "Group B", labs: ["CeHCI", "CeLT", "TE3D"], color: "text-violet-600" },
  { id: "C", name: "Group C", labs: ["GAME", "Bio"], color: "text-amber-600" },
  { id: "D", name: "Group D", labs: ["CIVI", "HXIL"], color: "text-emerald-600" },
];

const maintenanceQueues: Record<string, { id: string; asset: string; serial: string; lab: string; lastInspected: string; status: string; urgency: string }[]> = {
  A: [],
  B: [],
  C: [],
  D: [],
};

export function InspectionScheduling({ setItemInspectedState }: { setItemInspectedState: (v: Record<string, boolean>) => void }) {
  const { cycleMode, setCycleMode } = useSession();
  const [isScheduled, setIsScheduled] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [groupDates, setGroupDates] = useState<Record<string, { start: string; end: string }>>({
    A: { start: "", end: "" },
    B: { start: "", end: "" },
    C: { start: "", end: "" },
    D: { start: "", end: "" }
  });
  const [groupResolved, setGroupResolved] = useState<Record<string, boolean>>({
    A: false, B: false, C: false, D: false
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {!isScheduled ? (
          <Button
            onClick={() => setShowScheduleModal(true)}
            className="bg-[#005A36] hover:bg-[#004225] text-white font-bold text-xs h-9 gap-1.5 shadow-sm"
          >
            <Calendar size={14} /> Schedule Inspection Cycle
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowScheduleModal(true)}
            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 font-bold text-xs h-9 gap-1.5"
          >
            <Eye size={14} /> View Schedule
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            if (confirm("Reset Inspection Queue?\n\nThis will reset the status of every asset across Groups A, B, C, and D to 'For Inspection' again for the next cycle.\n\nNote: All historical inspection records in the database will remain saved.")) {
              setIsScheduled(false);
              setGroupDates({ A: { start: "", end: "" }, B: { start: "", end: "" }, C: { start: "", end: "" }, D: { start: "", end: "" } });
              setGroupResolved({ A: false, B: false, C: false, D: false });
              setItemInspectedState({});
              alert("Inspection Queue reset successfully! All asset statuses set to 'For Inspection' again.");
            }
          }}
          className="border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs h-9 gap-1.5"
        >
          <RefreshCw size={13} /> Reset Inspection Queue
        </Button>
      </div>

      {/* Frequency toggle */}
      <Card className="mb-5">
        <CardContent className="pt-5 flex items-center justify-between">
          <div>
            <p className="font-bold text-foreground text-sm flex items-center gap-2">
              Inspection Frequency Engine
              {isScheduled && <Badge className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold">DISPATCHED &amp; ACTIVE</Badge>}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Active cycle: <strong className="text-primary">{cycleMode === "Annual" ? "Annual Cycle (once per year)" : "Trimestral Cycle (every trimester)"}</strong></p>
          </div>
          <div className="flex items-center gap-3">
            <Label className={cn("text-xs font-semibold", cycleMode === "Annual" ? "text-foreground" : "text-muted-foreground")}>Annual</Label>
            <Switch checked={cycleMode === "Trimestral"} onCheckedChange={c => setCycleMode(c ? "Trimestral" : "Annual")} className="data-[state=checked]:bg-primary" />
            <Label className={cn("text-xs font-semibold", cycleMode === "Trimestral" ? "text-foreground" : "text-muted-foreground")}>Trimestral</Label>
          </div>
        </CardContent>
      </Card>

      {/* Per group, in the header of each group's inspection queue card */}
      {labGroups.map(g => (
        <div key={g.id}>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={cn("text-[9px] font-extrabold", groupResolved[g.id] ? "bg-emerald-100 text-emerald-800 border-emerald-300" : isScheduled ? "bg-blue-100 text-blue-800 border-blue-300" : "bg-amber-100 text-amber-800 border-amber-300")}>
              {groupResolved[g.id] ? "RESOLVED / COMPLETED" : isScheduled ? `SCHEDULED: ${groupDates[g.id]?.start || "TBD"} - ${groupDates[g.id]?.end || "TBD"}` : "UNSCHEDULED / PENDING"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {!groupResolved[g.id] ? (
              <Button
                size="sm"
                onClick={() => {
                  setGroupResolved(prev => ({ ...prev, [g.id]: true }));
                  alert(`Group ${g.id} (${g.labs.join(", ")}) inspections marked RESOLVED / COMPLETED.`);
                }}
                className="bg-[#005A36] hover:bg-[#004225] text-white text-xs font-bold h-8 gap-1.5"
              >
                <CheckCircle size={13} /> Mark Group Completed
              </Button>
            ) : (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2.5 py-1 flex items-center gap-1 font-bold">
                <CheckCircle size={12} /> Cycle Finalized
              </Badge>
            )}
          </div>
        </div>
      ))}

      {/* Inspection Details Dialog */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">
              {isScheduled ? "Inspection Schedule Configuration (Active)" : "Schedule Inspection Window Cycle"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define specific start and end dates for each lab group inspection window ({cycleMode} Cycle).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-3">
            {labGroups.map(g => (
              <div key={g.id} className="p-3 bg-muted/20 border border-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Group {g.id} ({g.labs.join(", ")})</span>
                  <Badge className={cn("text-[9px]", g.color.replace("text-", "bg-") + "/10 " + g.color)}>
                    {g.assets} Assets
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Start Date</Label>
                    <Input
                      type="date"
                      value={groupDates[g.id]?.start || ""}
                      onChange={e => setGroupDates(prev => ({ ...prev, [g.id]: { ...prev[g.id], start: e.target.value } }))}
                      className="text-xs mt-1 h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">End Date</Label>
                    <Input
                      type="date"
                      value={groupDates[g.id]?.end || ""}
                      onChange={e => setGroupDates(prev => ({ ...prev, [g.id]: { ...prev[g.id], end: e.target.value } }))}
                      className="text-xs mt-1 h-8"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowScheduleModal(false)}>Close</Button>
            <Button
              size="sm"
              className="bg-[#005A36] hover:bg-[#004225] text-white font-bold text-xs"
              onClick={() => {
                if (confirm("Finalize & Dispatch Inspection Schedule?\n\nThis will lock the inspection window dates for Groups A, B, C, and D, and send automated system notification alerts to all designated laboratory custodians.")) {
                  setIsScheduled(true);
                  setShowScheduleModal(false);
                  alert("Inspection Schedule dispatched successfully! Interface state transitioned to 'View Schedule'. Notifications sent to all Lab Custodians.");
                }
              }}
            >
              Dispatch Schedule to Custodians
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
