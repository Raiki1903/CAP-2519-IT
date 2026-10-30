/**
 * Response shapes of the lookups endpoints: the option lists the forms pick from.
 * Layer: shared. Imported by server/features/lookups/ and web/api/lookups.api.ts. Imports nothing.
 * Used by: Edit Asset, Register Equipment, the borrow form, and the sign-up page.
 */

/** One research center, as the forms offer it. */
export interface LookupLab {
  /** research_centers.short_code: the value a form sends. */
  code: string;
  /** The full name, shown on the sign-up page. */
  name: string;
  /** research_centers.location. No screen reads it yet. */
  campus: "MANILA" | "LAGUNA";
}

/** The answer of GET /api/lookups, without `success`. Open to anyone: it names no person. */
export interface FormLookups {
  /** Every research center, by short code. */
  labs: LookupLab[];
  /** ASSET_CATEGORIES. */
  categories: string[];
  /** FUNDING_SOURCES. */
  fundingSources: string[];
  /** The stored statuses Edit Asset may set (EDITABLE_ASSET_STATUSES). */
  statuses: string[];
}

/** One entry of GET /api/lookups/users (Staff only): an account with the Custodian role. Nothing else about the person. */
export interface CustodianOption {
  userId: number;
  /** "First Last", as the asset list writes a holder's name. */
  name: string;
}
