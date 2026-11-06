/**
 * Loans per week query reading: the `weeks` and `centerId` of GET /api/analytics/utilization.
 * Layer: validation. Called by analytics.controller.ts. Calls insights.validation.ts (readCenterIdQuery) and shared/errors/AppError.ts.
 * Used by: the Director and Lab Head loans per week chart.
 */
import type { Request } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { readCenterIdQuery } from './insights.validation';

/** How many weeks are shown when the query names none. */
export const DEFAULT_WEEKS = 12;

/** The most weeks one request may ask for. */
export const MAX_WEEKS = 52;

/** The 400 message for a `weeks` outside 1 to 52. */
export const BAD_WEEKS_MESSAGE = `weeks must be a whole number from 1 to ${MAX_WEEKS}.`;

/** The loans per week filters, read from the query. */
export interface UtilizationQuery {
    weeks: number;
    /** The lab asked for, or null for every lab the viewer may see. */
    centerId: number | null;
}

/**
 * Reads the loans per week query. `weeks` defaults to 12 and `centerId` to none.
 *
 * @param query the request's query
 * @throws AppError 400 when `weeks` is not a whole number from 1 to 52, or `centerId` is not a positive whole number
 */
export function readUtilizationQuery(query: Request['query']): UtilizationQuery {
    const raw = query.weeks;
    let weeks = DEFAULT_WEEKS;
    if (raw !== undefined && raw !== '') {
        if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > MAX_WEEKS) throw new AppError(400, BAD_WEEKS_MESSAGE);
        weeks = Number(raw);
    }
    return { weeks, centerId: readCenterIdQuery(query) };
}
