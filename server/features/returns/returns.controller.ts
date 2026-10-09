import type { Request, Response } from 'express';
import * as returnsService from './returns.service';
import { checkReturnInput } from './returns.validation';
import { AppError } from '../../shared/errors/AppError';

export async function finalizeReturn(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
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

export async function listReturns(req: Request, res: Response): Promise<void> {
    try {
        const returns = await returnsService.listReturns();
        res.json({ success: true, returns });
    } catch (error: any) {
        console.error("❌ Failed to fetch returns:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}
