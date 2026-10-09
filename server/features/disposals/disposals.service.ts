import type { Prisma, asset_disposals, asset_records, assets } from '@prisma/client';
import type { DisposalDecision, DisposalListItem, DisposalRequestInput } from '@shared/types/disposals';
import * as disposalsRepository from './disposals.repository';
import * as authRepository from '../auth/auth.repository';
import { AppError } from '../../shared/errors/AppError';
import { DEFAULT_CUSTODIAN_ID } from '../../shared/constants/defaultCustodian';
import { sendEmail, emailTemplate } from '../../shared/services/mailer';

export async function requestDisposal(
    assetTag: string,
    data: DisposalRequestInput,
): Promise<{ disposal: asset_disposals; asset: assets }> {
    const existing = await disposalsRepository.findAssetByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    // Same free-text-name -> user_id lookup convention used by /borrow,
    // /repair, and /transfer. Falls back to DEFAULT_CUSTODIAN_ID if
    // nothing matches — disposed_by_id is a required FK.
    let disposedById = DEFAULT_CUSTODIAN_ID;
    if (data.requestedBy) {
        const [first, ...rest] = String(data.requestedBy).replace(/^Dr\.\s*/i, "").split(" ");
        const match = await disposalsRepository.findUserByName(first, rest.join(" "));
        if (match) disposedById = match.user_id;
    }

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

export async function decideDisposal(disposalId: number, decision: DisposalDecision): Promise<asset_disposals> {
    const disposal = await disposalsRepository.findById(disposalId);
    if (!disposal) {
        throw new AppError(404, `No disposal request found with id ${disposalId}.`);
    }
    if (disposal.status !== "pending") {
        throw new AppError(400, `Disposal #${disposalId} has already been ${disposal.status}.`);
    }

    const newStatus = decision === "approve" ? "approved" : "rejected";
    // On reject, asset_records is untouched — the asset never left
    // its prior status, so ITS/TSG can re-file or continue using it.
    return disposalsRepository.saveDecision(
        disposal,
        newStatus,
        decision === "approve" ? (latestRecord) => disposedRecord(disposal, latestRecord) : null,
    );
}

function disposedRecord(disposal: asset_disposals, latestRecord: asset_records | null): Prisma.asset_recordsUncheckedCreateInput {
    // This is the actual decommissioning — the asset stays exactly
    // as it was (Active/Maintenance/whatever) until the Director
    // signs off. Custodian carries forward unchanged, purely for
    // the audit trail of who last held it when it was disposed.
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
