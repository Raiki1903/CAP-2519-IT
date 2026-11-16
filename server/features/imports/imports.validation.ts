/**
 * Import request validation: checks request body shape for CSV text payload.
 * Layer: validation. Called by server/features/imports/imports.controller.ts.
 * Calls: shared/errors/AppError.ts.
 * Used by: bulk CSV import of projects and assets.
 */
import { AppError } from '../../shared/errors/AppError';

/**
 * Validates and extracts the raw CSV text from the request body.
 *
 * @param body the raw parsed JSON request body
 * @returns the CSV text content
 * @throws AppError 400 if the body is not JSON or does not contain a string csv field
 */
export function readImportBody(body: unknown): string {
  if (!body || typeof body !== 'object') {
    throw new AppError(400, 'The request body must be JSON with a csv property.');
  }
  const csv = (body as Record<string, unknown>).csv;
  if (csv === undefined) {
    throw new AppError(400, 'Missing csv field in request body.');
  }
  if (typeof csv !== 'string') {
    throw new AppError(400, 'The csv field must be text.');
  }
  return csv;
}

