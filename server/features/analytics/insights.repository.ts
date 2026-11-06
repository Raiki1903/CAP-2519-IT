/**
 * Insights reads: the rows the five insight rules need, for one lab or every lab. Nothing here writes.
 * Layer: repository. Called by insights.service.ts. Calls config/prisma.ts.
 * Used by: the Staff, Lab Head, and Director analytics insights.
 * Scope is always assets.center_id (the asset's home lab), never the tag. Retired assets are left out here, and the
 * rules skip them again. Each query selects only the columns a rule reads, so no photo or text column is loaded.
 */
import type { Prisma } from '@prisma/client';
import { TSG_INSPECTION_TYPES } from '@shared/constants/inspectionTypes';
import { HELD_LOAN_STATUSES } from '@shared/constants/loanStatuses';
import { prisma } from '../../config/prisma';

/** The assets in scope: not Retired, and in the one lab when a lab is given. */
function assetScope(centerId: number | null): Prisma.assetsWhereInput {
    return { status: { not: 'RETIRED' }, ...(centerId === null ? {} : { center_id: centerId }) };
}

/** Every asset in scope with its home lab's code, oldest first. */
export function findAssets(centerId: number | null) {
    return prisma.assets.findMany({
        where: assetScope(centerId),
        select: {
            asset_id: true, asset_tag: true, name: true, category: true, status: true,
            procurement_date: true, warranty_expiry: true,
            research_centers: { select: { short_code: true } },
        },
        orderBy: { asset_id: 'asc' },
    });
}

/** The On Loan and Return Requested loans of assets in scope, with the borrower's name. */
export function findHeldLoans(centerId: number | null) {
    return prisma.asset_loans.findMany({
        where: { status: { in: [...HELD_LOAN_STATUSES] as ('ON_LOAN' | 'RETURN_REQUESTED')[] }, assets: assetScope(centerId) },
        select: {
            loan_id: true, asset_id: true, status: true, return_by: true,
            users: { select: { first_name: true, last_name: true } },
        },
    });
}

/**
 * The tickets of assets in scope reported on or after `since`, Cancelled ones left out. `since` is a coarse limit, a
 * day or two wider than the rule's window, and the rule makes the exact cut by the local day.
 */
export function findRecentTickets(centerId: number | null, since: Date) {
    return prisma.asset_maintenance.findMany({
        where: { status: { not: 'CANCELLED' }, reported_at: { gte: since }, assets: assetScope(centerId) },
        select: { maintenance_id: true, asset_id: true, status: true, reported_at: true },
    });
}

/**
 * The TSG inspections (every type but Self Report) of assets in scope, newest first within each asset.
 * It loads all of them and the service keeps the two newest per asset: fine at today's size; stored procedures are on
 * the Recommendations list if the data grows.
 */
export function findTsgInspections(centerId: number | null) {
    return prisma.asset_inspections.findMany({
        where: { type: { in: [...TSG_INSPECTION_TYPES] }, assets: assetScope(centerId) },
        select: { inspection_id: true, asset_id: true, type: true, condition: true, inspected_at: true },
        orderBy: [{ asset_id: 'asc' }, { inspected_at: 'desc' }, { inspection_id: 'desc' }],
    });
}
