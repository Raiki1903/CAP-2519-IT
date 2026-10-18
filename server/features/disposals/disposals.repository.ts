/**
 * Disposal row access: every database read and write the disposal endpoints make.
 * Layer: repository. Called by disposals.service.ts and shared/services/custodyRequestGuard.ts (the pending disposal). Calls server/config/prisma.ts.
 * Used by: Staff disposal filing, Director approval, and the screens that list disposals.
 */
import type { Prisma, asset_disposals, asset_records } from '@prisma/client';
import { prisma } from '../../config/prisma';

/** The asset's pending disposal (its id only), or null. Read by the custody request guard. (H-05, issue #54) */
export function findPendingDisposalId(assetId: number) {
    return prisma.asset_disposals.findFirst({ where: { asset_id: assetId, status: "pending" }, select: { disposal_id: true } });
}

/** Inserts an asset_disposals row and returns it. */
export function create(data: Prisma.asset_disposalsUncheckedCreateInput) {
    return prisma.asset_disposals.create({ data });
}

/**
 * Every disposal (newest first), asset, and user, read together so the list can name
 * each disposal's asset and requester.
 *
 * @returns [asset_disposals, assets, users]
 */
// TODO(M-09): disposal_date has one-second resolution and no tie-break, so requests filed in the same second come back in no fixed order. Phase 3, with the shared ordering rule.
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

/**
 * Sets a disposal's decided status and, for an approval, appends the DISPOSED record, in one transaction.
 * The asset's latest record is read inside the transaction, after the status update,
 * and handed to the service to build the new record from.
 *
 * @param disposal the pending disposal being decided
 * @param newStatus "approved" or "rejected"
 * @param buildDisposedRecord builds the new asset_records row from the latest one; null for a reject
 * @returns the updated asset_disposals row
 */
export function saveDecision(
    disposal: asset_disposals,
    newStatus: string,
    buildDisposedRecord: ((latestRecord: asset_records | null) => Prisma.asset_recordsUncheckedCreateInput) | null,
) {
    // The disposal status and the DISPOSED record are written together, so a failure on either
    // leaves neither: an approved disposal always has its record.
    return prisma.$transaction(async (tx) => {
        const updated = await tx.asset_disposals.update({
            where: { disposal_id: disposal.disposal_id },
            data: { status: newStatus },
        });

        if (buildDisposedRecord) {
            // TODO(M-09): no tie-break on asset_record_id, so two records logged in the same second can be read in the wrong order. Phase 3, with the shared asset state rule.
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
