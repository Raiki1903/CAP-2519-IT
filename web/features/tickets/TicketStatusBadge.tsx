/**
 * Ticket status badge: the status of a support ticket, with its label from shared/; and the time format the ticket
 * screens share.
 * Layer: feature component. Called by pages/it-admin/TicketsPage.tsx, features/tickets/TicketDialog.tsx and
 * features/tickets/SupportTickets.tsx.
 * Calls: ui/badge.tsx; labels from @shared/constants/tickets.
 * Used by: the IT Admin's Tickets page and every Account page.
 */
import { TICKET_STATUS_LABELS, type TicketStatus } from "@shared/constants/tickets";
import { Badge } from "@web/components/ui/badge";

const VARIANTS: Record<TicketStatus, "outline" | "secondary" | "default" | "destructive"> = {
  OPEN: "outline",
  IN_PROGRESS: "secondary",
  RESOLVED: "default",
  REJECTED: "destructive",
};

/**
 * Shows a ticket's status as a badge.
 *
 * @param status the ticket's status
 */
export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant={VARIANTS[status]} className="text-[10px]">{TICKET_STATUS_LABELS[status]}</Badge>;
}

/**
 * A ticket time as the screens show it, in the browser's time zone.
 *
 * @param iso an ISO time from the server
 * @returns for example "Nov 7, 2026, 3:05 PM"
 */
export function ticketTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
