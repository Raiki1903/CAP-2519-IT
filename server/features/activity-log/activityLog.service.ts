/**
 * Activity log service: the IT Admin's read of the log, one page at a time, in the contract's ActivityEntry shape.
 * Layer: service. Called by activityLog.controller.ts. Calls activityLog.repository.ts; labels from @shared.
 * Used by: the IT Admin's Activity Log page.
 */
import { ACTIVITY_EVENT_LABELS } from '@shared/constants/activityEvents';
import type { ActivityEntry, ActivityLogFilters, ActivityLogPage } from '@shared/types/activityLog';
import * as activityLogRepository from './activityLog.repository';
import type { EntryRow } from './activityLog.repository';

/** How many rows one page holds. */
export const ACTIVITY_LOG_PAGE_SIZE = 50;

type NamedRow = { user_id: number; first_name: string; last_name: string } | null;

const personOf = (person: NamedRow) => (person ? { userId: person.user_id, name: `${person.first_name} ${person.last_name}` } : null);

/** A log row in the contract's ActivityEntry shape. */
function toEntry(row: EntryRow): ActivityEntry {
    return {
        logId: row.log_id,
        eventType: row.event_type,
        eventLabel: ACTIVITY_EVENT_LABELS[row.event_type],
        actor: personOf(row.actor),
        targetUser: personOf(row.target_user),
        asset: row.assets ? { assetId: row.assets.asset_id, tag: row.assets.asset_tag } : null,
        details: row.details,
        createdAt: row.created_at.toISOString(),
    };
}

/** Midnight at the start of a yyyy-mm-dd day in the server's local time, plus `days` whole days. */
function localMidnight(day: string, days = 0): Date {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date + days);
}

/**
 * One page of the log, newest first. `from` and `to` are whole days in the server's local time, both included, so
 * a row counts on the day serverToday() gives for its time. A page past the last one is empty.
 *
 * @param filters the filters and the page
 * @returns the page's rows, the page, and how many pages there are (at least 1)
 */
export async function listActivity(filters: ActivityLogFilters): Promise<ActivityLogPage> {
    const { rows, total } = await activityLogRepository.findEntryPage(
        {
            eventType: filters.eventType,
            actorId: filters.actorId,
            targetUserId: filters.targetUserId,
            assetTag: filters.assetTag,
            createdFrom: filters.from ? localMidnight(filters.from) : undefined,
            createdBefore: filters.to ? localMidnight(filters.to, 1) : undefined,
        },
        (filters.page - 1) * ACTIVITY_LOG_PAGE_SIZE,
        ACTIVITY_LOG_PAGE_SIZE,
    );
    return {
        entries: rows.map(toEntry),
        page: filters.page,
        pageCount: Math.max(1, Math.ceil(total / ACTIVITY_LOG_PAGE_SIZE)),
    };
}
