/**
 * Transfers service: the business rules for custodianship transfer requests, decisions, and the transfer list.
 * Layer: service. Called by transfers.controller.ts. Calls transfers.repository.ts, features/auth/auth.repository.ts,
 * shared/services/custodyRequestGuard.ts, shared/services/mailer.ts, shared/utils/campus.ts, and shared/constants/defaultCustodian.ts.
 * Used by: Custodian transfer request, Lab Head approval (Custody tab and the bell), and the screens that list transfers.
 */
import type { Prisma, asset_records, asset_transfers, assets, users } from '@prisma/client';
import type { TransferDecision, TransferListItem, TransferRequestInput } from '@shared/types/transfers';
import * as transfersRepository from './transfers.repository';
import * as authRepository from '../auth/auth.repository';
import { AppError } from '../../shared/errors/AppError';
import { DEFAULT_CUSTODIAN_ID } from '../../shared/constants/defaultCustodian';
import { campusForLab } from '../../shared/utils/campus';
import { findCustodyRequestConflict } from '../../shared/services/custodyRequestGuard';
import { sendEmail, emailTemplate } from '../../shared/services/mailer';

// Transfers are kept exactly as they are until the custodianship queue replaces them (issue #22,
// decided 2026-10-04): the custodian will release the asset to Staff, and Staff assign the next one.
// That is why no Lab Head approval rule is added here, though the screens give the decision to the Lab Head.

/**
 * Files a pending transfer request for an asset.
 * Only the asset_transfers row is written. Custody does not move until the transfer is approved
 * (decideTransfer). The custody request guard refuses an asset that already has a pending loan or
 * transfer, or is not Active or On Loan, because two approvals would give one item two custodians. (H-05)
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked transfer body: recipient email, reason, optional destination lab
 * @returns the created row, plus the asset and recipient for the email the controller sends after answering
 * @throws AppError 404 if no asset has this tag, or no account has the recipient email
 * @throws AppError 409 if the guard refuses the request
 */
export async function requestTransfer(
    assetTag: string,
    data: TransferRequestInput,
): Promise<{ transfer: asset_transfers; asset: assets; recipient: users }> {
    const existing = await transfersRepository.findAssetByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    // ON_LOAN is accepted as well as ACTIVE: the detail modal offers a transfer
    // only on an asset that is out on loan, and an approved transfer leaves it ON_LOAN.
    const conflict = await findCustodyRequestConflict(existing, ["ACTIVE", "ON_LOAN"]);
    if (conflict) {
        throw new AppError(409, conflict);
    }

    // The custodian the asset leaves is whoever holds it in its latest record, not anyone named in the request.
    const latestRecord = await transfersRepository.findLatestRecord(existing.asset_id);
    const fromCustodianId = latestRecord?.current_custodian ?? DEFAULT_CUSTODIAN_ID;

    // The recipient is looked up by email and must exist, unlike the typed-name lookups elsewhere
    // that fall back to user 1: the recipient becomes the asset's custodian on approval.
    const recipient = await transfersRepository.findUserByEmail(data.toEmail);
    if (!recipient) {
        throw new AppError(404, `No user found with email ${data.toEmail}.`);
    }

    // asset_transfers has no destination column, so the lab is stored as the first line of the
    // justification, where listTransfers and the approval read it back.
    // TODO(H-19): the destination lab is packed into free text and parsed back with a regex, and the effective date is not stored. Columns of their own, Phase 3.
    const justificationWithLab = data.lab
        ? `Destination Lab: ${data.lab}\n\n${data.reason}`
        : data.reason;

    const transfer = await transfersRepository.create({
        asset_id: existing.asset_id,
        from_custodian_id: fromCustodianId,
        to_custodian_id: recipient.user_id,
        justification: justificationWithLab,
        status: "pending",
    });

    return { transfer, asset: existing, recipient };
}

/**
 * Emails the recipient that a transfer to them was filed. With mail off, the mailer logs and skips it.
 * The wording asks the recipient to accept or decline, but no screen offers them that: the Lab Head
 * decides. Left as is until the custodianship queue (issue #22).
 *
 * @returns when the send was attempted or skipped; the controller does not wait for it
 */
