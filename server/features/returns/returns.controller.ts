/**
 * Return controller: unpacks return requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by returns.routes.ts. Calls returns.validation.ts, returns.service.ts, and shared/middleware/requireAuth.ts
 * (sessionUserOf: who is acting).
 * Used by: Staff return finalization.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as returnsService from './returns.service';
import { checkReturnInput } from './returns.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/**
 * Handles POST /api/assets/:assetTag/return: finalizes a return and closes the asset's loan.
 * Answers `{ success, loan, referenceNumber }` with the closed loan and its LOAN- reference, or the AppError's status and message
 * (400 missing or unknown condition, 404 unknown tag, 409 an asset that is not out), or 500.
 */
export async function finalizeReturn(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;
    const data = req.body;

    checkReturnInput(data);
    const receiverId = sessionUserOf(req).userId;
    const loan = await returnsService.finalizeReturn(assetTag, data, receiverId);

    console.log(`Loan ${loan.loan_id} on ${assetTag} returned, received by user ${receiverId}`);
    res.json({ success: true, loan, referenceNumber: `LOAN-${loan.loan_id}` });
}
