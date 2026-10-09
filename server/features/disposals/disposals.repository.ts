import type { Prisma, asset_disposals, asset_records } from '@prisma/client';
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

/** Inserts an asset_disposals row and returns it. */
export function create(data: Prisma.asset_disposalsUncheckedCreateInput) {
    return prisma.asset_disposals.create({ data });
}

export function findListLookups() {
    return Promise.all([
        prisma.asset_disposals.findMany({ orderBy: { disposal_date: 'desc' } }),
        prisma.assets.findMany(),
        prisma.users.findMany(),
    ]);
}

/** The disposal with this id, or null. */
export function findById(disposalId: number) {
    return prisma.asset_disposals.findUnique({ where: { disposal_id: disposalId } });
}

export function saveDecision(
    disposal: asset_disposals,
    newStatus: string,
    buildDisposedRecord: ((latestRecord: asset_records | null) => Prisma.asset_recordsUncheckedCreateInput) | null,
) {
    // asset_disposals (approval status) and asset_records (append-only
    // status log) are updated together so a failure on either rolls back
    // the whole decision.
    return prisma.$transaction(async (tx) => {
        const updated = await tx.asset_disposals.update({
            where: { disposal_id: disposal.disposal_id },
            data: { status: newStatus },
        });

        if (buildDisposedRecord) {
            const latestRecord = await tx.asset_records.findFirst({
                where: { asset_id: disposal.asset_id },
                orderBy: { date_logged: "desc" },
            });

            await tx.asset_records.create({
                data: buildDisposedRecord(latestRecord),
            });
        }

        return updated;
    });
}
