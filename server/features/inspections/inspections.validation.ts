/**
 * Inspection body and query checks: an inspection filing in either body (the contract's InspectionInput, or today's
 * reportCondition, reportRemarks, and reportImg), and the routine queue's period and lab.
 * Layer: validation. Called by inspections.controller.ts. Calls shared/validation/inspectionInput.ts,
 * shared/errors/AppError.ts, and @shared (conditions and the routine period).
 * Used by: the Researcher's Self Report, Staff inspection finalize, and the Staff routine queue.
 */
import type { InspectionInput } from '@shared/types/assets';
import type { InspectionReportInput, RoutineQueueFilters } from '@shared/types/inspections';
import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import { DEFAULT_ROUTINE_PERIOD_DAYS, MAX_ROUTINE_PERIOD_DAYS } from '@shared/constants/inspectionGroups';
import { AppError } from '../../shared/errors/AppError';
import { readInspectionInput } from '../../shared/validation/inspectionInput';

/** The remarks an inspection in today's body gets when it sends none. */
const DEFAULT_REPORT_REMARKS = "Routine technical inspection completed.";

/**
 * Checks that today's body names a known condition, in reportCondition or else assetCondition. Only the five
 * ASSET_CONDITIONS values are accepted. (issue #53)
 *
 * @param data the request body
 * @throws AppError 400 if no condition is sent, or it is not one of ASSET_CONDITIONS
 */
function checkInspectionReport(data: any): asserts data is InspectionReportInput {
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
 * Reads today's body as an InspectionInput. The remarks come from the first of five fields that is set, else a default
 * sentence, cut to the column's 255 characters. The image is the first of three fields that is set, else null.
 */
// The image text is stored as sent, without the image check that PUT /api/assets/:assetTag applies.
// Pinned by tests/api/inspections.test.ts; reusing the asset image check is its own fix.
function readInspectionReport(data: InspectionReportInput): InspectionInput {
    const remarks = String(data.reportRemarks || data.remarks || data.tsgRemarks || data.itsRemarks || data.description || DEFAULT_REPORT_REMARKS).slice(0, 255);
    return {
        condition: (data.reportCondition || data.assetCondition)!,
        healthScore: null,
        missingAccessories: null,
        remarks,
        photo: data.reportImg || data.image || data.image_url || null,
    };
}

/**
 * Reads the body of POST /api/assets/:assetTag/inspection. A body with `condition` is the contract's InspectionInput
 * (health score, missing accessories, remarks, photo, metrics); any other body is today's, read as before, until the
 * screens move to the new one (Batch 5, Q1).
 *
 * @param body the request body
 * @returns the inspection to file
 * @throws AppError 400 if the condition is missing or unknown, or another value is wrong
 */
export function readFilingBody(body: unknown): InspectionInput {
    if (body && typeof body === 'object' && 'condition' in body) return readInspectionInput(body, "inspection");
    checkInspectionReport(body);
    return readInspectionReport(body);
}

/**
 * Reads the routine queue's query string: the period in days (default DEFAULT_ROUTINE_PERIOD_DAYS) and an optional lab.
 *
 * @param query the request's query string
 * @throws AppError 400 if days is not a whole number from 1 to MAX_ROUTINE_PERIOD_DAYS, or centerId is not a lab id
 */
export function readRoutineQueueQuery(query: Record<string, unknown>): RoutineQueueFilters {
    const filters: RoutineQueueFilters = { days: DEFAULT_ROUTINE_PERIOD_DAYS };
    const days = typeof query.days === 'string' ? query.days.trim() : '';
    if (days) {
        if (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > MAX_ROUTINE_PERIOD_DAYS) {
            throw new AppError(400, `days must be a whole number from 1 to ${MAX_ROUTINE_PERIOD_DAYS}.`);
        }
        filters.days = Number(days);
    }
    const centerId = typeof query.centerId === 'string' ? query.centerId.trim() : '';
    if (centerId) {
        if (!/^\d+$/.test(centerId)) throw new AppError(400, "centerId must be a lab id.");
        filters.centerId = Number(centerId);
    }
    return filters;
}
