/**
 * Repair controller: unpacks repair requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by repairs.routes.ts. Calls repairs.validation.ts and repairs.service.ts.
 * Used by: Custodian repair request, Staff repair queue and progress updates (repair dialog and analytics board).
 */
import type { Request, Response } from 'express';
import * as repairsService from './repairs.service';
import { checkRepairRequest, checkRepairStatus, checkRepairUpdate } from './repairs.validation';
import { AppError } from '../../shared/errors/AppError';

/**
 * Handles POST /api/assets/:assetTag/repair: opens a repair ticket.
 * Answers `{ success, repair }` with the new row, or the AppError's status and message
 * (400 no description, 409 same ticket within 8 seconds, 404 unknown tag), or 500.
 */
// TODO(H-16): the 500 answers here and below send the database's own error text to the browser. errorHandler, step 13.
export async function requestRepair(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        // Printed before the checks, so a refused request still shows in the server terminal.
        console.log(`🚀 Server received repair request for ${assetTag}:`, data);

        checkRepairRequest(data);
        const repair = await repairsService.requestRepair(assetTag, data);

        console.log("✅ Repair request logged in MySQL successfully:", repair.repair_id, assetTag);
        res.json({ success: true, repair });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ MySQL Repair Insertion Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

/**
 * Handles GET /api/asset_repairs: every repair ticket, newest first, as `{ success, repairs }`
 * (read by the Staff repair queue and by state/serverData.tsx). A failure answers 500 with the raw error message.
 */
export async function listRepairs(req: Request, res: Response): Promise<void> {
    try {
        const repairs = await repairsService.listRepairs();
        res.json({ success: true, repairs });
    } catch (error: any) {
        console.error("❌ Failed to fetch repairs:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

/**
 * Handles PUT /api/asset_repairs/:repairId: sets a ticket's status and moves the asset to match.
 * Answers `{ success, repair }` with the updated ticket, or the AppError's status and message
 * (400 bad id or no status, 404 unknown ticket), or 500.
 */
export async function updateRepair(req: Request<{ repairId: string }>, res: Response): Promise<void> {
    try {
        const repairId = parseInt(req.params.repairId, 10);
        const { progressStatus, assetCondition, assetRemarks } = req.body as { progressStatus?: string; assetCondition?: string; assetRemarks?: string };
        // Printed before the checks, so a refused update still shows in the server terminal.
        console.log(`🚀 Server received repair status update for #${repairId}:`, { progressStatus, assetCondition, assetRemarks });

        checkRepairUpdate(repairId, progressStatus);
        const repair = await repairsService.updateRepair(repairId, progressStatus, assetCondition, assetRemarks);

        console.log(`✅ Repair #${repairId} progress updated to "${progressStatus}".`);
        res.json({ success: true, repair });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ MySQL Repair Update Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

/**
 * Handles PUT /api/asset_repairs/:repairId/status: sets only the ticket's status (the Staff analytics board).
 * Answers `{ success, repair }`, or 400 with no status. A bad or unknown id answers 500 with the raw
 * message and no fallback text, and no line is printed before the check, as before.
 */
export async function updateRepairStatus(req: Request<{ repairId: string }>, res: Response): Promise<void> {
    try {
        const repairId = parseInt(req.params.repairId, 10);
        const { progressStatus } = req.body;

        checkRepairStatus(progressStatus);
        const repair = await repairsService.updateRepairStatus(repairId, progressStatus);

        console.log(`🔧 Updated asset_repairs #${repairId} progress_status to MySQL: "${progressStatus}"`);
        res.json({ success: true, repair });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ Repair status update error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
