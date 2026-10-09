import type { Prisma, asset_records } from '@prisma/client';
import { prisma } from '../../config/prisma';

/** The asset with this tag, or null. */
export function findAssetByTag(assetTag: string) {
    return prisma.assets.findUnique({ where: { asset_tag: assetTag } });
}

/** The first user whose first and last name match exactly, or null. */
export function findUserByName(firstName: string, lastName: string) {
    return prisma.users.findFirst({
        where: { first_name: firstName, last_name: lastName },
    });
}

export function findListLookups() {
    return Promise.all([
        prisma.asset_returns.findMany({ orderBy: { returned_on: 'desc' } }),
        prisma.assets.findMany(),
        prisma.users.findMany(),
    ]);
}

export function saveReturn(
    returnData: Prisma.asset_returnsUncheckedCreateInput,
    buildTurnInRecord: (latestRecord: asset_records | null) => Prisma.asset_recordsUncheckedCreateInput,
) {
    // asset_returns (the finalized ledger entry) and asset_records (the
    // append-only status log) are written together so a failure on either
    // rolls back the whole finalization.
    return prisma.$transaction(async (tx) => {
        const ret = await tx.asset_returns.create({
            data: returnData,
        });

        const latestRecord = await tx.asset_records.findFirst({
            where: { asset_id: returnData.asset_id },
            orderBy: { date_logged: "desc" },
        });

        await tx.asset_records.create({
            data: buildTurnInRecord(latestRecord),
        });

        return ret;
    });
}
