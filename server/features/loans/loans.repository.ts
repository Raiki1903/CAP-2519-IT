/**
 * Loan row access: every database read and write the loan endpoints make.
 * Layer: repository. Called by loans.service.ts and shared/services/custodyRequestGuard.ts (the pending loan, for
 * transfers). Calls server/config/prisma.ts, shared/services/assetStatus.ts, and shared/services/rowLocks.ts.
 * Used by: Custodian borrow request, Lab Head approval, and the screens that list loans.
 */
import { asset_loans_status, type Prisma, type asset_loans } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { setAssetStatus } from '../../shared/services/assetStatus';
import { lockAsset } from '../../shared/services/rowLocks';

/** Every asset_loans row, newest request first. */
export function findAllNewestFirst() {
    return prisma.asset_loans.findMany({
        orderBy: { requested_at: 'desc' }
    });
}

/**
 * Every user and asset (with its home lab), read together so the list can name each loan's borrower, asset, and lab.
 *
 * @returns [users, assets with research_centers]
 */
export function findListLookups() {
    return Promise.all([
        prisma.users.findMany(),
        prisma.assets.findMany({ include: { research_centers: true } }),
    ]);
}

/** The asset's pending loan (its id only), or null. Read by the custody request guard, for transfers. (H-05) */
export function findPendingLoanId(assetId: number) {
    return prisma.asset_loans.findFirst({ where: { asset_id: assetId, status: asset_loans_status.PENDING_APPROVAL }, select: { loan_id: true } });
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
 * Saves a decision in one transaction: the loan's status, who decided and when, and, for an approval, the asset's
 * status. A decline also closes the loan. The asset row is locked first, so a decision and another step on the same
 * asset run one after the other.
 *
 * @param loan the loan in Pending Approval
 * @param newStatus ON_LOAN or DECLINED
 * @param deciderId the session user who decides
 * @returns the updated asset_loans row
 */
export function saveDecision(loan: asset_loans, newStatus: asset_loans_status, deciderId: number) {
    return prisma.$transaction(async (tx) => {
        await lockAsset(tx, loan.asset_id);
        const now = new Date();
        const updated = await tx.asset_loans.update({
            where: { loan_id: loan.loan_id },
            data: {
                status: newStatus,
                decided_by_id: deciderId,
                decided_at: now,
                ...(newStatus === asset_loans_status.DECLINED ? { closed_at: now } : {}),
            },
        });
        if (newStatus === asset_loans_status.ON_LOAN) {
            await setAssetStatus(tx, loan.asset_id, "ON_LOAN");
        }
        return updated;
    });
}