// TODO(H-20): the asset name and the typed reason go into the email HTML unescaped. Step 13 (shared escaping).
export function notifyRecipient(asset: assets, recipient: users, assetTag: string, reason: string): Promise<void> {
    return sendEmail(
        recipient.email,
        `Asset Transfer Request — ${asset.name} (${assetTag})`,
        emailTemplate("You've Been Sent a Custodianship Transfer", `
                <p>You've been asked to take custody of <strong>${asset.name}</strong> (${assetTag}).</p>
                <p><strong>Reason:</strong> ${reason}</p>
                <p>Please review and accept or decline this request in your portal.</p>
            `)
    );
}

/**
 * Lists every transfer, newest first, shaped for the screens.
 * Every transfer goes to every caller, with each recipient's email; the Lab Head screen keeps
 * its own lab's rows by `lab`. (M-02)
 *
 * @returns one TransferListItem per asset_transfers row
 */
// TODO(M-02): scoping by lab happens only in the browser. Server-side, once requireAuth gives the acting user (step 13 or later).
export async function listTransfers(): Promise<TransferListItem[]> {
    const [dbTransfers, dbAssets, dbUsers, dbRecords] = await transfersRepository.findListLookups();

    return dbTransfers.map(t => {
        const asset = dbAssets.find(a => a.asset_id === t.asset_id);
        const fromUser = dbUsers.find(u => u.user_id === t.from_custodian_id);
        const toUser = dbUsers.find(u => u.user_id === t.to_custodian_id);

        // A transfer belongs to the lab that owns the asset, read from the tag prefix ("CeLT-0004" is CeLT).
        // The prefix is set at intake and never changes, unlike the asset's current location.
        // GET /api/asset_loans and /api/analytics/lab-head use the same convention.
        // The campus is taken from the latest record for display only.
        const latestRecord = dbRecords.find(r => r.asset_id === t.asset_id);
        const [campus] = (latestRecord?.location || "Unassigned").split(" — ");
        const lab = asset?.asset_tag?.includes("-") ? asset.asset_tag.split("-")[0] : "";

        // requestTransfer stores the destination lab as the first line of the justification. It is read
        // back out as its own field and removed from the text shown, so the screen does not show it twice. (H-19)
        const destLabMatch = t.justification?.match(/^Destination Lab:\s*(.+?)\s*(?:\n|$)/);
        const destinationLab = destLabMatch ? destLabMatch[1] : undefined;
        const cleanJustification = destLabMatch
            ? t.justification.replace(/^Destination Lab:\s*.+?\n\n?/, "")
            : t.justification;

        let status: "Pending" | "Approved" | "Declined" = "Pending";
        if (t.status === "approved") status = "Approved";
        else if (t.status === "declined") status = "Declined";

        return {
            id: `TRF-${t.transfer_id}`,
            transferId: t.transfer_id,
            assetId: asset?.asset_tag || "",
            asset: asset?.name || "Unknown Asset",
            from: fromUser ? `${fromUser.first_name} ${fromUser.last_name}` : "Unknown",
            fromCustodianId: t.from_custodian_id,
            to: toUser ? `${toUser.first_name} ${toUser.last_name}` : "Unknown",
            toEmail: toUser?.email || "",
            justification: cleanJustification,
            destinationLab,
            requestedOn: t.requested_on.toISOString().split("T")[0],
            status,
            location: campus || "Unassigned",
            lab,
        };
    });
}

/**
 * Approves or declines a pending transfer.
 * Approval is the custody handoff: the transfer becomes approved and a new ON_LOAN record moves
 * the asset to the recipient, in one transaction. Decline changes only the transfer's status.
 * The server does not check who decides (C-02, and no approval rule, see the top of this file).
 *
 * @param transferId the numeric transfer id
 * @param decision "approve" or "decline"
 * @returns the updated asset_transfers row
 * @throws AppError 404 if no transfer has this id
 * @throws AppError 400 if the transfer is not pending, including one /accept moved to pending_approver (M-12)
 */
