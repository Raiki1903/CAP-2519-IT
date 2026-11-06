/**
 * Account row access for the IT Admin: the users list with its filters, Pending sign-ups, and approving or rejecting
 * one with its role, labs, and log row.
 * Layer: repository. Called by users.service.ts. Calls config/prisma.ts, shared/services/rowLocks.ts, and
 * shared/services/activityLog.ts.
 * Used by: the IT Admin's Approvals and Users pages.
 */
import type { Prisma, activity_log_event_type, asset_loans_status, roles_role_name, users_account_status } from '@prisma/client';
import { OPEN_LOAN_STATUSES } from '@shared/constants/loanStatuses';
import type { UserListFilters } from '@shared/types/users';
import { prisma } from '../../config/prisma';
import { logActivity } from '../../shared/services/activityLog';
import { lockCenter, lockUser } from '../../shared/services/rowLocks';

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

/** How a list is ordered: sign-up order (user_id, oldest first), or by last name and then first name. */
export type UserListOrder = 'SIGN_UP' | 'NAME';

/**
 * The accounts that pass every filter given. With no status, every account but the Pending ones.
 * users has no creation date, so in sign-up order the id is the order the accounts were made in.
 *
 * @param filters status, role, lab, and search, each optional
 * @param order sign-up order, or by name
 */
export async function findUsers(filters: UserListFilters, order: UserListOrder) {
    const where: Prisma.usersWhereInput = { account_status: filters.status ?? { not: 'PENDING' } };
    if (filters.role) where.user_roles = { some: { roles: { role_name: filters.role } } };
    if (filters.centerId !== undefined) where.user_centers = { some: { center_id: filters.centerId } };
    if (filters.q) where.user_id = { in: await findUserIdsMatching(filters.q) };

    const orderBy: Prisma.usersOrderByWithRelationInput[] = order === 'SIGN_UP'
        ? [{ user_id: 'asc' }]
        : [{ last_name: 'asc' }, { first_name: 'asc' }, { user_id: 'asc' }];
    return prisma.users.findMany({ where, select: USER_SELECT, orderBy });
}

/**
 * The ids of the accounts whose full name, email, or ID number contains the text. The columns' collation
 * (utf8mb4_unicode_ci) makes the match ignore case.
 */
