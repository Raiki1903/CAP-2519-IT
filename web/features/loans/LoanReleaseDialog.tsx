/**
 * Loan release dialog for TSG staff.
 * Layer: feature component. Called by LoansPage.
 * Calls: api/loans.api.ts releaseLoan(), InspectionStep.
 * Used by: TSG loan release handover.
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
import { InspectionStep, type InspectionStepValue } from "@web/features/inspections/InspectionStep";
import { releaseLoan } from "@web/api/loans.api";
import type { Loan } from "@shared/types/loans";

/** Props for LoanReleaseDialog. */
export interface LoanReleaseDialogProps {
  loan: Loan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (releasedLoanId: number) => void;
}

/**
 * Handles asset handover verification and condition logging.
 * The Release button is disabled until TSG verifies the physical asset tag.
 */
export function LoanReleaseDialog({
  loan,
  open,
  onOpenChange,
  onSuccess,
}: LoanReleaseDialogProps) {
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setInspection({
        condition: "OPERATIONAL",
        healthScore: 80,
        missingAccessories: "",
        remarks: "",
      });
    }
  }, [open, loan]);

  if (!loan) return null;

  const borrowerName = loan.borrower && "name" in loan.borrower ? loan.borrower.name : "Researcher";
  const approverName = loan.decidedBy && "name" in loan.decidedBy ? loan.decidedBy.name : "Lab Head";
  const destination = `${loan.destinationLab?.code ?? "Home Lab"}${loan.destinationRoom ? ` - ${loan.destinationRoom}` : ""}`;

  // Tag verification: strict case-insensitive match
  const tagMatches = tagInput.trim().toUpperCase() === loan.asset.tag.trim().toUpperCase();

  const handleRelease = async () => {
    if (!tagMatches) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await releaseLoan(loan.loanId, {
        condition: inspection.condition,
        healthScore: inspection.healthScore,
        missingAccessories: inspection.missingAccessories || null,
        remarks: inspection.remarks || null,
        metrics: inspection.metrics,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to release the loan.");
        setSubmitting(false);
        return;
      }

      onSuccess(loan.loanId);
      onOpenChange(false);
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred during release.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Release Asset: {loan.asset.tag}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Confirm the asset tag and record the physical condition before handing over to the borrower.
          </DialogDescription>
        </DialogHeader>

        {/* Loan Summary Details */}
        <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Asset:</span>{" "}
              <span className="font-semibold text-foreground">{loan.asset.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Borrower:</span>{" "}
              <span className="font-semibold text-foreground">{borrowerName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Destination:</span>{" "}
              <span className="font-semibold text-foreground">{destination}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Return By:</span>{" "}
              <span className="font-semibold text-foreground">{loan.returnBy}</span>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Purpose:</span>{" "}
            <span className="text-foreground">{loan.purpose}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Approved by:</span>{" "}
            <span className="text-foreground">{approverName}</span>
            {loan.decisionRemarks ? ` (${loan.decisionRemarks})` : ""}
          </div>
        </div>

        {/* Tag confirmation step */}
        <div className="space-y-1.5 pt-2">
          <Label className="text-xs font-bold text-foreground">
            Confirm Asset Tag <span className="text-destructive">*</span>
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder={`Type "${loan.asset.tag}" to confirm`}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className={tagInput && !tagMatches ? "border-destructive focus-visible:ring-destructive" : ""}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Type or scan the tag from the physical barcode label. The release button stays disabled until it matches.
          </p>
        </div>

        {/* Inspection Form */}
        <div className="pt-2 border-t border-border/40">
          <p className="text-xs font-bold text-foreground mb-3">Release Inspection</p>
          <InspectionStep
            value={inspection}
            onChange={setInspection}
            disabled={submitting}
          />
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
            onClick={handleRelease}
            disabled={!tagMatches || submitting}
          >
            {submitting ? "Releasing..." : "Confirm Release"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
