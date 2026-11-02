/**
 * Repairs service: the business rules for repair tickets, their progress, and the asset status that follows them.
 * Layer: service. Called by maintenance.controller.ts. Calls maintenance.repository.ts, features/assets/assets.repository.ts,
 * shared/constants/poolCustodian.ts, and @shared/enums/assetCondition.
 * Used by: Custodian repair request (RepairForm, and ReturnForm's "flag for repair"), Staff repair queue,
 * repair dialog, and the Staff analytics board.
 */
import { asset_inspections_type, asset_maintenance_status, type Prisma, type asset_maintenance, type asset_records } from '@prisma/client';
import type { RepairListItem, RepairRequestInput } from '@shared/types/maintenance';
import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import * as maintenanceRepository from './maintenance.repository';
import * as assetsRepository from '../assets/assets.repository';
import { AppError } from '../../shared/errors/AppError';
import { POOL_CUSTODIAN_ID } from '../../shared/constants/poolCustodian';

/**
 * The progress texts the screens send (the repair dialog's and the Staff analytics board's), and the status each
 * stands for. The two outside services share one status; which one has the asset is kept as the provider.
 */
// TODO(H-07): the screens still send and show these texts. Batch 5 replaces them with the statuses and their labels.
const PROGRESS_TEXTS: Record<string, { status: asset_maintenance_status; provider?: string }> = {
    "Pending TSG Review": { status: asset_maintenance_status.PENDING_RECEIPT },
    "Awaiting Immediate Dispatch": { status: asset_maintenance_status.PENDING_RECEIPT },
    "Reported": { status: asset_maintenance_status.PENDING_RECEIPT },
    "Inspection Phase": { status: asset_maintenance_status.INSPECTING },
    "Diagnosing": { status: asset_maintenance_status.INSPECTING },
    "Waiting for Parts": { status: asset_maintenance_status.REPAIRING },
    "Warranty Holder Possession": { status: asset_maintenance_status.EXTERNAL_SERVICE, provider: "Warranty holder" },
    "Third-Party Repairer Possession": { status: asset_maintenance_status.EXTERNAL_SERVICE, provider: "Third-party repairer" },
    "Fixed & Completed": { status: asset_maintenance_status.RESOLVED },
    "Resolved": { status: asset_maintenance_status.RESOLVED },
};

/**
 * Reads a progress text the screens sent.
 *
 * @param progressText the text as sent
 * @returns the status it stands for, and the provider for an outside service
 * @throws AppError 400 for any other text: the status is an enum, so free text is no longer saved (H-07)
 */
function readProgressText(progressText: string): { status: asset_maintenance_status; provider?: string } {
    const read = Object.prototype.hasOwnProperty.call(PROGRESS_TEXTS, progressText) ? PROGRESS_TEXTS[progressText] : undefined;
    if (!read) {
        throw new AppError(400, `Unknown progress status: ${progressText}.`);
    }
    return read;
}

/**
 * The progress text the screens show for a ticket, the reverse of PROGRESS_TEXTS.
 *
 * @param ticket the ticket's status, urgency, and provider
 * @returns the text, for example "Inspection Phase"
 */
export function progressTextOf(ticket: Pick<asset_maintenance, 'status' | 'is_immediate' | 'provider'>): string {
    switch (ticket.status) {
        case asset_maintenance_status.PENDING_RECEIPT: return ticket.is_immediate ? "Awaiting Immediate Dispatch" : "Pending TSG Review";
        case asset_maintenance_status.INSPECTING: return "Inspection Phase";
        case asset_maintenance_status.REPAIRING: return "Waiting for Parts";
        case asset_maintenance_status.EXTERNAL_SERVICE: return ticket.provider === "Warranty holder" ? "Warranty Holder Possession" : "Third-Party Repairer Possession";
        case asset_maintenance_status.RESOLVED: return "Fixed & Completed";
        case asset_maintenance_status.BEYOND_REPAIR: return "Beyond Repair";
        case asset_maintenance_status.CANCELLED: return "Cancelled";
    }
}

// A safety net against the same ticket arriving twice within a few seconds (same tag, same
// description), from when RepairForm posted every ticket twice. The form posts once since step 8 part 2.
// If "🛑 Duplicate repair request blocked" shows in the log, a client is still sending twice.
// TODO(M-07): in memory and per server process, never emptied, and checked before the tag lookup, so an unknown tag sent twice answers 409, not 404. Kept in step 12 as decided; 01D deletes it, in its own behavior-change commit.
const recentRepairSubmissions = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 8000;

