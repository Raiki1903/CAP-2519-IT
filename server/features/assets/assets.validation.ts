/**
 * Asset request checks: the list's filters, is a new asset shaped correctly, is an edit's custodian an id, and is a picture an image.
 * Layer: validation. Called by assets.controller.ts (the filters, create, and edit checks) and assets.service.ts (the image check).
 * Calls shared/errors/AppError.ts and @shared/enums/assetStatus.
 * Used by: every role's asset list and search, Staff asset registration and editing.
 */
import type { AssetCreateInput, AssetListFilters, AssetUpdateInput } from '@shared/types/assets';
import { ASSET_STATUSES } from '@shared/enums/assetStatus';
import { AppError } from '../../shared/errors/AppError';

/** The answer when an edit names a custodian the dropdown does not offer. */
export const UNKNOWN_CUSTODIAN = "Pick a custodian from the list.";

/**
 * Reads the asset list's filters from the query string. Empty values are left out.
 *
 * @param query the request's query string
 * @returns `q` (trimmed), `status`, and `centerId`, each only when sent
 * @throws AppError 400 if the status is not one of the six, or the centerId is not a whole number
 */
export function readAssetListFilters(query: Record<string, unknown>): AssetListFilters {
    const filters: AssetListFilters = {};
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    if (q) filters.q = q;
    const status = typeof query.status === 'string' ? query.status.trim() : '';
    if (status) {
        if (!(ASSET_STATUSES as readonly string[]).includes(status)) {
            throw new AppError(400, `Unknown asset status: ${status}.`);
        }
        filters.status = status;
    }
    const centerId = typeof query.centerId === 'string' ? query.centerId.trim() : '';
    if (centerId) {
        if (!/^\d+$/.test(centerId)) {
            throw new AppError(400, "centerId must be a lab id.");
        }
        filters.centerId = Number(centerId);
    }
    return filters;
}

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
