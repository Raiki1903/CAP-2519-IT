/**
 * IT Admin Tickets: the system-support tickets people filed, newest first, each opened to read and to move to a new
 * status.
 * Layer: page. Called by app/routes.tsx at /it-admin/tickets.
 * Calls: api/tickets.api.ts listTickets(), features/tickets/TicketDialog.tsx, features/tickets/TicketStatusBadge.tsx.
 * Used by: the IT Admin.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_TITLES } from "@shared/constants/pageTitles";
import {
  TICKET_STATUSES, TICKET_STATUS_LABELS, TICKET_TYPES, TICKET_TYPE_LABELS, type TicketStatus, type TicketType,
} from "@shared/constants/tickets";
import type { Ticket } from "@shared/types/tickets";
import * as ticketsApi from "@web/api/tickets.api";
import { TicketDialog } from "@web/features/tickets/TicketDialog";
import { TicketStatusBadge, ticketTime } from "@web/features/tickets/TicketStatusBadge";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Label } from "@web/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";

/** The filter selects' value for "every status" or "every type". Real values are upper-case keys, so this never matches one. */
const ALL = "ALL";

/**
 * Lists the tickets, newest first, with a status filter and a type filter. Open on a row shows the ticket in a dialog,
 * where the IT Admin moves it on. The list is read again from the server after each change. The server has the last
 * word: its sentence shows on the page, or in the dialog that sent the change. Takes no props.
 */
export function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<TicketStatus | typeof ALL>(ALL);
  const [type, setType] = useState<TicketType | typeof ALL>(ALL);
  const [opened, setOpened] = useState<Ticket | null>(null);
  // Counts the loads, so a slow answer to an older filter never replaces a newer one.
  const loadCount = useRef(0);

  const load = useCallback(async () => {
    const thisLoad = ++loadCount.current;
    setLoading(true);
    try {
      const data = await ticketsApi.listTickets({
        status: status === ALL ? undefined : status,
        type: type === ALL ? undefined : type,
      });
      if (thisLoad !== loadCount.current) return;
      if (data.success && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
        setError(null);
      } else {
        setError(data.error || "Could not load the tickets. Try again.");
      }
    } catch {
      if (thisLoad !== loadCount.current) return;
      setError("Can't reach the server right now. Try again in a moment.");
    } finally {
      if (thisLoad === loadCount.current) setLoading(false);
    }
  }, [status, type]);

  useEffect(() => {
    load();
  }, [load]);

  const changed = (message: string) => {
    setNotice(message);
    setOpened(null);
    load();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">{PAGE_TITLES.tickets}</h1>
        <p className="text-muted-foreground text-sm">
          Support tickets about the system, newest first. Problems with an asset go through Maintenance, not here.
        </p>
      </div>

      {notice && (
        <div role="status" className="mb-4 flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-bold ml-4 cursor-pointer hover:underline">Dismiss</button>
        </div>
      )}
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="mb-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="space-y-1.5 sm:w-48">
          <Label htmlFor="tickets-status" className="text-xs font-bold">Status</Label>
          <Select value={status} onValueChange={value => setStatus(value as TicketStatus | typeof ALL)}>
            <SelectTrigger id="tickets-status" className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="text-xs">All statuses</SelectItem>
              {TICKET_STATUSES.map(value => (
                <SelectItem key={value} value={value} className="text-xs">{TICKET_STATUS_LABELS[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:w-48">
          <Label htmlFor="tickets-type" className="text-xs font-bold">Type</Label>
          <Select value={type} onValueChange={value => setType(value as TicketType | typeof ALL)}>
            <SelectTrigger id="tickets-type" className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="text-xs">All types</SelectItem>
              {TICKET_TYPES.map(value => (
                <SelectItem key={value} value={value} className="text-xs">{TICKET_TYPE_LABELS[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {["Ticket", "Title", "Type", "From", "Status", "Filed", "Action"].map(h => (
                <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                  {loading ? "Loading tickets..." : "No tickets match the filters."}
                </TableCell>
              </TableRow>
            ) : (
              tickets.map(ticket => (
                <TableRow key={ticket.ticketId}>
                  <TableCell className="text-xs font-mono">#{ticket.ticketId}</TableCell>
                  <TableCell className="text-xs font-semibold max-w-xs truncate">{ticket.title}</TableCell>
                  <TableCell className="text-xs">{TICKET_TYPE_LABELS[ticket.type]}</TableCell>
                  <TableCell className="text-xs">{ticket.createdBy.name}</TableCell>
                  <TableCell className="text-xs"><TicketStatusBadge status={ticket.status} /></TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{ticketTime(ticket.createdAt)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpened(ticket)}>Open</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {opened && <TicketDialog key={opened.ticketId} ticket={opened} onClose={() => setOpened(null)} onChanged={changed} />}
    </div>
  );
}
