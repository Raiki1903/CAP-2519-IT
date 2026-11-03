/**
 * Returns service: the business rules for finalizing a return, and the return list.
 * Layer: service. Called by returns.controller.ts. Calls returns.repository.ts and features/assets/assets.repository.ts.
 * Used by: Staff return finalization (ReturnForm), after a custodian's return request.
 */
import type { asset_returns } from '@prisma/client';
import type { ReturnInput, ReturnListItem } from '@shared/types/returns';
import { ASSET_STATUS_LABELS } from '@shared/enums/assetStatus';
import * as returnsRepository from './returns.repository';
import * as assetsRepository from '../assets/assets.repository';
import { AppError } from '../../shared/errors/AppError';
import { isHeld } from '../../shared/services/assetState';

/**
 * Finalizes a return, in one transaction: the asset's held loan (On Loan or Return Requested) becomes Returned, with
 * who received it, when, and the comments; a Return inspection records the condition reported; the asset is
 * Available again, back at its home lab; and the asset_returns row keeps its CLR- reference for the screen.
 * The custodian's request before it lives in the browser (web/state/browserOnly.tsx). (H-02)
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked return body: condition and comments; a returner name is ignored (issue #32)
 * @param sessionUserId the Staff member finalizing it: the one who received it and inspected it
 * @returns the created asset_returns row, with its CLR- reference number
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 409 if the asset is not out on a loan
 */
// TODO(H-02): the custodian's return request is kept in the browser. Batch 3 stores it on the loan (Return Requested).
export async function finalizeReturn(assetTag: string, data: ReturnInput, sessionUserId: number): Promise<asset_returns> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    // Only an asset out with a borrower can come back. Anything else was already returned, or never left, so a
    // second or stale return is refused. (issue #51)
    const openLoan = await assetsRepository.findOpenLoan(existing.asset_id);
    if (existing.status !== "ON_LOAN" || !isHeld(openLoan)) {
        const why = existing.status === "ON_LOAN" ? "has no loan to close" : `is ${ASSET_STATUS_LABELS[existing.status]}`;
        throw new AppError(409, `${assetTag} ${why}, so there is nothing to return.`);
    }

    const commentsText = data.comments || data.inspection || null;
    // comments and remarks are cut to their columns' 255 characters, without a warning.
    const comments = commentsText ? String(commentsText).slice(0, 255) : null;

    return returnsRepository.saveReturn({
        assetId: existing.asset_id,
        loanId: openLoan!.loanId,
        // The returner is the borrower, by id (answer 2 of the 13c questions).
        returnedById: openLoan!.borrowerId,
        receivedById: sessionUserId,
        condition: data.condition,
        comments,
        referenceNumber: `CLR-${Date.now().toString(36).toUpperCase()}`,
    });
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
