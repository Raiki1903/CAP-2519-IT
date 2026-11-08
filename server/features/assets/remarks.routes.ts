/**
 * Asset remarks route table: reading, adding, and deleting the remarks on an asset.
 * Layer: routes. Mounted by server/app.ts. Calls remarks.controller.ts.
 * Used by: the Remarks section of the asset detail modal, in every view.
 */
import express from 'express';
import * as remarksController from './remarks.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireAnyRole } from '../../shared/middleware/permissions';

/** The asset remark endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const remarksRouter = express.Router();

// Any Active account reads the remarks. TSG, the Director, the Secretary, and a lab's Head add one (the service keeps
// a Head to its own lab's assets). Who may delete depends on the remark (its author, the home lab's Head, or the IT
// Admin), so the service checks it.
remarksRouter.get('/api/assets/:assetTag/remarks', requireAuth, requireActive, remarksController.listRemarks);
remarksRouter.post('/api/assets/:assetTag/remarks', requireAuth, requireActive, requireAnyRole('TSG_STAFF', 'ADRIC_DIRECTOR', 'ADRIC_SECRETARY', 'LAB_HEAD'), remarksController.addRemark);
remarksRouter.delete('/api/assets/:assetTag/remarks/:remarkId', requireAuth, requireActive, remarksController.deleteRemark);
