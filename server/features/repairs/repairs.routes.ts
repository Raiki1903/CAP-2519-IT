/**
 * Repair route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls repairs.controller.ts.
 * Used by: Custodian repair request (RepairForm, ReturnForm), Staff repair queue and repair dialog
 * (useRepairTickets), the Staff analytics board (StaffAnalyticsView), and the screens that list repairs.
 */
import express from 'express';
import * as repairsController from './repairs.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';

/** The four repair endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const repairsRouter = express.Router();

// Every route needs a session; the roles are the approved 13b role table (rows 23 to 26).
repairsRouter.post('/api/assets/:assetTag/repair', requireAuth, requireRole('Custodian', 'LabHead', 'Staff'), repairsController.requestRepair);
repairsRouter.get('/api/asset_repairs', requireAuth, repairsController.listRepairs);
// Two endpoints change a ticket's status, with different side effects (H-06). Both kept in step 12, as decided.
repairsRouter.put('/api/asset_repairs/:repairId', requireAuth, requireRole('Staff'), repairsController.updateRepair);
repairsRouter.put('/api/asset_repairs/:repairId/status', requireAuth, requireRole('Staff'), repairsController.updateRepairStatus);
