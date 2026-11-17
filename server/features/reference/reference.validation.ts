/**
 * Reference data validation: reads and checks the bodies and URL ids of the Reference Data routes.
 * Layer: validation. Called by reference.controller.ts. Calls shared/errors/AppError.ts and @shared (the campuses).
 * Used by: the Reference Data page (TSG and the Secretary).
 * Whether a label, short code, or name is taken, and whether a row exists, are the service's checks.
 */
import { AppError } from '../../shared/errors/AppError';
import { CAMPUSES, type Campus } from '@shared/constants/campuses';
import type {
    CategoryCreateInput,
    CategoryUpdateInput,
    FundingSourceInput,
    LabCreateInput,
    LabUpdateInput,
} from '@shared/types/reference';

/** The longest useful life a category may have, in years. */
export const MAX_USEFUL_LIFE_YEARS = 50;

type Body = Record<string, unknown>;

/** The body as an object; a missing body reads as empty. */
function bodyOf(value: unknown): Body {
    return value !== null && typeof value === 'object' ? value as Body : {};
}

/**
 * A required text: trimmed, 1 to maxLength characters.
 *
 * @param what the field's name in the message, for example "The label"
 * @throws AppError 400 if it is missing, not text, empty, or too long
 */
function requiredText(value: unknown, what: string, maxLength: number): string {
    if (typeof value !== 'string' || value.trim() === "") throw new AppError(400, `${what} is required.`);
    const text = value.trim();
    if (text.length > maxLength) throw new AppError(400, `${what} can be at most ${maxLength} characters.`);
    return text;
}

/**
 * A useful life: a whole number of years from 1 to MAX_USEFUL_LIFE_YEARS.
 *
 * @throws AppError 400 otherwise
 */
function usefulLifeOf(value: unknown): number {
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_USEFUL_LIFE_YEARS) {
        throw new AppError(400, `The useful life must be a whole number of years from 1 to ${MAX_USEFUL_LIFE_YEARS}.`);
    }
    return value as number;
}

/**
 * A campus: one of CAMPUSES.
 *
 * @throws AppError 400 otherwise
 */
function campusOf(value: unknown): Campus {
    if (typeof value !== 'string' || !(CAMPUSES as readonly string[]).includes(value)) {
        throw new AppError(400, "Pick a campus from the list.");
    }
    return value as Campus;
}

/**
 * A whole number id from the URL.
 *
 * @param what the message's noun, for example "lab"
 * @throws AppError 400 if it is not a whole number
 */
function urlId(value: string, what: string): number {
    if (!/^\d+$/.test(value)) throw new AppError(400, `Invalid ${what} id.`);
    return Number(value);
}

/**
 * Reads POST /api/reference/categories. The code is made from the label by the service.
 *
 * @throws AppError 400 for a missing or too long label, or a useful life that is not 1 to 50 whole years
 */
export function readCategoryCreate(value: unknown): CategoryCreateInput {
    const body = bodyOf(value);
    return { label: requiredText(body.label, "The label", 100), usefulLifeYears: usefulLifeOf(body.usefulLifeYears) };
}

/**
 * Reads PUT /api/reference/categories/:code. Only the fields sent change.
 *
 * @throws AppError 400 if the code is sent, nothing is sent, or a value is wrong
 */
export function readCategoryUpdate(value: unknown): CategoryUpdateInput {
    const body = bodyOf(value);
    if (body.code !== undefined) throw new AppError(400, "The code of a category cannot change.");
    const data: CategoryUpdateInput = {};
    if (body.label !== undefined) data.label = requiredText(body.label, "The label", 100);
    if (body.usefulLifeYears !== undefined) data.usefulLifeYears = usefulLifeOf(body.usefulLifeYears);
    if (body.isActive !== undefined) {
        if (typeof body.isActive !== 'boolean') throw new AppError(400, "isActive must be true or false.");
        data.isActive = body.isActive;
    }
    if (Object.keys(data).length === 0) throw new AppError(400, "Send a label, a useful life, or whether it is active.");
    return data;
}

/**
 * Reads POST /api/reference/labs.
 *
 * @throws AppError 400 for a missing or too long name, a short code that is not 2 to 10 letters and digits, or an
 *   unknown campus
 */
export function readLabCreate(value: unknown): LabCreateInput {
    const body = bodyOf(value);
    const name = requiredText(body.name, "The name", 255);
    const shortCode = typeof body.shortCode === 'string' ? body.shortCode.trim() : "";
    if (!/^[A-Za-z0-9]{2,10}$/.test(shortCode)) {
        throw new AppError(400, "The short code must be 2 to 10 letters and digits.");
    }
    return { name, shortCode, campus: campusOf(body.campus) };
}

/**
 * Reads PUT /api/reference/labs/:centerId. Only the fields sent change.
 *
 * @throws AppError 400 if the short code is sent (asset tags start with it), nothing is sent, or a value is wrong
 */
export function readLabUpdate(value: unknown): LabUpdateInput {
    const body = bodyOf(value);
    if (body.shortCode !== undefined) {
        throw new AppError(400, "The short code of a lab cannot change: its asset tags start with it.");
    }
    const data: LabUpdateInput = {};
    if (body.name !== undefined) data.name = requiredText(body.name, "The name", 255);
    if (body.campus !== undefined) data.campus = campusOf(body.campus);
    if (Object.keys(data).length === 0) throw new AppError(400, "Send a name or a campus.");
    return data;
}

/**
 * Reads the body of POST /api/reference/funding-sources and PUT /api/reference/funding-sources/:fundingSourceId.
 *
 * @throws AppError 400 for a missing or too long name
 */
export function readFundingSourceBody(value: unknown): FundingSourceInput {
    return { name: requiredText(bodyOf(value).name, "The name", 100) };
}

/**
 * Reads the lab id from the URL.
 *
 * @throws AppError 400 if it is not a whole number
 */
export function readCenterId(value: string): number {
    return urlId(value, "lab");
}

/**
 * Reads the funding source id from the URL.
 *
 * @throws AppError 400 if it is not a whole number
 */
export function readFundingSourceId(value: string): number {
    return urlId(value, "funding source");
}
