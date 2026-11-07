/**
 * Users request checks: the list filters, the user id in the URL, and the approve and reject bodies.
 * Layer: validation. Called by users.controller.ts. Calls shared/errors/AppError.ts and @shared (roles, account
 * statuses, remarks limit).
 * Used by: the IT Admin's Approvals and Users pages.
 */
import { ACCOUNT_STATUSES, type AccountStatus } from '@shared/constants/accountStatuses';
import { REJECT_REMARKS_MAX_LENGTH } from '@shared/constants/signUp';
import { DATABASE_ROLES, type DatabaseRole } from '@shared/enums/role';
import type { ApproveSignUpInput, ChangeLabsInput, ChangeRoleInput, RejectSignUpInput, SetLabHeadInput, UserListFilters } from '@shared/types/users';
import { AppError } from '../../shared/errors/AppError';

/** The 400 message for a role that is not one of the five database roles. */
const ROLE_MESSAGE = "Choose a role: Researcher, TSG Staff, AdRIC Director, AdRIC Secretary, or IT Admin.";

/** The longest search the users list takes. */
const SEARCH_MAX_LENGTH = 100;

const LIST_FILTERS = ['status', 'role', 'centerId', 'q'];

/**
 * Reads the filters of GET /api/users. Each filter is optional and takes one value; an empty search counts as none.
 *
 * @param query the request's query
 * @returns the filters that were sent
 * @throws AppError 400 for an unknown filter, a filter sent twice, an unknown status or role, a lab id that is not a
 * positive whole number, or a search longer than 100 characters
 */
export function readUserListQuery(query: Record<string, unknown>): UserListFilters {
    for (const [key, value] of Object.entries(query)) {
        if (!LIST_FILTERS.includes(key)) throw new AppError(400, `Unknown filter "${key}". Use status, role, centerId, or q.`);
        if (typeof value !== 'string') throw new AppError(400, `Send the filter "${key}" once.`);
    }
    const { status, role, centerId, q } = query as Record<string, string | undefined>;
    const filters: UserListFilters = {};

    if (status !== undefined) {
        if (!(ACCOUNT_STATUSES as readonly string[]).includes(status)) {
            throw new AppError(400, "Choose a status: PENDING, ACTIVE, INACTIVE, or REJECTED.");
        }
        filters.status = status as AccountStatus;
    }
    if (role !== undefined) {
        if (!(DATABASE_ROLES as readonly string[]).includes(role)) throw new AppError(400, ROLE_MESSAGE);
        filters.role = role as DatabaseRole;
    }
    if (centerId !== undefined) filters.centerId = readPositiveId(centerId, "The lab id must be a positive whole number.");
    if (q !== undefined && q.trim() !== '') {
        if (q.trim().length > SEARCH_MAX_LENGTH) throw new AppError(400, `The search can be at most ${SEARCH_MAX_LENGTH} characters.`);
        filters.q = q.trim();
    }
    return filters;
}

function readPositiveId(value: string, message: string): number {
    const id = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0) throw new AppError(400, message);
    return id;
}

/**
 * Reads the account id in the URL.
 *
 * @param value the :userId parameter
 * @returns the id
 * @throws AppError 400 if it is not a positive whole number
 */
export function readUserId(value: string): number {
    return readPositiveId(value, "The user id must be a positive whole number.");
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
    if (!DATABASE_ROLES.includes(role)) throw new AppError(400, ROLE_MESSAGE);
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

/**
 * Reads the body of a role change: one database role.
 *
 * @param body the request body
 * @returns the role
 * @throws AppError 400 for an unknown or missing role
 */
export function readChangeRole(body: any): ChangeRoleInput {
    const role = body?.role;
    if (!DATABASE_ROLES.includes(role)) throw new AppError(400, ROLE_MESSAGE);
    return { role: role as DatabaseRole };
}

/**
 * Reads the body of a lab change: the account's labs from now on. Whether a Researcher has one is the service's rule.
 *
 * @param body the request body
 * @returns the labs, each once
 * @throws AppError 400 if the labs are missing or are not a list of lab ids
 */
export function readChangeLabs(body: any): ChangeLabsInput {
    const ids = body?.centerIds;
    if (!Array.isArray(ids) || !ids.every(id => Number.isInteger(id) && id > 0)) {
        throw new AppError(400, "The labs must be a list of lab ids.");
    }
    return { centerIds: [...new Set<number>(ids)] };
}

/**
 * Reads the lab id in the URL.
 *
 * @param value the :centerId parameter
 * @returns the id
 * @throws AppError 400 if it is not a positive whole number
 */
export function readCenterId(value: string): number {
    return readPositiveId(value, "The lab id must be a positive whole number.");
}

/**
 * Reads the body of a Head change: the new Head's account id, or null for no Head.
 *
 * @param body the request body
 * @returns the account id, or null
 * @throws AppError 400 if userId is missing, or is neither null nor a positive whole number
 */
export function readSetLabHead(body: any): SetLabHeadInput {
    const userId = body?.userId;
    if (userId === null) return { userId: null };
    if (!Number.isSafeInteger(userId) || userId <= 0) {
        throw new AppError(400, "Send userId: the new Head's account id, or null for no Head.");
    }
    return { userId };
}
