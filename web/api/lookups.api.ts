/**
 * Lookups API: the option lists the forms pick from.
 * Layer: api. Called by features/lookups/useLookups.ts. Calls client.ts; types from @shared/types/lookups.
 * Used by: Edit Asset and Register Equipment.
 */
import { apiGet, type ApiResult } from "./client";

/**
 * Lists the labs, categories, funding sources, and editable statuses. Needs no session.
 *
 * @returns `success` and the FormLookups fields (`labs`, `categories`, `fundingSources`, `statuses`), or `error`
 */
export function getFormLookups(): Promise<ApiResult> {
  return apiGet("/api/lookups");
}

/**
 * Lists the accounts Edit Asset may name as custodian. Staff only.
 *
 * @returns `success` and `users`, each a CustodianOption (`userId` and `name`), or `error`
 */
export function getCustodianOptions(): Promise<ApiResult> {
  return apiGet("/api/lookups/users");
}
