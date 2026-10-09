import type { Request, Response } from 'express';
import * as transfersService from './transfers.service';
import { checkTransferDecision, checkTransferRequest } from './transfers.validation';
import { AppError } from '../../shared/errors/AppError';

export async function requestTransfer(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        console.log(`🚀 Server received transfer request for ${assetTag}:`, data);

        checkTransferRequest(data);
        const { transfer, asset, recipient } = await transfersService.requestTransfer(assetTag, data);

        console.log("✅ Transfer request logged in MySQL successfully:", transfer.transfer_id, assetTag);
        res.json({ success: true, transfer });

        // Fire-and-forget — the recipient is the one who needs to act now.
        transfersService.notifyRecipient(asset, recipient, assetTag, data.reason);
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ MySQL Transfer Insertion Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

export async function listTransfers(req: Request, res: Response): Promise<void> {
    try {
        const transfers = await transfersService.listTransfers();
        res.json({ success: true, transfers });
    } catch (error: any) {
        console.error("❌ Failed to fetch transfers:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

export async function decideTransfer(req: Request<{ transferId: string }>, res: Response): Promise<void> {
    try {
        const transferId = parseInt(req.params.transferId, 10);
        const { decision } = req.body as { decision?: string };
        console.log(`🚀 Server received transfer decision for #${transferId}:`, decision);

        checkTransferDecision(transferId, decision);
        const updatedTransfer = await transfersService.decideTransfer(transferId, decision);

        console.log(`✅ Transfer #${transferId} ${decision}d successfully.`);
        res.json({ success: true, transfer: updatedTransfer });

        // Fire-and-forget — let the original custodian know the outcome.
        transfersService.notifyDecision(transferId, updatedTransfer.from_custodian_id, decision);
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ MySQL Transfer Decision Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

export async function acceptTransfer(req: Request<{ transferId: string }>, res: Response): Promise<void> {
    try {
        const transferId = parseInt(req.params.transferId, 10);
        const { remarks } = req.body;

        const updated = await transfersService.acceptTransfer(transferId, remarks);

        res.json({ success: true, transfer: updated });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        res.status(500).json({ success: false, error: error.message });
    }
}
