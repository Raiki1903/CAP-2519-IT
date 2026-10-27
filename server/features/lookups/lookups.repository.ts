/**
 * Lookup row access: the research centers and the Custodian accounts the forms pick from.
 * Layer: repository. Called by lookups.service.ts. Calls config/prisma.ts.
 * Used by: Edit Asset, Register Equipment, the borrow form, and the sign-up page.
 */
import { prisma } from '../../config/prisma';

/** Every research center's short code, name, and campus, by short code. */
export function findLabs() {
    return prisma.research_centers.findMany({
        select: { short_code: true, name: true, location: true },
        orderBy: { short_code: 'asc' },
    });
}

/**
 * The id and name of every account that holds the CUSTODIAN role, except one, by last name then first name.
 *
 * @param excludedUserId an account left out of the list (the placeholder custodian)
 */
export function findCustodianAccounts(excludedUserId: number) {
    return prisma.users.findMany({
        where: {
            user_id: { not: excludedUserId },
            user_roles: { some: { roles: { role_name: 'CUSTODIAN' } } },
        },
        select: { user_id: true, first_name: true, last_name: true },
        orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
    });
}
