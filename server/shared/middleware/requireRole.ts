/**
 * requireRole: lets a request through only when the session's app role is one the route allows. (C-02)
 * Layer: shared (server middleware). Put after requireAuth on each route the approved 13b role table limits, in the
 * features/<process>/<process>.routes.ts files. Calls shared/errors/AppError.ts. Reads req.sessionUser, set by requireAuth.
 * Used by: every workflow whose action belongs to some roles only.
 */
import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@shared/enums/role';
import { AppError } from '../errors/AppError';
import { NOT_LOGGED_IN_MESSAGE } from './requireAuth';

/** The 403 message. */
export const FORBIDDEN_MESSAGE = "Your role is not allowed to do this.";

/**
 * Builds the check for one route. It checks the app role only. Whose asset it is is checked in the service where a
 * rule needs it (only the holder may request a transfer); whose lab it is waits for lab scoping, after step 14.
 *
 * @param roles the app roles allowed; ADMIN and ADRIC_SECRETARY accounts are "Staff" (auth.service.ts appRoleFor)
 * @returns middleware that throws AppError 403 FORBIDDEN_MESSAGE for any other role
 */
export function requireRole(...roles: Role[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        // Only reached without a session if a route lists requireRole without requireAuth before it.
        if (!req.sessionUser) throw new AppError(401, NOT_LOGGED_IN_MESSAGE);
        if (!roles.includes(req.sessionUser.role)) throw new AppError(403, FORBIDDEN_MESSAGE);
        next();
    };
}
