/**
 * Notification route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls notifications.controller.ts.
 * Used by: the notification bell (NotificationCenter).
 */
import express from 'express';
import * as notificationsController from './notifications.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive } from '../../shared/middleware/permissions';

/** The notification endpoint. Paths are written out in full, so app.ts mounts the router at the root. */
export const notificationsRouter = express.Router();

// Any Active account: each person gets only the kinds that apply to them, matched by user id in the service.
notificationsRouter.get('/api/notifications/mine', requireAuth, requireActive, notificationsController.listMyNotifications);
