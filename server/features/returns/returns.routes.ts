import express from 'express';
import * as returnsController from './returns.controller';

export const returnsRouter = express.Router();

returnsRouter.post('/api/assets/:assetTag/return', returnsController.finalizeReturn);
returnsRouter.get('/api/asset_returns', returnsController.listReturns);
