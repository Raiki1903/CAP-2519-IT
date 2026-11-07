/**
 * Users controller: unpacks the IT Admin's account requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by users.routes.ts. Calls users.validation.ts, users.service.ts, and
 * shared/middleware/requireAuth.ts (sessionUserOf: who is acting).
 * Used by: the IT Admin's Approvals and Users pages.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts.
 */
import type { Request, Response } from 'express';
import * as usersService from './users.service';
import {
    readApproveSignUp, readCenterId, readChangeLabs, readChangeRole, readRejectSignUp, readSetLabHead, readUserId, readUserListQuery,
} from './users.validation';
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

/**
 * Handles PUT /api/users/:userId/role: gives an Active or Inactive account one role.
 * Answers `{ success, user }`, or the AppError's status and message (400 bad role or own account; 404 no such
 * account; 409 Pending, Rejected, anonymized, or heads a lab), or 500.
 */
export async function changeRole(req: Request<{ userId: string }>, res: Response): Promise<void> {
    const userId = readUserId(req.params.userId);
    const input = readChangeRole(req.body);
    const itAdminId = sessionUserOf(req).userId;

    const user = await usersService.changeRole(userId, input, itAdminId);

    console.log(`Role of user ${userId} changed by user ${itAdminId}`);
    res.json({ success: true, user });
}

/**
 * Handles PUT /api/users/:userId/labs: replaces the labs of an Active or Inactive account.
 * Answers `{ success, user }`, or the AppError's status and message (400 bad list, unknown lab, no lab for a
 * Researcher, or own account; 404 no such account; 409 Pending, Rejected, anonymized, or the lab it heads left out),
 * or 500.
 */
export async function changeLabs(req: Request<{ userId: string }>, res: Response): Promise<void> {
    const userId = readUserId(req.params.userId);
    const input = readChangeLabs(req.body);
    const itAdminId = sessionUserOf(req).userId;

    const user = await usersService.changeLabs(userId, input, itAdminId);

    console.log(`Labs of user ${userId} changed by user ${itAdminId}`);
    res.json({ success: true, user });
}

/**
 * Handles PUT /api/research-centers/:centerId/head: sets the lab's Head, or leaves it with none.
 * Answers `{ success, lab }`, or the AppError's status and message (400 bad body, or the new Head is not an Active
 * Researcher member of the lab; 404 no such lab or account; 409 heads another lab), or 500.
 */
export async function setLabHead(req: Request<{ centerId: string }>, res: Response): Promise<void> {
    const centerId = readCenterId(req.params.centerId);
    const input = readSetLabHead(req.body);
    const itAdminId = sessionUserOf(req).userId;

    const lab = await usersService.setLabHead(centerId, input, itAdminId);

    console.log(`Head of lab ${centerId} set by user ${itAdminId}`);
    res.json({ success: true, lab });
}

/**
 * Handles PUT /api/users/:userId/deactivate: makes an Active account Inactive.
 * Answers `{ success, user }`, or the AppError's status and message (400 own account; 404 no such account; 409 not
 * Active, heads a lab, or has an open loan), or 500.
 */
export async function deactivateUser(req: Request<{ userId: string }>, res: Response): Promise<void> {
    const userId = readUserId(req.params.userId);
    const itAdminId = sessionUserOf(req).userId;

    const user = await usersService.deactivateUser(userId, itAdminId);

    console.log(`User ${userId} deactivated by user ${itAdminId}`);
    res.json({ success: true, user });
}

/**
 * Handles PUT /api/users/:userId/reactivate: makes an Inactive account Active again.
 * Answers `{ success, user }`, or the AppError's status and message (404 no such account; 409 anonymized or not
 * Inactive), or 500.
 */
export async function reactivateUser(req: Request<{ userId: string }>, res: Response): Promise<void> {
    const userId = readUserId(req.params.userId);
    const itAdminId = sessionUserOf(req).userId;

    const user = await usersService.reactivateUser(userId, itAdminId);

    console.log(`User ${userId} reactivated by user ${itAdminId}`);
    res.json({ success: true, user });
}

/**
 * Handles PUT /api/users/:userId/anonymize: replaces the personal data of an Inactive or Rejected, cleared account.
 * Answers `{ success, user }`, or the AppError's status and message (400 own account; 404 no such account; 409
 * already anonymized, not Inactive or Rejected, or not cleared), or 500.
 */
export async function anonymizeUser(req: Request<{ userId: string }>, res: Response): Promise<void> {
    const userId = readUserId(req.params.userId);
    const itAdminId = sessionUserOf(req).userId;

    const user = await usersService.anonymizeUser(userId, itAdminId);

    console.log(`User ${userId} anonymized by user ${itAdminId}`);
    res.json({ success: true, user });
}
