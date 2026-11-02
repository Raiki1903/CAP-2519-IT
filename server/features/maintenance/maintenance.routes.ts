/**
 * Repair route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls maintenance.controller.ts.
 * Used by: Custodian repair request (RepairForm, ReturnForm), Staff repair queue and repair dialog
 * (useRepairTickets), the Staff analytics board (StaffAnalyticsView), and the screens that list repairs.
 */
import express from 'express';
import * as maintenanceController from './maintenance.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';

/** The four repair endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const maintenanceRouter = express.Router();

// Every route needs a session; the roles are the approved 13b role table (rows 23 to 26).
maintenanceRouter.post('/api/assets/:assetTag/maintenance', requireAuth, requireRole('Custodian', 'LabHead', 'Staff'), maintenanceController.requestRepair);
maintenanceRouter.get('/api/maintenance', requireAuth, maintenanceController.listRepairs);
// Two endpoints change a ticket's status, with different side effects (H-06). Both kept in step 12, as decided.
maintenanceRouter.put('/api/maintenance/:repairId', requireAuth, requireRole('Staff'), maintenanceController.updateRepair);
maintenanceRouter.put('/api/maintenance/:repairId/status', requireAuth, requireRole('Staff'), maintenanceController.updateRepairStatus);
