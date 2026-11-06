/**
 * Ticket service: system-support tickets in the contract's Ticket shape: filing one, a person's own, the IT Admin's
 * list, and the status moves.
 * Layer: service. Called by tickets.controller.ts. Calls tickets.repository.ts; labels and moves from @shared.
 * Used by: the Support tickets section of every Account page, and the IT Admin's Tickets page.
 */
import { TICKET_CLOSING_STATUSES, TICKET_STATUS_LABELS, TICKET_STATUS_MOVES, TICKET_TYPE_LABELS } from '@shared/constants/tickets';
import type { ChangeTicketStatusInput, CreateTicketInput, Ticket, TicketListFilters } from '@shared/types/tickets';
import * as ticketsRepository from './tickets.repository';
import type { TicketRow } from './tickets.repository';
import { AppError } from '../../shared/errors/AppError';

type NamedRow = { user_id: number; first_name: string; last_name: string };

const personOf = (person: NamedRow) => ({ userId: person.user_id, name: `${person.first_name} ${person.last_name}` });

/** A ticket row in the contract's Ticket shape. */
export function toTicket(row: TicketRow): Ticket {
    return {
        ticketId: row.ticket_id,
        createdBy: personOf(row.created_by),
        type: row.type,
        typeLabel: TICKET_TYPE_LABELS[row.type],
        title: row.title,
        description: row.description,
        status: row.status,
        statusLabel: TICKET_STATUS_LABELS[row.status],
        resolutionRemarks: row.resolution_remarks,
        resolvedBy: row.resolved_by ? personOf(row.resolved_by) : null,
        resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}

/**
 * Files a ticket for the session's account, Open. Any Active account may; asset problems go through Maintenance.
 *
 * @param createdById the session user (never from the body)
 * @param input the type, title, and description, already checked
 * @returns the new ticket
 */
export async function createTicket(createdById: number, input: CreateTicketInput): Promise<Ticket> {
    return toTicket(await ticketsRepository.createTicket(createdById, input));
}

/**
 * The tickets the session's account filed, newest first, with the IT Admin's answer when there is one.
 *
 * @param createdById the session user
 * @returns the person's own tickets only
 */
export async function listMyTickets(createdById: number): Promise<Ticket[]> {
    return (await ticketsRepository.findTicketsBy(createdById)).map(toTicket);
}

/**
 * Every ticket, newest first, for the IT Admin.
 *
 * @param filters status and type, each optional
 * @returns the tickets that pass
 */
export async function listTickets(filters: TicketListFilters): Promise<Ticket[]> {
    return (await ticketsRepository.findTickets(filters)).map(toTicket);
}

/**
 * Moves a ticket to a new status, as the contract's ticket table allows: Open to In Progress, Resolved, or Rejected;
 * In Progress to Resolved or Rejected. Resolved and Rejected are final, and record the IT Admin and the time.
 *
 * @param ticketId the ticket
 * @param input the new status, with remarks for Resolved and Rejected (already checked)
 * @param itAdminId the session user who changes it (never from the body)
 * @returns the ticket as it is now
 * @throws AppError 404 if there is no such ticket
 * @throws AppError 409 if the move is not allowed from the ticket's status
 */
export async function changeTicketStatus(ticketId: number, input: ChangeTicketStatusInput, itAdminId: number): Promise<Ticket> {
    const closing = TICKET_CLOSING_STATUSES.includes(input.status);
    const row = await ticketsRepository.changeTicketStatus(
        ticketId,
        itAdminId,
        { status: input.status, resolutionRemarks: closing ? input.resolutionRemarks : null, resolvedById: closing ? itAdminId : null },
        (ticket) => {
            if (!TICKET_STATUS_MOVES[ticket.status].includes(input.status)) {
                throw new AppError(409, `A ticket that is ${TICKET_STATUS_LABELS[ticket.status]} can't be moved to ${TICKET_STATUS_LABELS[input.status]}.`);
            }
            return `#${ticketId} ${ticket.status} to ${input.status}`;
        },
    );
    if (!row) throw new AppError(404, "No ticket has this id.");
    return toTicket(row);
}
