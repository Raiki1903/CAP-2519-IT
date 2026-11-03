/**
 * Asset registry route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls assets.controller.ts.
 * Used by: every role's inventory view and the bell (the list and search), the asset detail modal (history),
 * Staff registration (IntakeWizard), editing (EditAssetDialog), and deletion.
 */
import express from 'express';
import * as assetsController from './assets.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireAssetMasterEditor, requireTsg } from '../../shared/middleware/permissions';

/** The five asset registry endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const assetsRouter = express.Router();

// Every route needs a session and an Active account. TSG registers and deletes a mistaken registration; TSG and the
// Secretary edit master data. The IT Admin has no asset steps.
assetsRouter.get('/api/assets', requireAuth, requireActive, assetsController.listAssets);
assetsRouter.get('/api/assets/:assetTag/history', requireAuth, requireActive, assetsController.getAssetHistory);
assetsRouter.post('/api/assets', requireAuth, requireActive, requireTsg, assetsController.registerAsset);
assetsRouter.put('/api/assets/:assetTag', requireAuth, requireActive, requireAssetMasterEditor, assetsController.updateAsset);
assetsRouter.delete('/api/assets/:assetTag', requireAuth, requireActive, requireTsg, assetsController.deleteAsset);
