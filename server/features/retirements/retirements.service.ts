/**
 * Disposals service: the business rules for disposal requests, the Director's decisions, and the disposal list.
 * Layer: service. Called by retirements.controller.ts. Calls retirements.repository.ts, features/assets/assets.repository.ts,
 * features/auth/auth.repository.ts, shared/services/lifecycleGuard.ts, shared/services/assetState.ts, and shared/services/mailer.ts.
 * Used by: Staff disposal filing (DisposalFormDialog), Director approval (Approvals & Holds tab and the bell).
 */
import { asset_retirements_status, type asset_retirements, type assets } from '@prisma/client';
import type { DisposalDecision, DisposalListItem, DisposalRequestInput } from '@shared/types/retirements';
import * as retirementsRepository from './retirements.repository';
import * as assetsRepository from '../assets/assets.repository';
import * as authRepository from '../auth/auth.repository';
import { RETIREMENT_STATUS_LABELS } from '@shared/constants/retirementStatuses';
import { AppError } from '../../shared/errors/AppError';
import { assertActionAllowed, isActionAllowed } from '../../shared/services/lifecycleGuard';
import { holderOf } from '../../shared/services/assetState';
import { sendEmail, emailTemplate } from '../../shared/services/mailer';

/**
 * Files a disposal request for an asset, in Pending: the asset_retirements row, with the asset's status before it,
 * and the asset set to Pending Retirement, in one transaction. A denial gives the asset that status back.
 * The lifecycle guard takes a request only on an asset that is Available, in Maintenance, or Missing, with no open
 * loan in the way. (H-05, issue #54)
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked disposal body: pathway, justification, optional date. A last custodian in the body is ignored:
 *   the reason names the asset's holder, if it has one (issue #12)
 * @param disposedById the session user, who requests the disposal; any requester name in the body is ignored (issue #32)
 * @returns the created row, plus the asset for the email the controller sends after answering
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 409 if the guard refuses the request
 */
export async function requestDisposal(
    assetTag: string,
    data: DisposalRequestInput,
    disposedById: number,
): Promise<{ disposal: asset_retirements; asset: assets }> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    const openLoan = await assetsRepository.findOpenLoan(existing.asset_id);
    assertActionAllowed(existing, "REQUEST_RETIREMENT", openLoan);
    const holder = holderOf(openLoan);

    // asset_retirements has one text column for all of this, so the fields are written as labelled
    // lines. GET /api/assets parses them back out for a retired asset's details.
    // TODO(M-13): pathway, last custodian, and date are packed into one text column and parsed back with regex. Batch 5 sends the pathway as its own field.
    const reason = [
        `Disposal Pathway: ${data.disposalPathway}`,
        holder ? `Last Custodian: ${holder.name}` : null,
        data.decommissionDate ? `Target Decommission Date: ${data.decommissionDate}` : null,
        "",
        "Breakdown Justification:",
        data.breakdownReasons,
    ].filter(line => line !== null).join("\n");

    const disposal = await retirementsRepository.createRequest({
        asset_id: existing.asset_id,
        requested_by_id: disposedById,
        reason,
        status: asset_retirements_status.PENDING,
        previous_status: existing.status,
    });

    return { disposal, asset: existing };
}

/**
 * Emails every holder of the ADRIC_DIRECTOR role that a disposal was filed, naming the requester. With nobody in
 * the role, or mail off, the mailer logs and skips it.
 *
 * @param requesterId the session user who filed it; "Staff" is named if that account is gone
 * @returns when the send was attempted or skipped; the controller does not wait for it
 */
// TODO(H-20): the asset name, requester, and pathway go into the email HTML unescaped. Step 13 (shared escaping).
export function notifyDirector(asset: assets, assetTag: string, data: DisposalRequestInput, requesterId: number): Promise<void> {
    return Promise.all([
        authRepository.getRoleEmails("ADRIC_DIRECTOR"),
        authRepository.findUserById(requesterId),
    ]).then(([emails, requester]) => sendEmail(
        emails,
        `New Disposal Request — ${asset.name} (${assetTag})`,
        emailTemplate("New Disposal Approval Request", `
                <p><strong>${requester ? `${requester.first_name} ${requester.last_name}` : "Staff"}</strong> has requested to decommission <strong>${asset.name}</strong> (${assetTag}).</p>
                <p><strong>Disposal Pathway:</strong> ${data.disposalPathway}</p>
                <p>Please review this request in the Clearance & Disposal tab of your dashboard.</p>
            `)
    )).catch(error => {
        console.error(`Failed to send disposal request notification email for asset ${assetTag}:`, error);
    });
}

