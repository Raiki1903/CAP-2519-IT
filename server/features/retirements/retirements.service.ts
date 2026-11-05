/**
 * Disposals service: the business rules for disposal requests, the decision by someone other than the requester,
 * TSG's completion, the disposal lists, the emails, and the one builder of the Retirement shape.
 * Layer: service. Called by retirements.controller.ts. Calls retirements.repository.ts, features/assets/assets.repository.ts,
 * features/auth/auth.repository.ts (the emails), shared/services/lifecycleGuard.ts, shared/services/permissions.ts
 * (notSameActor), shared/services/inspectionShape.ts, shared/services/mailer.ts, shared/utils/html.ts, and, inside the
 * step's transaction, shared/services/inspections.ts (the inspection writer) and shared/services/assetStatus.ts.
 * Used by: TSG disposal requests and completion (DisposalFormDialog), the Director's and the Secretary's decisions,
 * and the screens that list disposals.
 */
import { asset_retirements_status, type Prisma } from '@prisma/client';
import type { SessionIdentity } from '@shared/types/auth';
import type { Retirement } from '@shared/types/retirements';
import { RETIREMENT_PATHWAY_LABELS, RETIREMENT_STATUS_LABELS, type RetirementStatus } from '@shared/constants/retirementStatuses';
import { ASSET_STATUS_LABELS } from '@shared/enums/assetStatus';
import * as retirementsRepository from './retirements.repository';
import type { RetirementRow, RetirementRows } from './retirements.repository';
import type { CompleteBody, DecisionBody, RequestBody } from './retirements.validation';
import * as assetsRepository from '../assets/assets.repository';
import * as authRepository from '../auth/auth.repository';
import { AppError } from '../../shared/errors/AppError';
import { hasAccessRole } from '../../shared/middleware/permissions';
import { assertActionAllowed } from '../../shared/services/lifecycleGuard';
import { notSameActor } from '../../shared/services/permissions';
import { inspectionOf, personFor } from '../../shared/services/inspectionShape';
import { writeInspection } from '../../shared/services/inspections';
import { setAssetStatus } from '../../shared/services/assetStatus';
import { sendEmail, emailTemplate } from '../../shared/services/mailer';
import { escapeHtml } from '../../shared/utils/html';

/** The 409 message when an asset in Maintenance is not ready for disposal. (Contract section 3, note 3) */
export const NOT_BEYOND_REPAIR_MESSAGE = "Finish the maintenance ticket first. Only an asset found beyond repair can be disposed of from Maintenance.";

/** The 403 message when the requester tries to decide their own disposal. */
export const OWN_REQUEST_MESSAGE = "You requested this disposal, so someone else must decide it.";

/** A date-time as ISO 8601, or null. */
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * Builds the contract's Retirement from a disposal row. A Researcher never calls the disposal routes, so every
 * person is named; personFor still applies the rule. (D2)
 *
 * @param row the disposal with its asset, people, and assessment inspection
 * @param baselines the metric baselines of its inspection
 * @param viewer the session user
 */
export function retirementOf(row: RetirementRow, baselines: Map<string, number>, viewer: SessionIdentity): Retirement {
    return {
        retirementId: row.retirement_id,
        asset: { assetId: row.assets.asset_id, tag: row.assets.asset_tag, name: row.assets.name },
        status: row.status,
        statusLabel: RETIREMENT_STATUS_LABELS[row.status],
        reason: row.reason,
        pathway: row.pathway,
        pathwayLabel: row.pathway ? RETIREMENT_PATHWAY_LABELS[row.pathway] : null,
        previousStatus: row.previous_status,
        previousStatusLabel: row.previous_status ? ASSET_STATUS_LABELS[row.previous_status] : null,
        requestedBy: personFor(viewer, row.users)!,
        requestedAt: row.requested_at.toISOString(),
        decidedBy: personFor(viewer, row.decided_by),
        decidedAt: isoOrNull(row.decided_at),
        decisionRemarks: row.decision_remarks,
        completedBy: personFor(viewer, row.completed_by),
        completedAt: isoOrNull(row.completed_at),
        dispositionReference: row.disposition_reference,
        assessmentInspection: inspectionOf(row.assessment_inspection, baselines, viewer),
    };
}

