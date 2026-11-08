/**
 * Printable Return and Clearance Record (Appendix 4 of CCS Equipment Monitoring Policies).
 * Layer: page. Mounted by app/routes.tsx at /staff/clearance/:userId outside RootLayout.
 * Calls: api/loans.api.ts (printClearanceRecord).
 * Used by: TSG Staff to print an official equipment return and clearance certificate for a researcher.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Printer, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import * as loansApi from "@web/api/loans.api";
import type { ClearanceRecord, Loan } from "@shared/types/loans";
import { Button } from "@web/components/ui/button";
import { cn } from "@web/components/ui/utils";

/**
 * Clearance print page rendering Doc Joel's Appendix 4 Return and Clearance Form.
 * Fetches clearance record using POST /api/users/:userId/clearance-record.
 */
export function ClearancePrintPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [record, setRecord] = useState<ClearanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setError("No user ID specified.");
      setLoading(false);
      return;
    }

    let isMounted = true;
    loansApi
      .printClearanceRecord(userId)
      .then((res) => {
        if (!isMounted) return;
        if (!res.success) {
          setError(res.error || "Failed to load clearance record.");
        } else {
          setRecord({
            person: res.person,
            cleared: res.cleared,
            loans: (res.loans as Loan[]) || [],
          });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err?.message || "Failed to connect to server.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // The page opens in its own tab from the Clearance tab, so Back closes it. A tab the browser will not close (one opened by
  // a pasted link) stays open, and then Back goes to the previous page instead.
  const handleBack = () => {
    window.close();
    setTimeout(() => {
      if (!window.closed) navigate(-1);
    }, 100);
  };

  const handlePrint = () => {
    if (!record) return;
    const lastName = record.person.name.split(" ").slice(-1)[0] || "borrower";
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const safeLastName = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");

    const oldTitle = document.title;
    document.title = `clearance_${safeLastName}_${yyyy}${mm}${dd}`;
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="text-center p-6">
          <p className="text-sm font-semibold text-foreground">Preparing official clearance record...</p>
          <p className="text-xs text-muted-foreground mt-1">Calling clearance logging service</p>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 shadow-sm text-center">
          <AlertTriangle className="mx-auto text-destructive mb-3" size={36} />
          <h2 className="text-base font-bold text-foreground mb-2">Unable to Prepare Clearance Record</h2>
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded p-3 mb-4">
            {error || "Clearance record not found."}
          </p>
          <Button variant="outline" size="sm" onClick={handleBack} className="gap-1.5 text-xs">
            <ArrowLeft size={13} />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { person, cleared, loans } = record;
  const labList = person.labs.map((l) => l.code).join(", ") || "None";
  const now = new Date();
  const dateFormatted = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 py-6 px-4 print:p-0 print:bg-white">
      {/* Top action bar: hidden when printing */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between gap-3 print:hidden">
        <Button variant="outline" size="sm" onClick={handleBack} className="gap-1.5 text-xs bg-white">
          <ArrowLeft size={13} />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs"
          >
            <Printer size={13} />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-300 shadow-sm p-8 print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
          <p className="text-xs font-semibold tracking-wider uppercase text-slate-600">
            De La Salle University - Manila
          </p>
          <p className="text-sm font-bold uppercase text-slate-800">
            College of Computer Studies
          </p>
          <p className="text-xs font-semibold uppercase text-slate-600">
            Advanced Research and Innovation Center (AdRIC)
          </p>
          <h1 className="text-lg font-extrabold uppercase tracking-wide text-slate-950 mt-2">
            Asset Return and Clearance Record
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Appendix 4 - CCS Equipment Monitoring Policies
          </p>
        </div>

        {/* Person / Account Details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded mb-6 text-xs">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Responsible Person</p>
            <p className="font-bold text-slate-900 mt-0.5">{person.name}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ID Number</p>
            <p className="font-semibold text-slate-800 mt-0.5">{person.idNumber ?? "N/A"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Affiliated Labs</p>
            <p className="font-semibold text-slate-800 mt-0.5">{labList}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date Evaluated</p>
            <p className="font-semibold text-slate-800 mt-0.5">{dateFormatted}</p>
          </div>
        </div>

        {/* Clearance Determination Banner */}
        <div
          className={cn(
            "p-4 rounded border-2 mb-6 flex items-center justify-between",
            cleared
              ? "bg-emerald-50 border-emerald-600 text-emerald-950"
              : "bg-red-50 border-red-600 text-red-950"
          )}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              {cleared ? (
                <CheckCircle2 size={18} className="text-emerald-700" />
              ) : (
                <XCircle size={18} className="text-red-700" />
              )}
              <span className="text-sm font-extrabold uppercase tracking-wide">
                Clearance Issued: {cleared ? "YES" : "NO"}
              </span>
            </div>
            <p className="text-xs">
              {cleared
                ? "The borrower has returned all borrowed assets and has no pending liabilities, unpaid damages, or active loans."
                : "The borrower currently holds active loans, unreturned equipment, or items pending release. Clearance is withheld until all assets are received by TSG."}
            </p>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <span
              className={cn(
                "inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-widest border",
                cleared
                  ? "bg-emerald-700 text-white border-emerald-800"
                  : "bg-red-700 text-white border-red-800"
              )}
            >
              {cleared ? "CLEARED" : "HOLD"}
            </span>
          </div>
        </div>

        {/* Released Loans Record Table */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-300 pb-1">
            Asset Loan and Return History
          </h2>

          {loans.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 italic">
              No asset loan records registered for this account.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-[11px] border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300 font-bold">Loan ID</th>
                    <th className="p-2 border-r border-slate-300 font-bold">Asset Tag & Name</th>
                    <th className="p-2 border-r border-slate-300 font-bold">Status</th>
                    <th className="p-2 border-r border-slate-300 font-bold">Return Date</th>
                    <th className="p-2 border-r border-slate-300 font-bold">Return Condition</th>
                    <th className="p-2 border-r border-slate-300 font-bold">Accessories</th>
                    <th className="p-2 font-bold">TSG Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => {
                    const ret = loan.returnInspection;
                    return (
                      <tr key={loan.loanId} className="border-b border-slate-200">
                        <td className="p-2 border-r border-slate-200 font-bold text-slate-800">
                          LOAN-{loan.loanId}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-medium">
                          {loan.asset.tag} - {loan.asset.name}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <span
                            className={cn(
                              "font-semibold text-[10px] px-1.5 py-0.5 rounded",
                              loan.status === "RETURNED"
                                ? "bg-emerald-100 text-emerald-800"
                                : loan.isOverdue
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                            )}
                          >
                            {loan.statusLabel}
                          </span>
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          {loan.closedAt
                            ? new Date(loan.closedAt).toLocaleDateString()
                            : "Still Out"}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-medium">
                          {ret ? ret.conditionLabel : "N/A"}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          {ret?.missingAccessories ? (
                            <span className="text-red-700 font-semibold">{ret.missingAccessories}</span>
                          ) : (
                            "Complete"
                          )}
                        </td>
                        <td className="p-2 text-slate-600 italic">
                          {ret?.remarks || "N/A"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Signatures Section */}
        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-xs">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-10">Evaluated & Issued By:</p>
            <div className="border-b border-slate-900 w-4/5 pb-1">
              <span className="font-semibold text-slate-700">TSG Staff Representative</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Signature over printed name / Date</p>
          </div>

          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-10">Acknowledged By:</p>
            <div className="border-b border-slate-900 w-4/5 pb-1">
              <span className="font-semibold text-slate-700">{person.name}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Responsible Person / Date</p>
          </div>
        </div>

        {/* Footer Policy Reference */}
        <div className="mt-12 text-[10px] text-slate-400 text-center border-t border-slate-200 pt-3">
          This clearance record certifies asset custody status at the date of evaluation under DLSU CCS AdRIC policy.
        </div>
      </div>
    </div>
  );
}
