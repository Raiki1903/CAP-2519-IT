/**
 * The shapes of the Reference Data answers and bodies: asset categories, labs, and funding sources.
 * Layer: shared types. Imported by server/features/reference and web/ (api/reference.api.ts, the Reference Data page).
 * Imports shared/constants/campuses.ts.
 * Used by: the Reference Data page (TSG and the Secretary).
 */
import type { Campus } from '../constants/campuses';

/** One asset category as the Reference Data page lists it. */
export interface ReferenceCategory {
  /** The key assets.category holds. Made from the label when the category is added, and never changed. */
  code: string;
  label: string;
  /** Years, for the present value by straight-line depreciation. */
  usefulLifeYears: number;
  /** An inactive category is not offered for a new asset; assets that have it keep it. */
  isActive: boolean;
  /** How many assets have this category. */
  assetCount: number;
}

/** The body of POST /api/reference/categories. */
export interface CategoryCreateInput {
  label: string;
  usefulLifeYears: number;
}

/** The body of PUT /api/reference/categories/:code. Only the fields sent change. */
export interface CategoryUpdateInput {
  label?: string;
  usefulLifeYears?: number;
  isActive?: boolean;
}

/** One lab (research_centers row) as the Reference Data page lists it. */
export interface ReferenceLab {
  centerId: number;
  /** The prefix of the lab's asset tags. Never changed after the lab is added. */
  shortCode: string;
  name: string;
  campus: Campus;
  campusLabel: string;
  /** How many assets have this lab as their home lab. */
  assetCount: number;
  /** Whether the lab can be deleted: true only when no assets, users, projects, loans, or Lab Head use it. */
  canDelete: boolean;
}

/** The body of POST /api/reference/labs. */
export interface LabCreateInput {
  name: string;
  shortCode: string;
  campus: Campus;
}

/** The body of PUT /api/reference/labs/:centerId. Only the fields sent change. */
export interface LabUpdateInput {
  name?: string;
  campus?: Campus;
}

/** One funding source as the Reference Data page lists it. */
export interface ReferenceFundingSource {
  fundingSourceId: number;
  name: string;
  /** How many assets name this funding source. */
  assetCount: number;
  /** How many projects name this funding source. */
  projectCount: number;
}

/** The body of POST /api/reference/funding-sources and of PUT /api/reference/funding-sources/:fundingSourceId. */
export interface FundingSourceInput {
  name: string;
}
