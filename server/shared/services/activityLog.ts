/**
 * The activity log writer: one activity_log row per step that has no table of its own, and per account event.
 * Layer: shared service (runs inside the caller's transaction). Called by the repositories of features/assets
 * (registered, edited, deleted) and, from later batches, auth and the users page. Calls Prisma through the transaction it is given.
 * Used by: asset registration, edits and deletion; later missing, found, sign-ups, role and lab changes, and tickets.
 */
import type { Prisma, activity_log_event_type } from '@prisma/client';

/** One event to log. Never an email, a typed login name, or a password. */
export interface ActivityEvent {
    eventType: activity_log_event_type;
    /** The session user who acted, or null when nobody did (a failed login of an unknown account). */
    actorId: number | null;
    /** The account the event is about, when it is about one. */
    targetUserId?: number | null;
    /** The asset the event is about, when it is about one. */
    assetId?: number | null;
    /** Short facts, for example the changed field names of an ASSET_EDITED row. Cut to the column's 255 characters. */
    details?: string | null;
}

/**
 * Writes one activity_log row inside the caller's transaction, so the log row exists exactly when the step does.
 *
 * @param tx the caller's transaction
 * @param event what happened, who did it, and what it was about
 */
export async function logActivity(tx: Prisma.TransactionClient, event: ActivityEvent): Promise<void> {
    await tx.activity_log.create({
        data: {
            event_type: event.eventType,
            actor_id: event.actorId,
            target_user_id: event.targetUserId ?? null,
            asset_id: event.assetId ?? null,
            details: event.details ? event.details.slice(0, 255) : null,
        },
    });
}
