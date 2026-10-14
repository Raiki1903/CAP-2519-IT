/**
 * Disposal controller: unpacks disposal requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by disposals.routes.ts. Calls disposals.validation.ts and disposals.service.ts.
 * Used by: Staff disposal filing, Director approval.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as disposalsService from './disposals.service';
import { checkDisposalDecision, checkDisposalRequest } from './disposals.validation';

/**
 * Handles POST /api/assets/:assetTag/disposal: files a pending disposal request, then emails the Director.
 * Answers `{ success, disposal }` with the new row, or the AppError's status and message
 * (400 missing field, 404 unknown tag), or 500.
 */
export async function requestDisposal(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
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
}

/**
 * Handles GET /api/asset_disposals: every disposal request, newest first, as `{ success, disposals }`.
 * A failure answers errorHandler's generic 500.
 */
export async function listDisposals(req: Request, res: Response): Promise<void> {
    const disposals = await disposalsService.listDisposals();
    res.json({ success: true, disposals });
}

/**
 * Handles PUT /api/asset_disposals/:disposalId/decision: approves or rejects a pending disposal,
 * then emails the requester.
 * Answers `{ success, disposal }` with the updated row, or the AppError's status and message
 * (400 bad id, bad decision word, or disposal not pending; 404 unknown disposal), or 500.
 */
export async function decideDisposal(req: Request<{ disposalId: string }>, res: Response): Promise<void> {
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
}
