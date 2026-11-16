/**
 * Imports controller: dispatches CSV validation and atomic save actions for projects and assets.
 * Layer: controller. Called by server/features/imports/imports.routes.ts.
 * Calls: server/features/imports/imports.validation.ts, imports.service.ts, shared/middleware/requireAuth.ts.
 * Used by: bulk CSV import of projects and assets.
 */
import type { Request, Response } from 'express';
import { sessionUserOf } from '../../shared/middleware/requireAuth';
import { readImportBody } from './imports.validation';
import * as importsService from './imports.service';

/**
 * Validates a projects CSV without saving changes.
 *
 * @param req request carrying JSON with csv text
 * @param res HTTP 200 with ImportCheckResult
 */
export async function checkProjects(req: Request, res: Response): Promise<void> {
  const csv = readImportBody(req.body);
  const result = await importsService.checkProjects(csv);
  res.json(result);
}

/**
 * Atomically saves a projects CSV batch. Returns HTTP 400 with validation errors if invalid.
 *
 * @param req request carrying JSON with csv text
 * @param res HTTP 200 with ImportSaveResult, or HTTP 400 with ImportCheckResult on error
 */
export async function saveProjects(req: Request, res: Response): Promise<void> {
  const csv = readImportBody(req.body);
  const user = sessionUserOf(req);
  const result = await importsService.saveProjects(csv, user);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
}

/**
 * Validates an assets CSV without saving changes.
 *
 * @param req request carrying JSON with csv text
 * @param res HTTP 200 with ImportCheckResult
 */
export async function checkAssets(req: Request, res: Response): Promise<void> {
  const csv = readImportBody(req.body);
  const result = await importsService.checkAssets(csv);
  res.json(result);
}

/**
 * Atomically saves an assets CSV batch. Returns HTTP 400 with validation errors if invalid.
 *
 * @param req request carrying JSON with csv text
 * @param res HTTP 200 with ImportSaveResult, or HTTP 400 with ImportCheckResult on error
 */
export async function saveAssets(req: Request, res: Response): Promise<void> {
  const csv = readImportBody(req.body);
  const user = sessionUserOf(req);
  const result = await importsService.saveAssets(csv, user);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
}

