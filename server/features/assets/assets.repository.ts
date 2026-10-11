/**
 * Asset row access: every database read and write the asset registry endpoints make, plus the asset reads other
 * features need (an asset by tag or by id, the newest record for a transfer request, and the newest record's status
 * for the custody request guard).
 * Layer: repository. Called by assets.service.ts, the services of features/loans, returns, transfers, disposals, repairs,
 * and inspections, and shared/services/custodyRequestGuard.ts. Calls config/prisma.ts.
 * Used by: every role's inventory view, Staff registration, editing, and deletion, and every workflow that starts from an asset tag.
 */
import type { Prisma, asset_records, asset_reports, assets } from '@prisma/client';
import { prisma } from '../../config/prisma';

/**
 * Every row of the nine tables the asset list is built from, read together.
 *
 * @returns [assets, asset_monetary, asset_records, users, approved asset_loans, asset_disposals, asset_transfers, asset_reports, projects]
 */
export function findListTables() {
    // The nine reads do not depend on each other, so they run together: about one round trip instead of nine,
    // which matters with a small connection pool and a remote database.
    // projects is read but not used by the list. (M-01)
    return Promise.all([
        prisma.assets.findMany(),
        prisma.asset_monetary.findMany(),
        prisma.asset_records.findMany({
            orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }]
        }),
        prisma.users.findMany(),
        // Approved loans only: they hold the due dates My Assets shows.
        prisma.asset_loans.findMany({
            where: { status: "approved" },
            orderBy: { loaned_on: "desc" },
        }),
        prisma.asset_disposals.findMany({
            orderBy: { disposal_date: "desc" },
        }),
        prisma.asset_transfers.findMany({
            orderBy: { requested_on: "desc" }
        }),
        prisma.asset_reports.findMany({
            orderBy: { report_date: "desc" }
        }),
        prisma.projects.findMany(),
    ]);
}

/** The asset with this tag, or null. Used by the asset endpoints and by every workflow that starts from a tag in the URL. */
export function findByTag(assetTag: string) {
    return prisma.assets.findUnique({ where: { asset_tag: assetTag } });
}

/** The asset with this id, or null. The fallback of the custodian history and the inspection report when the tag is a number. */
export function findById(assetId: number) {
    return prisma.assets.findUnique({
        where: { asset_id: assetId }
    });
}

/** The status of the asset's newest record, or null if it has none. Read by the custody request guard. (H-05) */
export function findLatestRecordStatus(assetId: number) {
    // Same ordering GET /api/assets uses, so this agrees with the status the screens show.
    return prisma.asset_records.findFirst({
        where: { asset_id: assetId },
        orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }],
        select: { status: true },
    });
}

// It is not the custody request guard's reader above: that one breaks ties on asset_record_id, this one does not,
// so the two can disagree. (M-09)
/** The asset's newest record, or null if it has none. Read by the transfer request. */
// TODO(M-09): no tie-break on asset_record_id, unlike the custody request guard and GET /api/assets, so two records logged in the same second can disagree with them. Phase 3, with the shared asset state rule.
export function findLatestRecord(assetId: number) {
    return prisma.asset_records.findFirst({
        where: { asset_id: assetId },
        orderBy: { date_logged: "desc" },
    });
}

/** The asset's records, oldest first, each with its custodian. */
export function findRecordsWithCustodian(assetId: number) {
    return prisma.asset_records.findMany({
        where: { asset_id: assetId },
        orderBy: [{ date_logged: 'asc' }, { asset_record_id: 'asc' }],
        include: {
            users: true
        }
    });
}

/** The tags of every asset whose tag starts with "<labPrefix>-", for the next tag number. */
export function findTagsWithPrefix(labPrefix: string) {
    return prisma.assets.findMany({
        where: {
            asset_tag: {
                startsWith: `${labPrefix}-`
            }
        },
        select: { asset_tag: true }
    });
}

/**
 * Registers an asset: the assets row, its asset_monetary row, and its first record, in one transaction.
 *
 * @param assetData the assets row, tag included
 * @param monetaryData the asset_monetary row without its asset_id
 * @param recordData the first asset_records row without its asset_id
 * @returns the created assets row
 */
export async function createWithRecords(
    assetData: Prisma.assetsUncheckedCreateInput,
    monetaryData: Omit<Prisma.asset_monetaryUncheckedCreateInput, 'asset_id'>,
    recordData: Omit<Prisma.asset_recordsUncheckedCreateInput, 'asset_id'>,
) {
    // The three rows are written together, so a failure on any of them leaves no half-registered asset.
    const { asset } = await prisma.$transaction(async (tx) => {
        const asset = await tx.assets.create({
            data: assetData,
        });

        await tx.asset_monetary.create({
            data: {
                asset_id: asset.asset_id,
                ...monetaryData,
            },
        });

        await tx.asset_records.create({
            data: {
                asset_id: asset.asset_id,
                ...recordData,
            },
        });

        return { asset };
    });
    return asset;
}

