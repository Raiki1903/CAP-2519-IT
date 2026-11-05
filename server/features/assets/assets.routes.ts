/**
 * Asset registry route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls assets.controller.ts.
 * Used by: every role's inventory view and the bell (the list and search), the asset detail modal (history),
 * Staff registration (IntakeWizard), editing (EditAssetDialog), deletion, TSG's Missing and Found, and the benchmark
 * data (no screen yet).
 */
import express from 'express';
import * as assetsController from './assets.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireAnyRole, requireAssetMasterEditor, requireTsg } from '../../shared/middleware/permissions';

/** The asset registry endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const assetsRouter = express.Router();

// Every route needs a session and an Active account. TSG registers, deletes a mistaken registration, and marks an asset
// missing and found; TSG and the Secretary edit master data. TSG, the Director, and a Lab Head read the benchmark data
// (the service keeps a Lab Head to its own lab's assets). The IT Admin has no asset steps.
assetsRouter.get('/api/assets', requireAuth, requireActive, assetsController.listAssets);
assetsRouter.get('/api/assets/:assetTag/history', requireAuth, requireActive, assetsController.getAssetHistory);
assetsRouter.get('/api/assets/:assetTag/benchmarks', requireAuth, requireActive, requireAnyRole('TSG_STAFF', 'ADRIC_DIRECTOR', 'LAB_HEAD'), assetsController.getBenchmarks);
assetsRouter.post('/api/assets', requireAuth, requireActive, requireTsg, assetsController.registerAsset);
assetsRouter.put('/api/assets/:assetTag', requireAuth, requireActive, requireAssetMasterEditor, assetsController.updateAsset);
assetsRouter.delete('/api/assets/:assetTag', requireAuth, requireActive, requireTsg, assetsController.deleteAsset);
assetsRouter.put('/api/assets/:assetTag/missing', requireAuth, requireActive, requireTsg, assetsController.markMissing);
assetsRouter.put('/api/assets/:assetTag/found', requireAuth, requireActive, requireTsg, assetsController.markFound);
