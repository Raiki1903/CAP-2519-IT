/**
 * Activity log controller: unpacks the IT Admin's log read, calls the service, and writes the JSON answer.
 * Layer: controller. Called by activityLog.routes.ts. Calls activityLog.validation.ts and activityLog.service.ts.
 * Used by: the IT Admin's Activity Log page.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts.
 */
import type { Request, Response } from 'express';
import * as activityLogService from './activityLog.service';
import { readActivityLogQuery } from './activityLog.validation';

/**
 * Handles GET /api/activity-log?eventType=&actorId=&targetUserId=&assetTag=&from=&to=&page=: one page of the log,
 * newest first, as `{ success, entries, page, pageCount }`. Answers 400 for a bad filter or `from` after `to`, or 500.
 */
export async function listActivity(req: Request, res: Response): Promise<void> {
    const filters = readActivityLogQuery(req.query);
    res.json({ success: true, ...(await activityLogService.listActivity(filters)) });
}
