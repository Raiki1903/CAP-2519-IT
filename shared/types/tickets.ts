/**
 * Request and response shapes of the system-support tickets (docs/contracts/lifecycle.md, section 7.8).
 * Layer: shared. Imported by server/features/tickets/ and, in Stop 3, web/api. Imports shared/constants/tickets.ts.
 * Used by: the Support tickets section of every Account page, and the IT Admin's Tickets page.
 */
import type { TicketStatus, TicketType } from "../constants/tickets";

/** A ticket (contract "Common objects", Ticket). People are `{ userId, name }`, never an email. */
export interface Ticket {
  ticketId: number;
  createdBy: { userId: number; name: string };
  type: TicketType;
  typeLabel: string;
  title: string;
  description: string;
  status: TicketStatus;
  statusLabel: string;
  resolutionRemarks: string | null;
  /** The IT Admin who set Resolved or Rejected, or null before that. */
  resolvedBy: { userId: number; name: string } | null;
  /** ISO time, or null before Resolved or Rejected. */
  resolvedAt: string | null;
  /** ISO time. */
  createdAt: string;
  /** ISO time. */
  updatedAt: string;
}

/** The body of POST /api/tickets, trimmed. */
export interface CreateTicketInput {
  type: TicketType;
  /** 1 to TICKET_TITLE_MAX_LENGTH characters. */
  title: string;
  /** 1 to TICKET_DESCRIPTION_MAX_LENGTH characters. */
  description: string;
}

/** The body of PUT /api/tickets/:ticketId/status. */
export interface ChangeTicketStatusInput {
  status: TicketStatus;
  /** Trimmed, 1 to TICKET_REMARKS_MAX_LENGTH characters for Resolved and Rejected; null for In Progress. */
  resolutionRemarks: string | null;
}

/** The filters of GET /api/tickets, each optional and one value each. */
export interface TicketListFilters {
  status?: TicketStatus;
  type?: TicketType;
}
