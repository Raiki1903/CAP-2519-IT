import express from 'express';
import * as inspectionsController from './inspections.controller';

export const inspectionsRouter = express.Router();

inspectionsRouter.post('/api/assets/:assetTag/inspection', inspectionsController.fileReport);
inspectionsRouter.get('/api/asset_reports', inspectionsController.listReportSummaries);
inspectionsRouter.get('/api/asset-reports', inspectionsController.listInspectionReports);
