/**
 * Asset remarks service: who may read, add, and delete a remark on an asset, and the answers' shape.
 * Layer: service. Called by remarks.controller.ts. Calls remarks.repository.ts, assets.repository.ts (the asset by
 * tag), shared/middleware/permissions.ts (hasAccessRole), and shared/errors/AppError.ts.
 * Used by: the Remarks section of the asset detail modal, in every view.
 * A remark never changes the asset: no lifecycle guard, no status change, and any asset status allows one.
 */
import type { assets } from '@prisma/client';
import type { AssetRemark, AssetRemarkList } from '@shared/types/assets';
import type { SessionIdentity } from '@shared/types/auth';
import * as remarksRepository from './remarks.repository';
import * as assetsRepository from './assets.repository';
import { AppError } from '../../shared/errors/AppError';
import { hasAccessRole } from '../../shared/middleware/permissions';

/** The 403 message when the Head of another lab adds a remark. */
export const NOT_YOUR_LAB_REMARK_MESSAGE = "This asset belongs to another lab. Only that lab's Head can add a remark to it.";

/** The 403 message when someone who may not delete this remark tries to. */
export const NOT_YOUR_REMARK_MESSAGE = "Only the remark's author, the Head of the asset's lab, or the IT Admin can delete this remark.";

/** The 404 message for a remark that is not on this asset, or is already deleted. */
export const REMARK_NOT_FOUND_MESSAGE = "Remark not found.";

/** A remark row with its author's name. */
type RemarkRow = Awaited<ReturnType<typeof remarksRepository.findRemarks>>[number];

/** The asset with this tag. @throws AppError 404 when there is none */
async function assetOf(assetTag: string): Promise<assets> {
    const asset = await assetsRepository.findByTag(assetTag);
    if (!asset) throw new AppError(404, `No asset found with tag ${assetTag}.`);
    return asset;
}

/** Whether the viewer heads the asset's home lab. */
function headsHomeLab(viewer: SessionIdentity, asset: assets): boolean {
    return viewer.headOfCenterId !== null && viewer.headOfCenterId === asset.center_id;
}

/** Whether the viewer may add a remark: TSG, the Director, the Secretary, or the Head of the asset's home lab. */
function mayAdd(viewer: SessionIdentity, asset: assets): boolean {
    return hasAccessRole(viewer, ["TSG_STAFF", "ADRIC_DIRECTOR", "ADRIC_SECRETARY"]) || headsHomeLab(viewer, asset);
}

/** Whether the viewer may delete the remark: its author, the Head of the asset's home lab, or the IT Admin. */
function mayDelete(viewer: SessionIdentity, asset: assets, authorId: number): boolean {
    return authorId === viewer.userId || headsHomeLab(viewer, asset) || hasAccessRole(viewer, ["IT_ADMIN"]);
}

/** One remark row in the answer's shape. Every viewer gets the author's name: only officials write remarks. */
function remarkFor(viewer: SessionIdentity, asset: assets, row: RemarkRow): AssetRemark {
    return {
        remarkId: row.remark_id,
        author: { userId: row.author.user_id, name: `${row.author.first_name} ${row.author.last_name}` },
        createdAt: row.created_at.toISOString(),
        text: row.remark_text,
        canDelete: mayDelete(viewer, asset, row.author_id),
    };
}

/**
 * The asset's remarks, newest first, without the deleted ones, and whether the viewer may add one. Each remark says
 * whether the viewer may delete it, so the screen does not work out roles.
 *
 * @param assetTag the asset's tag, from the URL
 * @param viewer the session user, any Active account (the route checks it)
 * @throws AppError 404 if no asset has this tag
 */
export async function listRemarks(assetTag: string, viewer: SessionIdentity): Promise<AssetRemarkList> {
    const asset = await assetOf(assetTag);
    const rows = await remarksRepository.findRemarks(asset.asset_id);
    return { remarks: rows.map(row => remarkFor(viewer, asset, row)), canAdd: mayAdd(viewer, asset) };
}

/**
 * Adds a remark to the asset, in any asset status.
 *
 * @param assetTag the asset's tag, from the URL
 * @param text the checked text
 * @param author the session user: TSG, the Director, the Secretary, or a lab's Head (the route checks it)
 * @returns the new remark
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 403 NOT_YOUR_LAB_REMARK_MESSAGE for the Head of another lab
 */
export async function addRemark(assetTag: string, text: string, author: SessionIdentity): Promise<AssetRemark> {
    const asset = await assetOf(assetTag);
    if (!mayAdd(author, asset)) throw new AppError(403, NOT_YOUR_LAB_REMARK_MESSAGE);
    const row = await remarksRepository.createRemark(asset.asset_id, author.userId, text);
    return remarkFor(author, asset, row);
}

/**
 * Deletes a remark softly: who deleted it and when are saved, and the row stays.
 *
 * @param assetTag the asset's tag, from the URL
 * @param remarkId the remark, from the URL
 * @param actor the session user, any Active account (the route checks it)
 * @throws AppError 404 if no asset has this tag, or the remark is not on this asset or is already deleted
 * @throws AppError 403 NOT_YOUR_REMARK_MESSAGE unless the session user is its author, the Head of the asset's home
 *   lab, or the IT Admin
 */
export async function deleteRemark(assetTag: string, remarkId: number, actor: SessionIdentity): Promise<void> {
    const asset = await assetOf(assetTag);
    const remark = await remarksRepository.findLiveRemark(asset.asset_id, remarkId);
    if (!remark) throw new AppError(404, REMARK_NOT_FOUND_MESSAGE);
    if (!mayDelete(actor, asset, remark.author_id)) throw new AppError(403, NOT_YOUR_REMARK_MESSAGE);
    // A second delete that ran at the same moment found the remark too; only one of them changes the row.
    const changed = await remarksRepository.softDeleteRemark(asset.asset_id, remarkId, actor.userId);
    if (changed === 0) throw new AppError(404, REMARK_NOT_FOUND_MESSAGE);
}
