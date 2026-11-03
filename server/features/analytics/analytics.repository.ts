/**
 * Analytics reads: every database query the eight live analytics routes make. Nothing here writes.
 * Layer: repository. Called by analytics.service.ts. Calls config/prisma.ts (the only analytics file that does).
 * Used by: the Director, Lab Head, and Staff analytics views.
 * Analytics is a read model across every table, so these queries read the other features' tables directly, as 01D
 * section 2 plans for features/analytics/. Most of them load whole tables and count in the service. (M-01)
 * An asset's status is assets.status, its lab and campus come from its home lab (assets.center_id), and its condition
 * from shared/services/assetState.ts.
 */
import { asset_loans_status, asset_retirements_status, type Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import * as assetState from '../../shared/services/assetState';

/** Every asset read here comes with its home lab. */
const WITH_LAB = { research_centers: true } satisfies Prisma.assetsInclude;

// ---------------------------------------------------------------------------
// Lab Head widgets kept on 2026-10-07 (idle time, idle frequency, loan recommender)
// ---------------------------------------------------------------------------

/** Every asset with its home lab and its newest returned loan. Read by the idle-time and idle-frequency charts. */
export function findAssetsWithLastReturn() {
    return prisma.assets.findMany({
        include: {
            ...WITH_LAB,
            asset_loans: {
                where: { status: asset_loans_status.RETURNED, closed_at: { not: null } },
                orderBy: { closed_at: 'desc' },
                take: 1,
            },
        },
    });
}

/**
 * Every Available asset, optionally of one category, with its home lab, its project's research center, and its newest
 * returned loan.
 *
 * @param targetCategory an assets_category value, or undefined for every category
 */
export function findAvailableAssetsForRecommender(targetCategory: string | undefined) {
    return prisma.assets.findMany({
        where: { status: 'AVAILABLE', ...(targetCategory ? { category: targetCategory as Prisma.assetsWhereInput['category'] } : {}) },
        include: {
            ...WITH_LAB,
            projects: { include: { research_centers: true } },
            asset_loans: {
                where: { status: asset_loans_status.RETURNED, closed_at: { not: null } },
                orderBy: { closed_at: 'desc' },
                take: 1,
            },
        },
        orderBy: { asset_id: 'asc' },
    });
}

// ---------------------------------------------------------------------------
// Staff: location status and inspection progress
// ---------------------------------------------------------------------------

/** Every asset with its home lab. */
export function findAssetsWithLab() {
    return prisma.assets.findMany({ include: WITH_LAB, orderBy: { asset_id: 'asc' } });
}

/** Every research center with its assets' statuses. */
export function findCentersWithAssetStatuses() {
    return prisma.research_centers.findMany({
        include: { assets: { select: { status: true } } },
        orderBy: { center_id: 'asc' },
    });
}

// ---------------------------------------------------------------------------
// Director dashboard
// ---------------------------------------------------------------------------

/** The sum of every asset's acquisition value, retired assets included. */
export function sumAcquisitionValue() {
    return prisma.assets.aggregate({
        _sum: { acquisition_value: true }
    });
}

/** How many disposals are pending, in any of three spellings. */
export function countPendingDisposals() {
    // The status column is free text, and older rows were written in other letter cases. (H-07)
    return prisma.asset_retirements.count({
        where: { status: asset_retirements_status.PENDING }
    });
}

/** Acquisition value and asset count per funding source, with the funding sources' names. */
export function groupValueByFundingSource() {
    return Promise.all([
        prisma.assets.groupBy({
            by: ['funding_source_id'],
            _sum: { acquisition_value: true },
            _count: { asset_id: true },
        }),
        prisma.funding_sources.findMany(),
    ]);
}

/**
 * The assets the Director's location counts are built from, with their home lab.
 *
 * @param labCode the home lab's short code, or null for every lab
 */
export function findAssetsForDirector(labCode: string | null) {
    return prisma.assets.findMany({
        where: labCode ? { research_centers: { short_code: labCode } } : undefined,
        include: WITH_LAB,
    });
}

/** Inspection reports, oldest first, optionally limited to a date range. */
export function findReportsForDirector(startDate: Date | null, endDate: Date | null) {
    const reportsWhere: any = {};
    if (startDate || endDate) {
        reportsWhere.inspected_at = {};
        if (startDate && !isNaN(startDate.getTime())) reportsWhere.inspected_at.gte = startDate;
        if (endDate && !isNaN(endDate.getTime())) reportsWhere.inspected_at.lte = endDate;
    }

    return prisma.asset_inspections.findMany({
        where: Object.keys(reportsWhere).length > 0 ? reportsWhere : undefined,
        orderBy: { inspected_at: 'asc' }
    });
}

// ---------------------------------------------------------------------------
// Lab Head dashboard
// ---------------------------------------------------------------------------
// A lab's assets are the ones whose home lab (assets.center_id) has this short code.

/**
 * Loans of the lab's assets, newest first, each with its asset and borrower.
 *
 * @param prefixFilter the lab prefix, or "" for every loan (the EQ- pool included)
 * @param startDate earliest loaned_on, or null
 * @param endDate latest loaned_on, or null
 */
export function findLoansForLabHead(prefixFilter: string, startDate: Date | null, endDate: Date | null) {
    const loanWhere: any = {};
    if (startDate || endDate) {
        loanWhere.requested_at = {};
        if (startDate && !isNaN(startDate.getTime())) loanWhere.requested_at.gte = startDate;
        if (endDate && !isNaN(endDate.getTime())) loanWhere.requested_at.lte = endDate;
    }
    if (prefixFilter) {
        loanWhere.assets = { research_centers: { short_code: prefixFilter } };
    }

    return prisma.asset_loans.findMany({
        where: Object.keys(loanWhere).length > 0 ? loanWhere : undefined,
        include: { assets: true, users: true },
        orderBy: { requested_at: 'desc' }
    });
}

/**
 * Transfers of the lab's assets, newest first, each with its asset.
 *
 * @param prefixFilter the lab prefix, or "" for every transfer (the EQ- pool included)
 * @param startDate earliest requested_on, or null
 * @param endDate latest requested_on, or null
 */
export function findTransfersForLabHead(prefixFilter: string, startDate: Date | null, endDate: Date | null) {
    const transferWhere: any = {};
    if (startDate || endDate) {
        transferWhere.requested_on = {};
        if (startDate && !isNaN(startDate.getTime())) transferWhere.requested_on.gte = startDate;
        if (endDate && !isNaN(endDate.getTime())) transferWhere.requested_on.lte = endDate;
    }
    if (prefixFilter) {
        transferWhere.assets = { research_centers: { short_code: prefixFilter } };
    }

    return prisma.asset_transfers.findMany({
        where: Object.keys(transferWhere).length > 0 ? transferWhere : undefined,
        include: { assets: true },
        orderBy: { requested_on: 'desc' }
    });
}

/** The lab's assets: those whose home lab has this short code, or, with no lab, every asset outside the EQ- central pool. */
function labAssetWhere(prefixFilter: string) {
    const assetWhere: any = {};
    if (prefixFilter) {
        assetWhere.research_centers = { short_code: prefixFilter };
    } else {
        assetWhere.NOT = { asset_tag: { startsWith: 'EQ-' } };
    }
    return assetWhere;
}

/** The lab's assets. The date range does not apply. */
export function findLabAssets(prefixFilter: string) {
    return prisma.assets.findMany({ where: labAssetWhere(prefixFilter) });
}

/** The lab's asset count per category, largest first. */
export function countLabAssetsByCategory(prefixFilter: string) {
    return prisma.assets.groupBy({
        by: ['category'],
        where: labAssetWhere(prefixFilter),
        _count: { asset_id: true },
        orderBy: { _count: { asset_id: 'desc' } }
    });
}

/** Every project with its research center. */
export function findProjectsWithCenter() {
    return prisma.projects.findMany({
        include: { research_centers: true }
    });
}

/** Every loan of the lab's assets (any status, no date range), oldest due date first, with the asset and the borrower. */
export function findLoansForDelinquency(prefixFilter: string) {
    const delinquencyWhere: any = { assets: labAssetWhere(prefixFilter) };

    return prisma.asset_loans.findMany({
        where: delinquencyWhere,
        include: { assets: true, users: true },
        orderBy: { return_by: 'asc' }
    });
}

// ---------------------------------------------------------------------------
// Staff (TSG) dashboard
// ---------------------------------------------------------------------------

/** Every repair ticket, newest first, with its asset and reporter. */
export function findRepairsWithAssetAndReporter() {
    return prisma.asset_maintenance.findMany({
        include: { assets: true, users: true },
        orderBy: { reported_at: 'desc' }
    });
}

/** The condition now of every asset: its newest TSG inspection. */
export function findCurrentConditions() {
    return assetState.conditionsFor(prisma, null);
}

/** Every asset with its home lab. */
export function findAllAssets() {
    return prisma.assets.findMany({ include: WITH_LAB, orderBy: { asset_id: 'asc' } });
}

/** Every asset with a warranty expiry, soonest first. */
export function findAssetsWithWarranty() {
    return prisma.assets.findMany({
        where: { warranty_expiry: { not: null } },
        orderBy: { warranty_expiry: 'asc' }
    });
}
