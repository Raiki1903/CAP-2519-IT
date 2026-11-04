/**
 * Loan request checks: is the request shaped correctly, before any database work.
 * Layer: validation. Called by loans.controller.ts. Calls shared/validation/fields.ts and shared/errors/AppError.ts.
 * Used by: Researcher loan requests, Lab Head approval, and the loan steps that take a loan id.
 */
import type { LoanRequestBody } from '@shared/types/loans';
import { AppError } from '../../shared/errors/AppError';
import { readDate, readId, readText } from '../../shared/validation/fields';

/** The longest purpose or remarks text a loan keeps. The columns are TEXT; this stays well inside them. */
const LONG_TEXT_MAX = 2000;

/** The 400 message when a request names no lab of the borrower's. */
export const PICK_OWN_LAB_MESSAGE = "Pick one of your own labs.";

/** The body as an object, or an empty one when no JSON body was sent. */
function bodyOf(body: unknown): Record<string, unknown> {
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

/**
 * Reads the loan id from the URL. The id is the number, not the "LOAN-n" label the old list shows.
 *
 * @param value the `:loanId` path part
 * @throws AppError 400 if it is not a whole number
 */
export function readLoanId(value: string): number {
    if (!/^\d+$/.test(value)) throw new AppError(400, "Invalid loan id.");
    return Number(value);
}

/**
 * Reads a loan request body. Whether the lab is the borrower's, the project exists, and the date is not past are
 * the service's checks. A borrower id or name in the body is not read: the borrower is the session user.
 *
 * @param body the request body
 * @returns the destination lab, room, project, return-by date, and the trimmed purpose
 * @throws AppError 400 if a field is missing or has a wrong value
 */
export function readLoanRequest(body: unknown): LoanRequestBody {
    const data = bodyOf(body);
    const destinationCenterId = readId(data, "destinationCenterId");
    if (!destinationCenterId) throw new AppError(400, PICK_OWN_LAB_MESSAGE);
    const returnBy = readDate(data, "returnBy");
    if (!returnBy) throw new AppError(400, "Pick a return-by date.");
    const purpose = readText(data, "purpose", LONG_TEXT_MAX);
    if (!purpose) throw new AppError(400, "Write the purpose of the loan.");
    return {
        destinationCenterId,
        destinationRoom: readText(data, "destinationRoom", 100) ?? null,
        projectId: readId(data, "projectId") ?? null,
        returnBy,
        purpose,
    };
}

/**
 * Reads the Lab Head's remarks on an approval or a decline, trimmed.
 *
 * @param body the request body
 * @param required true for a decline, which must say why
 * @returns the remarks, or null when none were written
 * @throws AppError 400 if they are required and empty, or too long
 */
export function readDecisionRemarks(body: unknown, required: boolean): string | null {
    const remarks = readText(bodyOf(body), "decisionRemarks", LONG_TEXT_MAX) ?? null;
    if (required && !remarks) throw new AppError(400, "Write the reason for declining.");
    return remarks;
}
