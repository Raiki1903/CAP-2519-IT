/**
 * Asset controller: unpacks asset registry requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by assets.routes.ts. Calls assets.validation.ts, assets.service.ts, and shared/middleware/requireAuth.ts
 * (sessionUserOf: who is acting).
 * Used by: every role's inventory view, the asset detail modal, TSG registration and deletion, Edit Asset (TSG and the
 * Secretary), and TSG's Missing and Found.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as assetsService from './assets.service';
import { readAssetCreate, readAssetListFilters, readAssetUpdate, readFoundBody, readMissingBody } from './assets.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/**
 * Handles GET /api/assets: the assets with their state, as `{ success, assets }`, searched and filtered by the query
 * string (`q`, `status`, `centerId`). A Custodian gets no name but their own (D2).
 * Answers 400 for an unknown status or a centerId that is not a number, or errorHandler's generic 500.
 */
export async function listAssets(req: Request, res: Response): Promise<void> {
    const filters = readAssetListFilters(req.query);
    const formatted = await assetsService.listAssets(sessionUserOf(req), filters);
    res.json({ success: true, assets: formatted });
}

/**
 * Handles GET /api/assets/:assetTag/history: the asset's loans, inspections, maintenance, retirements, and activity
 * rows, oldest first, as `{ success, assetTag, assetName, events }`. A Custodian gets no other person's name (D2).
 * Answers 404 for an unknown tag, or 500.
 */
export async function getAssetHistory(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const history = await assetsService.assetHistory(req.params.assetTag, sessionUserOf(req));
    res.json({ success: true, ...history });
}

/**
 * Handles POST /api/assets: registers an asset under the next tag of its home lab, with its Initial inspection.
 * Answers `{ success, asset }` with the new asset as the list shows it, or the AppError's status and message
 * (400 a missing or wrong field, or a lab, project, or funding source that does not exist), or 500.
 */
export async function registerAsset(req: Request, res: Response): Promise<void> {
    const data = readAssetCreate(req.body);
    const registrar = sessionUserOf(req);
    const asset = await assetsService.registerAsset(data, registrar);

    console.log(`Asset ${asset.assetId} (${asset.tag}) registered by user ${registrar.userId}`);
    res.json({ success: true, asset });
}

/**
 * Handles PUT /api/assets/:assetTag: saves a master data edit.
 * Answers `{ success, asset }` with the asset as the list shows it, or the AppError's status and message
 * (400 a status, holder, location, or condition in the body, or a wrong value; 404 unknown tag; 409 an asset that is
 * Pending Retirement or Retired), or 500.
 */
export async function updateAsset(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;
    const data = readAssetUpdate(req.body);
    const editor = sessionUserOf(req);
    const updated = await assetsService.updateAsset(assetTag, data, editor);

    console.log(`Asset ${updated.assetId} edited by user ${editor.userId}`);
    res.json({ success: true, asset: updated });
}

/**
 * Handles DELETE /api/assets/:assetTag: deletes a mistaken registration.
 * Answers `{ success, deleted }` with the tag, or the AppError's status and message (404 unknown tag, 409 an asset
 * with history, issue #69), or 500.
 */
export async function deleteAsset(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;

    const deleterId = sessionUserOf(req).userId;
    await assetsService.deleteAsset(assetTag, deleterId);

    console.log(`Asset ${assetTag} deleted by user ${deleterId}`);
    res.json({ success: true, deleted: assetTag });
}

/**
 * Handles PUT /api/assets/:assetTag/missing: TSG marks the asset missing, with a reason.
 * Answers `{ success, asset }` in the list's shape, or the AppError's status and message (400, 404, 409).
 */
export async function markMissing(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;
    const reason = readMissingBody(req.body);
    const actor = sessionUserOf(req);
    const asset = await assetsService.markMissing(assetTag, reason, actor);

    console.log(`Asset ${asset.assetId} marked missing by user ${actor.userId}`);
    res.json({ success: true, asset });
}

/**
 * Handles PUT /api/assets/:assetTag/found: TSG marks a Missing asset found, with a Recovery inspection.
 * Answers `{ success, asset }` in the list's shape, or the AppError's status and message (400, 404, 409).
 */
export async function markFound(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;
    const { inspection, remarks } = readFoundBody(req.body);
    const actor = sessionUserOf(req);
    const asset = await assetsService.markFound(assetTag, inspection, remarks, actor);

    console.log(`Asset ${asset.assetId} marked found by user ${actor.userId}`);
    res.json({ success: true, asset });
}
