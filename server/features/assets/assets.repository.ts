/**
 * Asset row access: every database read and write the asset registry endpoints make, plus the asset reads other
 * features need (an asset by tag or by id, its lab, and its state).
 * Layer: repository. Called by assets.service.ts, the services of features/loans, retirements, maintenance,
 * and inspections, and shared/services/permissions.ts. Calls config/prisma.ts, shared/services/assetState.ts (with the
 * shared client), shared/services/rowLocks.ts, and shared/services/activityLog.ts.
 * Used by: every role's inventory view, Staff registration, editing, and deletion, and every workflow that starts from an asset tag.
 */
import type { Prisma } from '@prisma/client';
import type { AssetListFilters } from '@shared/types/assets';
import { prisma } from '../../config/prisma';
import * as assetState from '../../shared/services/assetState';
import { lockAsset, lockCenter } from '../../shared/services/rowLocks';
import { logActivity } from '../../shared/services/activityLog';

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
    if (filters.assetId !== undefined) where.asset_id = filters.assetId;
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

/** The research center with this id, or null. */
export function findLabById(centerId: number) {
    return prisma.research_centers.findUnique({ where: { center_id: centerId } });
}

/** The research center with this short code, or null. The database compares it without letter case. */
export function findLabByCode(shortCode: string) {
    return prisma.research_centers.findFirst({ where: { short_code: shortCode } });
}

/**
 * The lab, project, and funding source a body names, read together; each is null when not named or not found.
 *
 * @returns [research center, project, funding source]
 */
export function findReferences(centerId: number | null, projectId: number | null, fundingSourceId: number | null) {
    return Promise.all([
        centerId ? prisma.research_centers.findUnique({ where: { center_id: centerId } }) : null,
        projectId ? prisma.projects.findUnique({ where: { project_id: projectId } }) : null,
        fundingSourceId ? prisma.funding_sources.findUnique({ where: { funding_source_id: fundingSourceId } }) : null,
    ]);
}

/**
 * Registers an asset in one transaction: the lab's row is locked first, then the lab's tags are read and the new tag
 * is built from them, so two registrations in the same lab at once number one after the other and never get the same
 * tag (H-11, issue #75). Then the assets row (Available, the column's default), its Initial inspection, and an
 * ASSET_REGISTERED row with the tag.
 *
 * @param centerId the home lab, whose row is locked
 * @param nextTag builds the new tag from the tags the lab already has
 * @param assetData the assets row without its tag
 * @param inspection the Initial inspection without its asset
 * @param actorId the session user who registers it
 * @returns the new asset's id
 */
export function register(
    centerId: number,
    nextTag: (existingTags: string[]) => string,
    assetData: Omit<Prisma.assetsUncheckedCreateInput, 'asset_tag'>,
    inspection: Omit<Prisma.asset_inspectionsUncheckedCreateInput, 'asset_id'>,
    actorId: number,
) {
    return prisma.$transaction(async (tx) => {
        await lockCenter(tx, centerId);
        const lab = await tx.research_centers.findUniqueOrThrow({ where: { center_id: centerId } });
        const existing = await tx.assets.findMany({
            where: { asset_tag: { startsWith: `${lab.short_code}-` } },
            select: { asset_tag: true },
        });
        const asset = await tx.assets.create({ data: { ...assetData, center_id: centerId, asset_tag: nextTag(existing.map(a => a.asset_tag)) } });
        await tx.asset_inspections.create({ data: { ...inspection, asset_id: asset.asset_id } });
        await logActivity(tx, { eventType: "ASSET_REGISTERED", actorId, assetId: asset.asset_id, details: asset.asset_tag });
        return asset.asset_id;
    });
}

/**
 * Saves a master data edit in one transaction, the asset row locked first: the changed columns and an ASSET_EDITED row.
 *
 * @param assetId the asset
 * @param changes only the columns whose value changes (never status)
 * @param actorId the session user who edits
 * @param details the changed field names, for the log row
 */
export function saveEdit(assetId: number, changes: Prisma.assetsUncheckedUpdateInput, actorId: number, details: string) {
    return prisma.$transaction(async (tx) => {
        await lockAsset(tx, assetId);
        await tx.assets.update({ where: { asset_id: assetId }, data: changes });
        await logActivity(tx, { eventType: "ASSET_EDITED", actorId, assetId, details });
    });
}

/** How much history an asset has: a delete is refused when there is any. (issue #69) */
export async function countHistory(assetId: number) {
    const where = { asset_id: assetId };
    const [loans, maintenance, retirements, laterInspections] = await Promise.all([
        prisma.asset_loans.count({ where }),
        prisma.asset_maintenance.count({ where }),
        prisma.asset_retirements.count({ where }),
        prisma.asset_inspections.count({ where: { asset_id: assetId, type: { not: 'INITIAL' } } }),
    ]);
    return { loans, maintenance, retirements, laterInspections };
}

/**
 * Deletes a fresh registration in one transaction, the asset row locked first: its Initial inspection and the asset;
 * its activity log rows are kept without the asset, and an
 * ASSET_DELETED row names the tag. The caller has checked it has no other history.
 *
 * @param assetId the asset
 * @param assetTag its tag, kept in the log row
 * @param actorId the session user who deletes it
 */
export function deleteRegistration(assetId: number, assetTag: string, actorId: number) {
    // The schema has no ON DELETE CASCADE, so the child rows go first, or the delete fails on a foreign key.
    return prisma.$transaction(async (tx) => {
        await lockAsset(tx, assetId);
        const where = { asset_id: assetId };
        await tx.activity_log.updateMany({ where, data: { asset_id: null } });
        await tx.asset_inspection_metrics.deleteMany({ where: { asset_inspections: { asset_id: assetId } } });
        await tx.asset_inspections.deleteMany({ where });
        await tx.assets.delete({ where });
        await logActivity(tx, { eventType: "ASSET_DELETED", actorId, details: assetTag });
    });
}
