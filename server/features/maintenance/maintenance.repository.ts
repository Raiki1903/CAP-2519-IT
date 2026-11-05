/**
 * Maintenance row access: every database read and write the maintenance endpoints make.
 * Layer: repository. Called by maintenance.service.ts. Calls server/config/prisma.ts, shared/services/rowLocks.ts,
 * shared/services/assetState.ts (the open loan, read inside the lock), and shared/services/inspectionShape.ts (what an
 * inspection includes, and its metric baselines).
 * Used by: reporting an issue, TSG receipt and the maintenance steps, cancelling a ticket, and the ticket lists.
 */
import type { Prisma } from '@prisma/client';
import { OPEN_MAINTENANCE_STATUSES } from '@shared/constants/maintenanceStatuses';
import { prisma } from '../../config/prisma';
import { lockAsset } from '../../shared/services/rowLocks';
import { openLoanOf } from '../../shared/services/assetState';
import { INSPECTION_INCLUDE, PERSON, metricBaselinesOf } from '../../shared/services/inspectionShape';

/** What a ticket read for the Maintenance shape includes. */
const TICKET_INCLUDE = {
    assets: { select: { asset_id: true, asset_tag: true, name: true, warranty_expiry: true } },
    users: PERSON,
    received_by: PERSON,
    completed_by: PERSON,
    issue_types: true,
    trigger_inspection: { include: INSPECTION_INCLUDE },
    completion_inspection: { include: INSPECTION_INCLUDE },
} satisfies Prisma.asset_maintenanceInclude;

/** A ticket row with everything the Maintenance shape names. */
export type TicketRow = Prisma.asset_maintenanceGetPayload<{ include: typeof TICKET_INCLUDE }>;

/** Ticket rows for the Maintenance shape, with the metric baselines their inspections are flagged against. */
export interface TicketRows {
    rows: TicketRow[];
    /** The asset's first recorded value of each metric, keyed "<assetId>:<metricId>". */
    baselines: Map<string, number>;
}

/** Newest report first, for every ticket list. Tickets reported in the same second keep their id order. (M-09) */
const NEWEST_FIRST: Prisma.asset_maintenanceOrderByWithRelationInput[] = [{ reported_at: 'desc' }, { maintenance_id: 'desc' }];

/**
 * Ticket rows in the Maintenance shape's detail, newest report first, and the metric baselines of their inspections,
 * in two queries whatever the number of tickets.
 *
 * @param where which tickets
 */
export async function findTickets(where: Prisma.asset_maintenanceWhereInput): Promise<TicketRows> {
    const rows = await prisma.asset_maintenance.findMany({ where, orderBy: NEWEST_FIRST, include: TICKET_INCLUDE });
    const inspections = rows.flatMap(r => [r.trigger_inspection, r.completion_inspection]).filter(i => i !== null);
    return { rows, baselines: await metricBaselinesOf(prisma, inspections) };
}

/** The ticket with this id, or null. Its asset never changes, so a step reads it first to know which asset to lock. */
export function findById(maintenanceId: number) {
    return prisma.asset_maintenance.findUnique({ where: { maintenance_id: maintenanceId } });
}

/** Whether an issue type with this id exists. */
export async function issueTypeExists(issueTypeId: number): Promise<boolean> {
    return (await prisma.issue_types.count({ where: { issue_type_id: issueTypeId } })) > 0;
}

/**
 * Runs one maintenance step in a transaction that locks the asset row first. The step then reads the ticket, the loan
 * and the asset again inside the lock and checks them, so two steps on one asset run one after the other and the
 * second sees what the first wrote. Every step locks the asset before anything else, so no two steps wait on each
 * other. (H-05)
 *
 * @param assetId the ticket's asset
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

/** The ticket row, read inside the caller's transaction. */
export function findTicketIn(tx: Prisma.TransactionClient, maintenanceId: number) {
    return tx.asset_maintenance.findUniqueOrThrow({ where: { maintenance_id: maintenanceId } });
}

/** The asset's open loan, read inside the caller's transaction. */
export function findOpenLoanIn(tx: Prisma.TransactionClient, assetId: number) {
    return openLoanOf(tx, assetId);
}

/** The asset's open ticket (Pending Receipt, Inspecting, Repairing, External Service), or null, inside the caller's transaction. */
export function findOpenTicketIn(tx: Prisma.TransactionClient, assetId: number) {
    return tx.asset_maintenance.findFirst({
        where: { asset_id: assetId, status: { in: [...OPEN_MAINTENANCE_STATUSES] } },
        orderBy: { maintenance_id: 'asc' },
    });
}

/** Inserts an asset_maintenance row inside the caller's transaction and returns it. */
export function createTicket(tx: Prisma.TransactionClient, data: Prisma.asset_maintenanceUncheckedCreateInput) {
    return tx.asset_maintenance.create({ data });
}

/** Changes a ticket row inside the caller's transaction and returns it. */
export function updateTicket(tx: Prisma.TransactionClient, maintenanceId: number, data: Prisma.asset_maintenanceUncheckedUpdateInput) {
    return tx.asset_maintenance.update({ where: { maintenance_id: maintenanceId }, data });
}

/** Changes a loan row inside the caller's transaction. */
export function updateLoanIn(tx: Prisma.TransactionClient, loanId: number, data: Prisma.asset_loansUncheckedUpdateInput) {
    return tx.asset_loans.update({ where: { loan_id: loanId }, data });
}
