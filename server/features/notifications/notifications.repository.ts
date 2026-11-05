/**
 * Notification row access: the loan reads the notifications are worked out from. There is no notifications table.
 * Layer: repository. Called by notifications.service.ts. Calls server/config/prisma.ts.
 * Used by: the notification bell.
 */
import type { asset_loans_status } from '@prisma/client';
import { prisma } from '../../config/prisma';

/** What each notification reads of a loan: its dates and its asset's tag and home lab. */
const NOTIFICATION_LOAN_SELECT = {
    loan_id: true,
    status: true,
    requested_at: true,
    decided_at: true,
    return_requested_at: true,
    return_by: true,
    assets: { select: { asset_tag: true, center_id: true } },
} as const;

/** The order every notification list keeps: oldest request first. */
const OLDEST_FIRST = [{ requested_at: 'asc' }, { loan_id: 'asc' }] as const;

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
