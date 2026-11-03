/**
 * Asset request checks: the list's filters, the shape of a registration and of a master data edit, and whether a
 * picture is an image.
 * Layer: validation. Called by assets.controller.ts (the filters and the two bodies) and assets.service.ts (the image
 * check). Calls shared/errors/AppError.ts and @shared (statuses, categories, and conditions).
 * Used by: every role's asset list and search, Staff registration, and Edit Asset (TSG and the Secretary).
 */
import type { AssetCreateInput, AssetListFilters, AssetMasterData, AssetUpdateInput, InspectionInput } from '@shared/types/assets';
import { ASSET_STATUSES } from '@shared/enums/assetStatus';
import { ASSET_CATEGORIES } from '@shared/enums/assetCategory';
import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import { AppError } from '../../shared/errors/AppError';

/** The 400 message when an edit sends a field that is worked out or changed by its own step. */
export const NOT_MASTER_DATA_MESSAGE = "Edit Asset changes master data only. Status, holder, location, and condition change through their own steps.";

/** Body fields an edit refuses: the worked-out values and their older names. */
const REFUSED_EDIT_FIELDS = ["status", "holder", "custodian", "custodianId", "location", "currentLocation", "condition", "assetCondition", "reportCondition"];

/** Reads a whole number id, or null when it is null; undefined when not sent. */
function readId(body: Record<string, unknown>, field: string): number | null | undefined {
    const value = body[field];
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (!Number.isInteger(value) || (value as number) < 1) {
        throw new AppError(400, `${field} must be an id.`);
    }
    return value as number;
}

/** Reads a text field: trimmed, empty as null; undefined when not sent. */
function readText(body: Record<string, unknown>, field: string, maxLength: number): string | null | undefined {
    const value = body[field];
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') throw new AppError(400, `${field} must be text.`);
    const text = value.trim();
    if (text.length > maxLength) throw new AppError(400, `${field} can be at most ${maxLength} characters.`);
    return text === "" ? null : text;
}

/** Reads a yyyy-mm-dd date, or null; undefined when not sent. */
function readDate(body: Record<string, unknown>, field: string): string | null | undefined {
    const value = body[field];
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(new Date(value).getTime())) {
        throw new AppError(400, `${field} must be a date as yyyy-mm-dd.`);
    }
    return value;
}

/**
 * The stored category for any spelling ("Dev Kit" becomes DEV_KIT).
 *
 * @throws AppError 400 if it is not a category
 */
function readCategory(value: unknown): string {
    const formatted = String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (!ASSET_CATEGORIES.includes(formatted)) throw new AppError(400, "Pick a category from the list.");
    return formatted;
}

/** Reads the master data fields a body sends. Only the fields sent are in the answer. */
function readMasterData(body: Record<string, unknown>): AssetMasterData {
    const data: AssetMasterData = {};
    if (body.name !== undefined) {
        const name = readText(body, "name", 255);
        if (!name) throw new AppError(400, "The asset needs a name.");
        data.name = name;
    }
    if (body.category !== undefined) data.category = readCategory(body.category);
    const centerId = readId(body, "centerId");
    if (centerId === null) throw new AppError(400, "Pick a home lab from the list.");
    if (centerId !== undefined) data.centerId = centerId;
    const ids = { projectId: readId(body, "projectId"), fundingSourceId: readId(body, "fundingSourceId") };
    if (ids.projectId !== undefined) data.projectId = ids.projectId;
    if (ids.fundingSourceId !== undefined) data.fundingSourceId = ids.fundingSourceId;
    const texts: [keyof AssetMasterData, number][] = [
        ["serialNumber", 255], ["manufacturer", 255], ["homeRoom", 100], ["accessories", 500], ["itsPropertyTag", 100], ["tsgTag", 100],
    ];
    for (const [field, max] of texts) {
        const text = readText(body, field, max);
        if (text !== undefined) (data as Record<string, unknown>)[field] = text;
    }
    for (const field of ["procurementDate", "warrantyExpiry"] as const) {
        const date = readDate(body, field);
        if (date !== undefined) data[field] = date;
    }
    if (body.acquisitionValue !== undefined) {
        const value = body.acquisitionValue;
        if (value !== null && (typeof value !== 'number' || !isFinite(value) || value < 0 || value >= 1e8)) {
            throw new AppError(400, "acquisitionValue must be a number from 0 up to 99,999,999.99.");
        }
        data.acquisitionValue = value as number | null;
    }
    if (body.imageUrl !== undefined) {
        const image = body.imageUrl;
        if (image !== null && typeof image !== 'string') throw new AppError(400, "imageUrl must be text.");
        checkAssetImage(image);
        data.imageUrl = (image as string | null) || null;
    }
    return data;
}

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
 * Reads a registration body: the master data with a name, a category, and a home lab, and the Initial inspection.
 * Whether the lab, project, and funding source exist is the service's check.
 *
 * @param body the request body
 * @throws AppError 400 if a required field is missing or any value is wrong
 */
export function readAssetCreate(body: any): AssetCreateInput {
    if (!body || typeof body !== 'object') throw new AppError(400, "Missing required fields: name, category, centerId.");
    if (!body.name || !body.category || body.centerId === undefined) {
        throw new AppError(400, "Missing required fields: name, category, centerId.");
    }
    const data = readMasterData(body);
    return { ...data, name: data.name!, category: data.category!, centerId: data.centerId!, initialInspection: readInspectionInput(body.initialInspection, "initialInspection") };
}

/**
 * Reads a master data edit. A body with a status, holder, location, or condition is refused: those are worked out or
 * changed by their own steps.
 *
 * @param body the request body
 * @returns only the master data fields sent
 * @throws AppError 400 NOT_MASTER_DATA_MESSAGE for such a body, or 400 for a wrong value
 */
export function readAssetUpdate(body: any): AssetUpdateInput {
    if (!body || typeof body !== 'object') return {};
    if (REFUSED_EDIT_FIELDS.some(field => body[field] !== undefined)) {
        throw new AppError(400, NOT_MASTER_DATA_MESSAGE);
    }
    return readMasterData(body);
}

/**
 * Checks that a picture sent as text is a data URL or a link ending in an image extension.
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
