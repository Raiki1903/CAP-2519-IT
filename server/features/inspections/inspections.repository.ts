import type { Prisma, asset_records, asset_reports } from '@prisma/client';
import { prisma } from '../../config/prisma';

/** The asset with this tag, or null. */
export function findAssetByTag(assetTag: string) {
    return prisma.assets.findUnique({ where: { asset_tag: assetTag } });
}

/** The asset with this id, or null. */
export function findAssetById(assetId: number) {
    return prisma.assets.findUnique({ where: { asset_id: assetId } });
}

/** The user with this email, or null. */
export function findUserByEmail(email: string) {
    return prisma.users.findUnique({ where: { email } });
}

/** How a new report changes the asset's records: update the newest one, or create the first one. */
export type RecordSync =
    | { update: { assetRecordId: number; data: Prisma.asset_recordsUncheckedUpdateInput } }
    | { create: Prisma.asset_recordsUncheckedCreateInput };

/**
 * Inserts a report and syncs the asset's records with the newest report, in one transaction.
 *
 * @param syncRecord decides the record change from the newest report and the newest record
 */
export function saveReport(
    data: Prisma.asset_reportsUncheckedCreateInput,
    syncRecord: (latestReport: asset_reports | null, latestRecord: asset_records | null) => RecordSync,
) {
    return prisma.$transaction(async (tx) => {
        // Always create a NEW inspection report record in asset_reports (preserving older records)
        const report = await tx.asset_reports.create({ data });

        // Fetch the most LATEST inspection report for this asset to update asset_condition
        const latestReport = await tx.asset_reports.findFirst({
            where: { asset_id: data.asset_id },
            orderBy: [{ report_date: "desc" }, { report_id: "desc" }],
        });

        // Sync latest condition into asset_records
        const latestRecord = await tx.asset_records.findFirst({
            where: { asset_id: data.asset_id },
            orderBy: { date_logged: "desc" },
        });

        const sync = syncRecord(latestReport, latestRecord);
        if ('update' in sync) {
            await tx.asset_records.update({
                where: { asset_record_id: sync.update.assetRecordId },
                data: sync.update.data,
            });
        } else {
            await tx.asset_records.create({ data: sync.create });
        }

        return report;
    });
}

/** Every report (newest first), user, and asset. */
export function findSummaryLookups() {
    return Promise.all([
        prisma.asset_reports.findMany({
            orderBy: { report_date: 'desc' }
        }),
        prisma.users.findMany(),
        prisma.assets.findMany(),
    ]);
}

/** Every report, newest first, with its asset and reporter. */
export function findAllWithAssetAndReporter() {
    return prisma.asset_reports.findMany({
        orderBy: { report_date: "desc" },
        include: {
            assets: true,
            users: true
        }
    });
}
