/**
 * Import types: request, response, and error shapes for bulk CSV imports.
 * Layer: shared types. Imported by server/features/imports and shared/constants/importColumns.ts.
 * Calls: nothing.
 * Used by: bulk CSV import of projects and assets.
 */

/** One validation error on a CSV row, or row 0 for a file-level notice. */
export interface ImportRowError {
  /** 1-based line number in the CSV file, or 0 for an aggregated file notice. */
  row: number;
  /** The column name where the error occurred, or null for row-level or file-level errors. */
  column: string | null;
  /** Human-readable error description. */
  message: string;
}

/** Result of checking a CSV file without saving. */
export interface ImportCheckResult {
  /** True when there are zero validation errors; false otherwise. */
  success: boolean;
  /** Total number of data rows evaluated (excluding header and blank lines). */
  rowCount: number;
  /** List of errors encountered, capped at 200 items plus an optional "and N more" item. */
  errors: ImportRowError[];
  /** Up to 10 sample rows parsed from the file for preview. */
  preview: Record<string, string | number | null>[];
}

/** Result of successfully executing an atomic bulk import. */
export interface ImportSaveResult {
  success: true;
  /** The created items with their source CSV row number and generated identifier or code. */
  created: {
    row: number;
    key: string;
  }[];
}

/** Body of an import request. */
export interface ImportRequestBody {
  /** Raw text content of the CSV file. */
  csv: string;
}

