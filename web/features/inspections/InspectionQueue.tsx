/**
 * Inspection queue: the Available assets due for a routine inspection, from the server, grouped by lab group (A to D,
 * and Other for a lab in none), with a period picker and a button to inspect each asset and file a Routine inspection.
 * Layer: feature component. Called by pages/staff/InspectionsPage.tsx.
 * Calls: api/inspections.api.ts getRoutineQueue() and submitInspectionRaw(), features/inspections/InspectionFields.tsx,
 * state/serverData.tsx syncFromDb().
 * Used by: Staff single-item inspection.
 */
import { useCallback, useEffect, useState } from "react";
import { useServerData } from "@web/state/serverData";
import * as inspectionsApi from "@web/api/inspections.api";
import { EMPTY_INSPECTION, InspectionFields, toInspectionInput, type InspectionFieldsValue } from "@web/features/inspections/InspectionFields";
import { compressImage, ASSET_PHOTO_MAX_SIDE, PHOTO_UNREADABLE_MESSAGE } from "@web/features/images/compressImage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import { Label } from "@web/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@web/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { DEFAULT_ROUTINE_PERIOD_DAYS, OTHER_INSPECTION_GROUP_ID, ROUTINE_PERIOD_OPTIONS } from "@shared/constants/inspectionGroups";
import type { RoutineQueueEntry, RoutineQueueGroup } from "@shared/types/inspections";
import { cn } from "@web/components/ui/utils";
import { ClipboardCheck, Camera, Upload } from "lucide-react";

// The dot colour of each group's tab. The groups themselves are in shared/constants/inspectionGroups.ts.
const GROUP_COLORS: Record<string, string> = {
  A: "text-blue-600",
  B: "text-violet-600",
  C: "text-amber-600",
  D: "text-emerald-600",
  [OTHER_INSPECTION_GROUP_ID]: "text-slate-500",
};

/** A date-time as "Oct 9, 2026". */
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * Shows the period picker, one tab per lab group with the assets the server says are due, and the dialog that files one
 * asset's Routine inspection. Submitting posts the inspection through inspectionsApi.submitInspectionRaw(), then reloads
 * the queue (the asset leaves it, because TSG just inspected it) and calls onReportSaved.
 *
 * @param onReportSaved reloads the page's inspection log after a successful post
 */
