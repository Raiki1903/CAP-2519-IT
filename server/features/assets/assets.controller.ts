import type { Request, Response } from 'express';
import * as assetsService from './assets.service';
import { checkAssetCreate } from './assets.validation';
import { AppError } from '../../shared/errors/AppError';

/** Handles GET /api/assets. */
export async function listAssets(req: Request, res: Response): Promise<void> {
    try {
        const formatted = await assetsService.listAssets();
        res.json({ success: true, assets: formatted });
    } catch (error: any) {
        console.error("❌ Failed to fetch assets:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

/** Handles GET /api/assets/:assetTag/custodian-history. */
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

/** Handles POST /api/assets. */
export async function registerAsset(req: Request, res: Response): Promise<void> {
    try {
        const data = req.body;
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

/** Handles PUT /api/assets/:assetTag. */
export async function updateAsset(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
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

/** Handles DELETE /api/assets/:assetTag. */
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
