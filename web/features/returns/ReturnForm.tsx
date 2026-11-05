/**
 * Return form: a Custodian asks to hand an asset back, and TSG record the return.
 * Layer: feature component. Called by features/assets/AssetDetailModal.tsx (Custodian return request, Staff Record Return)
 * and pages/staff/ReturnsPage.tsx (Staff pending returns).
 * Calls: api/loans.api.ts requestReturn() and receiveLoan(), api/maintenance.api.ts requestRepair(), state/serverData.tsx
 * syncFromDb().
 * Used by: Custodian return request, Staff return finalization, Staff Record Return.
 */
import { useState } from "react";
import { useSession } from "@web/state/session";
import { useServerData } from "@web/state/serverData";
import * as loansApi from "@web/api/loans.api";
import * as maintenanceApi from "@web/api/maintenance.api";
import { motion, AnimatePresence } from "motion/react";
import {
  X, ArrowLeft, CheckCircle, CornerUpLeft,
  User, Calendar, ClipboardCheck, ToggleLeft, Hash, FileText, Wrench
} from "lucide-react";
import type { AssetDetail } from "@web/features/assets/AssetDetailModal";
import type { Loan } from "@shared/types/loans";
import { ASSET_CONDITIONS } from "@shared/enums/assetCondition";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Badge } from "@web/components/ui/badge";
import { Separator } from "@web/components/ui/separator";
import { Switch } from "@web/components/ui/switch";
import { cn } from "@web/components/ui/utils";

const BRAND = "#005A36";

interface Props {
  asset: AssetDetail;
  /** The loan Staff are receiving, from the Pending Returns row clicked. None from the asset modal: the form finds it. */
  loan?: Loan;
  onBack: () => void;
  onClose: () => void;
}

/**
 * Does one of two things, by role.
 * - Custodian: asks to return the asset (loansApi.requestReturn) with the turn-in comments as the remarks and, if
 *   "flag for repair" is on, files a repair through maintenanceApi.requestRepair(). The request is saved on the server,
 *   so TSG see it on any computer.
 * - Staff (TSG): records the condition and calls loansApi.receiveLoan(), which closes the loan as Returned with a Return
 *   inspection and puts the asset back to Available. The success screen shows the loan's reference. From the asset
 *   modal (Record Return) no loan is passed in, so the form finds the asset's open loan first.
 *
 * If the server refuses or cannot be reached, the form stays open with the reason in red. A Custodian's request is kept
 * even if its repair ticket fails; the success screen then says so in an amber line.
 *
 * @param asset the asset being returned
 * @param loan the Pending Returns loan being received, if any
 * @param onBack returns to the asset detail view
 * @param onClose closes the modal from the success screen
 */
