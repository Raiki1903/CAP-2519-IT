import type { Request, Response } from 'express';
import * as disposalsService from './disposals.service';
import { checkDisposalDecision, checkDisposalRequest } from './disposals.validation';
import { AppError } from '../../shared/errors/AppError';

export async function requestDisposal(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        console.log(`🚀 Server received disposal request for ${assetTag}:`, data);

        checkDisposalRequest(data);
        const { disposal, asset } = await disposalsService.requestDisposal(assetTag, data);

        console.log("✅ Disposal request logged in MySQL successfully:", disposal.disposal_id, assetTag);
        res.json({ success: true, disposal });

        // Fire-and-forget notification to the AdRIC Director role.
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

export async function listDisposals(req: Request, res: Response): Promise<void> {
    try {
        const disposals = await disposalsService.listDisposals();
        res.json({ success: true, disposals });
    } catch (error: any) {
        console.error("❌ Failed to fetch disposals:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

export async function decideDisposal(req: Request<{ disposalId: string }>, res: Response): Promise<void> {
    try {
        const disposalId = parseInt(req.params.disposalId, 10);
        const { decision } = req.body as { decision?: string };
        console.log(`🚀 Server received disposal decision for #${disposalId}:`, decision);

        checkDisposalDecision(disposalId, decision);
        const updatedDisposal = await disposalsService.decideDisposal(disposalId, decision);

        console.log(`✅ Disposal #${disposalId} ${decision}d successfully.`);
        res.json({ success: true, disposal: updatedDisposal });

        // Fire-and-forget notification back to whoever requested it.
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