export async function decideTransfer(transferId: number, decision: TransferDecision): Promise<asset_transfers> {
    const transfer = await transfersRepository.findById(transferId);
    if (!transfer) {
        throw new AppError(404, `No transfer found with id ${transferId}.`);
    }
    if (transfer.status !== "pending") {
        throw new AppError(400, `Transfer #${transferId} has already been ${transfer.status}.`);
    }

    const newStatus = decision === "approve" ? "approved" : "declined";
    // A decline writes no custody record: custody never left the current custodian, so there is nothing to undo.
    return transfersRepository.saveDecision(
        transfer,
        newStatus,
        decision === "approve" ? (latestRecord) => handoverRecord(transfer, latestRecord) : null,
    );
}

/**
 * Builds the custody record an approval appends: ON_LOAN, held by the recipient, as for an approved loan.
 * The condition and the home location carry over from the asset's latest record.
 * current_location becomes the destination lab with its campus when the request named one,
 * and otherwise stays where the asset is.
 */
function handoverRecord(transfer: asset_transfers, latestRecord: asset_records | null): Prisma.asset_recordsUncheckedCreateInput {
    const destLabMatch = transfer.justification?.match(/^Destination Lab:\s*(.+?)\s*(?:\n|$)/);
    const destLab = destLabMatch ? destLabMatch[1] : null;
    const currentLocationVal = destLab
        ? `${campusForLab(destLab)} — ${destLab}`
        : (latestRecord?.current_location ?? latestRecord?.location ?? "Unassigned");

    return {
        asset_id: transfer.asset_id,
        status: "ON_LOAN",
        asset_condition: latestRecord?.asset_condition ?? "PERFECT",
        location: latestRecord?.location ?? "Unassigned",
        current_location: currentLocationVal,
        current_custodian: transfer.to_custodian_id,
    };
}

/**
 * Emails the custodian the asset was leaving that their transfer was approved or declined.
 * The wording says "the recipient" decided; on screen the Lab Head does. Left as is until the
 * custodianship queue (issue #22).
 *
 * @param fromCustodianId the transfer's from_custodian_id; nothing is sent if that user has no email
 * @returns when the send was attempted or skipped; the controller does not wait for it
 */
// The email lookup runs after the answer was sent, and nothing catches it: if that database read fails,
// the rejection is unhandled, which stops the Node process by default. A small fix (catch and log it), outside the restructure.
export function notifyDecision(transferId: number, fromCustodianId: number, decision: TransferDecision): Promise<void> {
    return authRepository.getUserEmail(fromCustodianId).then(email => {
        if (!email) return;
        const approved = decision === "approve";
        return sendEmail(
            email,
            `Transfer Request ${approved ? "Accepted" : "Declined"} — Transfer #${transferId}`,
            emailTemplate(`Custodianship Transfer ${approved ? "Accepted" : "Declined"}`, `
                    <p>The recipient has <strong>${approved ? "accepted" : "declined"}</strong> the transfer you initiated.</p>
                    ${approved ? `<p>Custody has moved to them.</p>` : `<p>The asset remains with you.</p>`}
                `)
        );
    });
}

/**
 * Handles the old "destination custodian accepts" step: sets the transfer to pending_approver
 * and appends the remarks, if any, to its justification.
 * No screen calls it.
 *
 * @param transferId the numeric transfer id (not checked; NaN reaches Prisma, which answers with a 500)
 * @param remarks optional text from the body
 * @returns the updated asset_transfers row
 * @throws AppError 404 if no transfer has this id
 */
// TODO(M-12): this moves a transfer from any status, decided ones included, to pending_approver, which decideTransfer then refuses, so the transfer is stuck. 01D deletes the endpoint; until then it is kept as is (team decision on transfers, issue #22).
export async function acceptTransfer(transferId: number, remarks: any): Promise<asset_transfers> {
    const transfer = await transfersRepository.findById(transferId);
    if (!transfer) {
        throw new AppError(404, "Transfer request not found.");
    }

    return transfersRepository.update(transferId, {
        status: "pending_approver",
        justification: remarks ? `${transfer.justification}\n[Destination Remarks]: ${remarks}` : transfer.justification,
    });
}
