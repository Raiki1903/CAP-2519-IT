/**
 * Inspection controller: unpacks inspection requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by inspections.routes.ts. Calls inspections.service.ts.
 * Used by: Custodian condition report, Staff inspection finalize, the Staff inspection log, and state/serverData.tsx.
 */
import type { Request, Response } from 'express';
import * as inspectionsService from './inspections.service';
import { AppError } from '../../shared/errors/AppError';

/**
 * Handles POST /api/assets/:assetTag/inspection: saves a condition report to asset_reports and
 * writes its condition onto the asset.
 * Answers `{ success, report }` with the new row, 404 for an unknown asset, or 500.
 * No validation runs here: the body is read by the service, after the asset lookup.
 */
// TODO(H-16): the 500 answers here and below send the database's own error text to the browser. errorHandler, step 13.
export async function fileReport(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        // Printed before the lookups, so a refused report still shows in the server terminal.
        console.log(`📋 Server received inspection report for ${assetTag}:`, data);

        const newReport = await inspectionsService.fileReport(assetTag, data);

        console.log("✅ Inspection report saved under asset_reports in DB:", newReport.report_id);
        res.json({ success: true, report: newReport });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ Failed to save inspection report:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to save inspection report." });
    }
}

/**
 * Handles GET /api/asset_reports: every report, newest first, in the short shape, as `{ success, reports }`.
 * A failure answers 500 with the raw message and prints nothing, as before.
 */
export async function listReportSummaries(req: Request, res: Response): Promise<void> {
    try {
        const reports = await inspectionsService.listReportSummaries();
        res.json({ success: true, reports });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
}

/**
 * Handles GET /api/asset-reports: every report, newest first, in the detailed shape, as `{ success, reports }`.
 * A failure answers 500 with the raw message.
 */
export async function listInspectionReports(_req: Request, res: Response): Promise<void> {
    try {
        const reports = await inspectionsService.listInspectionReports();
        res.json({ success: true, reports });
    } catch (error: any) {
        console.error("❌ Failed to fetch asset reports:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
