/**
 * Repair request checks: is the request shaped correctly, before any database work.
 * Layer: validation. Called by repairs.controller.ts. Calls shared/errors/AppError.ts.
 * Used by: Custodian repair request, Staff progress updates (repair dialog and analytics board).
 */
import type { RepairRequestInput, RepairStatusInput, RepairUpdateInput } from '@shared/types/repairs';
import { AppError } from '../../shared/errors/AppError';

/**
 * Checks that a repair request has a description that is not only spaces.
 *
 * @param data the request body
 * @throws AppError 400 if the description is missing or blank
 */
export function checkRepairRequest(data: any): asserts data is RepairRequestInput {
    if (!data.description || !String(data.description).trim()) {
        throw new AppError(400, "Missing required field: description.");
    }
}

/**
 * Checks a progress update for PUT /api/asset_repairs/:repairId: a whole-number repair id
 * and a progressStatus that is not only spaces. Any other text is accepted as a status. (H-07)
 *
 * @param repairId the id from the URL, already parsed (NaN if it was not a number)
 * @param progressStatus the `progressStatus` field of the body
 * @throws AppError 400 if the id is not a whole number, or the status is missing or blank
 */
export function checkRepairUpdate(repairId: number, progressStatus: string | undefined): asserts progressStatus is RepairUpdateInput['progressStatus'] {
    if (!Number.isInteger(repairId)) {
        throw new AppError(400, "Invalid repair id.");
    }
    if (!progressStatus || !String(progressStatus).trim()) {
        throw new AppError(400, "Missing required field: progressStatus.");
    }
}

/**
 * Checks a status-only update for PUT /api/asset_repairs/:repairId/status: progressStatus is present.
 * The id is not checked here, so a bad or unknown id reaches the database and answers 500.
 *
 * @param progressStatus the `progressStatus` field of the body
 * @throws AppError 400 if it is missing or empty
 */
// TODO(H-06): weaker than checkRepairUpdate: a status of only spaces is saved, and the id is not checked. Kept as is in step 12; merging the two endpoints is its own behavior-change commit.
export function checkRepairStatus(progressStatus: any): asserts progressStatus is RepairStatusInput['progressStatus'] {
    if (!progressStatus) {
        throw new AppError(400, "progressStatus is required.");
    }
}
