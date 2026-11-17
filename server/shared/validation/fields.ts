/**
 * Body field readers: an id, a text, a date, and a password, each checked and normalized the same way on every route.
 * Layer: shared (server validation). Called by the validation files of features/assets, features/loans, features/auth, and
 * features/users, and by shared/validation/inspectionInput.ts. Calls shared/errors/AppError.ts and shared/constants/passwords.ts.
 * Used by: asset registration and editing, the loan steps, every inspection inside a body, sign-up, and password changes.
 */
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@shared/constants/passwords';
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

/**
 * Reads a new password: must be a string between MIN_PASSWORD_LENGTH and MAX_PASSWORD_LENGTH characters.
 *
 * @param value the raw password input
 * @returns the validated plain password string
 * @throws AppError 400 when the password is not a string or its length is out of bounds
 */
export function readNewPassword(value: unknown): string {
    if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
        throw new AppError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    }
    if (value.length > MAX_PASSWORD_LENGTH) {
        throw new AppError(400, `Password must be at most ${MAX_PASSWORD_LENGTH} characters long.`);
    }
    return value;
}
