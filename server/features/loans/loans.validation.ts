import type { LoanDecision, LoanRequestInput } from '@shared/types/loans';
import { AppError } from '../../shared/errors/AppError';

export function checkLoanRequest(data: any): asserts data is LoanRequestInput {
    if (!data.borrower || !data.purpose || !data.dueDate) {
        throw new AppError(400, "Missing required fields: borrower, purpose, dueDate.");
    }
}

export function checkLoanDecision(loanId: number, decision: string | undefined): asserts decision is LoanDecision {
    if (!Number.isInteger(loanId)) {
        throw new AppError(400, "Invalid loan id.");
    }
    if (decision !== "approve" && decision !== "decline") {
        throw new AppError(400, "decision must be 'approve' or 'decline'.");
    }
}
