/**
 * Maintenance service: the business rules for reporting an issue, TSG's receipt, start, stage change and completion
 * (with the warranty rule), cancelling a ticket, and the ticket lists, and the one builder of the Maintenance shape.
 * Layer: service. Called by maintenance.controller.ts and features/loans/loans.service.ts (the Return Damage ticket in a
 * receive answer). Calls maintenance.repository.ts, features/assets/assets.repository.ts, shared/services/lifecycleGuard.ts,
 * shared/services/assetState.ts (holder and today's date), shared/services/inspectionShape.ts, and, inside the step's
 * transaction, shared/services/inspections.ts (the inspection writer) and shared/services/assetStatus.ts.
 * Used by: a holder's, a Lab Head's or TSG's issue report, TSG's maintenance steps, cancelling, and every role's ticket list.
 */
import { asset_loans_status, asset_maintenance_status, type Prisma } from '@prisma/client';
import type { InspectionInput } from '@shared/types/assets';
import type { SessionIdentity } from '@shared/types/auth';
import type { Maintenance, MaintenanceReportBody } from '@shared/types/maintenance';
import { MAINTENANCE_STATUS_LABELS, MAINTENANCE_TYPE_LABELS, RECEIVED_MAINTENANCE_STATUSES } from '@shared/constants/maintenanceStatuses';
import * as maintenanceRepository from './maintenance.repository';
import type { TicketRow, TicketRows } from './maintenance.repository';
import type { CompleteBody, MaintenanceListFilters, StageBody } from './maintenance.validation';
import { PICK_ISSUE_TYPE_MESSAGE } from './maintenance.validation';
import * as assetsRepository from '../assets/assets.repository';
import { AppError } from '../../shared/errors/AppError';
import { hasAccessRole } from '../../shared/middleware/permissions';
import { assertActionAllowed } from '../../shared/services/lifecycleGuard';
import { holderOf, isHeld, serverToday } from '../../shared/services/assetState';
import { inspectionOf, personFor } from '../../shared/services/inspectionShape';
import { writeInspection } from '../../shared/services/inspections';
import { setAssetStatus } from '../../shared/services/assetStatus';

/** The 403 message when a Researcher reports an issue on an asset they do not hold. */
export const NOT_THE_HOLDER_MESSAGE = "Only the person who holds this asset can report an issue on it.";

/** The 403 message when a Lab Head reports an issue on another lab's asset. */
export const NOT_YOUR_LAB_REPORT_MESSAGE = "This asset belongs to another lab. Only that lab's Head can report an issue on it.";

/** A DATE column as yyyy-mm-dd. Prisma reads a DATE as midnight UTC, so the UTC date is the stored one. */
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

/** A date-time as ISO 8601, or null. */
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

/** Whether the session user is TSG. */
function isTsg(viewer: SessionIdentity): boolean {
    return hasAccessRole(viewer, ["TSG_STAFF"]);
}

/**
 * Whether the asset is under warranty for this ticket: its warranty expiry is on or after the day TSG received it,
 * or, before receipt, on or after today. An asset under warranty goes to the warranty holder unless TSG writes why it
 * repairs it itself. (CAP1DEF 5)
 *
 * @param warrantyExpiry the asset's warranty expiry, or null when it has none
 * @param receivedAt when TSG received the asset, or null before receipt
 */
export function isUnderWarranty(warrantyExpiry: Date | null, receivedAt: Date | null): boolean {
    if (!warrantyExpiry) return false;
    return dateOnly(warrantyExpiry) >= serverToday(receivedAt ?? new Date());
}

/**
 * Builds the contract's Maintenance from a ticket row. A Researcher gets no other person's name or id. (D2)
 *
 * @param row the ticket with its asset, people, issue type, and inspections
 * @param baselines the metric baselines of its inspections
 * @param viewer the session user
 */
