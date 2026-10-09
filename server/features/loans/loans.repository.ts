/**
 * Loan row access: every database read and write the loan endpoints make.
 * Layer: repository. Called by loans.service.ts. Calls server/config/prisma.ts.
 * Used by: Custodian borrow request, Lab Head approval, and the screens that list loans.
 */
import type { Prisma, asset_loans, asset_records } from '@prisma/client';
import { prisma } from '../../config/prisma';

/** Every asset_loans row, newest request first. */
export function findAllNewestFirst() {
    return prisma.asset_loans.findMany({
        orderBy: { loaned_on: 'desc' }
    });
}

// The next five read other features' tables. They live here until the assets and auth
// repositories exist (step 12), so that no loan code calls Prisma outside this file.

/** The first asset row, for the H-08 seed in listLoans. */
export function findFirstAsset() {
    return prisma.assets.findFirst();
}

/** The first STUDENT user, for the H-08 seed in listLoans. */
export function findFirstStudent() {
    return prisma.users.findFirst({ where: { user_type: 'STUDENT' } });
}

/**
 * Every user, asset, and user-to-center link (with its center), read together
 * so the list can name each loan's borrower, asset, and campus.
 *
 * @returns [users, assets, user_centers with research_centers]
 */
export function findListLookups() {
    return Promise.all([
        prisma.users.findMany(),
        prisma.assets.findMany(),
        prisma.user_centers.findMany({
            include: { research_centers: true }
        }),
    ]);
}

/** The asset with this tag, or null. */
export function findAssetByTag(assetTag: string) {
    return prisma.assets.findUnique({ where: { asset_tag: assetTag } });
}

/** The first user whose first and last name match exactly, or null. (H-10) */
export function findUserByName(firstName: string, lastName: string) {
    return prisma.users.findFirst({
        where: { first_name: firstName, last_name: lastName },
    });
}

/** Inserts an asset_loans row and returns it. */
export function create(data: Prisma.asset_loansUncheckedCreateInput) {
    return prisma.asset_loans.create({ data });
}

/** The loan with this id, or null. */
export function findById(loanId: number) {
    return prisma.asset_loans.findUnique({ where: { loan_id: loanId } });
}

/**
 * Sets a loan's decided status and, for an approval, appends the custody record, in one transaction.
 * The asset's latest record is read inside the transaction, after the status update,
 * and handed to the service to build the new record from.
 *
 * @param loan the pending loan being decided
 * @param newStatus "approved" or "declined"
 * @param buildHandoverRecord builds the new asset_records row from the latest one; null for a decline
 * @returns the updated asset_loans row
 */
export function saveDecision(
    loan: asset_loans,
    newStatus: string,
    buildHandoverRecord: ((latestRecord: asset_records | null) => Prisma.asset_recordsUncheckedCreateInput) | null,
) {
    // The loan status and the custody record are written together, so a failure on either
    // leaves neither: an approved loan always has its ON_LOAN record.
    return prisma.$transaction(async (tx) => {
        const updated = await tx.asset_loans.update({
            where: { loan_id: loan.loan_id },
            data: { status: newStatus },
        });

        if (buildHandoverRecord) {
            // TODO(M-09): no tie-break on asset_record_id, so two records logged in the same second can be read in the wrong order. Step 12 or Phase 3, with the shared asset state rule.
            const latestRecord = await tx.asset_records.findFirst({
                where: { asset_id: loan.asset_id },
                orderBy: { date_logged: "desc" },
            });

            await tx.asset_records.create({
                data: buildHandoverRecord(latestRecord),
            });
        }

        return updated;
    });
}
