import type { Request, Response } from 'express';
import * as analyticsService from './analytics.service';
import { readCategoryQuery, readDirectorFilters, readLabHeadFilters, readLabQuery } from './analytics.validation';

/** Handles GET /api/analytics/advanced/idle-time. */
export async function getIdleTime(req: Request, res: Response): Promise<void> {
    try {
        const lab = readLabQuery(req.query);
        const data = await analyticsService.idleTime(lab);
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
}

/** Handles GET /api/analytics/advanced/idle-frequency. */
export async function getIdleFrequency(req: Request, res: Response): Promise<void> {
    try {
        const lab = readLabQuery(req.query);
        const data = await analyticsService.idleFrequency(lab);
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
}

/** Handles GET /api/analytics/advanced/loan-recommender. */
export async function getLoanRecommendations(req: Request, res: Response): Promise<void> {
    try {
        const targetCategory = readCategoryQuery(req.query);
        const recommendations = await analyticsService.loanRecommendations(targetCategory);
        res.json({ success: true, data: recommendations });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
}

/** Handles GET /api/analytics/location-status. */
export async function getLocationStatus(req: Request, res: Response): Promise<void> {
    try {
        const lab = readLabQuery(req.query);
        const data = await analyticsService.locationStatus(lab);
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
}

/** Handles GET /api/analytics/advanced/inspection-progress. */
export async function getInspectionProgress(req: Request, res: Response): Promise<void> {
    try {
        const progress = await analyticsService.inspectionProgress();
        res.json({ success: true, data: progress });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
}

/** Handles GET /api/analytics/director. */
export async function getDirectorAnalytics(req: Request, res: Response): Promise<void> {
    try {
        const filters = readDirectorFilters(req.query);
        const data = await analyticsService.directorDashboard(filters);
        res.json({ success: true, data });
    } catch (error: any) {
        console.error("❌ Director analytics error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/** Handles GET /api/analytics/lab-head. */
export async function getLabHeadAnalytics(req: Request, res: Response): Promise<void> {
    try {
        const filters = readLabHeadFilters(req.query);
        const data = await analyticsService.labHeadDashboard(filters);
        res.json({ success: true, data });
    } catch (error: any) {
        console.error("❌ Lab Head analytics error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/** Handles GET /api/analytics/tsg. */
export async function getTsgAnalytics(req: Request, res: Response): Promise<void> {
    try {
        const data = await analyticsService.staffDashboard();
        res.json({ success: true, data });
    } catch (error: any) {
        console.error("❌ TSG analytics error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
