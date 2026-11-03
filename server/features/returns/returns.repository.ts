/**
 * Return row access: every database read and write the return endpoints make.
 * Layer: repository. Called by returns.service.ts. Calls server/config/prisma.ts, shared/services/assetStatus.ts, and
 * shared/services/rowLocks.ts.
 * Used by: Staff return finalization, and the return list.
 */
import { asset_inspections_type, asset_loans_status, type asset_condition, type asset_returns_condition } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { setAssetStatus } from '../../shared/services/assetStatus';
import { lockAsset } from '../../shared/services/rowLocks';

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

/** What a finalized return writes. */
export interface ReturnRows {
    assetId: number;
    /** The held loan the return closes. */
    loanId: number;
    returnedById: number;
    receivedById: number;
    /** One of ASSET_CONDITIONS, already checked. */
    condition: string;
    comments: string | null;
    referenceNumber: string;
}

/**
 * Writes a finalized return in one transaction: the Return inspection, the loan closed as Returned and linked to it,
 * the asset set to Available, and the asset_returns row. The asset row is locked first, so two returns of the same
 * asset run one after the other.
 *
 * @param rows the return's values
 * @returns the created asset_returns row
 */
export function saveReturn(rows: ReturnRows) {
    return prisma.$transaction(async (tx) => {
        await lockAsset(tx, rows.assetId);
        const now = new Date();
        const inspection = await tx.asset_inspections.create({
            data: {
                asset_id: rows.assetId,
                inspected_by_id: rows.receivedById,
                type: asset_inspections_type.RETURN,
                condition: rows.condition as asset_condition,
                remarks: rows.comments ?? "Return inspection.",
            },
        });
        await tx.asset_loans.update({
            where: { loan_id: rows.loanId },
            data: {
                status: asset_loans_status.RETURNED,
                received_by_id: rows.receivedById,
                return_inspection_id: inspection.inspection_id,
                closed_at: now,
                remarks: rows.comments,
            },
        });
        await setAssetStatus(tx, rows.assetId, "AVAILABLE");
        return tx.asset_returns.create({
            data: {
                asset_id: rows.assetId,
                returned_by_id: rows.returnedById,
                condition: rows.condition as asset_returns_condition,
                comments: rows.comments,
                reference_number: rows.referenceNumber,
                returned_on: now,
            },
        });
    });
}
