/**
 * Repairs service: the business rules for repair tickets, their progress, and the asset status that follows them.
 * Layer: service. Called by maintenance.controller.ts. Calls maintenance.repository.ts, features/assets/assets.repository.ts,
 * shared/services/lifecycleGuard.ts, shared/services/assetState.ts, and @shared (conditions and labels).
 * Used by: Custodian repair request (RepairForm, and ReturnForm's "flag for repair"), Staff repair queue,
 * repair dialog, and the Staff analytics board.
 */
import { asset_maintenance_status, type asset_condition, type asset_maintenance } from '@prisma/client';
import type { RepairListItem, RepairRequestInput } from '@shared/types/maintenance';
import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import * as maintenanceRepository from './maintenance.repository';
import * as assetsRepository from '../assets/assets.repository';
import { MAINTENANCE_STATUS_LABELS } from '@shared/constants/maintenanceStatuses';
import { AppError } from '../../shared/errors/AppError';
import { assertActionAllowed } from '../../shared/services/lifecycleGuard';

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
 * The progress text the screens show for a ticket, the reverse of PROGRESS_TEXTS. A status the screens have no
 * text of their own for shows its label.
 *
 * @param ticket the ticket's status, urgency, and provider
 * @returns the text, for example "Inspection Phase"
 */
export function progressTextOf(ticket: Pick<asset_maintenance, 'status' | 'provider'>): string {
    switch (ticket.status) {
        case asset_maintenance_status.PENDING_RECEIPT: return "Pending TSG Review";
        case asset_maintenance_status.INSPECTING: return "Inspection Phase";
        case asset_maintenance_status.REPAIRING: return "Waiting for Parts";
        case asset_maintenance_status.EXTERNAL_SERVICE: return ticket.provider === "Warranty holder" ? "Warranty Holder Possession" : "Third-Party Repairer Possession";
        case asset_maintenance_status.RESOLVED: return "Fixed & Completed";
        case asset_maintenance_status.BEYOND_REPAIR:
        case asset_maintenance_status.CANCELLED:
            return MAINTENANCE_STATUS_LABELS[ticket.status];
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
 * status until Staff receive it (a maintenance status in updateRepair).
 * The lifecycle guard takes a ticket only on an asset that is Available or On Loan.
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked body: the description
 * @param reporterId the session user, who reports the fault; any reporter name in the body is ignored (issue #32)
 * @returns the created asset_maintenance row
 * @throws AppError 409 if the same tag and description arrived less than 8 seconds ago (M-07)
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 409 if the asset's status takes no ticket (in maintenance, pending retirement, retired, or missing)
 */
// TODO(H-05): a second open ticket on the same asset is still taken. Batch 5 refuses it.
export async function requestRepair(assetTag: string, data: RepairRequestInput, reporterId: number): Promise<asset_maintenance> {
    const dedupeKey = `${assetTag}::${data.description}`;
    const lastSeen = recentRepairSubmissions.get(dedupeKey);
    if (lastSeen && Date.now() - lastSeen < DUPLICATE_WINDOW_MS) {
        console.warn(`Duplicate maintenance request for ${assetTag} refused (same description within ${DUPLICATE_WINDOW_MS / 1000}s)`);
        throw new AppError(409, "This exact repair request was just submitted — please wait a few seconds before retrying.");
    }
    recentRepairSubmissions.set(dedupeKey, Date.now());

    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }
    assertActionAllowed(existing, "START_MAINTENANCE");

    return maintenanceRepository.create({
        asset_id: existing.asset_id,
        reported_by_id: reporterId,
        issue_description: data.description,
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
            // TODO(H-07): every ticket shows the same priority. Batch 5 shows the issue type instead.
            priority: "Medium",
            // There is no "acknowledged" column, so any status but the starting one counts as acknowledged.
            acknowledged: repair.status !== asset_maintenance_status.PENDING_RECEIPT,
            submittedAt,
            createdAt: repair.reported_at.toISOString(),
        };
    });
}

// The statuses of a ticket whose asset TSG has received. Moving a ticket into one of them receives the asset.
const RECEIVED_STATUSES: asset_maintenance_status[] = [
    asset_maintenance_status.INSPECTING,
    asset_maintenance_status.REPAIRING,
    asset_maintenance_status.EXTERNAL_SERVICE,
];

/**
 * Sets a ticket's progress status and moves the asset to match, in one transaction
 * (Acknowledge & Assign Technician, and the repair dialog's Update Progress).
 * - A received status (Inspection Phase, Waiting for Parts, an outside service) receives the asset the first time:
 *   the lifecycle guard must allow it, the asset goes to Maintenance (at the TSG Office), and a held loan ends as
 *   Ended by Maintenance. Moving between received statuses changes only the ticket.
 * - "Fixed & Completed" closes the ticket as Resolved, files a Maintenance inspection under the Staff member with the
 *   condition picked, and puts an asset that was in Maintenance back to Available.
 * - Any other text changes only the ticket.
 *
 * @param repairId the numeric ticket id
 * @param progressStatus the new status, already checked to be present
 * @param assetCondition the condition after a completed repair; anything not in ASSET_CONDITIONS keeps the current one
 * @param assetRemarks remarks for the completed repair; a default sentence when empty
 * @param staffId the session user, who receives the asset or completes the repair
 * @returns the updated asset_maintenance row
 * @throws AppError 400 if the progress text is not one the screens send
 * @throws AppError 404 if no ticket has this id
 * @throws AppError 409 if receiving the asset is refused by its status (retired, pending retirement, or missing)
 */
// TODO(H-07): "Pending TSG Review" does not take the asset out of maintenance, and "Fixed & Completed" files an inspection even for a ticket that was never received. Batch 5 gives the statuses their allowed moves.
export async function updateRepair(
    repairId: number,
    progressStatus: string,
    assetCondition: string | undefined,
    assetRemarks: string | undefined,
    staffId: number,
): Promise<asset_maintenance> {
    const existing = await maintenanceRepository.findById(repairId);
    if (!existing) {
        throw new AppError(404, `No repair ticket found with id ${repairId}.`);
    }

    const progress = readProgressText(progressStatus);
    const asset = await assetsRepository.findDetailById(existing.asset_id);
    if (!asset) {
        throw new AppError(404, `No asset found for repair ticket ${repairId}.`);
    }

    if (RECEIVED_STATUSES.includes(progress.status) && asset.status !== "MAINTENANCE") {
        assertActionAllowed(asset, "RECEIVE_FOR_MAINTENANCE");
        return maintenanceRepository.saveReceipt(existing, progress, staffId);
    }

    if (progress.status === asset_maintenance_status.RESOLVED) {
        const current = (await assetsRepository.findState(asset)).condition;
        const condition = (ASSET_CONDITIONS.includes(assetCondition as string)
            ? assetCondition
            : current?.condition ?? "PERFECT") as asset_condition;
        const remarks = String(assetRemarks || "Repair completed & verified fixed by technical staff.").trim();
        return maintenanceRepository.saveCompletion(existing, progress, staffId, condition, remarks, asset.status === "MAINTENANCE");
    }

    return maintenanceRepository.updateProgressStatus(repairId, progress);
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
