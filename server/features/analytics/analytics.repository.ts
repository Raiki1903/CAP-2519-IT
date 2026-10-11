/**
 * Analytics reads: every database query the eight live analytics routes make. Nothing here writes.
 * Layer: repository. Called by analytics.service.ts. Calls config/prisma.ts (the only analytics file that does).
 * Used by: the Director, Lab Head, and Staff analytics views.
 * Analytics is a read model across every table, so these queries read the other features' tables directly, as 01D
 * section 2 plans for features/analytics/. Most of them load whole tables and count in the service. (M-01)
 */
import { prisma } from '../../config/prisma';

// ---------------------------------------------------------------------------
// Lab Head widgets kept on 2026-10-07 (idle time, idle frequency, loan recommender)
// ---------------------------------------------------------------------------

/** Every asset with its newest record and its newest return. Read by the idle-time and idle-frequency charts. */
// TODO(M-09): the newest record is picked by date_logged alone, so of two records logged in the same second either can come back. Phase 3, with the shared asset state rule.
export function findAssetsWithLatestRecordAndReturn() {
    return prisma.assets.findMany({
        include: {
            asset_records: {
                orderBy: { date_logged: 'desc' },
                take: 1
            },
            asset_returns: {
                orderBy: { returned_on: 'desc' },
                take: 1
            }
        }
    });
}

/**
 * Every ACTIVE record, history included, optionally of one category, with its asset's newest return
 * and its project's research center.
 *
 * @param targetCategory an assets_category value, or undefined for every category
 */
