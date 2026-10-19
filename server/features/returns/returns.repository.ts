/**
 * Return row access: every database read and write the return endpoints make.
 * Layer: repository. Called by returns.service.ts. Calls server/config/prisma.ts.
 * Used by: Staff return finalization, and the return list.
 */
import type { Prisma, asset_records } from '@prisma/client';
import { prisma } from '../../config/prisma';

/**
 * Every return (newest first), asset, and user, read together so the list can name
 * each return's asset and returner.
 *
 * @returns [asset_returns, assets, users]
 */
export function findListLookups() {
    return Promise.all([
        prisma.asset_returns.findMany({ orderBy: { returned_on: 'desc' } }),
        prisma.assets.findMany(),
        prisma.users.findMany(),
    ]);
}

/**
 * Writes a finalized return in one transaction: the asset_returns row, the asset's new record,
 * and every approved loan of the asset set to "returned". The asset's latest record is read inside
 * the transaction and handed to the service to build the new record from.
 *
 * @param returnData the asset_returns row to insert
 * @param buildTurnInRecord builds the new asset_records row from the latest one
 * @returns the created asset_returns row
 */
export function saveReturn(
    returnData: Prisma.asset_returnsUncheckedCreateInput,
    buildTurnInRecord: (latestRecord: asset_records | null) => Prisma.asset_recordsUncheckedCreateInput,
) {
    // The return, the record, and the loans are written together, so a failure on any leaves none:
    // a recorded return always has the asset back in the pool and its loans closed.
    return prisma.$transaction(async (tx) => {
        const ret = await tx.asset_returns.create({
            data: returnData,
        });

        // TODO(M-09): no tie-break on asset_record_id, so two records logged in the same second can be read in the wrong order. Phase 3, with the shared asset state rule.
        const latestRecord = await tx.asset_records.findFirst({
            where: { asset_id: returnData.asset_id },
            orderBy: { date_logged: "desc" },
        });

        await tx.asset_records.create({
            data: buildTurnInRecord(latestRecord),
        });

        // A return names no loan (asset_returns has no loan_id until Phase 3), so the loans are found by
        // asset. Every approved one closes: the asset is back in the pool, so none of them is still out,
        // and loans returned before issue #99 were left approved. (answer 1a of the group H questions)
        await tx.asset_loans.updateMany({
            where: { asset_id: returnData.asset_id, status: "approved" },
            data: { status: "returned" },
        });

        return ret;
    });
}
