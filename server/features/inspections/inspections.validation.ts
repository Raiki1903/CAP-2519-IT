/**
 * Inspection report body checks and reading: is the condition one the database accepts, and the condition, remarks,
 * and image a report stores.
 * Layer: validation. Called by inspections.controller.ts (the check) and inspections.service.ts (the reading).
 * Calls shared/errors/AppError.ts and @shared/enums/assetCondition.
 * Used by: Custodian condition report, Staff inspection finalize.
 */
import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import type { InspectionReportInput } from '@shared/types/inspections';
import { AppError } from '../../shared/errors/AppError';

/**
 * Checks that an inspection body names a known condition, in reportCondition or else assetCondition.
 * The condition becomes the asset's condition and is stored on the report, so only the five ASSET_CONDITIONS
 * values are accepted, as on the return route. Both screens send one of them. (issue #53)
 *
 * @param data the request body
 * @throws AppError 400 if no condition is sent, or it is not one of ASSET_CONDITIONS
 */
export function checkInspectionReport(data: any): asserts data is InspectionReportInput {
    // A request with no JSON body has no req.body at all, so it is read with ?. and answers 400, not 500.
    const condition = data?.reportCondition || data?.assetCondition;
    if (!condition) {
        throw new AppError(400, "Missing required field: reportCondition.");
    }
    if (!ASSET_CONDITIONS.includes(condition)) {
        throw new AppError(400, `Unrecognized condition: ${condition}.`);
    }
}

/**
 * Reads the values a report stores from a checked body.
 * The condition is reportCondition, else assetCondition. The remarks come from the first of five fields that is set,
 * else a default sentence, cut to the column's 255 characters. The image is the first of three fields that is set, else null.
 *
 * @param data the request body, already checked by checkInspectionReport
 * @returns the condition (an asset_reports_condition value), the remarks, and the image text or null
 */
// The image text is stored as sent, without the image check that PUT /api/assets/:assetTag applies.
// Pinned by tests/api/inspections.test.ts; reusing the asset image check is its own fix.
export function readInspectionReport(data: InspectionReportInput): { condition: any; remarks: string; image: string | null } {
    const condition = data.reportCondition || data.assetCondition;

    const remarksVal = String(data.reportRemarks || data.remarks || data.tsgRemarks || data.itsRemarks || data.description || "Routine technical inspection completed.").slice(0, 255);
    const imgVal = data.reportImg || data.image || data.image_url || null;

    return { condition, remarks: remarksVal, image: imgVal };
}
