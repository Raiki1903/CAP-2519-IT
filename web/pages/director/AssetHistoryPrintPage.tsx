/**
 * Printable Asset History Report page for the AdRIC Director.
 * Layer: page. Mounted by app/routes.tsx at /adric-director/assets/:assetTag/history/print outside RootLayout.
 * Calls: state/session.tsx, state/serverData.tsx, features/reports/assetHistoryReport.ts, components/print/ReportLetterhead.tsx.
 * Used by: AdRIC Director to print or save an asset's full lifecycle history as an A4 portrait PDF.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Printer, ArrowLeft, ShieldAlert, AlertTriangle } from "lucide-react";
import { useSession, sessionRoleLabel } from "@web/state/session";
import { useServerData } from "@web/state/serverData";
import { buildAssetHistory } from "@web/features/reports/assetHistoryReport";
import { ReportLetterhead } from "@web/components/print/ReportLetterhead";
import { Button } from "@web/components/ui/button";

/**
 * Formats a Date into YYYYMMDD for the suggested PDF filename.
 *
 * @param d the date to format
 * @returns an 8-digit date stamp
 */
function toDateStamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

/**
 * Renders the printable A4 portrait Asset History Report for a single asset tag.
 */
export function AssetHistoryPrintPage() {
  const { assetTag } = useParams<{ assetTag: string }>();
  const navigate = useNavigate();
  const { role, currentUser, restoring } = useSession();
  const { assets, tickets = [], isDbLoading } = useServerData();

  const [roleSynced, setRoleSynced] = useState(false);
  useEffect(() => {
    if (!restoring) setRoleSynced(true);
  }, [restoring, role]);

  const handleBack = () => {
    window.close();
    setTimeout(() => {
      if (!window.closed) navigate(-1);
    }, 100);
  };

  if (restoring || !roleSynced || isDbLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 text-slate-900">
        <p className="text-xs font-semibold text-slate-600">Loading report...</p>
      </div>
    );
  }

  if (role !== "AdRICDirector") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 text-slate-900">
        <div className="max-w-md w-full bg-white border border-slate-300 p-6 rounded-xl shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert size={24} />
          </div>
          <p className="text-sm font-semibold text-slate-900">This report is for the AdRIC Director.</p>
          <Button size="sm" variant="outline" onClick={handleBack} className="gap-1.5 text-xs font-semibold">
            <ArrowLeft size={13} />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const asset = (assets as any[]).find((a) => a.id === assetTag);

  if (!asset) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 text-slate-900">
        <div className="max-w-md w-full bg-white border border-slate-300 p-6 rounded-xl shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle size={24} />
          </div>
          <p className="text-sm font-semibold text-slate-900">No asset with that tag.</p>
          <Button size="sm" variant="outline" onClick={handleBack} className="gap-1.5 text-xs font-semibold">
            <ArrowLeft size={13} />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { details, repairLogs, inspectionReports, retirementDetails } = buildAssetHistory(asset, tickets);

  const handleDownloadPdf = () => {
    const oldTitle = document.title;
    document.title = `asset-history_${details.assetId}_${toDateStamp(new Date())}`;
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1000);
  };

  const now = new Date();
  const generatedOn = now.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const userName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
    : "AdRIC Director";
  const userRoleLabel = currentUser?.roleLabel || sessionRoleLabel(role, currentUser?.staffUnit);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 py-6 px-4 print:p-0 print:bg-white">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* Non-printing action bar */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between gap-3 print:hidden">
        <Button variant="outline" size="sm" onClick={handleBack} className="gap-1.5 text-xs bg-white">
          <ArrowLeft size={13} />
          Close Report
        </Button>
        <Button
          size="sm"
          onClick={handleDownloadPdf}
          className="gap-1.5 text-xs font-bold bg-[#005A36] hover:bg-[#004225] text-white"
        >
          <Printer size={13} />
          Download PDF
        </Button>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-300 shadow-sm p-8 space-y-6 text-xs print:max-w-none print:border-none print:shadow-none print:p-0">
        <ReportLetterhead
          title="Asset History Report"
          metaRows={[
            { label: "Asset tag", value: details.assetId },
            { label: "Generated on", value: generatedOn },
            { label: "Generated by", value: `${userName} (${userRoleLabel})` },
          ]}
        />

        {/* Section 1: Details */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
            Details
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Asset ID</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">{details.assetId}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Asset Name</p>
              <p className="font-semibold text-slate-900 mt-0.5">{details.assetName}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Serial Number</p>
              <p className="font-mono text-slate-800 mt-0.5">{details.serialNumber || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Manufacturer</p>
              <p className="text-slate-800 mt-0.5">{details.manufacturer || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Funding Source</p>
              <p className="font-semibold text-slate-800 mt-0.5">{details.fundingSource || "Unspecified"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Acquisition Date</p>
              <p className="font-mono text-slate-800 mt-0.5">{details.acquisitionDate || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Purchase Valuation</p>
              <p className="font-mono font-semibold text-slate-800 mt-0.5">{details.purchaseValuation}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ITS Property Tag</p>
              <p className="font-mono text-slate-800 mt-0.5">{details.itsPropertyTag}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">TSG Property Tag</p>
              <p className="font-mono text-slate-800 mt-0.5">{details.tsgPropertyTag}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Availability</p>
              <p className="font-bold text-slate-900 mt-0.5">{details.availability}</p>
            </div>
          </div>
        </section>

        {/* Section 2: Repair and Maintenance Logs */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
            Repair and Maintenance Logs
          </h2>
          {repairLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-2 italic">No technical repair logs registered.</p>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300 font-bold">Repair ID</th>
                    <th className="p-2 border-r border-slate-300 font-bold">Issue Type</th>
                    <th className="p-2 border-r border-slate-300 font-bold">Status</th>
                    <th className="p-2 border-r border-slate-300 font-bold">Description</th>
                    <th className="p-2 border-r border-slate-300 font-bold">Reported By</th>
                    <th className="p-2 font-bold">Reported At</th>
                  </tr>
                </thead>
                <tbody>
                  {repairLogs.map((r) => (
                    <tr
                      key={r.repairId}
                      className="border-b border-slate-200 break-inside-avoid"
                      style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                    >
                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900">{r.repairId}</td>
                      <td className="p-2 border-r border-slate-200 font-medium">{r.issueType}</td>
                      <td className="p-2 border-r border-slate-200">{r.status}</td>
                      <td className="p-2 border-r border-slate-200">{r.description}</td>
                      <td className="p-2 border-r border-slate-200">{r.reportedBy}</td>
                      <td className="p-2 font-mono">{r.reportedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section 3: Routine Inspection Reports */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
            Routine Inspection Reports
          </h2>
          {inspectionReports.length === 0 ? (
            <p className="text-xs text-slate-500 py-2 italic">No physical routine inspections logged.</p>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300 font-bold">Report ID</th>
                    <th className="p-2 border-r border-slate-300 font-bold">Inspector</th>
                    <th className="p-2 border-r border-slate-300 font-bold">Date Logged</th>
                    <th className="p-2 border-r border-slate-300 font-bold">Condition / Status</th>
                    <th className="p-2 font-bold">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectionReports.map((rpt, idx) => (
                    <tr
                      key={rpt.reportId || idx}
                      className="border-b border-slate-200 break-inside-avoid"
                      style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                    >
                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900">{rpt.reportId}</td>
                      <td className="p-2 border-r border-slate-200 font-medium">{rpt.inspector}</td>
                      <td className="p-2 border-r border-slate-200 font-mono">{rpt.dateLogged}</td>
                      <td className="p-2 border-r border-slate-200">{rpt.conditionStatus}</td>
                      <td className="p-2">{rpt.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section 4: Retirement Details (only if Retired) */}
        {retirementDetails && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
              Retirement Details
            </h2>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-1.5">
              <p><strong>Retirement ID:</strong> {retirementDetails.retirementId}</p>
              <p><strong>Retirement Date:</strong> {retirementDetails.retirementDate}</p>
              <p><strong>Retired By:</strong> {retirementDetails.retiredBy}</p>
              <p><strong>Pathway:</strong> {retirementDetails.pathway}</p>
              <p><strong>Breakdown Reasons:</strong> {retirementDetails.breakdownReasons}</p>
            </div>
          </section>
        )}

        <p className="mt-6 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center border-t border-slate-200 pt-3">
          End of report
        </p>
      </div>
    </div>
  );
}