/**
 * Opens a repair ticket for an asset. Only the asset_maintenance row is written: the asset keeps its
 * status until Staff move the ticket into a maintenance status (updateRepair).
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked body: description and optional urgency
 * @param reporterId the session user, who reports the fault; any reporter name in the body is ignored (issue #32)
 * @returns the created asset_maintenance row
 * @throws AppError 409 if the same tag and description arrived less than 8 seconds ago (M-07)
 * @throws AppError 404 if no asset has this tag
 */
// TODO(H-05): no status check, so a disposed asset, or one already under repair, takes a new ticket. Its own fix; tests/api/maintenance.test.ts pins it.
export async function requestRepair(assetTag: string, data: RepairRequestInput, reporterId: number): Promise<asset_maintenance> {
    const dedupeKey = `${assetTag}::${data.description}`;
    const lastSeen = recentRepairSubmissions.get(dedupeKey);
    if (lastSeen && Date.now() - lastSeen < DUPLICATE_WINDOW_MS) {
        console.warn(`🛑 Duplicate repair request blocked for ${assetTag} (same description within ${DUPLICATE_WINDOW_MS / 1000}s)`);
        throw new AppError(409, "This exact repair request was just submitted — please wait a few seconds before retrying.");
    }
    recentRepairSubmissions.set(dedupeKey, Date.now());

    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    return maintenanceRepository.create({
        asset_id: existing.asset_id,
        reported_by_id: reporterId,
        issue_description: data.description,
        is_immediate: !!data.isImmediate,
        status: asset_maintenance_status.PENDING_RECEIPT,
    });
}

/**
 * Lists every repair ticket, newest first, shaped for the screens.
 *
 * @returns one RepairListItem per asset_maintenance row
 */
export async function listRepairs(): Promise<RepairListItem[]> {
    const [dbRepairs, dbAssets, dbUsers] = await maintenanceRepository.findListLookups();

    return dbRepairs.map(repair => {
        const asset = dbAssets.find(a => a.asset_id === repair.asset_id);
        const reporter = dbUsers.find(u => u.user_id === repair.reported_by_id);

        const submittedAt = repair.reported_at.toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
        });

        return {
            id: `MNT-${repair.maintenance_id}`,
            repairId: repair.maintenance_id,
            _source: "db",
            _repairId: repair.maintenance_id,
            assetId: asset?.asset_tag || `EQ-2024-${String(repair.asset_id).padStart(3, "0")}`,
            assetName: asset?.name || "Unknown Asset",
            // The screens label this "custodian", but it is the reporter, who may not hold the asset.
            custodian: reporter ? `${reporter.first_name} ${reporter.last_name}` : "Unassigned",
            reportedBy: reporter ? `${reporter.first_name} ${reporter.last_name}` : "Unassigned",
            description: repair.issue_description,
            statusLabel: progressTextOf(repair),
            progressStatus: progressTextOf(repair),
            isImmediate: repair.is_immediate,
            priority: repair.is_immediate ? "Critical" : "Medium",
            // There is no "acknowledged" column, so any status but the starting one counts as acknowledged.
            acknowledged: repair.status !== asset_maintenance_status.PENDING_RECEIPT,
            submittedAt,
            createdAt: repair.reported_at.toISOString(),
        };
    });
}

// The in-progress statuses. Each puts the asset into MAINTENANCE.
const MAINTENANCE_STATUSES: asset_maintenance_status[] = [
    asset_maintenance_status.INSPECTING,
    asset_maintenance_status.REPAIRING,
    asset_maintenance_status.EXTERNAL_SERVICE,
];
// Where a MAINTENANCE record says the asset is. The asset's real location is restored from its
// records when the repair completes.
const TSG_OFFICE_LOCATION = "Manila — TSG Office";

/**
 * Sets a ticket's progress status and moves the asset to match, in one transaction
 * (Acknowledge & Assign Technician, and the repair dialog's Update Progress).
 * - A maintenance status puts the asset into MAINTENANCE at the TSG Office, unless it is already there,
 *   so moving between the three statuses does not pile up records.
 * - "Fixed & Completed" restores the status, custodian, and location from the asset's newest record
 *   before maintenance (ACTIVE in the pool, or ON_LOAN under whoever had it, who is not necessarily
 *   the reporter), with the condition Staff picked, and files an inspection report.
 * - Any other text changes only the ticket.
 *
 * @param repairId the numeric ticket id
 * @param progressStatus the new status, already checked to be present
 * @param assetCondition the condition after a completed repair; anything not in ASSET_CONDITIONS keeps the current one
 * @param assetRemarks remarks for the completed repair; a default sentence when empty
 * @returns the updated asset_maintenance row
 * @throws AppError 400 if the progress text is not one the screens send
 * @throws AppError 404 if no ticket has this id
 */
