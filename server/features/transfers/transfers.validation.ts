/**
 * Transfer request checks: is the request shaped correctly, before any database work.
 * Layer: validation. Called by transfers.controller.ts. Calls shared/errors/AppError.ts.
 * Used by: Custodian transfer request, Lab Head approval.
 */
import type { TransferDecision, TransferRequestInput } from '@shared/types/transfers';
import { AppError } from '../../shared/errors/AppError';

/**
 * Checks that a transfer body has a recipient email and a reason.
 * Only presence is checked; the service looks the email up.
 *
 * @param data the request body
 * @throws AppError 400 if either is missing or empty
 */
export function checkTransferRequest(data: any): asserts data is TransferRequestInput {
    if (!data.toEmail || !data.reason) {
        throw new AppError(400, "Missing required fields: toEmail, reason.");
    }
}

/**
 * Checks a decision request: a whole-number transfer id and a known decision word.
 * The id is the number, not the "TRF-n" label the list shows.
 *
 * @param transferId the id from the URL, already parsed (NaN if it was not a number)
 * @param decision the `decision` field of the body
 * @throws AppError 400 if the id is not a whole number, or the decision is not "approve" or "decline"
 */
export function checkTransferDecision(transferId: number, decision: string | undefined): asserts decision is TransferDecision {
    if (!Number.isInteger(transferId)) {
        throw new AppError(400, "Invalid transfer id.");
    }
    if (decision !== "approve" && decision !== "decline") {
        throw new AppError(400, "decision must be 'approve' or 'decline'.");
    }
}
