/**
 * Inspection report body reading: turns the body's fields into the condition, remarks, and image a report stores.
 * Nothing is refused here: every field has a fallback, so an inspection is only ever refused for an unknown asset (404).
 * Layer: validation. Called by inspections.service.ts, after the asset and reporter lookups, where the
 * old handler read these fields. Calls nothing.
 * Used by: Custodian condition report, Staff inspection finalize.
 */
import type { InspectionReportInput } from '@shared/types/inspections';

// The display names the forms show, and the stored values, both mapped to the stored value.
const conditionMap: Record<string, any> = {
    "PERFECT": "PERFECT",
    "Perfect": "PERFECT",
    "OPERATIONAL": "OPERATIONAL",
    "Operational": "OPERATIONAL",
    "MINOR_DRIFT": "MINOR_DRIFT",
    "Minor Drift": "MINOR_DRIFT",
    "DEGRADED": "DEGRADED",
    "Degraded Performance": "DEGRADED",
    "CRITICAL_DEFECT": "CRITICAL_DEFECT",
    "Critical Defect": "CRITICAL_DEFECT",
};

/**
 * Reads the values a report stores from the body.
 * The condition comes from reportCondition, else assetCondition, else PERFECT. The remarks come from the first
 * of five fields that is set, else a default sentence, cut to the column's 255 characters. The image is the first
 * of three fields that is set, else null.
 *
 * @param data the request body
 * @returns the condition (an asset_reports_condition value), the remarks, and the image text or null
 */
// TODO(H-07): an unknown condition (a typo, lower case, or the stored spelling "MINOR DRIFT") is saved as PERFECT and written onto the asset, with 200 (issue #53). It should answer 400 and write nothing, as the return route does with ASSET_CONDITIONS. Its own fix; tests/api/inspections.test.ts pins it.
// The image text is stored as sent, without the image check that PUT /api/assets/:assetTag applies.
// Pinned by tests/api/inspections.test.ts; reusing the asset image check is its own fix.
export function readInspectionReport(data: InspectionReportInput): { condition: any; remarks: string; image: string | null } {
    const rawCond = String(data.reportCondition || data.assetCondition || "PERFECT").trim();
    const condition = conditionMap[rawCond] || "PERFECT";

    const remarksVal = String(data.reportRemarks || data.remarks || data.tsgRemarks || data.itsRemarks || data.description || "Routine technical inspection completed.").slice(0, 255);
    const imgVal = data.reportImg || data.image || data.image_url || null;

    return { condition, remarks: remarksVal, image: imgVal };
}
