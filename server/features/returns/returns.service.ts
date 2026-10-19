/**
 * Returns service: the business rules for finalizing a return, and the return list.
 * Layer: service. Called by returns.controller.ts. Calls returns.repository.ts, features/assets/assets.repository.ts,
 * and shared/constants/poolCustodian.ts.
 * Used by: Staff return finalization (ReturnForm), after a custodian's return request.
 */
import type { Prisma, asset_records, asset_returns } from '@prisma/client';
import type { ReturnInput, ReturnListItem } from '@shared/types/returns';
import * as returnsRepository from './returns.repository';
import * as assetsRepository from '../assets/assets.repository';
import { AppError } from '../../shared/errors/AppError';
import { POOL_CUSTODIAN_ID } from '../../shared/constants/poolCustodian';

/**
 * Finalizes a return: records it, puts the asset back in the pool, and closes the asset's approved loans
 * (status "returned"), in one transaction.
 * Only the finalized return reaches the server. The custodian's request before it lives in the
 * browser (web/state/browserOnly.tsx), because asset_returns has no status column to hold a
 * pending one. (H-02)
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked return body: condition and comments; a returner name is ignored (issue #32)
 * @param sessionUserId the Staff member finalizing it, recorded as the returner only when nobody holds the asset
 * @returns the created asset_returns row, with its CLR- reference number
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 409 if the asset is not out (see returnRefusal)
 */
// TODO(H-05): the check and the write are not atomic, so two returns in the same instant can both pass. Phase 3 database triggers.
export async function finalizeReturn(assetTag: string, data: ReturnInput, sessionUserId: number): Promise<asset_returns> {
    const conditionEnum = data.condition;

    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    const latestRecord = await assetsRepository.findLatestRecord(existing.asset_id);
    const refusal = returnRefusal(assetTag, latestRecord);
    if (refusal) {
        throw new AppError(409, refusal);
    }

    // Staff finalize the return on the custodian's behalf, so the returner is whoever holds the asset in its
    // latest record, by id (answer 2 of the 13c questions). When nobody holds it (the placeholder
    // POOL_CUSTODIAN_ID), the Staff member finalizing it is recorded instead. (issue #32)
    const holderId = latestRecord?.current_custodian;
    const returnedById = holderId && holderId !== POOL_CUSTODIAN_ID ? holderId : sessionUserId;

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
 * Says why an asset cannot be returned, or null if it is out. An asset is out when it is on loan, or Active
 * and held by a real person (Edit Asset can give an Active asset a custodian). The asset modal offers
 * Return Asset and Record Return only on an asset on loan (On Loan or Overdue on screen), so the Active
 * case comes only from a direct call or an old browser request.
 * An asset nobody holds was already returned, or never left, so a second or stale return is refused. (issue #51)
 */
function returnRefusal(assetTag: string, latestRecord: asset_records | null): string | null {
    if (latestRecord?.status === "ON_LOAN") return null;
    if (latestRecord?.status === "DISPOSED") return `${assetTag} is disposed and cannot be returned.`;
    if (latestRecord?.status === "MAINTENANCE") return `${assetTag} is under maintenance and cannot be returned until its repair is finished.`;
    if (latestRecord && latestRecord.current_custodian !== POOL_CUSTODIAN_ID) return null;
    return `${assetTag} is not out with anyone, so there is nothing to return.`;
}

/**
 * Builds the record a finalized return appends: ACTIVE, held by POOL_CUSTODIAN_ID (the pool).
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
        current_custodian: POOL_CUSTODIAN_ID,
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
