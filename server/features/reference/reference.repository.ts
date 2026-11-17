/**
 * Reference data access: the asset categories, the labs (research_centers), and the funding sources, with how many
 * assets and projects use each, and their adds and changes with the activity log row of each.
 * Layer: repository. Called by reference.service.ts. Calls config/prisma.ts and shared/services/activityLog.ts.
 * Used by: every answer that shows a category's label or an asset's present value, Register and Edit Asset, the
 * form option lists, and the Reference Data page.
 */
import { Prisma, type research_centers_location } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logActivity } from '../../shared/services/activityLog';
import { lockCenter } from '../../shared/services/rowLocks';

/**
 * Every asset category, inactive ones too.
 *
 * @returns the asset_categories rows, by label
 */
export function listCategories() {
    return prisma.asset_categories.findMany({ orderBy: { label: 'asc' } });
}

/** Whether an error is MySQL refusing a duplicate in a unique column (Prisma P2002). */
function isDuplicate(e: unknown): boolean {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

const WITH_ASSET_COUNT = { _count: { select: { assets: true } } } satisfies Prisma.asset_categoriesInclude;

/** Every asset category with its asset count, by label. */
export function listCategoriesWithCounts() {
    return prisma.asset_categories.findMany({ include: WITH_ASSET_COUNT, orderBy: { label: 'asc' } });
}

/** One category with its asset count, or null. MySQL compares the code in any letter case. */
export function findCategoryWithCount(code: string) {
    return prisma.asset_categories.findUnique({ where: { code }, include: WITH_ASSET_COUNT });
}

/**
 * Adds a category and its REFERENCE_DATA_CHANGED row, in one transaction.
 *
 * @param row the new row
 * @param actorId the session user
 * @param details the log row's sentence
 * @returns false, with nothing written, when the code or the label is already taken (two adds at once)
 */
export async function createCategory(row: Prisma.asset_categoriesCreateInput, actorId: number, details: string): Promise<boolean> {
    try {
        await prisma.$transaction(async (tx) => {
            await tx.asset_categories.create({ data: row });
            await logActivity(tx, { eventType: 'REFERENCE_DATA_CHANGED', actorId, details });
        });
        return true;
    } catch (e) {
        if (isDuplicate(e)) return false;
        throw e;
    }
}

/**
 * Changes a category and writes its REFERENCE_DATA_CHANGED row, in one transaction.
 *
 * @param code the category's code
 * @param data the columns to change
 * @param actorId the session user
 * @param details the log row's sentence
 * @returns false, with nothing written, when the new label is already taken (two changes at once)
 */
export async function updateCategory(code: string, data: Prisma.asset_categoriesUpdateInput, actorId: number, details: string): Promise<boolean> {
    try {
        await prisma.$transaction(async (tx) => {
            await tx.asset_categories.update({ where: { code }, data });
            await logActivity(tx, { eventType: 'REFERENCE_DATA_CHANGED', actorId, details });
        });
        return true;
    } catch (e) {
        if (isDuplicate(e)) return false;
        throw e;
    }
}

const LAB_WITH_COUNT = {
    _count: {
        select: {
            assets: true,
            user_centers: true,
            projects: true,
            loan_destinations: true,
        },
    },
} satisfies Prisma.research_centersInclude;

/** Every lab with its counts, by short code. */
export function listLabsWithCounts() {
    return prisma.research_centers.findMany({ include: LAB_WITH_COUNT, orderBy: { short_code: 'asc' } });
}

/** One lab with its counts, or null. */
export function findLabWithCount(centerId: number) {
    return prisma.research_centers.findUnique({ where: { center_id: centerId }, include: LAB_WITH_COUNT });
}

/** The lab with this short code, or null. MySQL compares it in any letter case. */
export function findLabByShortCode(shortCode: string) {
    return prisma.research_centers.findUnique({ where: { short_code: shortCode }, select: { center_id: true } });
}

/**
 * Adds a lab and its REFERENCE_DATA_CHANGED row, in one transaction.
 *
 * @returns the new lab's id, or null, with nothing written, when the short code is already taken (two adds at once)
 */
export async function createLab(row: { name: string; short_code: string; location: research_centers_location }, actorId: number, details: string): Promise<number | null> {
    try {
        return await prisma.$transaction(async (tx) => {
            const lab = await tx.research_centers.create({ data: row, select: { center_id: true } });
            await logActivity(tx, { eventType: 'REFERENCE_DATA_CHANGED', actorId, details });
            return lab.center_id;
        });
    } catch (e) {
        if (isDuplicate(e)) return null;
        throw e;
    }
}

/** Changes a lab's name or campus and writes its REFERENCE_DATA_CHANGED row, in one transaction. */
export async function updateLab(centerId: number, data: { name?: string; location?: research_centers_location }, actorId: number, details: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await tx.research_centers.update({ where: { center_id: centerId }, data });
        await logActivity(tx, { eventType: 'REFERENCE_DATA_CHANGED', actorId, details });
    });
}

