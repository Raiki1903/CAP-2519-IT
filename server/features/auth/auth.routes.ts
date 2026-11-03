/**
 * Auth and registration route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls auth.controller.ts.
 * Used by: login for every role (Login), the session reload (state/session.tsx), the account page, and
 * self-registration (Register).
 */
import express from 'express';
import * as authController from './auth.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive } from '../../shared/middleware/permissions';

/** The five auth and registration endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const authRouter = express.Router();

// Public, with no session: register-request, login, and logout. /me and /account need a session and act on the
// session user's own account, whatever email is sent (C-06). A sign-up becomes a Pending account, which the IT Admin
// approves or rejects (features/users).
authRouter.post('/api/auth/register-request', authController.requestRegistration);
authRouter.post('/api/auth/login', authController.login);
authRouter.post('/api/auth/logout', authController.logout);
authRouter.get('/api/auth/me', requireAuth, requireActive, authController.getProfile);
authRouter.put('/api/auth/account', requireAuth, requireActive, authController.updateAccount);
