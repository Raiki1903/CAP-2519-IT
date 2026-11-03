/**
 * Response shapes of the lookups endpoints: the option lists the forms pick from.
 * Layer: shared. Imported by server/features/lookups/ and web/api/lookups.api.ts. Imports nothing.
 * Used by: Edit Asset, Register Equipment, the borrow form, Report an issue, the inspection forms, and the sign-up page.
 */

/** One research center, as the forms offer it. */
export interface LookupLab {
  centerId: number;
  /** research_centers.short_code. */
  code: string;
  /** The full name, shown on the sign-up page. */
  name: string;
  /** research_centers.location. */
  campus: "MANILA" | "LAGUNA" | "MCKINLEY";
  /** The campus label from CAMPUS_LABELS. */
  campusLabel: string;
  /** The user id of the account that heads the lab, or null when it has no Head yet. */
  headUserId: number | null;
}

/** One asset category with its label. */
export interface LookupCategory {
  key: string;
  label: string;
}

/** One funding source (a row of funding_sources). */
export interface LookupFundingSource {
  fundingSourceId: number;
  name: string;
}

/** One issue type for Report an issue (a row of issue_types). */
export interface LookupIssueType {
  issueTypeId: number;
  key: string;
  name: string;
  /** A short first step, shown when the type is picked. */
  suggestedAction: string;
}

/** One benchmark metric (a row of metric_definitions). */
export interface LookupMetric {
  metricId: number;
  metricKey: string;
  name: string;
  unit: string;
  higherIsBetter: boolean;
}

/** One project, for the asset's owning project and the loan's project. */
export interface LookupProject {
  projectId: number;
  /** projects.project_code. */
  code: string;
  name: string;
  /** The research center the project belongs to. */
  centerId: number;
}

/** The answer of GET /api/lookups, without `success`. Open to anyone: it names no person. */
export interface FormLookups {
  /** Every research center, by short code. */
  labs: LookupLab[];
  /** ASSET_CATEGORIES with their labels. */
  categories: LookupCategory[];
  /** Every funding source, by name. */
  fundingSources: LookupFundingSource[];
  issueTypes: LookupIssueType[];
  /** The metrics measured for each category. A category with none is left out: its inspections use the health score only. */
  metricsByCategory: Record<string, LookupMetric[]>;
  projects: LookupProject[];
}