/** Non-zero usage counts that block deleting a lab. */
export interface LabUsageCounts {
    assetCount: number;
    memberCount: number;
    hasHead: boolean;
    projectCount: number;
    loanCount: number;
}

export type DeleteLabResult = { deleted: true } | { deleted: false; usages: LabUsageCounts };

/**
 * Deletes an unused lab and writes its REFERENCE_DATA_CHANGED row, in one transaction.
 * Locks the lab first. If any asset, user, project, loan, or Lab Head uses it, refuses and writes nothing.
 *
 * @param centerId the research center to delete
 * @param actorId the session user
 * @returns null if the lab does not exist, or DeleteLabResult
 */
export async function deleteLab(centerId: number, actorId: number): Promise<DeleteLabResult | null> {
    return prisma.$transaction(async (tx): Promise<DeleteLabResult | null> => {
        await lockCenter(tx, centerId);
        const lab = await tx.research_centers.findUnique({ where: { center_id: centerId } });
        if (!lab) return null;

        const [assetCount, memberCount, projectCount, loanCount] = await Promise.all([
            tx.assets.count({ where: { center_id: centerId } }),
            tx.user_centers.count({ where: { center_id: centerId } }),
            tx.projects.count({ where: { center_id: centerId } }),
            tx.asset_loans.count({ where: { destination_center_id: centerId } }),
        ]);
        const hasHead = lab.head_user_id !== null;

        if (assetCount > 0 || memberCount > 0 || hasHead || projectCount > 0 || loanCount > 0) {
            return {
                deleted: false,
                usages: { assetCount, memberCount, hasHead, projectCount, loanCount },
            };
        }

        await tx.research_centers.delete({ where: { center_id: centerId } });
        await logActivity(tx, {
            eventType: 'REFERENCE_DATA_CHANGED',
            actorId,
            details: `Lab deleted: ${lab.short_code} (${lab.name})`,
        });
        return { deleted: true };
    });
}

const FUNDING_WITH_COUNTS = { _count: { select: { assets: true, projects: true } } } satisfies Prisma.funding_sourcesInclude;

/** Every funding source with its asset and project counts, by name. */
export function listFundingSourcesWithCounts() {
    return prisma.funding_sources.findMany({ include: FUNDING_WITH_COUNTS, orderBy: { name: 'asc' } });
}

/** One funding source with its counts, or null. */
export function findFundingSourceWithCounts(fundingSourceId: number) {
    return prisma.funding_sources.findUnique({ where: { funding_source_id: fundingSourceId }, include: FUNDING_WITH_COUNTS });
}

/** The funding source with this name, or null. MySQL compares it in any letter case. */
export function findFundingSourceByName(name: string) {
    return prisma.funding_sources.findUnique({ where: { name }, select: { funding_source_id: true } });
}

/**
 * Adds a funding source and its REFERENCE_DATA_CHANGED row, in one transaction.
 *
 * @returns the new funding source's id, or null, with nothing written, when the name is already taken (two adds at once)
 */
export async function createFundingSource(name: string, actorId: number, details: string): Promise<number | null> {
    try {
        return await prisma.$transaction(async (tx) => {
            const source = await tx.funding_sources.create({ data: { name }, select: { funding_source_id: true } });
            await logActivity(tx, { eventType: 'REFERENCE_DATA_CHANGED', actorId, details });
            return source.funding_source_id;
        });
    } catch (e) {
        if (isDuplicate(e)) return null;
        throw e;
    }
}

/**
 * Renames a funding source and writes its REFERENCE_DATA_CHANGED row, in one transaction.
 *
 * @returns false, with nothing written, when the name is already taken (two changes at once)
 */
export async function renameFundingSource(fundingSourceId: number, name: string, actorId: number, details: string): Promise<boolean> {
    try {
        await prisma.$transaction(async (tx) => {
            await tx.funding_sources.update({ where: { funding_source_id: fundingSourceId }, data: { name } });
            await logActivity(tx, { eventType: 'REFERENCE_DATA_CHANGED', actorId, details });
        });
        return true;
    } catch (e) {
        if (isDuplicate(e)) return false;
        throw e;
    }
}