export function findActiveRecordsForRecommender(targetCategory: string | undefined) {
    return prisma.asset_records.findMany({
        where: {
            status: "ACTIVE",
            assets: targetCategory ? { category: targetCategory as any } : undefined
        },
        include: {
            assets: {
                include: {
                    asset_returns: {
                        orderBy: { returned_on: "desc" },
                        take: 1
                    }
                }
            },
            projects: {
                include: {
                    research_centers: true
                }
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Staff: location status and inspection progress
// ---------------------------------------------------------------------------

/** Every asset with its newest record. */
// TODO(M-09): newest record by date_logged alone, as above. Phase 3.
export function findAssetsWithLatestRecord() {
    return prisma.assets.findMany({
        include: {
            asset_records: {
                orderBy: { date_logged: 'desc' },
                take: 1
            }
        }
    });
}

/** Every research center with its projects and every record of each project, history included. */
export function findCentersWithProjectRecords() {
    return prisma.research_centers.findMany({
        include: {
            projects: {
                include: {
                    asset_records: true
                }
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Director dashboard
// ---------------------------------------------------------------------------

/** The sum of every asset's acquisition value, disposed assets included. */
export function sumAcquisitionValue() {
    return prisma.asset_monetary.aggregate({
        _sum: { acquisition_value: true }
    });
}

/** How many disposals are pending, in any of three spellings. */
export function countPendingDisposals() {
    // The status column is free text, and older rows were written in other letter cases. (H-07)
    return prisma.asset_disposals.count({
        where: { status: { in: ['pending', 'Pending', 'PENDING'] } }
    });
}

/** Acquisition value and asset count per funding source. */
export function groupValueByFundingSource() {
    return prisma.asset_monetary.groupBy({
        by: ['funding_source'],
        _sum: { acquisition_value: true },
        _count: { asset_id: true }
    });
}

/**
 * Asset records, newest first, optionally limited to a location and a date range.
 * A date that does not parse is left out of the range. With a range, an asset counts by its newest record inside it.
 *
 * @param locationContains text the location must contain, or null for every location
 * @param startDate earliest date_logged, or null
 * @param endDate latest date_logged, or null
 */
export function findRecordsForDirector(locationContains: string | null, startDate: Date | null, endDate: Date | null) {
    const recordsWhere: any = {};
    if (locationContains) {
        recordsWhere.location = { contains: locationContains };
    }
    if (startDate || endDate) {
        recordsWhere.date_logged = {};
        if (startDate && !isNaN(startDate.getTime())) recordsWhere.date_logged.gte = startDate;
        if (endDate && !isNaN(endDate.getTime())) recordsWhere.date_logged.lte = endDate;
    }

    return prisma.asset_records.findMany({
        where: Object.keys(recordsWhere).length > 0 ? recordsWhere : undefined,
        orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }]
    });
}

/** Inspection reports, oldest first, optionally limited to a date range. */
export function findReportsForDirector(startDate: Date | null, endDate: Date | null) {
    const reportsWhere: any = {};
    if (startDate || endDate) {
        reportsWhere.report_date = {};
        if (startDate && !isNaN(startDate.getTime())) reportsWhere.report_date.gte = startDate;
        if (endDate && !isNaN(endDate.getTime())) reportsWhere.report_date.lte = endDate;
    }

    return prisma.asset_reports.findMany({
        where: Object.keys(reportsWhere).length > 0 ? reportsWhere : undefined,
        orderBy: { report_date: 'asc' }
    });
}

// ---------------------------------------------------------------------------
// Lab Head dashboard
// ---------------------------------------------------------------------------
// A lab's assets are the ones whose tag starts with "<prefix>-": the tag prefix is how the server scopes labs today. (M-03)

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
        loanWhere.loaned_on = {};
        if (startDate && !isNaN(startDate.getTime())) loanWhere.loaned_on.gte = startDate;
        if (endDate && !isNaN(endDate.getTime())) loanWhere.loaned_on.lte = endDate;
    }
    if (prefixFilter) {
        loanWhere.assets = {
            asset_tag: { startsWith: `${prefixFilter}-` }
        };
    }

    return prisma.asset_loans.findMany({
        where: Object.keys(loanWhere).length > 0 ? loanWhere : undefined,
        include: { assets: true, users: true },
        orderBy: { loaned_on: 'desc' }
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
        transferWhere.assets = {
            asset_tag: { startsWith: `${prefixFilter}-` }
        };
    }

    return prisma.asset_transfers.findMany({
        where: Object.keys(transferWhere).length > 0 ? transferWhere : undefined,
        include: { assets: true },
        orderBy: { requested_on: 'desc' }
    });
}

/** The lab's assets: tags starting with "<prefixFilter>-", or, with no prefix, every asset outside the EQ- central pool. */
function labAssetWhere(prefixFilter: string) {
    const assetWhere: any = {};
    if (prefixFilter) {
        assetWhere.asset_tag = { startsWith: `${prefixFilter}-` };
    } else {
        assetWhere.NOT = { asset_tag: { startsWith: 'EQ-' } };
    }
    return assetWhere;
}

/** The lab's assets, each with its newest record. The date range does not apply. */
export function findLabAssetsWithLatestRecord(prefixFilter: string) {
    return prisma.assets.findMany({
        where: labAssetWhere(prefixFilter),
        include: {
            asset_records: {
                orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }],
                take: 1
            }
        }
    });
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

/** Every loan of the lab's assets (any status, no date range), oldest due date first, with the asset's newest record and the borrower. */
export function findLoansForDelinquency(prefixFilter: string) {
    const delinquencyWhere: any = {};
    if (prefixFilter) {
        delinquencyWhere.assets = { asset_tag: { startsWith: `${prefixFilter}-` } };
    } else {
        delinquencyWhere.assets = { NOT: { asset_tag: { startsWith: 'EQ-' } } };
    }

    return prisma.asset_loans.findMany({
        where: delinquencyWhere,
        include: {
            assets: {
                include: {
                    asset_records: {
                        orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }],
                        take: 1
                    }
                }
            },
            users: true
        },
        orderBy: { due_date: 'asc' }
    });
}

// ---------------------------------------------------------------------------
// Staff (TSG) dashboard
// ---------------------------------------------------------------------------

/** Every repair ticket, newest first, with its asset and reporter. */
export function findRepairsWithAssetAndReporter() {
    return prisma.asset_repairs.findMany({
        include: { assets: true, users: true },
        orderBy: { created_at: 'desc' }
    });
}

/** Every asset record, newest first, ties broken by the higher asset_record_id. */
export function findAllRecordsNewestFirst() {
    return prisma.asset_records.findMany({
        orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }]
    });
}

/** Every asset. */
export function findAllAssets() {
    return prisma.assets.findMany();
}

/** Every asset with a warranty expiry, soonest first. */
export function findAssetsWithWarranty() {
    return prisma.assets.findMany({
        where: { warranty_expiry: { not: null } },
        orderBy: { warranty_expiry: 'asc' }
    });
}