export function maintenanceOf(row: TicketRow, baselines: Map<string, number>, viewer: SessionIdentity): Maintenance {
    const asset = row.assets;
    return {
        maintenanceId: row.maintenance_id,
        asset: { assetId: asset.asset_id, tag: asset.asset_tag, name: asset.name, warrantyExpiry: asset.warranty_expiry ? dateOnly(asset.warranty_expiry) : null },
        type: row.type,
        typeLabel: MAINTENANCE_TYPE_LABELS[row.type],
        status: row.status,
        statusLabel: MAINTENANCE_STATUS_LABELS[row.status],
        issueType: row.issue_types
            ? { issueTypeId: row.issue_types.issue_type_id, key: row.issue_types.key, name: row.issue_types.name, suggestedAction: row.issue_types.suggested_action }
            : null,
        issueDescription: row.issue_description,
        reportedBy: personFor(viewer, row.users)!,
        reportedAt: row.reported_at.toISOString(),
        receivedBy: personFor(viewer, row.received_by),
        receivedAt: isoOrNull(row.received_at),
        underWarranty: isUnderWarranty(asset.warranty_expiry, row.received_at),
        warrantyOverrideReason: row.warranty_override_reason,
        provider: row.provider,
        completedBy: personFor(viewer, row.completed_by),
        completedAt: isoOrNull(row.completed_at),
        resolutionRemarks: row.resolution_remarks,
        triggerInspection: inspectionOf(row.trigger_inspection, baselines, viewer),
        completionInspection: inspectionOf(row.completion_inspection, baselines, viewer),
    };
}

/** Every ticket of some rows in the Maintenance shape. */
function ticketsOf({ rows, baselines }: TicketRows, viewer: SessionIdentity): Maintenance[] {
    return rows.map(row => maintenanceOf(row, baselines, viewer));
}

/**
 * One ticket in the Maintenance shape, read after the step that changed it. Also the ticket a loan receipt answers
 * with when it opens a Return Damage ticket (features/loans).
 *
 * @param maintenanceId the ticket
 * @param viewer the session user
 */
export async function maintenanceById(maintenanceId: number, viewer: SessionIdentity): Promise<Maintenance> {
    return ticketsOf(await maintenanceRepository.findTickets({ maintenance_id: maintenanceId }), viewer)[0];
}

/**
 * The tickets the session user may see, newest report first, optionally filtered (contract 7.4): TSG, the Director and
 * the Secretary see every ticket; the account that heads a lab sees its lab's assets' tickets; a Researcher sees only the
 * tickets they reported. The IT Admin is refused at the route.
 *
 * @param filters the status and type filters, already checked
 * @param viewer the session user
 * @returns the tickets in the Maintenance shape
 */
export async function listTickets(filters: MaintenanceListFilters, viewer: SessionIdentity): Promise<Maintenance[]> {
    const where: Prisma.asset_maintenanceWhereInput = {
        ...(filters.statuses ? { status: { in: filters.statuses } } : {}),
        ...(filters.types ? { type: { in: filters.types } } : {}),
    };
    if (!hasAccessRole(viewer, ["TSG_STAFF", "ADRIC_DIRECTOR", "ADRIC_SECRETARY"])) {
        if (viewer.headOfCenterId !== null) where.assets = { center_id: viewer.headOfCenterId };
        else where.reported_by_id = viewer.userId;
    }
    return ticketsOf(await maintenanceRepository.findTickets(where), viewer);
}

/** The ticket with this id, or a 404. */
async function existingTicket(maintenanceId: number) {
    const ticket = await maintenanceRepository.findById(maintenanceId);
    if (!ticket) throw new AppError(404, `No maintenance ticket found with id ${maintenanceId}.`);
    return ticket;
}

/** The 409 message when a ticket's status does not allow the step. */
function wrongStatus(ticket: { maintenance_id: number; status: asset_maintenance_status }, step: string): AppError {
    return new AppError(409, `MNT-${ticket.maintenance_id} is ${MAINTENANCE_STATUS_LABELS[ticket.status]}, so it cannot be ${step}.`);
}

/**
 * Reports an issue on an asset: a ticket in Pending Receipt, with the issue type and description. The asset and its
 * loan do not change: the holder keeps the asset until TSG receives it. A TSG report is a TSG Maintenance ticket,
 * anyone else's a Borrower Report. Inside the asset lock: who may report, the lifecycle guard (Available or On Loan),
 * and one open ticket per asset, so two reports at once give one ticket. (H-05)
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked body: issue type and description
 * @param reporter the session user: the holder, the Head of the asset's home lab, or TSG
 * @returns the new ticket in the Maintenance shape
 * @throws AppError 400 if the issue type does not exist
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 403 NOT_THE_HOLDER_MESSAGE for a Researcher who does not hold it, NOT_YOUR_LAB_REPORT_MESSAGE for another lab's Head
 * @throws AppError 409 if the guard refuses, or the asset already has an open ticket
 */
