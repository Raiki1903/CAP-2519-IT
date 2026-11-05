/**
 * Inspection route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls inspections.controller.ts.
 * Used by: Custodian condition report (CustodianPortal), Staff inspection finalize and the routine queue
 * (InspectionQueue), the Staff inspection log (useInspectionReports), and state/serverData.tsx.
 */
import express from 'express';
import * as inspectionsController from './inspections.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireAnyRole, requireTsg } from '../../shared/middleware/permissions';

/**
 * The four inspection endpoints. Paths are written out in full, so app.ts mounts the router at the root.
 * GET /api/analytics/advanced/inspection-progress reads asset records, not reports, and moves with analytics.
 */
export const inspectionsRouter = express.Router();

// Every route needs a session and an Active account. TSG files a routine report and a Researcher a Self Report; the
// lists are for TSG, the Director, and the Secretary, and the routine queue for TSG. The IT Admin has no asset steps.
inspectionsRouter.post('/api/assets/:assetTag/inspection', requireAuth, requireActive, requireAnyRole('RESEARCHER', 'TSG_STAFF'), inspectionsController.fileReport);
inspectionsRouter.get('/api/inspections/routine-queue', requireAuth, requireActive, requireTsg, inspectionsController.routineQueue);
// The same reports under two paths and two shapes (L-07): the short list and the Staff log.
inspectionsRouter.get('/api/inspections', requireAuth, requireActive, requireAnyRole('TSG_STAFF', 'ADRIC_DIRECTOR', 'ADRIC_SECRETARY'), inspectionsController.listReportSummaries);
inspectionsRouter.get('/api/inspections/log', requireAuth, requireActive, requireAnyRole('TSG_STAFF', 'ADRIC_SECRETARY'), inspectionsController.listInspectionReports);
