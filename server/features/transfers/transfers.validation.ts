import type { TransferDecision, TransferRequestInput } from '@shared/types/transfers';
import { AppError } from '../../shared/errors/AppError';

export function checkTransferRequest(data: any): asserts data is TransferRequestInput {
    if (!data.toEmail || !data.reason) {
        throw new AppError(400, "Missing required fields: toEmail, reason.");
    }
}

export function checkTransferDecision(transferId: number, decision: string | undefined): asserts decision is TransferDecision {
    if (!Number.isInteger(transferId)) {
        throw new AppError(400, "Invalid transfer id.");
    }
    if (decision !== "approve" && decision !== "decline") {
        throw new AppError(400, "decision must be 'approve' or 'decline'.");
    }
}
