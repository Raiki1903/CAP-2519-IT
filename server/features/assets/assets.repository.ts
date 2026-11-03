/**
 * Asset row access: every database read and write the asset registry endpoints make, plus the asset reads other
 * features need (an asset by tag or by id, and its state), and the newest record reads the transfer feature and the
 * custody request guard still make until commit 9 removes transfers.
 * Layer: repository. Called by assets.service.ts, the services of features/loans, returns, transfers, retirements,
 * maintenance, and inspections, and shared/services/custodyRequestGuard.ts. Calls config/prisma.ts,
 * shared/services/assetState.ts (with the shared client), and shared/services/rowLocks.ts.
 * Used by: every role's inventory view, Staff registration, editing, and deletion, and every workflow that starts from an asset tag.
 */
import { type Prisma, type asset_records, type assets } from '@prisma/client';
import type { AssetListFilters } from '@shared/types/assets';
import { prisma } from '../../config/prisma';
import * as assetState from '../../shared/services/assetState';
import { lockCenter } from '../../shared/services/rowLocks';

/** What every asset read for a list or a detail includes: the home lab, the owning project, and the funding source. */
const ASSET_DETAIL_INCLUDE = {
    research_centers: true,
    projects: true,
    funding_sources: true,
} satisfies Prisma.assetsInclude;

/** An asset with its home lab, owning project, and funding source. */
export type AssetWithDetail = Prisma.assetsGetPayload<{ include: typeof ASSET_DETAIL_INCLUDE }>;

/**
 * The assets the list shows, by asset id, with their home lab, project, and funding source.
 * `q` matches part of the tag, serial number, or name; the database's collation ignores letter case.
 *
 * @param filters the query string's filters, each optional
 */
export function findForList(filters: AssetListFilters) {
    const where: Prisma.assetsWhereInput = {};
    if (filters.q) {
        where.OR = [
            { asset_tag: { contains: filters.q } },
            { serial_number: { contains: filters.q } },
            { name: { contains: filters.q } },
        ];
    }
    if (filters.status) where.status = filters.status as Prisma.assetsWhereInput['status'];
    if (filters.centerId !== undefined) where.center_id = filters.centerId;
    return prisma.assets.findMany({ where, include: ASSET_DETAIL_INCLUDE, orderBy: { asset_id: 'asc' } });
}

/**
 * The rows the list adds to its assets, read together for all of them: the worked-out state (two queries), every
 * inspection with its inspector's name, and the completed retirements with their requester's name.
 * The number of queries does not grow with the number of assets.
 *
 * @param assets the listed assets
 * @returns [states by asset id, inspections newest first, completed retirements newest first]
 */
export function findListExtras(assets: AssetWithDetail[]) {
    const ids = assets.map(a => a.asset_id);
    return Promise.all([
        assetState.statesFor(prisma, assets),
        prisma.asset_inspections.findMany({
            where: { asset_id: { in: ids } },
            orderBy: [{ inspected_at: 'desc' }, { inspection_id: 'desc' }],
            include: { users: { select: { user_id: true, first_name: true, last_name: true } } },
        }),
        prisma.asset_retirements.findMany({
            where: { asset_id: { in: ids }, status: 'COMPLETED' },
            orderBy: [{ requested_at: 'desc' }, { retirement_id: 'desc' }],
            include: { users: { select: { user_id: true, first_name: true, last_name: true } } },
        }),
    ]);
}

/** The asset with this tag and its home lab, project, and funding source, or null. */
export function findDetailByTag(assetTag: string) {
    return prisma.assets.findUnique({ where: { asset_tag: assetTag }, include: ASSET_DETAIL_INCLUDE });
}

/** The asset with this id and its home lab, project, and funding source, or null. */
export function findDetailById(assetId: number) {
    return prisma.assets.findUnique({ where: { asset_id: assetId }, include: ASSET_DETAIL_INCLUDE });
}

/** Everything worked out for one asset (holder, location, condition, overdue, open loan). */
export function findState(asset: AssetWithDetail) {
    return assetState.stateOf(prisma, asset);
}

/** The asset's open loan, or null. Read by the loan and retirement rules before a request. */
export function findOpenLoan(assetId: number) {
    return assetState.openLoanOf(prisma, assetId);
}

/** The person's name fields, for the history. */
const PERSON = { select: { user_id: true, first_name: true, last_name: true } } as const;

/**
 * Every row an asset's history is built from, read together: its loans, inspections, maintenance tickets,
 * retirements, and activity log rows, each with the people named on it.
 *
 * @param assetId the asset
 * @returns [loans, inspections, maintenance tickets, retirements, activity rows]
 */
export function findHistoryRows(assetId: number) {
    const where = { asset_id: assetId };
    return Promise.all([
        prisma.asset_loans.findMany({
            where,
            include: { users: PERSON, decided_by: PERSON, released_by: PERSON, received_by: PERSON },
        }),
        prisma.asset_inspections.findMany({ where, include: { users: PERSON } }),
        prisma.asset_maintenance.findMany({
            where,
            include: { users: PERSON, received_by: PERSON, completed_by: PERSON },
        }),
        prisma.asset_retirements.findMany({
            where,
            include: { users: PERSON, decided_by: PERSON, completed_by: PERSON },
        }),
        prisma.activity_log.findMany({ where, include: { actor: PERSON } }),
    ]);
}