export async function reportIssue(assetTag: string, data: MaintenanceReportBody, reporter: SessionIdentity): Promise<Maintenance> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) throw new AppError(404, `No asset found with tag ${assetTag}.`);
    if (!(await maintenanceRepository.issueTypeExists(data.issueTypeId))) throw new AppError(400, PICK_ISSUE_TYPE_MESSAGE);
    const byTsg = isTsg(reporter);

    const ticket = await maintenanceRepository.withAssetLock(existing.asset_id, async (tx) => {
        const asset = await maintenanceRepository.findAssetIn(tx, existing.asset_id);
        if (!byTsg) {
            if (reporter.headOfCenterId !== null) {
                if (reporter.headOfCenterId !== asset.center_id) throw new AppError(403, NOT_YOUR_LAB_REPORT_MESSAGE);
            } else if (holderOf(await maintenanceRepository.findOpenLoanIn(tx, asset.asset_id))?.userId !== reporter.userId) {
                throw new AppError(403, NOT_THE_HOLDER_MESSAGE);
            }
        }
        assertActionAllowed(asset, "START_MAINTENANCE");
        const open = await maintenanceRepository.findOpenTicketIn(tx, asset.asset_id);
        if (open) throw new AppError(409, `${asset.asset_tag} already has an open maintenance ticket (MNT-${open.maintenance_id}).`);

        return maintenanceRepository.createTicket(tx, {
            asset_id: asset.asset_id,
            reported_by_id: reporter.userId,
            type: byTsg ? "TSG_MAINTENANCE" : "BORROWER_REPORT",
            status: asset_maintenance_status.PENDING_RECEIPT,
            issue_type_id: data.issueTypeId,
            issue_description: data.issueDescription,
        });
    });
    return maintenanceById(ticket.maintenance_id, reporter);
}

/**
 * TSG receives the asset for its ticket, in one transaction: a Maintenance inspection by the session user, the ticket
 * Inspecting with who received it, when, and the inspection, and the asset in Maintenance (at the TSG Office). An open
 * loan the borrower holds (On Loan or Return Requested) ends in the same step as Ended by Maintenance: the asset never
 * goes back to that borrower. A loan still waiting for approval or release is left as it is; the guard refuses its
 * approval and release while the asset is in Maintenance.
 *
 * @param maintenanceId the ticket
 * @param inspection the checked Maintenance inspection
 * @param receiver the session user, TSG (the route checks it)
 * @returns the ticket, Inspecting
 * @throws AppError 404 if no ticket has this id
 * @throws AppError 400 if a metric does not apply to the asset; nothing is written
 * @throws AppError 409 if the ticket is not Pending Receipt, or the asset's status cannot be received
 */
export async function receive(maintenanceId: number, inspection: InspectionInput, receiver: SessionIdentity): Promise<Maintenance> {
    const ticket = await existingTicket(maintenanceId);

    await maintenanceRepository.withAssetLock(ticket.asset_id, async (tx) => {
        const current = await maintenanceRepository.findTicketIn(tx, maintenanceId);
        if (current.status !== asset_maintenance_status.PENDING_RECEIPT) throw wrongStatus(current, "received");
        assertActionAllowed(await maintenanceRepository.findAssetIn(tx, ticket.asset_id), "RECEIVE_FOR_MAINTENANCE");

        const row = await writeInspection(tx, { assetId: ticket.asset_id, type: "MAINTENANCE", input: inspection, inspectorId: receiver.userId });
        const now = new Date();
        await maintenanceRepository.updateTicket(tx, maintenanceId, {
            status: asset_maintenance_status.INSPECTING,
            received_by_id: receiver.userId,
            received_at: now,
            trigger_inspection_id: row.inspection_id,
        });
        const loan = await maintenanceRepository.findOpenLoanIn(tx, ticket.asset_id);
        if (isHeld(loan)) {
            await maintenanceRepository.updateLoanIn(tx, loan!.loanId, { status: asset_loans_status.ENDED_BY_MAINTENANCE, closed_at: now });
        }
        await setAssetStatus(tx, ticket.asset_id, "MAINTENANCE");
    });
    return maintenanceById(maintenanceId, receiver);
}

/** The 400 message when TSG would repair an asset under warranty without saying why. (CAP1DEF 5) */
export const UNDER_WARRANTY_MESSAGE = "This asset is under warranty. Send it to the warranty holder, or write why TSG repairs it.";

