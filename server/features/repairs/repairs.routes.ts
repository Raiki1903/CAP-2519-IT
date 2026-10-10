import express from 'express';
import * as repairsController from './repairs.controller';

export const repairsRouter = express.Router();

repairsRouter.post('/api/assets/:assetTag/repair', repairsController.requestRepair);
repairsRouter.get('/api/asset_repairs', repairsController.listRepairs);
repairsRouter.put('/api/asset_repairs/:repairId', repairsController.updateRepair);
repairsRouter.put('/api/asset_repairs/:repairId/status', repairsController.updateRepairStatus);
