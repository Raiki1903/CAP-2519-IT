/**
 * Maintenance request checks: is the request shaped correctly, before any database work.
 * Layer: validation. Called by maintenance.controller.ts. Calls shared/validation/ (the field and inspection readers)
 * and shared/errors/AppError.ts.
 * Used by: reporting an issue, TSG receipt and the maintenance steps, cancelling a ticket, the ticket list's filters.
 */
import type { InspectionInput } from '@shared/types/assets';
import type { MaintenanceReportBody } from '@shared/types/maintenance';
import { MAINTENANCE_STATUSES, MAINTENANCE_TYPES, type MaintenanceStatus, type MaintenanceType } from '@shared/constants/maintenanceStatuses';
import { AppError } from '../../shared/errors/AppError';
import { readId, readText } from '../../shared/validation/fields';
import { readInspectionInput } from '../../shared/validation/inspectionInput';

/** The longest description or remarks text a ticket keeps. The columns are TEXT; this stays well inside them. */
const LONG_TEXT_MAX = 2000;

/** The 400 message when a report names no issue type, or one that does not exist. */
export const PICK_ISSUE_TYPE_MESSAGE = "Pick an issue type from the list.";

/** The body as an object, or an empty one when no JSON body was sent. */
function bodyOf(body: unknown): Record<string, unknown> {
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

/**
 * Reads the ticket id from the URL. The id is the number, not the "MNT-n" label the screens show.
 *
 * @param value the `:maintenanceId` path part
 * @throws AppError 400 if it is not a whole number
 */
export function readMaintenanceId(value: string): number {
    if (!/^\d+$/.test(value)) throw new AppError(400, "Invalid maintenance id.");
    return Number(value);
}

/**
 * Reads a report body. Whether the issue type exists is the service's check. A reporter name in the body is not read:
 * the reporter is the session user.
 *
 * @param body the request body, `{ issueTypeId, issueDescription }`
 * @throws AppError 400 if the issue type or the description is missing, or the description is too long
 */
export function readReportBody(body: unknown): MaintenanceReportBody {
    const data = bodyOf(body);
    const issueTypeId = readId(data, "issueTypeId");
    if (!issueTypeId) throw new AppError(400, PICK_ISSUE_TYPE_MESSAGE);
    const issueDescription = readText(data, "issueDescription", LONG_TEXT_MAX);
    if (!issueDescription) throw new AppError(400, "Describe the issue.");
    return { issueTypeId, issueDescription };
}

/**
 * Reads a receive body: the Maintenance inspection TSG files when the asset arrives.
 *
 * @param body the request body, `{ inspection }`
 * @throws AppError 400 if the inspection is missing or a value is wrong
 */
export function readReceiveBody(body: unknown): InspectionInput {
    return readInspectionInput(bodyOf(body).inspection, "inspection");
}

/**
 * Reads a cancel body: the optional remarks, trimmed.
 *
 * @param body the request body, `{ remarks? }`
 * @returns the remarks, or null when none were written
 * @throws AppError 400 if they are not text or too long
 */
export function readCancelBody(body: unknown): string | null {
    return readText(bodyOf(body), "remarks", LONG_TEXT_MAX) ?? null;
}

/**
 * Reads a filter of the ticket list: one or more values separated by commas, each one of the allowed values.
 *
 * @returns the values, each once, or null when no filter was sent
 * @throws AppError 400 for an empty filter or an unknown value
 */
function readFilter<T extends string>(value: unknown, field: string, allowed: readonly T[]): T[] | null {
    if (value === undefined) return null;
    if (typeof value !== 'string') throw new AppError(400, `${field} must be one or more values separated by commas.`);
    const values = [...new Set(value.split(',').map(v => v.trim()).filter(Boolean))];
    if (values.length === 0) throw new AppError(400, `Pick at least one ${field}.`);
    const unknown = values.find(v => !(allowed as readonly string[]).includes(v));
    if (unknown) throw new AppError(400, `Unknown maintenance ${field}: ${unknown}.`);
    return values as T[];
}

/** The ticket list's optional filters. */
export interface MaintenanceListFilters {
    statuses: MaintenanceStatus[] | null;
    types: MaintenanceType[] | null;
}

/**
 * Reads `?status=` and `?type=` of GET /api/maintenance.
 *
 * @param query the request's query
 * @throws AppError 400 for an unknown status or type
 */
export function readListFilters(query: Record<string, unknown>): MaintenanceListFilters {
    return {
        statuses: readFilter(query.status, "status", MAINTENANCE_STATUSES),
        types: readFilter(query.type, "type", MAINTENANCE_TYPES),
    };
}
