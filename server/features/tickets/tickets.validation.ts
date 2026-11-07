/**
 * Ticket request checks: the new ticket's body, the list filters, the ticket id in the URL, and a status change.
 * Layer: validation. Called by tickets.controller.ts. Calls shared/errors/AppError.ts and @shared (ticket types,
 * statuses, and field limits).
 * Used by: the Support tickets section of every Account page, and the IT Admin's Tickets page.
 */
import {
    TICKET_CLOSING_STATUSES, TICKET_DESCRIPTION_MAX_LENGTH, TICKET_REMARKS_MAX_LENGTH, TICKET_STATUSES, TICKET_TITLE_MAX_LENGTH, TICKET_TYPES,
    type TicketStatus, type TicketType,
} from '@shared/constants/tickets';
import type { ChangeTicketStatusInput, CreateTicketInput, TicketListFilters } from '@shared/types/tickets';
import { AppError } from '../../shared/errors/AppError';

const TYPE_MESSAGE = "Choose a ticket type: Bug, Account Access, Question, or Other.";
const STATUS_MESSAGE = "Choose a ticket status: OPEN, IN_PROGRESS, RESOLVED, or REJECTED.";

/** Reads a text field, trimmed, of 1 to `max` characters. */
function readText(value: unknown, max: number, message: string): string {
    if (typeof value !== 'string') throw new AppError(400, message);
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > max) throw new AppError(400, message);
    return trimmed;
}

/**
 * Reads the body of a new ticket: its type, title, and description, each trimmed.
 *
 * @param body the request body
 * @returns the ticket's fields
 * @throws AppError 400 for an unknown type, a title not 1 to 150 characters, or a description not 1 to 2000
 */
export function readCreateTicket(body: any): CreateTicketInput {
    const { type, title, description } = body ?? {};
    if (!(TICKET_TYPES as readonly string[]).includes(type)) throw new AppError(400, TYPE_MESSAGE);
    return {
        type: type as TicketType,
        title: readText(title, TICKET_TITLE_MAX_LENGTH, `Write a title of 1 to ${TICKET_TITLE_MAX_LENGTH} characters.`),
        description: readText(description, TICKET_DESCRIPTION_MAX_LENGTH, `Write a description of 1 to ${TICKET_DESCRIPTION_MAX_LENGTH} characters.`),
    };
}

/**
 * Reads the filters of GET /api/tickets, each optional and sent once.
 *
 * @param query the request's query
 * @returns the filters that were sent
 * @throws AppError 400 for an unknown filter, a filter sent twice, or an unknown status or type
 */
export function readTicketListQuery(query: Record<string, unknown>): TicketListFilters {
    for (const [key, value] of Object.entries(query)) {
        if (key !== 'status' && key !== 'type') throw new AppError(400, `Unknown filter "${key}". Use status or type.`);
        if (typeof value !== 'string') throw new AppError(400, `Send the filter "${key}" once.`);
    }
    const { status, type } = query as Record<string, string | undefined>;
    const filters: TicketListFilters = {};
    if (status !== undefined) {
        if (!(TICKET_STATUSES as readonly string[]).includes(status)) throw new AppError(400, STATUS_MESSAGE);
        filters.status = status as TicketStatus;
    }
    if (type !== undefined) {
        if (!(TICKET_TYPES as readonly string[]).includes(type)) throw new AppError(400, TYPE_MESSAGE);
        filters.type = type as TicketType;
    }
    return filters;
}

/**
 * Reads the ticket id in the URL.
 *
 * @param value the :ticketId parameter
 * @returns the id
 * @throws AppError 400 if it is not a positive whole number
 */
export function readTicketId(value: string): number {
    const ticketId = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(ticketId) || ticketId <= 0) {
        throw new AppError(400, "The ticket id must be a positive whole number.");
    }
    return ticketId;
}

/**
 * Reads the body of a status change: the new status, and the resolution remarks, trimmed. Resolved and Rejected need
 * remarks; the other statuses take none. Whether the move is allowed from the ticket's status is the service's rule.
 *
 * @param body the request body
 * @returns the status and the remarks (null when there are none)
 * @throws AppError 400 for an unknown status, remarks that are not text, remarks missing or longer than 1000
 * characters for Resolved or Rejected, or remarks sent for another status
 */
export function readChangeTicketStatus(body: any): ChangeTicketStatusInput {
    const { status, resolutionRemarks } = body ?? {};
    if (!(TICKET_STATUSES as readonly string[]).includes(status)) throw new AppError(400, STATUS_MESSAGE);
    if (resolutionRemarks !== undefined && resolutionRemarks !== null && typeof resolutionRemarks !== 'string') {
        throw new AppError(400, "Resolution remarks must be text.");
    }
    const remarks = typeof resolutionRemarks === 'string' ? resolutionRemarks.trim() : '';

    if (TICKET_CLOSING_STATUSES.includes(status)) {
        if (remarks.length === 0 || remarks.length > TICKET_REMARKS_MAX_LENGTH) {
            throw new AppError(400, `Write resolution remarks of 1 to ${TICKET_REMARKS_MAX_LENGTH} characters.`);
        }
        return { status, resolutionRemarks: remarks };
    }
    if (remarks.length > 0) throw new AppError(400, "Resolution remarks are only for Resolved or Rejected.");
    return { status, resolutionRemarks: null };
}