async function findUserIdsMatching(text: string): Promise<number[]> {
    // The text is matched as typed: %, _ and \ are escaped so they are not LIKE wildcards.
    const pattern = `%${text.replace(/[\\%_]/g, ch => `\\${ch}`)}%`;
    const rows = await prisma.$queryRaw<{ user_id: number }[]>`
        SELECT user_id FROM users
        WHERE CONCAT(first_name, ' ', last_name) LIKE ${pattern}
           OR email LIKE ${pattern}
           OR CAST(id_number AS CHAR) LIKE ${pattern}`;
    return rows.map(row => Number(row.user_id));
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

/** What a change to one account is decided on, read after its row is locked. */
export interface LockedAccount {
    userId: number;
    /** First and last name, as the log row's details show it. */
    name: string;
    status: users_account_status;
    anonymized: boolean;
    /** The account's database role, or null when it has none (a Pending or Rejected sign-up). */
    role: roles_role_name | null;
    centerIds: number[];
    /** The lab the account heads, or null. */
    headOf: { centerId: number; code: string } | null;
    /** The status of each of the account's loans that is not final, the person being the borrower. */
    openLoanStatuses: asset_loans_status[];
}

/**
 * Decides a change on the locked account. It throws to refuse the change, and then nothing is written; otherwise it
 * returns the log row's details.
 */
export type DecideChange = (account: LockedAccount) => string | null;

/**
 * Locks the account and reads what a change is decided on, in the caller's transaction. Every change starts here, so
 * two changes on one account run one after the other and the second sees what the first wrote.
 *
 * @returns the account, or null if there is none with this id
 */
async function lockAccount(tx: Prisma.TransactionClient, userId: number): Promise<LockedAccount | null> {
    await lockUser(tx, userId);
    const row = await tx.users.findUnique({
        where: { user_id: userId },
        select: {
            first_name: true,
            last_name: true,
            account_status: true,
            anonymized_at: true,
            user_roles: { select: { roles: { select: { role_name: true } } } },
            user_centers: { select: { center_id: true } },
            headed_center: { select: { center_id: true, short_code: true } },
            asset_loans: { where: { status: { in: [...OPEN_LOAN_STATUSES] } }, select: { status: true } },
        },
    });
    if (!row) return null;
    return {
        userId,
        name: `${row.first_name} ${row.last_name}`,
        status: row.account_status,
        anonymized: row.anonymized_at !== null,
        role: row.user_roles[0]?.roles.role_name ?? null,
        centerIds: row.user_centers.map(uc => uc.center_id),
        headOf: row.headed_center ? { centerId: row.headed_center.center_id, code: row.headed_center.short_code } : null,
        openLoanStatuses: row.asset_loans.map(loan => loan.status),
    };
}

/**
 * Runs one change to an account in one transaction: locks the account, lets `decide` refuse it or give the log
 * details, applies `write`, and logs the event with the IT Admin as actor and the account as target.
 *
 * @returns the account as it is now, or null if there is none with this id
 */
function changeAccount(
    userId: number,
    itAdminId: number,
    eventType: activity_log_event_type,
    decide: DecideChange,
    write: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<UserRow | null> {
    return prisma.$transaction(async (tx) => {
        const account = await lockAccount(tx, userId);
        if (!account) return null;
        const details = decide(account);

        await write(tx);
        await logActivity(tx, { eventType, actorId: itAdminId, targetUserId: userId, details });

        return tx.users.findUniqueOrThrow({ where: { user_id: userId }, select: USER_SELECT });
    });
}

/**
 * Gives the account one role in place of the one it has, and writes a ROLE_CHANGED row.
 *
 * @param userId the account
 * @param roleName its role from now on
 * @param itAdminId the session user who changes it
 * @param decide the service's rules, run on the locked account
 * @returns the account as it is now, or null if there is none with this id
 */
export function changeRole(userId: number, roleName: roles_role_name, itAdminId: number, decide: DecideChange): Promise<UserRow | null> {
    return changeAccount(userId, itAdminId, 'ROLE_CHANGED', decide, async (tx) => {
        const role = await tx.roles.findFirstOrThrow({ where: { role_name: roleName } });
        await tx.user_roles.deleteMany({ where: { user_id: userId } });
        await tx.user_roles.create({ data: { user_id: userId, role_id: role.role_id } });
    });
}

/**
 * Replaces the account's labs with `centerIds`, and writes a LABS_CHANGED row.
 *
 * @param userId the account
 * @param centerIds its labs from now on, each once; may be empty
 * @param itAdminId the session user who changes them
 * @param decide the service's rules, run on the locked account
 * @returns the account as it is now, or null if there is none with this id
 */
export function changeLabs(userId: number, centerIds: number[], itAdminId: number, decide: DecideChange): Promise<UserRow | null> {
    return changeAccount(userId, itAdminId, 'LABS_CHANGED', decide, async (tx) => {
        await tx.user_centers.deleteMany({ where: { user_id: userId } });
        await tx.user_centers.createMany({ data: centerIds.map(centerId => ({ user_id: userId, center_id: centerId })) });
    });
}

/** A lab as a Head change is decided on, read after its row is locked. */
export interface LockedLab {
    centerId: number;
    code: string;
    /** The lab's Head now, or null. */
    head: { userId: number; name: string } | null;
}

/** How a Head change went: done with the lab's new Head, or refused because the lab or the account is not there. */
export type HeadChange = { outcome: 'DONE'; lab: { centerId: number; code: string; headUserId: number | null } } | { outcome: 'NO_LAB' } | { outcome: 'NO_ACCOUNT' };

/**
 * Makes `newHeadId` the lab's Head in place of the one it has, or leaves the lab with no Head, in one transaction,
 * and writes a HEAD_CHANGED row: the new Head as target, or the old Head when the lab is left with none.
 * The lab row and the new Head's account are both locked before anything is read, so two changes that name the same
 * person for two labs run one after the other and the second sees the first.
 *
 * @param centerId the lab
 * @param newHeadId the account that heads it from now on, or null for no Head
 * @param itAdminId the session user who changes it
 * @param decide the service's rules, run on the locked lab and account: throws to refuse, or returns the log details
 * @returns DONE with the lab, or NO_LAB or NO_ACCOUNT with nothing changed
 */
export function setLabHead(
    centerId: number,
    newHeadId: number | null,
    itAdminId: number,
    decide: (lab: LockedLab, newHead: LockedAccount | null) => string,
): Promise<HeadChange> {
    return prisma.$transaction(async (tx) => {
        await lockCenter(tx, centerId);
        if (newHeadId !== null) await lockUser(tx, newHeadId);

        const lab = await tx.research_centers.findUnique({
            where: { center_id: centerId },
            select: { center_id: true, short_code: true, head: { select: { user_id: true, first_name: true, last_name: true } } },
        });
        if (!lab) return { outcome: 'NO_LAB' };
        const newHead = newHeadId === null ? null : await lockAccount(tx, newHeadId);
        if (newHeadId !== null && !newHead) return { outcome: 'NO_ACCOUNT' };

        const oldHead = lab.head ? { userId: lab.head.user_id, name: `${lab.head.first_name} ${lab.head.last_name}` } : null;
        const details = decide({ centerId, code: lab.short_code, head: oldHead }, newHead);

        await tx.research_centers.update({ where: { center_id: centerId }, data: { head_user_id: newHeadId } });
        await logActivity(tx, { eventType: 'HEAD_CHANGED', actorId: itAdminId, targetUserId: newHeadId ?? oldHead?.userId ?? null, details });

        return { outcome: 'DONE', lab: { centerId, code: lab.short_code, headUserId: newHeadId } };
    });
}

/**
 * Sets the account's status (deactivate or reactivate), decided now by the IT Admin, and writes the event's row.
 *
 * @param userId the account
 * @param status its status from now on
 * @param eventType USER_DEACTIVATED or USER_REACTIVATED
 * @param itAdminId the session user who decides it
 * @param decide the service's rules, run on the locked account
 * @returns the account as it is now, or null if there is none with this id
 */
export function setAccountStatus(
    userId: number,
    status: 'ACTIVE' | 'INACTIVE',
    eventType: 'USER_DEACTIVATED' | 'USER_REACTIVATED',
    itAdminId: number,
    decide: DecideChange,
): Promise<UserRow | null> {
    return changeAccount(userId, itAdminId, eventType, decide, async (tx) => {
        await tx.users.update({
            where: { user_id: userId },
            data: { account_status: status, status_decided_at: new Date(), status_decided_by_id: itAdminId },
        });
    });
}