/** Every disposal of some rows in the Retirement shape. */
function retirementsOf({ rows, baselines }: RetirementRows, viewer: SessionIdentity): Retirement[] {
    return rows.map(row => retirementOf(row, baselines, viewer));
}

/** One disposal in the Retirement shape, read after the step that changed it. */
async function retirementById(retirementId: number, viewer: SessionIdentity): Promise<Retirement> {
    return retirementsOf(await retirementsRepository.findRetirements({ retirement_id: retirementId }), viewer)[0];
}

/**
 * The disposals the session user may see, newest request first: TSG, the Director and the Secretary see every one;
 * the account that heads a lab sees its lab's assets' disposals. Other roles are refused at the route.
 *
 * @param statuses a status filter, or null for every status
 * @param viewer the session user
 * @returns the disposals in the Retirement shape
 */
export async function listRetirements(statuses: RetirementStatus[] | null, viewer: SessionIdentity): Promise<Retirement[]> {
    const where: Prisma.asset_retirementsWhereInput = statuses ? { status: { in: statuses } } : {};
    if (!hasAccessRole(viewer, ["TSG_STAFF", "ADRIC_DIRECTOR", "ADRIC_SECRETARY"]) && viewer.headOfCenterId !== null) {
        where.assets = { center_id: viewer.headOfCenterId };
    }
    return retirementsOf(await retirementsRepository.findRetirements(where), viewer);
}

/** The disposal with this id, or a 404. */
async function existingRetirement(retirementId: number) {
    const retirement = await retirementsRepository.findById(retirementId);
    if (!retirement) throw new AppError(404, `No disposal request found with id ${retirementId}.`);
    return retirement;
}

/** The 409 message when a disposal's status does not allow the step. */
function wrongStatus(retirement: { retirement_id: number; status: asset_retirements_status }, step: string): AppError {
    return new AppError(409, `DISP-${retirement.retirement_id} is ${RETIREMENT_STATUS_LABELS[retirement.status]}, so it ${step}.`);
}

/**
 * Files a disposal request, in Pending, in one transaction that locks the asset first: the asset_retirements row with
 * the asset's status before it, the pathway in its own column when TSG names it, a Retirement inspection when TSG
 * assessed the asset, and the asset set to Pending Retirement. The guard takes an asset that is Available, Missing, or
 * in Maintenance, and one in Maintenance only when its newest ticket ended Beyond Repair and none is open. One open
 * disposal per asset. A loan still waiting for approval or release is left as it is (Batch 5, section 3.7).
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked body: reason, pathway, assessment inspection
 * @param requester the session user, TSG (the route checks it); a requester name in the body is ignored (issue #32)
 * @returns the new disposal in the Retirement shape
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 400 if a metric of the assessment does not apply to the asset; nothing is written
 * @throws AppError 409 if a disposal is already open, the guard refuses, or the asset in Maintenance is not beyond repair
 */
