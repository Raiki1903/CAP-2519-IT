/**
 * Disposal request checks: is the request shaped correctly, before any database work.
 * Layer: validation. Called by disposals.controller.ts. Calls shared/errors/AppError.ts.
 * Used by: Staff disposal filing, Director approval.
 */
import type { DisposalDecision, DisposalRequestInput } from '@shared/types/disposals';
import { AppError } from '../../shared/errors/AppError';

/**
 * Checks that a disposal body has a breakdown justification and a pathway.
 * Only presence is checked; the pathway is free text.
 *
 * @param data the request body
 * @throws AppError 400 if either is missing or empty
 */
export function checkDisposalRequest(data: any): asserts data is DisposalRequestInput {
    if (!data.breakdownReasons || !data.disposalPathway) {
        throw new AppError(400, "Missing required fields: breakdownReasons, disposalPathway.");
    }
}

/**
 * Checks a decision request: a whole-number disposal id and a known decision word.
 * The id is the number, not the "DISP-n" label the list shows.
 *
 * @param disposalId the id from the URL, already parsed (NaN if it was not a number)
 * @param decision the `decision` field of the body
 * @throws AppError 400 if the id is not a whole number, or the decision is not "approve" or "reject"
 */
export function checkDisposalDecision(disposalId: number, decision: string | undefined): asserts decision is DisposalDecision {
    if (!Number.isInteger(disposalId)) {
        throw new AppError(400, "Invalid disposal id.");
    }
    if (decision !== "approve" && decision !== "reject") {
        throw new AppError(400, "decision must be 'approve' or 'reject'.");
    }
}
