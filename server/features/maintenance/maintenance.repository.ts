/**
 * Repair row access: every database read and write the repair endpoints make.
 * Layer: repository. Called by maintenance.service.ts. Calls server/config/prisma.ts.
 * Used by: Custodian repair request, Staff repair queue and progress updates, and the screens that list repairs.
 */
import type { Prisma, asset_maintenance_status, asset_records } from '@prisma/client';
import { prisma } from '../../config/prisma';

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

/** What a "Fixed & Completed" update appends: the record that restores the asset, and an inspection report. */
export interface CompletionRows {
    record: Prisma.asset_recordsUncheckedCreateInput;
    report: Prisma.asset_inspectionsUncheckedCreateInput;
}

/** A ticket's new status, and who has the asset when an outside service has it. */
export interface TicketProgress {
    status: asset_maintenance_status;
    provider?: string;
}

/**
 * Sets a ticket's status and moves the asset to match, in one transaction.
 * The asset's records are read inside the transaction, after the ticket update, and handed to
 * the service's builder; at most one of the two builders is given.
 *
 * @param repairId the ticket to update
 * @param progress the new status, and the provider for an outside service
 * @param assetId the ticket's asset
 * @param buildCompletion for "Fixed & Completed": builds the restoring record and the report from the
 *   asset's newest record before maintenance and its newest record overall; null otherwise
 * @param buildMaintenanceRecord for a maintenance status: builds the MAINTENANCE record from the newest
 *   record, or returns null to write none; null otherwise
 * @returns the updated asset_maintenance row
 */
export function saveProgress(
    repairId: number,
    progress: TicketProgress,
    assetId: number,
    buildCompletion: ((preMaintenanceRecord: asset_records | null, latestRecord: asset_records | null) => CompletionRows) | null,
    buildMaintenanceRecord: ((latestRecord: asset_records | null) => Prisma.asset_recordsUncheckedCreateInput | null) | null,
) {
    // The ticket (asset_maintenance) and the asset's status (asset_records) are written together,
    // so a failure on either leaves neither.
    return prisma.$transaction(async (tx) => {
        const repair = await tx.asset_maintenance.update({
            where: { maintenance_id: repairId },
            data: { status: progress.status, ...(progress.provider ? { provider: progress.provider } : {}) },
        });

        if (buildCompletion) {
            // TODO(M-09): this read and the two below order by date_logged only, with no tie-break on asset_record_id, so two records logged in the same second can be read in the wrong order. Phase 3, with the shared asset state rule.
            const preMaintenanceRecord = await tx.asset_records.findFirst({
                where: { asset_id: assetId, status: { not: "MAINTENANCE" } },
                orderBy: { date_logged: "desc" },
            });

            const latestRecord = await tx.asset_records.findFirst({
                where: { asset_id: assetId },
                orderBy: { date_logged: "desc" },
            });

            const { record, report } = buildCompletion(preMaintenanceRecord, latestRecord);

            await tx.asset_records.create({ data: record });

            // The completed repair also appears in the asset's inspection history.
            await tx.asset_inspections.create({ data: report });
        } else if (buildMaintenanceRecord) {
            const latestRecord = await tx.asset_records.findFirst({
                where: { asset_id: assetId },
                orderBy: { date_logged: "desc" },
            });

            const record = buildMaintenanceRecord(latestRecord);
            if (record) {
                await tx.asset_records.create({ data: record });
            }
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
        data: { status: progress.status, ...(progress.provider ? { provider: progress.provider } : {}) },
    });
}
