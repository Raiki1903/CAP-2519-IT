/**
 * Return route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls returns.controller.ts.
 * Used by: Staff return finalization (ReturnForm). The list has no screen caller today.
 */
import express from 'express';
import * as returnsController from './returns.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';

/** The two return endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const returnsRouter = express.Router();

// TODO(C-02): anyone who can reach the server can finalize a return and list returns; no session or role is checked. requireAuth and requireRole, step 13.
returnsRouter.post('/api/assets/:assetTag/return', requireAuth, requireRole('Staff'), returnsController.finalizeReturn);
returnsRouter.get('/api/asset_returns', requireAuth, requireRole('Staff'), returnsController.listReturns);
