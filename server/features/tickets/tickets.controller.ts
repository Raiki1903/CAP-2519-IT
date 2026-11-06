/**
 * Ticket controller: unpacks the ticket requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by tickets.routes.ts. Calls tickets.validation.ts, tickets.service.ts, and
 * shared/middleware/requireAuth.ts (sessionUserOf: who is acting).
 * Used by: the Support tickets section of every Account page, and the IT Admin's Tickets page.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts.
 */
import type { Request, Response } from 'express';
import * as ticketsService from './tickets.service';
import { readChangeTicketStatus, readCreateTicket, readTicketId, readTicketListQuery } from './tickets.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/**
 * Handles POST /api/tickets: files a ticket for the session's account.
 * Answers 201 `{ success, ticket }`, or 400 for a bad type, title, or description, or 500.
 */
export async function createTicket(req: Request, res: Response): Promise<void> {
    const input = readCreateTicket(req.body);
    const userId = sessionUserOf(req).userId;

    const ticket = await ticketsService.createTicket(userId, input);

    console.log(`Ticket ${ticket.ticketId} filed by user ${userId}`);
    res.status(201).json({ success: true, ticket });
}

/**
 * Handles GET /api/tickets/mine: the session's own tickets, newest first, as `{ success, tickets }`. Answers 500 on
 * failure.
 */
export async function listMyTickets(req: Request, res: Response): Promise<void> {
    res.json({ success: true, tickets: await ticketsService.listMyTickets(sessionUserOf(req).userId) });
}

/**
 * Handles GET /api/tickets?status=&type=: every ticket that passes the filters, newest first, as
 * `{ success, tickets }`. Answers 400 for a bad filter, or 500.
 */
export async function listTickets(req: Request, res: Response): Promise<void> {
    const filters = readTicketListQuery(req.query);
    res.json({ success: true, tickets: await ticketsService.listTickets(filters) });
}

/**
 * Handles PUT /api/tickets/:ticketId/status: moves a ticket to a new status.
 * Answers `{ success, ticket }`, or the AppError's status and message (400 bad status or remarks; 404 no such
 * ticket; 409 not an allowed move), or 500.
 */
export async function changeTicketStatus(req: Request<{ ticketId: string }>, res: Response): Promise<void> {
    const ticketId = readTicketId(req.params.ticketId);
    const input = readChangeTicketStatus(req.body);
    const itAdminId = sessionUserOf(req).userId;

    const ticket = await ticketsService.changeTicketStatus(ticketId, input, itAdminId);

    console.log(`Ticket ${ticketId} moved to ${ticket.status} by user ${itAdminId}`);
    res.json({ success: true, ticket });
}
