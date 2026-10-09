import type { Prisma, asset_records, asset_transfers, assets, users } from '@prisma/client';
import type { TransferDecision, TransferListItem, TransferRequestInput } from '@shared/types/transfers';
import * as transfersRepository from './transfers.repository';
import * as authRepository from '../auth/auth.repository';
import { AppError } from '../../shared/errors/AppError';
import { DEFAULT_CUSTODIAN_ID } from '../../shared/constants/defaultCustodian';
import { campusForLab } from '../../shared/utils/campus';
import { findCustodyRequestConflict } from '../../shared/services/custodyRequestGuard';
import { sendEmail, emailTemplate } from '../../shared/services/mailer';

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

    // From-custodian is read straight off the asset's own record log — no
    // lookup needed since we already know exactly who holds it.
    const latestRecord = await transfersRepository.findLatestRecord(existing.asset_id);
    const fromCustodianId = latestRecord?.current_custodian ?? DEFAULT_CUSTODIAN_ID;

    // Recipient is identified by email now, not free-text name — this has
    // to resolve to a real account (unlike the old name-based lookups
    // elsewhere that fall back to a default), since that account is the
    // one who'll see and act on this request.
    const recipient = await transfersRepository.findUserByEmail(data.toEmail);
    if (!recipient) {
        throw new AppError(404, `No user found with email ${data.toEmail}.`);
    }

    // asset_transfers has no dedicated destination-lab column, so the lab
    // picked on the form is composed into justification — parsed back out
    // in the decision endpoint below to format current_location as
    // "<Lab>-<Campus>" once the recipient is approved.
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

export async function listTransfers(): Promise<TransferListItem[]> {
    const [dbTransfers, dbAssets, dbUsers, dbRecords] = await transfersRepository.findListLookups();

    return dbTransfers.map(t => {
        const asset = dbAssets.find(a => a.asset_id === t.asset_id);
        const fromUser = dbUsers.find(u => u.user_id === t.from_custodian_id);
        const toUser = dbUsers.find(u => u.user_id === t.to_custodian_id);

        // Scope by the asset's own tag prefix (e.g. "CeLT-0004" -> "CeLT")
        // — the same convention /api/analytics/lab-head already uses
        // successfully. This is set once at intake and never drifts,
        // unlike the asset's *current* location (which changes with every
        // loan/transfer/return) or a destination hint parsed out of
        // justification (which only exists on transfers created after
        // that encoding was added). location is still derived from the
        // asset's latest record purely for display, not for lab-matching.
        const latestRecord = dbRecords.find(r => r.asset_id === t.asset_id);
        const [campus] = (latestRecord?.location || "Unassigned").split(" — ");
        const lab = asset?.asset_tag?.includes("-") ? asset.asset_tag.split("-")[0] : "";

        // The destination lab picked on TransferForm was encoded into
        // justification at creation time (see /transfer) — pulled out
        // here as its own field for display, stripped from the shown
        // justification/reason text so it isn't shown twice.
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

export async function decideTransfer(transferId: number, decision: TransferDecision): Promise<asset_transfers> {
    const transfer = await transfersRepository.findById(transferId);
    if (!transfer) {
        throw new AppError(404, `No transfer found with id ${transferId}.`);
    }
    if (transfer.status !== "pending") {
        throw new AppError(400, `Transfer #${transferId} has already been ${transfer.status}.`);
    }

    const newStatus = decision === "approve" ? "approved" : "declined";
    // On decline, asset_records is untouched — custody never left the
    // original custodian.
    return transfersRepository.saveDecision(
        transfer,
        newStatus,
        decision === "approve" ? (latestRecord) => handoverRecord(transfer, latestRecord) : null,
    );
}

function handoverRecord(transfer: asset_transfers, latestRecord: asset_records | null): Prisma.asset_recordsUncheckedCreateInput {
    // This is the actual custody handoff — the asset stays with its
    // prior custodian until now. Status goes to ON_LOAN under the
    // new custodian, same as an approved loan.

    // current_location becomes "<Campus> — <Lab>" (e.g. "Laguna — CeLT"),
    // matching the same format used by location, from the destination
    // picked on TransferForm (logged into justification at creation
    // time, see /transfer above). location (home lab) is untouched.
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
