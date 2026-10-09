/**
 * Return row access: every database read and write the return endpoints make.
 * Layer: repository. Called by returns.service.ts. Calls server/config/prisma.ts.
 * Used by: Staff return finalization, and the return list.
 */
import type { Prisma, asset_records } from '@prisma/client';
import { prisma } from '../../config/prisma';

// The next two read other features' tables. They live here until the assets and auth
// repositories are extracted (later in step 12), so that no return code calls Prisma outside this file.

/** The asset with this tag, or null. */
export function findAssetByTag(assetTag: string) {
    return prisma.assets.findUnique({ where: { asset_tag: assetTag } });
}

/** The first user whose first and last name match exactly, or null. (H-10) */
export function findUserByName(firstName: string, lastName: string) {
    return prisma.users.findFirst({
        where: { first_name: firstName, last_name: lastName },
    });
}

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
 * Writes a finalized return: the asset_returns row, then the asset's new record, in one transaction.
 * The asset's latest record is read inside the transaction and handed to the service
 * to build the new record from.
 *
 * @param returnData the asset_returns row to insert
 * @param buildTurnInRecord builds the new asset_records row from the latest one
 * @returns the created asset_returns row
 */
export function saveReturn(
    returnData: Prisma.asset_returnsUncheckedCreateInput,
    buildTurnInRecord: (latestRecord: asset_records | null) => Prisma.asset_recordsUncheckedCreateInput,
) {
    // The return and the record are written together, so a failure on either leaves neither:
    // a recorded return always has the asset back in the pool.
    return prisma.$transaction(async (tx) => {
        const ret = await tx.asset_returns.create({
            data: returnData,
        });

        // TODO(M-09): no tie-break on asset_record_id, so two records logged in the same second can be read in the wrong order. Later in step 12 or Phase 3, with the shared asset state rule.
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
