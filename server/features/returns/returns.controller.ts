/**
 * Return controller: unpacks return requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by returns.routes.ts. Calls returns.validation.ts, returns.service.ts, and shared/middleware/requireAuth.ts
 * (sessionUserOf: who is acting).
 * Used by: Staff return finalization, and the return list.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as returnsService from './returns.service';
import { checkReturnInput } from './returns.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/**
 * Handles POST /api/assets/:assetTag/return: finalizes a return.
 * Answers `{ success, return }` with the new row, or the AppError's status and message
 * (400 missing or unknown condition, 404 unknown tag, 409 an asset that is not out), or 500.
 */
export async function finalizeReturn(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;
    const data = req.body;
    // Printed before the checks, so a refused request still shows in the server terminal.
    console.log(`🚀 Server received return finalization for ${assetTag}:`, data);

    checkReturnInput(data);
    const ret = await returnsService.finalizeReturn(assetTag, data, sessionUserOf(req).userId);

    console.log("✅ Return finalized in MySQL successfully:", ret.return_id, assetTag);
    res.json({ success: true, return: ret });
}

/**
 * Handles GET /api/asset_returns: every finalized return, newest first, as `{ success, returns }`.
 * A failure answers errorHandler's generic 500.
 */
export async function listReturns(req: Request, res: Response): Promise<void> {
    const returns = await returnsService.listReturns();
    res.json({ success: true, returns });
}
