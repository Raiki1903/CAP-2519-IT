/**
 * Inspections service: the business rules for filing a Routine inspection (TSG) or a Self Report (the holder), the
 * routine queue, and the two report lists.
 * Layer: service. Called by inspections.controller.ts. Calls inspections.repository.ts, features/assets/assets.repository.ts
 * (the asset lock and the reads inside it), features/assets/assets.service.ts (the asset list's shape),
 * shared/services/lifecycleGuard.ts, shared/services/assetState.ts (the holder), shared/services/inspectionShape.ts, and,
 * inside the step's transaction, shared/services/inspections.ts (the inspection writer).
 * Used by: Custodian condition report (CustodianPortal), Staff inspection finalize and the routine queue
 * (InspectionQueue), the Staff inspection log, and state/serverData.tsx.
 */
import type { InspectionInput } from '@shared/types/assets';
import type { SessionIdentity } from '@shared/types/auth';
import type { Inspection, InspectionReportItem, ReportSummaryItem, RoutineQueueEntry, RoutineQueueFilters, RoutineQueueGroup } from '@shared/types/inspections';
import { INSPECTION_LAB_GROUPS, OTHER_INSPECTION_GROUP_ID, inspectionGroupIdOf } from '@shared/constants/inspectionGroups';
import * as inspectionsRepository from './inspections.repository';
import * as assetsRepository from '../assets/assets.repository';
import * as assetsService from '../assets/assets.service';
import { AppError } from '../../shared/errors/AppError';
import { hasAccessRole } from '../../shared/middleware/permissions';
import { assertActionAllowed } from '../../shared/services/lifecycleGuard';
import { holderOf } from '../../shared/services/assetState';
import { inspectionOf } from '../../shared/services/inspectionShape';
import { writeInspection } from '../../shared/services/inspections';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** The 403 message when someone who is not TSG files an inspection on an asset they do not hold. */
export const NOT_THE_HOLDER_INSPECTION_MESSAGE = "Only the person who holds this asset can send a self report on it.";

/** What a filing answers: the inspection in the contract's shape, and the asset it was filed on. */
export interface FiledInspection {
    inspection: Inspection;
    assetId: number;
}

/**
 * Files an inspection, in one transaction that locks the asset first. TSG files a Routine inspection, which needs the
 * asset Available (the guard). Anyone else files a Self Report, which needs them to hold the asset (an On Loan or Return
 * Requested loan of theirs) and the asset On Loan. A Self Report never changes the asset's condition: that is the
 * newest TSG inspection (shared/services/assetState.ts). (H-05)
 *
 * @param assetTag the asset's tag from the URL, or its numeric asset_id
 * @param input the checked inspection
 * @param actor the session user, TSG or a Researcher (the route checks it)
 * @returns the new inspection, in the Inspection shape, and the asset's id
 * @throws AppError 404 if no asset has this tag (or, for a number, this id)
 * @throws AppError 403 NOT_THE_HOLDER_INSPECTION_MESSAGE for a Researcher who does not hold the asset
 * @throws AppError 400 if a metric does not apply to the asset; nothing is written
 * @throws AppError 409 if the guard refuses
 */
export async function fileInspection(assetTag: string, input: InspectionInput, actor: SessionIdentity): Promise<FiledInspection> {
    // A tag that is a number is also tried as an asset_id.
    let asset = await assetsRepository.findByTag(assetTag);
    if (!asset && !isNaN(Number(assetTag))) {
        asset = await assetsRepository.findById(Number(assetTag));
    }
    if (!asset) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }
    const assetId = asset.asset_id;
    const byTsg = hasAccessRole(actor, ["TSG_STAFF"]);

    const written = await assetsRepository.withAssetLock(assetId, async (tx) => {
        const current = await assetsRepository.findAssetIn(tx, assetId);
        if (byTsg) {
            assertActionAllowed(current, "ROUTINE_INSPECTION");
        } else {
            if (holderOf(await assetsRepository.findOpenLoanIn(tx, assetId))?.userId !== actor.userId) {
                throw new AppError(403, NOT_THE_HOLDER_INSPECTION_MESSAGE);
            }
            assertActionAllowed(current, "SELF_REPORT_INSPECTION");
        }
        return writeInspection(tx, { assetId, type: byTsg ? "ROUTINE" : "SELF_REPORT", input, inspectorId: actor.userId });
    });

    const { row, baselines } = await inspectionsRepository.findInspectionWithBaselines(written.inspection_id);
    return { inspection: inspectionOf(row, baselines, actor)!, assetId };
}

/** Oldest TSG inspection first; an asset TSG never inspected comes before all, then by asset id. */
function oldestInspectionFirst(a: { asset: { assetId: number }; at: Date | null }, b: { asset: { assetId: number }; at: Date | null }): number {
    if (a.at === null || b.at === null) {
        if (a.at !== b.at) return a.at === null ? -1 : 1;
    } else if (a.at.getTime() !== b.at.getTime()) {
        return a.at.getTime() - b.at.getTime();
    }
    return a.asset.assetId - b.asset.assetId;
}

/**
 * The routine queue (contract 7.6): Available assets that TSG last inspected more than `days` days ago, or never, by
 * inspection group (Group A to D, then Other), each group oldest inspection first. On Loan, Maintenance, Pending
 * Retirement, Retired, and Missing assets are never in it. Every group is listed, even with no asset due.
 *
 * @param filters the period in days and an optional home lab
 * @param viewer the session user, TSG (the route checks it)
 * @returns the five groups
 */
export async function routineQueue(filters: RoutineQueueFilters, viewer: SessionIdentity): Promise<RoutineQueueGroup[]> {
    const assets = await assetsService.listAssets(viewer, { status: "AVAILABLE", centerId: filters.centerId });
    const last = await inspectionsRepository.findLastTsgInspections(assets.map(a => a.assetId));
    const dueBefore = Date.now() - filters.days * MS_PER_DAY;

    const due = assets
        .map(asset => ({ asset, at: last.get(asset.assetId) ?? null }))
        .filter(e => e.at === null || e.at.getTime() < dueBefore)
        .sort(oldestInspectionFirst);
    const entriesOf = (groupId: string): RoutineQueueEntry[] => due
        .filter(e => inspectionGroupIdOf(e.asset.homeLab.code) === groupId)
        .map(e => ({ asset: e.asset, lastTsgInspectionAt: e.at ? e.at.toISOString() : null }));

    const groups: RoutineQueueGroup[] = INSPECTION_LAB_GROUPS.map(g => ({ group: g.id, name: g.name, labs: [...g.labs], assets: entriesOf(g.id) }));
    const other = entriesOf(OTHER_INSPECTION_GROUP_ID);
    groups.push({
        group: OTHER_INSPECTION_GROUP_ID,
        name: OTHER_INSPECTION_GROUP_ID,
        labs: [...new Set(other.map(e => e.asset.homeLab.code))].sort(),
        assets: other,
    });
    return groups;
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
