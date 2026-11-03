/**
 * Repair row access: every database read and write the repair endpoints make.
 * Layer: repository. Called by maintenance.service.ts. Calls server/config/prisma.ts, shared/services/assetStatus.ts,
 * and shared/services/rowLocks.ts.
 * Used by: Custodian repair request, Staff repair queue and progress updates, and the screens that list repairs.
 */
import { asset_inspections_type, asset_loans_status, type Prisma, type asset_condition, type asset_maintenance, type asset_maintenance_status } from '@prisma/client';
import { HELD_LOAN_STATUSES } from '@shared/constants/loanStatuses';
import { prisma } from '../../config/prisma';
import { setAssetStatus } from '../../shared/services/assetStatus';
import { lockAsset } from '../../shared/services/rowLocks';

/** Inserts an asset_maintenance row and returns it. */
export function create(data: Prisma.asset_maintenanceUncheckedCreateInput) {
    return prisma.asset_maintenance.create({ data });
}

/**
 * Every repair (newest first), asset, and user, read together so the list can name
 * each ticket's asset and reporter.
 *
 * @returns [asset_maintenance, assets, users]
 */
// TODO(M-09): created_at has one-second resolution and no tie-break, so tickets filed in the same second come back in no fixed order. Phase 3, with the shared ordering rule.
export function findListLookups() {
    return Promise.all([
        prisma.asset_maintenance.findMany({ orderBy: { reported_at: 'desc' } }),
        prisma.assets.findMany(),
        prisma.users.findMany(),
    ]);
}

/** The repair ticket with this id, or null. */
export function findById(repairId: number) {
    return prisma.asset_maintenance.findUnique({ where: { maintenance_id: repairId } });
}

/** A ticket's new status, and who has the asset when an outside service has it. */
export interface TicketProgress {
    status: asset_maintenance_status;
    provider?: string;
}

/** The ticket fields a progress change writes. */
function progressData(progress: TicketProgress) {
    return { status: progress.status, ...(progress.provider ? { provider: progress.provider } : {}) };
}

/**
 * Receives the asset for its ticket, in one transaction: the ticket's status with who received it and when, a held
 * loan of the asset ended as Ended by Maintenance, and the asset set to Maintenance. The asset row is locked first.
 *
 * @param ticket the ticket
 * @param progress the received status it moves to
 * @param staffId the session user who receives the asset
 * @returns the updated asset_maintenance row
 */
export function saveReceipt(ticket: asset_maintenance, progress: TicketProgress, staffId: number) {
    return prisma.$transaction(async (tx) => {
        await lockAsset(tx, ticket.asset_id);
        const now = new Date();
        const repair = await tx.asset_maintenance.update({
            where: { maintenance_id: ticket.maintenance_id },
            data: { ...progressData(progress), received_by_id: ticket.received_by_id ?? staffId, received_at: ticket.received_at ?? now },
        });
        await tx.asset_loans.updateMany({
            where: { asset_id: ticket.asset_id, status: { in: [...HELD_LOAN_STATUSES] } },
            data: { status: asset_loans_status.ENDED_BY_MAINTENANCE, closed_at: now },
        });
        await setAssetStatus(tx, ticket.asset_id, "MAINTENANCE");
        return repair;
    });
}

/**
 * Completes a ticket as Resolved, in one transaction: a Maintenance inspection under the Staff member, the ticket
 * closed with who completed it, when, the remarks, and the inspection, and an asset that was in Maintenance set back to
 * Available. The asset row is locked first.
 *
 * @param ticket the ticket
 * @param progress the Resolved status
 * @param staffId the session user who completes it
 * @param condition the condition after the repair
 * @param remarks the completion remarks, cut to the inspection's 255 characters there
 * @param wasInMaintenance whether the asset is in Maintenance, so goes back to Available
 * @returns the updated asset_maintenance row
 */
export function saveCompletion(
    ticket: asset_maintenance,
    progress: TicketProgress,
    staffId: number,
    condition: asset_condition,
    remarks: string,
    wasInMaintenance: boolean,
) {
    return prisma.$transaction(async (tx) => {
        await lockAsset(tx, ticket.asset_id);
        // The completed repair also appears in the asset's inspection history, and sets its condition now.
        const inspection = await tx.asset_inspections.create({
            data: {
                asset_id: ticket.asset_id,
                inspected_by_id: staffId,
                type: asset_inspections_type.MAINTENANCE,
                condition,
                remarks: remarks.slice(0, 255),
            },
        });
        const repair = await tx.asset_maintenance.update({
            where: { maintenance_id: ticket.maintenance_id },
            data: {
                ...progressData(progress),
                completed_by_id: staffId,
                completed_at: new Date(),
                resolution_remarks: remarks,
                completion_inspection_id: inspection.inspection_id,
            },
        });
        if (wasInMaintenance) {
            await setAssetStatus(tx, ticket.asset_id, "AVAILABLE");
        }
        return repair;
    });
}

/**
 * Sets only a ticket's status, for the status-only endpoint. The asset is not touched. (H-06)
 *
 * @returns the updated asset_maintenance row
 * @throws Prisma's error if the id is not a number or no ticket has it (answered as a 500, H-16)
 */
export function updateProgressStatus(repairId: number, progress: TicketProgress) {
    return prisma.asset_maintenance.update({
        where: { maintenance_id: repairId },
        data: progressData(progress),
    });
}
