/**
 * Ticket dialog: the IT Admin reads one ticket and moves it to a new status, with remarks when it is closed.
 * Layer: feature component. Called by pages/it-admin/TicketsPage.tsx.
 * Calls: api/tickets.api.ts changeTicketStatus(), features/tickets/TicketStatusBadge.tsx.
 * Used by: the IT Admin's Tickets page.
 */
import { useState } from "react";
import {
  TICKET_CLOSING_STATUSES, TICKET_REMARKS_MAX_LENGTH, TICKET_STATUS_LABELS, TICKET_STATUS_MOVES, TICKET_TYPE_LABELS, type TicketStatus,
} from "@shared/constants/tickets";
import type { Ticket } from "@shared/types/tickets";
import * as ticketsApi from "@web/api/tickets.api";
import { TicketStatusBadge, ticketTime } from "@web/features/tickets/TicketStatusBadge";
import { Button } from "@web/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Label } from "@web/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { Textarea } from "@web/components/ui/textarea";

/**
 * Shows the ticket's details and, while it is not closed, a status change that offers only the moves the contract
 * allows (TICKET_STATUS_MOVES). Resolved and Rejected need remarks; the count shows them as the server will read them
 * (trimmed), and past the limit the box is not cut: the count turns red and Confirm waits. The server has the last
 * word: its sentence shows inside the dialog when it refuses, for example when another change got there first.
 *
 * Mount it with `key={ticket.ticketId}` so each ticket starts empty.
 *
 * @param ticket the ticket
 * @param onClose closes the dialog without a change
 * @param onChanged called with a plain sentence about the change after the server accepted
 */
export function TicketDialog({ ticket, onClose, onChanged }: {
  ticket: Ticket;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const moves = TICKET_STATUS_MOVES[ticket.status];
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closing = status !== "" && TICKET_CLOSING_STATUSES.includes(status);
  const length = remarks.trim().length;
  const tooLong = length > TICKET_REMARKS_MAX_LENGTH;
  const missingRemarks = closing && length === 0;

  const change = async () => {
    if (status === "") return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await ticketsApi.changeTicketStatus(ticket.ticketId, { status, resolutionRemarks: closing ? remarks.trim() : null });
      if (!data.success) {
        setError(data.error ?? "Could not change the ticket. Try again.");
        return;
      }
      onChanged(`Ticket #${ticket.ticketId} is now ${TICKET_STATUS_LABELS[status]}.`);
    } catch {
      setError("Can't reach the server right now. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ticket #{ticket.ticketId}</DialogTitle>
          <DialogDescription>
            {TICKET_TYPE_LABELS[ticket.type]} from {ticket.createdBy.name}, filed {ticketTime(ticket.createdAt)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          <div className="flex items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <span className="font-semibold text-foreground">{ticket.title}</span>
          </div>

          <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-3 text-foreground">
            {ticket.description}
          </p>

          {ticket.resolutionRemarks && (
            <div className="space-y-1">
              <p className="font-bold">Answer</p>
              <p className="whitespace-pre-wrap break-words text-foreground">{ticket.resolutionRemarks}</p>
              {ticket.resolvedBy && ticket.resolvedAt && (
                <p className="text-[11px] text-muted-foreground">{ticket.resolvedBy.name}, {ticketTime(ticket.resolvedAt)}</p>
              )}
            </div>
          )}

          {moves.length === 0 ? (
            <p className="text-muted-foreground">This ticket is closed. It can't be changed any more.</p>
          ) : (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="ticket-status" className="text-xs font-bold">Move to</Label>
                <Select value={status} onValueChange={value => setStatus(value as TicketStatus)} disabled={submitting}>
                  <SelectTrigger id="ticket-status" className="h-9 text-xs">
                    <SelectValue placeholder="Choose a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {moves.map(move => (
                      <SelectItem key={move} value={move} className="text-xs">{TICKET_STATUS_LABELS[move]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {closing && (
                <div className="space-y-1.5">
                  <Label htmlFor="ticket-remarks" className="text-xs font-bold">Remarks (required)</Label>
                  <Textarea
                    id="ticket-remarks"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    disabled={submitting}
                    rows={4}
                    className="text-xs"
                    aria-invalid={tooLong}
                  />
                  <p className={tooLong ? "text-[11px] text-destructive font-semibold" : "text-[11px] text-muted-foreground"}>
                    {length} / {TICKET_REMARKS_MAX_LENGTH}
                    {tooLong && ` Remarks must be at most ${TICKET_REMARKS_MAX_LENGTH} characters.`}
                  </p>
                </div>
              )}
            </div>
          )}

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>{moves.length === 0 ? "Close" : "Cancel"}</Button>
          {moves.length > 0 && (
            <Button onClick={change} disabled={submitting || status === "" || missingRemarks || tooLong}>
              {submitting ? "Saving..." : "Change status"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
