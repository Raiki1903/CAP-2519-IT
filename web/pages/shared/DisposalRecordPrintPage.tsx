/**
 * Printable Asset Retirement Record, for a completed retirement.
 * Layer: page. Mounted by app/routes.tsx at /retirements/:retirementId/record outside RootLayout.
 * Calls: api/retirements.api.ts (getRetirement).
 * Used by: Staff and the Director, to print the official record of a completed retirement, opened from the asset modal.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Printer, ArrowLeft, AlertTriangle } from "lucide-react";
import * as retirementsApi from "@web/api/retirements.api";
import type { Retirement, RetirementRecordAsset } from "@shared/types/retirements";
import { Button } from "@web/components/ui/button";

/** A Retirement's PersonRef, as this screen shows it: the name, or "Not shown" for a hidden one. */
function personLabel(person: { userId: number; name: string } | { hidden: true } | null): string {
  if (!person) return "Not yet";
  return "userId" in person ? person.name : "Not shown";
}

/** A peso amount, in the format the asset modal and the Director's Inventory Report also use. */
function peso(amount: number): string {
  return `PHP ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A date-time as "Oct 9, 2026, 2:15 PM", or "Not yet" for null. */
function dateTime(iso: string | null): string {
  if (!iso) return "Not yet";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** A date as "June 1, 2025", or "Not recorded" for null. */
function longDate(value: string | null): string {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

interface Record_ {
  retirement: Retirement;
  asset: RetirementRecordAsset;
  presentValueAtCompletion: number | null;
}

/**
 * Displays the Asset Retirement Record for one retirement and handles printing it.
 * Fetches it with GET /api/retirements/:retirementId.
 */
export function DisposalRecordPrintPage() {
  const { retirementId } = useParams<{ retirementId: string }>();
  const navigate = useNavigate();

  const [record, setRecord] = useState<Record_ | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!retirementId) {
      setError("No retirement id specified.");
      setLoading(false);
      return;
    }

    let isMounted = true;
    retirementsApi
      .getRetirement(retirementId)
      .then((res) => {
        if (!isMounted) return;
        if (!res.success) {
          setError(res.error || "Failed to load the retirement record.");
        } else {
          setRecord({ retirement: res.retirement, asset: res.asset, presentValueAtCompletion: res.presentValueAtCompletion });
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
  }, [retirementId]);

  // The page opens in its own tab from the asset modal, so Back closes it. A tab the browser will not close (one
  // opened from a pasted link) stays open, and then Back goes to the previous page instead.
  const handleBack = () => {
    window.close();
    setTimeout(() => {
      if (!window.closed) navigate(-1);
    }, 100);
  };

  const handlePrint = () => {
    if (!record) return;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    const oldTitle = document.title;
    document.title = `retirement_RET-${record.retirement.retirementId}_${yyyy}${mm}${dd}`;
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="text-center p-6">
          <p className="text-sm font-semibold text-foreground">Preparing the retirement record...</p>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 shadow-sm text-center">
          <AlertTriangle className="mx-auto text-destructive mb-3" size={36} />
          <h2 className="text-base font-bold text-foreground mb-2">Unable to Prepare the Retirement Record</h2>
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded p-3 mb-4">
            {error || "Retirement record not found."}
          </p>
          <Button variant="outline" size="sm" onClick={handleBack} className="gap-1.5 text-xs">
            <ArrowLeft size={13} />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { retirement, asset, presentValueAtCompletion } = record;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 py-6 px-4 print:p-0 print:bg-white">
      {/* Top action bar: hidden when printing */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between gap-3 print:hidden">
        <Button variant="outline" size="sm" onClick={handleBack} className="gap-1.5 text-xs bg-white">
          <ArrowLeft size={13} />
          Back
        </Button>
        <Button size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
          <Printer size={13} />
          Print / Save PDF
        </Button>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-300 shadow-sm p-8 print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
          <p className="text-xs font-semibold tracking-wider uppercase text-slate-600">De La Salle University - Manila</p>
          <p className="text-sm font-bold uppercase text-slate-800">College of Computer Studies</p>
          <p className="text-xs font-semibold uppercase text-slate-600">Advanced Research and Innovation Center (AdRIC)</p>
          <h1 className="text-lg font-extrabold uppercase tracking-wide text-slate-950 mt-2">Asset Retirement Record</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">RET-{retirement.retirementId}</p>
        </div>

        {retirement.status !== "COMPLETED" ? (
          <div className="p-6 text-center text-sm text-slate-600 bg-slate-50 border border-dashed border-slate-300 rounded">
            RET-{retirement.retirementId} is {retirement.statusLabel}. The Asset Retirement Record is available only once a retirement is Completed.
          </div>
        ) : (
          <>
            {/* Asset section */}
            <div className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-300 pb-1">Asset</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-200 rounded text-xs">
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Asset Tag</p><p className="font-bold text-slate-900 mt-0.5">{asset.tag}</p></div>
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</p><p className="font-semibold text-slate-800 mt-0.5">{asset.name}</p></div>
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Serial Number</p><p className="font-semibold text-slate-800 mt-0.5">{asset.serialNumber ?? "Not recorded"}</p></div>
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Manufacturer</p><p className="font-semibold text-slate-800 mt-0.5">{asset.manufacturer ?? "Not recorded"}</p></div>
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</p><p className="font-semibold text-slate-800 mt-0.5">{asset.categoryLabel}</p></div>
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Home Lab</p><p className="font-semibold text-slate-800 mt-0.5">{asset.homeLab.name} ({asset.homeLab.code})</p></div>
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Home Room</p><p className="font-semibold text-slate-800 mt-0.5">{asset.homeRoom ?? "Not recorded"}</p></div>
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ITS Property Tag</p><p className="font-semibold text-slate-800 mt-0.5">{asset.itsPropertyTag ?? "Not recorded"}</p></div>
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">TSG Tag</p><p className="font-semibold text-slate-800 mt-0.5">{asset.tsgTag ?? "Not recorded"}</p></div>
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Procurement Date</p><p className="font-semibold text-slate-800 mt-0.5">{longDate(asset.procurementDate)}</p></div>
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Acquisition Value</p><p className="font-semibold text-slate-800 mt-0.5">{asset.acquisitionValue === null ? "Not recorded" : peso(asset.acquisitionValue)}</p></div>
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Present Value at Completion</p><p className="font-semibold text-slate-800 mt-0.5">{presentValueAtCompletion === null ? "Not recorded" : peso(presentValueAtCompletion)}</p></div>
              </div>
            </div>

            {/* Retirement section */}
            <div className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-300 pb-1">Retirement</h2>
              <div className="text-xs space-y-2 p-4 bg-slate-50 border border-slate-200 rounded">
                <p><strong>Reason:</strong> {retirement.reason}</p>
                <p><strong>Pathway:</strong> {retirement.pathwayLabel ?? "Not recorded"}</p>
                <p><strong>Disposition Reference:</strong> {retirement.dispositionReference ?? "Not recorded"}</p>
                <p><strong>Requested by:</strong> {personLabel(retirement.requestedBy)} on {dateTime(retirement.requestedAt)}</p>
                <p><strong>Approved by:</strong> {personLabel(retirement.decidedBy)} on {dateTime(retirement.decidedAt)}{retirement.decisionRemarks ? ` — ${retirement.decisionRemarks}` : ""}</p>
                <p><strong>Completed by:</strong> {personLabel(retirement.completedBy)} on {dateTime(retirement.completedAt)}</p>
                {retirement.assessmentInspection && (
                  <p>
                    <strong>Assessment Inspection:</strong> {retirement.assessmentInspection.conditionLabel}
                    {retirement.assessmentInspection.healthScore !== null ? `, score ${retirement.assessmentInspection.healthScore}` : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Signatures Section */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-xs">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-10">Released for retirement by:</p>
                <div className="border-b border-slate-900 w-4/5 pb-1">
                  <span className="font-semibold text-slate-700">TSG Staff Representative</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Signature over printed name / Date</p>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-10">Approved by:</p>
                <div className="border-b border-slate-900 w-4/5 pb-1">
                  <span className="font-semibold text-slate-700">AdRIC Director / Secretary</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Signature over printed name / Date</p>
              </div>
            </div>
          </>
        )}

        {/* Footer Policy Reference */}
        <div className="mt-12 text-[10px] text-slate-400 text-center border-t border-slate-200 pt-3">
          This record certifies the retirement of this asset from the DLSU CCS AdRIC registry.
        </div>
      </div>
    </div>
  );
}