export function ReturnForm({ asset, loan, onBack, onClose }: Props) {
  const { role } = useSession();
  const { syncFromDb } = useServerData();

  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [condition, setCondition] = useState("");
  const [inspection, setInspection] = useState(""); // Custodian turn-in comments OR Staff notes
  const [clearanceIssued, setClearance] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flagForRepair, setFlagForRepair] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [dbReferenceNumber, setDbReferenceNumber] = useState<string | null>(null);

  const isCustodian = role === "Custodian";
  const canSubmit = isCustodian || (!!returnDate && !!condition);

  // The open loan on this asset: the one passed in, or the first match in the caller's list (a Custodian's own loans,
  // or TSG's On Loan and Return Requested loans, which also holds walk-in returns).
  const findLoan = async (): Promise<Loan | null> => {
    if (loan) return loan;
    const data = isCustodian ? await loansApi.listMyLoans() : await loansApi.listLoansByStatus(["RETURN_REQUESTED", "ON_LOAN"]);
    if (!data.success) throw new Error(data.error || "The loan could not be loaded.");
    const open = isCustodian ? ["ON_LOAN"] : ["RETURN_REQUESTED", "ON_LOAN"];
    return (data.loans as Loan[]).find(l => l.asset.tag === asset.id && open.includes(l.status)) ?? null;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    setRepairError(null);

    // Nothing is shown as done until the server has accepted the step.
    try {
      const found = await findLoan();
      if (!found) {
        setSubmitError(isCustodian
          ? "This asset is not out on loan to you."
          : "This asset has no open loan, so there is nothing to receive.");
        setSubmitting(false);
        return;
      }

      if (isCustodian) {
        const data = await loansApi.requestReturn(found.loanId, inspection);
        if (!data.success) {
          setSubmitError(data.error ? `The return request was not sent: ${data.error}` : "The return request was not sent. Please try again.");
          setSubmitting(false);
          return;
        }
      } else {
        const data = await loansApi.receiveLoan(found.loanId, {
          inspection: { condition, remarks: inspection || null },
        });
        if (!data.success) {
          setSubmitError(data.error ? `The return was not recorded: ${data.error}` : "The return was not recorded. Please try again.");
          // The lists reload after a refusal too: for an asset that is no longer out, they show it back in the pool.
          syncFromDb();
          setSubmitting(false);
          return;
        }
        setDbReferenceNumber(`LOAN-${data.loan.loanId}`);
      }
    } catch (err: any) {
      setSubmitError(`${isCustodian ? "The return request was not sent" : "The return was not recorded"}: ${err.message || "the server could not be reached"}. Please try again.`);
      setSubmitting(false);
      return;
    }

    // Custodian flagged the device as needing repair on turn-in: log it to the same repair queue RepairForm
    // writes to, so it shows up on the Staff Repairs page.
    if (isCustodian && flagForRepair) {
      try {
        const data = await maintenanceApi.requestRepair(asset.id, {
          description: inspection || "Flagged for repair assessment during asset return.",
        });
        if (!data.success) {
          setRepairError(data.error || "Failed to log repair request to the database.");
        }
      } catch (err: any) {
        setRepairError(err.message || "Failed to reach the server.");
      }
    }

    syncFromDb();
    setSubmitting(false);
    setSubmitted(true);
  };

  const conditionColor: Record<string, string> = {
    PERFECT: "text-emerald-700",
    OPERATIONAL: "text-blue-700",
    MINOR_DRIFT: "text-amber-700",
    DEGRADED: "text-orange-700",
    CRITICAL_DEFECT: "text-red-700",
  };

  // The server makes the CLR- number when it records the return, so there is none to show before. (issue #59)
  const displayCertId = dbReferenceNumber ?? "Assigned on finalize";

  return (
    <AnimatePresence mode="wait">
      {submitted ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 py-8 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="font-extrabold text-foreground mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {isCustodian ? "Return Initiated" : "Return Ledger Closed"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isCustodian
                ? "Return request submitted. Please hand over the physical device to Staff."
                : "Asset return has been finalized and registry status set to Available."}
            </p>
          </div>
          {isCustodian && repairError && (
            <div className="w-full rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 text-left">
              Return request sent, but the repair ticket could not reach the database: {repairError}
            </div>
          )}
          <div className="w-full rounded-xl bg-[#F3F4F6] border border-border p-4 text-left space-y-2">
            <div>
              <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Asset</p>
              <p className="text-xs font-semibold text-foreground">{asset.name} ({asset.id})</p>
            </div>
            {!isCustodian && (
              <>
                <div>
                  <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Return Date</p>
                  <p className="text-xs font-semibold text-foreground">{returnDate}</p>
                </div>
                <div>
                  <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Condition</p>
                  <p className={cn("text-xs font-bold", conditionColor[condition] ?? "")}>{condition.replace(/_/g, " ")}</p>
                </div>
                {clearanceIssued && (
                  <div>
                    <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Clearance Certificate</p>
                    <p className="text-xs font-bold text-primary font-mono">{displayCertId}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Badge className={clearanceIssued
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                    : "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                  }>
                    {clearanceIssued ? "Clearance Issued" : "Pending Clearance Review"}
                  </Badge>
                </div>
              </>
            )}
            {isCustodian && (
              <div>
                <p className="text-[9px] font-extrabold text-muted-foreground tracking-[2px] uppercase">Turn-In Comments</p>
                <p className="text-xs font-semibold text-foreground italic">"{inspection || "No comments."}"</p>
                {flagForRepair && (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] mt-2">
                    Repair Ticket Logged
                  </Badge>
                )}
              </div>
            )}
          </div>
          <Button size="sm" onClick={onClose} className="mt-2" style={{ background: BRAND, color: "#fff" }}>
            Close
          </Button>
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
          {/* Sub-header */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F0FDF4" }}>
              <CornerUpLeft size={15} style={{ color: BRAND }} />
            </div>
            <div>
              <p className="text-sm font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Asset Return
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isCustodian
                  ? "Initiate formal property turn-in request"
                  : "Finalize property inspection and close asset ledger"}
              </p>
            </div>
          </div>

          <Separator />

          {/* Pending return info for Staff */}
          {!isCustodian && loan?.status === "RETURN_REQUESTED" && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 space-y-1">
              <p className="font-extrabold uppercase tracking-wider text-[9px] text-blue-700">Custodian Turn-in Comments</p>
              {loan.returnRequestedAt && <p><strong>Asked to return on:</strong> {new Date(loan.returnRequestedAt).toLocaleDateString("en-CA")}</p>}
              <p className="italic">"{loan.remarks || "No comments."}"</p>
            </div>
          )}

          {/* Asset Tag */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase">Asset Tag</Label>
            <Input value={asset.id} disabled className="font-mono bg-[#F3F4F6] text-muted-foreground" />
          </div>

          {/* Responsible Person */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
              <User size={10} /> Responsible Custodian
            </Label>
            <Input
              value={asset.custodian ?? "None"}
              disabled
              className="bg-[#F3F4F6] text-muted-foreground"
            />
          </div>

          {/* Return Date (Staff; the Custodian's request is dated by the server) */}
          {!isCustodian && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
                <Calendar size={10} /> Return Date
              </Label>
              <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
            </div>
          )}

          {/* Role-Based Forms Partitioning */}
          {isCustodian ? (
            /* Custodian View: Turn-in comments only */
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
                  <FileText size={10} /> Custodian Turn-In Comments
                </Label>
                <textarea
                  value={inspection}
                  onChange={e => setInspection(e.target.value)}
                  rows={3}
                  maxLength={255}
                  placeholder="List accessories returned, state of the device, or turn-in justification..."
                  className="w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Wrench size={15} className="text-amber-600" />
                    Flag for Repair Assessment
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Notifies Staff the device needs inspection — logs a repair ticket using the comments above, alongside this return.
                  </p>
                </div>
                <Switch
                  checked={flagForRepair}
                  onCheckedChange={setFlagForRepair}
                  className="data-[state=checked]:bg-amber-600"
                />
              </div>
            </div>
          ) : (
            /* Staff view: full inspection checklist and diagnostics */
            <>
              {/* Condition on Return */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase">
                  Condition on Return
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {ASSET_CONDITIONS.map(c => (
                    <motion.button
                      key={c}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setCondition(c)}
                      className={cn(
                        "rounded-lg border-2 py-2.5 text-xs font-bold transition-colors",
                        condition === c
                          ? c === "PERFECT" || c === "OPERATIONAL"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : c === "MINOR_DRIFT"
                              ? "border-amber-500 bg-amber-50 text-amber-700"
                              : c === "DEGRADED"
                                ? "border-orange-500 bg-orange-50 text-orange-700"
                                : "border-red-500 bg-red-50 text-red-700"
                          : "border-border bg-white text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {condition === c && <CheckCircle size={10} className="inline mr-1" />}
                      {c.replace(/_/g, " ")}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Staff inspection result */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase flex items-center gap-1.5">
                  <ClipboardCheck size={10} /> Staff Inspection Notes
                </Label>
                <textarea
                  value={inspection}
                  onChange={e => setInspection(e.target.value)}
                  rows={3}
                  placeholder="Hardware performance analytics, physical condition observations, test results, anomalies detected during turn-in inspection…"
                  className="w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              {/* Clearance Issued Toggle */}
              <div className="rounded-xl bg-[#F3F4F6] border border-border p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <ToggleLeft size={15} style={{ color: BRAND }} />
                    Clearance Issued
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Toggle to confirm no outstanding holds or academic encumbrances
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <span className={cn("text-xs font-bold", clearanceIssued ? "text-muted-foreground" : "text-foreground")}>No</span>
                  <Switch
                    checked={clearanceIssued}
                    onCheckedChange={setClearance}
                    className="data-[state=checked]:bg-primary"
                  />
                  <span className={cn("text-xs font-bold", clearanceIssued ? "text-foreground" : "text-muted-foreground")}>Yes</span>
                </div>
              </div>

              {/* Clearance Certificate ID — conditional reveal */}
              <AnimatePresence>
                {clearanceIssued && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-1.5 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3">
                      <Label className="text-[10px] font-extrabold tracking-[1.5px] text-emerald-700 uppercase flex items-center gap-1.5">
                        <Hash size={10} /> Clearance Certificate ID — Auto-Generated
                      </Label>
                      <Input
                        value={displayCertId}
                        disabled
                        className="font-mono font-bold text-primary bg-white border-emerald-200"
                      />
                      <p className="text-[10px] text-emerald-700">
                        The server assigns this reference when the return is finalized.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {submitError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{submitError}</div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-2.5">
            <Button
              variant="outline"
              onClick={onBack}
              className="gap-1.5 bg-foreground/5 text-foreground border-border hover:bg-foreground/10"
            >
              <ArrowLeft size={13} /> Back
            </Button>
            <Button
              className="flex-1 gap-2 font-bold"
              style={{ background: canSubmit ? BRAND : undefined, color: canSubmit ? "#fff" : undefined }}
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full" /> {isCustodian ? "Submitting..." : "Finalizing..."}</>
              ) : (
                <><CornerUpLeft size={14} /> {isCustodian ? "Submit Return Request" : "Finalize Return and Close Ledger"}</>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}