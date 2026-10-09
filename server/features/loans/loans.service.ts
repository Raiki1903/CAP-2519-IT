/**
 * Loans service: the business rules for borrow requests, decisions, and the loan list.
 * Layer: service. Called by loans.controller.ts. Calls loans.repository.ts, shared/services/custodyRequestGuard.ts,
 * shared/utils/campus.ts, and shared/constants/defaultCustodian.ts.
 * Used by: Custodian borrow request, Lab Head approval, and the screens that list loans.
 */
import type { Prisma, asset_loans, asset_records } from '@prisma/client';
import type { LoanDecision, LoanListItem, LoanRequestInput } from '@shared/types/loans';
import * as loansRepository from './loans.repository';
import { AppError } from '../../shared/errors/AppError';
import { DEFAULT_CUSTODIAN_ID } from '../../shared/constants/defaultCustodian';
import { campusForLab } from '../../shared/utils/campus';
import { findCustodyRequestConflict } from '../../shared/services/custodyRequestGuard';

/**
 * Lists every loan, newest first, shaped for the screens.
 * Every loan goes to every caller; the Lab Head screen keeps its own lab's rows by `lab`. (M-02)
 *
 * @returns one LoanListItem per asset_loans row
 */
// TODO(M-02): scoping by lab happens only in the browser. Server-side, once requireAuth gives the acting user (step 13 or later).
export async function listLoans(): Promise<LoanListItem[]> {
    let dbLoans = await loansRepository.findAllNewestFirst();

    // TODO(H-08): a read writes data. With no pending loan and no loan 9, this inserts loan 9 as pending on the first asset for the first student, and the list names its asset "ASUS TUF Gaming A15". Delete the block, its own fix.
    if (!dbLoans.some(l => l.loan_id === 9 || l.status === "pending" || l.status === "Pending")) {
        const firstAsset = await loansRepository.findFirstAsset();
        const firstUser = await loansRepository.findFirstStudent();
        if (firstAsset && firstUser) {
            try {
                const seeded = await loansRepository.create({
                    loan_id: 9,
                    asset_id: firstAsset.asset_id,
                    borrower_id: firstUser.user_id,
                    purpose: "Graphics & AI Performance Testing",
                    status: "pending",
                    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                });
                dbLoans.unshift(seeded);
            } catch (err) { }
        }
    }

    const [dbUsers, dbAssets, dbUserCenters] = await loansRepository.findListLookups();

    return dbLoans.map(l => {
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
            asset: l.loan_id === 9 ? "ASUS TUF Gaming A15" : (asset?.name || "ASUS TUF Gaming A15"),
            assetName: l.loan_id === 9 ? "ASUS TUF Gaming A15" : (asset?.name || "ASUS TUF Gaming A15"),
            borrower_id: l.borrower_id,
            borrower: borrowerUser ? `${borrowerUser.first_name} ${borrowerUser.last_name}` : `Borrower ID: ${l.borrower_id}`,
            purpose: cleanPurpose || "Research Project Use",
            destinationLab,
            requestedOn: l.loaned_on ? l.loaned_on.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            dueDate: l.due_date ? l.due_date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            status: l.status ? (l.status.charAt(0).toUpperCase() + l.status.slice(1)) : "Pending",
            location: center ? (center.location === "MANILA" ? "Manila" : "Laguna") : "Manila",
            lab,
            center_id: center?.center_id || 1
        };
    });
}

/**
 * Files a pending loan request for an asset.
 * Only the asset_loans row is written. Custody does not move until a Lab Head approves
 * (decideLoan), so the asset stays with its current custodian while the request is pending.
 * The custody request guard refuses an asset that already has a pending loan or transfer,
 * or is not Active, because two approvals would give one item two custodians. (H-05)
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked borrow body: borrower name, optional destination lab, purpose, due date
 * @returns the created asset_loans row
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 409 if the guard refuses the request
 */
export async function requestLoan(assetTag: string, data: LoanRequestInput): Promise<asset_loans> {
    const existing = await loansRepository.findAssetByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    const conflict = await findCustodyRequestConflict(existing, ["ACTIVE"]);
    if (conflict) {
        throw new AppError(409, conflict);
    }

    // The form sends the borrower as a typed name. The first word is matched as the first name and
    // the rest as the last name, after dropping a leading "Dr.". borrower_id is a required foreign key,
    // so a name that matches nobody becomes DEFAULT_CUSTODIAN_ID.
    // TODO(H-10): two people with the same name cannot be told apart, and a typo files the loan under user 1 (issue #32). The borrower comes from the session after step 13.
    let borrowerId = DEFAULT_CUSTODIAN_ID;
    const [first, ...rest] = String(data.borrower).replace(/^Dr\.\s*/i, "").split(" ");
    const match = await loansRepository.findUserByName(first, rest.join(" "));
    if (match) borrowerId = match.user_id;

    // asset_loans has no destination column, so the lab is stored as the first line of purpose,
    // where listLoans and the approval read it back.
    // TODO(H-19): the destination lab is packed into free text and parsed back with a regex. A real column, Phase 3.
    const purposeWithLab = data.lab ? `Destination Lab: ${data.lab}\n\n${data.purpose}` : data.purpose;

    return loansRepository.create({
        asset_id: existing.asset_id,
        borrower_id: borrowerId,
        purpose: purposeWithLab,
        due_date: new Date(data.dueDate),
        status: "pending",
    });
}

/**
 * Approves or declines a pending loan.
 * Approval is the custody handoff: the loan becomes approved and a new ON_LOAN record moves
 * the asset to the borrower, in one transaction. Decline changes only the loan's status.
 *
 * @param loanId the numeric loan id
 * @param decision "approve" or "decline"
 * @returns the updated asset_loans row
 * @throws AppError 404 if no loan has this id
 * @throws AppError 400 if the loan is not pending any more
 */
export async function decideLoan(loanId: number, decision: LoanDecision): Promise<asset_loans> {
    const loan = await loansRepository.findById(loanId);
    if (!loan) {
        throw new AppError(404, `No loan found with id ${loanId}.`);
    }
    if (loan.status !== "pending") {
        throw new AppError(400, `Loan #${loanId} has already been ${loan.status}.`);
    }

    const newLoanStatus = decision === "approve" ? "approved" : "declined";
    // A decline writes no custody record: custody never left the current custodian, so there is nothing to undo.
    return loansRepository.saveDecision(
        loan,
        newLoanStatus,
        decision === "approve" ? (latestRecord) => handoverRecord(loan, latestRecord) : null,
    );
}

/**
 * Builds the custody record an approval appends: ON_LOAN, held by the borrower.
 * The condition and the home location carry over from the asset's latest record.
 * current_location becomes the destination lab with its campus when the request named one,
 * and otherwise stays where the asset is.
 */
function handoverRecord(loan: asset_loans, latestRecord: asset_records | null): Prisma.asset_recordsUncheckedCreateInput {
    const destLabMatch = loan.purpose?.match(/^Destination Lab:\s*(.+?)\s*(?:\n|$)/);
    const destLab = destLabMatch ? destLabMatch[1] : null;
    const currentLocationVal = destLab
        ? `${campusForLab(destLab)} — ${destLab}`
        : (latestRecord?.current_location ?? latestRecord?.location ?? "Unassigned");

    return {
        asset_id: loan.asset_id,
        status: "ON_LOAN",
        asset_condition: latestRecord?.asset_condition ?? "PERFECT",
        location: latestRecord?.location ?? "Unassigned",
        current_location: currentLocationVal,
        current_custodian: loan.borrower_id,
    };
}