/** What an edit writes once the newest record is known: the record values, and the inspection report if any. */
export interface EditRows {
    record: Omit<Prisma.asset_recordsUncheckedCreateInput, 'asset_id'>;
    report: {
        data: Prisma.asset_reportsUncheckedCreateInput;
        syncFromReport: (latestReport: asset_reports | null) => Prisma.asset_recordsUncheckedUpdateInput;
    } | null;
}

/**
 * Saves an asset edit in one transaction: the assets fields, the monetary row, the newest record,
 * and, when the edit carries a condition or remarks, an inspection report. The reads and writes run in
 * the order the old handler ran them; the edit queries are kept as they are. On the slow CCS Cloud link this one interactive
 * transaction can outlast Prisma's transaction timeout, and the edit then fails with P2028, "expired transaction" (issue #8).
 * The newest record is read inside the transaction, after the assets and monetary writes, and handed to the
 * service, which builds the record values and the report.
 *
 * @param existing the asset being edited
 * @param assetUpdateData only the assets fields the request sent; nothing is written when empty
 * @param monetary the upsert for asset_monetary, or null to leave it alone
 * @param buildRows builds the record values and the report from the newest record
 * @returns the assets row, updated or as it was
 */
export function saveEdit(
    existing: assets,
    assetUpdateData: Prisma.assetsUncheckedUpdateInput,
    monetary: { update: Prisma.asset_monetaryUncheckedUpdateInput; create: Prisma.asset_monetaryUncheckedCreateInput } | null,
    buildRows: (latestRecord: asset_records | null) => EditRows,
) {
    return prisma.$transaction(async (tx) => {
        let asset = existing;
        if (Object.keys(assetUpdateData).length > 0) {
            asset = await tx.assets.update({
                where: { asset_id: existing.asset_id },
                data: assetUpdateData,
            });
        }

        if (monetary) {
            await tx.asset_monetary.upsert({
                where: { asset_id: existing.asset_id },
                update: monetary.update,
                create: monetary.create,
            });
        }

        // The newest record is changed in place; no record is added.
        // TODO(H-14): an edit overwrites the newest history row (status, location, custodian, condition) instead of appending one, so the earlier state is lost. 01D appends; issue #74.
        // TODO(M-09): no tie-break on asset_record_id, unlike the asset list, so with two records in the same second this can change a different one than the list shows. With issue #74, or Phase 3 with the shared asset state rule.
        const latestRecord = await tx.asset_records.findFirst({
            where: { asset_id: existing.asset_id },
            orderBy: { date_logged: "desc" },
        });

        const { record, report } = buildRows(latestRecord);

        if (latestRecord) {
            await tx.asset_records.update({ where: { asset_record_id: latestRecord.asset_record_id }, data: record });
        } else {
            await tx.asset_records.create({ data: { asset_id: existing.asset_id, ...record } });
        }

        // An edit with a condition or remarks also files an inspection report, as a new row.
        if (report) {
            await tx.asset_reports.create({
                data: report.data
            });

            // Ties on the one-second report_date fall to the higher report_id, so the report just written counts as the newest.
            const latestReport = await tx.asset_reports.findFirst({
                where: { asset_id: existing.asset_id },
                orderBy: [{ report_date: "desc" }, { report_id: "desc" }],
            });

            if (latestRecord) {
                await tx.asset_records.update({
                    where: { asset_record_id: latestRecord.asset_record_id },
                    data: report.syncFromReport(latestReport)
                });
            }
        }

        return asset;
    });
}

/** Deletes an asset and the rows of seven tables that point at it, in one transaction. (H-03, issue #69: asset_reports is not among them) */
export function deleteWithHistory(assetId: number) {
    // The schema has no ON DELETE CASCADE, so the child rows go first, or the delete fails on a foreign key.
    return prisma.$transaction(async (tx) => {
        const id = assetId;
        await tx.asset_records.deleteMany({ where: { asset_id: id } });
        await tx.asset_monetary.deleteMany({ where: { asset_id: id } });
        await tx.asset_loans.deleteMany({ where: { asset_id: id } });
        await tx.asset_repairs.deleteMany({ where: { asset_id: id } });
        await tx.asset_transfers.deleteMany({ where: { asset_id: id } });
        await tx.asset_returns.deleteMany({ where: { asset_id: id } });
        await tx.asset_disposals.deleteMany({ where: { asset_id: id } });
        await tx.assets.delete({ where: { asset_id: id } });
    });
}
