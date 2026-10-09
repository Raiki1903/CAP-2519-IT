import express from 'express';
import * as disposalsController from './disposals.controller';

export const disposalsRouter = express.Router();

disposalsRouter.post('/api/assets/:assetTag/disposal', disposalsController.requestDisposal);
disposalsRouter.get('/api/asset_disposals', disposalsController.listDisposals);
disposalsRouter.put('/api/asset_disposals/:disposalId/decision', disposalsController.decideDisposal);
