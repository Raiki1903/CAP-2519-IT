/**
 * Notification row access: the loan, ticket, retirement, and inspection reads the notifications are worked out from.
 * There is no notifications table.
 * Layer: repository. Called by notifications.service.ts. Calls server/config/prisma.ts.
 * Used by: the notification bell.
 */
import type { asset_loans_status, asset_maintenance_status } from '@prisma/client';
import { prisma } from '../../config/prisma';

/** What each notification reads of an asset: its tag and home lab. */
const NOTIFICATION_ASSET_SELECT = { select: { asset_tag: true, center_id: true } } as const;

/** What each notification reads of a loan: its dates and its asset. */
const NOTIFICATION_LOAN_SELECT = {
    loan_id: true,
    asset_id: true,
    status: true,
    requested_at: true,
    decided_at: true,
    return_requested_at: true,
    return_by: true,
    assets: NOTIFICATION_ASSET_SELECT,
} as const;

/** What each notification reads of a ticket: its status, report date, and asset. */
const NOTIFICATION_TICKET_SELECT = {
    maintenance_id: true,
    status: true,
    reported_at: true,
    assets: NOTIFICATION_ASSET_SELECT,
} as const;

/** The order every loan list keeps: oldest request first. */
const OLDEST_FIRST = [{ requested_at: 'asc' }, { loan_id: 'asc' }] as const;

/** The order every ticket list keeps: oldest report first. */
const OLDEST_REPORT_FIRST = [{ reported_at: 'asc' }, { maintenance_id: 'asc' }] as const;

/**
 * The loans in these statuses on assets of one lab, oldest request first.
 *
 * @param centerId the asset's home lab
 * @param statuses the loan statuses
 */
export function findLabLoans(centerId: number, statuses: asset_loans_status[]) {
    return prisma.asset_loans.findMany({
        where: { status: { in: statuses }, assets: { center_id: centerId } },
        select: NOTIFICATION_LOAN_SELECT,
        orderBy: [...OLDEST_FIRST],
    });
}

/**
 * The loans in these statuses, on any asset, oldest request first.
 *
 * @param statuses the loan statuses
 */
export function findLoansInStatuses(statuses: asset_loans_status[]) {
    return prisma.asset_loans.findMany({
        where: { status: { in: statuses } },
        select: NOTIFICATION_LOAN_SELECT,
        orderBy: [...OLDEST_FIRST],
    });
}

/**
 * One borrower's loans in these statuses, matched by user id, oldest request first.
 *
 * @param borrowerId the session user
 * @param statuses the loan statuses
 */
export function findBorrowerLoans(borrowerId: number, statuses: asset_loans_status[]) {
    return prisma.asset_loans.findMany({
        where: { borrower_id: borrowerId, status: { in: statuses } },
        select: NOTIFICATION_LOAN_SELECT,
        orderBy: [...OLDEST_FIRST],
    });
}

/**
 * When each asset was last inspected, by anyone and of any type (a Self Report counts), in one query.
 *
 * @param assetIds the assets
 * @returns the time by asset id; an asset never inspected is not in the map
 */
export async function findLastInspections(assetIds: number[]): Promise<Map<number, Date>> {
    if (assetIds.length === 0) return new Map();
    const rows = await prisma.asset_inspections.findMany({
        where: { asset_id: { in: assetIds } },
        orderBy: [{ asset_id: 'asc' }, { inspected_at: 'desc' }, { inspection_id: 'desc' }],
        distinct: ['asset_id'],
        select: { asset_id: true, inspected_at: true },
    });
    return new Map(rows.map(r => [r.asset_id, r.inspected_at]));
}

/**
 * The tickets in these statuses, on any asset, oldest report first.
 *
 * @param statuses the ticket statuses
 */
export function findTicketsInStatuses(statuses: asset_maintenance_status[]) {
    return prisma.asset_maintenance.findMany({
        where: { status: { in: statuses } },
        select: NOTIFICATION_TICKET_SELECT,
        orderBy: [...OLDEST_REPORT_FIRST],
    });
}

/**
 * One reporter's tickets in these statuses, matched by user id, oldest report first.
 *
 * @param reporterId the session user
 * @param statuses the ticket statuses
 */
export function findReporterTickets(reporterId: number, statuses: asset_maintenance_status[]) {
    return prisma.asset_maintenance.findMany({
        where: { reported_by_id: reporterId, status: { in: statuses } },
        select: NOTIFICATION_TICKET_SELECT,
        orderBy: [...OLDEST_REPORT_FIRST],
    });
}

/**
 * The Pending retirements someone else requested, oldest request first.
 *
 * @param viewerId the session user, whose own requests are left out
 */
export function findPendingRetirementsNotBy(viewerId: number) {
    return prisma.asset_retirements.findMany({
        where: { status: 'PENDING', requested_by_id: { not: viewerId } },
        select: { retirement_id: true, requested_at: true, assets: NOTIFICATION_ASSET_SELECT },
        orderBy: [{ requested_at: 'asc' }, { retirement_id: 'asc' }],
    });
}
