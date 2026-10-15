/**
 * requireAuth: lets a request through only with a valid session cookie, and records whose it is. (C-02, C-06)
 * Layer: shared (server middleware). Put first on every route except login, the sign-up request, and logout, in each
 * features/<process>/<process>.routes.ts. Calls shared/services/session.ts (reading the cookie) and
 * features/auth/auth.service.ts sessionIdentityFor (the token checks and the account's role). Its sessionUserOf(req) is
 * how controllers learn who is acting; no request body or query names the acting user. (issue #32)
 * Used by: every workflow, for every role.
 */
import type { NextFunction, Request, Response } from 'express';
import type { SessionIdentity } from '@shared/types/auth';
import { AppError } from '../errors/AppError';
import { readCookie, SESSION_COOKIE_NAME } from '../services/session';
import * as authService from '../../features/auth/auth.service';

declare global {
    namespace Express {
        interface Request {
            /** Set by requireAuth: whose session this request carries. Undefined on public routes. */
            sessionUser?: SessionIdentity;
        }
    }
}

/** The 401 message when the request carries no session cookie at all. */
export const NOT_LOGGED_IN_MESSAGE = "Please log in to continue.";
/** The 401 message for every other refusal: tampered, expired, logged out, or an account that no longer exists. */
export const SESSION_ENDED_MESSAGE = "Your session has ended. Please log in again.";

/**
 * Checks the adric_session cookie and sets `req.sessionUser` ({ userId, role, staffUnit }).
 * A logout or a tampered or expired cookie is refused at once. The account's roles are read from the database at
 * most once a minute per cookie (shared/services/sessionCache.ts), so a changed role or a removed account takes
 * effect within 60 seconds. The 401 is an AppError, which errorHandler answers.
 *
 * @throws AppError 401 NOT_LOGGED_IN_MESSAGE with no cookie, SESSION_ENDED_MESSAGE when the cookie is refused
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE_NAME);
    if (!token) throw new AppError(401, NOT_LOGGED_IN_MESSAGE);

    const sessionUser = await authService.sessionIdentityFor(token);
    if (!sessionUser) throw new AppError(401, SESSION_ENDED_MESSAGE);

    req.sessionUser = sessionUser;
    next();
}

/**
 * The session user of a request that passed requireAuth: who is acting. (issue #32, H-10)
 * Controllers read it instead of a name or email from the body.
 *
 * @param req a request on a route with requireAuth
 * @returns { userId, role, staffUnit }
 * @throws AppError 401 NOT_LOGGED_IN_MESSAGE if requireAuth did not run before it
 */
export function sessionUserOf(req: Request): SessionIdentity {
    if (!req.sessionUser) throw new AppError(401, NOT_LOGGED_IN_MESSAGE);
    return req.sessionUser;
}
