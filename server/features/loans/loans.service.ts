/**
 * Loans service: the business rules for borrow requests, decisions, and the loan list.
 * Layer: service. Called by loans.controller.ts. Calls loans.repository.ts, features/assets/assets.repository.ts,
 * and shared/services/lifecycleGuard.ts.
 * Used by: Custodian borrow request, Lab Head approval, and the screens that list loans.
 */
import { asset_loans_status, type asset_loans } from '@prisma/client';
import type { LoanDecision, LoanListItem, LoanRequestInput } from '@shared/types/loans';
import type { SessionIdentity } from '@shared/types/auth';
import * as loansRepository from './loans.repository';
import * as assetsRepository from '../assets/assets.repository';
import { LOAN_STATUS_LABELS } from '@shared/constants/loanStatuses';
import { CAMPUS_LABELS } from '@shared/constants/campuses';
import { AppError } from '../../shared/errors/AppError';
import { assertActionAllowed } from '../../shared/services/lifecycleGuard';
import { serverToday } from '../../shared/services/assetState';

/**
 * The word the current loan screens compare against for each loan status ("Pending", "Approved"). An open loan is
 * still "approved" to them. Every other text about a loan uses LOAN_STATUS_LABELS.
 */
// TODO(H-07): the Lab Head and Custodian loan screens still compare these words. Batch 3 sends the Loan shape (status and statusLabel) and removes this map.
const SCREEN_LOAN_WORDS: Record<asset_loans_status, string> = {
    PENDING_APPROVAL: "Pending",
    PENDING_RELEASE: "Pending release",
    DECLINED: "Declined",
    CANCELLED: "Cancelled",
    ON_LOAN: "Approved",
    RETURN_REQUESTED: "Return requested",
    RETURNED: "Returned",
    ENDED_BY_MAINTENANCE: "Ended by maintenance",
    ENDED_BY_LOSS: "Ended by loss",
};

/**
 * The word the current loan screens compare against: "Pending", "Approved", "Declined", "Returned".
 *
 * @param status the loan's status
 * @returns the word the screens compare against
 */
export function legacyLoanStatusLabel(status: asset_loans_status): string {
    return SCREEN_LOAN_WORDS[status];
}

/**
 * Lists every loan, newest first, shaped for the screens.
 * Every loan goes to every caller; the Lab Head screen keeps its own lab's rows by `lab`. (M-02)
 * A Custodian gets no borrower name on another person's loan (D2): `borrower_id` stays, because the asset modal
 * needs to know a loan is pending on the asset whoever asked, and the bell finds the caller's own loans by name.
 *
 * @param viewer the session user
 * @returns one LoanListItem per asset_loans row
 */
// TODO(M-02): scoping by lab happens only in the browser. Server-side with lab scoping, after step 14 (a lab_id on assets).
export async function listLoans(viewer: SessionIdentity): Promise<LoanListItem[]> {
    const dbLoans = await loansRepository.findAllNewestFirst();

    const [dbUsers, dbAssets, dbUserCenters] = await loansRepository.findListLookups();

    const loans: LoanListItem[] = dbLoans.map(l => {
        const borrowerUser = dbUsers.find(u => u.user_id === l.borrower_id);
        const asset = dbAssets.find(a => a.asset_id === l.asset_id);
        const borrowerCenterLink = dbUserCenters.find(uc => uc.user_id === l.borrower_id);
        const center = borrowerCenterLink?.research_centers;

        // A loan belongs to the lab that owns the asset, read from the tag prefix ("CeLT-0004" is CeLT),
        // not to the borrower's own lab: a borrower from another lab still asks the owning Lab Head.
        // GET /api/asset_transfers and /api/analytics/lab-head use the same convention.
        const lab = asset?.asset_tag?.includes("-") ? asset.asset_tag.split("-")[0] : "";

        // requestLoan stores the destination lab as the first line of purpose. It is read back out
        // as its own field and removed from the purpose shown, so the screen does not show it twice. (H-19)
        const destLabMatch = l.purpose?.match(/^Destination Lab:\s*(.+?)\s*(?:\n|$)/);
        const destinationLab = destLabMatch ? destLabMatch[1] : undefined;
        const cleanPurpose = destLabMatch
            ? l.purpose.replace(/^Destination Lab:\s*.+?\n\n?/, "")
            : l.purpose;

        return {
            id: `LOAN-${l.loan_id}`,
            loanId: l.loan_id,
            loan_id: l.loan_id,
            asset_id: l.asset_id,
            assetId: asset?.asset_tag || `EQ-2024-${l.asset_id}`,
            asset: asset?.name || "Unknown asset",
            assetName: asset?.name || "Unknown asset",
            borrower_id: l.borrower_id,
            borrower: borrowerUser ? `${borrowerUser.first_name} ${borrowerUser.last_name}` : `Borrower ID: ${l.borrower_id}`,
            purpose: cleanPurpose || "Research Project Use",
            destinationLab,
            requestedOn: l.requested_at ? l.requested_at.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            dueDate: l.return_by ? l.return_by.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            status: legacyLoanStatusLabel(l.status),
            statusLabel: LOAN_STATUS_LABELS[l.status],
            location: center ? CAMPUS_LABELS[center.location] : "Manila",
            lab,
            center_id: center?.center_id || 1
        };
    });

    return withoutOthersNames(loans, viewer);
}

