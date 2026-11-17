/**
 * Shared letterhead for printable Director reports (Inventory Report and Asset History Report).
 * Layer: shared component (print). Called by pages/director/InventoryReportPrintPage.tsx and pages/director/AssetHistoryPrintPage.tsx.
 * Calls: shared/constants/adric.ts and assets/adric-logo.png.
 * Used by: AdRIC Director printable PDF reports.
 */
import type { ReactNode } from "react";
import { ADRIC_FULL_NAME } from "@shared/constants/adric";
import adricLogo from "@web/assets/adric-logo.png";

/**
 * One label and value pair shown in the report metadata block under the header.
 */
export interface ReportMetaRow {
  label: string;
  value: ReactNode;
}

/**
 * Props for ReportLetterhead.
 */
export interface ReportLetterheadProps {
  /** Report title, for example "Asset Inventory Report" or "Asset History Report". */
  title: string;
  /** Metadata rows rendered beneath the institution header. */
  metaRows: ReportMetaRow[];
}

/**
 * Renders the official DLSU CCS AdRIC letterhead with the AdRIC logo, full institute name,
 * report title, and metadata summary block.
 *
 * @param title the heading for the report
 * @param metaRows key-value rows summarizing filters, counts, valuation, and generation info
 */
export function ReportLetterhead({ title, metaRows }: ReportLetterheadProps) {
  return (
    <div className="mb-5 space-y-4">
      <div className="border-b-2 border-slate-900 pb-4 flex items-center gap-4">
        <img src={adricLogo} alt="AdRIC logo" className="h-14 w-auto shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-wider uppercase text-slate-600">
            De La Salle University - College of Computer Studies
          </p>
          <p className="text-sm font-extrabold tracking-tight text-slate-950 leading-snug">
            {ADRIC_FULL_NAME}
          </p>
          <h1 className="text-base font-extrabold uppercase tracking-wide text-emerald-800 mt-1">
            {title}
          </h1>
        </div>
      </div>

      {metaRows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-800">
          {metaRows.map((row) => (
            <div key={row.label} className="flex flex-wrap gap-1.5">
              <span className="font-bold text-slate-600">{row.label}:</span>
              <span className="text-slate-950 font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
