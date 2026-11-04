/**
 * The status setter: the only code that writes assets.status.
 * Layer: shared service (runs inside the caller's transaction). Called by features/loans/loans.service.ts and the
 * repositories of features/returns, maintenance, and retirements, inside the transaction of the step that changes the
 * status. Calls Prisma through the
 * transaction it is given.
 * Used by: every workflow step that moves an asset to another status.
 */
import type { Prisma, assets_status } from '@prisma/client';

/**
 * Sets an asset's status, inside the caller's transaction, so the status and the step that causes it are saved
 * together or not at all. Call it only after lifecycleGuard.assertActionAllowed allowed the step.
 *
 * @param tx the caller's transaction
 * @param assetId the asset
 * @param newStatus the status the step leads to
 */
export async function setAssetStatus(tx: Prisma.TransactionClient, assetId: number, newStatus: assets_status): Promise<void> {
    await tx.assets.update({ where: { asset_id: assetId }, data: { status: newStatus } });
}
