/**
 * Inspection report row access: every database read and write the inspection endpoints make.
 * Layer: repository. Called by inspections.service.ts. Calls server/config/prisma.ts.
 * Used by: Custodian condition report, Staff inspection finalize, and the screens that list reports.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

/** Inserts an asset_inspections row and returns it. Every report is a new row; older reports are kept. */
export function create(data: Prisma.asset_inspectionsUncheckedCreateInput) {
    return prisma.asset_inspections.create({ data });
}

/**
 * Every report (newest first), user, and asset, read together so the short list can name
 * each report's asset and reporter.
 *
 * @returns [asset_inspections, users, assets]
 */
// TODO(M-09): report_date has one-second resolution and no tie-break here, so reports filed in the same second come back in no fixed order (in both lists). Phase 3, with the shared ordering rule.
export function findSummaryLookups() {
    return Promise.all([
        prisma.asset_inspections.findMany({
            orderBy: { inspected_at: 'desc' }
        }),
        prisma.users.findMany(),
        prisma.assets.findMany(),
    ]);
}

/** Every report, newest first, each with its asset and its reporter, for the detailed list. */
export function findAllWithAssetAndReporter() {
    return prisma.asset_inspections.findMany({
        orderBy: { inspected_at: "desc" },
        include: {
            assets: true,
            users: true
        }
    });
}
