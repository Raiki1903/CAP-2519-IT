/**
 * Tickets API: filing a support ticket, reading one's own, and the IT Admin's list and status changes. The only place
 * these URLs appear in the frontend.
 * Layer: api. Called by features/tickets/ (the Support tickets section, the ticket dialog) and pages/it-admin/TicketsPage.tsx.
 * Calls client.ts; types from @shared/types/tickets.
 * Used by: every Account page, and the IT Admin's Tickets page.
 */
import type { ChangeTicketStatusInput, CreateTicketInput, TicketListFilters } from "@shared/types/tickets";
import { apiGetRaw, apiPostRaw, apiPutRaw, readResult, type ApiResult } from "./client";

/**
 * Files a ticket for the signed-in person. The person is read from the session, not sent.
 *
 * @param input the type, title and description
 * @returns `success` and the new `ticket`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function createTicket(input: CreateTicketInput): Promise<ApiResult> {
  return readResult(await apiPostRaw("/api/tickets", input), "Could not send the ticket. Try again.");
}

/**
 * Lists the signed-in person's own tickets, newest first.
 *
 * @returns `success` and `tickets`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function listMyTickets(): Promise<ApiResult> {
  return readResult(await apiGetRaw("/api/tickets/mine"), "Could not load your tickets. Try again.");
}

/**
 * Lists every ticket for the IT Admin, newest first. Only the filters that are set are sent.
 *
 * @param filters status and type, each optional
 * @returns `success` and `tickets`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function listTickets(filters: TicketListFilters = {}): Promise<ApiResult> {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.type) query.set("type", filters.type);
  const text = query.toString();
  return readResult(await apiGetRaw(`/api/tickets${text ? `?${text}` : ""}`), "Could not load the tickets. Try again.");
}

/**
 * Moves a ticket to a new status. Resolved and Rejected need resolution remarks.
 *
 * @param ticketId the ticket
 * @param input the new status, and the remarks (null for In Progress)
 * @returns `success` and the changed `ticket`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function changeTicketStatus(ticketId: number, input: ChangeTicketStatusInput): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/tickets/${ticketId}/status`, input), "Could not change the ticket. Try again.");
}
