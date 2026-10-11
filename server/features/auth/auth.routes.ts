import express from 'express';
import * as authController from './auth.controller';

/** The eight auth and registration endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const authRouter = express.Router();

authRouter.post('/api/auth/register', authController.register);
authRouter.get('/api/auth/pending-registrations', authController.listPendingRegistrations);
authRouter.post('/api/auth/register-request', authController.requestRegistration);
authRouter.post('/api/auth/approve-registration', authController.approveRegistration);
authRouter.post('/api/auth/login', authController.login);
authRouter.post('/api/auth/reject-registration', authController.rejectRegistration);
authRouter.get('/api/auth/me', authController.getProfile);
authRouter.put('/api/auth/account', authController.updateAccount);
