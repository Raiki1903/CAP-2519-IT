/**
 * Analytics route table: which URL maps to which controller. Every route is a read.
 * Layer: routes. Mounted by server/app.ts. Calls analytics.controller.ts.
 * Used by: the Director, Lab Head, and Staff analytics views. The idle-time, idle-frequency, and loan-recommender routes
 * have no live caller (their widgets are in legacy/analytics-widgets/) and stay live by team decision (2026-10-07).
 * The 22 old analytics endpoints are not here: they are in legacy/analytics-endpoints/, unregistered.
 */
import express from 'express';
import * as analyticsController from './analytics.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';

/** The eight live analytics endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const analyticsRouter = express.Router();

// Every route needs a session and one role (the approved 13b role table, rows 33 to 40). idle-time, idle-frequency, and
// loan-recommender are called only by legacy widgets and stay registered (2026-10-07), for the Lab Head.
analyticsRouter.get('/api/analytics/advanced/idle-time', requireAuth, requireRole('LabHead'), analyticsController.getIdleTime);
analyticsRouter.get('/api/analytics/advanced/idle-frequency', requireAuth, requireRole('LabHead'), analyticsController.getIdleFrequency);
analyticsRouter.get('/api/analytics/advanced/loan-recommender', requireAuth, requireRole('LabHead'), analyticsController.getLoanRecommendations);
analyticsRouter.get('/api/analytics/location-status', requireAuth, requireRole('Staff'), analyticsController.getLocationStatus);
analyticsRouter.get('/api/analytics/advanced/inspection-progress', requireAuth, requireRole('Staff'), analyticsController.getInspectionProgress);
analyticsRouter.get('/api/analytics/director', requireAuth, requireRole('AdRICDirector'), analyticsController.getDirectorAnalytics);
analyticsRouter.get('/api/analytics/lab-head', requireAuth, requireRole('LabHead'), analyticsController.getLabHeadAnalytics);
// The Staff dashboard's URL still says "tsg": renaming it changes the API the web app calls, so it is left as is.
analyticsRouter.get('/api/analytics/tsg', requireAuth, requireRole('Staff'), analyticsController.getTsgAnalytics);
