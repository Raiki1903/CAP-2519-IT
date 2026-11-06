/**
 * Ticket route table: filing a ticket and reading one's own for any Active account, and the IT Admin's list.
 * Layer: routes. Mounted by server/app.ts. Calls tickets.controller.ts.
 * Used by: the Support tickets section of every Account page, and the IT Admin's Tickets page.
 */
import express from 'express';
import * as ticketsController from './tickets.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireItAdmin } from '../../shared/middleware/permissions';

/** The ticket endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const ticketsRouter = express.Router();

// Any Active account: a ticket always needs a login, so there is no form on the login page.
ticketsRouter.post('/api/tickets', requireAuth, requireActive, ticketsController.createTicket);
ticketsRouter.get('/api/tickets/mine', requireAuth, requireActive, ticketsController.listMyTickets);

// The IT Admin only. Every other role gets 403.
ticketsRouter.get('/api/tickets', requireAuth, requireActive, requireItAdmin, ticketsController.listTickets);