/** The 400 message when the work goes to External Service with nobody named. */
export const NAME_PROVIDER_MESSAGE = "Name the provider: the warranty holder or the repair shop.";

/**
 * The ticket fields a move to a stage writes, after the warranty and provider rules: External Service needs a provider;
 * Repairing an asset under warranty needs a warranty override reason, sent now or stored before.
 *
 * @param ticket the ticket as it is now
 * @param warrantyExpiry the asset's warranty expiry
 * @param body the stage, provider, and override reason sent
 * @throws AppError 400 NAME_PROVIDER_MESSAGE or UNDER_WARRANTY_MESSAGE
 */
function stageData(
    ticket: { received_at: Date | null; warranty_override_reason: string | null },
    warrantyExpiry: Date | null,
    body: StageBody,
): Prisma.asset_maintenanceUncheckedUpdateInput {
    if (body.stage === "EXTERNAL_SERVICE") {
        if (!body.provider) throw new AppError(400, NAME_PROVIDER_MESSAGE);
        return { status: body.stage, provider: body.provider };
    }
    const overrideReason = body.warrantyOverrideReason ?? ticket.warranty_override_reason;
    if (isUnderWarranty(warrantyExpiry, ticket.received_at) && !overrideReason) throw new AppError(400, UNDER_WARRANTY_MESSAGE);
    return { status: body.stage, ...(body.warrantyOverrideReason ? { warranty_override_reason: body.warrantyOverrideReason } : {}) };
}

/**
 * TSG starts the work after its inspection: Repairing (TSG repairs it) or External Service (the warranty holder or a
 * repair shop has it). An asset under warranty goes to External Service unless TSG writes why it repairs it itself;
 * the reason and the provider are kept on the ticket. The asset stays in Maintenance.
 *
 * @param maintenanceId the ticket
 * @param body the checked stage, provider, and warranty override reason
 * @param actor the session user, TSG (the route checks it)
 * @returns the ticket, Repairing or External Service
 * @throws AppError 404 if no ticket has this id
 * @throws AppError 400 UNDER_WARRANTY_MESSAGE or NAME_PROVIDER_MESSAGE
 * @throws AppError 409 if the ticket is not Inspecting, or the asset is not in Maintenance
 */
export async function start(maintenanceId: number, body: StageBody, actor: SessionIdentity): Promise<Maintenance> {
    const ticket = await existingTicket(maintenanceId);

    await maintenanceRepository.withAssetLock(ticket.asset_id, async (tx) => {
        const current = await maintenanceRepository.findTicketIn(tx, maintenanceId);
        if (current.status !== asset_maintenance_status.INSPECTING) throw wrongStatus(current, "started");
        const asset = await maintenanceRepository.findAssetIn(tx, ticket.asset_id);
        assertActionAllowed(asset, "WORK_ON_MAINTENANCE");
        await maintenanceRepository.updateTicket(tx, maintenanceId, stageData(current, asset.warranty_expiry, body));
    });
    return maintenanceById(maintenanceId, actor);
}

/**
 * TSG moves the work between Repairing and External Service, either way, with the same warranty and provider rules as
 * the start. A warranty override reason stored at the start still counts.
 *
 * @param maintenanceId the ticket
 * @param body the checked stage, provider, and warranty override reason
 * @param actor the session user, TSG (the route checks it)
 * @returns the ticket in its new stage
 * @throws AppError 404 if no ticket has this id
 * @throws AppError 400 UNDER_WARRANTY_MESSAGE or NAME_PROVIDER_MESSAGE
 * @throws AppError 409 if the ticket is not Repairing or External Service, is already in that stage, or the asset is not in Maintenance
 */
export async function changeStage(maintenanceId: number, body: StageBody, actor: SessionIdentity): Promise<Maintenance> {
    const ticket = await existingTicket(maintenanceId);

    await maintenanceRepository.withAssetLock(ticket.asset_id, async (tx) => {
        const current = await maintenanceRepository.findTicketIn(tx, maintenanceId);
        if (current.status !== asset_maintenance_status.REPAIRING && current.status !== asset_maintenance_status.EXTERNAL_SERVICE) {
            throw wrongStatus(current, "moved to another stage");
        }
        if (current.status === body.stage) throw new AppError(409, `MNT-${maintenanceId} is already ${MAINTENANCE_STATUS_LABELS[body.stage]}.`);
        const asset = await maintenanceRepository.findAssetIn(tx, ticket.asset_id);
        assertActionAllowed(asset, "WORK_ON_MAINTENANCE");
        await maintenanceRepository.updateTicket(tx, maintenanceId, stageData(current, asset.warranty_expiry, body));
    });
    return maintenanceById(maintenanceId, actor);
}

