/**
 * Return request checks: is the return body shaped correctly, before any database work.
 * Layer: validation. Called by returns.controller.ts. Calls shared/errors/AppError.ts and @shared/enums/assetCondition.
 * Used by: Staff return finalization.
 */
import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import type { ReturnInput } from '@shared/types/returns';
import { AppError } from '../../shared/errors/AppError';

/**
 * Checks that a return body names a known condition.
 * The condition becomes the asset's condition and is stored on the return, and both columns
 * accept only the five ASSET_CONDITIONS values.
 *
 * @param data the request body
 * @throws AppError 400 if the condition is missing, or is not one of ASSET_CONDITIONS
 */
export function checkReturnInput(data: any): asserts data is ReturnInput {
    if (!data.condition) {
        throw new AppError(400, "Missing required field: condition.");
    }
    if (!ASSET_CONDITIONS.includes(data.condition)) {
        throw new AppError(400, `Unrecognized condition: ${data.condition}.`);
    }
}
