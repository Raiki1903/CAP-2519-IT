import type { Prisma, asset_records } from '@prisma/client';
import { prisma } from '../../config/prisma';

/** The asset with this tag, or null. */
export function findAssetByTag(assetTag: string) {
    return prisma.assets.findUnique({ where: { asset_tag: assetTag } });
}

/** The first user whose first and last name match exactly, or null. */
export function findUserByName(firstName: string, lastName: string) {
    return prisma.users.findFirst({
        where: { first_name: firstName, last_name: lastName },
    });
}

/** Inserts an asset_repairs row and returns it. */
export function create(data: Prisma.asset_repairsUncheckedCreateInput) {
    return prisma.asset_repairs.create({ data });
}

/** Every repair (newest first), asset, and user. */
export function findListLookups() {
    return Promise.all([
        prisma.asset_repairs.findMany({ orderBy: { created_at: 'desc' } }),
        prisma.assets.findMany(),
        prisma.users.findMany(),
    ]);
}

/** The repair ticket with this id, or null. */
export function findById(repairId: number) {
    return prisma.asset_repairs.findUnique({ where: { repair_id: repairId } });
}

/** What a "Fixed & Completed" update appends: the restoring record and the report. */
export interface CompletionRows {
    record: Prisma.asset_recordsUncheckedCreateInput;
    report: Prisma.asset_reportsUncheckedCreateInput;
}

/**
 * Sets a ticket's progress_status and moves the asset to match, in one transaction.
 *
 * @param buildCompletion for "Fixed & Completed": builds the restoring record and the report from the
 *   asset's newest record before maintenance and its newest record; null otherwise
 * @param buildMaintenanceRecord for a maintenance status: builds the MAINTENANCE record from the newest
 *   record, or returns null to write none; null otherwise
 */
export function saveProgress(
    repairId: number,
    progressStatus: string,
    assetId: number,
    buildCompletion: ((preMaintenanceRecord: asset_records | null, latestRecord: asset_records | null) => CompletionRows) | null,
    buildMaintenanceRecord: ((latestRecord: asset_records | null) => Prisma.asset_recordsUncheckedCreateInput | null) | null,
) {
    // asset_repairs (the ticket) and asset_records (the asset's actual
    // status) are updated together so a failure on either rolls back both.
    return prisma.$transaction(async (tx) => {
        const repair = await tx.asset_repairs.update({
            where: { repair_id: repairId },
            data: { progress_status: progressStatus },
        });

        if (buildCompletion) {
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

            // Record in asset_reports table for inspection history
            await tx.asset_reports.create({ data: report });
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

/** Sets only a ticket's progress_status and returns the updated row. */
export function updateProgressStatus(repairId: number, progressStatus: string) {
    return prisma.asset_repairs.update({
        where: { repair_id: repairId },
        data: { progress_status: progressStatus },
    });
}
