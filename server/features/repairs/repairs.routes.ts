/**
 * Repair route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls repairs.controller.ts.
 * Used by: Custodian repair request (RepairForm, ReturnForm), Staff repair queue and repair dialog
 * (useRepairTickets), the Staff analytics board (StaffAnalyticsView), and the screens that list repairs.
 */
import express from 'express';
import * as repairsController from './repairs.controller';

/** The four repair endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const repairsRouter = express.Router();

// TODO(C-02): anyone who can reach the server can list, open, and update repair tickets; no session or role is checked. requireAuth and requireRole, step 13.
repairsRouter.post('/api/assets/:assetTag/repair', repairsController.requestRepair);
repairsRouter.get('/api/asset_repairs', repairsController.listRepairs);
// Two endpoints change a ticket's status, with different side effects (H-06). Both kept in step 12, as decided.
repairsRouter.put('/api/asset_repairs/:repairId', repairsController.updateRepair);
repairsRouter.put('/api/asset_repairs/:repairId/status', repairsController.updateRepairStatus);
