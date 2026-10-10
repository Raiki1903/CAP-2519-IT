/**
 * Inspection report row access: every database read and write the inspection endpoints make.
 * Layer: repository. Called by inspections.service.ts. Calls server/config/prisma.ts.
 * Used by: Custodian condition report, Staff inspection finalize, and the screens that list reports.
 */
import type { Prisma, asset_records, asset_reports } from '@prisma/client';
import { prisma } from '../../config/prisma';

// The next three read other features' tables. They live here until the assets and auth
// repositories are extracted (later in step 12), so that no inspection code calls Prisma outside this file.

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

/** How a new report changes the asset's records: update the newest record in place, or create the first one. */
export type RecordSync =
    | { update: { assetRecordId: number; data: Prisma.asset_recordsUncheckedUpdateInput } }
    | { create: Prisma.asset_recordsUncheckedCreateInput };

/**
 * Inserts a report and syncs the asset's records with the asset's newest report, in one transaction.
 * The newest report and the newest record are read inside the transaction, after the insert, and handed
 * to the service, which decides the record change.
 *
 * @param data the new asset_reports row
 * @param syncRecord decides the record change from the newest report and the newest record
 * @returns the created asset_reports row
 */
export function saveReport(
    data: Prisma.asset_reportsUncheckedCreateInput,
    syncRecord: (latestReport: asset_reports | null, latestRecord: asset_records | null) => RecordSync,
) {
    // The report and the record change are written together, so a failure on either leaves neither
    // (a reportedById that is no account fails the insert, and nothing is written).
    return prisma.$transaction(async (tx) => {
        // Every report is a new row; older reports are kept.
        const report = await tx.asset_reports.create({ data });

        // Ties on the one-second report_date fall to the higher report_id, so among reports filed in the
        // same second, the one just written counts as the newest.
        const latestReport = await tx.asset_reports.findFirst({
            where: { asset_id: data.asset_id },
            orderBy: [{ report_date: "desc" }, { report_id: "desc" }],
        });

        // TODO(M-09): no tie-break on asset_record_id, so two records logged in the same second can be read in the wrong order. Later in step 12 or Phase 3, with the shared asset state rule.
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

/**
 * Every report (newest first), user, and asset, read together so the short list can name
 * each report's asset and reporter.
 *
 * @returns [asset_reports, users, assets]
 */
// TODO(M-09): report_date has one-second resolution and no tie-break here, so reports filed in the same second come back in no fixed order (in both lists). Phase 3, with the shared ordering rule.
export function findSummaryLookups() {
    return Promise.all([
        prisma.asset_reports.findMany({
            orderBy: { report_date: 'desc' }
        }),
        prisma.users.findMany(),
        prisma.assets.findMany(),
    ]);
}

/** Every report, newest first, each with its asset and its reporter, for the detailed list. */
export function findAllWithAssetAndReporter() {
    return prisma.asset_reports.findMany({
        orderBy: { report_date: "desc" },
        include: {
            assets: true,
            users: true
        }
    });
}
