/**
 * Inspections service: the business rules for condition reports, and the two report lists.
 * Layer: service. Called by inspections.controller.ts. Calls inspections.repository.ts, features/assets/assets.repository.ts,
 * and inspections.validation.ts.
 * Used by: Custodian condition report (CustodianPortal), Staff inspection finalize (InspectionQueue),
 * the Staff inspection log, and state/serverData.tsx.
 */
import { asset_inspections_type, type asset_inspections } from '@prisma/client';
import type { SessionIdentity } from '@shared/types/auth';
import type { InspectionReportInput, InspectionReportItem, ReportSummaryItem } from '@shared/types/inspections';
import * as inspectionsRepository from './inspections.repository';
import * as assetsRepository from '../assets/assets.repository';
import { readInspectionReport } from './inspections.validation';
import { AppError } from '../../shared/errors/AppError';

/**
 * Saves an inspection report. The asset's condition now is worked out from its newest TSG inspection
 * (shared/services/assetState.ts), so nothing else is written.
 *
 * @param assetTag the asset's tag from the URL, or its numeric asset_id
 * @param data the request body, its condition already checked by the controller (issue #53); every other field
 * has a fallback. reporterEmail and reportedById are ignored (issue #32)
 * @param reporter the session user, who files the report. A TSG report is a routine inspection; anyone else's is
 * the holder's own report (Self Report), which never changes the asset's condition.
 * @returns the created asset_inspections row
 * @throws AppError 404 if no asset has this tag (or, for a number, this id)
 * @throws AppError 409 if the asset is retired
 */
// TODO(H-05): a report filed in the same instant as a retirement approval can pass the check. Batch 5 files inspections inside the step's transaction.
export async function fileReport(assetTag: string, data: InspectionReportInput, reporter: SessionIdentity): Promise<asset_inspections> {
    // A tag that is a number is also tried as an asset_id.
    let asset = await assetsRepository.findByTag(assetTag);
    if (!asset && !isNaN(Number(assetTag))) {
        asset = await assetsRepository.findById(Number(assetTag));
    }

    if (!asset) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    // A retired asset is out of use. An asset in maintenance is still accepted: Staff inspect assets in repair on
    // purpose (issue #88). The routine inspection rule of the lifecycle guard comes with the routine queue, Batch 5.
    if (asset.status === "RETIRED") {
        throw new AppError(409, `${asset.asset_tag} is retired and cannot take an inspection report.`);
    }

    const { condition, remarks: remarksVal, image: imgVal } = readInspectionReport(data);

    return inspectionsRepository.create({
        asset_id: asset.asset_id,
        inspected_by_id: reporter.userId,
        type: reporter.staffUnit === "TSG" ? asset_inspections_type.ROUTINE : asset_inspections_type.SELF_REPORT,
        condition,
        remarks: remarksVal,
        photo: imgVal || null,
    });
}

/**
 * Lists every report, newest first, in the short shape (no email, no image).
 *
 * @returns one ReportSummaryItem per asset_inspections row
 */
export async function listReportSummaries(): Promise<ReportSummaryItem[]> {
    const [dbReports, dbUsers, dbAssets] = await inspectionsRepository.findSummaryLookups();
    return dbReports.map(r => {
        const rUser = dbUsers.find(u => u.user_id === r.inspected_by_id);
        const asset = dbAssets.find(a => a.asset_id === r.asset_id);
        return {
            report_id: r.inspection_id,
            id: r.inspection_id,
            reportId: `RPT-${r.inspection_id}`,
            asset_id: r.asset_id,
            asset_tag: asset?.asset_tag || `EQ-2024-${r.asset_id}`,
            assetName: asset?.name || "Unknown Asset",
            reported_by_id: r.inspected_by_id,
            reportedBy: rUser ? `${rUser.first_name} ${rUser.last_name}` : "Staff",
            // report_date is never null in the schema, so the current-time fallback is not reached.
            report_date: r.inspected_at ? r.inspected_at.toISOString() : new Date().toISOString(),
            reportDate: r.inspected_at ? r.inspected_at.toISOString() : new Date().toISOString(),
            condition: r.condition,
            remarks: r.remarks
        };
    });
}

/**
 * Lists every report, newest first, in the detailed shape (reporter email and image included).
 *
 * @returns one InspectionReportItem per asset_inspections row
 */
export async function listInspectionReports(): Promise<InspectionReportItem[]> {
    const dbReports = await inspectionsRepository.findAllWithAssetAndReporter();

    return dbReports.map(r => ({
        reportId: r.inspection_id,
        assetId: r.assets.asset_tag,
        assetName: r.assets.name,
        reportedBy: `${r.users.first_name} ${r.users.last_name}`,
        reporterEmail: r.users.email,
        reportDate: r.inspected_at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        reportCondition: r.condition,
        reportRemarks: r.remarks,
        reportImg: r.photo
    }));
}
