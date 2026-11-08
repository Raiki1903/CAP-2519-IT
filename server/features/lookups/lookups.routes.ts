/**
 * Lookups route table: which URL maps to which controller. The one route is a read.
 * Layer: routes. Mounted by server/app.ts. Calls lookups.controller.ts.
 * Used by: Edit Asset, Register Asset, the borrow form, Report an issue, the inspection forms, and the sign-up page.
 */
import express from 'express';
import * as lookupsController from './lookups.controller';

/** The lookups endpoint. Paths are written out in full, so app.ts mounts the router at the root. */
export const lookupsRouter = express.Router();

// Public, with no session: the sign-up page has none, and the answer names no person.
lookupsRouter.get('/api/lookups', lookupsController.getFormLookups);
