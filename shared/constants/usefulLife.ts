/**
 * The straight-line depreciation formula for an asset's present value. Each category's useful life is
 * asset_categories.useful_life_years (5 years for the 20 first categories, following government practice for ICT
 * equipment, COA guidelines on depreciable life), changed on the Reference Data page.
 * Layer: shared. Imported by server/features/assets/assets.service.ts and server/features/retirements/retirements.service.ts.
 * Imports nothing.
 * Used by: every asset's present value, in the asset list, the asset modal, and the Director's Inventory Report.
 */

/**
 * Full years from a procurement date to today. A date in the future counts as 0, never negative.
 *
 * @param procurementDate yyyy-mm-dd
 * @param today yyyy-mm-dd
 */
function wholeYearsSince(procurementDate: string, today: string): number {
  const [procYear, procMonth, procDay] = procurementDate.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);

  let years = todayYear - procYear;
  if (todayMonth < procMonth || (todayMonth === procMonth && todayDay < procDay)) {
    years -= 1;
  }
  return Math.max(0, years);
}

/**
 * An asset's present value by straight-line depreciation: the acquisition value times the share of its
 * useful life left, never below 0, rounded to 2 decimals.
 *
 * @param acquisitionValue what the asset cost, or null if never recorded
 * @param procurementDate yyyy-mm-dd, or null if never recorded
 * @param usefulLifeYears the asset category's useful life (asset_categories.useful_life_years)
 * @param today yyyy-mm-dd, the one "today" (server/shared/services/assetState.ts serverToday())
 * @returns the present value, or null when the acquisition value or the procurement date is missing
 */
export function presentValue(
  acquisitionValue: number | null,
  procurementDate: string | null,
  usefulLifeYears: number,
  today: string,
): number | null {
  if (acquisitionValue === null || procurementDate === null) return null;

  const yearsOwned = wholeYearsSince(procurementDate, today);
  const shareLeft = Math.max(0, 1 - yearsOwned / usefulLifeYears);
  return Math.round(acquisitionValue * shareLeft * 100) / 100;
}
