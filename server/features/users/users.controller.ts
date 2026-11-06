/**
 * Users controller: unpacks the IT Admin's account requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by users.routes.ts. Calls users.validation.ts, users.service.ts, and
 * shared/middleware/requireAuth.ts (sessionUserOf: who is acting).
 * Used by: the IT Admin's Approvals and Users pages.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts.
 */
import type { Request, Response } from 'express';
import * as usersService from './users.service';
import { readApproveSignUp, readRejectSignUp, readUserId, readUserListQuery } from './users.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/**
 * Handles GET /api/users?status=&role=&centerId=&q=: the accounts that pass the filters, as `{ success, users }`.
 * `status=PENDING` alone gives the Approvals list, oldest first. Answers 400 for a bad filter or an unknown lab, or 500.
 */
export async function listUsers(req: Request, res: Response): Promise<void> {
    const filters = readUserListQuery(req.query);
    res.json({ success: true, users: await usersService.listUsers(filters) });
}

/**
 * Handles PUT /api/users/:userId/approve: makes a Pending sign-up Active with one role and its labs.
 * Answers `{ success, user }`, or the AppError's status and message (400 bad role, no lab for a Researcher, or an
 * unknown lab; 404 no such account; 409 not Pending), or 500.
 */
export async function approveSignUp(req: Request<{ userId: string }>, res: Response): Promise<void> {
    const userId = readUserId(req.params.userId);
    const input = readApproveSignUp(req.body);
    const itAdminId = sessionUserOf(req).userId;

    const user = await usersService.approveSignUp(userId, input, itAdminId);

    console.log(`Sign-up of user ${userId} approved by user ${itAdminId}`);
    res.json({ success: true, user });
}

/**
 * Handles PUT /api/users/:userId/reject: makes a Pending sign-up Rejected.
 * Answers `{ success, user }`, or the AppError's status and message (400 remarks too long; 404 no such account;
 * 409 not Pending), or 500.
 */
export async function rejectSignUp(req: Request<{ userId: string }>, res: Response): Promise<void> {
    const userId = readUserId(req.params.userId);
    const input = readRejectSignUp(req.body);
    const itAdminId = sessionUserOf(req).userId;

    const user = await usersService.rejectSignUp(userId, input, itAdminId);

    console.log(`Sign-up of user ${userId} rejected by user ${itAdminId}`);
    res.json({ success: true, user });
}
