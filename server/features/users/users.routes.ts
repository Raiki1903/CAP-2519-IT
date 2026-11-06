/**
 * Users route table: the IT Admin's account endpoints.
 * Layer: routes. Mounted by server/app.ts. Calls users.controller.ts.
 * Used by: the IT Admin's Approvals and Users pages.
 */
import express from 'express';
import * as usersController from './users.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireItAdmin } from '../../shared/middleware/permissions';

/** The account endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const usersRouter = express.Router();

// The IT Admin only, with an Active account. Every other role gets 403.
usersRouter.get('/api/users', requireAuth, requireActive, requireItAdmin, usersController.listUsers);
usersRouter.put('/api/users/:userId/approve', requireAuth, requireActive, requireItAdmin, usersController.approveSignUp);
usersRouter.put('/api/users/:userId/reject', requireAuth, requireActive, requireItAdmin, usersController.rejectSignUp);
usersRouter.put('/api/users/:userId/role', requireAuth, requireActive, requireItAdmin, usersController.changeRole);
usersRouter.put('/api/users/:userId/labs', requireAuth, requireActive, requireItAdmin, usersController.changeLabs);
usersRouter.put('/api/research-centers/:centerId/head', requireAuth, requireActive, requireItAdmin, usersController.setLabHead);
