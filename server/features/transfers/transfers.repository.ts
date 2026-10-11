/**
 * Transfer row access: every database read and write the transfer endpoints make.
 * Layer: repository. Called by transfers.service.ts and shared/services/custodyRequestGuard.ts (the pending transfer). Calls server/config/prisma.ts.
 * Used by: Custodian transfer request, Lab Head approval, and the screens that list transfers.
 */
import type { Prisma, asset_records, asset_transfers } from '@prisma/client';
import { prisma } from '../../config/prisma';

// Reads the assets feature's table. It is not the custody request guard's reader in assets.repository.ts:
// that one breaks ties on asset_record_id, this one does not, so the two can disagree. (M-09)
/** The asset's newest record, or null if it has none. */
// TODO(M-09): no tie-break on asset_record_id, unlike the custody request guard and GET /api/assets, so two records logged in the same second can disagree with them. Later in step 12 or Phase 3, with the shared asset state rule.
export function findLatestRecord(assetId: number) {
    return prisma.asset_records.findFirst({
        where: { asset_id: assetId },
        orderBy: { date_logged: "desc" },
    });
}

/** The asset's pending transfer (its id only), or null. Read by the custody request guard. (H-05) */
export function findPendingTransferId(assetId: number) {
    return prisma.asset_transfers.findFirst({ where: { asset_id: assetId, status: "pending" }, select: { transfer_id: true } });
}

/** Inserts an asset_transfers row and returns it. */
export function create(data: Prisma.asset_transfersUncheckedCreateInput) {
    return prisma.asset_transfers.create({ data });
}

/**
 * Every transfer (newest first), asset, user, and asset record (newest first), read together
 * so the list can name each transfer's asset and people and show the asset's campus.
 *
 * @returns [asset_transfers, assets, users, asset_records]
 */
export function findListLookups() {
    return Promise.all([
        prisma.asset_transfers.findMany({ orderBy: { requested_on: 'desc' } }),
        prisma.assets.findMany(),
        prisma.users.findMany(),
        prisma.asset_records.findMany({ orderBy: { date_logged: 'desc' } }),
    ]);
}

/** The transfer with this id, or null. */
export function findById(transferId: number) {
    return prisma.asset_transfers.findUnique({ where: { transfer_id: transferId } });
}

/**
 * Sets a transfer's decided status and, for an approval, appends the custody record, in one transaction.
 * The asset's latest record is read inside the transaction, after the status update,
 * and handed to the service to build the new record from.
 *
 * @param transfer the pending transfer being decided
 * @param newStatus "approved" or "declined"
 * @param buildHandoverRecord builds the new asset_records row from the latest one; null for a decline
 * @returns the updated asset_transfers row
 */
export function saveDecision(
    transfer: asset_transfers,
    newStatus: string,
    buildHandoverRecord: ((latestRecord: asset_records | null) => Prisma.asset_recordsUncheckedCreateInput) | null,
) {
    // The transfer status and the custody record are written together, so a failure on either
    // leaves neither: an approved transfer always has its ON_LOAN record.
    return prisma.$transaction(async (tx) => {
        const updated = await tx.asset_transfers.update({
            where: { transfer_id: transfer.transfer_id },
            data: { status: newStatus },
        });

        if (buildHandoverRecord) {
            // TODO(M-09): no tie-break on asset_record_id, so two records logged in the same second can be read in the wrong order. Later in step 12 or Phase 3, with the shared asset state rule.
            const latestRecord = await tx.asset_records.findFirst({
                where: { asset_id: transfer.asset_id },
                orderBy: { date_logged: "desc" },
            });

            await tx.asset_records.create({
                data: buildHandoverRecord(latestRecord),
            });
        }

        return updated;
    });
}

/** Updates a transfer row with the given fields and returns it. Used by /accept. */
export function update(transferId: number, data: Prisma.asset_transfersUpdateInput) {
    return prisma.asset_transfers.update({
        where: { transfer_id: transferId },
        data,
    });
}
