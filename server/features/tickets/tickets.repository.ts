/**
 * Ticket row access: filing a ticket, a person's own tickets, and the IT Admin's list.
 * Layer: repository. Called by tickets.service.ts. Calls config/prisma.ts.
 * Used by: the Support tickets section of every Account page, and the IT Admin's Tickets page.
 */
import type { Prisma } from '@prisma/client';
import type { CreateTicketInput, TicketListFilters } from '@shared/types/tickets';
import { prisma } from '../../config/prisma';

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
