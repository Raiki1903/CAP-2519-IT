/**
 * Reference data controller: reads the request, calls the service with the session user, and writes the JSON answers.
 * Layer: controller. Called by reference.routes.ts. Calls reference.validation.ts, reference.service.ts, and
 * shared/middleware/requireAuth.ts (sessionUserOf: who is acting).
 * Used by: the Reference Data page (TSG and the Secretary).
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as referenceService from './reference.service';
import {
    readCategoryCreate,
    readCategoryUpdate,
    readCenterId,
    readFundingSourceBody,
    readFundingSourceId,
    readLabCreate,
    readLabUpdate,
} from './reference.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/** Handles GET /api/reference/categories: `{ success, categories }`, inactive ones too, with their asset counts. */
export async function listCategories(req: Request, res: Response): Promise<void> {
    res.json({ success: true, categories: await referenceService.listReferenceCategories() });
}

/**
 * Handles POST /api/reference/categories: answers 201 `{ success, category }`, or 400 a wrong value, or 409 a label or
 * code already taken.
 */
export async function addCategory(req: Request, res: Response): Promise<void> {
    const category = await referenceService.addCategory(readCategoryCreate(req.body), sessionUserOf(req).userId);
    res.status(201).json({ success: true, category });
}

/**
 * Handles PUT /api/reference/categories/:code: answers `{ success, category }`, or 400 a wrong value or a code in the
 * body, 404 an unknown code, or 409 a label already taken.
 */
export async function changeCategory(req: Request<{ code: string }>, res: Response): Promise<void> {
    const data = readCategoryUpdate(req.body);
    const category = await referenceService.changeCategory(req.params.code, data, sessionUserOf(req).userId);
    res.json({ success: true, category });
}

/** Handles GET /api/reference/labs: `{ success, labs }`, with their campus and asset counts. */
export async function listLabs(req: Request, res: Response): Promise<void> {
    res.json({ success: true, labs: await referenceService.listReferenceLabs() });
}

/** Handles POST /api/reference/labs: answers 201 `{ success, lab }`, or 400 a wrong value, or 409 a short code already taken. */
export async function addLab(req: Request, res: Response): Promise<void> {
    const lab = await referenceService.addLab(readLabCreate(req.body), sessionUserOf(req).userId);
    res.status(201).json({ success: true, lab });
}

/**
 * Handles PUT /api/reference/labs/:centerId: answers `{ success, lab }`, or 400 a wrong value or a short code in the
 * body, or 404 an unknown lab.
 */
export async function changeLab(req: Request<{ centerId: string }>, res: Response): Promise<void> {
    const centerId = readCenterId(req.params.centerId);
    const data = readLabUpdate(req.body);
    const lab = await referenceService.changeLab(centerId, data, sessionUserOf(req).userId);
    res.json({ success: true, lab });
}

/**
 * Handles DELETE /api/reference/labs/:centerId: answers `{ success: true }`, or 400 an invalid id, 404 an unknown lab,
 * or 409 if the lab is in use.
 */
export async function removeLab(req: Request<{ centerId: string }>, res: Response): Promise<void> {
    const centerId = readCenterId(req.params.centerId);
    await referenceService.removeLab(centerId, sessionUserOf(req).userId);
    res.json({ success: true });
}

/** Handles GET /api/reference/funding-sources: `{ success, fundingSources }`, with their asset and project counts. */
export async function listFundingSources(req: Request, res: Response): Promise<void> {
    res.json({ success: true, fundingSources: await referenceService.listReferenceFundingSources() });
}

/** Handles POST /api/reference/funding-sources: answers 201 `{ success, fundingSource }`, or 400, or 409 a name already taken. */
export async function addFundingSource(req: Request, res: Response): Promise<void> {
    const fundingSource = await referenceService.addFundingSource(readFundingSourceBody(req.body), sessionUserOf(req).userId);
    res.status(201).json({ success: true, fundingSource });
}

/**
 * Handles PUT /api/reference/funding-sources/:fundingSourceId: answers `{ success, fundingSource }`, or 400, 404 an
 * unknown funding source, or 409 a name already taken.
 */
export async function renameFundingSource(req: Request<{ fundingSourceId: string }>, res: Response): Promise<void> {
    const fundingSourceId = readFundingSourceId(req.params.fundingSourceId);
    const data = readFundingSourceBody(req.body);
    const fundingSource = await referenceService.renameFundingSource(fundingSourceId, data, sessionUserOf(req).userId);
    res.json({ success: true, fundingSource });
}
