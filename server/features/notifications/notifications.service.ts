/**
 * Notifications service: works out the session user's notifications from the loans, on each call. (#131)
 * Layer: service. Called by notifications.controller.ts. Calls notifications.repository.ts,
 * shared/middleware/permissions.ts (hasAccessRole, for TSG), and shared/services/assetState.ts (today's date).
 * Used by: the notification bell of every role but the IT Admin.
 */
import type { SessionIdentity } from '@shared/types/auth';
import type { Notification } from '@shared/types/notifications';
import { DUE_SOON_DAYS, NOTIFICATION_LABELS, type NotificationKind } from '@shared/constants/notifications';
import { HELD_LOAN_STATUSES } from '@shared/constants/loanStatuses';
import * as notificationsRepository from './notifications.repository';
import { hasAccessRole } from '../../shared/middleware/permissions';
import { serverToday } from '../../shared/services/assetState';

/** A loan as the repository reads it for a notification. */
type NotificationLoan = Awaited<ReturnType<typeof notificationsRepository.findLoansInStatuses>>[number];

/** A DATE column as yyyy-mm-dd. Prisma reads a DATE as midnight UTC, so the UTC date is the stored one. */
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

/** A date-time as the server's local yyyy-mm-dd, the day it happened for the people using the app. */
const localDay = (d: Date) => serverToday(d);

/** The yyyy-mm-dd that is `days` after a yyyy-mm-dd. */
function daysAfter(day: string, days: number): string {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/** One notification about a loan. */
function notificationOf(kind: NotificationKind, loan: NotificationLoan, date: string | undefined): Notification {
    return {
        kind,
        label: NOTIFICATION_LABELS[kind],
        loanId: loan.loan_id,
        assetTag: loan.assets.asset_tag,
        centerId: loan.assets.center_id,
        ...(date ? { date } : {}),
    };
}

/**
 * The session user's notifications. People are matched by user id only, never by display name (#131):
 * - the account that heads a lab: LOAN_AWAITING_APPROVAL for each Pending Approval loan on its lab's assets;
 * - TSG: RELEASE_WAITING for each Pending Release loan, RETURN_WAITING for each Return Requested loan;
 * - a borrower: for each of their On Loan or Return Requested loans, LOAN_OVERDUE once the return-by date has passed,
 *   or LOAN_DUE_SOON when it is today or within DUE_SOON_DAYS days.
 * Anyone else gets none. Each kind's list is oldest request first.
 *
 * @param viewer the session user
 * @returns the notifications, approvals first, then TSG's, then the borrower's
 */
export async function myNotifications(viewer: SessionIdentity): Promise<Notification[]> {
    const isTsg = hasAccessRole(viewer, ["TSG_STAFF"]);
    const [awaiting, tsgLoans, held] = await Promise.all([
        viewer.headOfCenterId === null ? [] : notificationsRepository.findLabLoans(viewer.headOfCenterId, ["PENDING_APPROVAL"]),
        isTsg ? notificationsRepository.findLoansInStatuses(["PENDING_RELEASE", "RETURN_REQUESTED"]) : [],
        notificationsRepository.findBorrowerLoans(viewer.userId, [...HELD_LOAN_STATUSES]),
    ]);

    const notifications: Notification[] = awaiting.map(l => notificationOf("LOAN_AWAITING_APPROVAL", l, localDay(l.requested_at)));
    for (const l of tsgLoans.filter(l => l.status === "PENDING_RELEASE")) {
        notifications.push(notificationOf("RELEASE_WAITING", l, l.decided_at ? localDay(l.decided_at) : undefined));
    }
    for (const l of tsgLoans.filter(l => l.status === "RETURN_REQUESTED")) {
        notifications.push(notificationOf("RETURN_WAITING", l, l.return_requested_at ? localDay(l.return_requested_at) : undefined));
    }

    const today = serverToday();
    const dueSoonUntil = daysAfter(today, DUE_SOON_DAYS);
    for (const l of held) {
        const returnBy = dateOnly(l.return_by);
        if (returnBy < today) notifications.push(notificationOf("LOAN_OVERDUE", l, returnBy));
        else if (returnBy <= dueSoonUntil) notifications.push(notificationOf("LOAN_DUE_SOON", l, returnBy));
    }
    return notifications;
}
