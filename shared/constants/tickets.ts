/**
 * The help ticket types and statuses (user_tickets.type and .status), their labels, and the field limits.
 * Layer: shared. Imported by server/features/tickets/ and web/ (module 6). Imports nothing.
 * Used by: help tickets to the IT Admin.
 */

/** Every value of user_tickets.type. Must match the `user_tickets_type` enum in schema.prisma. */
export const TICKET_TYPES = ["BUG", "ACCOUNT_ACCESS", "QUESTION", "OTHER"] as const;

/** One value of user_tickets.type. */
export type TicketType = (typeof TICKET_TYPES)[number];

/** The label every screen shows for each ticket type. */
export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  BUG: "Bug",
  ACCOUNT_ACCESS: "Account Access",
  QUESTION: "Question",
  OTHER: "Other",
};

/** Every value of user_tickets.status. Must match the `user_tickets_status` enum in schema.prisma. */
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"] as const;

/** One value of user_tickets.status. */
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** The label every screen shows for each ticket status. */
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};

/** The longest ticket title, the length of user_tickets.title. */
export const TICKET_TITLE_MAX_LENGTH = 150;

/** The longest ticket description. */
export const TICKET_DESCRIPTION_MAX_LENGTH = 2000;

/** The longest resolution remarks. */
export const TICKET_REMARKS_MAX_LENGTH = 1000;

/** The statuses the IT Admin may move a ticket to, from each status. Resolved and Rejected are final. */
export const TICKET_STATUS_MOVES: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "REJECTED"],
  IN_PROGRESS: ["RESOLVED", "REJECTED"],
  RESOLVED: [],
  REJECTED: [],
};

/** The statuses that close a ticket: they need resolution remarks, and record who closed it and when. */
export const TICKET_CLOSING_STATUSES: readonly TicketStatus[] = ["RESOLVED", "REJECTED"];
