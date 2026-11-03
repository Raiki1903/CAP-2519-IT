/**
 * Disposal row access: every database read and write the disposal endpoints make.
 * Layer: repository. Called by retirements.service.ts. Calls server/config/prisma.ts, shared/services/assetStatus.ts,
 * and shared/services/rowLocks.ts.
 * Used by: Staff disposal filing, Director approval, and the screens that list disposals.
 */
import { asset_retirements_status, type Prisma, type asset_retirements } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { setAssetStatus } from '../../shared/services/assetStatus';
import { lockAsset } from '../../shared/services/rowLocks';

/**
 * Files a disposal request in one transaction: the asset_retirements row, and the asset set to Pending Retirement.
 * The asset row is locked first, so two requests on the same asset run one after the other.
 *
 * @param data the asset_retirements row, its previous_status included
 * @returns the created row
 */
export function createRequest(data: Prisma.asset_retirementsUncheckedCreateInput) {
    return prisma.$transaction(async (tx) => {
        await lockAsset(tx, data.asset_id);
        const disposal = await tx.asset_retirements.create({ data });
        await setAssetStatus(tx, data.asset_id, "PENDING_RETIREMENT");
        return disposal;
    });
}

/**
 * Every disposal (newest first), asset, and user, read together so the list can name
 * each disposal's asset and requester.
 *
 * @returns [asset_retirements, assets, users]
 */
// TODO(M-09): requested_at has one-second resolution and no tie-break, so requests filed in the same second come back in no fixed order. Phase 3, with the shared ordering rule.
export function findListLookups() {
    return Promise.all([
        prisma.asset_retirements.findMany({ orderBy: { requested_at: 'desc' } }),
        prisma.assets.findMany(),
        prisma.users.findMany(),
    ]);
}

/** The disposal with this id, or null. */
export function findById(disposalId: number) {
    return prisma.asset_retirements.findUnique({ where: { retirement_id: disposalId } });
}

/**
 * Saves a decision in one transaction. Approval: Completed, with who decided and completed it and when, and the asset
 * set to Retired. Rejection: Denied, with who decided and when, and the asset given back its status from before the
 * request (Available when none was kept). The asset row is locked first.
 *
 * @param disposal the pending disposal being decided
 * @param approve true to approve, false to reject
 * @param deciderId the session user who decides
 * @param assetIsPending whether the asset is in Pending Retirement; a rejection leaves any other status alone
 * @returns the updated asset_retirements row
 */
export function saveDecision(disposal: asset_retirements, approve: boolean, deciderId: number, assetIsPending: boolean) {
    return prisma.$transaction(async (tx) => {
        await lockAsset(tx, disposal.asset_id);
        const now = new Date();
        const updated = await tx.asset_retirements.update({
            where: { retirement_id: disposal.retirement_id },
            data: approve
                ? { status: asset_retirements_status.COMPLETED, decided_by_id: deciderId, decided_at: now, completed_by_id: deciderId, completed_at: now }
                : { status: asset_retirements_status.DENIED, decided_by_id: deciderId, decided_at: now },
        });
        if (approve) {
            await setAssetStatus(tx, disposal.asset_id, "RETIRED");
        } else if (assetIsPending) {
            await setAssetStatus(tx, disposal.asset_id, disposal.previous_status ?? "AVAILABLE");
        }
        return updated;
    });
}
