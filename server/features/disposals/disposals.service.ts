/**
 * Disposals service: the business rules for disposal requests, the Director's decisions, and the disposal list.
 * Layer: service. Called by disposals.controller.ts. Calls disposals.repository.ts, features/assets/assets.repository.ts,
 * features/auth/auth.repository.ts, shared/services/mailer.ts, and shared/constants/poolCustodian.ts.
 * Used by: Staff disposal filing (DisposalFormDialog), Director approval (Approvals & Holds tab and the bell).
 */
import type { Prisma, asset_disposals, asset_records, assets } from '@prisma/client';
import type { DisposalDecision, DisposalListItem, DisposalRequestInput } from '@shared/types/disposals';
import * as disposalsRepository from './disposals.repository';
import * as assetsRepository from '../assets/assets.repository';
import * as authRepository from '../auth/auth.repository';
import { AppError } from '../../shared/errors/AppError';
import { POOL_CUSTODIAN_ID } from '../../shared/constants/poolCustodian';
import { sendEmail, emailTemplate } from '../../shared/services/mailer';

/**
 * Files a pending disposal request for an asset.
 * Only the asset_disposals row is written. The asset is not marked Disposed until the Director
 * approves (decideDisposal), so it keeps its status and custodian while the request is pending.
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked disposal body: pathway, justification, optional last custodian and date
 * @param disposedById the session user, who requests the disposal; any requester name in the body is ignored (issue #32)
 * @returns the created row, plus the asset for the email the controller sends after answering
 * @throws AppError 404 if no asset has this tag
 */
// TODO(H-05): no status or duplicate check, so an asset on loan, under maintenance, or with a pending disposal can be put up for disposal, and approving two disposals writes two DISPOSED records (issue #54). Its own fix; tests/api/disposals.test.ts pins it.
export async function requestDisposal(
    assetTag: string,
    data: DisposalRequestInput,
    disposedById: number,
): Promise<{ disposal: asset_disposals; asset: assets }> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    // asset_disposals has one text column for all of this, so the fields are written as labelled
    // lines. GET /api/assets parses them back out for a disposed asset's details.
    // TODO(M-13): pathway, last custodian, and date are packed into one text column and parsed back with regex. Phase 3.
    const reason = [
        `Disposal Pathway: ${data.disposalPathway}`,
        data.lastCustodian ? `Last Custodian: ${data.lastCustodian}` : null,
        data.decommissionDate ? `Target Decommission Date: ${data.decommissionDate}` : null,
        "",
        "Breakdown Justification:",
        data.breakdownReasons,
    ].filter(line => line !== null).join("\n");

    const disposal = await disposalsRepository.create({
        asset_id: existing.asset_id,
        disposed_by_id: disposedById,
        disposal_reason: reason,
        status: "pending",
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
// The role and requester lookups run after the answer was sent, and nothing catches them: if a database read fails,
// the rejection is unhandled, which stops the Node process by default. A small fix (catch and log it), outside the restructure.
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
 * @returns one DisposalListItem per asset_disposals row
 */
export async function listDisposals(): Promise<DisposalListItem[]> {
    const [dbDisposals, dbAssets, dbUsers] = await disposalsRepository.findListLookups();

    return dbDisposals.map(d => {
        const asset = dbAssets.find(a => a.asset_id === d.asset_id);
        const requester = dbUsers.find(u => u.user_id === d.disposed_by_id);

        let status: "Pending" | "Approved" | "Rejected" = "Pending";
        if (d.status === "approved") status = "Approved";
        else if (d.status === "rejected") status = "Rejected";

        return {
            id: `DISP-${d.disposal_id}`,
            disposalId: d.disposal_id,
            assetId: asset?.asset_tag || "",
            assetName: asset?.name || "Unknown Asset",
            requestedBy: requester ? `${requester.first_name} ${requester.last_name}` : "Unknown",
            requestedAt: d.disposal_date.toISOString(),
            reason: d.disposal_reason,
            status,
        };
    });
}

/**
 * Approves or rejects a pending disposal request.
 * Approval decommissions the asset: the disposal becomes approved and a DISPOSED record is appended,
 * in one transaction. Reject changes only the disposal's status. The server does not check who
 * decides (C-02); the screens give the decision to the Director.
 *
 * @param disposalId the numeric disposal id
 * @param decision "approve" or "reject"
 * @returns the updated asset_disposals row
 * @throws AppError 404 if no disposal has this id
 * @throws AppError 400 if the disposal is not pending any more
 */
export async function decideDisposal(disposalId: number, decision: DisposalDecision): Promise<asset_disposals> {
    const disposal = await disposalsRepository.findById(disposalId);
    if (!disposal) {
        throw new AppError(404, `No disposal request found with id ${disposalId}.`);
    }
    if (disposal.status !== "pending") {
        throw new AppError(400, `Disposal #${disposalId} has already been ${disposal.status}.`);
    }

    const newStatus = decision === "approve" ? "approved" : "rejected";
    // A reject writes no record: the asset never left its status, so Staff can file again or keep using it.
    return disposalsRepository.saveDecision(
        disposal,
        newStatus,
        decision === "approve" ? (latestRecord) => disposedRecord(disposal, latestRecord) : null,
    );
}

/**
 * Builds the record an approval appends: DISPOSED, linked to the disposal.
 * The condition, home location, and custodian carry over from the asset's latest record, so the
 * history shows who last held the asset when it was disposed. current_location is left null.
 */
function disposedRecord(disposal: asset_disposals, latestRecord: asset_records | null): Prisma.asset_recordsUncheckedCreateInput {
    return {
        asset_id: disposal.asset_id,
        status: "DISPOSED",
        asset_condition: latestRecord?.asset_condition ?? "PERFECT",
        location: latestRecord?.location ?? "Unassigned",
        current_custodian: latestRecord?.current_custodian ?? POOL_CUSTODIAN_ID,
        disposal_id: disposal.disposal_id,
        Asset_Remarks: `Decommissioned via Disposal #DISP-${disposal.disposal_id}`,
    };
}

/**
 * Emails the requester that their disposal was approved or rejected.
 *
 * @param disposedById the disposal's disposed_by_id; nothing is sent if that user has no email
 * @returns when the send was attempted or skipped; the controller does not wait for it
 */
// The email lookup runs after the answer was sent and nothing catches it, as in notifyDirector above.
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
