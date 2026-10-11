/**
 * Auth and registration route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls auth.controller.ts.
 * Used by: login for every role (Login), the session reload (state/session.tsx), the account page,
 * self-registration (Register), and the Lab Head's sign-up approvals (LabHeadDashboard, state/serverData.tsx).
 */
import express from 'express';
import * as authController from './auth.controller';

/** The eight auth and registration endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const authRouter = express.Router();

// TODO(C-02): no session or role is checked on any of these: anyone who can reach the server can list sign-ups with their passwords (C-04), approve them, or rename any account (C-06). requireAuth and requireRole, step 13.
// No screen calls /register; sign-ups go through register-request and a Lab Head's approval. 01D deletes it, in its own commit.
authRouter.post('/api/auth/register', authController.register);
authRouter.get('/api/auth/pending-registrations', authController.listPendingRegistrations);
authRouter.post('/api/auth/register-request', authController.requestRegistration);
authRouter.post('/api/auth/approve-registration', authController.approveRegistration);
authRouter.post('/api/auth/login', authController.login);
authRouter.post('/api/auth/reject-registration', authController.rejectRegistration);
authRouter.get('/api/auth/me', authController.getProfile);
authRouter.put('/api/auth/account', authController.updateAccount);
