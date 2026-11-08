/**
 * Disposal route table: which URL maps to which controller, and who may call it.
 * Layer: routes. Mounted by server/app.ts. Calls retirements.controller.ts.
 * Used by: TSG disposal requests (DisposalFormDialog) and completion, the Director's and the Secretary's decisions
 * (Disposal Approvals and the bell), and the screens that list disposals.
 */
import express from 'express';
import * as retirementsController from './retirements.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireAnyRole, requireRetirementDecider, requireTsg } from '../../shared/middleware/permissions';

/** The disposal endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const retirementsRouter = express.Router();

// Every route needs a session and an Active account. TSG requests and completes; the Director or the Secretary
// decides, never the requester (checked in the service).
retirementsRouter.post('/api/assets/:assetTag/retirement', requireAuth, requireActive, requireTsg, retirementsController.requestRetirement);
retirementsRouter.get('/api/retirements', requireAuth, requireActive, requireAnyRole('TSG_STAFF', 'ADRIC_DIRECTOR', 'ADRIC_SECRETARY', 'LAB_HEAD'), retirementsController.listRetirements);
retirementsRouter.get('/api/retirements/:retirementId', requireAuth, requireActive, requireAnyRole('TSG_STAFF', 'ADRIC_DIRECTOR', 'ADRIC_SECRETARY', 'LAB_HEAD'), retirementsController.getRetirement);
retirementsRouter.put('/api/retirements/:retirementId/decision', requireAuth, requireActive, requireRetirementDecider, retirementsController.decide);
retirementsRouter.put('/api/retirements/:retirementId/complete', requireAuth, requireActive, requireTsg, retirementsController.complete);
