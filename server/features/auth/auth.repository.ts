/**
 * Account row access: every database read and write the auth endpoints make, plus the user lookups other features
 * need (who to email, a user by id).
 * Layer: repository. Called by auth.service.ts (also on behalf of shared/middleware/requireAuth.ts) and the service of
 * features/retirements. Calls config/prisma.ts and shared/services/activityLog.ts.
 * Used by: login, every request with a session (its account and roles), the session reload, the account page,
 * sign-ups, and the disposal emails.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logActivity, type ActivityEvent } from '../../shared/services/activityLog';

/**
 * One user's email, for example the custodian who filed a transfer.
 *
 * @param userId the users.user_id
 * @returns the email, or null if there is no such user or the email is empty
 */
export async function getUserEmail(userId: number): Promise<string | null> {
    const user = await prisma.users.findUnique({ where: { user_id: userId } });
    return user?.email || null;
}

/**
 * Every email address of the users holding one database role.
 * An empty list is not an error: sendEmail logs that nobody was resolved and skips the send.
 *
 * @param roleName a roles.role_name value, for example "ADRIC_DIRECTOR"
 * @returns the addresses, or [] if the role does not exist or nobody holds it
 */
export async function getRoleEmails(roleName: string): Promise<string[]> {
    const role = await prisma.roles.findFirst({ where: { role_name: roleName as any } });
    if (!role) return [];

    const assignments = await prisma.user_roles.findMany({ where: { role_id: role.role_id } });
    const userIds = assignments.map(a => a.user_id);
    if (userIds.length === 0) return [];

    const users = await prisma.users.findMany({ where: { user_id: { in: userIds } } });
    return users.map(u => u.email).filter(Boolean);
}

/** The user with this id, or null. Used by the account update and the disposal email. */
export function findUserById(userId: number) {
    return prisma.users.findUnique({ where: { user_id: userId } });
}

/**
 * Creates a Pending account with no role and links it to its labs, in one transaction, so a failed link leaves no
 * account behind.
 *
 * @param data the users row; its account_status is set to PENDING here
 * @param centerIds the labs the sign-up asks for, each once
 * @returns the new user id, or null when the email or the ID number already belongs to an account (a unique key)
 */
export async function createPendingUser(data: Omit<Prisma.usersUncheckedCreateInput, 'account_status'>, centerIds: number[]): Promise<number | null> {
    try {
        return await prisma.$transaction(async (tx) => {
            const user = await tx.users.create({ data: { ...data, account_status: 'PENDING' } });
            await tx.user_centers.createMany({ data: centerIds.map(centerId => ({ user_id: user.user_id, center_id: centerId })) });
            return user.user_id;
        });
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null;
        throw e;
    }
}

/**
 * Writes one LOGIN_SUCCESS or LOGIN_FAILURE row. A login is not a transaction, so the row is written on its own.
 *
 * @param event the event; never an email or a typed login name (contract 7.7)
 */
export function logLoginEvent(event: ActivityEvent & { eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' }): Promise<void> {
    return logActivity(prisma, event);
}

/** How many of these research centers exist. */
export function countLabs(centerIds: number[]) {
    return prisma.research_centers.count({ where: { center_id: { in: centerIds } } });
}

/** What a profile read includes: the roles, every lab link (by lab code), and the lab the user heads. */
const PROFILE_INCLUDE = {
    user_roles: { include: { roles: true } },
    user_centers: { include: { research_centers: true }, orderBy: { research_centers: { short_code: 'asc' } } },
    headed_center: { select: { center_id: true, short_code: true } },
} satisfies Prisma.usersInclude;

/** A user with their roles, labs, and the lab they head. */
export type UserProfileRow = Prisma.usersGetPayload<{ include: typeof PROFILE_INCLUDE }>;

/** The user with this email (trimmed), with their roles, labs, and the lab they head, or null. The service checks the password. */
export function findUserForLogin(email: string) {
    return prisma.users.findFirst({
        where: { email: email.trim() },
        include: PROFILE_INCLUDE,
    });
}

/** The user with this id, with their roles, labs, and the lab they head, or null. */
export function findUserProfileById(userId: number) {
    return prisma.users.findUnique({
        where: { user_id: userId },
        include: PROFILE_INCLUDE,
    });
}

/**
 * The user with this id, their roles, and the lab they head, or null.
 * Read for a session at most once a minute per cookie (sessionCache.ts).
 */
export function findUserRolesById(userId: number) {
    return prisma.users.findUnique({
        where: { user_id: userId },
        include: { user_roles: { include: { roles: true } }, headed_center: { select: { center_id: true } } }
    });
}

/** Updates a user row and returns it. */
export function updateUser(userId: number, data: Prisma.usersUpdateInput) {
    return prisma.users.update({
        where: { user_id: userId },
        data
    });
}
