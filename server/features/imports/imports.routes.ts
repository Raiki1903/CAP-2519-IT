/**
 * Imports routes: endpoints for validating and saving project and asset CSV imports.
 * Layer: routes. Called by server/app.ts.
 * Calls: server/features/imports/imports.controller.ts and shared/middleware/ (requireAuth, permissions).
 * Used by: TSG Staff (assets and projects) and AdRIC Secretary (projects).
 */
import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth';
import {
  requireActive,
  requireAssetMasterEditor,
  requireTsg,
} from '../../shared/middleware/permissions';
import * as importsController from './imports.controller';

export const importsRouter = Router();

importsRouter.post(
  '/api/imports/projects/check',
  requireAuth,
  requireActive,
  requireAssetMasterEditor,
  importsController.checkProjects,
);

importsRouter.post(
  '/api/imports/projects',
  requireAuth,
  requireActive,
  requireAssetMasterEditor,
  importsController.saveProjects,
);

importsRouter.post(
  '/api/imports/assets/check',
  requireAuth,
  requireActive,
  requireTsg,
  importsController.checkAssets,
);

importsRouter.post(
  '/api/imports/assets',
  requireAuth,
  requireActive,
  requireTsg,
  importsController.saveAssets,
);

