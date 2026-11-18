/**
 * Imports API: endpoints for checking and saving bulk project and asset CSV files. The only place these URLs appear in the frontend.
 * Layer: api. Called by pages/staff/ImportPage.tsx. Calls client.ts; types from @shared/types/imports.
 * Used by: TSG Staff (projects and assets) and the AdRIC Secretary (projects) on the Import page.
 */
import type {
  ImportCheckResult,
  ImportRequestBody,
  ImportSaveResult,
} from "@shared/types/imports";
import { apiPostRaw, readResult } from "./client";

/** Answer from a CSV check endpoint: the validation result, or a failure sentence if the request itself failed. */
export type ImportCheckResponse = Partial<ImportCheckResult> & {
  success: boolean;
  error?: string;
};

/** Answer from a CSV save endpoint: created rows on 201, validation errors on 400, or a failure sentence. */
export type ImportSaveResponse = Partial<ImportSaveResult> &
  Partial<Omit<ImportCheckResult, "success">> & {
    success: boolean;
    error?: string;
  };

/**
 * Checks a projects CSV without writing to the database.
 *
 * @param csv raw CSV text content
 * @returns `success`, `rowCount`, `errors`, and `preview`, or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function checkProjects(csv: string): Promise<ImportCheckResponse> {
  const body: ImportRequestBody = { csv };
  return (await readResult(
    await apiPostRaw("/api/imports/projects/check", body),
    "Could not check the projects file. Try again.",
  )) as ImportCheckResponse;
}

/**
 * Atomically imports all rows from a projects CSV file, or returns validation errors on HTTP 400.
 *
 * @param csv raw CSV text content
 * @returns `success: true` and `created` on 201, `errors` on 400, or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function saveProjects(csv: string): Promise<ImportSaveResponse> {
  const body: ImportRequestBody = { csv };
  return (await readResult(
    await apiPostRaw("/api/imports/projects", body),
    "Could not import the projects. Try again.",
  )) as ImportSaveResponse;
}

/**
 * Checks an assets CSV without writing to the database.
 *
 * @param csv raw CSV text content
 * @returns `success`, `rowCount`, `errors`, and `preview`, or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function checkAssets(csv: string): Promise<ImportCheckResponse> {
  const body: ImportRequestBody = { csv };
  return (await readResult(
    await apiPostRaw("/api/imports/assets/check", body),
    "Could not check the assets file. Try again.",
  )) as ImportCheckResponse;
}

/**
 * Atomically imports all rows from an assets CSV file, or returns validation errors on HTTP 400.
 *
 * @param csv raw CSV text content
 * @returns `success: true` and `created` on 201, `errors` on 400, or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function saveAssets(csv: string): Promise<ImportSaveResponse> {
  const body: ImportRequestBody = { csv };
  return (await readResult(
    await apiPostRaw("/api/imports/assets", body),
    "Could not import the assets. Try again.",
  )) as ImportSaveResponse;
}
