import type { Prisma, asset_records, asset_repairs } from '@prisma/client';
import type { RepairListItem, RepairRequestInput } from '@shared/types/repairs';
import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import * as repairsRepository from './repairs.repository';
import { AppError } from '../../shared/errors/AppError';
import { DEFAULT_CUSTODIAN_ID } from '../../shared/constants/defaultCustodian';

// In-memory guard against a duplicate repair submission arriving within a
// few seconds of an identical one — same asset, same description. This is a
// safety net, not a fix for whatever's actually causing the client to send
// two requests; if "🛑 Duplicate repair request blocked" ever shows up in
// this log, that's confirmation the client really is double-sending, not a
// display/rendering illusion.
const recentRepairSubmissions = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 8000;

/** Opens a repair ticket for an asset. */
export async function requestRepair(assetTag: string, data: RepairRequestInput): Promise<asset_repairs> {
    const dedupeKey = `${assetTag}::${data.description}`;
    const lastSeen = recentRepairSubmissions.get(dedupeKey);
    if (lastSeen && Date.now() - lastSeen < DUPLICATE_WINDOW_MS) {
        console.warn(`🛑 Duplicate repair request blocked for ${assetTag} (same description within ${DUPLICATE_WINDOW_MS / 1000}s)`);
        throw new AppError(409, "This exact repair request was just submitted — please wait a few seconds before retrying.");
    }
    recentRepairSubmissions.set(dedupeKey, Date.now());

    const existing = await repairsRepository.findAssetByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    // Same free-text-name -> user_id lookup convention used by /borrow and
    // EditAssetDialog's custodian field, falling back to DEFAULT_CUSTODIAN_ID.
    let reporterId = DEFAULT_CUSTODIAN_ID;
    if (data.reportedBy) {
        const [first, ...rest] = String(data.reportedBy).replace(/^Dr\.\s*/i, "").split(" ");
        const match = await repairsRepository.findUserByName(first, rest.join(" "));
        if (match) reporterId = match.user_id;
    }

    return repairsRepository.create({
        asset_id: existing.asset_id,
        reported_by_id: reporterId,
        issue_description: data.description,
        is_immediate: !!data.isImmediate,
        progress_status: data.isImmediate ? "Awaiting Immediate Dispatch" : "Pending TSG Review",
    });
}

/** Lists every repair ticket, newest first, shaped for the screens. */
export async function listRepairs(): Promise<RepairListItem[]> {
    const [dbRepairs, dbAssets, dbUsers] = await repairsRepository.findListLookups();

    const DB_PENDING_STATUSES = ["Pending TSG Review", "Awaiting Immediate Dispatch"];

    return dbRepairs.map(repair => {
        const asset = dbAssets.find(a => a.asset_id === repair.asset_id);
        const reporter = dbUsers.find(u => u.user_id === repair.reported_by_id);

        const submittedAt = repair.created_at.toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
        });

        return {
            id: `MNT-${repair.repair_id}`,
            repairId: repair.repair_id,
            _source: "db",
            _repairId: repair.repair_id,
            assetId: asset?.asset_tag || `EQ-2024-${String(repair.asset_id).padStart(3, "0")}`,
            assetName: asset?.name || "Unknown Asset",
            custodian: reporter ? `${reporter.first_name} ${reporter.last_name}` : "Unassigned",
            reportedBy: reporter ? `${reporter.first_name} ${reporter.last_name}` : "Unassigned",
            description: repair.issue_description,
            statusLabel: repair.progress_status,
            progressStatus: repair.progress_status,
            isImmediate: repair.is_immediate,
            priority: repair.is_immediate ? "Critical" : "Medium",
            acknowledged: !DB_PENDING_STATUSES.includes(repair.progress_status),
            submittedAt,
            createdAt: repair.created_at.toISOString(),
        };
    });
}

// Update a repair ticket's progress status (ITSDashboard -> Acknowledge &
// Assign Technician, and RepairProgressDialog -> Update Progress). There's
// no separate "acknowledged" flag in the schema — the ITSDashboard treats
// any progress_status other than the two initial values /repair sets
// ("Pending TSG Review" / "Awaiting Immediate Dispatch") as acknowledged.
// This also moves the underlying asset in/out of MAINTENANCE to match:
// acknowledging (or any in-progress status) puts it into MAINTENANCE;
// "Fixed & Completed" restores whatever status/custodian the asset had
// immediately before it entered MAINTENANCE — ACTIVE (sitting in the
// pool, unclaimed) if that's where it was, or ON_LOAN under whichever
// custodian actually had it if it was checked out. It no longer assumes
// ON_LOAN-under-the-reporter unconditionally, since the reporter isn't
// necessarily who was holding the asset (e.g. a LabHead or TSG staffer
// can flag someone else's checked-out equipment for repair).
const MAINTENANCE_STATUSES = ["Inspection Phase", "Warranty Holder Possession", "Third-Party Repairer Possession"];
// Fixed current_location while an asset is in MAINTENANCE — restored from
// asset_records history once the repair completes.
const TSG_OFFICE_LOCATION = "Manila — TSG Office";

