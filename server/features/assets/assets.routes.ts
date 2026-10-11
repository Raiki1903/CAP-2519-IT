/**
 * Asset registry route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls assets.controller.ts.
 * Used by: every role's inventory view and the bell (the list), the asset detail modal (history),
 * Staff registration (IntakeWizard), editing (EditAssetDialog), and deletion.
 */
import express from 'express';
import * as assetsController from './assets.controller';

/** The five asset registry endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const assetsRouter = express.Router();

// TODO(C-02): anyone who can reach the server can register, edit, or delete assets; no session or role is checked. requireAuth and requireRole, step 13.
assetsRouter.get('/api/assets', assetsController.listAssets);
assetsRouter.get('/api/assets/:assetTag/custodian-history', assetsController.getCustodianHistory);
assetsRouter.post('/api/assets', assetsController.registerAsset);
assetsRouter.put('/api/assets/:assetTag', assetsController.updateAsset);
assetsRouter.delete('/api/assets/:assetTag', assetsController.deleteAsset);
