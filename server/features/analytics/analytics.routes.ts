import express from 'express';
import * as analyticsController from './analytics.controller';

/** The eight live analytics endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const analyticsRouter = express.Router();

analyticsRouter.get('/api/analytics/advanced/idle-time', analyticsController.getIdleTime);
analyticsRouter.get('/api/analytics/advanced/idle-frequency', analyticsController.getIdleFrequency);
analyticsRouter.get('/api/analytics/advanced/loan-recommender', analyticsController.getLoanRecommendations);
analyticsRouter.get('/api/analytics/location-status', analyticsController.getLocationStatus);
analyticsRouter.get('/api/analytics/advanced/inspection-progress', analyticsController.getInspectionProgress);
analyticsRouter.get('/api/analytics/director', analyticsController.getDirectorAnalytics);
analyticsRouter.get('/api/analytics/lab-head', analyticsController.getLabHeadAnalytics);
analyticsRouter.get('/api/analytics/tsg', analyticsController.getTsgAnalytics);
