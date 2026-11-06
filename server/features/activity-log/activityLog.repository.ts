/**
 * Activity log row access: one page of activity_log rows that pass the filters, newest first, and how many pass.
 * Layer: repository. Called by activityLog.service.ts. Calls config/prisma.ts.
 * Used by: the IT Admin's Activity Log page. The rows are written by shared/services/activityLog.ts.
 */
import type { Prisma, activity_log_event_type } from '@prisma/client';
import { prisma } from '../../config/prisma';

/** What a log read includes: the people by name and the asset by tag. Never an email. */
const ENTRY_SELECT = {
    log_id: true,
    event_type: true,
    details: true,
    created_at: true,
    actor: { select: { user_id: true, first_name: true, last_name: true } },
    target_user: { select: { user_id: true, first_name: true, last_name: true } },
    assets: { select: { asset_id: true, asset_tag: true } },
} satisfies Prisma.activity_logSelect;

/** One log row with its people and asset. */
export type EntryRow = Prisma.activity_logGetPayload<{ select: typeof ENTRY_SELECT }>;

/** The filters as the database compares them: the days already turned into times. */
export interface EntryWhere {
    eventType?: activity_log_event_type;
    actorId?: number;
    targetUserId?: number;
    assetTag?: string;
    /** Rows at or after this time. */
    createdFrom?: Date;
    /** Rows before this time. */
    createdBefore?: Date;
}

/**
 * One page of the rows that pass the filters, newest first (ties by log id, newest first), and how many rows pass in
 * all. Both are read in one transaction, so the count matches the page.
 *
 * @param filters the filters
 * @param skip how many rows come before the page
 * @param take the page size
 */
export async function findEntryPage(filters: EntryWhere, skip: number, take: number): Promise<{ rows: EntryRow[]; total: number }> {
    const where: Prisma.activity_logWhereInput = {
        event_type: filters.eventType,
        actor_id: filters.actorId,
        target_user_id: filters.targetUserId,
        ...(filters.assetTag !== undefined ? { assets: { is: { asset_tag: filters.assetTag } } } : {}),
        ...(filters.createdFrom || filters.createdBefore ? { created_at: { gte: filters.createdFrom, lt: filters.createdBefore } } : {}),
    };
    const [rows, total] = await prisma.$transaction([
        prisma.activity_log.findMany({ where, select: ENTRY_SELECT, orderBy: [{ created_at: 'desc' }, { log_id: 'desc' }], skip, take }),
        prisma.activity_log.count({ where }),
    ]);
    return { rows, total };
}
