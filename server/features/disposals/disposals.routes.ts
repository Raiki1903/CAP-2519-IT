/**
 * Disposal route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls disposals.controller.ts.
 * Used by: Staff disposal filing (DisposalFormDialog), Director approval (Approvals & Holds tab and the bell), and the screens that list disposals.
 */
import express from 'express';
import * as disposalsController from './disposals.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';

/** The three disposal endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const disposalsRouter = express.Router();

// Every route needs a session; the roles are the approved 13b role table (rows 14 to 16).
disposalsRouter.post('/api/assets/:assetTag/disposal', requireAuth, requireRole('Staff'), disposalsController.requestDisposal);
disposalsRouter.get('/api/asset_disposals', requireAuth, requireRole('Staff', 'AdRICDirector', 'LabHead'), disposalsController.listDisposals);
disposalsRouter.put('/api/asset_disposals/:disposalId/decision', requireAuth, requireRole('AdRICDirector'), disposalsController.decideDisposal);
