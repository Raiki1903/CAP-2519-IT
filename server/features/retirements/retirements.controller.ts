/**
 * Disposal controller: unpacks disposal requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by retirements.routes.ts. Calls retirements.validation.ts, retirements.service.ts, and
 * shared/middleware/requireAuth.ts (sessionUserOf: who is acting).
 * Used by: TSG disposal requests and completion, the Director's and the Secretary's decisions, and the disposal lists.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as retirementsService from './retirements.service';
import { sessionUserOf } from '../../shared/middleware/requireAuth';
import { readCompleteBody, readDecisionBody, readRequestBody, readRetirementId, readStatusFilter } from './retirements.validation';

/**
 * Handles POST /api/assets/:assetTag/retirement: TSG requests a disposal, then the Director and the Secretary are emailed.
 * Answers 201 `{ success, retirement }`, or the AppError's status and message (400, 404, 409).
 */
export async function requestRetirement(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;
    const data = readRequestBody(req.body);
    const requester = sessionUserOf(req);
    const retirement = await retirementsService.requestRetirement(assetTag, data, requester);

    console.log(`Retirement ${retirement.retirementId} on ${assetTag} requested by user ${requester.userId}`);
    res.status(201).json({ success: true, retirement });

    // Sent after the answer and not awaited, so a slow mail service never delays it. The send catches its own failures.
    retirementsService.notifyDeciders(retirement.retirementId);
}

/**
 * Handles GET /api/retirements: the disposals the session user may see, newest first, as
 * `{ success, retirements, disposals }`: `retirements` in the Retirement shape, `disposals` the same disposals in the
 * row shape today's screens read. Answers 400 for an unknown `?status=`.
 */
export async function listRetirements(req: Request, res: Response): Promise<void> {
    const statuses = readStatusFilter(req.query.status);
    const { retirements, disposals } = await retirementsService.listRetirements(statuses, sessionUserOf(req));
    res.json({ success: true, retirements, disposals });
}

/**
 * Handles PUT /api/retirements/:retirementId/decision: the Director or the Secretary approves or denies, then the
 * requester is emailed. Answers `{ success, retirement }`, or the AppError's status and message (400, 403, 404, 409).
 */
export async function decide(req: Request<{ retirementId: string }>, res: Response): Promise<void> {
    const retirementId = readRetirementId(req.params.retirementId);
    const body = readDecisionBody(req.body);
    const decider = sessionUserOf(req);
    const retirement = await retirementsService.decide(retirementId, body, decider);

    console.log(`Retirement ${retirementId} ${body.approve ? 'approved' : 'denied'} by user ${decider.userId}`);
    res.json({ success: true, retirement });

    // Sent after the answer and not awaited, as for the request above.
    retirementsService.notifyDecision(retirementId);
}

/**
 * Handles PUT /api/retirements/:retirementId/complete: TSG completes an Approved disposal; the asset is Retired.
 * Answers `{ success, retirement }`, or the AppError's status and message (400, 404, 409).
 */
export async function complete(req: Request<{ retirementId: string }>, res: Response): Promise<void> {
    const retirementId = readRetirementId(req.params.retirementId);
    const body = readCompleteBody(req.body);
    const actor = sessionUserOf(req);
    const retirement = await retirementsService.complete(retirementId, body, actor);

    console.log(`Retirement ${retirementId} completed by user ${actor.userId}`);
    res.json({ success: true, retirement });
}
