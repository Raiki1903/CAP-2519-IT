import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import type { ReturnInput } from '@shared/types/returns';
import { AppError } from '../../shared/errors/AppError';

export function checkReturnInput(data: any): asserts data is ReturnInput {
    if (!data.condition) {
        throw new AppError(400, "Missing required field: condition.");
    }
    if (!ASSET_CONDITIONS.includes(data.condition)) {
        throw new AppError(400, `Unrecognized condition: ${data.condition}.`);
    }
}
