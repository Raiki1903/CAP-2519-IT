/**
 * Import column definitions, constraints, and canonical header lists for CSV imports.
 * Layer: shared constants. Imported by server/features/imports and shared/types/imports.ts.
 * Calls: nothing.
 * Used by: bulk CSV import of projects and assets.
 */

/** Maximum number of data rows permitted in a single CSV import file. */
export const IMPORT_MAX_ROWS = 500;

/** Maximum number of errors returned in an answer before capping with "and N more". */
export const IMPORT_MAX_ERRORS = 200;

/** Maximum number of preview rows included in check results. */
export const IMPORT_MAX_PREVIEW_ROWS = 10;

/** Maximum allowed monetary value for asset acquisition value. */
export const IMPORT_ACQUISITION_VALUE_MAX = 99999999.99;

/** Required columns for projects CSV import. */
export const PROJECT_IMPORT_REQUIRED_COLUMNS = [
  "project_code",
  "project_name",
  "project_leader",
  "lab",
  "start_date",
] as const;

/** Optional columns for projects CSV import. */
export const PROJECT_IMPORT_OPTIONAL_COLUMNS = [
  "funding_source",
  "end_date",
] as const;

/** All recognized canonical columns for projects CSV import. */
export const PROJECT_IMPORT_COLUMNS = [
  ...PROJECT_IMPORT_REQUIRED_COLUMNS,
  ...PROJECT_IMPORT_OPTIONAL_COLUMNS,
] as const;

export type ProjectImportColumn = (typeof PROJECT_IMPORT_COLUMNS)[number];

/** Required columns for assets CSV import. */
export const ASSET_IMPORT_REQUIRED_COLUMNS = [
  "lab",
  "name",
  "category",
  "condition",
] as const;

/** Optional columns for assets CSV import. */
export const ASSET_IMPORT_OPTIONAL_COLUMNS = [
  "health_score",
  "serial_number",
  "manufacturer",
  "home_room",
  "project_code",
  "funding_source",
  "acquisition_value",
  "procurement_date",
  "warranty_expiry",
  "accessories",
  "its_property_tag",
  "tsg_tag",
  "missing_accessories",
  "inspection_remarks",
] as const;

/** All recognized canonical columns for assets CSV import. */
export const ASSET_IMPORT_COLUMNS = [
  ...ASSET_IMPORT_REQUIRED_COLUMNS,
  ...ASSET_IMPORT_OPTIONAL_COLUMNS,
] as const;

export type AssetImportColumn = (typeof ASSET_IMPORT_COLUMNS)[number];

