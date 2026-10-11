/**
 * Analytics route table: which URL maps to which controller. Every route is a read.
 * Layer: routes. Mounted by server/app.ts. Calls analytics.controller.ts.
 * Used by: the Director, Lab Head, and Staff analytics views. The idle-time, idle-frequency, and loan-recommender routes
 * have no live caller (their widgets are in legacy/analytics-widgets/) and stay live by team decision (2026-10-07).
 * The 22 old analytics endpoints are not here: they are in legacy/analytics-endpoints/, unregistered.
 */
import express from 'express';
import * as analyticsController from './analytics.controller';

/** The eight live analytics endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const analyticsRouter = express.Router();

// TODO(C-02): anyone who can reach the server can read these figures, including names, emails, and asset values; no session or role is checked. requireAuth and requireRole, step 13 (01C section 4.4).
analyticsRouter.get('/api/analytics/advanced/idle-time', analyticsController.getIdleTime);
analyticsRouter.get('/api/analytics/advanced/idle-frequency', analyticsController.getIdleFrequency);
analyticsRouter.get('/api/analytics/advanced/loan-recommender', analyticsController.getLoanRecommendations);
analyticsRouter.get('/api/analytics/location-status', analyticsController.getLocationStatus);
analyticsRouter.get('/api/analytics/advanced/inspection-progress', analyticsController.getInspectionProgress);
analyticsRouter.get('/api/analytics/director', analyticsController.getDirectorAnalytics);
analyticsRouter.get('/api/analytics/lab-head', analyticsController.getLabHeadAnalytics);
// The Staff dashboard's URL still says "tsg": renaming it changes the API the web app calls, so it is left as is.
analyticsRouter.get('/api/analytics/tsg', analyticsController.getTsgAnalytics);
