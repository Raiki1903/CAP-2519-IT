/**
 * Lookups API: the option lists the forms pick from.
 * Layer: api. Called by features/lookups/useLookups.ts. Calls client.ts; types from @shared/types/lookups.
 * Used by: Edit Asset, Register Asset, the borrow form, and the sign-up page.
 */
import { apiGet, type ApiResult } from "./client";

/**
 * Lists the labs, categories, funding sources, issue types, metrics, and projects. Needs no session.
 *
 * @returns `success` and the FormLookups fields, or `error`
 */
export function getFormLookups(): Promise<ApiResult> {
  return apiGet("/api/lookups");
}
