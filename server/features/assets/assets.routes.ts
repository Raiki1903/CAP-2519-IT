import express from 'express';
import * as assetsController from './assets.controller';

/** The five asset registry endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const assetsRouter = express.Router();

assetsRouter.get('/api/assets', assetsController.listAssets);
assetsRouter.get('/api/assets/:assetTag/custodian-history', assetsController.getCustodianHistory);
assetsRouter.post('/api/assets', assetsController.registerAsset);
assetsRouter.put('/api/assets/:assetTag', assetsController.updateAsset);
assetsRouter.delete('/api/assets/:assetTag', assetsController.deleteAsset);
