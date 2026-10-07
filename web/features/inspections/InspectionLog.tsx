import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/badge";
import { Card } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { cn } from "@web/components/ui/utils";
import { ClipboardCheck, Eye } from "lucide-react";

// Database condition names to the labels the finalize dialog offers, so a report
// reads the same in the log as when it was filed.
const REPORT_CONDITION_LABEL: Record<string, string> = {
  PERFECT: "Perfect",
  OPERATIONAL: "Operational",
  MINOR_DRIFT: "Minor Drift",
  DEGRADED: "Degraded Performance",
  CRITICAL_DEFECT: "Critical Defect",
};

export function InspectionLog({ dbReports }: { dbReports: any[] }) {
  const [selectedInspection, setSelectedInspection] = useState<any | null>(null);

  // The log shows the reports saved in asset_reports, newest first, whoever filed
  // them and from whichever browser. The database stores no cycle type, so the
  // log has no cycle column. (F-28, issue #34)
  const reportLog = dbReports.map(r => ({
    id: `RPT-${r.reportId}`,
    assetId: r.assetId,
    assetName: r.assetName,
    reportedBy: r.reportedBy,
    status: REPORT_CONDITION_LABEL[r.reportCondition] || r.reportCondition,
    description: r.reportRemarks || "",
    images: r.reportImg ? [r.reportImg] : [],
    submittedAt: r.reportDate,
  }));

  return (
    <>
      {/* Inspection Report Log Section */}
      {reportLog.length > 0 ? (
        <div className="mt-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <ClipboardCheck size={18} className="text-[#005A36]" />
            <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Inspection Report Log</h3>
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-extrabold text-[9px] px-2 py-0.5 tracking-wider border-emerald-200">
              {reportLog.length} REPORTS SUBMITTED
            </Badge>
          </div>

          <Card className="overflow-hidden p-0 border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {["Report ID", "Asset", "Reported By", "Preset Status", "Date Submitted", "Actions"].map(h => (
                    <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportLog.map(rep => {
                  const isPerfect = rep.status === "Perfect";
                  const isOperational = rep.status === "Operational";
                  const isDrift = rep.status === "Minor Drift";
                  const isDegraded = rep.status === "Degraded Performance";

                  const statusBadge = isPerfect
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : isOperational
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : isDrift
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : isDegraded
                          ? "bg-orange-50 text-orange-700 border-orange-200"
                          : "bg-red-50 text-red-700 border-red-200";

                  return (
                    <TableRow key={rep.id} className="transition-colors hover:bg-muted/10">
                      <TableCell className="font-bold text-xs font-mono">{rep.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-xs font-bold text-foreground">{rep.assetName}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{rep.assetId}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">{rep.reportedBy}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[9px] font-extrabold px-1.5 py-0", statusBadge)}>
                          {rep.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{rep.submittedAt}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setSelectedInspection(rep)}
                        >
                          <Eye size={10} className="mr-1" /> View Report
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      ) : (
        <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl mb-6">
          No inspection reports have been saved yet.
        </div>
      )}

      {/* Inspection Details Dialog */}
      <Dialog open={!!selectedInspection} onOpenChange={(open) => !open && setSelectedInspection(null)}>
        {selectedInspection && (
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground">Inspection Report Details</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Condition report saved in the inspection records.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border border-border">
                <div>
                  <p className="text-[9px] font-extrabold text-muted-foreground tracking-widest uppercase">Report reference</p>
                  <p className="text-sm font-bold text-primary font-mono mt-0.5">{selectedInspection.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="border border-border rounded-lg p-2.5 bg-background">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Asset Information</p>
                  <p className="font-bold mt-1 text-foreground">{selectedInspection.assetName}</p>
                  <p className="font-mono text-muted-foreground mt-0.5">{selectedInspection.assetId}</p>
                </div>
                <div className="border border-border rounded-lg p-2.5 bg-background">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Reported By</p>
                  <p className="font-semibold mt-1 text-foreground">{selectedInspection.reportedBy}</p>
                  <p className="text-muted-foreground mt-0.5">{selectedInspection.submittedAt}</p>
                </div>
              </div>

              <div className="border border-border rounded-lg p-3 bg-background">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Condition Status Check-in</span>
                  <Badge variant="outline" className={cn("text-[9px] font-extrabold",
                    selectedInspection.status === "Perfect" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      selectedInspection.status === "Operational" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        selectedInspection.status === "Minor Drift" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          selectedInspection.status === "Degraded Performance" ? "bg-orange-50 text-orange-700 border-orange-200" :
                            "bg-red-50 text-red-700 border-red-200"
                  )}>
                    {selectedInspection.status}
                  </Badge>
                </div>
                <p className="text-xs text-foreground leading-relaxed italic">"{selectedInspection.description || "No manual remarks provided."}"</p>
              </div>

              {selectedInspection.images && selectedInspection.images.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Uploaded Physical Verification Image(s)</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedInspection.images.map((img: string, i: number) => (
                      <div key={i} className="border border-border rounded-lg overflow-hidden max-w-full">
                        <img src={img} alt="inspection asset" className="max-h-64 object-contain rounded-lg" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedInspection(null)}>Close View</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
