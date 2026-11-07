/**
 * Ticket row access: filing a ticket, a person's own tickets, the IT Admin's list, and a status change with its log row.
 * Layer: repository. Called by tickets.service.ts. Calls config/prisma.ts, shared/services/rowLocks.ts, and
 * shared/services/activityLog.ts.
 * Used by: the Support tickets section of every Account page, and the IT Admin's Tickets page.
 */
import type { Prisma, user_tickets_status } from '@prisma/client';
import type { CreateTicketInput, TicketListFilters } from '@shared/types/tickets';
import { prisma } from '../../config/prisma';
import { logActivity } from '../../shared/services/activityLog';
import { lockTicket } from '../../shared/services/rowLocks';

/** What a ticket read includes: who filed it and who resolved it, by name. Never an email. */
const TICKET_SELECT = {
    ticket_id: true,
    type: true,
    title: true,
    description: true,
    status: true,
    resolution_remarks: true,
    resolved_at: true,
    created_at: true,
    updated_at: true,
    created_by: { select: { user_id: true, first_name: true, last_name: true } },
    resolved_by: { select: { user_id: true, first_name: true, last_name: true } },
} satisfies Prisma.user_ticketsSelect;

/** A ticket with the people on it. */
export type TicketRow = Prisma.user_ticketsGetPayload<{ select: typeof TICKET_SELECT }>;

/** Newest first; tickets filed in the same second, newest id first. */
const NEWEST_FIRST: Prisma.user_ticketsOrderByWithRelationInput[] = [{ created_at: 'desc' }, { ticket_id: 'desc' }];

/**
 * Files a ticket, Open, for this account. No log row: there is no event for a new ticket.
 *
 * @param createdById the session user who files it
 * @param input the type, title, and description
 */
export function createTicket(createdById: number, input: CreateTicketInput): Promise<TicketRow> {
    return prisma.user_tickets.create({
        data: { created_by_id: createdById, type: input.type, title: input.title, description: input.description },
        select: TICKET_SELECT,
    });
}

/**
 * The tickets this account filed, newest first.
 *
 * @param createdById the session user
 */
export function findTicketsBy(createdById: number): Promise<TicketRow[]> {
    return prisma.user_tickets.findMany({ where: { created_by_id: createdById }, select: TICKET_SELECT, orderBy: NEWEST_FIRST });
}

/**
 * Every ticket that passes the filters, newest first.
 *
 * @param filters status and type, each optional
 */
export function findTickets(filters: TicketListFilters): Promise<TicketRow[]> {
    return prisma.user_tickets.findMany({ where: { status: filters.status, type: filters.type }, select: TICKET_SELECT, orderBy: NEWEST_FIRST });
}

/** A ticket as a status change is decided on, read after its row is locked. */
export interface LockedTicket {
    status: user_tickets_status;
    createdById: number;
}

/** What a status change writes on the ticket. */
export interface TicketStatusWrite {
    status: user_tickets_status;
    /** Set for Resolved and Rejected; null leaves the column as it is. */
    resolutionRemarks: string | null;
    /** The IT Admin who closes the ticket, for Resolved and Rejected; null leaves who and when as they are. */
    resolvedById: number | null;
}

/**
 * Changes the ticket's status in one transaction, the row locked first, and writes a TICKET_STATUS_CHANGED row with
 * the IT Admin as actor and the ticket's creator as target. Two changes at once run one after the other, and the
 * second sees the status the first set.
 *
 * @param ticketId the ticket
 * @param itAdminId the session user who changes it
 * @param write the new status, and the remarks and resolver for a closing status
 * @param decide the service's rules, run on the locked ticket: throws to refuse, or returns the log details
 * @returns the ticket as it is now, or null if there is none with this id
 */
export function changeTicketStatus(
    ticketId: number,
    itAdminId: number,
    write: TicketStatusWrite,
    decide: (ticket: LockedTicket) => string,
): Promise<TicketRow | null> {
    return prisma.$transaction(async (tx) => {
        await lockTicket(tx, ticketId);
        const ticket = await tx.user_tickets.findUnique({ where: { ticket_id: ticketId }, select: { status: true, created_by_id: true } });
        if (!ticket) return null;
        const details = decide({ status: ticket.status, createdById: ticket.created_by_id });

        await tx.user_tickets.update({
            where: { ticket_id: ticketId },
            data: {
                status: write.status,
                ...(write.resolutionRemarks !== null ? { resolution_remarks: write.resolutionRemarks } : {}),
                ...(write.resolvedById !== null ? { resolved_by_id: write.resolvedById, resolved_at: new Date() } : {}),
            },
        });
        await logActivity(tx, { eventType: 'TICKET_STATUS_CHANGED', actorId: itAdminId, targetUserId: ticket.created_by_id, details });

        return tx.user_tickets.findUniqueOrThrow({ where: { ticket_id: ticketId }, select: TICKET_SELECT });
    });
}
