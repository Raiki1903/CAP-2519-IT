/**
 * Ticket service: system-support tickets in the contract's Ticket shape: filing one, a person's own, and the IT
 * Admin's list.
 * Layer: service. Called by tickets.controller.ts. Calls tickets.repository.ts; labels from @shared.
 * Used by: the Support tickets section of every Account page, and the IT Admin's Tickets page.
 */
import { TICKET_STATUS_LABELS, TICKET_TYPE_LABELS } from '@shared/constants/tickets';
import type { CreateTicketInput, Ticket, TicketListFilters } from '@shared/types/tickets';
import * as ticketsRepository from './tickets.repository';
import type { TicketRow } from './tickets.repository';

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
