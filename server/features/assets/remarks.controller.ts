/**
 * Asset remarks controller: unpacks remark requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by remarks.routes.ts. Calls remarks.validation.ts, remarks.service.ts, and
 * shared/middleware/requireAuth.ts (sessionUserOf: who is acting).
 * Used by: the Remarks section of the asset detail modal.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts.
 */
import type { Request, Response } from 'express';
import * as remarksService from './remarks.service';
import { readRemarkBody, readRemarkId } from './remarks.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/**
 * Handles GET /api/assets/:assetTag/remarks: `{ success, remarks, canAdd }`, the remarks newest first, each with
 * `canDelete`. Answers 404 for an unknown tag, or 500.
 */
export async function listRemarks(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const list = await remarksService.listRemarks(req.params.assetTag, sessionUserOf(req));
    res.json({ success: true, ...list });
}

/**
 * Handles POST /api/assets/:assetTag/remarks: adds a remark. Answers 201 `{ success, remark }`, or the AppError's
 * status and message (400 the text, 403 the Head of another lab, 404 unknown tag), or 500.
 */
export async function addRemark(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const text = readRemarkBody(req.body);
    const remark = await remarksService.addRemark(req.params.assetTag, text, sessionUserOf(req));
    res.status(201).json({ success: true, remark });
}

/**
 * Handles DELETE /api/assets/:assetTag/remarks/:remarkId: deletes a remark softly. Answers `{ success, deleted }`
 * with the remark id, or the AppError's status and message (400 the id, 403, 404 unknown tag or remark), or 500.
 */
export async function deleteRemark(req: Request<{ assetTag: string; remarkId: string }>, res: Response): Promise<void> {
    const remarkId = readRemarkId(req.params.remarkId);
    await remarksService.deleteRemark(req.params.assetTag, remarkId, sessionUserOf(req));
    res.json({ success: true, deleted: remarkId });
}
