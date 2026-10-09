/**
 * Return controller: unpacks return requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by returns.routes.ts. Calls returns.validation.ts and returns.service.ts.
 * Used by: Staff return finalization, and the return list.
 */
import type { Request, Response } from 'express';
import * as returnsService from './returns.service';
import { checkReturnInput } from './returns.validation';
import { AppError } from '../../shared/errors/AppError';

/**
 * Handles POST /api/assets/:assetTag/return: finalizes a return.
 * Answers `{ success, return }` with the new row, or the AppError's status and message
 * (400 missing or unknown condition, 404 unknown tag), or 500.
 */
// TODO(H-16): the 500 answers here and below send the database's own error text to the browser. errorHandler, step 13.
export async function finalizeReturn(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        // Printed before the checks, so a refused request still shows in the server terminal.
        console.log(`🚀 Server received return finalization for ${assetTag}:`, data);

        checkReturnInput(data);
        const ret = await returnsService.finalizeReturn(assetTag, data);

        console.log("✅ Return finalized in MySQL successfully:", ret.return_id, assetTag);
        res.json({ success: true, return: ret });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ MySQL Return Insertion Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

/**
 * Handles GET /api/asset_returns: every finalized return, newest first, as `{ success, returns }`.
 * A failure answers 500 with the raw error message.
 */
export async function listReturns(req: Request, res: Response): Promise<void> {
    try {
        const returns = await returnsService.listReturns();
        res.json({ success: true, returns });
    } catch (error: any) {
        console.error("❌ Failed to fetch returns:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}
