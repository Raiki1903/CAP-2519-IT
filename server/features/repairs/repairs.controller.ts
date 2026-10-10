import type { Request, Response } from 'express';
import * as repairsService from './repairs.service';
import { checkRepairRequest, checkRepairStatus, checkRepairUpdate } from './repairs.validation';
import { AppError } from '../../shared/errors/AppError';

export async function requestRepair(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
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

// Fetch all repair/maintenance requests (ITSDashboard queue)
export async function listRepairs(req: Request, res: Response): Promise<void> {
    try {
        const repairs = await repairsService.listRepairs();
        res.json({ success: true, repairs });
    } catch (error: any) {
        console.error("❌ Failed to fetch repairs:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

export async function updateRepair(req: Request<{ repairId: string }>, res: Response): Promise<void> {
    try {
        const repairId = parseInt(req.params.repairId, 10);
        const { progressStatus, assetCondition, assetRemarks } = req.body as { progressStatus?: string; assetCondition?: string; assetRemarks?: string };
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
