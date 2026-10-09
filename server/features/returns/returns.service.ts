import type { Prisma, asset_records, asset_returns } from '@prisma/client';
import type { ReturnInput, ReturnListItem } from '@shared/types/returns';
import * as returnsRepository from './returns.repository';
import { AppError } from '../../shared/errors/AppError';
import { DEFAULT_CUSTODIAN_ID } from '../../shared/constants/defaultCustodian';

export async function finalizeReturn(assetTag: string, data: ReturnInput): Promise<asset_returns> {
    const conditionEnum = data.condition;

    const existing = await returnsRepository.findAssetByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    // Same free-text-name -> user_id lookup convention used by /borrow and /repair.
    let returnedById = DEFAULT_CUSTODIAN_ID;
    if (data.returnedBy) {
        const [first, ...rest] = String(data.returnedBy).replace(/^Dr\.\s*/i, "").split(" ");
        const match = await returnsRepository.findUserByName(first, rest.join(" "));
        if (match) returnedById = match.user_id;
    }

    const referenceNumber = `CLR-${Date.now().toString(36).toUpperCase()}`;

    const commentsText = data.comments || data.inspection || null;

    return returnsRepository.saveReturn(
        {
            asset_id: existing.asset_id,
            returned_by_id: returnedById,
            condition: conditionEnum as any,
            comments: commentsText ? String(commentsText).slice(0, 255) : null,
            reference_number: referenceNumber,
        },
        (latestRecord) => turnInRecord(existing.asset_id, conditionEnum, commentsText, latestRecord),
    );
}

function turnInRecord(
    assetId: number,
    conditionEnum: string,
    commentsText: string | null,
    latestRecord: asset_records | null,
): Prisma.asset_recordsUncheckedCreateInput {
    // Closing the loop: asset goes back into the general pool — status
    // ACTIVE, custodian reset to the default/unassigned holder. Location
    // carries forward from the latest record (unchanged). Condition is
    // updated to reflect what was just reported on this return, not
    // whatever the asset's condition was before it went out.
    return {
        asset_id: assetId,
        status: "ACTIVE",
        asset_condition: conditionEnum as any,
        location: latestRecord?.location ?? "Unassigned",
        // Back with the lab it belongs to — no longer checked out
        // anywhere specific (loan/transfer destination) or at the
        // TSG Office, so current_location resets to match location.
        current_location: latestRecord?.location ?? "Unassigned",
        current_custodian: DEFAULT_CUSTODIAN_ID,
        // TSG/ITS's turn-in comment on the return form replaces
        // whatever was previously in Asset_Remarks; if no comment
        // was entered, the prior remarks carry forward unchanged.
        Asset_Remarks: commentsText ? String(commentsText).slice(0, 255) : (latestRecord?.Asset_Remarks ?? null),
    };
}

export async function listReturns(): Promise<ReturnListItem[]> {
    const [dbReturns, dbAssets, dbUsers] = await returnsRepository.findListLookups();

    return dbReturns.map(r => {
        const asset = dbAssets.find(a => a.asset_id === r.asset_id);
        const returnedBy = dbUsers.find(u => u.user_id === r.returned_by_id);

        return {
            id: `RET-${r.return_id}`,
            returnId: r.return_id,
            assetId: asset?.asset_tag || "",
            asset: asset?.name || "Unknown Asset",
            returnedBy: returnedBy ? `${returnedBy.first_name} ${returnedBy.last_name}` : "Unknown",
            condition: r.condition,
            referenceNumber: r.reference_number,
            returnedOn: r.returned_on.toISOString(),
        };
    });
}
