/**
 * Activity log route table: the IT Admin's read of the log.
 * Layer: routes. Mounted by server/app.ts. Calls activityLog.controller.ts.
 * Used by: the IT Admin's Activity Log page.
 */
import express from 'express';
import * as activityLogController from './activityLog.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireItAdmin } from '../../shared/middleware/permissions';

/** The activity log endpoint. The path is written out in full, so app.ts mounts the router at the root. */
export const activityLogRouter = express.Router();

// The IT Admin only, with an Active account. Every other role gets 403. The log is read only: nothing edits it.
activityLogRouter.get('/api/activity-log', requireAuth, requireActive, requireItAdmin, activityLogController.listActivity);
