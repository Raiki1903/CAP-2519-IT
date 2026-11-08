/**
 * Asset remark request checks: the remark's text and the remark id in the URL.
 * Layer: validation. Called by remarks.controller.ts. Calls shared/errors/AppError.ts and @shared (the length limit).
 * Used by: the Remarks section of the asset detail modal.
 */
import { ASSET_REMARK_MAX_LENGTH } from '@shared/constants/assetRemarks';
import { AppError } from '../../shared/errors/AppError';

/**
 * Reads an add-remark body: the text, trimmed.
 *
 * @param body the request body, `{ text }`
 * @returns the trimmed text
 * @throws AppError 400 if the text is missing, not text, empty after trimming, or over ASSET_REMARK_MAX_LENGTH characters
 */
export function readRemarkBody(body: unknown): string {
    const value = body && typeof body === 'object' ? (body as Record<string, unknown>).text : undefined;
    if (value !== undefined && value !== null && typeof value !== 'string') throw new AppError(400, "The remark must be text.");
    const text = typeof value === 'string' ? value.trim() : "";
    if (!text) throw new AppError(400, "Write the remark first.");
    if (text.length > ASSET_REMARK_MAX_LENGTH) throw new AppError(400, `A remark can be at most ${ASSET_REMARK_MAX_LENGTH} characters.`);
    return text;
}

/**
 * Reads the remark id in the URL.
 *
 * @param value the :remarkId parameter
 * @returns the id
 * @throws AppError 400 if it is not a positive whole number
 */
export function readRemarkId(value: string): number {
    const remarkId = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(remarkId) || remarkId <= 0) {
        throw new AppError(400, "The remark id must be a positive whole number.");
    }
    return remarkId;
}
