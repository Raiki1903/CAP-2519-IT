/**
 * Loans per week reads: the released loans that may touch the weeks shown. Nothing here writes.
 * Layer: repository. Called by utilization.service.ts. Calls config/prisma.ts.
 * Used by: the Director and Lab Head loans per week chart.
 * A loan counts for the home lab of its asset (assets.center_id), never its destination lab.
 */
import { prisma } from '../../config/prisma';

/**
 * The loans that were handed over (released_at is set) and are still open or closed on or after `since`, with the
 * asset's home lab. `since` is a coarse limit a day or two before the first week; the service makes the exact cut.
 *
 * @param centerId one lab, or null for every lab
 * @param since the earliest closing time worth reading
 */
export function findReleasedLoans(centerId: number | null, since: Date) {
    return prisma.asset_loans.findMany({
        where: {
            released_at: { not: null },
            OR: [{ closed_at: null }, { closed_at: { gte: since } }],
            ...(centerId === null ? {} : { assets: { center_id: centerId } }),
        },
        select: {
            loan_id: true, released_at: true, closed_at: true,
            assets: { select: { center_id: true, research_centers: { select: { short_code: true } } } },
        },
    });
}
