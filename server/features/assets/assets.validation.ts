import type { AssetCreateInput } from '@shared/types/assets';
import { AppError } from '../../shared/errors/AppError';

/** Checks that a new asset has a name and a category. */
export function checkAssetCreate(data: any): asserts data is AssetCreateInput {
    if (!data.name || !data.category) {
        throw new AppError(400, "Missing required fields: name, category.");
    }
}

/** Checks that an image, when given as text, is a data URL or names an image file. */
export function checkAssetImage(imageVal: any): void {
    if (imageVal && typeof imageVal === 'string' && !/^data:image\//i.test(imageVal) && !/\.(jpg|jpeg|png|webp|svg)$/i.test(imageVal.split('?')[0])) {
        throw new AppError(400, "Security Violation: Asset image must be a valid .jpg or .png file.");
    }
}
