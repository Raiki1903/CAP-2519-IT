/**
 * Asset controller: unpacks asset registry requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by assets.routes.ts. Calls assets.validation.ts, assets.service.ts, and shared/middleware/requireAuth.ts
 * (sessionUserOf: who is acting).
 * Used by: every role's inventory view, the asset detail modal, Staff asset registration, editing, and deletion.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as assetsService from './assets.service';
import { checkAssetCreate, checkAssetUpdate } from './assets.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/**
 * Handles GET /api/assets: every asset with its current state, as `{ success, assets }`. A Custodian gets no name
 * but their own (D2). A failure answers errorHandler's generic 500.
 */
export async function listAssets(req: Request, res: Response): Promise<void> {
    const formatted = await assetsService.listAssets(sessionUserOf(req));
    res.json({ success: true, assets: formatted });
}

/**
 * Handles GET /api/assets/:assetTag/custodian-history: who has held the asset, oldest first. A Custodian gets no
 * other holder's name or email (answer 6 of the 13c questions).
 * Answers `{ success, assetTag, assetName, historyCount, custodianHistory }`, 404 for an unknown tag, or 500.
 */
export async function getCustodianHistory(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;

    const history = await assetsService.custodianHistory(assetTag, sessionUserOf(req));

    res.json({
        success: true,
        ...history
    });
}

/**
 * Handles POST /api/assets: registers an asset under the next tag of its lab.
 * Answers `{ success, asset }` with the new assets row, or the AppError's status and message
 * (400 missing name or category, or a picture that is not an image), or 500.
 */
export async function registerAsset(req: Request, res: Response): Promise<void> {
    const data = req.body;
    // Printed before the checks, so a refused request still shows in the server terminal.
    // TODO(M-17): a picture is printed in full, as base64 text, with the rest of the body. With the image storage, Phase 3.
    console.log("🚀 Server received raw payload:", data);

    checkAssetCreate(data);
    const { asset, assetTag } = await assetsService.registerAsset(data);

    console.log("✅ Asset saved to MySQL successfully:", asset.asset_id, assetTag);
    res.json({ success: true, asset });
}

/**
 * Handles PUT /api/assets/:assetTag: saves an edit, adds a record when a record field changes, and with a condition
 * or remarks files an inspection report.
 * Answers `{ success, asset }` with the assets row, or the AppError's status and message
 * (404 unknown tag; 400 a custodian that is not a Custodian account, an available asset left with a person, or a
 * picture that is not an image), or 500.
 */
export async function updateAsset(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;
    const data = req.body;
    // Printed before the checks, as for a new asset.
    console.log(`🚀 Server received update for ${assetTag}:`, data);

    checkAssetUpdate(data);
    const updated = await assetsService.updateAsset(assetTag, data, sessionUserOf(req).userId);

    console.log("✅ Asset updated in MySQL successfully:", updated.asset_id);
    res.json({ success: true, asset: updated });
}

/**
 * Handles DELETE /api/assets/:assetTag: deletes the asset and every row that points at it.
 * Answers `{ success }`, or the AppError's status and message (404 unknown tag, 409 an asset with reports, issue #69), or 500.
 */
export async function deleteAsset(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;
    console.log(`🚀 Server received delete request for ${assetTag}`);

    await assetsService.deleteAsset(assetTag);

    console.log("✅ Asset deleted from MySQL successfully:", assetTag);
    res.json({ success: true });
}
