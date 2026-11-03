/**
 * Repair controller: unpacks repair requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by maintenance.routes.ts. Calls maintenance.validation.ts, maintenance.service.ts, and shared/middleware/requireAuth.ts
 * (sessionUserOf: who is acting).
 * Used by: Custodian repair request, Staff repair queue and progress updates (repair dialog and analytics board).
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as maintenanceService from './maintenance.service';
import { checkRepairRequest, checkRepairStatus, checkRepairUpdate } from './maintenance.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/**
 * Handles POST /api/assets/:assetTag/maintenance: opens a repair ticket, reported by the session user.
 * Answers `{ success, repair }` with the new row, or the AppError's status and message
 * (400 no description, 409 same ticket within 8 seconds, 404 unknown tag), or 500.
 */
export async function requestRepair(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;
    const data = req.body;

    checkRepairRequest(data);
    const reporterId = sessionUserOf(req).userId;
    const repair = await maintenanceService.requestRepair(assetTag, data, reporterId);

    console.log(`Maintenance ${repair.maintenance_id} on ${assetTag} reported by user ${reporterId}`);
    res.json({ success: true, repair });
}

/**
 * Handles GET /api/maintenance: every repair ticket, newest first, as `{ success, repairs }`
 * (read by the Staff repair queue and by state/serverData.tsx). A failure answers errorHandler's generic 500.
 */
export async function listRepairs(req: Request, res: Response): Promise<void> {
    const repairs = await maintenanceService.listRepairs();
    res.json({ success: true, repairs });
}

/**
 * Handles PUT /api/maintenance/:repairId: sets a ticket's status and moves the asset to match.
 * Answers `{ success, repair }` with the updated ticket, or the AppError's status and message
 * (400 bad id or no status, 404 unknown ticket), or 500.
 */
export async function updateRepair(req: Request<{ repairId: string }>, res: Response): Promise<void> {
    const repairId = parseInt(req.params.repairId, 10);
    const { progressStatus, assetCondition, assetRemarks } = req.body as { progressStatus?: string; assetCondition?: string; assetRemarks?: string };

    checkRepairUpdate(repairId, progressStatus);
    const staffId = sessionUserOf(req).userId;
    const repair = await maintenanceService.updateRepair(repairId, progressStatus, assetCondition, assetRemarks, staffId);

    console.log(`Maintenance ${repairId} updated by user ${staffId}`);
    res.json({ success: true, repair });
}

/**
 * Handles PUT /api/maintenance/:repairId/status: sets only the ticket's status (the Staff analytics board).
 * Answers `{ success, repair }`, or 400 with no status. A bad or unknown id answers 500 with the raw
 * message and no fallback text, and no line is printed before the check, as before.
 */
export async function updateRepairStatus(req: Request<{ repairId: string }>, res: Response): Promise<void> {
    const repairId = parseInt(req.params.repairId, 10);
    const { progressStatus } = req.body;

    checkRepairStatus(progressStatus);
    const repair = await maintenanceService.updateRepairStatus(repairId, progressStatus);

    console.log(`Maintenance ${repairId} status changed by user ${sessionUserOf(req).userId}`);
    res.json({ success: true, repair });
}
