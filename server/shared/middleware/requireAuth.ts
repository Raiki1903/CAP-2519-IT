import type { NextFunction, Request, Response } from 'express';
import type { SessionIdentity } from '@shared/types/auth';
import { AppError } from '../errors/AppError';
import { readCookie, SESSION_COOKIE_NAME } from '../services/session';
import * as authService from '../../features/auth/auth.service';

declare global {
    namespace Express {
        interface Request {
            sessionUser?: SessionIdentity;
        }
    }
}

export const NOT_LOGGED_IN_MESSAGE = "Please log in to continue.";
export const SESSION_ENDED_MESSAGE = "Your session has ended. Please log in again.";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE_NAME);
    if (!token) throw new AppError(401, NOT_LOGGED_IN_MESSAGE);

    const sessionUser = await authService.sessionIdentityFor(token);
    if (!sessionUser) throw new AppError(401, SESSION_ENDED_MESSAGE);

    req.sessionUser = sessionUser;
    next();
}
