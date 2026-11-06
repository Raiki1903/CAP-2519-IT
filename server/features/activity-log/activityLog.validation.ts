/**
 * Activity log request checks: the filters and the page of GET /api/activity-log.
 * Layer: validation. Called by activityLog.controller.ts. Calls shared/errors/AppError.ts and @shared (event types).
 * Used by: the IT Admin's Activity Log page.
 */
import { ACTIVITY_EVENT_TYPES, type ActivityEventType } from '@shared/constants/activityEvents';
import type { ActivityLogFilters } from '@shared/types/activityLog';
import { AppError } from '../../shared/errors/AppError';

const FILTERS = ['eventType', 'actorId', 'targetUserId', 'assetTag', 'from', 'to', 'page'];

/** The longest asset tag the filter takes, the length of assets.asset_tag. */
const ASSET_TAG_MAX_LENGTH = 50;

function readPositiveId(value: string, message: string): number {
    const id = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0) throw new AppError(400, message);
    return id;
}

/** Reads a yyyy-mm-dd day that exists on the calendar. */
function readDay(value: string, name: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const [year, month, day] = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0];
    const date = new Date(year, month - 1, day);
    if (!match || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        throw new AppError(400, `"${name}" must be a day written yyyy-mm-dd.`);
    }
    return value;
}

/**
 * Reads the filters and the page of GET /api/activity-log. Each is optional and sent once; the page starts at 1.
 *
 * @param query the request's query
 * @returns the filters, with the page
 * @throws AppError 400 for an unknown filter, a filter sent twice, an unknown event type, an id or page that is not a
 * positive whole number, an asset tag longer than 50 characters, a day not written yyyy-mm-dd, or `from` after `to`
 */
export function readActivityLogQuery(query: Record<string, unknown>): ActivityLogFilters {
    for (const [key, value] of Object.entries(query)) {
        if (!FILTERS.includes(key)) {
            throw new AppError(400, `Unknown filter "${key}". Use eventType, actorId, targetUserId, assetTag, from, to, or page.`);
        }
        if (typeof value !== 'string') throw new AppError(400, `Send the filter "${key}" once.`);
    }
    const { eventType, actorId, targetUserId, assetTag, from, to, page } = query as Record<string, string | undefined>;
    const filters: ActivityLogFilters = { page: page === undefined ? 1 : readPositiveId(page, "The page must be a whole number from 1.") };

    if (eventType !== undefined) {
        if (!(ACTIVITY_EVENT_TYPES as readonly string[]).includes(eventType)) throw new AppError(400, "Choose an event type from the list.");
        filters.eventType = eventType as ActivityEventType;
    }
    if (actorId !== undefined) filters.actorId = readPositiveId(actorId, "The actor id must be a positive whole number.");
    if (targetUserId !== undefined) filters.targetUserId = readPositiveId(targetUserId, "The target user id must be a positive whole number.");
    if (assetTag !== undefined && assetTag.trim() !== '') {
        if (assetTag.trim().length > ASSET_TAG_MAX_LENGTH) throw new AppError(400, `The asset tag can be at most ${ASSET_TAG_MAX_LENGTH} characters.`);
        filters.assetTag = assetTag.trim();
    }
    if (from !== undefined) filters.from = readDay(from, 'from');
    if (to !== undefined) filters.to = readDay(to, 'to');
    if (filters.from && filters.to && filters.from > filters.to) {
        throw new AppError(400, "The start day must be on or before the end day.");
    }
    return filters;
}
