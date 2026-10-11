/**
 * Asset request checks: is a new asset shaped correctly, and is a picture an image.
 * Layer: validation. Called by assets.controller.ts (the create check) and assets.service.ts (the image check). Calls shared/errors/AppError.ts.
 * Used by: Staff asset registration and editing.
 */
import type { AssetCreateInput } from '@shared/types/assets';
import { AppError } from '../../shared/errors/AppError';

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
