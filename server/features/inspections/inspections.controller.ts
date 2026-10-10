import type { Request, Response } from 'express';
import * as inspectionsService from './inspections.service';
import { AppError } from '../../shared/errors/AppError';

// POST Asset Inspection Report (saves directly to asset_reports table in MySQL)
export async function fileReport(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
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

// GET all asset_reports directly from database
export async function listReportSummaries(req: Request, res: Response): Promise<void> {
    try {
        const reports = await inspectionsService.listReportSummaries();
        res.json({ success: true, reports });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
}

// GET All Asset Inspection Reports from asset_reports table
export async function listInspectionReports(_req: Request, res: Response): Promise<void> {
    try {
        const reports = await inspectionsService.listInspectionReports();
        res.json({ success: true, reports });
    } catch (error: any) {
        console.error("❌ Failed to fetch asset reports:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}
