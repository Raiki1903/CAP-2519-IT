/**
 * Disposals service: the business rules for disposal requests, the Director's decisions, and the disposal list.
 * Layer: service. Called by disposals.controller.ts. Calls disposals.repository.ts, features/auth/auth.repository.ts,
 * shared/services/mailer.ts, and shared/constants/defaultCustodian.ts.
 * Used by: Staff disposal filing (DisposalFormDialog), Director approval (Approvals & Holds tab and the bell).
 */
import type { Prisma, asset_disposals, asset_records, assets } from '@prisma/client';
import type { DisposalDecision, DisposalListItem, DisposalRequestInput } from '@shared/types/disposals';
import * as disposalsRepository from './disposals.repository';
import * as authRepository from '../auth/auth.repository';
import { AppError } from '../../shared/errors/AppError';
import { DEFAULT_CUSTODIAN_ID } from '../../shared/constants/defaultCustodian';
import { sendEmail, emailTemplate } from '../../shared/services/mailer';

/**
 * Files a pending disposal request for an asset.
 * Only the asset_disposals row is written. The asset is not marked Disposed until the Director
 * approves (decideDisposal), so it keeps its status and custodian while the request is pending.
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked disposal body: requester name, pathway, justification, optional last custodian and date
 * @returns the created row, plus the asset for the email the controller sends after answering
 * @throws AppError 404 if no asset has this tag
 */
// TODO(H-05): no status or duplicate check, so an asset on loan, under maintenance, or with a pending disposal can be put up for disposal, and approving two disposals writes two DISPOSED records (issue #54). Its own fix; tests/api/disposals.test.ts pins it.
export async function requestDisposal(
    assetTag: string,
    data: DisposalRequestInput,
): Promise<{ disposal: asset_disposals; asset: assets }> {
    const existing = await disposalsRepository.findAssetByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    // The form sends the requester as a typed name, split and matched the same way as the borrower
    // of a loan. disposed_by_id is a required foreign key, so no name or no match becomes DEFAULT_CUSTODIAN_ID.
    // TODO(H-10): two people with the same name cannot be told apart, and a typo files the request under user 1 (issue #32). The requester comes from the session after step 13.
    let disposedById = DEFAULT_CUSTODIAN_ID;
    if (data.requestedBy) {
        const [first, ...rest] = String(data.requestedBy).replace(/^Dr\.\s*/i, "").split(" ");
        const match = await disposalsRepository.findUserByName(first, rest.join(" "));
        if (match) disposedById = match.user_id;
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
 * Emails every holder of the ADRIC_DIRECTOR role that a disposal was filed. With nobody in the role,
 * or mail off, the mailer logs and skips it.
 *
 * @returns when the send was attempted or skipped; the controller does not wait for it
 */
// The role lookup runs after the answer was sent, and nothing catches it: if that database read fails,
// the rejection is unhandled, which stops the Node process by default. A small fix (catch and log it), outside the restructure.
// TODO(H-20): the asset name, requester, and pathway go into the email HTML unescaped. Step 13 (shared escaping).
export function notifyDirector(asset: assets, assetTag: string, data: DisposalRequestInput): Promise<void> {
    return authRepository.getRoleEmails("ADRIC_DIRECTOR").then(emails => sendEmail(
        emails,
        `New Disposal Request — ${asset.name} (${assetTag})`,
        emailTemplate("New Disposal Approval Request", `
                <p><strong>${data.requestedBy || "Staff"}</strong> has requested to decommission <strong>${asset.name}</strong> (${assetTag}).</p>
                <p><strong>Disposal Pathway:</strong> ${data.disposalPathway}</p>
                <p>Please review this request in the Clearance & Disposal tab of your dashboard.</p>
            `)
    ));
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
        current_custodian: latestRecord?.current_custodian ?? DEFAULT_CUSTODIAN_ID,
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
    });
}
