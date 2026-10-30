/**
 * Asset request checks: is a new asset shaped correctly, is an edit's custodian an id, and is a picture an image.
 * Layer: validation. Called by assets.controller.ts (the create and edit checks) and assets.service.ts (the image check). Calls shared/errors/AppError.ts.
 * Used by: Staff asset registration and editing.
 */
import type { AssetCreateInput, AssetUpdateInput } from '@shared/types/assets';
import { AppError } from '../../shared/errors/AppError';

/** The answer when an edit names a custodian the dropdown does not offer. */
export const UNKNOWN_CUSTODIAN = "Pick a custodian from the list.";

/**
 * Checks that a new asset has a name and a category. Everything else has a default.
 *
 * @param data the request body
 * @throws AppError 400 if either is missing or empty
 */
export function checkAssetCreate(data: any): asserts data is AssetCreateInput {
    if (!data.name || !data.category) {
        throw new AppError(400, "Missing required fields: name, category.");
    }
}

/**
 * Checks an edit's custodian: when sent, a whole number above zero (a user id) or null (None). Whether the id is a
 * Custodian account is the service's check.
 *
 * @param data the request body
 * @throws AppError 400 if custodianId is sent as anything else
 */
export function checkAssetUpdate(data: any): asserts data is AssetUpdateInput {
    const custodianId = data?.custodianId;
    if (custodianId !== undefined && custodianId !== null && !(Number.isInteger(custodianId) && custodianId > 0)) {
        throw new AppError(400, UNKNOWN_CUSTODIAN);
    }
}

/**
 * Checks that a picture sent as text is a data URL or a link ending in an image extension.
 * Called by the service where the old handlers checked it: for an edit, after the asset and custodian lookups.
 * Anything that is not text (for example a number) passes, and fails later. The message names .jpg and .png only,
 * though .jpeg, .webp, and .svg pass too.
 *
 * @param imageVal the picture value, or null
 * @throws AppError 400 if it is text and neither a data:image URL nor an image file link
 */
export function checkAssetImage(imageVal: any): void {
    if (imageVal && typeof imageVal === 'string' && !/^data:image\//i.test(imageVal) && !/\.(jpg|jpeg|png|webp|svg)$/i.test(imageVal.split('?')[0])) {
        throw new AppError(400, "Security Violation: Asset image must be a valid .jpg or .png file.");
    }
}