/** The funding source with this name, or null. The database compares it without letter case. */
export function findFundingSourceByName(name: string) {
    return prisma.funding_sources.findFirst({ where: { name } });
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

/** The status of the asset's newest record, or null if it has none. Read by the custody request guard, for transfers only. (H-05) */
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
/** The asset's newest record, or null if it has none. Read by the transfer request, which commit 9 removes. */
// TODO(M-09): no tie-break on asset_record_id, unlike the custody request guard and GET /api/assets, so two records logged in the same second can disagree with them. Phase 3, with the shared asset state rule.
export function findLatestRecord(assetId: number) {
    return prisma.asset_records.findFirst({
        where: { asset_id: assetId },
        orderBy: { date_logged: "desc" },
    });
}

/** The research center with this id, or null. */
export function findLabById(centerId: number) {
    return prisma.research_centers.findUnique({ where: { center_id: centerId } });
}

/** The research center with this short code, or null. The database compares it without letter case. */
export function findLabByCode(shortCode: string) {
    return prisma.research_centers.findFirst({ where: { short_code: shortCode } });
}

/**
 * Registers an asset under the next tag of its lab, in one transaction: the lab's row is locked first, then the lab's
 * tags are read and the new tag is built from them, then the assets row is written. Two registrations in the same lab
 * at once therefore number one after the other and never get the same tag. (H-11, issue #75) Its status starts as the
 * column's default, AVAILABLE.
 *
 * @param centerId the home lab, whose row is locked
 * @param labPrefix the tag prefix, the lab's short code
 * @param nextTag builds the new tag from the tags the lab already has
 * @param assetData the assets row without its tag
 * @returns the created assets row
 */
export function createWithNextTag(
    centerId: number,
    labPrefix: string,
    nextTag: (existingTags: string[]) => string,
    assetData: Omit<Prisma.assetsUncheckedCreateInput, 'asset_tag'>,
) {
    return prisma.$transaction(async (tx) => {
        await lockCenter(tx, centerId);
        const existing = await tx.assets.findMany({
            where: { asset_tag: { startsWith: `${labPrefix}-` } },
            select: { asset_tag: true },
        });
        return tx.assets.create({ data: { ...assetData, asset_tag: nextTag(existing.map(a => a.asset_tag)) } });
    });
}

/** What an edit adds once the newest record is known: a new record if any, and an inspection report if any. */
export interface EditRows {
    record: Omit<Prisma.asset_recordsUncheckedCreateInput, 'asset_id'> | null;
    report: Prisma.asset_inspectionsUncheckedCreateInput | null;
}

/**
 * Saves an asset edit in one transaction: the assets fields, and the rows the service asks for (a new record, an
 * inspection report). An existing record is never changed (issue #74). On the slow CCS Cloud link this one
 * interactive transaction can outlast Prisma's transaction timeout, and the edit then fails with P2028, "expired
 * transaction" (issue #8). The newest record is read inside the transaction, after the assets write, and handed to
 * the service, which decides what to add.
 *
 * @param existing the asset being edited
 * @param assetUpdateData only the assets fields the request sent; nothing is written when empty
 * @param buildRows builds the new record and the report from the newest record
 * @returns the assets row, updated or as it was
 */
// TODO(H-07): the record half of an edit (status, custodian, location) is kept for Edit Asset until Batch 1 commit 9 makes it master data only. No list or rule reads those records.
export function saveEdit(
    existing: assets,
    assetUpdateData: Prisma.assetsUncheckedUpdateInput,
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

        // Same ordering as the old asset list (ties on date_logged go to the higher asset_record_id). (M-09)
        const latestRecord = await tx.asset_records.findFirst({
            where: { asset_id: existing.asset_id },
            orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }],
        });

        const { record, report } = buildRows(latestRecord);

        if (record) {
            await tx.asset_records.create({ data: { asset_id: existing.asset_id, ...record } });
        }
        if (report) {
            await tx.asset_inspections.create({ data: report });
        }

        return asset;
    });
}

/** How many inspection or condition reports the asset has. A delete is refused when there is any. (issue #69) */
export function countReports(assetId: number) {
    return prisma.asset_inspections.count({ where: { asset_id: assetId } });
}

/**
 * Deletes an asset and the rows of seven tables that point at it, in one transaction.
 * asset_inspections is not among them: an asset with reports is refused before this is called. (H-03, issue #69)
 */
export function deleteWithHistory(assetId: number) {
    // The schema has no ON DELETE CASCADE, so the child rows go first, or the delete fails on a foreign key.
    return prisma.$transaction(async (tx) => {
        const id = assetId;
        await tx.asset_records.deleteMany({ where: { asset_id: id } });
        await tx.asset_monetary.deleteMany({ where: { asset_id: id } });
        await tx.asset_loans.deleteMany({ where: { asset_id: id } });
        await tx.asset_maintenance.deleteMany({ where: { asset_id: id } });
        await tx.asset_transfers.deleteMany({ where: { asset_id: id } });
        await tx.asset_returns.deleteMany({ where: { asset_id: id } });
        await tx.asset_retirements.deleteMany({ where: { asset_id: id } });
        await tx.assets.delete({ where: { asset_id: id } });
    });
}