export async function requestRetirement(assetTag: string, data: RequestBody, requester: SessionIdentity): Promise<Retirement> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) throw new AppError(404, `No asset found with tag ${assetTag}.`);

    const retirement = await retirementsRepository.withAssetLock(existing.asset_id, async (tx) => {
        const asset = await retirementsRepository.findAssetIn(tx, existing.asset_id);
        const open = await retirementsRepository.findOpenRetirementIn(tx, asset.asset_id);
        if (open) throw new AppError(409, `${asset.asset_tag} already has an open disposal request (DISP-${open.retirement_id}).`);
        assertActionAllowed(asset, "REQUEST_RETIREMENT");
        if (asset.status === "MAINTENANCE") {
            const tickets = await retirementsRepository.findTicketStateIn(tx, asset.asset_id);
            if (tickets.openTicketId !== null || tickets.latestStatus !== "BEYOND_REPAIR") throw new AppError(409, NOT_BEYOND_REPAIR_MESSAGE);
        }

        const assessment = data.assessmentInspection
            ? await writeInspection(tx, { assetId: asset.asset_id, type: "RETIREMENT", input: data.assessmentInspection, inspectorId: requester.userId })
            : null;
        const row = await retirementsRepository.createRetirement(tx, {
            asset_id: asset.asset_id,
            requested_by_id: requester.userId,
            reason: data.reason,
            pathway: data.pathway,
            status: asset_retirements_status.PENDING,
            previous_status: asset.status,
            assessment_inspection_id: assessment?.inspection_id ?? null,
        });
        await setAssetStatus(tx, asset.asset_id, "PENDING_RETIREMENT");
        return row;
    });
    return retirementById(retirement.retirement_id, requester);
}

/**
 * The Director or the Secretary decides a Pending disposal, never the person who requested it. Approve: Approved, and
 * the asset stays Pending Retirement until TSG completes the disposal. Deny (remarks required): Denied, and the asset
 * gets back its status from before the request. The disposal and the asset are read again inside the asset lock, so two
 * decisions at once give one 200 and one 409.
 *
 * @param retirementId the disposal
 * @param body the checked decision and remarks
 * @param decider the session user, the Director or the Secretary (the route checks it)
 * @returns the decided disposal in the Retirement shape
 * @throws AppError 404 if no disposal has this id
 * @throws AppError 403 OWN_REQUEST_MESSAGE if the session user requested it
 * @throws AppError 409 if the disposal is not Pending, or the asset is not Pending Retirement
 */
export async function decide(retirementId: number, body: DecisionBody, decider: SessionIdentity): Promise<Retirement> {
    const retirement = await existingRetirement(retirementId);
    notSameActor(retirement.requested_by_id, decider.userId, OWN_REQUEST_MESSAGE);

    await retirementsRepository.withAssetLock(retirement.asset_id, async (tx) => {
        const current = await retirementsRepository.findRetirementIn(tx, retirementId);
        if (current.status !== asset_retirements_status.PENDING) throw wrongStatus(current, "can no longer be decided");
        assertActionAllowed(await retirementsRepository.findAssetIn(tx, retirement.asset_id), "DECIDE_RETIREMENT");

        await retirementsRepository.updateRetirement(tx, retirementId, {
            status: body.approve ? asset_retirements_status.APPROVED : asset_retirements_status.DENIED,
            decided_by_id: decider.userId,
            decided_at: new Date(),
            decision_remarks: body.decisionRemarks,
        });
        if (!body.approve) await setAssetStatus(tx, retirement.asset_id, current.previous_status ?? "AVAILABLE");
    });
    return retirementById(retirementId, decider);
}

/**
 * TSG completes an Approved disposal: Completed, with the pathway the asset left by, the disposition reference, who
 * completed it and when, and the asset Retired. Nothing more happens to a Retired asset.
 *
 * @param retirementId the disposal
 * @param body the checked pathway and reference
 * @param actor the session user, TSG (the route checks it)
 * @returns the completed disposal in the Retirement shape
 * @throws AppError 404 if no disposal has this id
 * @throws AppError 409 if the disposal is not Approved, or the asset is not Pending Retirement
 */
export async function complete(retirementId: number, body: CompleteBody, actor: SessionIdentity): Promise<Retirement> {
    const retirement = await existingRetirement(retirementId);

    await retirementsRepository.withAssetLock(retirement.asset_id, async (tx) => {
        const current = await retirementsRepository.findRetirementIn(tx, retirementId);
        if (current.status !== asset_retirements_status.APPROVED) throw wrongStatus(current, "cannot be completed");
        assertActionAllowed(await retirementsRepository.findAssetIn(tx, retirement.asset_id), "COMPLETE_RETIREMENT");

        await retirementsRepository.updateRetirement(tx, retirementId, {
            status: asset_retirements_status.COMPLETED,
            pathway: body.pathway,
            disposition_reference: body.dispositionReference,
            completed_by_id: actor.userId,
            completed_at: new Date(),
        });
        await setAssetStatus(tx, retirement.asset_id, "RETIRED");
    });
    return retirementById(retirementId, actor);
}

