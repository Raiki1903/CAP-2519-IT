/**
 * Inspection controller: unpacks inspection requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by inspections.routes.ts. Calls inspections.validation.ts, inspections.service.ts, and shared/middleware/requireAuth.ts
 * (sessionUserOf: who is acting).
 * Used by: Custodian condition report, Staff inspection finalize and the routine queue, the Staff inspection log, and
 * state/serverData.tsx.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as inspectionsService from './inspections.service';
import { readFilingBody, readRoutineQueueQuery } from './inspections.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/**
 * Handles POST /api/assets/:assetTag/inspection: TSG files a Routine inspection, the holder a Self Report.
 * Answers `{ success, inspection }` (the Inspection shape), or the AppError's status and message (400 a missing or wrong value, 403 not the holder, 404 unknown asset, 409 the asset's
 * status does not allow it), or 500.
 */
export async function fileReport(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;
    const input = readFilingBody(req.body);
    const actor = sessionUserOf(req);
    const { inspection, assetId } = await inspectionsService.fileInspection(assetTag, input, actor);

    console.log(`Inspection ${inspection.inspectionId} on asset ${assetId} filed by user ${actor.userId}`);
    res.json({ success: true, inspection });
}

/**
 * Handles GET /api/inspections/routine-queue: the Available assets due for a routine inspection, by group, as
 * `{ success, groups }`. Answers 400 for a wrong `days` or `centerId`, or 500.
 */
export async function routineQueue(req: Request, res: Response): Promise<void> {
    const filters = readRoutineQueueQuery(req.query);
    const groups = await inspectionsService.routineQueue(filters, sessionUserOf(req));
    res.json({ success: true, groups });
}

/**
 * Handles GET /api/inspections: every report, newest first, in the short shape, as `{ success, reports }`.
 * A failure answers errorHandler's generic 500.
 */
export async function listReportSummaries(req: Request, res: Response): Promise<void> {
    const reports = await inspectionsService.listReportSummaries();
    res.json({ success: true, reports });
}

/**
 * Handles GET /api/inspections/log: every report, newest first, in the detailed shape, as `{ success, reports }`.
 * A failure answers errorHandler's generic 500.
 */
export async function listInspectionReports(_req: Request, res: Response): Promise<void> {
    const reports = await inspectionsService.listInspectionReports();
    res.json({ success: true, reports });
}
