/**
 * The inspection inside a request body (InspectionInput): its condition, health score, missing accessories,
 * remarks, and photo, checked the same way for every step that files one.
 * Layer: shared (server validation). Called by features/assets/assets.validation.ts (the Initial inspection).
 * Calls shared/validation/fields.ts, shared/errors/AppError.ts, and @shared/enums/assetCondition.
 * Used by: asset registration.
 */
import type { InspectionInput } from '@shared/types/assets';
import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import { AppError } from '../errors/AppError';
import { readText } from './fields';

/**
 * Checks one inspection inside a body: a known condition, and an optional health score from 0 to 100.
 *
 * @param value the body's inspection object
 * @param field its name, for the message
 * @throws AppError 400 if it is missing or a value is wrong
 */
export function readInspectionInput(value: unknown, field: string): InspectionInput {
    if (!value || typeof value !== 'object') throw new AppError(400, `Missing required field: ${field}.`);
    const body = value as Record<string, unknown>;
    if (typeof body.condition !== 'string' || !ASSET_CONDITIONS.includes(body.condition)) {
        throw new AppError(400, `Pick the condition of the ${field} from the list.`);
    }
    const score = body.healthScore;
    if (score !== undefined && score !== null && (!Number.isInteger(score) || (score as number) < 0 || (score as number) > 100)) {
        throw new AppError(400, "healthScore must be a whole number from 0 to 100.");
    }
    return {
        condition: body.condition,
        healthScore: (score as number | null | undefined) ?? null,
        missingAccessories: readText(body, "missingAccessories", 255) ?? null,
        remarks: readText(body, "remarks", 255) ?? null,
        photo: typeof body.photo === 'string' && body.photo ? body.photo : null,
    };
}
