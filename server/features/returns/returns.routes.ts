/**
 * Return route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls returns.controller.ts.
 * Used by: Staff return finalization (ReturnForm). The list has no screen caller today.
 */
import express from 'express';
import * as returnsController from './returns.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireTsg } from '../../shared/middleware/permissions';

/** The two return endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const returnsRouter = express.Router();

// Every route needs a session, an Active account, and TSG: receiving a return is a physical step.
returnsRouter.post('/api/assets/:assetTag/return', requireAuth, requireActive, requireTsg, returnsController.finalizeReturn);
returnsRouter.get('/api/asset_returns', requireAuth, requireActive, requireTsg, returnsController.listReturns);