export function InspectionQueue({ onReportSaved }: { onReportSaved: () => Promise<void> }) {
  const { syncFromDb } = useServerData();
  const [days, setDays] = useState<number>(DEFAULT_ROUTINE_PERIOD_DAYS);
  const [groups, setGroups] = useState<RoutineQueueGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState("A");
  const [selected, setSelected] = useState<RoutineQueueEntry | null>(null);
  const [inspection, setInspection] = useState<InspectionFieldsValue>(EMPTY_INSPECTION);
  const [photo, setPhoto] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadQueue = useCallback(async () => {
    try {
      const data = await inspectionsApi.getRoutineQueue(days);
      if (data.success && Array.isArray(data.groups)) {
        setGroups(data.groups);
        setLoadError(null);
      } else {
        setLoadError(data.error || "The inspection queue could not be loaded.");
      }
    } catch (e) {
      console.error("Failed to load the routine queue:", e);
      setLoadError("The inspection queue could not be loaded: the server could not be reached.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    setLoading(true);
    loadQueue();
  }, [loadQueue]);

  // A lab in none of the four groups gets its own "Other" tab, only when it has assets due, so they are not hidden.
  const shownGroups = groups.filter(g => g.group !== OTHER_INSPECTION_GROUP_ID || g.assets.length > 0);

  const openDialog = (entry: RoutineQueueEntry) => {
    setSelected(entry);
    setInspection(EMPTY_INSPECTION);
    setPhoto("");
    setSubmitError(null);
  };

  const submit = async () => {
    if (!selected || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      let res: Response;
      try {
        res = await inspectionsApi.submitInspectionRaw(selected.asset.tag, { ...toInspectionInput(inspection), photo: photo || null });
      } catch (e) {
        console.error("Failed to file the routine inspection:", e);
        setSubmitError("The inspection could not be saved: the server could not be reached. Please try again.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        // The dialog stays open, so the inspector sees why and can cancel.
        setSubmitError(body?.error || "The inspection could not be saved. Please try again.");
        return;
      }
      const name = selected.asset.name;
      setSelected(null);
      await loadQueue();
      await onReportSaved();
      syncFromDb();
      alert(`Inspection saved for ${name}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Label className="text-xs font-bold text-foreground">Not inspected in the last</Label>
        <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
          <SelectTrigger className="h-9 w-36 text-xs" aria-label="Inspection period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROUTINE_PERIOD_OPTIONS.map(d => <SelectItem key={d} value={String(d)}>{d} days</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">Only Available assets are listed. An asset that is out, in repair, missing or retired is left out.</p>
      </div>

      {loadError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{loadError}</div>}

      {loading && groups.length === 0 ? (
        <Card className="p-6 text-center text-xs text-muted-foreground mb-8">Loading the inspection queue...</Card>
      ) : (
        <Tabs value={activeGroup} onValueChange={setActiveGroup}>
          <TabsList className="mb-4 h-auto gap-1 bg-muted/40">
            {shownGroups.map(g => (
              <TabsTrigger key={g.group} value={g.group} className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                <span className={cn("w-2 h-2 rounded-full", GROUP_COLORS[g.group].replace("text-", "bg-"))} />
                {g.name}
                {g.assets.length > 0 && <Badge className="text-[9px] bg-red-100 text-red-700 border-red-200 ml-0.5">{g.assets.length}</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>

          {shownGroups.map(g => (
            <TabsContent key={g.group} value={g.group}>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[{ val: String(g.assets.length), label: "Due for inspection" }, { val: g.labs.join(", ") || "None", label: "Labs" }].map(({ val, label }) => (
                  <Card key={label}><CardContent className="pt-4 pb-4"><p className="text-xl font-extrabold text-foreground">{val}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>
                ))}
              </div>
              <Card className="overflow-hidden p-0 mb-8">
                <CardHeader className="px-5 py-4 flex-row items-center justify-between space-y-0 border-b border-border">
                  <CardTitle className="text-sm">Inspection Queue: {g.name} ({g.labs.join(", ") || "no labs"})</CardTitle>
                </CardHeader>
                {g.assets.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        {["Asset", "Lab", "Last Inspected by TSG", "Condition", "Action"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.assets.map(entry => (
                        <TableRow key={entry.asset.tag}>
                          <TableCell>
                            <p className="text-xs font-semibold text-foreground">{entry.asset.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{entry.asset.tag}</p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{entry.asset.homeLab.code}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{entry.lastTsgInspectionAt ? shortDate(entry.lastTsgInspectionAt) : "Never"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{entry.asset.conditionLabel ?? "Not inspected"}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => openDialog(entry)}
                              className="bg-[#005A36] hover:bg-[#004225] text-white font-bold text-[10px] h-7 px-2.5 gap-1 shadow-sm"
                            >
                              <ClipboardCheck size={11} /> Inspect / Log Report
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-6 text-center text-xs text-muted-foreground bg-muted/10">
                    No Available asset in {g.name} is due for an inspection within {days} days.
                  </div>
                )}
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Log Routine Inspection Dialog for one queue item */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && !isSubmitting && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <ClipboardCheck className="text-[#005A36]" size={16} /> Log Routine Inspection
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Record the condition you found for {selected.asset.name} ({selected.asset.tag}). It becomes the asset's condition.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 my-2">
              <InspectionFields value={inspection} onChange={setInspection} heading="Condition Rating" />

              <div>
                <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Camera size={13} className="text-[#005A36]" /> Inspection Photo Evidence / Proof (Optional)
                </Label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    id="inspection-img-input"
                    className="hidden"
                    onChange={async (e) => {
                      const input = e.target;
                      const file = input.files?.[0];
                      if (!file) return;
                      setSubmitError(null);
                      try {
                        setPhoto(await compressImage(file, ASSET_PHOTO_MAX_SIDE));
                      } catch {
                        setSubmitError(PHOTO_UNREADABLE_MESSAGE);
                        input.value = "";
                      }
                    }}
                  />
                  <label
                    htmlFor="inspection-img-input"
                    className="px-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer hover:bg-slate-100 flex items-center gap-1.5"
                  >
                    <Upload size={13} /> {photo ? "Change Photo Proof" : "Upload Inspection Photo"}
                  </label>
                  {photo && (
                    <div className="flex items-center gap-2">
                      <img src={photo} alt="Inspection Proof" className="w-8 h-8 object-cover rounded border border-slate-300" />
                      <button
                        type="button"
                        onClick={() => setPhoto("")}
                        className="text-[10px] text-red-600 hover:underline font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {submitError && <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-700">{submitError}</p>}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" disabled={isSubmitting} onClick={() => setSelected(null)}>Cancel</Button>
              <Button
                size="sm"
                disabled={isSubmitting}
                className="bg-[#005A36] hover:bg-[#004225] text-white font-bold text-xs"
                onClick={submit}
              >
                {isSubmitting ? "Submitting..." : "Submit & Finalize Inspection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
