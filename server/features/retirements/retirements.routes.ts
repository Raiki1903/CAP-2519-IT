/**
 * Disposal route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls retirements.controller.ts.
 * Used by: Staff disposal filing (DisposalFormDialog), Director approval (Approvals & Holds tab and the bell), and the screens that list disposals.
 */
import express from 'express';
import * as retirementsController from './retirements.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';

/** The three disposal endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const retirementsRouter = express.Router();

// Every route needs a session; the roles are the approved 13b role table (rows 14 to 16).
retirementsRouter.post('/api/assets/:assetTag/retirement', requireAuth, requireRole('Staff'), retirementsController.requestDisposal);
retirementsRouter.get('/api/retirements', requireAuth, requireRole('Staff', 'AdRICDirector', 'LabHead'), retirementsController.listDisposals);
retirementsRouter.put('/api/retirements/:disposalId/decision', requireAuth, requireRole('AdRICDirector'), retirementsController.decideDisposal);
