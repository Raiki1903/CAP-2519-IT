/**
 * Lookup row access: the research centers, funding sources, issue types, metric definitions, projects, and Custodian
 * accounts the forms pick from.
 * Layer: repository. Called by lookups.service.ts. Calls config/prisma.ts.
 * Used by: Edit Asset, Register Equipment, the borrow form, Report an issue, the inspection forms, and the sign-up page.
 */
import { prisma } from '../../config/prisma';

/**
 * Every lookup table the public option lists are built from, read together.
 *
 * @returns [research centers by short code, funding sources by name, issue types by id, category metric links with
 *   their metric, projects by code]
 */
export function findFormLookupTables() {
    // The five reads do not depend on each other, so they run together: one round trip instead of five.
    return Promise.all([
        prisma.research_centers.findMany({
            select: { center_id: true, short_code: true, name: true, location: true, head_user_id: true },
            orderBy: { short_code: 'asc' },
        }),
        prisma.funding_sources.findMany({ orderBy: { name: 'asc' } }),
        prisma.issue_types.findMany({ orderBy: { issue_type_id: 'asc' } }),
        prisma.category_metrics.findMany({
            include: { metric_definitions: true },
            orderBy: [{ category: 'asc' }, { metric_id: 'asc' }],
        }),
        prisma.projects.findMany({
            select: { project_id: true, project_code: true, project_name: true, center_id: true },
            orderBy: { project_code: 'asc' },
        }),
    ]);
}

/**
 * The id and name of every account that may hold an asset (the RESEARCHER role, heading no lab: a lab's Head account
 * is its office account), except one, by last name then first name.
 *
 * @param excludedUserId an account left out of the list (the placeholder custodian)
 */
export function findCustodianAccounts(excludedUserId: number) {
    return prisma.users.findMany({
        where: {
            user_id: { not: excludedUserId },
            user_roles: { some: { roles: { role_name: 'RESEARCHER' } } },
            headed_center: { is: null },
        },
        select: { user_id: true, first_name: true, last_name: true },
        orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
    });
}
