/**
 * Maintenance API: every maintenance request the web app sends to the server, one function per endpoint.
 * Layer: api. Called by RepairForm, ReturnForm, AssetDetailModal, CustodianPortal, useRepairTickets, and
 * state/serverData.tsx. Calls client.ts; types from @shared/types/maintenance.
 * Used by: reporting an issue, TSG receipt and the maintenance steps, cancelling a ticket, and the ticket lists.
 */
import type { MaintenanceCancelBody, MaintenanceCompleteBody, MaintenanceReceiveBody, MaintenanceReportBody, MaintenanceStageBody } from "@shared/types/maintenance";
import { apiGet, apiPost, apiPut, type ApiResult } from "./client";

/**
 * Reports an issue on an asset. The reporter is the session user.
 *
 * @param assetTag the asset's tag
 * @param body the issue type (from the lookups) and the description
 * @returns `success` and the new `maintenance` (Pending Receipt); or `error` with the server's sentence
 */
export function reportIssue(assetTag: string, body: MaintenanceReportBody): Promise<ApiResult> {
  return apiPost(`/api/assets/${encodeURIComponent(assetTag)}/maintenance`, body);
}

/**
 * Lists the tickets the session user may see: all for TSG, the Director and the Secretary, the lab's for its Head,
 * the reporter's own for a Researcher.
 *
 * @returns `success` and `tickets`, each a Maintenance from @shared/types/maintenance; or `error`
 */
export function listTickets(): Promise<ApiResult> {
  return apiGet("/api/maintenance");
}

/**
 * TSG receives the asset for a ticket in Pending Receipt, with a Maintenance inspection. A held loan ends.
 *
 * @param maintenanceId numeric ticket id, without the "MNT-" prefix
 * @returns `success` and the `maintenance` (Inspecting); or `error`
 */
export function receiveTicket(maintenanceId: number | string, body: MaintenanceReceiveBody): Promise<ApiResult> {
  return apiPut(`/api/maintenance/${maintenanceId}/receive`, body);
}

/**
 * TSG starts the work on an Inspecting ticket: Repairing, or External Service with a provider.
 *
 * @param maintenanceId numeric ticket id
 * @returns `success` and the `maintenance`; or `error` (for example the warranty sentence)
 */
export function startTicket(maintenanceId: number | string, body: MaintenanceStageBody): Promise<ApiResult> {
  return apiPut(`/api/maintenance/${maintenanceId}/start`, body);
}

/**
 * TSG moves the work between Repairing and External Service.
 *
 * @param maintenanceId numeric ticket id
 * @returns `success` and the `maintenance`; or `error`
 */
export function changeTicketStage(maintenanceId: number | string, body: MaintenanceStageBody): Promise<ApiResult> {
  return apiPut(`/api/maintenance/${maintenanceId}/stage`, body);
}

/**
 * TSG completes the work, Resolved or Beyond Repair, with a Maintenance inspection and remarks.
 *
 * @param maintenanceId numeric ticket id
 * @returns `success` and the `maintenance`; or `error`
 */
export function completeTicket(maintenanceId: number | string, body: MaintenanceCompleteBody): Promise<ApiResult> {
  return apiPut(`/api/maintenance/${maintenanceId}/complete`, body);
}

/**
 * Cancels a ticket: the reporter while it is Pending Receipt, or TSG until the work starts.
 *
 * @param maintenanceId numeric ticket id
 * @returns `success` and the `maintenance` (Cancelled); or `error`
 */
export function cancelTicket(maintenanceId: number | string, body: MaintenanceCancelBody = {}): Promise<ApiResult> {
  return apiPut(`/api/maintenance/${maintenanceId}/cancel`, body);
}
