import express from 'express';
import * as transfersController from './transfers.controller';

export const transfersRouter = express.Router();

transfersRouter.post('/api/assets/:assetTag/transfer', transfersController.requestTransfer);
transfersRouter.get('/api/asset_transfers', transfersController.listTransfers);
transfersRouter.put('/api/asset_transfers/:transferId/decision', transfersController.decideTransfer);
transfersRouter.put('/api/asset_transfers/:transferId/accept', transfersController.acceptTransfer);
