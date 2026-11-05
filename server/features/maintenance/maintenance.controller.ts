/**
 * Maintenance controller: unpacks maintenance requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by maintenance.routes.ts. Calls maintenance.validation.ts, maintenance.service.ts, and
 * shared/middleware/requireAuth.ts (sessionUserOf: who is acting).
 * Used by: reporting an issue, TSG receipt and the maintenance steps, cancelling a ticket, and every role's ticket list.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as maintenanceService from './maintenance.service';
import { readCancelBody, readCompleteBody, readListFilters, readMaintenanceId, readReceiveBody, readReportBody, readStageBody } from './maintenance.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/**
 * Handles POST /api/assets/:assetTag/maintenance: reports an issue, as the session user.
 * Answers 201 `{ success, maintenance }`, or the AppError's status and message (400, 403, 404, 409).
 */
export async function reportIssue(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;
    const data = readReportBody(req.body);
    const reporter = sessionUserOf(req);
    const maintenance = await maintenanceService.reportIssue(assetTag, data, reporter);

    console.log(`Maintenance ${maintenance.maintenanceId} on ${assetTag} reported by user ${reporter.userId}`);
    res.status(201).json({ success: true, maintenance });
}

/**
 * Handles GET /api/maintenance: the tickets the session user may see, newest first, as `{ success, tickets }` in the
 * Maintenance shape. Answers 400 for an unknown `?status=` or `?type=`.
 */
export async function listTickets(req: Request, res: Response): Promise<void> {
    const filters = readListFilters(req.query as Record<string, unknown>);
    const tickets = await maintenanceService.listTickets(filters, sessionUserOf(req));
    res.json({ success: true, tickets });
}

/**
 * Handles PUT /api/maintenance/:maintenanceId/receive: TSG receives the asset with a Maintenance inspection.
 * Answers `{ success, maintenance }`, or the AppError's status and message (400, 404, 409).
 */
export async function receive(req: Request<{ maintenanceId: string }>, res: Response): Promise<void> {
    const maintenanceId = readMaintenanceId(req.params.maintenanceId);
    const inspection = readReceiveBody(req.body);
    const receiver = sessionUserOf(req);
    const maintenance = await maintenanceService.receive(maintenanceId, inspection, receiver);

    console.log(`Maintenance ${maintenanceId} received by user ${receiver.userId}`);
    res.json({ success: true, maintenance });
}

/**
 * Handles PUT /api/maintenance/:maintenanceId/start: TSG starts the work, Repairing or External Service.
 * Answers `{ success, maintenance }`, or the AppError's status and message (400 the warranty or provider rule, 404, 409).
 */
export async function start(req: Request<{ maintenanceId: string }>, res: Response): Promise<void> {
    const maintenanceId = readMaintenanceId(req.params.maintenanceId);
    const body = readStageBody(req.body);
    const actor = sessionUserOf(req);
    const maintenance = await maintenanceService.start(maintenanceId, body, actor);

    console.log(`Maintenance ${maintenanceId} started as ${body.stage} by user ${actor.userId}`);
    res.json({ success: true, maintenance });
}

/**
 * Handles PUT /api/maintenance/:maintenanceId/stage: TSG moves the work between Repairing and External Service.
 * Answers `{ success, maintenance }`, or the AppError's status and message (400, 404, 409).
 */
export async function changeStage(req: Request<{ maintenanceId: string }>, res: Response): Promise<void> {
    const maintenanceId = readMaintenanceId(req.params.maintenanceId);
    const body = readStageBody(req.body);
    const actor = sessionUserOf(req);
    const maintenance = await maintenanceService.changeStage(maintenanceId, body, actor);

    console.log(`Maintenance ${maintenanceId} moved to ${body.stage} by user ${actor.userId}`);
    res.json({ success: true, maintenance });
}

/**
 * Handles PUT /api/maintenance/:maintenanceId/complete: TSG completes the work, Resolved or Beyond Repair, with a
 * Maintenance inspection. Answers `{ success, maintenance }`, or the AppError's status and message (400, 404, 409).
 */
export async function complete(req: Request<{ maintenanceId: string }>, res: Response): Promise<void> {
    const maintenanceId = readMaintenanceId(req.params.maintenanceId);
    const body = readCompleteBody(req.body);
    const actor = sessionUserOf(req);
    const maintenance = await maintenanceService.complete(maintenanceId, body, actor);

    console.log(`Maintenance ${maintenanceId} completed as ${body.outcome} by user ${actor.userId}`);
    res.json({ success: true, maintenance });
}

/**
 * Handles PUT /api/maintenance/:maintenanceId/cancel: the reporter (Pending Receipt only) or TSG cancels the ticket.
 * Answers `{ success, maintenance }`, or the AppError's status and message (400, 403, 404, 409).
 */
export async function cancel(req: Request<{ maintenanceId: string }>, res: Response): Promise<void> {
    const maintenanceId = readMaintenanceId(req.params.maintenanceId);
    const remarks = readCancelBody(req.body);
    const actor = sessionUserOf(req);
    const maintenance = await maintenanceService.cancel(maintenanceId, remarks, actor);

    console.log(`Maintenance ${maintenanceId} cancelled by user ${actor.userId}`);
    res.json({ success: true, maintenance });
}
