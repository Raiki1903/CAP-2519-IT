/**
 * The button that opens a loan's printable Accountability Form in a new tab.
 * Layer: feature component. Called by ResearcherMyLoans and LabHeadLoanRequests. Calls components/ui/button.tsx.
 * Used by: Researcher and Lab Head loan lists, so the action looks the same on both.
 */
import { FileText } from "lucide-react";
import { Button } from "@web/components/ui/button";

/**
 * Opens /loans/:loanId/accountability-form in a new tab.
 *
 * @param loanId the numeric loan id, without the "LOAN-" prefix
 */
export function AccountabilityFormButton({ loanId }: { loanId: number }) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="text-xs gap-1.5"
      onClick={() => window.open(`/loans/${loanId}/accountability-form`, "_blank")}
    >
      <FileText size={13} />
      Accountability Form
    </Button>
  );
}
