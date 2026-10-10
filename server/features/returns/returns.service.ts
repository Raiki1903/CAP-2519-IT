/**
 * Returns service: the business rules for finalizing a return, and the return list.
 * Layer: service. Called by returns.controller.ts. Calls returns.repository.ts and shared/constants/defaultCustodian.ts.
 * Used by: Staff return finalization (ReturnForm), after a custodian's return request.
 */
import type { Prisma, asset_records, asset_returns } from '@prisma/client';
import type { ReturnInput, ReturnListItem } from '@shared/types/returns';
import * as returnsRepository from './returns.repository';
import { AppError } from '../../shared/errors/AppError';
import { DEFAULT_CUSTODIAN_ID } from '../../shared/constants/defaultCustodian';

/**
 * Finalizes a return: records it, and puts the asset back in the pool.
 * Only the finalized return reaches the server. The custodian's request before it lives in the
 * browser (web/state/browserOnly.tsx), because asset_returns has no status column to hold a
 * pending one. (H-02)
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked return body: returner name, condition, comments
 * @returns the created asset_returns row, with its CLR- reference number
 * @throws AppError 404 if no asset has this tag
 */
// TODO(H-05): a return is accepted whatever the asset's status, so an asset that is not out comes back ACTIVE, a disposed one included (issue #51). Its own fix; tests/api/returns.test.ts pins it.
// TODO(H-04): the matching loan stays approved, so it still counts as overdue. Phase 3 (a loan link on asset_returns).
export async function finalizeReturn(assetTag: string, data: ReturnInput): Promise<asset_returns> {
    const conditionEnum = data.condition;

    const existing = await returnsRepository.findAssetByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    // The form sends the returner as a typed name, split and matched the same way as the borrower
    // of a loan. returned_by_id is a required foreign key, so no name or no match becomes DEFAULT_CUSTODIAN_ID.
    // TODO(H-10): two people with the same name cannot be told apart, and a typo files the return under user 1 (issue #32). The returner comes from the session after step 13.
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
            // comments is VARCHAR(255): longer notes are cut, without a warning.
            comments: commentsText ? String(commentsText).slice(0, 255) : null,
            reference_number: referenceNumber,
        },
        (latestRecord) => turnInRecord(existing.asset_id, conditionEnum, commentsText, latestRecord),
    );
}

/**
 * Builds the record a finalized return appends: ACTIVE, held by DEFAULT_CUSTODIAN_ID (the pool).
 * The condition is the one reported on the return, not the one the asset left with.
 * current_location resets to the home location, since the asset is no longer out at a loan or
 * transfer destination. The return's comments replace the asset's remarks; with no comments,
 * the old remarks carry over.
 */
function turnInRecord(
    assetId: number,
    conditionEnum: string,
    commentsText: string | null,
    latestRecord: asset_records | null,
): Prisma.asset_recordsUncheckedCreateInput {
    return {
        asset_id: assetId,
        status: "ACTIVE",
        asset_condition: conditionEnum as any,
        location: latestRecord?.location ?? "Unassigned",
        current_location: latestRecord?.location ?? "Unassigned",
        current_custodian: DEFAULT_CUSTODIAN_ID,
        Asset_Remarks: commentsText ? String(commentsText).slice(0, 255) : (latestRecord?.Asset_Remarks ?? null),
    };
}

/**
 * Lists every finalized return, newest first, with its asset and returner named.
 * No screen calls it today; the Phase 2 tests do.
 *
 * @returns one ReturnListItem per asset_returns row
 */
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
