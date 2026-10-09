/**
 * Loan request checks: is the request shaped correctly, before any database work.
 * Layer: validation. Called by loans.controller.ts. Calls shared/errors/AppError.ts.
 * Used by: Custodian borrow request, Lab Head approval.
 */
import type { LoanDecision, LoanRequestInput } from '@shared/types/loans';
import { AppError } from '../../shared/errors/AppError';

/**
 * Checks that a borrow body has a borrower, a purpose, and a due date.
 * Only presence is checked: not that the due date is a date, or in the future.
 *
 * @param data the request body
 * @throws AppError 400 if any of the three is missing or empty
 */
export function checkLoanRequest(data: any): asserts data is LoanRequestInput {
    if (!data.borrower || !data.purpose || !data.dueDate) {
        throw new AppError(400, "Missing required fields: borrower, purpose, dueDate.");
    }
}

/**
 * Checks a decision request: a whole-number loan id and a known decision word.
 * The id is the number, not the "LOAN-n" label the list shows.
 *
 * @param loanId the id from the URL, already parsed (NaN if it was not a number)
 * @param decision the `decision` field of the body
 * @throws AppError 400 if the id is not a whole number, or the decision is not "approve" or "decline"
 */
export function checkLoanDecision(loanId: number, decision: string | undefined): asserts decision is LoanDecision {
    if (!Number.isInteger(loanId)) {
        throw new AppError(400, "Invalid loan id.");
    }
    if (decision !== "approve" && decision !== "decline") {
        throw new AppError(400, "decision must be 'approve' or 'decline'.");
    }
}
