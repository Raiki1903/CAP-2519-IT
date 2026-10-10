/**
 * Repairs service: the business rules for repair tickets, their progress, and the asset status that follows them.
 * Layer: service. Called by repairs.controller.ts. Calls repairs.repository.ts, shared/constants/defaultCustodian.ts,
 * and @shared/enums/assetCondition.
 * Used by: Custodian repair request (RepairForm, and ReturnForm's "flag for repair"), Staff repair queue,
 * repair dialog, and the Staff analytics board.
 */
import type { Prisma, asset_records, asset_repairs } from '@prisma/client';
import type { RepairListItem, RepairRequestInput } from '@shared/types/repairs';
import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import * as repairsRepository from './repairs.repository';
import { AppError } from '../../shared/errors/AppError';
import { DEFAULT_CUSTODIAN_ID } from '../../shared/constants/defaultCustodian';

// A safety net against the same ticket arriving twice within a few seconds (same tag, same
// description), from when RepairForm posted every ticket twice. The form posts once since step 8 part 2.
// If "🛑 Duplicate repair request blocked" shows in the log, a client is still sending twice.
// TODO(M-07): in memory and per server process, never emptied, and checked before the tag lookup, so an unknown tag sent twice answers 409, not 404. Kept in step 12 as decided; 01D deletes it, in its own behavior-change commit.
const recentRepairSubmissions = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 8000;

/**
 * Opens a repair ticket for an asset. Only the asset_repairs row is written: the asset keeps its
 * status until Staff move the ticket into a maintenance status (updateRepair).
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked body: description, optional reporter name and urgency
 * @returns the created asset_repairs row
 * @throws AppError 409 if the same tag and description arrived less than 8 seconds ago (M-07)
 * @throws AppError 404 if no asset has this tag
 */
// TODO(H-05): no status check, so a disposed asset, or one already under repair, takes a new ticket. Its own fix; tests/api/repairs.test.ts pins it.
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

    // The form sends the reporter as a typed name, split and matched the same way as the borrower
    // of a loan. reported_by_id is a required foreign key, so no name or no match becomes DEFAULT_CUSTODIAN_ID.
    // TODO(H-10): two people with the same name cannot be told apart, and a typo files the ticket under user 1 (issue #32). The reporter comes from the session after step 13.
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

/**
 * Lists every repair ticket, newest first, shaped for the screens.
 *
 * @returns one RepairListItem per asset_repairs row
 */
export async function listRepairs(): Promise<RepairListItem[]> {
    const [dbRepairs, dbAssets, dbUsers] = await repairsRepository.findListLookups();

    // The two statuses requestRepair opens a ticket with. The schema has no "acknowledged"
    // column, so any other status counts as acknowledged.
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
            // The screens label this "custodian", but it is the reporter, who may not hold the asset.
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

// The three in-progress statuses. Each puts the asset into MAINTENANCE.
const MAINTENANCE_STATUSES = ["Inspection Phase", "Warranty Holder Possession", "Third-Party Repairer Possession"];
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
 * @returns the updated asset_repairs row
 * @throws AppError 404 if no ticket has this id
 */
// TODO(H-07): any text is saved as a status, "Pending TSG Review" does not take the asset out of maintenance, and "Fixed & Completed" adds a record and a report even for a ticket that never went into maintenance. Phase 3 makes the status an enum with allowed moves.
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
        ? null // completion takes its status from the records before maintenance (completionRows)
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

/**
 * Builds the record and the report a "Fixed & Completed" update appends.
 * The record goes back to where the asset was before maintenance, not the TSG Office: it may still be
 * out on loan or transfer. The report is filed under the ticket's reporter, with the remarks cut to
 * the column's 255 characters.
 */
// Neither the record nor the report links back to the ticket: asset_records.repair_id stays null, here
// and in maintenanceRecord. Phase 3, with the repair status enum.
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

/**
 * Builds the MAINTENANCE record for a maintenance status, or null when the asset's newest record
 * is already MAINTENANCE. Condition, home location, and custodian carry over from that record.
 */
function maintenanceRecord(
    existing: asset_repairs,
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
            current_custodian: latestRecord?.current_custodian ?? DEFAULT_CUSTODIAN_ID,
        };
    }
    return null;
}

/**
 * Sets only a ticket's progress_status, for the Staff analytics board. The asset's status is not
 * changed, whatever the new status is, and no report is filed.
 *
 * @param repairId the id from the URL, unchecked (NaN if it was not a number)
 * @param progressStatus the new status; stored as text
 * @returns the updated asset_repairs row
 */
// TODO(H-06): a second way to change a ticket's status, without updateRepair's asset changes. Kept in step 12 as decided; merging the two endpoints is its own behavior-change commit.
export function updateRepairStatus(repairId: number, progressStatus: string): Promise<asset_repairs> {
    return repairsRepository.updateProgressStatus(repairId, String(progressStatus));
}
