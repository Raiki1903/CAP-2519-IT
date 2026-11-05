/**
 * Maintenance route table: which URL maps to which controller, and who may call it.
 * Layer: routes. Mounted by server/app.ts. Calls maintenance.controller.ts.
 * Used by: reporting an issue (RepairForm, ReturnForm, the asset modal, the Researcher's inspection report), the Staff
 * repair queue and dialog, the Staff analytics board, and the screens that list tickets.
 */
import express from 'express';
import * as maintenanceController from './maintenance.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireAnyRole, requireTsg } from '../../shared/middleware/permissions';

/** The maintenance endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const maintenanceRouter = express.Router();

// Every route needs a session and an Active account. The holder (a Researcher), the home lab's Head, or TSG reports an
// issue and the reporter or TSG cancels it (who exactly is checked in the service); TSG makes every physical step. The
// IT Admin has no asset steps and no ticket list.
maintenanceRouter.post('/api/assets/:assetTag/maintenance', requireAuth, requireActive, requireAnyRole('RESEARCHER', 'LAB_HEAD', 'TSG_STAFF'), maintenanceController.reportIssue);
maintenanceRouter.get('/api/maintenance', requireAuth, requireActive, requireAnyRole('TSG_STAFF', 'ADRIC_DIRECTOR', 'ADRIC_SECRETARY', 'LAB_HEAD', 'RESEARCHER'), maintenanceController.listTickets);
maintenanceRouter.put('/api/maintenance/:maintenanceId/receive', requireAuth, requireActive, requireTsg, maintenanceController.receive);
maintenanceRouter.put('/api/maintenance/:maintenanceId/cancel', requireAuth, requireActive, requireAnyRole('RESEARCHER', 'LAB_HEAD', 'TSG_STAFF'), maintenanceController.cancel);
