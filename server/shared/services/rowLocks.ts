/**
 * Row locks: SELECT ... FOR UPDATE on one asset or one lab, inside the caller's transaction.
 * Layer: shared service (runs inside the caller's transaction). Called by the repositories of features/assets (tag
 * numbering locks the lab) and of the steps that change an asset (they lock the asset). Calls Prisma through the
 * transaction it is given.
 * Used by: asset registration, and every step that checks an asset and then changes it.
 */
import type { Prisma } from '@prisma/client';

/**
 * Locks the asset's row until the transaction ends, so two steps on the same asset run one after the other and the
 * second one sees what the first one wrote. (H-05)
 *
 * @param tx the caller's transaction
 * @param assetId the asset
 */
export async function lockAsset(tx: Prisma.TransactionClient, assetId: number): Promise<void> {
    await tx.$queryRaw`SELECT asset_id FROM assets WHERE asset_id = ${assetId} FOR UPDATE`;
}

/**
 * Locks the lab's row until the transaction ends, so two registrations in the same lab number their tags one after
 * the other. (H-11, issue #75)
 *
 * @param tx the caller's transaction
 * @param centerId the research center
 */
export async function lockCenter(tx: Prisma.TransactionClient, centerId: number): Promise<void> {
    await tx.$queryRaw`SELECT center_id FROM research_centers WHERE center_id = ${centerId} FOR UPDATE`;
}
