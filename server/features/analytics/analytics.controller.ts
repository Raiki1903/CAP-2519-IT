/**
 * Analytics controller: reads the query, calls the service, and writes the JSON answers.
 * Layer: controller. Called by analytics.routes.ts. Calls analytics.validation.ts and analytics.service.ts.
 * Used by: the Director, Lab Head, and Staff analytics views.
 * Every route answers `{ success: true, data }`. None refuses with 400 or 404, so no AppError is thrown here.
 * Errors are not caught here: any failure falls through to shared/middleware/errorHandler.ts, which answers a generic 500
 * and logs the detail on the server.
 */
import type { Request, Response } from 'express';
import * as analyticsService from './analytics.service';
import { readCategoryQuery, readDirectorFilters, readLabHeadFilters, readLabQuery } from './analytics.validation';

/** Handles GET /api/analytics/advanced/idle-time: how long the ACTIVE assets have been idle, in three groups. Optional `?lab`. */
export async function getIdleTime(req: Request, res: Response): Promise<void> {
    const lab = readLabQuery(req.query);
    const data = await analyticsService.idleTime(lab);
    res.json({ success: true, data });
}

/** Handles GET /api/analytics/advanced/idle-frequency: the same idle times, in five ranges. Optional `?lab`. */
export async function getIdleFrequency(req: Request, res: Response): Promise<void> {
    const lab = readLabQuery(req.query);
    const data = await analyticsService.idleFrequency(lab);
    res.json({ success: true, data });
}

/** Handles GET /api/analytics/advanced/loan-recommender: every ACTIVE record as a loan suggestion. Optional `?category`. */
export async function getLoanRecommendations(req: Request, res: Response): Promise<void> {
    const targetCategory = readCategoryQuery(req.query);
    const recommendations = await analyticsService.loanRecommendations(targetCategory);
    res.json({ success: true, data: recommendations });
}

/** Handles GET /api/analytics/location-status: asset counts by campus, status, and lab. Optional `?lab`. */
export async function getLocationStatus(req: Request, res: Response): Promise<void> {
    const lab = readLabQuery(req.query);
    const data = await analyticsService.locationStatus(lab);
    res.json({ success: true, data });
}

/** Handles GET /api/analytics/advanced/inspection-progress: one progress entry per research center. */
export async function getInspectionProgress(req: Request, res: Response): Promise<void> {
    const progress = await analyticsService.inspectionProgress();
    res.json({ success: true, data: progress });
}

/** Handles GET /api/analytics/director: the Director dashboard. Optional `?lab`, `?startDate`, `?endDate`. */
export async function getDirectorAnalytics(req: Request, res: Response): Promise<void> {
    const filters = readDirectorFilters(req.query);
    const data = await analyticsService.directorDashboard(filters);
    res.json({ success: true, data });
}

/**
 * Handles GET /api/analytics/lab-head: the Lab Head dashboard. Optional `?labPrefix` (or `?lab`), `?startDate`, `?endDate`.
 * A repeated prefix makes the query reading throw a TypeError, which errorHandler answers with its generic 500.
 */
export async function getLabHeadAnalytics(req: Request, res: Response): Promise<void> {
    const filters = readLabHeadFilters(req.query);
    const data = await analyticsService.labHeadDashboard(filters);
    res.json({ success: true, data });
}

/** Handles GET /api/analytics/tsg: the Staff dashboard. It reads no query; the Staff view's dates are ignored. */
export async function getTsgAnalytics(req: Request, res: Response): Promise<void> {
    const data = await analyticsService.staffDashboard();
    res.json({ success: true, data });
}
