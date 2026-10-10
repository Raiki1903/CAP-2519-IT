/**
 * Transfer controller: unpacks transfer requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by transfers.routes.ts. Calls transfers.validation.ts and transfers.service.ts.
 * Used by: Custodian transfer request, Lab Head approval.
 */
import type { Request, Response } from 'express';
import * as transfersService from './transfers.service';
import { checkTransferDecision, checkTransferRequest } from './transfers.validation';
import { AppError } from '../../shared/errors/AppError';

/**
 * Handles POST /api/assets/:assetTag/transfer: files a pending transfer request, then emails the recipient.
 * Answers `{ success, transfer }` with the new row, or the AppError's status and message
 * (400 missing field, 404 unknown tag or recipient email, 409 refused by the custody request guard), or 500.
 */
// TODO(H-16): the 500 answers here and below send the database's own error text to the browser. errorHandler, step 13.
export async function requestTransfer(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        // Printed before the checks, so a refused request still shows in the server terminal.
        console.log(`🚀 Server received transfer request for ${assetTag}:`, data);

        checkTransferRequest(data);
        const { transfer, asset, recipient } = await transfersService.requestTransfer(assetTag, data);

        console.log("✅ Transfer request logged in MySQL successfully:", transfer.transfer_id, assetTag);
        res.json({ success: true, transfer });

        // Sent after the answer and not awaited, so a slow mail service never delays it. sendEmail catches its own send failures.
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

/**
 * Handles GET /api/asset_transfers: every transfer, newest first, as `{ success, transfers }`.
 * A failure answers 500 with the raw error message.
 */
export async function listTransfers(req: Request, res: Response): Promise<void> {
    try {
        const transfers = await transfersService.listTransfers();
        res.json({ success: true, transfers });
    } catch (error: any) {
        console.error("❌ Failed to fetch transfers:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

/**
 * Handles PUT /api/asset_transfers/:transferId/decision: approves or declines a pending transfer,
 * then emails the custodian the asset was leaving.
 * Answers `{ success, transfer }` with the updated row, or the AppError's status and message
 * (400 bad id, bad decision word, or transfer not pending; 404 unknown transfer), or 500.
 */
export async function decideTransfer(req: Request<{ transferId: string }>, res: Response): Promise<void> {
    try {
        const transferId = parseInt(req.params.transferId, 10);
        const { decision } = req.body as { decision?: string };
        // Printed before the checks, so a refused decision still shows in the server terminal.
        console.log(`🚀 Server received transfer decision for #${transferId}:`, decision);

        checkTransferDecision(transferId, decision);
        const updatedTransfer = await transfersService.decideTransfer(transferId, decision);

        console.log(`✅ Transfer #${transferId} ${decision}d successfully.`);
        res.json({ success: true, transfer: updatedTransfer });

        // Sent after the answer and not awaited, as for the request above.
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

/**
 * Handles PUT /api/asset_transfers/:transferId/accept: sets the transfer to pending_approver. (M-12)
 * Answers `{ success, transfer }`, 404 for an unknown transfer, or 500 with the raw message
 * (including a non-number id). Unlike the other transfer endpoints it logs nothing.
 */
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
