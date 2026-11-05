/**
 * Body field readers: an id, a text, and a date, each checked and normalized the same way on every route.
 * Layer: shared (server validation). Called by the validation files of features/assets and features/loans, and by
 * shared/validation/inspectionInput.ts. Calls shared/errors/AppError.ts.
 * Used by: asset registration and editing, the loan steps, and every inspection inside a body.
 */
import { AppError } from '../errors/AppError';

/** Reads a whole number id, or null when it is null; undefined when not sent. */
export function readId(body: Record<string, unknown>, field: string): number | null | undefined {
    const value = body[field];
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (!Number.isInteger(value) || (value as number) < 1) {
        throw new AppError(400, `${field} must be an id.`);
    }
    return value as number;
}

/** Reads a text field: trimmed, empty as null; undefined when not sent. */
export function readText(body: Record<string, unknown>, field: string, maxLength: number): string | null | undefined {
    const value = body[field];
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') throw new AppError(400, `${field} must be text.`);
    const text = value.trim();
    if (text.length > maxLength) throw new AppError(400, `${field} can be at most ${maxLength} characters.`);
    return text === "" ? null : text;
}

/** Reads a yyyy-mm-dd date, or null; undefined when not sent. */
export function readDate(body: Record<string, unknown>, field: string): string | null | undefined {
    const value = body[field];
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(new Date(value).getTime())) {
        throw new AppError(400, `${field} must be a date as yyyy-mm-dd.`);
    }
    return value;
}
