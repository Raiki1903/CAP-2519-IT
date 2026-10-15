/**
 * Asset registry route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls assets.controller.ts.
 * Used by: every role's inventory view and the bell (the list), the asset detail modal (history),
 * Staff registration (IntakeWizard), editing (EditAssetDialog), and deletion.
 */
import express from 'express';
import * as assetsController from './assets.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';

/** The five asset registry endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const assetsRouter = express.Router();

// Every route needs a session; the roles are the approved 13b role table (rows 9 to 13). Any Staff account may delete
// until issue #41 decides who may (TSG or a future Admin).
assetsRouter.get('/api/assets', requireAuth, assetsController.listAssets);
assetsRouter.get('/api/assets/:assetTag/custodian-history', requireAuth, assetsController.getCustodianHistory);
assetsRouter.post('/api/assets', requireAuth, requireRole('Staff'), assetsController.registerAsset);
assetsRouter.put('/api/assets/:assetTag', requireAuth, requireRole('Staff'), assetsController.updateAsset);
assetsRouter.delete('/api/assets/:assetTag', requireAuth, requireRole('Staff'), assetsController.deleteAsset);
