/**
 * Loan request checks: is the request shaped correctly, before any database work.
 * Layer: validation. Called by loans.controller.ts. Calls shared/validation/ (the field and inspection readers) and
 * shared/errors/AppError.ts.
 * Used by: Researcher loan requests and return requests, Lab Head approval, TSG release and receipt, and the loan steps
 * that take a loan id.
 */
import type { InspectionInput } from '@shared/types/assets';
import type { LoanRequestBody } from '@shared/types/loans';
import { AppError } from '../../shared/errors/AppError';
import { readDate, readId, readText } from '../../shared/validation/fields';
import { readInspectionInput } from '../../shared/validation/inspectionInput';

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

/**
 * Reads a release body: the Loan Release inspection TSG files when the borrower collects the asset.
 *
 * @param body the request body, `{ inspection }`
 * @throws AppError 400 if the inspection is missing or a value is wrong
 */
export function readReleaseBody(body: unknown): InspectionInput {
    return readInspectionInput(bodyOf(body).inspection, "inspection");
}

/** The longest remark a borrower writes when asking to return. */
const RETURN_REMARKS_MAX = 255;

/**
 * Reads a return request body: the borrower's optional remarks, trimmed.
 *
 * @param body the request body, `{ remarks? }`
 * @returns the remarks, or null when none were written
 * @throws AppError 400 if they are not text or are longer than 255 characters
 */
export function readReturnRequest(body: unknown): string | null {
    const value = bodyOf(body).remarks;
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') throw new AppError(400, "remarks must be text.");
    const remarks = value.trim();
    if (remarks.length > RETURN_REMARKS_MAX) throw new AppError(400, `Remarks must be at most ${RETURN_REMARKS_MAX} characters.`);
    return remarks || null;
}

/** Damage TSG found on a return, which opens a Return Damage maintenance ticket. */
export interface ReturnDamage {
    issueTypeId: number;
    issueDescription: string;
}

/**
 * Reads a receive body: the Return inspection and, when TSG found damage, the ticket's issue type and description.
 * Whether the issue type exists is the service's check.
 *
 * @param body the request body, `{ inspection, returnDamage? }`
 * @returns the inspection, and the damage or null
 * @throws AppError 400 if the inspection is missing or wrong, or the damage has no issue type or no description
 */
export function readReceiveBody(body: unknown): { inspection: InspectionInput; returnDamage: ReturnDamage | null } {
    const data = bodyOf(body);
    const inspection = readInspectionInput(data.inspection, "inspection");
    if (data.returnDamage === undefined || data.returnDamage === null) return { inspection, returnDamage: null };
    if (typeof data.returnDamage !== 'object') throw new AppError(400, "returnDamage must be { issueTypeId, issueDescription }.");
    const damage = data.returnDamage as Record<string, unknown>;
    const issueTypeId = readId(damage, "issueTypeId");
    if (!issueTypeId) throw new AppError(400, "Pick an issue type from the list.");
    const issueDescription = readText(damage, "issueDescription", LONG_TEXT_MAX);
    if (!issueDescription) throw new AppError(400, "Describe the damage.");
    return { inspection, returnDamage: { issueTypeId, issueDescription } };
}
