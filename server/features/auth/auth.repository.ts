/**
 * Account lookups other features need: who to email. The first part of the auth feature;
 * login, /me, and the account update join it when auth is extracted later in step 12.
 * Layer: repository. Called by features/transfers/transfers.service.ts and features/disposals/disposals.service.ts. Calls config/prisma.ts.
 * Used by: the transfer and disposal notification emails.
 */
import { prisma } from '../../config/prisma';

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
