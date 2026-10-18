/**
 * Inspections service: the business rules for condition reports, and the two report lists.
 * Layer: service. Called by inspections.controller.ts. Calls inspections.repository.ts, features/assets/assets.repository.ts,
 * and inspections.validation.ts.
 * Used by: Custodian condition report (CustodianPortal), Staff inspection finalize (InspectionQueue),
 * the Staff inspection log, and state/serverData.tsx.
 */
import type { asset_reports } from '@prisma/client';
import type { InspectionReportInput, InspectionReportItem, ReportSummaryItem } from '@shared/types/inspections';
import * as inspectionsRepository from './inspections.repository';
import * as assetsRepository from '../assets/assets.repository';
import { readInspectionReport } from './inspections.validation';
import { AppError } from '../../shared/errors/AppError';

/**
 * Saves an inspection report and writes its condition and remarks onto the asset's newest record,
 * in one transaction. Known inspection defects stay as they are, each marked at its line and pinned by
 * tests/api/inspections.test.ts: the record and reporter defects below.
 *
 * @param assetTag the asset's tag from the URL, or its numeric asset_id
 * @param data the request body, its condition already checked by the controller (issue #53); every other field
 * has a fallback. reporterEmail and reportedById are ignored (issue #32)
 * @param reporterId the session user, who files the report
 * @returns the created asset_reports row
 * @throws AppError 404 if no asset has this tag (or, for a number, this id)
 */
export async function fileReport(assetTag: string, data: InspectionReportInput, reporterId: number): Promise<asset_reports> {
    // A tag that is a number is also tried as an asset_id.
    let asset = await assetsRepository.findByTag(assetTag);
    if (!asset && !isNaN(Number(assetTag))) {
        asset = await assetsRepository.findById(Number(assetTag));
    }

    if (!asset) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    const { condition, remarks: remarksVal, image: imgVal } = readInspectionReport(data);

    return inspectionsRepository.saveReport(
        {
            asset_id: asset.asset_id,
            reported_by_id: reporterId,
            report_condition: condition,
            report_remarks: remarksVal,
            report_img: imgVal || null,
        },
        (latestReport, latestRecord) => {
            // The asset takes the condition and remarks of its newest report, which is normally this one.
            const latestCondition = latestReport ? latestReport.report_condition : condition;
            const latestRemarks = latestReport ? latestReport.report_remarks : remarksVal;

            // TODO(H-14): the newest record is changed in place (it keeps its id and date), so the history loses the condition it had. Append a record instead, Phase 3 with the shared asset state rule.
            if (latestRecord) {
                return {
                    update: {
                        assetRecordId: latestRecord.asset_record_id,
                        data: {
                            asset_condition: latestCondition as any,
                            Asset_Remarks: latestRemarks,
                        },
                    },
                };
            }
            // An asset with no records gets its first one here.
            // TODO(H-09): "DLSU Campus" and the reporter as custodian are invented values, like the custodian history's made-up first entry. Phase 3.
            return {
                create: {
                    asset_id: asset.asset_id,
                    status: "ACTIVE",
                    asset_condition: latestCondition as any,
                    location: "DLSU Campus",
                    current_custodian: reporterId,
                    Asset_Remarks: latestRemarks
                },
            };
        },
    );
}

/**
 * Lists every report, newest first, in the short shape (no email, no image).
 *
 * @returns one ReportSummaryItem per asset_reports row
 */
export async function listReportSummaries(): Promise<ReportSummaryItem[]> {
    const [dbReports, dbUsers, dbAssets] = await inspectionsRepository.findSummaryLookups();
    return dbReports.map(r => {
        const rUser = dbUsers.find(u => u.user_id === r.reported_by_id);
        const asset = dbAssets.find(a => a.asset_id === r.asset_id);
        return {
            report_id: r.report_id,
            id: r.report_id,
            reportId: `RPT-${r.report_id}`,
            asset_id: r.asset_id,
            asset_tag: asset?.asset_tag || `EQ-2024-${r.asset_id}`,
            assetName: asset?.name || "Unknown Asset",
            reported_by_id: r.reported_by_id,
            reportedBy: rUser ? `${rUser.first_name} ${rUser.last_name}` : "Staff",
            // report_date is never null in the schema, so the current-time fallback is not reached.
            report_date: r.report_date ? r.report_date.toISOString() : new Date().toISOString(),
            reportDate: r.report_date ? r.report_date.toISOString() : new Date().toISOString(),
            condition: r.report_condition,
            remarks: r.report_remarks
        };
    });
}

/**
 * Lists every report, newest first, in the detailed shape (reporter email and image included).
 *
 * @returns one InspectionReportItem per asset_reports row
 */
export async function listInspectionReports(): Promise<InspectionReportItem[]> {
    const dbReports = await inspectionsRepository.findAllWithAssetAndReporter();

    return dbReports.map(r => ({
        reportId: r.report_id,
        assetId: r.assets.asset_tag,
        assetName: r.assets.name,
        reportedBy: `${r.users.first_name} ${r.users.last_name}`,
        reporterEmail: r.users.email,
        reportDate: r.report_date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        reportCondition: r.report_condition,
        reportRemarks: r.report_remarks,
        reportImg: r.report_img
    }));
}
