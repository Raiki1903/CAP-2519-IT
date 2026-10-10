import type { asset_reports } from '@prisma/client';
import type { InspectionReportInput, InspectionReportItem, ReportSummaryItem } from '@shared/types/inspections';
import * as inspectionsRepository from './inspections.repository';
import { readInspectionReport } from './inspections.validation';
import { AppError } from '../../shared/errors/AppError';
import { DEFAULT_CUSTODIAN_ID } from '../../shared/constants/defaultCustodian';

/** Saves an inspection report and writes its condition onto the asset's records. */
export async function fileReport(assetTag: string, data: InspectionReportInput): Promise<asset_reports> {
    let asset = await inspectionsRepository.findAssetByTag(assetTag);
    if (!asset && !isNaN(Number(assetTag))) {
        asset = await inspectionsRepository.findAssetById(Number(assetTag));
    }

    if (!asset) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    let reporterId = DEFAULT_CUSTODIAN_ID;
    if (data.reporterEmail) {
        const u = await inspectionsRepository.findUserByEmail(data.reporterEmail);
        if (u) reporterId = u.user_id;
    } else if (data.reportedById) {
        reporterId = Number(data.reportedById);
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
            const latestCondition = latestReport ? latestReport.report_condition : condition;
            const latestRemarks = latestReport ? latestReport.report_remarks : remarksVal;

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

/** Lists every report, newest first, in the short shape. */
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
            report_date: r.report_date ? r.report_date.toISOString() : new Date().toISOString(),
            reportDate: r.report_date ? r.report_date.toISOString() : new Date().toISOString(),
            condition: r.report_condition,
            remarks: r.report_remarks
        };
    });
}

/** Lists every report, newest first, in the detailed shape. */
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
