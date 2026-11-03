/**
 * Account row access for the IT Admin: Pending sign-ups, and approving or rejecting one with its role, labs, and log row.
 * Layer: repository. Called by users.service.ts. Calls config/prisma.ts, shared/services/rowLocks.ts, and
 * shared/services/activityLog.ts.
 * Used by: the IT Admin's Approvals page.
 */
import type { Prisma, roles_role_name, users_account_status } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logActivity } from '../../shared/services/activityLog';
import { lockUser } from '../../shared/services/rowLocks';

/** What a user read includes: the roles, every lab (by code), and the lab the account heads. Never the password. */
const USER_SELECT = {
    user_id: true,
    first_name: true,
    last_name: true,
    email: true,
    id_number: true,
    user_type: true,
    account_status: true,
    user_roles: { select: { roles: { select: { role_name: true } } } },
    user_centers: { select: { research_centers: { select: { center_id: true, short_code: true } } }, orderBy: { research_centers: { short_code: 'asc' } } },
    headed_center: { select: { center_id: true, short_code: true } },
} satisfies Prisma.usersSelect;

/** An account with its roles, labs, and the lab it heads. */
export type UserRow = Prisma.usersGetPayload<{ select: typeof USER_SELECT }>;

/** How a sign-up decision went: done with the account as it is now, or refused because of what the locked row held. */
export type SignUpDecision = { outcome: 'DONE'; user: UserRow } | { outcome: 'NOT_FOUND' } | { outcome: 'NOT_PENDING' };

/**
 * The accounts with one status, in sign-up order (user_id, oldest first). users has no creation date, so the id is
 * the order the accounts were made in.
 *
 * @param status the account status
 */
export function findUsersByStatus(status: users_account_status) {
    return prisma.users.findMany({ where: { account_status: status }, select: USER_SELECT, orderBy: { user_id: 'asc' } });
}

/** The research centers among these ids, with their codes. A missing one is not in the list. */
export function findLabs(centerIds: number[]) {
    return prisma.research_centers.findMany({ where: { center_id: { in: centerIds } }, select: { center_id: true, short_code: true }, orderBy: { short_code: 'asc' } });
}

/**
 * Locks the account and reads its status, in the caller's transaction. Every decision starts here, so two decisions
 * on one sign-up run one after the other and the second sees it is no longer Pending.
 */
async function lockPending(tx: Prisma.TransactionClient, userId: number): Promise<SignUpDecision | null> {
    await lockUser(tx, userId);
    const user = await tx.users.findUnique({ where: { user_id: userId }, select: { account_status: true } });
    if (!user) return { outcome: 'NOT_FOUND' };
    if (user.account_status !== 'PENDING') return { outcome: 'NOT_PENDING' };
    return null;
}

/**
 * Approves a Pending sign-up in one transaction, the account locked first: Active, decided now by the IT Admin, the
 * one role, the labs replaced by `centerIds`, and a SIGNUP_APPROVED row.
 *
 * @param userId the account
 * @param roleName the role to give it
 * @param centerIds its labs from now on, each once; may be empty
 * @param itAdminId the session user who approves
 * @param details the log row's details: the role key and lab codes
 * @returns DONE with the account, or NOT_FOUND or NOT_PENDING with nothing changed
 */
export function approveSignUp(userId: number, roleName: roles_role_name, centerIds: number[], itAdminId: number, details: string): Promise<SignUpDecision> {
    return prisma.$transaction(async (tx) => {
        const refused = await lockPending(tx, userId);
        if (refused) return refused;

        const role = await tx.roles.findFirstOrThrow({ where: { role_name: roleName } });
        await tx.users.update({
            where: { user_id: userId },
            data: { account_status: 'ACTIVE', status_decided_at: new Date(), status_decided_by_id: itAdminId },
        });
        await tx.user_roles.deleteMany({ where: { user_id: userId } });
        await tx.user_roles.create({ data: { user_id: userId, role_id: role.role_id } });
        await tx.user_centers.deleteMany({ where: { user_id: userId } });
        await tx.user_centers.createMany({ data: centerIds.map(centerId => ({ user_id: userId, center_id: centerId })) });
        await logActivity(tx, { eventType: 'SIGNUP_APPROVED', actorId: itAdminId, targetUserId: userId, details });

        return { outcome: 'DONE', user: await tx.users.findUniqueOrThrow({ where: { user_id: userId }, select: USER_SELECT }) };
    });
}

/**
 * Rejects a Pending sign-up in one transaction, the account locked first: Rejected, decided now by the IT Admin, its
 * lab links removed, and a SIGNUP_REJECTED row. The account keeps its email and ID number.
 *
 * @param userId the account
 * @param itAdminId the session user who rejects
 * @param remarks the IT Admin's remarks for the log row, or null
 * @returns DONE with the account, or NOT_FOUND or NOT_PENDING with nothing changed
 */
export function rejectSignUp(userId: number, itAdminId: number, remarks: string | null): Promise<SignUpDecision> {
    return prisma.$transaction(async (tx) => {
        const refused = await lockPending(tx, userId);
        if (refused) return refused;

        await tx.users.update({
            where: { user_id: userId },
            data: { account_status: 'REJECTED', status_decided_at: new Date(), status_decided_by_id: itAdminId },
        });
        await tx.user_centers.deleteMany({ where: { user_id: userId } });
        await logActivity(tx, { eventType: 'SIGNUP_REJECTED', actorId: itAdminId, targetUserId: userId, details: remarks });

        return { outcome: 'DONE', user: await tx.users.findUniqueOrThrow({ where: { user_id: userId }, select: USER_SELECT }) };
    });
}