/** Sets a ticket's progress status and moves the asset into or out of MAINTENANCE to match. */
export async function updateRepair(
    repairId: number,
    progressStatus: string,
    assetCondition: string | undefined,
    assetRemarks: string | undefined,
): Promise<asset_repairs> {
    const existing = await repairsRepository.findById(repairId);
    if (!existing) {
        throw new AppError(404, `No repair ticket found with id ${repairId}.`);
    }

    const isCompleting = progressStatus === "Fixed & Completed";
    const desiredStatus = isCompleting
        ? null // resolved below, from pre-MAINTENANCE history
        : MAINTENANCE_STATUSES.includes(progressStatus)
            ? "MAINTENANCE"
            : null;

    return repairsRepository.saveProgress(
        repairId,
        progressStatus,
        existing.asset_id,
        isCompleting
            ? (preMaintenanceRecord, latestRecord) => completionRows(existing, preMaintenanceRecord, latestRecord, assetCondition, assetRemarks)
            : null,
        desiredStatus
            ? (latestRecord) => maintenanceRecord(existing, desiredStatus, latestRecord)
            : null,
    );
}

/** Builds the record and the report a "Fixed & Completed" update appends. */
function completionRows(
    existing: asset_repairs,
    preMaintenanceRecord: asset_records | null,
    latestRecord: asset_records | null,
    assetCondition: string | undefined,
    assetRemarks: string | undefined,
): repairsRepository.CompletionRows {
    const conditionVal = (ASSET_CONDITIONS.includes(assetCondition as any)
        ? assetCondition
        : latestRecord?.asset_condition ?? "PERFECT") as any;

    const remarksVal = String(assetRemarks || "Repair completed & verified fixed by technical staff.").trim();

    return {
        record: {
            asset_id: existing.asset_id,
            status: preMaintenanceRecord?.status ?? "ACTIVE",
            asset_condition: conditionVal,
            location: latestRecord?.location ?? "Unassigned",
            // Restore wherever the asset actually was before it went
            // into maintenance (could still be out on loan/transfer,
            // not necessarily home) — not the TSG Office holding spot.
            current_location: preMaintenanceRecord?.current_location ?? preMaintenanceRecord?.location ?? latestRecord?.location ?? "Unassigned",
            current_custodian: preMaintenanceRecord?.current_custodian ?? DEFAULT_CUSTODIAN_ID,
            Asset_Remarks: remarksVal,
        },
        report: {
            asset_id: existing.asset_id,
            reported_by_id: existing.reported_by_id || DEFAULT_CUSTODIAN_ID,
            report_condition: conditionVal,
            report_remarks: remarksVal.slice(0, 255),
        },
    };
}

/** Builds the MAINTENANCE record for a maintenance status, or null if the asset is already in it. */
function maintenanceRecord(
    existing: asset_repairs,
    desiredStatus: "MAINTENANCE",
    latestRecord: asset_records | null,
): Prisma.asset_recordsUncheckedCreateInput | null {
    // Skip if the asset is already in the target status — avoids
    // piling up redundant records as the ticket moves between the
    // various in-progress statuses (which all map to MAINTENANCE).
    if (!latestRecord || latestRecord.status !== desiredStatus) {
        return {
            asset_id: existing.asset_id,
            status: desiredStatus,
            asset_condition: latestRecord?.asset_condition ?? "PERFECT",
            location: latestRecord?.location ?? "Unassigned",
            current_location: TSG_OFFICE_LOCATION,
            current_custodian: latestRecord?.current_custodian ?? DEFAULT_CUSTODIAN_ID,
        };
    }
    return null;
}

/** Sets only a ticket's progress_status. */
export function updateRepairStatus(repairId: number, progressStatus: string): Promise<asset_repairs> {
    return repairsRepository.updateProgressStatus(repairId, String(progressStatus));
}