/**
 * Lists every disposal request, newest first, shaped for the screens.
 * Every status is included; the bell keeps only the pending ones.
 *
 * @returns one DisposalListItem per asset_retirements row
 */
export async function listDisposals(): Promise<DisposalListItem[]> {
    const [dbDisposals, dbAssets, dbUsers] = await retirementsRepository.findListLookups();

    return dbDisposals.map(d => {
        const asset = dbAssets.find(a => a.asset_id === d.asset_id);
        const requester = dbUsers.find(u => u.user_id === d.requested_by_id);

        let status: "Pending" | "Approved" | "Rejected" = "Pending";
        if (d.status === asset_retirements_status.APPROVED || d.status === asset_retirements_status.COMPLETED) status = "Approved";
        else if (d.status === asset_retirements_status.DENIED) status = "Rejected";

        return {
            id: `DISP-${d.retirement_id}`,
            disposalId: d.retirement_id,
            assetId: asset?.asset_tag || "",
            assetName: asset?.name || "Unknown Asset",
            requestedBy: requester ? `${requester.first_name} ${requester.last_name}` : "Unknown",
            requestedAt: d.requested_at.toISOString(),
            reason: d.reason,
            status,
        };
    });
}

/**
 * Approves or rejects a pending disposal request, in one transaction.
 * Approval retires the asset at once: there is no completion step yet, so the request goes straight to Completed and the
 * asset to Retired. Rejection (Denied) gives the asset back its status from before the request.
 * The server does not check who decides (C-02); the screens give the decision to the Director.
 * An approval needs the asset still in Pending Retirement. A rejection is never refused, so stale requests can be
 * cleared; it changes the asset only while the asset is in Pending Retirement. (issue #28)
 *
 * @param disposalId the numeric disposal id
 * @param decision "approve" or "reject"
 * @param deciderId the session user who decides
 * @returns the updated asset_retirements row
 * @throws AppError 404 if no disposal has this id
 * @throws AppError 400 if the disposal is not pending any more
 * @throws AppError 409 if an approval finds the asset no longer in Pending Retirement
 */
// TODO(H-07): approval skips Approved and the TSG completion step. Batch 5 adds them.
export async function decideDisposal(disposalId: number, decision: DisposalDecision, deciderId: number): Promise<asset_retirements> {
    const disposal = await retirementsRepository.findById(disposalId);
    if (!disposal) {
        throw new AppError(404, `No disposal request found with id ${disposalId}.`);
    }
    if (disposal.status !== asset_retirements_status.PENDING) {
        throw new AppError(400, `Disposal #${disposalId} is ${RETIREMENT_STATUS_LABELS[disposal.status]}, so it can no longer be decided.`);
    }
    const asset = await assetsRepository.findById(disposal.asset_id);
    if (!asset) {
        throw new AppError(404, `No asset found for disposal ${disposalId}.`);
    }
    if (decision === "approve") {
        assertActionAllowed(asset, "DECIDE_RETIREMENT");
    }

    return retirementsRepository.saveDecision(disposal, decision === "approve", deciderId, isActionAllowed(asset.status, "DECIDE_RETIREMENT"));
}

/**
 * Emails the requester that their disposal was approved or rejected.
 *
 * @param disposedById the disposal's requested_by_id; nothing is sent if that user has no email
 * @returns when the send was attempted or skipped; the controller does not wait for it
 */
export function notifyDecision(disposalId: number, disposedById: number, decision: DisposalDecision): Promise<void> {
    return authRepository.getUserEmail(disposedById).then(email => {
        if (!email) return;
        const approved = decision === "approve";
        return sendEmail(
            email,
            `Disposal Request ${approved ? "Approved" : "Rejected"} — Disposal #${disposalId}`,
            emailTemplate(`Disposal Request ${approved ? "Approved" : "Rejected"}`, `
                    <p>Your decommission request has been <strong>${approved ? "approved" : "rejected"}</strong> by the AdRIC Director.</p>
                    ${approved ? `<p>The asset is now marked Disposed in the registry.</p>` : `<p>The asset remains active — you may revise and resubmit if needed.</p>`}
                `)
        );
    }).catch(error => {
        console.error(`Failed to send disposal #${disposalId} decision notification email:`, error);
    });
}
