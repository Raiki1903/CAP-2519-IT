/**
 * Users request checks: the list query, the user id in the URL, and the approve and reject bodies.
 * Layer: validation. Called by users.controller.ts. Calls shared/errors/AppError.ts and @shared (roles, remarks limit).
 * Used by: the IT Admin's Approvals page.
 */
import { REJECT_REMARKS_MAX_LENGTH } from '@shared/constants/signUp';
import { DATABASE_ROLES, type DatabaseRole } from '@shared/enums/role';
import type { ApproveSignUpInput, RejectSignUpInput } from '@shared/types/users';
import { AppError } from '../../shared/errors/AppError';

/**
 * Checks the query of GET /api/users. Only the Pending list exists for now; module 6 adds the other filters.
 *
 * @param query the request's query
 * @throws AppError 400 for anything but exactly `status=PENDING`
 */
export function checkUserListQuery(query: Record<string, unknown>): void {
    const keys = Object.keys(query);
    if (keys.length !== 1 || query.status !== 'PENDING') {
        throw new AppError(400, "Only status=PENDING is available for now.");
    }
}

/**
 * Reads the account id in the URL.
 *
 * @param value the :userId parameter
 * @returns the id
 * @throws AppError 400 if it is not a positive whole number
 */
export function readUserId(value: string): number {
    const userId = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(userId) || userId <= 0) {
        throw new AppError(400, "The user id must be a positive whole number.");
    }
    return userId;
}

/**
 * Reads the body of an approval: one database role and the labs. No labs sent counts as none; whether a Researcher
 * has one is the service's rule.
 *
 * @param body the request body
 * @returns the role and the labs, each once
 * @throws AppError 400 for an unknown role, or labs that are not a list of lab ids
 */
export function readApproveSignUp(body: any): ApproveSignUpInput {
    const { role, centerIds } = body ?? {};
    if (!DATABASE_ROLES.includes(role)) {
        throw new AppError(400, "Choose a role: Researcher, TSG Staff, AdRIC Director, AdRIC Secretary, or IT Admin.");
    }
    const ids = centerIds ?? [];
    if (!Array.isArray(ids) || !ids.every(id => Number.isInteger(id) && id > 0)) {
        throw new AppError(400, "The labs must be a list of lab ids.");
    }
    return { role: role as DatabaseRole, centerIds: [...new Set<number>(ids)] };
}

/**
 * Reads the body of a rejection: optional remarks, trimmed.
 *
 * @param body the request body, which may be empty
 * @returns the remarks, or null when there are none
 * @throws AppError 400 if the remarks are not text or are longer than activity_log.details can hold
 */
export function readRejectSignUp(body: any): RejectSignUpInput {
    const remarks = body?.remarks;
    if (remarks === undefined || remarks === null) return { remarks: null };
    if (typeof remarks !== 'string') {
        throw new AppError(400, "Remarks must be text.");
    }
    const trimmed = remarks.trim();
    if (trimmed.length > REJECT_REMARKS_MAX_LENGTH) {
        throw new AppError(400, `Remarks must be at most ${REJECT_REMARKS_MAX_LENGTH} characters.`);
    }
    return { remarks: trimmed || null };
}
