/**
 * The permission checks a route puts after requireAuth: an Active account, and the database roles (or heading a lab)
 * the step needs.
 * Layer: shared (server middleware). Put on routes in the features/<process>/<process>.routes.ts files. Calls
 * shared/errors/AppError.ts and @shared (the account status message). Reads req.sessionUser, set by requireAuth.
 * Used by: every workflow whose step belongs to some roles only.
 */
import type { NextFunction, Request, Response } from 'express';
import type { DatabaseRole } from '@shared/enums/role';
import type { SessionIdentity } from '@shared/types/auth';
import { ACCOUNT_NOT_ACTIVE_MESSAGE } from '@shared/constants/accountStatuses';
import { AppError } from '../errors/AppError';
import { NOT_LOGGED_IN_MESSAGE } from './requireAuth';
import { FORBIDDEN_MESSAGE } from './requireRole';

/**
 * Who may take a step. A database role, or LAB_HEAD for the account that heads a lab. RESEARCHER means a Researcher
 * who heads no lab: a lab's Head account is the lab's office account and has the Lab Head view instead.
 */
export type AccessRole = DatabaseRole | "LAB_HEAD";

/** The session user of a request that passed requireAuth. */
function sessionOf(req: Request): SessionIdentity {
    if (!req.sessionUser) throw new AppError(401, NOT_LOGGED_IN_MESSAGE);
    return req.sessionUser;
}

/**
 * Whether the session user has one of the access roles.
 *
 * @param user the session user
 * @param roles the access roles a step allows
 */
export function hasAccessRole(user: SessionIdentity, roles: readonly AccessRole[]): boolean {
    const headsLab = user.headOfCenterId !== null;
    return roles.some(role => {
        if (role === "LAB_HEAD") return headsLab;
        if (role === "RESEARCHER") return user.dbRoles.includes("RESEARCHER") && !headsLab;
        return user.dbRoles.includes(role);
    });
}

/**
 * Lets a request through only when the session's account is Active. Put it right after requireAuth.
 *
 * @throws AppError 403 ACCOUNT_NOT_ACTIVE_MESSAGE for a Pending, Inactive, or Rejected account
 */
export function requireActive(req: Request, res: Response, next: NextFunction): void {
    if (sessionOf(req).accountStatus !== "ACTIVE") throw new AppError(403, ACCOUNT_NOT_ACTIVE_MESSAGE);
    next();
}

/**
 * Builds the check for a step any of these access roles may take.
 *
 * @param roles database roles, or LAB_HEAD for the account that heads a lab
 * @returns middleware that throws AppError 403 FORBIDDEN_MESSAGE for anyone else
 */
export function requireAnyRole(...roles: AccessRole[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!hasAccessRole(sessionOf(req), roles)) throw new AppError(403, FORBIDDEN_MESSAGE);
        next();
    };
}

/** The IT Admin only: accounts, labs, Heads, tickets, and the activity log. */
export const requireItAdmin = requireAnyRole("IT_ADMIN");

/** TSG only: registration and every physical step on an asset. The IT Admin and the Secretary get 403. */
export const requireTsg = requireAnyRole("TSG_STAFF");

/** TSG or the Secretary: Edit Asset (master data). */
export const requireAssetMasterEditor = requireAnyRole("TSG_STAFF", "ADRIC_SECRETARY");

/** The Director or the Secretary: deciding a retirement. */
export const requireRetirementDecider = requireAnyRole("ADRIC_DIRECTOR", "ADRIC_SECRETARY");

/** The account that heads a lab, any lab. Whose lab the asset is checked in the service (shared/services/permissions.ts). */
export const requireLabHead = requireAnyRole("LAB_HEAD");
