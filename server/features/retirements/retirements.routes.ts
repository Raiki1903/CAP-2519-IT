/**
 * Disposal route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls retirements.controller.ts.
 * Used by: Staff disposal filing (DisposalFormDialog), Director approval (Approvals & Holds tab and the bell), and the screens that list disposals.
 */
import express from 'express';
import * as retirementsController from './retirements.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireAnyRole, requireRetirementDecider, requireTsg } from '../../shared/middleware/permissions';

/** The three disposal endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const retirementsRouter = express.Router();

// Every route needs a session and an Active account. TSG requests; the Director or the Secretary decides, never the
// requester (checked in the service).
retirementsRouter.post('/api/assets/:assetTag/retirement', requireAuth, requireActive, requireTsg, retirementsController.requestDisposal);
retirementsRouter.get('/api/retirements', requireAuth, requireActive, requireAnyRole('TSG_STAFF', 'ADRIC_DIRECTOR', 'ADRIC_SECRETARY', 'LAB_HEAD'), retirementsController.listDisposals);
retirementsRouter.put('/api/retirements/:disposalId/decision', requireAuth, requireActive, requireRetirementDecider, retirementsController.decideDisposal);
