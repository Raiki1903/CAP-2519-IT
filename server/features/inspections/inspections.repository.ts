/**
 * Inspection row access: the reads the inspection endpoints make. A filing is written by shared/services/inspections.ts
 * inside the asset lock (features/assets/assets.repository.ts).
 * Layer: repository. Called by inspections.service.ts. Calls server/config/prisma.ts, shared/services/assetState.ts
 * (the newest TSG inspection), and shared/services/inspectionShape.ts (the Inspection includes and baselines).
 * Used by: Custodian condition report, Staff inspection finalize, the routine queue, and the screens that list reports.
 */
import { prisma } from '../../config/prisma';
import { conditionsFor } from '../../shared/services/assetState';
import { INSPECTION_INCLUDE, metricBaselinesOf } from '../../shared/services/inspectionShape';

/**
 * One inspection with its inspector and metrics, and the metric baselines its Inspection shape flags against.
 *
 * @param inspectionId the inspection
 */
export async function findInspectionWithBaselines(inspectionId: number) {
    const row = await prisma.asset_inspections.findUniqueOrThrow({ where: { inspection_id: inspectionId }, include: INSPECTION_INCLUDE });
    return { row, baselines: await metricBaselinesOf(prisma, [row]) };
}

/**
 * When TSG last inspected each asset (any type but Self Report), in one query.
 *
 * @param assetIds the assets
 * @returns the time by asset id; an asset TSG never inspected is not in the map
 */
export async function findLastTsgInspections(assetIds: number[]): Promise<Map<number, Date>> {
    const conditions = await conditionsFor(prisma, assetIds);
    return new Map([...conditions].map(([assetId, c]) => [assetId, c.inspectedAt]));
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
