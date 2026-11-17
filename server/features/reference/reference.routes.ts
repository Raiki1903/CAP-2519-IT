/**
 * Reference data route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls reference.controller.ts.
 * Used by: the Reference Data page (TSG and the Secretary): asset categories, labs, and funding sources.
 */
import express from 'express';
import * as referenceController from './reference.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireAssetMasterEditor } from '../../shared/middleware/permissions';

/** The reference data endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const referenceRouter = express.Router();

// Every route needs a session, an Active account, and TSG or the Secretary, the roles that keep the asset master data.
const editor = [requireAuth, requireActive, requireAssetMasterEditor];

referenceRouter.get('/api/reference/categories', ...editor, referenceController.listCategories);
referenceRouter.post('/api/reference/categories', ...editor, referenceController.addCategory);
referenceRouter.put('/api/reference/categories/:code', ...editor, referenceController.changeCategory);
referenceRouter.get('/api/reference/labs', ...editor, referenceController.listLabs);
referenceRouter.post('/api/reference/labs', ...editor, referenceController.addLab);
referenceRouter.put('/api/reference/labs/:centerId', ...editor, referenceController.changeLab);
referenceRouter.get('/api/reference/funding-sources', ...editor, referenceController.listFundingSources);
referenceRouter.post('/api/reference/funding-sources', ...editor, referenceController.addFundingSource);
referenceRouter.put('/api/reference/funding-sources/:fundingSourceId', ...editor, referenceController.renameFundingSource);
