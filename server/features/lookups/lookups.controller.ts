/**
 * Lookups controller: calls the service and writes the JSON answers. Neither route reads any input.
 * Layer: controller. Called by lookups.routes.ts. Calls lookups.service.ts.
 * Used by: Edit Asset, Register Equipment, the borrow form, and the sign-up page.
 * Errors are not caught here: any failure falls through to shared/middleware/errorHandler.ts, which answers a generic 500
 * and logs the detail on the server.
 */
import type { Request, Response } from 'express';
import * as lookupsService from './lookups.service';

/** Handles GET /api/lookups: `{ success, labs, categories, fundingSources, statuses }`. Open with no session. */
export async function getFormLookups(req: Request, res: Response): Promise<void> {
    const lookups = await lookupsService.formLookups();
    res.json({ success: true, ...lookups });
}

/** Handles GET /api/lookups/users: `{ success, users }`, the Custodian accounts by user id and name. Staff only. */
export async function getCustodianOptions(req: Request, res: Response): Promise<void> {
    const users = await lookupsService.custodianOptions();
    res.json({ success: true, users });
}
