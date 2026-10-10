import type { RepairRequestInput, RepairStatusInput, RepairUpdateInput } from '@shared/types/repairs';
import { AppError } from '../../shared/errors/AppError';

/** Checks that a repair request has a description that is not blank. */
export function checkRepairRequest(data: any): asserts data is RepairRequestInput {
    if (!data.description || !String(data.description).trim()) {
        throw new AppError(400, "Missing required field: description.");
    }
}

/** Checks a progress update: a whole-number repair id and a progressStatus that is not blank. */
export function checkRepairUpdate(repairId: number, progressStatus: string | undefined): asserts progressStatus is RepairUpdateInput['progressStatus'] {
    if (!Number.isInteger(repairId)) {
        throw new AppError(400, "Invalid repair id.");
    }
    if (!progressStatus || !String(progressStatus).trim()) {
        throw new AppError(400, "Missing required field: progressStatus.");
    }
}

/** Checks a status-only update: progressStatus is present. */
export function checkRepairStatus(progressStatus: any): asserts progressStatus is RepairStatusInput['progressStatus'] {
    if (!progressStatus) {
        throw new AppError(400, "progressStatus is required.");
    }
}
