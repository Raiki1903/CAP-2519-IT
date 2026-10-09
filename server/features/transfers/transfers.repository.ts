import type { Prisma, asset_records, asset_transfers } from '@prisma/client';
import { prisma } from '../../config/prisma';

/** The asset with this tag, or null. */
export function findAssetByTag(assetTag: string) {
    return prisma.assets.findUnique({ where: { asset_tag: assetTag } });
}

export function findLatestRecord(assetId: number) {
    return prisma.asset_records.findFirst({
        where: { asset_id: assetId },
        orderBy: { date_logged: "desc" },
    });
}

export function findUserByEmail(email: string) {
    return prisma.users.findUnique({ where: { email } });
}

/** Inserts an asset_transfers row and returns it. */
export function create(data: Prisma.asset_transfersUncheckedCreateInput) {
    return prisma.asset_transfers.create({ data });
}

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

export function saveDecision(
    transfer: asset_transfers,
    newStatus: string,
    buildHandoverRecord: ((latestRecord: asset_records | null) => Prisma.asset_recordsUncheckedCreateInput) | null,
) {
    // asset_transfers (approval status) and asset_records (append-only
    // custody log) are updated together so a failure on either rolls back
    // the whole decision.
    return prisma.$transaction(async (tx) => {
        const updated = await tx.asset_transfers.update({
            where: { transfer_id: transfer.transfer_id },
            data: { status: newStatus },
        });

        if (buildHandoverRecord) {
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

export function update(transferId: number, data: Prisma.asset_transfersUpdateInput) {
    return prisma.asset_transfers.update({
        where: { transfer_id: transferId },
        data,
    });
}
