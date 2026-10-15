/**
 * Auth and registration route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls auth.controller.ts.
 * Used by: login for every role (Login), the session reload (state/session.tsx), the account page,
 * self-registration (Register), and the Lab Head's sign-up approvals (LabHeadDashboard, state/serverData.tsx).
 */
import express from 'express';
import * as authController from './auth.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';

/** The nine auth and registration endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const authRouter = express.Router();

// Public, with no session: register-request, login, and logout. Every other route needs a session; the roles are the
// approved 13b role table (rows 3 to 8). /me and /account act on the session user's own account, whatever email is sent (C-06).
// No screen calls /register; sign-ups go through register-request and a Lab Head's approval. Lab Head only until 01D deletes it, in its own commit (issue #70).
authRouter.post('/api/auth/register', requireAuth, requireRole('LabHead'), authController.register);
authRouter.get('/api/auth/pending-registrations', requireAuth, requireRole('LabHead'), authController.listPendingRegistrations);
authRouter.post('/api/auth/register-request', authController.requestRegistration);
authRouter.post('/api/auth/approve-registration', requireAuth, requireRole('LabHead'), authController.approveRegistration);
authRouter.post('/api/auth/login', authController.login);
authRouter.post('/api/auth/logout', authController.logout);
authRouter.post('/api/auth/reject-registration', requireAuth, requireRole('LabHead'), authController.rejectRegistration);
authRouter.get('/api/auth/me', requireAuth, authController.getProfile);
authRouter.put('/api/auth/account', requireAuth, authController.updateAccount);
