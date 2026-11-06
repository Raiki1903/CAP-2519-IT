/**
 * Analytics controller: reads the query, calls the service, and writes the JSON answers.
 * Layer: controller. Called by analytics.routes.ts. Calls analytics.validation.ts and analytics.service.ts.
 * Used by: the Director, Lab Head, and Staff analytics views.
 * Every route but insights and utilization answers `{ success: true, data }`, and none of those refuses with 400 or 404. The
 * insights and utilization routes answer `{ success: true, ...fields }`; their 400 and 403 are thrown by the insights.* and
 * utilization.* validation and service files, and by analytics.scope.ts.
 * Errors are not caught here: any failure falls through to shared/middleware/errorHandler.ts, which answers a generic 500
 * and logs the detail on the server.
 */
import type { Request, Response } from 'express';
import * as analyticsService from './analytics.service';
import { readCategoryQuery, readDirectorFilters, readLabHeadFilters, readLabQuery } from './analytics.validation';
import * as insightsService from './insights.service';
import { readInsightsQuery } from './insights.validation';
import * as utilizationService from './utilization.service';
import { readUtilizationQuery } from './utilization.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

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
 * Handles GET /api/analytics/lab-head: the dashboard of the lab the session user heads. Optional `?startDate`,
 * `?endDate`; a lab in the query is not read, so a Lab Head sees only their own lab. (C-02)
 */
export async function getLabHeadAnalytics(req: Request, res: Response): Promise<void> {
    const filters = readLabHeadFilters(req.query);
    const data = await analyticsService.labHeadDashboard(filters, sessionUserOf(req));
    res.json({ success: true, data });
}

/** Handles GET /api/analytics/tsg: the Staff dashboard. It reads no query; the Staff view's dates are ignored. */
export async function getTsgAnalytics(req: Request, res: Response): Promise<void> {
    const data = await analyticsService.staffDashboard();
    res.json({ success: true, data });
}

/**
 * Handles GET /api/analytics/insights: the advice notes for the viewer's scope. Optional `?view` (operational, strategic,
 * or all) and `?centerId`. "Today" is never read from the query.
 */
export async function getInsights(req: Request, res: Response): Promise<void> {
    const query = readInsightsQuery(req.query);
    const data = await insightsService.insightsFor(sessionUserOf(req), query);
    res.json({ success: true, ...data });
}

/**
 * Handles GET /api/analytics/utilization: loans out and released per week, per lab and in total. Optional `?weeks` (1 to 52,
 * default 12) and `?centerId`. "Today" is never read from the query.
 */
export async function getUtilization(req: Request, res: Response): Promise<void> {
    const query = readUtilizationQuery(req.query);
    const data = await utilizationService.utilizationFor(sessionUserOf(req), query);
    res.json({ success: true, ...data });
}
