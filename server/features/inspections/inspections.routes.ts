/**
 * Inspection route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls inspections.controller.ts.
 * Used by: Custodian condition report (CustodianPortal), Staff inspection finalize (InspectionQueue),
 * the Staff inspection log (useInspectionReports), and state/serverData.tsx.
 */
import express from 'express';
import * as inspectionsController from './inspections.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';

/**
 * The three inspection endpoints. Paths are written out in full, so app.ts mounts the router at the root.
 * GET /api/analytics/advanced/inspection-progress reads asset records, not reports, and moves with analytics.
 */
export const inspectionsRouter = express.Router();

// Every route needs a session; the roles are the approved 13b role table (rows 17 to 19).
inspectionsRouter.post('/api/assets/:assetTag/inspection', requireAuth, requireRole('Custodian', 'Staff'), inspectionsController.fileReport);
// The same reports under two paths and two shapes (L-07): the short list and the Staff log.
inspectionsRouter.get('/api/inspections', requireAuth, requireRole('Staff', 'AdRICDirector'), inspectionsController.listReportSummaries);
inspectionsRouter.get('/api/inspections/log', requireAuth, requireRole('Staff'), inspectionsController.listInspectionReports);
