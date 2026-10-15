/**
 * Transfer route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls transfers.controller.ts.
 * Used by: Custodian transfer request (TransferForm), Lab Head approval (Custody tab and the bell), and the screens that list transfers.
 */
import express from 'express';
import * as transfersController from './transfers.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';

/** The four transfer endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const transfersRouter = express.Router();

// TODO(C-02): anyone who can reach the server can list, request, decide, and "accept" transfers; no session or role is checked. requireAuth and requireRole, step 13.
transfersRouter.post('/api/assets/:assetTag/transfer', requireAuth, requireRole('Custodian'), transfersController.requestTransfer);
transfersRouter.get('/api/asset_transfers', requireAuth, transfersController.listTransfers);
transfersRouter.put('/api/asset_transfers/:transferId/decision', requireAuth, requireRole('LabHead'), transfersController.decideTransfer);
// No screen calls /accept. (M-12)
transfersRouter.put('/api/asset_transfers/:transferId/accept', requireAuth, requireRole('Custodian'), transfersController.acceptTransfer);
