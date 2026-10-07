/**
 * Inspection queue: assets grouped by lab group (A to D), each with a button to inspect it and file a condition report.
 * Layer: feature component. Called by pages/staff/InspectionsPage.tsx.
 * Calls: api/inspections.api.ts submitInspectionRaw(), state/serverData.tsx syncFromDb(), state/session.tsx (the signed-in user).
 * Used by: Staff (ITS and TSG) single-item inspection.
 */
import { useState } from "react";
import { useSession } from "@web/state/session";
import { useServerData } from "@web/state/serverData";
import * as inspectionsApi from "@web/api/inspections.api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import { Label } from "@web/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@web/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { cn } from "@web/components/ui/utils";
import { CheckCircle, ClipboardCheck, Camera, Upload } from "lucide-react";

// TODO(M-03): the lab groups are another hardcoded lab list, separate from research_centers. Phase 3.
// TSG Specific Constants - 10 DB Research Centers evenly distributed across 4 groups
const labGroups = [
  { id: "A", name: "Group A", labs: ["CITe4D", "CAR", "CNIS"], color: "text-blue-600" },
  { id: "B", name: "Group B", labs: ["CeHCI", "CeLT", "TE3D"], color: "text-violet-600" },
  { id: "C", name: "Group C", labs: ["GAME", "Bio"], color: "text-amber-600" },
  { id: "D", name: "Group D", labs: ["CIVI", "HXIL"], color: "text-emerald-600" },
];

const statusBadge: Record<string, string> = {
  Inspected: "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold",
  "For Inspection": "bg-amber-50 text-amber-800 border-amber-300 font-bold",
  "Due Soon": "bg-amber-50 text-amber-700 border-amber-200",
  Overdue: "bg-red-50 text-red-700 border-red-200",
};

const urgencyBadge: Record<string, string> = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Normal: "bg-blue-50   text-blue-700   border-blue-200",
  High: "bg-amber-50  text-amber-700  border-amber-200",
  Critical: "bg-red-50    text-red-700    border-red-200",
};

/**
 * Shows one tab per lab group with its assets, and the dialog that finalizes one asset's inspection.
 * Submitting posts the report through inspectionsApi.submitInspectionRaw(), then calls onReportSaved.
 * The row then shows "Inspected" until the page is left: that badge is not stored anywhere (H-18).
 *
 * @param displayedAssets the Staff asset list (useStaffAssets)
 * @param onReportSaved reloads the page's assets and reports after a successful post
 */