/** For a Custodian, leaves the borrower name out of every loan that is not their own. Other roles get the list as is. (D2) */
function withoutOthersNames(loans: LoanListItem[], viewer: SessionIdentity): LoanListItem[] {
    if (viewer.role !== "Custodian") return loans;
    return loans.map(l => (l.borrower_id === viewer.userId ? l : { ...l, borrower: undefined }));
}

/**
 * Files a loan request for an asset, in Pending Approval.
 * Only the asset_loans row is written: the asset stays Available until the loan is approved (decideLoan).
 * The lifecycle guard refuses an asset that is not Available, or that already has an open loan, because two
 * approvals would promise one item twice. (H-05, issue #54)
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked borrow body: optional destination lab, purpose, due date
 * @param borrowerId the session user, who borrows as themselves; any borrower name in the body is ignored (issue #32)
 * @returns the created asset_loans row
 * @throws AppError 400 if the due date is before today, or the destination lab is not a known lab
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 409 if the guard refuses the request
 */
export async function requestLoan(assetTag: string, data: LoanRequestInput, borrowerId: number): Promise<asset_loans> {
    // Dates only, so a loan due today is accepted. A past due date makes the loan overdue as soon as it is approved.
    if (String(data.dueDate).slice(0, 10) < serverToday()) {
        throw new AppError(400, "The due date cannot be in the past.");
    }

    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    const openLoan = await assetsRepository.findOpenLoan(existing.asset_id);
    assertActionAllowed(existing, "REQUEST_LOAN", openLoan);

    let destinationCenterId: number | null = null;
    if (data.lab) {
        const lab = await assetsRepository.findLabByCode(String(data.lab).trim());
        if (!lab) {
            throw new AppError(400, "Pick a destination lab from the list.");
        }
        destinationCenterId = lab.center_id;
    }

    // The lab is also kept as the first line of purpose, where the current screens read it back.
    // TODO(H-19): the destination lab is still packed into the purpose for the screens. Batch 3 reads destination_center_id and stops packing it.
    const purposeWithLab = data.lab ? `Destination Lab: ${data.lab}\n\n${data.purpose}` : data.purpose;

    return loansRepository.create({
        asset_id: existing.asset_id,
        borrower_id: borrowerId,
        purpose: purposeWithLab,
        return_by: new Date(data.dueDate),
        status: asset_loans_status.PENDING_APPROVAL,
        destination_center_id: destinationCenterId,
    });
}

/**
 * Approves or declines a loan in Pending Approval.
 * Approval hands the asset over: there is no release step yet, so the loan goes straight to On Loan and the asset to
 * On Loan, in one transaction. Decline closes the loan; the asset stays Available.
 * An approval checks the asset again: it must still be Available. (issue #28)
 *
 * @param loanId the numeric loan id
 * @param decision "approve" or "decline"
 * @param deciderId the session user who decides
 * @returns the updated asset_loans row
 * @throws AppError 404 if no loan has this id
 * @throws AppError 400 if the loan is not in Pending Approval any more
 * @throws AppError 409 if an approval finds the asset no longer Available
 */
// TODO(H-04): approval skips Pending Release and the TSG release step. Batch 3 adds them.
export async function decideLoan(loanId: number, decision: LoanDecision, deciderId: number): Promise<asset_loans> {
    const loan = await loansRepository.findById(loanId);
    if (!loan) {
        throw new AppError(404, `No loan found with id ${loanId}.`);
    }
    if (loan.status !== asset_loans_status.PENDING_APPROVAL) {
        throw new AppError(400, `Loan #${loanId} is ${LOAN_STATUS_LABELS[loan.status]}, so it can no longer be decided.`);
    }
    if (decision === "approve") {
        const asset = await assetsRepository.findById(loan.asset_id);
        // The open loan is this one, so only the status is checked here.
        if (asset) assertActionAllowed(asset, "REQUEST_LOAN");
    }

    return loansRepository.saveDecision(loan, decision === "approve" ? asset_loans_status.ON_LOAN : asset_loans_status.DECLINED, deciderId);
}
