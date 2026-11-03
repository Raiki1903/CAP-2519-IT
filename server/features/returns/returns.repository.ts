/**
 * Return row access: the write a finalized return makes.
 * Layer: repository. Called by returns.service.ts. Calls server/config/prisma.ts, shared/services/assetStatus.ts, and
 * shared/services/rowLocks.ts.
 * Used by: Staff return finalization.
 */
import { asset_inspections_type, asset_loans_status, type asset_condition } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { setAssetStatus } from '../../shared/services/assetStatus';
import { lockAsset } from '../../shared/services/rowLocks';

/** What a finalized return writes. */
export interface ReturnRows {
    assetId: number;
    /** The held loan the return closes. */
    loanId: number;
    receivedById: number;
    /** One of ASSET_CONDITIONS, already checked. */
    condition: string;
    comments: string | null;
}

/**
 * Writes a finalized return in one transaction: the Return inspection, the loan closed as Returned and linked to it,
 * and the asset set to Available. The asset row is locked first, so two returns of the same asset run one after the
 * other.
 *
 * @param rows the return's values
 * @returns the closed asset_loans row
 */
export function saveReturn(rows: ReturnRows) {
    return prisma.$transaction(async (tx) => {
        await lockAsset(tx, rows.assetId);
        const inspection = await tx.asset_inspections.create({
            data: {
                asset_id: rows.assetId,
                inspected_by_id: rows.receivedById,
                type: asset_inspections_type.RETURN,
                condition: rows.condition as asset_condition,
                remarks: rows.comments ?? "Return inspection.",
            },
        });
        const loan = await tx.asset_loans.update({
            where: { loan_id: rows.loanId },
            data: {
                status: asset_loans_status.RETURNED,
                received_by_id: rows.receivedById,
                return_inspection_id: inspection.inspection_id,
                closed_at: new Date(),
                remarks: rows.comments,
            },
        });
        await setAssetStatus(tx, rows.assetId, "AVAILABLE");
        return loan;
    });
}
