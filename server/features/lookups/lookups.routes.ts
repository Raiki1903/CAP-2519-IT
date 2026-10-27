/**
 * Lookups route table: which URL maps to which controller. Both routes are reads.
 * Layer: routes. Mounted by server/app.ts. Calls lookups.controller.ts.
 * Used by: Edit Asset, Register Equipment, the borrow form, and the sign-up page.
 */
import express from 'express';
import * as lookupsController from './lookups.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';

/** The two lookups endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const lookupsRouter = express.Router();

// Public, with no session: the sign-up page has none, and the answer names no person. The custodian list has people's
// names, so it is Staff only (issue #12, answer 2).
lookupsRouter.get('/api/lookups', lookupsController.getFormLookups);
lookupsRouter.get('/api/lookups/users', requireAuth, requireRole('Staff'), lookupsController.getCustodianOptions);