/** A disposal row for an email, or null when it is gone. */
async function emailRow(retirementId: number): Promise<RetirementRow | null> {
    return (await retirementsRepository.findRetirements({ retirement_id: retirementId })).rows[0] ?? null;
}

/**
 * Emails the Director and the Secretary, who decide disposals, that one was requested. Every value is escaped. (H-20)
 * With nobody in those roles, or mail off, the mailer logs and skips it.
 *
 * @param retirementId the new disposal
 * @returns when the send was attempted or skipped; the controller does not wait for it
 */
export function notifyDeciders(retirementId: number): Promise<void> {
    return Promise.all([
        emailRow(retirementId),
        authRepository.getRoleEmails("ADRIC_DIRECTOR"),
        authRepository.getRoleEmails("ADRIC_SECRETARY"),
    ]).then(([row, directors, secretaries]) => {
        if (!row) return;
        const requester = `${row.users.first_name} ${row.users.last_name}`;
        return sendEmail(
            [...new Set([...directors, ...secretaries])],
            `New disposal request DISP-${row.retirement_id} (${row.assets.asset_tag})`,
            emailTemplate("New disposal request", `
                <p><strong>${escapeHtml(requester)}</strong> asked to dispose of <strong>${escapeHtml(row.assets.name)}</strong> (${escapeHtml(row.assets.asset_tag)}), request DISP-${row.retirement_id}.</p>
                <p><strong>Reason:</strong> ${escapeHtml(row.reason)}</p>
                <p><strong>Pathway:</strong> ${escapeHtml(row.pathway ? RETIREMENT_PATHWAY_LABELS[row.pathway] : "Not named yet")}</p>
                <p>The Director or the Secretary approves or denies it in AdRIC Asset Management. The person who requested it cannot decide it.</p>
            `),
        );
    }).catch(error => {
        // Only the error's name: a mail error can quote the recipient's address.
        console.error(`Failed to send the disposal request email for disposal ${retirementId}:`, error?.name || 'Error');
    });
}

/**
 * Emails the requester that their disposal was approved (TSG completes it next) or denied (with the remarks, and the
 * status the asset is back in). Every value is escaped. (H-20)
 *
 * @param retirementId the decided disposal
 * @returns when the send was attempted or skipped; the controller does not wait for it
 */
export function notifyDecision(retirementId: number): Promise<void> {
    return emailRow(retirementId).then(async row => {
        if (!row) return;
        const email = await authRepository.getUserEmail(row.requested_by_id);
        if (!email) return;
        const approved = row.status === asset_retirements_status.APPROVED;
        const what = `Your disposal request DISP-${row.retirement_id} for <strong>${escapeHtml(row.assets.name)}</strong> (${escapeHtml(row.assets.asset_tag)})`;
        const body = approved
            ? `<p>${what} was approved.</p><p>TSG completes the disposal with its pathway and reference. Until then the asset stays Pending Retirement.</p>`
            : `<p>${what} was denied. The asset is back to ${escapeHtml(row.previous_status ? ASSET_STATUS_LABELS[row.previous_status] : ASSET_STATUS_LABELS.AVAILABLE)}.</p>
               <p><strong>Remarks:</strong> ${escapeHtml(row.decision_remarks ?? "")}</p>`;
        return sendEmail(
            email,
            `Disposal request DISP-${row.retirement_id} ${approved ? "approved" : "denied"}`,
            emailTemplate(`Disposal request ${approved ? "approved" : "denied"}`, body),
        );
    }).catch(error => {
        console.error(`Failed to send the decision email for disposal ${retirementId}:`, error?.name || 'Error');
    });
}
