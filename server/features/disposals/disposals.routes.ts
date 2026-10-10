/**
 * Disposal route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls disposals.controller.ts.
 * Used by: Staff disposal filing (DisposalFormDialog), Director approval (Approvals & Holds tab and the bell), and the screens that list disposals.
 */
import express from 'express';
import * as disposalsController from './disposals.controller';

/** The three disposal endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const disposalsRouter = express.Router();

// TODO(C-02): anyone who can reach the server can list, request, and decide disposals; no session or role is checked. requireAuth and requireRole, step 13.
disposalsRouter.post('/api/assets/:assetTag/disposal', disposalsController.requestDisposal);
disposalsRouter.get('/api/asset_disposals', disposalsController.listDisposals);
disposalsRouter.put('/api/asset_disposals/:disposalId/decision', disposalsController.decideDisposal);
