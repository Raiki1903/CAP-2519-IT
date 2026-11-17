/**
 * Printable Asset Inventory Report page for the AdRIC Director.
 * Layer: page. Mounted by app/routes.tsx at /adric-director/reports/print outside RootLayout.
 * Calls: state/session.tsx, state/serverData.tsx, features/reports/inventoryReport.ts, features/assets/assetBadges.ts, components/print/ReportLetterhead.tsx.
 * Used by: AdRIC Director to print or save the filtered Inventory Report as an A4 landscape PDF.
 */
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { Printer, ArrowLeft, ShieldAlert } from "lucide-react";
import { useSession, sessionRoleLabel } from "@web/state/session";
import { useServerData } from "@web/state/serverData";
import { filterInventoryReport } from "@web/features/reports/inventoryReport";
import { assetStatusLabel } from "@web/features/assets/assetBadges";
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
 * Formats a numeric peso amount for display in the report metadata and table.
 *
 * @param amount numeric peso value
 * @returns formatted PHP string
 */
function formatPeso(amount: number): string {
  return `PHP ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Renders the printable A4 landscape Asset Inventory Report filtered by URL query parameters.
 */
export function InventoryReportPrintPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { role, currentUser, restoring } = useSession();
  const { assets, isDbLoading } = useServerData();

  const [roleSynced, setRoleSynced] = useState(false);
  useEffect(() => {
    if (!restoring) setRoleSynced(true);
  }, [restoring, role]);

  const q = searchParams.get("q") || "";
  const funding = searchParams.get("funding") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const handleBack = () => {
    window.close();
    setTimeout(() => {
      if (!window.closed) navigate(-1);
    }, 100);
  };

  const handleDownloadPdf = () => {
    const oldTitle = document.title;
    document.title = `inventory-report_${toDateStamp(new Date())}`;
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1000);
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

  const filteredAssets = filterInventoryReport(assets as any[], { q, funding, from, to });

  const totalValuation = filteredAssets.reduce((sum, a) => {
    return sum + Number(a.cost || a.acquisition_value || a.acquisitionValue || 0);
  }, 0);

  const totalPresentValue = filteredAssets.reduce((sum, a) => {
    return sum + Number(a.presentValue ?? 0);
  }, 0);

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

  const filterSummary = [
    `Search: ${q.trim() || "Any"}`,
    `Funding: ${!funding || funding === "ALL" ? "Any" : funding}`,
    `Acquired from: ${from || "Any"}`,
    `Acquired to: ${to || "Any"}`,
  ].join(" · ");

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 py-6 px-4 print:p-0 print:bg-white">
      <style>{`
        @page { size: A4 landscape; margin: 12mm; }
        @media print {
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* Non-printing action bar */}
      <div className="max-w-[1100px] mx-auto mb-4 flex items-center justify-between gap-3 print:hidden">
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
      <div className="max-w-[1100px] mx-auto bg-white border border-slate-300 shadow-sm p-8 print:max-w-none print:border-none print:shadow-none print:p-0">
        <ReportLetterhead
          title="Asset Inventory Report"
          metaRows={[
            { label: "Filters", value: filterSummary },
            { label: "Assets listed", value: `${filteredAssets.length}` },
            { label: "Total valuation", value: formatPeso(totalValuation) },
            { label: "Total present value", value: formatPeso(totalPresentValue) },
            { label: "Generated on", value: generatedOn },
            { label: "Generated by", value: `${userName} (${userRoleLabel})` },
          ]}
        />

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                <th className="p-1.5 border-r border-slate-300 font-bold">Asset ID</th>
                <th className="p-1.5 border-r border-slate-300 font-bold">ITS Property Tag</th>
                <th className="p-1.5 border-r border-slate-300 font-bold">Name</th>
                <th className="p-1.5 border-r border-slate-300 font-bold">Serial Number</th>
                <th className="p-1.5 border-r border-slate-300 font-bold">Manufacturer</th>
                <th className="p-1.5 border-r border-slate-300 font-bold">Category</th>
                <th className="p-1.5 border-r border-slate-300 font-bold">Funding</th>
                <th className="p-1.5 border-r border-slate-300 font-bold">Acquisition Date</th>
                <th className="p-1.5 border-r border-slate-300 font-bold text-right">Valuation</th>
                <th className="p-1.5 border-r border-slate-300 font-bold text-right">Present Value</th>
                <th className="p-1.5 border-r border-slate-300 font-bold">Availability</th>
                <th className="p-1.5 border-r border-slate-300 font-bold">Custodian</th>
                <th className="p-1.5 font-bold">Lab</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-4 text-center text-slate-500 italic">
                    No assets match these filters.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((a: any) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-200 break-inside-avoid"
                    style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                  >
                    <td className="p-1.5 border-r border-slate-200 font-mono font-bold text-slate-900">{a.id}</td>
                    <td className="p-1.5 border-r border-slate-200 font-mono">{a.itsPropertyTag || "None"}</td>
                    <td className="p-1.5 border-r border-slate-200 font-semibold text-slate-900">{a.name}</td>
                    <td className="p-1.5 border-r border-slate-200 font-mono">{a.serial || a.serial_number || ""}</td>
                    <td className="p-1.5 border-r border-slate-200">{a.manufacturer || ""}</td>
                    <td className="p-1.5 border-r border-slate-200">{a.category || ""}</td>
                    <td className="p-1.5 border-r border-slate-200">{a.funding || "Unspecified"}</td>
                    <td className="p-1.5 border-r border-slate-200 font-mono">{a.procurement_date || a.procured || ""}</td>
                    <td className="p-1.5 border-r border-slate-200 font-mono text-right">
                      {`PHP ${Number(a.cost || 0).toLocaleString()}`}
                    </td>
                    <td className="p-1.5 border-r border-slate-200 font-mono text-right">
                      {a.presentValue !== null && a.presentValue !== undefined
                        ? `PHP ${Number(a.presentValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : ""}
                    </td>
                    <td className="p-1.5 border-r border-slate-200">{assetStatusLabel(a.status)}</td>
                    <td className="p-1.5 border-r border-slate-200">{a.custodian || "None"}</td>
                    <td className="p-1.5">{a.lab || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center border-t border-slate-200 pt-3">
          End of report
        </p>
      </div>
    </div>
  );
}
