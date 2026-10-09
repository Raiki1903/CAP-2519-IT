/**
 * Disposal controller: unpacks disposal requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by disposals.routes.ts. Calls disposals.validation.ts and disposals.service.ts.
 * Used by: Staff disposal filing, Director approval.
 */
import type { Request, Response } from 'express';
import * as disposalsService from './disposals.service';
import { checkDisposalDecision, checkDisposalRequest } from './disposals.validation';
import { AppError } from '../../shared/errors/AppError';

/**
 * Handles POST /api/assets/:assetTag/disposal: files a pending disposal request, then emails the Director.
 * Answers `{ success, disposal }` with the new row, or the AppError's status and message
 * (400 missing field, 404 unknown tag), or 500.
 */
// TODO(H-16): the 500 answers here and below send the database's own error text to the browser. errorHandler, step 13.
export async function requestDisposal(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        // Printed before the checks, so a refused request still shows in the server terminal.
        console.log(`🚀 Server received disposal request for ${assetTag}:`, data);

        checkDisposalRequest(data);
        const { disposal, asset } = await disposalsService.requestDisposal(assetTag, data);

        console.log("✅ Disposal request logged in MySQL successfully:", disposal.disposal_id, assetTag);
        res.json({ success: true, disposal });

        // Sent after the answer and not awaited, so a slow mail service never delays it. sendEmail catches its own send failures.
        disposalsService.notifyDirector(asset, assetTag, data);
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ MySQL Disposal Insertion Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

/**
 * Handles GET /api/asset_disposals: every disposal request, newest first, as `{ success, disposals }`.
 * A failure answers 500 with the raw error message.
 */
export async function listDisposals(req: Request, res: Response): Promise<void> {
    try {
        const disposals = await disposalsService.listDisposals();
        res.json({ success: true, disposals });
    } catch (error: any) {
        console.error("❌ Failed to fetch disposals:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

/**
 * Handles PUT /api/asset_disposals/:disposalId/decision: approves or rejects a pending disposal,
 * then emails the requester.
 * Answers `{ success, disposal }` with the updated row, or the AppError's status and message
 * (400 bad id, bad decision word, or disposal not pending; 404 unknown disposal), or 500.
 */
export async function decideDisposal(req: Request<{ disposalId: string }>, res: Response): Promise<void> {
    try {
        const disposalId = parseInt(req.params.disposalId, 10);
        const { decision } = req.body as { decision?: string };
        // Printed before the checks, so a refused decision still shows in the server terminal.
        console.log(`🚀 Server received disposal decision for #${disposalId}:`, decision);

        checkDisposalDecision(disposalId, decision);
        const updatedDisposal = await disposalsService.decideDisposal(disposalId, decision);

        console.log(`✅ Disposal #${disposalId} ${decision}d successfully.`);
        res.json({ success: true, disposal: updatedDisposal });

        // Sent after the answer and not awaited, as for the request above.
        disposalsService.notifyDecision(disposalId, updatedDisposal.disposed_by_id, decision);
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ MySQL Disposal Decision Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}