/**
 * TSG completes the work, in one transaction: a Maintenance inspection by the session user, and the ticket closed as
 * Resolved or Beyond Repair with who completed it, when, the remarks, and the inspection. Resolved puts the asset back
 * to Available, at its home lab and room. Beyond Repair leaves it in Maintenance: the next step is a retirement request.
 *
 * @param maintenanceId the ticket
 * @param body the checked outcome, remarks, and inspection
 * @param actor the session user, TSG (the route checks it)
 * @returns the ticket, Resolved or Beyond Repair
 * @throws AppError 404 if no ticket has this id
 * @throws AppError 400 if a metric does not apply to the asset; nothing is written
 * @throws AppError 409 if the ticket is not Inspecting, Repairing or External Service, or the asset is not in Maintenance
 */
export async function complete(maintenanceId: number, body: CompleteBody, actor: SessionIdentity): Promise<Maintenance> {
    const ticket = await existingTicket(maintenanceId);

    await maintenanceRepository.withAssetLock(ticket.asset_id, async (tx) => {
        const current = await maintenanceRepository.findTicketIn(tx, maintenanceId);
        if (!(RECEIVED_MAINTENANCE_STATUSES as readonly string[]).includes(current.status)) throw wrongStatus(current, "completed");
        assertActionAllowed(await maintenanceRepository.findAssetIn(tx, ticket.asset_id), "WORK_ON_MAINTENANCE");

        const row = await writeInspection(tx, { assetId: ticket.asset_id, type: "MAINTENANCE", input: body.inspection, inspectorId: actor.userId });
        await maintenanceRepository.updateTicket(tx, maintenanceId, {
            status: body.outcome,
            completed_by_id: actor.userId,
            completed_at: new Date(),
            resolution_remarks: body.resolutionRemarks,
            completion_inspection_id: row.inspection_id,
        });
        if (body.outcome === "RESOLVED") await setAssetStatus(tx, ticket.asset_id, "AVAILABLE");
    });
    return maintenanceById(maintenanceId, actor);
}

/**
 * Cancels a ticket. In Pending Receipt the reporter or TSG may cancel it, and the asset is unchanged (it never left its
 * holder). In Inspecting only TSG may, and the asset is Available again, back at its home lab. Any later status is
 * refused. The remarks are kept as the resolution remarks, and who cancelled it and when as completed by and at,
 * which the asset's history shows as a cancellation.
 *
 * @param maintenanceId the ticket
 * @param remarks the remarks, or null
 * @param actor the session user
 * @returns the ticket, Cancelled
 * @throws AppError 404 if no ticket has this id
 * @throws AppError 403 if the session user may not cancel it in its status
 * @throws AppError 409 if the ticket is not Pending Receipt or Inspecting, or the asset is not in Maintenance
 */
export async function cancel(maintenanceId: number, remarks: string | null, actor: SessionIdentity): Promise<Maintenance> {
    const ticket = await existingTicket(maintenanceId);

    await maintenanceRepository.withAssetLock(ticket.asset_id, async (tx) => {
        const current = await maintenanceRepository.findTicketIn(tx, maintenanceId);
        if (current.status === asset_maintenance_status.PENDING_RECEIPT) {
            if (!isTsg(actor) && current.reported_by_id !== actor.userId) {
                throw new AppError(403, "Only the person who reported this issue, or TSG, can cancel it.");
            }
        } else if (current.status === asset_maintenance_status.INSPECTING) {
            if (!isTsg(actor)) throw new AppError(403, "Only TSG can cancel a ticket once the asset is received.");
            assertActionAllowed(await maintenanceRepository.findAssetIn(tx, ticket.asset_id), "WORK_ON_MAINTENANCE");
            await setAssetStatus(tx, ticket.asset_id, "AVAILABLE");
        } else {
            throw wrongStatus(current, "cancelled");
        }
        await maintenanceRepository.updateTicket(tx, maintenanceId, {
            status: asset_maintenance_status.CANCELLED,
            completed_by_id: actor.userId,
            completed_at: new Date(),
            resolution_remarks: remarks,
        });
    });
    return maintenanceById(maintenanceId, actor);
}