export function InspectionQueue({ displayedAssets, onReportSaved }: { displayedAssets: any[]; onReportSaved: () => Promise<void> }) {
  const { currentUser } = useSession();
  const { syncFromDb } = useServerData();
  const [activeGroup, setActiveGroup] = useState("A");
  const [itemInspectedState, setItemInspectedState] = useState<Record<string, boolean>>({});
  const [selectedQueueItem, setSelectedQueueItem] = useState<any | null>(null);
  const [inspectionStatusOption, setInspectionStatusOption] = useState<string>("Operational");
  const [inspectionNotesOption, setInspectionNotesOption] = useState<string>("");
  const [inspectorRoleOption, setInspectorRoleOption] = useState<string>("TSG Staff");
  const [tsgRemarksOption, setTsgRemarksOption] = useState<string>("");
  const [itsRemarksOption, setItsRemarksOption] = useState<string>("");
  const [inspectionImgOption, setInspectionImgOption] = useState<string>("");

  return (
    <>
      {/* Group tabs using shadcn Tabs */}
      {(() => {
        const allKnownLabs = ["CITe4D", "CAR", "CeHCI", "CeLT", "CNIS", "GAME", "Bio", "CIVI", "TE3D", "HXIL"];

        const matchesLab = (assetLab: string | undefined, groupLabs: string[]) => {
          if (!assetLab) return false;
          const labStr = assetLab.trim().toLowerCase();
          return groupLabs.some(l => {
            const lLower = l.toLowerCase();
            return labStr === lLower || labStr.includes(lLower) || (lLower === "bio" && labStr.includes("bioinformatics")) || (lLower === "game" && labStr.includes("game"));
          });
        };

        const getGroupAssets = (groupId: string, labs: string[]) => {
          return displayedAssets.filter(a => {
            if (matchesLab(a.lab, labs)) return true;
            // An asset whose lab matches no known lab, or has none, is listed under Group A so it is not lost.
            if (groupId === "A" && (!a.lab || !allKnownLabs.some(kl => matchesLab(a.lab, [kl])))) {
              return true;
            }
            return false;
          });
        };

        const dynamicGroups = labGroups.map(g => {
          const gAssets = getGroupAssets(g.id, g.labs);
          const due = gAssets.filter(a => a.status === "Maintenance" || a.status === "Overdue" || (a.condition !== undefined && a.condition < 80)).length;
          return { ...g, assets: gAssets.length, due };
        });

        return (
          <Tabs value={activeGroup} onValueChange={setActiveGroup}>
            <TabsList className="mb-4 h-auto gap-1 bg-muted/40">
              {dynamicGroups.map(g => (
                <TabsTrigger key={g.id} value={g.id} className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                  <span className={cn("w-2 h-2 rounded-full", g.color.replace("text-", "bg-"))} />
                  {g.name}
                  {g.due > 0 && <Badge className="text-[9px] bg-red-100 text-red-700 border-red-200 ml-0.5">{g.due}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>

            {dynamicGroups.map(g => {
              const groupAssets = getGroupAssets(g.id, g.labs);
              const queueItems = groupAssets.map(a => {
                const isInspected = itemInspectedState[a.id] === true;
                const status = isInspected ? "Inspected" : "For Inspection";
                // `condition` is the server's 0 to 100 score derived from the condition enum.
                const urgency = a.status === "Maintenance" || a.status === "Overdue" ? "Critical" : (a.condition !== undefined && a.condition < 80 ? "High" : "Normal");

                return {
                  id: `MNT-${String(a.id).replace(/^[^\d]+/, "").padStart(4, "0")}`,
                  asset: a.name,
                  serial: a.serial || a.id,
                  lab: a.lab || g.labs[0] || "CITe4D",
                  // TODO(F-28): "Last Inspected" shows the procurement date, or a made-up date, not the newest report. Phase 3.
                  lastInspected: a.procured || "Jan 15, 2024",
                  status,
                  urgency,
                  rawAsset: a
                };
              });

              return (
                <TabsContent key={g.id} value={g.id}>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[{ val: String(g.assets), label: "Total Assets" }, { val: String(g.due), label: "Due / Overdue" }, { val: g.labs.join(", "), label: "Labs" }].map(({ val, label }) => (
                      <Card key={label}><CardContent className="pt-4 pb-4"><p className="text-xl font-extrabold text-foreground">{val}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>
                    ))}
                  </div>
                  <Card className="overflow-hidden p-0 mb-8">
                    <CardHeader className="px-5 py-4 flex-row items-center justify-between space-y-0 border-b border-border">
                      <div>
                        <CardTitle className="text-sm">Inspection Queue — Group {g.id} ({g.labs.join(", ")})</CardTitle>
                      </div>
                    </CardHeader>
                    {queueItems.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            {["Ticket ID", "Asset", "Lab", "Last Inspected", "Status", "Urgency", "Action"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {queueItems.map(item => (
                            <TableRow key={item.id} className="transition-colors hover:bg-muted/10">
                              <TableCell className="font-bold text-primary text-xs font-mono">{item.id}</TableCell>
                              <TableCell><p className="text-xs font-semibold text-foreground">{item.asset}</p><p className="text-[10px] text-muted-foreground font-mono">{item.serial}</p></TableCell>
                              <TableCell className="text-xs text-muted-foreground">{item.lab}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{item.lastInspected}</TableCell>
                              <TableCell><Badge className={cn("text-[10px]", statusBadge[item.status])}>{item.status}</Badge></TableCell>
                              <TableCell><Badge className={cn("text-[10px]", urgencyBadge[item.urgency])}>{item.urgency}</Badge></TableCell>
                              <TableCell>
                                {item.status === "Inspected" ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold gap-1">
                                    <CheckCircle size={11} /> Inspected
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedQueueItem(item);
                                      setInspectionStatusOption("Operational");
                                      setInspectionNotesOption("");
                                    }}
                                    className="bg-[#005A36] hover:bg-[#004225] text-white font-bold text-[10px] h-7 px-2.5 gap-1 shadow-sm"
                                  >
                                    <ClipboardCheck size={11} /> Inspect / Log Report
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="p-6 text-center text-xs text-muted-foreground bg-muted/10">
                        No registered equipment currently assigned to Group {g.id} ({g.labs.join(", ")}).
                      </div>
                    )}
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        );
      })()}

      {/* Log Inspection Report Dialog for Queue Item */}
      <Dialog open={!!selectedQueueItem} onOpenChange={(open) => !open && setSelectedQueueItem(null)}>
        {selectedQueueItem && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <ClipboardCheck className="text-[#005A36]" size={16} /> Log Asset Inspection Report
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Record technical inspection details, condition ratings, and role remarks for {selectedQueueItem.asset} ({selectedQueueItem.rawAsset?.id || selectedQueueItem.id}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 my-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  {/* The role picked here is not sent to the server: the report records the signed-in account. Logged in 02-restructure-log.md, notes. */}
                  <Label className="text-xs font-bold text-foreground">Inspector Role</Label>
                  <Select value={inspectorRoleOption} onValueChange={setInspectorRoleOption}>
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TSG Staff">TSG Staff (Technical Operations)</SelectItem>
                      <SelectItem value="ITS Staff">ITS Staff (Central Asset Admin)</SelectItem>
                      <SelectItem value="Lab Head">Lab Head / Approver</SelectItem>
                      <SelectItem value="Custodian">Custodian Auditor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold text-foreground">Condition Rating</Label>
                  <Select value={inspectionStatusOption} onValueChange={setInspectionStatusOption}>
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Perfect">Perfect (Brand New / 100%)</SelectItem>
                      <SelectItem value="Operational">Operational (Standard Wear / 90%)</SelectItem>
                      <SelectItem value="Minor Drift">Minor Drift (Functional / 78%)</SelectItem>
                      <SelectItem value="Degraded Performance">Degraded Performance (Needs Service / 60%)</SelectItem>
                      <SelectItem value="Critical Defect">Critical Defect (Non-Functional / 35%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground">TSG Technical &amp; Hardware Remarks</Label>
                <textarea
                  value={tsgRemarksOption}
                  onChange={(e) => setTsgRemarksOption(e.target.value)}
                  placeholder="Enter physical hardware metrics, component diagnostics, fan noise, thermal readings, or maintenance notes..."
                  rows={2}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1 resize-none"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground">ITS Governance &amp; Compliance Remarks</Label>
                <textarea
                  value={itsRemarksOption}
                  onChange={(e) => setItsRemarksOption(e.target.value)}
                  placeholder="Enter asset tag verification, warranty claim status, software license check, or audit compliance notes..."
                  rows={2}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1 resize-none"
                />
              </div>

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
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setInspectionImgOption(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label
                    htmlFor="inspection-img-input"
                    className="px-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer hover:bg-slate-100 flex items-center gap-1.5"
                  >
                    <Upload size={13} /> {inspectionImgOption ? "Change Photo Proof" : "Upload Inspection Photo"}
                  </label>
                  {inspectionImgOption && (
                    <div className="flex items-center gap-2">
                      <img src={inspectionImgOption} alt="Inspection Proof" className="w-8 h-8 object-cover rounded border border-slate-300" />
                      <button
                        type="button"
                        onClick={() => setInspectionImgOption("")}
                        className="text-[10px] text-red-600 hover:underline font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedQueueItem(null)}>Cancel</Button>
              <Button
                size="sm"
                className="bg-[#005A36] hover:bg-[#004225] text-white font-bold text-xs"
                onClick={async () => {
                  const fullNotes = [
                    tsgRemarksOption ? `[TSG Remarks]: ${tsgRemarksOption}` : "",
                    itsRemarksOption ? `[ITS Remarks]: ${itsRemarksOption}` : "",
                    inspectionNotesOption ? `[Notes]: ${inspectionNotesOption}` : ""
                  ].filter(Boolean).join(" | ") || "Routine periodic physical inspection verified.";

                  await syncFromDb();

                  // Save report under asset_reports table in MySQL database
                  if (selectedQueueItem.rawAsset?.id || selectedQueueItem.id) {
                    try {
                      const conditionEnumMap: Record<string, string> = {
                        "Perfect": "PERFECT",
                        "Operational": "OPERATIONAL",
                        "Minor Drift": "MINOR_DRIFT",
                        "Degraded Performance": "DEGRADED",
                        "Critical Defect": "CRITICAL_DEFECT",
                      };
                      const targetTag = selectedQueueItem.rawAsset?.id || selectedQueueItem.id;
                      await inspectionsApi.submitInspectionRaw(targetTag, {
                        reporterEmail: currentUser?.email,
                        // TODO(H-13): the session user has userId, not user_id, so this is always undefined. The server uses the email first, so it matters only without one. Own fix branch.
                        reportedById: currentUser?.user_id,
                        reportCondition: conditionEnumMap[inspectionStatusOption] || "PERFECT",
                        reportRemarks: fullNotes,
                        reportImg: inspectionImgOption || null,
                      });
                      await onReportSaved();
                    } catch (e) {
                      console.error("Failed to save asset inspection report in MySQL asset_reports:", e);
                    }
                  }

                  if (selectedQueueItem.rawAsset) {
                    syncFromDb();
                  }

                  setItemInspectedState(prev => ({ ...prev, [selectedQueueItem.rawAsset?.id || selectedQueueItem.id]: true }));
                  setSelectedQueueItem(null);
                  setInspectionImgOption("");
                  setTsgRemarksOption("");
                  setItsRemarksOption("");
                  // TODO(H-16): this success message shows even when the post failed, because the answer is never read. Step 13 (typed errors).
                  alert(`Inspection Report logged & saved under asset_reports table in MySQL for ${selectedQueueItem.asset}!`);
                }}
              >
                Submit &amp; Finalize Inspection
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
