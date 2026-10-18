/**
 * The custody request guard: one pending loan, transfer, or disposal per asset, and only from a status that allows it,
 * checked again when the request is approved.
 * Layer: shared service. Called by features/loans/loans.service.ts, features/transfers/transfers.service.ts,
 * and features/disposals/disposals.service.ts, for each request and each approval.
 * Calls features/assets/assets.repository.ts, features/loans/loans.repository.ts, features/transfers/transfers.repository.ts,
 * and features/disposals/disposals.repository.ts.
 * Used by: Custodian borrow and transfer requests, Staff disposal requests, and the Lab Head and Director approvals.
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
        return `${asset.asset_tag} is ${describeStatus(status)} and cannot take this request.`;
    }
    return null;
}

/**
 * Says why approving a pending loan, transfer, or disposal must be refused, or null if it may go ahead.
 * The asset can change between the request and the decision, and rows filed before the guard above may
 * break its rules, so an approval checks the asset again with the same allowed statuses as its request.
 * A disposal is also refused while a loan or transfer is pending: that one is decided first (answer 2a).
 * Declining or rejecting is never refused, so stale requests can be cleared. (H-05, issue #28)
 *
 * @param assetId the asset the request is for
 * @param allowedStatuses the asset_records statuses this kind of request accepts
 * @param kind the kind of request being approved, named in the message
 * @returns a message for a 409 answer, or null
 */
// TODO(H-05): the check reads outside the decision's transaction, so two approvals in the same instant can both pass. Phase 3 database triggers.
export async function findDecisionConflict(
    assetId: number,
    allowedStatuses: readonly string[],
    kind: "loan" | "transfer" | "disposal",
): Promise<string | null> {
    const [asset, latestRecord] = await Promise.all([
        assetsRepository.findById(assetId),
        assetsRepository.findLatestRecordStatus(assetId),
    ]);
    const tag = asset?.asset_tag ?? `Asset ${assetId}`;
    const undoWord = kind === "disposal" ? "rejected" : "declined";

    const status = latestRecord?.status ?? "ACTIVE";
    if (!allowedStatuses.includes(status)) {
        return `${tag} is ${describeStatus(status)} now, so this ${kind} can only be ${undoWord}.`;
    }

    if (kind === "disposal") {
        const [pendingLoan, pendingTransfer] = await Promise.all([
            loansRepository.findPendingLoanId(assetId),
            transfersRepository.findPendingTransferId(assetId),
        ]);
        const pending = pendingLoan
            ? `loan request (LOAN-${pendingLoan.loan_id})`
            : pendingTransfer ? `transfer request (TRF-${pendingTransfer.transfer_id})` : null;
        if (pending) {
            return `${tag} has a pending ${pending}. It must be approved or declined before this disposal can be approved.`;
        }
    }
    return null;
}

/** The status as the messages say it: "on loan", "under maintenance", and so on. */
function describeStatus(status: string): string {
    const described: Record<string, string> = { ACTIVE: "active", ON_LOAN: "on loan", MAINTENANCE: "under maintenance", DISPOSED: "disposed" };
    return described[status] ?? status;
}
