/**
 * Lookups controller: calls the service and writes the JSON answer. The route reads no input.
 * Layer: controller. Called by lookups.routes.ts. Calls lookups.service.ts.
 * Used by: Edit Asset, Register Equipment, the borrow form, and the sign-up page.
 * Errors are not caught here: any failure falls through to shared/middleware/errorHandler.ts, which answers a generic 500
 * and logs the detail on the server.
 */
import type { Request, Response } from 'express';
import * as lookupsService from './lookups.service';

/**
 * Handles GET /api/lookups: `{ success, labs, categories, fundingSources, issueTypes, metricsByCategory, projects, statuses }`.
 * Open with no session.
 */
export async function getFormLookups(req: Request, res: Response): Promise<void> {
    const lookups = await lookupsService.formLookups();
    res.json({ success: true, ...lookups });
}
