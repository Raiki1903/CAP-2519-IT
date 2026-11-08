/**
 * Asset remark row access: every database read and write of the remark endpoints.
 * Layer: repository. Called by remarks.service.ts. Calls config/prisma.ts.
 * Used by: the Remarks section of the asset detail modal.
 */
import { prisma } from '../../config/prisma';

/** The author's name fields, for the answer. */
const AUTHOR = { author: { select: { user_id: true, first_name: true, last_name: true } } } as const;

/**
 * The asset's remarks that are not deleted, newest first, with their author's name. The remark id breaks a tie
 * between two remarks saved at the same moment, so the newer one still comes first.
 *
 * @param assetId the asset
 */
export function findRemarks(assetId: number) {
    return prisma.asset_remarks.findMany({
        where: { asset_id: assetId, deleted_at: null },
        include: AUTHOR,
        orderBy: [{ created_at: 'desc' }, { remark_id: 'desc' }],
    });
}

/**
 * Saves a new remark.
 *
 * @param assetId the asset
 * @param authorId the session user who writes it
 * @param text the checked text
 * @returns the new row with its author's name
 */
export function createRemark(assetId: number, authorId: number, text: string) {
    return prisma.asset_remarks.create({
        data: { asset_id: assetId, author_id: authorId, remark_text: text },
        include: AUTHOR,
    });
}

/** The remark with this id on this asset, if it is not deleted, or null. */
export function findLiveRemark(assetId: number, remarkId: number) {
    return prisma.asset_remarks.findFirst({ where: { remark_id: remarkId, asset_id: assetId, deleted_at: null } });
}

/**
 * Marks a remark deleted: who and when. The row stays. Only a remark that is not deleted yet changes, in the same
 * statement that checks it, so of two deletes at once only one changes the row.
 *
 * @param assetId the asset the remark must belong to
 * @param remarkId the remark
 * @param actorId the session user who deletes it
 * @returns how many rows changed: 1, or 0 when it was already deleted
 */
export async function softDeleteRemark(assetId: number, remarkId: number, actorId: number): Promise<number> {
    const result = await prisma.asset_remarks.updateMany({
        where: { remark_id: remarkId, asset_id: assetId, deleted_at: null },
        data: { deleted_by_id: actorId, deleted_at: new Date() },
    });
    return result.count;
}
