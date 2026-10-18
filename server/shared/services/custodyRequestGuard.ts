/**
 * The custody request guard: one pending loan, transfer, or disposal per asset, and only from a status that allows it.
 * Layer: shared service. Called by features/loans/loans.service.ts (borrow), features/transfers/transfers.service.ts (transfer request),
 * and features/disposals/disposals.service.ts (disposal request).
 * Calls features/assets/assets.repository.ts, features/loans/loans.repository.ts, features/transfers/transfers.repository.ts,
 * and features/disposals/disposals.repository.ts.
 * Used by: Custodian borrow and transfer requests, Staff disposal requests.
 */
import * as assetsRepository from '../../features/assets/assets.repository';
import * as loansRepository from '../../features/loans/loans.repository';
import * as transfersRepository from '../../features/transfers/transfers.repository';
import * as disposalsRepository from '../../features/disposals/disposals.repository';

/**
 * Says why a new loan, transfer, or disposal request on an asset must be refused, or null if it may go ahead.
 * An asset may hold only one pending request of any of the three kinds, because approving two would hand one
 * item to two custodians, or dispose of an item someone is about to receive. (H-05, issues #25 and #54)
 * The latest record is read with the asset list's ordering, so the guard agrees with the status the screens show.
 *
 * @param asset the asset row being requested
 * @param allowedStatuses the asset_records statuses this kind of request accepts
 * @returns a message for a 409 answer, or null
 */
export async function findCustodyRequestConflict(
    asset: { asset_id: number; asset_tag: string },
    allowedStatuses: readonly string[],
): Promise<string | null> {
    // TODO(H-05): the check and the insert are not atomic, so two requests in the same instant can both pass. Phase 3 database triggers.
    const [latestRecord, pendingLoan, pendingTransfer, pendingDisposal] = await Promise.all([
        assetsRepository.findLatestRecordStatus(asset.asset_id),
        loansRepository.findPendingLoanId(asset.asset_id),
        transfersRepository.findPendingTransferId(asset.asset_id),
        disposalsRepository.findPendingDisposalId(asset.asset_id),
    ]);

    if (pendingLoan) return `${asset.asset_tag} already has a pending loan request (LOAN-${pendingLoan.loan_id}).`;
    if (pendingTransfer) return `${asset.asset_tag} already has a pending transfer request (TRF-${pendingTransfer.transfer_id}).`;
    if (pendingDisposal) return `${asset.asset_tag} already has a pending disposal request (DISP-${pendingDisposal.disposal_id}).`;

    // An asset with no record yet is listed as Active, so it is treated as ACTIVE here too.
    const status = latestRecord?.status ?? "ACTIVE";
    if (!allowedStatuses.includes(status)) {
        const described: Record<string, string> = { ACTIVE: "active", ON_LOAN: "on loan", MAINTENANCE: "under maintenance", DISPOSED: "disposed" };
        return `${asset.asset_tag} is ${described[status] ?? status} and cannot take this request.`;
    }
    return null;
}
