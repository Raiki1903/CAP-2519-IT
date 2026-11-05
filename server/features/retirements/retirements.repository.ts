/**
 * Disposal row access: every database read and write the disposal endpoints make.
 * Layer: repository. Called by retirements.service.ts. Calls server/config/prisma.ts, shared/services/rowLocks.ts, and
 * shared/services/inspectionShape.ts (what an inspection includes, and its metric baselines).
 * Used by: TSG disposal requests and completion, the Director's and the Secretary's decisions, and the disposal lists.
 */
import type { Prisma } from '@prisma/client';
import { OPEN_MAINTENANCE_STATUSES } from '@shared/constants/maintenanceStatuses';
import { prisma } from '../../config/prisma';
import { lockAsset } from '../../shared/services/rowLocks';
import { INSPECTION_INCLUDE, PERSON, metricBaselinesOf } from '../../shared/services/inspectionShape';

/** What a disposal read for the Retirement shape includes. */
const RETIREMENT_INCLUDE = {
    assets: { select: { asset_id: true, asset_tag: true, name: true } },
    users: PERSON,
    decided_by: PERSON,
    completed_by: PERSON,
    assessment_inspection: { include: INSPECTION_INCLUDE },
} satisfies Prisma.asset_retirementsInclude;

/** A disposal row with everything the Retirement shape names. */
export type RetirementRow = Prisma.asset_retirementsGetPayload<{ include: typeof RETIREMENT_INCLUDE }>;

/** Disposal rows for the Retirement shape, with the metric baselines of their assessment inspections. */
export interface RetirementRows {
    rows: RetirementRow[];
    /** The asset's first recorded value of each metric, keyed "<assetId>:<metricId>". */
    baselines: Map<string, number>;
}

/** The disposal statuses that are still open: a second request on the asset is refused while one is. */
const OPEN_RETIREMENT_STATUSES = ["PENDING", "APPROVED"] as const;

/**
 * Disposal rows in the Retirement shape's detail, newest request first (ties by id), and the metric baselines of their
 * assessment inspections, in two queries whatever the number of disposals.
 *
 * @param where which disposals
 */
export async function findRetirements(where: Prisma.asset_retirementsWhereInput): Promise<RetirementRows> {
    const rows = await prisma.asset_retirements.findMany({
        where,
        orderBy: [{ requested_at: 'desc' }, { retirement_id: 'desc' }],
        include: RETIREMENT_INCLUDE,
    });
    const inspections = rows.map(r => r.assessment_inspection).filter(i => i !== null);
    return { rows, baselines: await metricBaselinesOf(prisma, inspections) };
}

/** The disposal with this id, or null. Its asset never changes, so a step reads it first to know which asset to lock. */
export function findById(retirementId: number) {
    return prisma.asset_retirements.findUnique({ where: { retirement_id: retirementId } });
}

/**
 * Runs one disposal step in a transaction that locks the asset row first. The step then reads the disposal, the
 * tickets and the asset again inside the lock and checks them, so two steps on one asset run one after the other.
 * (H-05)
 *
 * @param assetId the disposal's asset
 * @param step the reads, checks, and writes, given the transaction
 * @returns what the step returns
 */
export function withAssetLock<T>(assetId: number, step: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
        await lockAsset(tx, assetId);
        return step(tx);
    });
}

/** The asset row, read inside the caller's transaction. */
export function findAssetIn(tx: Prisma.TransactionClient, assetId: number) {
    return tx.assets.findUniqueOrThrow({ where: { asset_id: assetId } });
}

/** The disposal row, read inside the caller's transaction. */
export function findRetirementIn(tx: Prisma.TransactionClient, retirementId: number) {
    return tx.asset_retirements.findUniqueOrThrow({ where: { retirement_id: retirementId } });
}

/** The asset's disposal in Pending or Approved, or null, inside the caller's transaction. */
export function findOpenRetirementIn(tx: Prisma.TransactionClient, assetId: number) {
    return tx.asset_retirements.findFirst({ where: { asset_id: assetId, status: { in: [...OPEN_RETIREMENT_STATUSES] } } });
}

/**
 * The asset's newest maintenance ticket and whether any ticket is still open, inside the caller's transaction.
 *
 * @returns the newest ticket's status (null when it has none), and the open ticket's id (null when none is open)
 */
export async function findTicketStateIn(tx: Prisma.TransactionClient, assetId: number) {
    const [latest, open] = await Promise.all([
        tx.asset_maintenance.findFirst({ where: { asset_id: assetId }, orderBy: [{ reported_at: 'desc' }, { maintenance_id: 'desc' }], select: { status: true } }),
        tx.asset_maintenance.findFirst({ where: { asset_id: assetId, status: { in: [...OPEN_MAINTENANCE_STATUSES] } }, select: { maintenance_id: true } }),
    ]);
    return { latestStatus: latest?.status ?? null, openTicketId: open?.maintenance_id ?? null };
}

/** Inserts an asset_retirements row inside the caller's transaction and returns it. */
export function createRetirement(tx: Prisma.TransactionClient, data: Prisma.asset_retirementsUncheckedCreateInput) {
    return tx.asset_retirements.create({ data });
}

/** Changes a disposal row inside the caller's transaction. */
export function updateRetirement(tx: Prisma.TransactionClient, retirementId: number, data: Prisma.asset_retirementsUncheckedUpdateInput) {
    return tx.asset_retirements.update({ where: { retirement_id: retirementId }, data });
}
