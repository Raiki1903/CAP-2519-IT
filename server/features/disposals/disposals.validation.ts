import type { DisposalDecision, DisposalRequestInput } from '@shared/types/disposals';
import { AppError } from '../../shared/errors/AppError';

export function checkDisposalRequest(data: any): asserts data is DisposalRequestInput {
    if (!data.breakdownReasons || !data.disposalPathway) {
        throw new AppError(400, "Missing required fields: breakdownReasons, disposalPathway.");
    }
}

export function checkDisposalDecision(disposalId: number, decision: string | undefined): asserts decision is DisposalDecision {
    if (!Number.isInteger(disposalId)) {
        throw new AppError(400, "Invalid disposal id.");
    }
    if (decision !== "approve" && decision !== "reject") {
        throw new AppError(400, "decision must be 'approve' or 'reject'.");
    }
}
