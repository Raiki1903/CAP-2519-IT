import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@shared/enums/role';
import { AppError } from '../errors/AppError';
import { NOT_LOGGED_IN_MESSAGE } from './requireAuth';

export const FORBIDDEN_MESSAGE = "Your role is not allowed to do this.";

export function requireRole(...roles: Role[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        // Only reached without a session if a route lists requireRole without requireAuth before it.
        if (!req.sessionUser) throw new AppError(401, NOT_LOGGED_IN_MESSAGE);
        if (!roles.includes(req.sessionUser.role)) throw new AppError(403, FORBIDDEN_MESSAGE);
        next();
    };
}
