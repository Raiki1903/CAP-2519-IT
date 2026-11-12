/**
 * Support tickets: a short form to ask the IT Admin about the system, and the person's own tickets with their answers.
 * Layer: feature component. Called by pages/shared/SupportTicketsPage.tsx.
 * Calls: api/tickets.api.ts createTicket() and listMyTickets(), features/tickets/TicketStatusBadge.tsx.
 * Used by: every role but the IT Admin, on the Support Tickets page.
 */
import { useCallback, useEffect, useState } from "react";
import {
  TICKET_DESCRIPTION_MAX_LENGTH, TICKET_TITLE_MAX_LENGTH, TICKET_TYPES, TICKET_TYPE_LABELS, type TicketType,
} from "@shared/constants/tickets";
import type { Ticket } from "@shared/types/tickets";
import * as ticketsApi from "@web/api/tickets.api";
import { TicketStatusBadge, ticketTime } from "@web/features/tickets/TicketStatusBadge";
import { Button } from "@web/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { Textarea } from "@web/components/ui/textarea";
import { LifeBuoy } from "lucide-react";

/**
 * Shows the form and the person's own tickets, newest first, with each status, the IT Admin's answer and the dates.
 * The counts show the text as the server will read it (trimmed). Past a limit the box is not cut: the count turns red
 * and Send waits, so nothing typed is dropped silently. The server has the last word: its sentence shows under the
 * form when it refuses. Takes no props.
 */
export function SupportTickets() {
  const [type, setType] = useState<TicketType>("QUESTION");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const titleLength = title.trim().length;
  const descriptionLength = description.trim().length;
  const titleBad = titleLength === 0 || titleLength > TICKET_TITLE_MAX_LENGTH;
  const descriptionBad = descriptionLength === 0 || descriptionLength > TICKET_DESCRIPTION_MAX_LENGTH;

  const load = useCallback(async () => {
    try {
      const data = await ticketsApi.listMyTickets();
      if (data.success && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
        setLoadError(null);
      } else {
        setLoadError(data.error || "Could not load your tickets. Try again.");
      }
    } catch {
      setLoadError("Can't reach the server right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    setSent(false);
    try {
      const data = await ticketsApi.createTicket({ type, title: title.trim(), description: description.trim() });
      if (!data.success) {
        setSendError(data.error ?? "Could not send the ticket. Try again.");
        return;
      }
      setTitle("");
      setDescription("");
      setSent(true);
      await load();
    } catch {
      setSendError("Can't reach the server right now. Try again in a moment.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border border-border shadow-sm overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <LifeBuoy size={16} className="text-primary" />
          Support tickets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Ask the IT Admin about the system: a bug, trouble with your account, or a question. A problem with an asset is not a
          ticket: use Report an issue on the asset instead.
        </p>

        <form onSubmit={send} className="space-y-4">
          <div className="space-y-1.5 sm:w-56">
            <Label htmlFor="ticket-type" className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Type</Label>
            <Select value={type} onValueChange={value => setType(value as TicketType)} disabled={sending}>
              <SelectTrigger id="ticket-type" className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_TYPES.map(value => (
                  <SelectItem key={value} value={value} className="text-xs">{TICKET_TYPE_LABELS[value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-title" className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Title</Label>
            <Input
              id="ticket-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={sending}
              placeholder="A few words about the problem"
              className="h-9 text-xs"
              aria-invalid={titleLength > TICKET_TITLE_MAX_LENGTH}
            />
            <p className={titleLength > TICKET_TITLE_MAX_LENGTH ? "text-[11px] text-destructive font-semibold" : "text-[11px] text-muted-foreground"}>
              {titleLength} / {TICKET_TITLE_MAX_LENGTH}
              {titleLength > TICKET_TITLE_MAX_LENGTH && ` The title must be at most ${TICKET_TITLE_MAX_LENGTH} characters.`}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-description" className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Description</Label>
            <Textarea
              id="ticket-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={sending}
              rows={4}
              placeholder="What happened, and what you expected"
              className="text-xs"
              aria-invalid={descriptionLength > TICKET_DESCRIPTION_MAX_LENGTH}
            />
            <p className={descriptionLength > TICKET_DESCRIPTION_MAX_LENGTH ? "text-[11px] text-destructive font-semibold" : "text-[11px] text-muted-foreground"}>
              {descriptionLength} / {TICKET_DESCRIPTION_MAX_LENGTH}
              {descriptionLength > TICKET_DESCRIPTION_MAX_LENGTH && ` The description must be at most ${TICKET_DESCRIPTION_MAX_LENGTH} characters.`}
            </p>
          </div>

          {sendError && <p role="alert" className="text-xs text-destructive">{sendError}</p>}
          {sent && <p role="status" className="text-xs text-primary font-medium">Ticket sent. The IT Admin's answer will show below.</p>}

          <div className="flex justify-end">
            <Button type="submit" disabled={sending || titleBad || descriptionBad} className="text-xs h-9">
              {sending ? "Sending..." : "Send ticket"}
            </Button>
          </div>
        </form>

        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">Your tickets</p>
          {loadError && <p role="alert" className="text-xs text-destructive">{loadError}</p>}
          {tickets.length === 0 ? (
            <p className="text-xs text-muted-foreground">{loading ? "Loading your tickets..." : loadError ? "" : "You have not sent any tickets."}</p>
          ) : (
            <ul className="space-y-3">
              {tickets.map(ticket => (
                <li key={ticket.ticketId} className="rounded-md border border-border p-3 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <TicketStatusBadge status={ticket.status} />
                    <span className="font-semibold text-foreground">{ticket.title}</span>
                    <span className="text-muted-foreground">{TICKET_TYPE_LABELS[ticket.type]}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-foreground">{ticket.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Filed {ticketTime(ticket.createdAt)}
                    {ticket.updatedAt !== ticket.createdAt && `. Updated ${ticketTime(ticket.updatedAt)}`}
                  </p>
                  {ticket.resolutionRemarks && (
                    <div className="rounded-md bg-muted/40 p-2 space-y-1">
                      <p className="font-bold">Answer</p>
                      <p className="whitespace-pre-wrap break-words text-foreground">{ticket.resolutionRemarks}</p>
                      {ticket.resolvedBy && ticket.resolvedAt && (
                        <p className="text-[11px] text-muted-foreground">{ticket.resolvedBy.name}, {ticketTime(ticket.resolvedAt)}</p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
