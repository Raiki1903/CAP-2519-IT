/**
 * Support Tickets: the person's own questions and problem reports to the IT Admin, as a page of its own.
 * Layer: page. Called by app/routes.tsx at /staff/tickets, /lab-head/tickets, /custodian/tickets and /adric-director/tickets.
 * Calls: features/tickets/SupportTickets.tsx.
 * Used by: every role but the IT Admin, who answers tickets on the IT Admin Tickets page.
 */
import { SupportTickets } from "@web/features/tickets/SupportTickets";

/** The heading and the ticket form with the person's own tickets. Takes no props. */
export function SupportTicketsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-foreground mb-1">Support Tickets</h1>
        <p className="text-muted-foreground text-sm">Ask the IT Admin a question or report a problem with the system, and see the answers.</p>
      </div>

      <SupportTickets />
    </div>
  );
}