// TODO(H-07): "Pending TSG Review" does not take the asset out of maintenance, and "Fixed & Completed" adds a record and a report even for a ticket that never went into maintenance. Batch 5 gives the statuses their allowed moves.
export async function updateRepair(
    repairId: number,
    progressStatus: string,
    assetCondition: string | undefined,
    assetRemarks: string | undefined,
): Promise<asset_maintenance> {
    const existing = await maintenanceRepository.findById(repairId);
    if (!existing) {
        throw new AppError(404, `No repair ticket found with id ${repairId}.`);
    }

    const progress = readProgressText(progressStatus);
    const isCompleting = progress.status === asset_maintenance_status.RESOLVED;
    const desiredStatus = isCompleting
        ? null // completion takes its status from the records before maintenance (completionRows)
        : MAINTENANCE_STATUSES.includes(progress.status)
            ? "MAINTENANCE"
            : null;

    return maintenanceRepository.saveProgress(
        repairId,
        progress,
        existing.asset_id,
        isCompleting
            ? (preMaintenanceRecord, latestRecord) => completionRows(existing, preMaintenanceRecord, latestRecord, assetCondition, assetRemarks)
            : null,
        desiredStatus
            ? (latestRecord) => maintenanceRecord(existing, desiredStatus, latestRecord)
            : null,
    );
}

/**
 * Builds the record and the report a "Fixed & Completed" update appends.
 * The record goes back to where the asset was before maintenance, not the TSG Office: it may still be
 * out on loan or transfer. The report is filed under the ticket's reporter, with the remarks cut to
 * the column's 255 characters.
 */
// Neither the record nor the report links back to the ticket: asset_records.maintenance_id stays null, here
// and in maintenanceRecord. Phase 3, with the repair status enum.
function completionRows(
    existing: asset_maintenance,
    preMaintenanceRecord: asset_records | null,
    latestRecord: asset_records | null,
    assetCondition: string | undefined,
    assetRemarks: string | undefined,
): maintenanceRepository.CompletionRows {
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
            current_location: preMaintenanceRecord?.current_location ?? preMaintenanceRecord?.location ?? latestRecord?.location ?? "Unassigned",
            current_custodian: preMaintenanceRecord?.current_custodian ?? POOL_CUSTODIAN_ID,
            Asset_Remarks: remarksVal,
        },
        report: {
            asset_id: existing.asset_id,
            inspected_by_id: existing.reported_by_id,
            type: asset_inspections_type.MAINTENANCE,
            condition: conditionVal,
            remarks: remarksVal.slice(0, 255),
        },
    };
}

/**
 * Builds the MAINTENANCE record for a maintenance status, or null when the asset's newest record
 * is already MAINTENANCE. Condition, home location, and custodian carry over from that record.
 */
function maintenanceRecord(
    existing: asset_maintenance,
    desiredStatus: "MAINTENANCE",
    latestRecord: asset_records | null,
): Prisma.asset_recordsUncheckedCreateInput | null {
    if (!latestRecord || latestRecord.status !== desiredStatus) {
        return {
            asset_id: existing.asset_id,
            status: desiredStatus,
            asset_condition: latestRecord?.asset_condition ?? "PERFECT",
            location: latestRecord?.location ?? "Unassigned",
            current_location: TSG_OFFICE_LOCATION,
            current_custodian: latestRecord?.current_custodian ?? POOL_CUSTODIAN_ID,
        };
    }
    return null;
}

/**
 * Sets only a ticket's status, for the Staff analytics board. The asset's status is not
 * changed, whatever the new status is, and no report is filed.
 *
 * @param repairId the id from the URL, unchecked (NaN if it was not a number)
 * @param progressStatus the progress text the board sent
 * @returns the updated asset_maintenance row
 * @throws AppError 400 if the progress text is not one the screens send
 */
// TODO(H-06): a second way to change a ticket's status, without updateRepair's asset changes. Kept in step 12 as decided; merging the two endpoints is its own behavior-change commit.
export function updateRepairStatus(repairId: number, progressStatus: string): Promise<asset_maintenance> {
    return maintenanceRepository.updateProgressStatus(repairId, readProgressText(String(progressStatus)));
}
