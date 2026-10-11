import type { Prisma, asset_records, asset_reports, assets } from '@prisma/client';
import { prisma } from '../../config/prisma';

/**
 * Every row of the nine tables the asset list is built from, read together.
 *
 * @returns [assets, asset_monetary, asset_records, users, approved asset_loans, asset_disposals, asset_transfers, asset_reports, projects]
 */
export function findListTables() {
    // These 9 queries are all independent (no query depends on another's
    // result — they're cross-referenced together afterward in JS), so
    // running them with Promise.all instead of one-at-a-time cuts this
    // request's total connection-hold time from ~9 round trips to ~1,
    // which matters a lot against a small connection pool talking to a
    // remote DB.
    return Promise.all([
        prisma.assets.findMany(),
        prisma.asset_monetary.findMany(),
        prisma.asset_records.findMany({
            orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }]
        }),
        prisma.users.findMany(),
        // Needed to surface due dates on the borrower's "My Assets" list —
        // approved loans are the source of truth for when a device is due back.
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

/** The asset with this tag, or null. */
export function findByTag(assetTag: string) {
    return prisma.assets.findUnique({ where: { asset_tag: assetTag } });
}

/** The asset with this id, or null. */
export function findById(assetId: number) {
    return prisma.assets.findUnique({
        where: { asset_id: assetId }
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

/** The tags of every asset whose tag starts with "<labPrefix>-". */
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
 * @returns the created assets row
 */
export async function createWithRecords(
    assetData: Prisma.assetsUncheckedCreateInput,
    monetaryData: Omit<Prisma.asset_monetaryUncheckedCreateInput, 'asset_id'>,
    recordData: Omit<Prisma.asset_recordsUncheckedCreateInput, 'asset_id'>,
) {
    // assets / asset_monetary / asset_records / projects are written
    // together so a failure on any one of them rolls back the whole
    // registration.
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

/** The first user whose first and last name match exactly, or null. (H-10) */
export function findUserByName(firstName: string, lastName: string) {
    return prisma.users.findFirst({
        where: { first_name: firstName, last_name: lastName },
    });
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
 * and, when the edit carries a condition or remarks, an inspection report.
 *
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

        // asset_records is an append-style log — edit the most recent entry
        // for this asset rather than rewriting history.
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

        // Record inspection in asset_reports table when condition or remarks are submitted
        if (report) {
            // Save new record in asset_reports (preserving previous records)
            await tx.asset_reports.create({
                data: report.data
            });

            // Retrieve most latest inspection report for asset_condition
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

/** Deletes an asset and every row that points at it, in one transaction. */
export function deleteWithHistory(assetId: number) {
    // No ON DELETE CASCADE is defined in the schema, so every table with an
    // asset_id FK has to be cleared out first or this fails on a constraint error.
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
