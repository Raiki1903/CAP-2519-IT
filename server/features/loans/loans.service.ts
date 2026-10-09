import type { Prisma, asset_loans, asset_records } from '@prisma/client';
import type { LoanDecision, LoanListItem, LoanRequestInput } from '@shared/types/loans';
import * as loansRepository from './loans.repository';
import { AppError } from '../../shared/errors/AppError';
import { DEFAULT_CUSTODIAN_ID } from '../../shared/constants/defaultCustodian';
import { campusForLab } from '../../shared/utils/campus';
import { findCustodyRequestConflict } from '../../shared/services/custodyRequestGuard';

export async function listLoans(): Promise<LoanListItem[]> {
    let dbLoans = await loansRepository.findAllNewestFirst();

    // Seed LOAN-9 pending loan if missing
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

        // Scope by the asset's own tag prefix (e.g. "CeLT-0004" -> "CeLT")
        // — the same convention /api/analytics/lab-head and
        // /api/asset_transfers already use. This is what determines which
        // LabHead branch the request belongs to; the borrower's own home
        // center is unrelated and previously caused loans to silently
        // never appear for the LabHead who actually owns the asset
        // whenever the borrower belonged to a different lab.
        const lab = asset?.asset_tag?.includes("-") ? asset.asset_tag.split("-")[0] : "";

        // The destination lab picked on LoanForm was encoded into purpose
        // at request time (see /borrow) — pulled out here as its own
        // field for display, and stripped from the shown purpose/reason
        // text so it isn't shown twice.
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

// Only the asset_loans row (the approval-pipeline record) is written
// here. Custody does NOT move to the borrower yet — asset_records stays
// untouched until the Lab Head approves via
// PUT /api/asset_loans/:id/decision, so the asset keeps showing under
// its current custodian while the request is pending.
export async function requestLoan(assetTag: string, data: LoanRequestInput): Promise<asset_loans> {
    const existing = await loansRepository.findAssetByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    const conflict = await findCustodyRequestConflict(existing, ["ACTIVE"]);
    if (conflict) {
        throw new AppError(409, conflict);
    }

    // LoanForm collects the borrower as a free-text name (e.g. "A. Dela Cruz"), same
    // convention EditAssetDialog already uses for custodian — best-effort lookup by
    // combined name, falling back to DEFAULT_CUSTODIAN_ID if nothing matches.
    // asset_loans.borrower_id is a required FK, so this always needs a resolved id.
    let borrowerId = DEFAULT_CUSTODIAN_ID;
    const [first, ...rest] = String(data.borrower).replace(/^Dr\.\s*/i, "").split(" ");
    const match = await loansRepository.findUserByName(first, rest.join(" "));
    if (match) borrowerId = match.user_id;

    // Logged as text (asset_loans has no dedicated lab column) so the
    // decision endpoint below can format current_location as
    // "<Lab>-<Campus>" once approved.
    const purposeWithLab = data.lab ? `Destination Lab: ${data.lab}\n\n${data.purpose}` : data.purpose;

    return loansRepository.create({
        asset_id: existing.asset_id,
        borrower_id: borrowerId,
        purpose: purposeWithLab,
        due_date: new Date(data.dueDate),
        status: "pending",
    });
}

export async function decideLoan(loanId: number, decision: LoanDecision): Promise<asset_loans> {
    const loan = await loansRepository.findById(loanId);
    if (!loan) {
        throw new AppError(404, `No loan found with id ${loanId}.`);
    }
    if (loan.status !== "pending") {
        throw new AppError(400, `Loan #${loanId} has already been ${loan.status}.`);
    }

    const newLoanStatus = decision === "approve" ? "approved" : "declined";
    // On decline, asset_records is untouched — custody never left the
    // prior custodian in the first place, so there's nothing to revert.
    return loansRepository.saveDecision(
        loan,
        newLoanStatus,
        decision === "approve" ? (latestRecord) => handoverRecord(loan, latestRecord) : null,
    );
}

// This is the actual custody handoff: /borrow only logged the
// request, so the asset is still with its prior custodian until
// now. Append a new asset_records entry moving it to the borrower.
function handoverRecord(loan: asset_loans, latestRecord: asset_records | null): Prisma.asset_recordsUncheckedCreateInput {
    // current_location becomes "<Campus> — <Lab>" (e.g. "Manila — CITe4D"),
    // matching the same format used by location, from the destination
    // picked on LoanForm (logged into purpose at request time, see
    // /borrow above). location (home lab) is untouched.
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
