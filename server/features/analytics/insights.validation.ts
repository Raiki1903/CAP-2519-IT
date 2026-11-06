/**
 * Insights query reading: the `view` and `centerId` of GET /api/analytics/insights.
 * Layer: validation. Called by analytics.controller.ts. Calls shared/errors/AppError.ts.
 * Used by: the Staff, Lab Head, and Director analytics insights.
 * The query never carries "today": the server takes it once per request.
 */
import type { Request } from 'express';
import { AppError } from '../../shared/errors/AppError';

/** Which notes to return. */
export type InsightsViewFilter = 'operational' | 'strategic' | 'all';

/** The insights filters, read from the query. */
export interface InsightsQuery {
    view: InsightsViewFilter;
    /** The lab asked for, or null for every lab the viewer may see. */
    centerId: number | null;
}

/** The 400 message for a `view` that is not one of the three. */
export const BAD_VIEW_MESSAGE = "view must be operational, strategic, or all.";

/** The 400 message for a `centerId` that is not a whole number. */
export const BAD_CENTER_MESSAGE = "centerId must be a lab id.";

/**
 * Reads the insights query. `view` defaults to all and `centerId` to none.
 *
 * @param query the request's query
 * @throws AppError 400 when `view` is not operational, strategic, or all, or `centerId` is not a positive whole number
 */
export function readInsightsQuery(query: Request['query']): InsightsQuery {
    const view = query.view ?? 'all';
    if (view !== 'operational' && view !== 'strategic' && view !== 'all') throw new AppError(400, BAD_VIEW_MESSAGE);
    const raw = query.centerId;
    if (raw === undefined || raw === '') return { view, centerId: null };
    if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < 1) throw new AppError(400, BAD_CENTER_MESSAGE);
    return { view, centerId: Number(raw) };
}
