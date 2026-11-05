/**
 * Notifications controller: calls the service and writes the JSON answer.
 * Layer: controller. Called by notifications.routes.ts. Calls notifications.service.ts and
 * shared/middleware/requireAuth.ts (sessionUserOf: who is asking).
 * Used by: the notification bell.
 * Errors are not caught here: any failure falls through to shared/middleware/errorHandler.ts, which answers a generic 500.
 */
import type { Request, Response } from 'express';
import * as notificationsService from './notifications.service';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/**
 * Handles GET /api/notifications/mine: the session user's notifications, worked out from loans on each call, as
 * `{ success, notifications }`. A failure answers errorHandler's generic 500.
 */
export async function listMyNotifications(req: Request, res: Response): Promise<void> {
    const notifications = await notificationsService.myNotifications(sessionUserOf(req));
    res.json({ success: true, notifications });
}
