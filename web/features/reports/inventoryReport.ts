/**
 * Pure filter helper for the Director's Asset Inventory Report.
 * Layer: feature component (report logic). Called by pages/director/AdRICDirectorDashboard.tsx and pages/director/InventoryReportPrintPage.tsx.
 * Calls: nothing.
 * Used by: AdRIC Director inventory report screen, CSV export, and printable PDF report.
 */

/**
 * The funding_sources name for equipment a researcher bought with their own money (#167).
 * The Inventory Report filter matches names exactly, so it must equal the seeded and migrated row.
 */
export const PERSONAL_FUNDING = "Personal (self-funded)";

/**
 * Filter criteria for the Director's Inventory Report.
 */
export interface InventoryReportFilters {
  q: string;
  funding: string;
  from: string;
  to: string;
}

/**
 * Filters the shared asset list by search text, funding source, and acquisition date range.
 *
 * @param assets the full asset list from useServerData()
 * @param f search query, funding source filter ("ALL" or empty for any), and start/end dates
 * @returns the assets matching all active filter criteria
 */
export function filterInventoryReport(assets: any[], f: InventoryReportFilters): any[] {
  const query = (f.q || "").toLowerCase().trim();
  const fundingFilter = f.funding || "ALL";
  const dateFilterStart = f.from || "";
  const dateFilterEnd = f.to || "";

  return assets.filter((a) => {
    const fundingVal = a.funding || "";
    const matchQuery =
      (a.id || "").toLowerCase().includes(query) ||
      (a.name || "").toLowerCase().includes(query) ||
      (a.serial || a.serial_number || "").toLowerCase().includes(query) ||
      (a.lab || "").toLowerCase().includes(query) ||
      (a.itsPropertyTag || "").toLowerCase().includes(query) ||
      (a.tsgPropertyTag || "").toLowerCase().includes(query) ||
      (a.manufacturer || "").toLowerCase().includes(query);

    let matchFunding = true;
    if (fundingFilter === "GOVERNMENT") {
      matchFunding = ["DOST", "CHED", "USAST"].includes(fundingVal);
    } else if (fundingFilter === "PRIVATE") {
      matchFunding = ["USAID", "Internal Grants", PERSONAL_FUNDING].includes(fundingVal);
    } else if (fundingFilter !== "ALL") {
      matchFunding = fundingVal === fundingFilter;
    }

    let matchDate = true;
    const pDate = a.procurement_date || a.procured;
    if (dateFilterStart && pDate) {
      matchDate = matchDate && new Date(pDate).getTime() >= new Date(dateFilterStart).getTime();
    }
    if (dateFilterEnd && pDate) {
      matchDate = matchDate && new Date(pDate).getTime() <= new Date(dateFilterEnd).getTime();
    }

    return matchQuery && matchFunding && matchDate;
  });
}
