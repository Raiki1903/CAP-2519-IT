/**
 * Inspection route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls inspections.controller.ts.
 * Used by: Custodian condition report (CustodianPortal), Staff inspection finalize (InspectionQueue),
 * the Staff inspection log (useInspectionReports), and state/serverData.tsx.
 */
import express from 'express';
import * as inspectionsController from './inspections.controller';

/**
 * The three inspection endpoints. Paths are written out in full, so app.ts mounts the router at the root.
 * GET /api/analytics/advanced/inspection-progress reads asset records, not reports, and moves with analytics.
 */
export const inspectionsRouter = express.Router();

// TODO(C-02): anyone who can reach the server can file and list reports, including every reporter's email; no session or role is checked. requireAuth and requireRole, step 13.
inspectionsRouter.post('/api/assets/:assetTag/inspection', inspectionsController.fileReport);
// The same reports under two spellings and two shapes (L-07). Both kept in step 12, as decided.
inspectionsRouter.get('/api/asset_reports', inspectionsController.listReportSummaries);
inspectionsRouter.get('/api/asset-reports', inspectionsController.listInspectionReports);
