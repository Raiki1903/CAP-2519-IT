/**
 * Asset controller: unpacks asset registry requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by assets.routes.ts. Calls assets.validation.ts and assets.service.ts.
 * Used by: every role's inventory view, the asset detail modal, Staff asset registration, editing, and deletion.
 */
import type { Request, Response } from 'express';
import * as assetsService from './assets.service';
import { checkAssetCreate } from './assets.validation';
import { AppError } from '../../shared/errors/AppError';

/**
 * Handles GET /api/assets: every asset with its current state, as `{ success, assets }`.
 * A failure answers 500 with the raw error message.
 */
// TODO(H-16): the 500 answers here and below send the database's own error text to the browser. errorHandler, step 13.
export async function listAssets(req: Request, res: Response): Promise<void> {
    try {
        const formatted = await assetsService.listAssets();
        res.json({ success: true, assets: formatted });
    } catch (error: any) {
        console.error("❌ Failed to fetch assets:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

/**
 * Handles GET /api/assets/:assetTag/custodian-history: who has held the asset, oldest first.
 * Answers `{ success, assetTag, assetName, historyCount, custodianHistory }`, 404 for an unknown tag, or 500.
 */
export async function getCustodianHistory(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;

        const history = await assetsService.custodianHistory(assetTag);

        res.json({
            success: true,
            ...history
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ Fetch custodian history error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch custodian history." });
    }
}

/**
 * Handles POST /api/assets: registers an asset under the next tag of its lab.
 * Answers `{ success, asset }` with the new assets row, or the AppError's status and message
 * (400 missing name or category, or a picture that is not an image), or 500.
 */
export async function registerAsset(req: Request, res: Response): Promise<void> {
    try {
        const data = req.body;
        // Printed before the checks, so a refused request still shows in the server terminal.
        // TODO(M-17): a picture is printed in full, as base64 text, with the rest of the body. With the image storage, Phase 3.
        console.log("🚀 Server received raw payload:", data);

        checkAssetCreate(data);
        const { asset, assetTag } = await assetsService.registerAsset(data);

        console.log("✅ Asset saved to MySQL successfully:", asset.asset_id, assetTag);
        res.json({ success: true, asset });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ MySQL Insertion Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

/**
 * Handles PUT /api/assets/:assetTag: saves an edit, and with a condition or remarks files an inspection report.
 * Answers `{ success, asset }` with the assets row, or the AppError's status and message
 * (404 unknown tag, 400 a picture that is not an image), or 500.
 */
export async function updateAsset(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        // Printed before the checks, as for a new asset.
        console.log(`🚀 Server received update for ${assetTag}:`, data);

        const updated = await assetsService.updateAsset(assetTag, data);

        console.log("✅ Asset updated in MySQL successfully:", updated.asset_id);
        res.json({ success: true, asset: updated });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ MySQL Update Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

/**
 * Handles DELETE /api/assets/:assetTag: deletes the asset and every row that points at it.
 * Answers `{ success }`, 404 for an unknown tag, or 500, which is what an asset with an inspection report gets. (H-03, issue #69)
 */
export async function deleteAsset(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        console.log(`🚀 Server received delete request for ${assetTag}`);

        await assetsService.deleteAsset(assetTag);

        console.log("✅ Asset deleted from MySQL successfully:", assetTag);
        res.json({ success: true });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ MySQL Deletion Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}
