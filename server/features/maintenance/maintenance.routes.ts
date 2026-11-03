/**
 * Repair route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls maintenance.controller.ts.
 * Used by: Custodian repair request (RepairForm, ReturnForm), Staff repair queue and repair dialog
 * (useRepairTickets), the Staff analytics board (StaffAnalyticsView), and the screens that list repairs.
 */
import express from 'express';
import * as maintenanceController from './maintenance.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireAnyRole, requireTsg } from '../../shared/middleware/permissions';

/** The four repair endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const maintenanceRouter = express.Router();

// Every route needs a session and an Active account. A Researcher, a Lab Head, or TSG reports an issue; TSG moves the
// ticket. The IT Admin and the Secretary have no asset steps.
maintenanceRouter.post('/api/assets/:assetTag/maintenance', requireAuth, requireActive, requireAnyRole('RESEARCHER', 'LAB_HEAD', 'TSG_STAFF'), maintenanceController.requestRepair);
maintenanceRouter.get('/api/maintenance', requireAuth, requireActive, maintenanceController.listRepairs);
// Two endpoints change a ticket's status, with different side effects (H-06). Both kept in step 12, as decided.
maintenanceRouter.put('/api/maintenance/:repairId', requireAuth, requireActive, requireTsg, maintenanceController.updateRepair);
maintenanceRouter.put('/api/maintenance/:repairId/status', requireAuth, requireActive, requireTsg, maintenanceController.updateRepairStatus);
