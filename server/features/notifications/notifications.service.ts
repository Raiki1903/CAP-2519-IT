/**
 * Notifications service: works out the session user's notifications from the loans, tickets, retirements, and
 * inspections, on each call. (#131)
 * Layer: service. Called by notifications.controller.ts. Calls notifications.repository.ts,
 * shared/middleware/permissions.ts (hasAccessRole, for TSG and the deciders), and shared/services/assetState.ts (today's date).
 * Used by: the notification bell of every role but the IT Admin.
 */
import type { SessionIdentity } from '@shared/types/auth';
import type { Notification } from '@shared/types/notifications';
import { DUE_SOON_DAYS, NOTIFICATION_LABELS, STATUS_CHECK_DAYS, type NotificationKind } from '@shared/constants/notifications';
import { HELD_LOAN_STATUSES } from '@shared/constants/loanStatuses';
import { MAINTENANCE_STATUS_LABELS, OPEN_MAINTENANCE_STATUSES } from '@shared/constants/maintenanceStatuses';
import * as notificationsRepository from './notifications.repository';
import { hasAccessRole } from '../../shared/middleware/permissions';
import { serverToday } from '../../shared/services/assetState';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** A loan as the repository reads it for a notification. */
type NotificationLoan = Awaited<ReturnType<typeof notificationsRepository.findLoansInStatuses>>[number];

/** A ticket as the repository reads it for a notification. */
type NotificationTicket = Awaited<ReturnType<typeof notificationsRepository.findTicketsInStatuses>>[number];

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

/** One notification about a ticket, dated by its report. */
function ticketNotificationOf(kind: NotificationKind, ticket: NotificationTicket): Notification {
    return {
        kind,
        label: NOTIFICATION_LABELS[kind],
        maintenanceId: ticket.maintenance_id,
        assetTag: ticket.assets.asset_tag,
        centerId: ticket.assets.center_id,
        date: localDay(ticket.reported_at),
    };
}

/**
 * The session user's notifications. People are matched by user id only, never by display name (#131):
 * - the account that heads a lab: LOAN_AWAITING_APPROVAL for each Pending Approval loan on its lab's assets;
 * - TSG: RELEASE_WAITING for each Pending Release loan, RETURN_WAITING for each Return Requested loan, and
 *   RECEIPT_WAITING for each ticket in Pending Receipt;
 * - the Director and the Secretary: DISPOSAL_DECISION_WAITING for each Pending retirement they did not request;
 * - a borrower: for each of their On Loan or Return Requested loans, LOAN_OVERDUE once the return-by date has passed,
 *   or LOAN_DUE_SOON when it is today or within DUE_SOON_DAYS days; and STATUS_CHECK_DUE when the asset's newest
 *   inspection of any type is older than STATUS_CHECK_DAYS days, or it has none (a Self Report clears it);
 * - a reporter: MAINTENANCE_OPEN for each open ticket they reported, with its status label.
 * Anyone else gets none. Each kind's list is oldest first.
 *
 * @param viewer the session user
 * @returns the notifications, approvals first, then TSG's, the deciders', the borrower's, and the reporter's
 */
export async function myNotifications(viewer: SessionIdentity): Promise<Notification[]> {
    const isTsg = hasAccessRole(viewer, ["TSG_STAFF"]);
    const decides = hasAccessRole(viewer, ["ADRIC_DIRECTOR", "ADRIC_SECRETARY"]);
    const [awaiting, tsgLoans, receipts, disposals, held, myTickets] = await Promise.all([
        viewer.headOfCenterId === null ? [] : notificationsRepository.findLabLoans(viewer.headOfCenterId, ["PENDING_APPROVAL"]),
        isTsg ? notificationsRepository.findLoansInStatuses(["PENDING_RELEASE", "RETURN_REQUESTED"]) : [],
        isTsg ? notificationsRepository.findTicketsInStatuses(["PENDING_RECEIPT"]) : [],
        decides ? notificationsRepository.findPendingRetirementsNotBy(viewer.userId) : [],
        notificationsRepository.findBorrowerLoans(viewer.userId, [...HELD_LOAN_STATUSES]),
        notificationsRepository.findReporterTickets(viewer.userId, [...OPEN_MAINTENANCE_STATUSES]),
    ]);
    const lastInspected = await notificationsRepository.findLastInspections(held.map(l => l.asset_id));

    const notifications: Notification[] = awaiting.map(l => notificationOf("LOAN_AWAITING_APPROVAL", l, localDay(l.requested_at)));
    for (const l of tsgLoans.filter(l => l.status === "PENDING_RELEASE")) {
        notifications.push(notificationOf("RELEASE_WAITING", l, l.decided_at ? localDay(l.decided_at) : undefined));
    }
    for (const l of tsgLoans.filter(l => l.status === "RETURN_REQUESTED")) {
        notifications.push(notificationOf("RETURN_WAITING", l, l.return_requested_at ? localDay(l.return_requested_at) : undefined));
    }
    for (const t of receipts) notifications.push(ticketNotificationOf("RECEIPT_WAITING", t));
    for (const r of disposals) {
        notifications.push({
            kind: "DISPOSAL_DECISION_WAITING",
            label: NOTIFICATION_LABELS.DISPOSAL_DECISION_WAITING,
            retirementId: r.retirement_id,
            assetTag: r.assets.asset_tag,
            centerId: r.assets.center_id,
            date: localDay(r.requested_at),
        });
    }

    const today = serverToday();
    const dueSoonUntil = daysAfter(today, DUE_SOON_DAYS);
    for (const l of held) {
        const returnBy = dateOnly(l.return_by);
        if (returnBy < today) notifications.push(notificationOf("LOAN_OVERDUE", l, returnBy));
        else if (returnBy <= dueSoonUntil) notifications.push(notificationOf("LOAN_DUE_SOON", l, returnBy));
    }
    const checkBefore = Date.now() - STATUS_CHECK_DAYS * MS_PER_DAY;
    for (const l of held) {
        const last = lastInspected.get(l.asset_id);
        if (!last || last.getTime() < checkBefore) {
            notifications.push(notificationOf("STATUS_CHECK_DUE", l, last ? localDay(last) : undefined));
        }
    }

    for (const t of myTickets) {
        notifications.push({ ...ticketNotificationOf("MAINTENANCE_OPEN", t), statusLabel: MAINTENANCE_STATUS_LABELS[t.status] });
    }
    return notifications;
}
