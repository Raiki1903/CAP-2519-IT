/**
 * Loan return receive dialog for TSG staff.
 * Layer: feature component. Called by LoansPage.
 * Calls: api/loans.api.ts receiveLoan(), useFormLookups, InspectionStep.
 * Used by: TSG loan return inspection and damage reporting.
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Switch } from "@web/components/ui/switch";
import { InspectionStep, type InspectionStepValue } from "@web/features/inspections/InspectionStep";
import { useFormLookups } from "@web/features/lookups/useLookups";
import { receiveLoan } from "@web/api/loans.api";
import type { Loan } from "@shared/types/loans";

/** Props for LoanReceiveDialog. */
export interface LoanReceiveDialogProps {
  loan: Loan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (resultMessage: string) => void;
}

/**
 * Handles receiving returned equipment, tag verification, return inspection,
 * and routing to Maintenance if damage is recorded.
 */
export function LoanReceiveDialog({
  loan,
  open,
  onOpenChange,
  onSuccess,
}: LoanReceiveDialogProps) {
  const { lookups } = useFormLookups();
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [hasDamage, setHasDamage] = useState(false);
  const [issueTypeId, setIssueTypeId] = useState<number | null>(null);
  const [issueDescription, setIssueDescription] = useState("");

  const [inspection, setInspection] = useState<InspectionStepValue>({
    condition: "OPERATIONAL",
    healthScore: 80,
    missingAccessories: "",
    remarks: "",
  });

  useEffect(() => {
    if (open) {
      setTagInput("");
      setErrorMessage(null);
      setSubmitting(false);
      setHasDamage(false);
      setIssueTypeId(lookups?.issueTypes?.[0]?.issueTypeId ?? null);
      setIssueDescription("");
      setInspection({
        condition: "OPERATIONAL",
        healthScore: 80,
        missingAccessories: "",
        remarks: "",
      });
    }
  }, [open, loan, lookups]);

  if (!loan) return null;

  const borrowerName = loan.borrower && "name" in loan.borrower ? loan.borrower.name : "Researcher";
  const tagMatches = tagInput.trim().toUpperCase() === loan.asset.tag.trim().toUpperCase();

  const selectedIssueType = lookups?.issueTypes?.find((it) => it.issueTypeId === issueTypeId);

  const isFormValid =
    tagMatches &&
    (!hasDamage || (Boolean(issueTypeId) && issueDescription.trim().length > 0));

  const handleReceive = async () => {
    if (!isFormValid) return;
    setSubmitting(true);
    setErrorMessage(null);

    const payload = {
      inspection: {
        condition: inspection.condition,
        healthScore: inspection.healthScore,
        missingAccessories: inspection.missingAccessories || null,
        remarks: inspection.remarks || null,
        metrics: inspection.metrics,
      },
      returnDamage:
        hasDamage && issueTypeId
          ? {
              issueTypeId,
              issueDescription: issueDescription.trim(),
            }
          : null,
    };

    try {
      const res = await receiveLoan(loan.loanId, payload);

      if (!res.success) {
        setErrorMessage(res.error || "Failed to receive the returned asset.");
        setSubmitting(false);
        return;
      }

      const destinationMessage = hasDamage
        ? "Equipment received with damage and sent to Repairs."
        : `Equipment received and returned to ${loan.destinationLab?.code ?? "home lab"}.`;

      onSuccess(destinationMessage);
      onOpenChange(false);
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred during return receipt.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Receive Returned Asset: {loan.asset.tag}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Verify the tag, inspect the equipment condition, and file damage reports if required.
          </DialogDescription>
        </DialogHeader>

        {/* Loan Details */}
        <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Equipment:</span>{" "}
              <span className="font-semibold text-foreground">{loan.asset.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Borrower:</span>{" "}
              <span className="font-semibold text-foreground">{borrowerName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Scheduled Return:</span>{" "}
              <span className="font-semibold text-foreground">{loan.returnBy}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Loan Status:</span>{" "}
              <span className="font-semibold text-foreground">{loan.statusLabel}</span>
            </div>
          </div>
          {loan.remarks && (
            <div className="pt-1">
              <span className="text-muted-foreground">Borrower return note:</span>{" "}
              <span className="text-foreground italic">{loan.remarks}</span>
            </div>
          )}
        </div>

        {/* Tag confirmation step */}
        <div className="space-y-1.5 pt-2">
          <Label className="text-xs font-bold text-foreground">
            Confirm Asset Tag <span className="text-destructive">*</span>
          </Label>
          <Input
            type="text"
            placeholder={`Type "${loan.asset.tag}" to confirm`}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className={tagInput && !tagMatches ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>

        {/* Inspection Form */}
        <div className="pt-2 border-t border-border/40">
          <p className="text-xs font-bold text-foreground mb-3">Return Inspection</p>
          <InspectionStep
            value={inspection}
            onChange={setInspection}
            disabled={submitting}
          />
        </div>

        {/* Damage Found Toggle */}
        <div className="pt-3 border-t border-border/40 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-bold text-foreground cursor-pointer" htmlFor="damage-toggle">
                Damage Found
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Turn on to open a repair ticket and transfer the asset to Maintenance.
              </p>
            </div>
            <Switch
              id="damage-toggle"
              checked={hasDamage}
              onCheckedChange={setHasDamage}
              disabled={submitting}
            />
          </div>

          {hasDamage && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Issue Type <span className="text-destructive">*</span>
                </Label>
                <select
                  value={issueTypeId ? String(issueTypeId) : ""}
                  onChange={(e) => setIssueTypeId(parseInt(e.target.value, 10) || null)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {(lookups?.issueTypes ?? []).map((it) => (
                    <option key={it.issueTypeId} value={String(it.issueTypeId)}>
                      {it.name} - suggested action: {it.suggestedAction}
                    </option>
                  ))}
                </select>
                {selectedIssueType && (
                  <p className="text-[11px] text-muted-foreground">
                    Action: {selectedIssueType.suggestedAction}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Damage Description <span className="text-destructive">*</span>
                </Label>
                <textarea
                  rows={2}
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Describe the defect, damage, or operational failure found during return..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {errorMessage && (
          <p className="text-xs font-medium text-destructive pt-1">{errorMessage}</p>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleReceive}
            disabled={!isFormValid || submitting}
            className="bg-[#005A36] text-white hover:bg-[#005A36]/90 font-bold"
          >
            {submitting ? "Receiving..." : "Confirm & Receive Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
