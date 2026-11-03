/**
 * Counts assets per campus from each asset's home lab, so every page that shows campus totals counts the same way.
 * Layer: feature helper. Called by pages/director/AdRICDirectorDashboard.tsx and pages/staff/OverviewPage.tsx.
 * Calls nothing; reads the campus constants.
 * Used by: the Director Overview and the Staff Overview.
 */
import { CAMPUSES, CAMPUS_LABELS, type Campus } from "@shared/constants/campuses";

/** One campus with the number of assets whose home lab is on it. */
export interface CampusCount {
  campus: Campus;
  label: string;
  count: number;
}

/**
 * Counts the assets on each of the three campuses, in the order of CAMPUSES, 0 for an empty one.
 * An asset the server sent without a home lab is not counted (the server always sends one).
 *
 * @param assets the asset list, as the server sent it (each carries `homeLab.campus`)
 */
export function countAssetsByCampus(assets: { homeLab?: { campus: Campus } }[]): CampusCount[] {
  return CAMPUSES.map(campus => ({
    campus,
    label: CAMPUS_LABELS[campus],
    count: assets.filter(a => a.homeLab?.campus === campus).length,
  }));
}
