/**
 * Printable Accountability Form page.
 * Layer: page. Called by app/routes.tsx at /loans/:loanId/accountability-form.
 * Calls: api/loans.api.ts getAccountabilityForm().
 * Used by: Borrower (Researcher), home Lab Head, and TSG staff.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Printer, ArrowLeft, ShieldAlert } from "lucide-react";
import { getAccountabilityForm } from "@web/api/loans.api";
import { Button } from "@web/components/ui/button";
import type { AccountabilityForm } from "@web/features/loans/loanTypes";

/**
 * Format a date string into YYYYMMDD for the file title.
 */
function toDateStamp(dateStr?: string | null): string {
  if (!dateStr) return "UNDATED";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "UNDATED";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

/**
 * Extract the last name from a full name string.
 */
function extractLastName(fullName?: string | null): string {
  if (!fullName) return "Borrower";
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || "Borrower";
}

/**
 * Formats a date string into human-readable YYYY-MM-DD.
 */
function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toISOString().split("T")[0];
}

/**
 * Displays the official CCS AdRIC Equipment Accountability Form
 * and handles PDF printing with policy-standard file naming.
 */
export function AccountabilityFormPage() {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<AccountabilityForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loanId) return;
    setLoading(true);
    setErrorMessage(null);

    getAccountabilityForm(loanId)
      .then((res: any) => {
        if (res.success && res.loan && res.asset && res.borrower) {
          setFormData({
            loan: res.loan,
            asset: res.asset,
            borrower: res.borrower,
            releaseInspection: res.releaseInspection || null,
          });
        } else {
          setErrorMessage(res.error || "Failed to load Accountability Form.");
        }
      })
      .catch((err: any) => {
        setErrorMessage(err?.message || "Failed to contact the server.");
      })
      .finally(() => setLoading(false));
  }, [loanId]);

  const handlePrint = () => {
    if (!formData) return;
    const tag = formData.asset.tag || formData.loan.asset.tag;
    const lastName = extractLastName(formData.borrower.name);
    const dateIssued = toDateStamp(formData.loan.releasedAt || formData.loan.requestedAt);

    // Policy filename: accountability_<asset-tag>_<lastname>_<YYYYMMDD>
    const originalTitle = document.title;
    document.title = `accountability_${tag}_${lastName}_${dateIssued}`;
    window.print();
    document.title = originalTitle;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <p className="text-xs text-muted-foreground">Loading Accountability Form...</p>
      </div>
    );
  }

  if (errorMessage || !formData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="max-w-md w-full bg-card border border-border p-6 rounded-xl shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-base font-bold text-foreground">Access Refused</h2>
          <p className="text-xs text-muted-foreground">{errorMessage || "Accountability Form not found."}</p>
          <Button size="sm" variant="outline" onClick={() => navigate(-1)} className="gap-1.5 text-xs font-semibold">
            <ArrowLeft size={13} />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { loan, asset, borrower, releaseInspection } = formData;
  const accountabilityId = `AF-${String(loan.loanId).padStart(5, "0")}`;
  const effectivePeriod = `${formatDate(loan.releasedAt)} to ${loan.returnBy}`;
  const modelName = asset.manufacturer || "N/A";
  const serialNo = asset.serialNumber || asset.serial || loan.asset.serial || "N/A";
  const affiliatedLabs = borrower.labs?.map((l) => l.code).join(", ") || "None";
  const destination = `${loan.destinationLab?.code ?? "Home Lab"}${loan.destinationRoom ? ` - ${loan.destinationRoom}` : ""}`;
  const releasedBy = loan.releasedBy && "name" in loan.releasedBy ? loan.releasedBy.name : "TSG Staff";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 print:p-0 print:bg-white text-black dark:text-white print:text-black">
      {/* Non-printing action bar */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Button size="sm" variant="outline" onClick={() => window.close()} className="gap-1.5 text-xs font-semibold">
          <ArrowLeft size={13} />
          Close Form
        </Button>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handlePrint} className="gap-1.5 text-xs font-bold bg-[#005A36] text-white hover:bg-[#005A36]/90">
            <Printer size={13} />
            Print Form / Save PDF
          </Button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-3xl mx-auto bg-white print:bg-white border border-slate-300 print:border-none rounded-xl print:rounded-none shadow-sm print:shadow-none p-8 md:p-12 space-y-6 text-[12px] leading-relaxed text-slate-900">
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
          <div>
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-600">
              De La Salle University - College of Computer Studies
            </p>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-950">
              Advanced Research and Innovation Center (AdRIC)
            </h1>
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mt-0.5">
              Equipment Accountability Form
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Accountability ID</p>
            <p className="text-base font-mono font-extrabold text-slate-950">{accountabilityId}</p>
            <p className="text-[10px] text-slate-500 mt-1">Issued: {formatDate(loan.releasedAt)}</p>
          </div>
        </div>

        {/* Section 1: Equipment and Borrower Details */}
        <div className="grid grid-cols-2 gap-6 pt-2">
          <div className="space-y-1.5 border border-slate-200 p-3 rounded-lg bg-slate-50/50">
            <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
              Equipment Information
            </p>
            <div>
              <span className="text-slate-500 font-medium">Asset Tag:</span>{" "}
              <span className="font-mono font-bold text-slate-950">{asset.tag || loan.asset.tag}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Equipment Name:</span>{" "}
              <span className="font-semibold text-slate-950">{asset.name || loan.asset.name}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Model / Make:</span>{" "}
              <span className="text-slate-950">{modelName}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Serial Number:</span>{" "}
              <span className="font-mono text-slate-950">{serialNo}</span>
            </div>
          </div>

          <div className="space-y-1.5 border border-slate-200 p-3 rounded-lg bg-slate-50/50">
            <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
              Responsible Person
            </p>
            <div>
              <span className="text-slate-500 font-medium">Name:</span>{" "}
              <span className="font-bold text-slate-950">{borrower.name}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">DLSU ID Number:</span>{" "}
              <span className="font-mono text-slate-950">{borrower.idNumber ?? "N/A"}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Email:</span>{" "}
              <span className="text-slate-950">{borrower.email}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Affiliated Labs:</span>{" "}
              <span className="text-slate-950">{affiliatedLabs}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Handover Details */}
        <div className="border border-slate-200 p-3 rounded-lg bg-slate-50/50 space-y-1.5">
          <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
            Handover & Utilization Terms
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-slate-500 font-medium">Destination:</span>{" "}
              <span className="font-semibold text-slate-950">{destination}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Effective Period:</span>{" "}
              <span className="font-semibold text-slate-950">{effectivePeriod}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Stated Purpose:</span>{" "}
            <span className="text-slate-950">{loan.purpose}</span>
          </div>
        </div>

        {/* Section 3: Release Inspection */}
        <div className="border border-slate-200 p-3 rounded-lg bg-slate-50/50 space-y-1.5">
          <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
            Release Inspection (Condition at Handover)
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-slate-500 font-medium">Condition:</span>{" "}
              <span className="font-semibold text-slate-950">
                {releaseInspection?.conditionLabel || releaseInspection?.condition || loan.releaseInspection?.conditionLabel || "Operational"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Health Score:</span>{" "}
              <span className="font-semibold text-slate-950">
                {releaseInspection?.healthScore ?? loan.releaseInspection?.healthScore ?? 100} / 100
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Released by:</span>{" "}
              <span className="text-slate-950">{releasedBy}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Missing Accessories:</span>{" "}
            <span className="text-slate-950">
              {releaseInspection?.missingAccessories || loan.releaseInspection?.missingAccessories || "None"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Remarks:</span>{" "}
            <span className="text-slate-950">
              {releaseInspection?.remarks || loan.releaseInspection?.remarks || "Equipment released in verified working condition."}
            </span>
          </div>
        </div>

        {/* Section 4: Policy Clauses */}
        <div className="space-y-3 pt-2">
          <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
            Terms of Accountability
          </p>

          <div className="space-y-2 text-[11px] text-slate-700">
            <div>
              <span className="font-bold text-slate-950">1. Care and use:</span> The Responsible Person keeps the equipment in good order, uses it only for the stated purpose and destination, and does not lend it to anyone else.
            </div>
            <div>
              <span className="font-bold text-slate-950">2. Damage and loss:</span> The Responsible Person reports any damage, fault or loss through the system as soon as it is found. Missing or damaged items may delay clearance until they are resolved under these terms.
            </div>
            <div>
              <span className="font-bold text-slate-950">3. Return and clearance:</span> The equipment and all accessories are returned to TSG on or before the return-by date. TSG inspects it on return and records the result. Clearance is issued within 5 business days of the return.
            </div>
            <div>
              <span className="font-bold text-slate-950">4. Periodic status:</span> While the equipment is out, the Responsible Person answers status checks (condition and location) at the end of each term or when TSG asks. Missing updates may affect clearance and borrowing privileges.
            </div>
          </div>
        </div>

        {/* Section 5: Signatures */}
        <div className="pt-8 grid grid-cols-2 gap-12">
          <div>
            <div className="border-b border-slate-900 pb-1 h-12 flex items-end">
              <span className="text-xs font-semibold text-slate-400">Signature</span>
            </div>
            <div className="mt-2">
              <p className="font-bold text-slate-950">{borrower.name}</p>
              <p className="text-[10px] text-slate-500">Responsible Person</p>
              <p className="text-[10px] text-slate-500 mt-1">Date: ________________________</p>
            </div>
          </div>

          <div>
            <div className="border-b border-slate-900 pb-1 h-12 flex items-end">
              <span className="text-xs font-semibold text-slate-400">Signature</span>
            </div>
            <div className="mt-2">
              <p className="font-bold text-slate-950">{releasedBy}</p>
              <p className="text-[10px] text-slate-500">Technical Support Group (TSG)</p>
              <p className="text-[10px] text-slate-500 mt-1">Date: ________________________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
