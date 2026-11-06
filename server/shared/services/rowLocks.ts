/**
 * Row locks: SELECT ... FOR UPDATE on one asset, one lab, one account, or one ticket, inside the caller's transaction.
 * Layer: shared service (runs inside the caller's transaction). Called by the repositories of features/assets (tag
 * numbering locks the lab), of the steps that change an asset (they lock the asset), of features/users (every account
 * change locks the account; a Head change also locks the lab), and of features/tickets (a status change locks the
 * ticket). Calls Prisma through the transaction it is given.
 * Used by: asset registration, every step that checks an asset and then changes it, the IT Admin's account steps,
 * and ticket status changes.
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

/**
 * Locks the account's row until the transaction ends, so two decisions on the same sign-up run one after the other
 * and the second one sees it is no longer Pending.
 *
 * @param tx the caller's transaction
 * @param userId the account
 */
export async function lockUser(tx: Prisma.TransactionClient, userId: number): Promise<void> {
    await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${userId} FOR UPDATE`;
}

/**
 * Locks the ticket's row until the transaction ends, so two status changes on one ticket run one after the other
 * and the second one sees the status the first one set.
 *
 * @param tx the caller's transaction
 * @param ticketId the ticket
 */
export async function lockTicket(tx: Prisma.TransactionClient, ticketId: number): Promise<void> {
    await tx.$queryRaw`SELECT ticket_id FROM user_tickets WHERE ticket_id = ${ticketId} FOR UPDATE`;
}
