/**
 * Inspection body and query checks: an inspection filing (the contract's InspectionInput), and the routine queue's
 * period and lab.
 * Layer: validation. Called by inspections.controller.ts. Calls shared/validation/inspectionInput.ts,
 * shared/errors/AppError.ts, and @shared (the routine period).
 * Used by: the Researcher's Self Report, Staff inspection finalize, and the Staff routine queue.
 */
import type { InspectionInput } from '@shared/types/assets';
import type { RoutineQueueFilters } from '@shared/types/inspections';
import { DEFAULT_ROUTINE_PERIOD_DAYS, MAX_ROUTINE_PERIOD_DAYS } from '@shared/constants/inspectionGroups';
import { AppError } from '../../shared/errors/AppError';
import { readInspectionInput } from '../../shared/validation/inspectionInput';

/**
 * Reads the body of POST /api/assets/:assetTag/inspection as the contract's InspectionInput: condition, health score,
 * missing accessories, remarks (at most 255 characters), photo, and metrics. Any other field is ignored.
 *
 * @param body the request body
 * @returns the inspection to file
 * @throws AppError 400 if the condition is missing or unknown, or another value is wrong
 */
export function readFilingBody(body: unknown): InspectionInput {
    return readInspectionInput(body, "inspection");
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
