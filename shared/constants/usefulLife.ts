/**
 * Each category's useful life, for straight-line depreciation, and the formula that uses it.
 * Layer: shared. Imported by server/features/assets/assets.service.ts. Imports shared/enums/assetCategory.ts.
 * Used by: every asset's present value, in the asset list, the asset modal, and the Director's Inventory Report.
 */
import type { AssetCategory } from "../enums/assetCategory";

/**
 * Years of useful life per category, for straight-line depreciation.
 * Every category is 5 years today, following government practice for ICT equipment (COA guidelines on
 * depreciable life). The next team can change a category's value here without touching the formula.
 */
export const USEFUL_LIFE_YEARS: Record<AssetCategory, number> = {
  DEV_KIT: 5,
  MONITOR: 5,
  TV: 5,
  CPU: 5,
  KEYBOARD: 5,
  MOUSE: 5,
  CAMERA: 5,
  MEMORY_CARD: 5,
  PROJECTOR: 5,
  RECORDER: 5,
  ROUTER: 5,
  SIMULATOR: 5,
  TABLET: 5,
  VR: 5,
  PRINTER: 5,
  SWITCH: 5,
  HARD_DRIVE: 5,
  AUDIO: 5,
  VIDEO_CAMERA: 5,
  SPEAKER: 5,
};

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
 * @param usefulLifeYears the asset category's useful life (USEFUL_LIFE_YEARS)
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
