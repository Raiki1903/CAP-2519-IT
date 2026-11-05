/**
 * The inspection writer: one asset_inspections row and its metric values, for every step that files an inspection.
 * Layer: shared service (runs inside the caller's transaction). Called by features/loans/loans.service.ts (Loan Release
 * and Return); registration and the Batch 5 steps may move to it. Calls Prisma through the transaction it is given and
 * shared/errors/AppError.ts.
 * Used by: TSG loan release and receipt.
 */
import type { Prisma, asset_condition, asset_inspections, asset_inspections_type } from '@prisma/client';
import type { InspectionInput } from '@shared/types/assets';
import { AppError } from '../errors/AppError';

/** The 400 message when a metric is not one the asset's category measures. */
export const METRIC_NOT_FOR_ASSET_MESSAGE = "That measurement does not apply to this asset.";

/** What one inspection needs. */
export interface InspectionToWrite {
    assetId: number;
    type: asset_inspections_type;
    /** The checked inspection from the body (shared/validation/inspectionInput.ts). */
    input: InspectionInput;
    /** The session user who inspected it. */
    inspectorId: number;
}

/**
 * Writes an inspection and, when the input has metrics, its asset_inspection_metrics rows, inside the caller's
 * transaction. Every metric must belong to the asset's category (category_metrics); the check runs before any row is
 * written, and the caller's transaction undoes the whole step when it fails.
 *
 * @param tx the caller's transaction
 * @param inspection the asset, type, checked input, and inspector
 * @returns the new asset_inspections row
 * @throws AppError 400 METRIC_NOT_FOR_ASSET_MESSAGE if a metric does not apply to the asset
 */
export async function writeInspection(tx: Prisma.TransactionClient, inspection: InspectionToWrite): Promise<asset_inspections> {
    const { assetId, type, input, inspectorId } = inspection;
    const metrics = input.metrics ?? [];
    if (metrics.length > 0) {
        const asset = await tx.assets.findUniqueOrThrow({ where: { asset_id: assetId }, select: { category: true } });
        const allowed = await tx.category_metrics.count({
            where: { category: asset.category, metric_id: { in: metrics.map(m => m.metricId) } },
        });
        if (allowed !== metrics.length) throw new AppError(400, METRIC_NOT_FOR_ASSET_MESSAGE);
    }

    const row = await tx.asset_inspections.create({
        data: {
            asset_id: assetId,
            inspected_by_id: inspectorId,
            type,
            condition: input.condition as asset_condition,
            health_score: input.healthScore ?? null,
            missing_accessories: input.missingAccessories ?? null,
            remarks: input.remarks ?? null,
            photo: input.photo ?? null,
        },
    });
    if (metrics.length > 0) {
        await tx.asset_inspection_metrics.createMany({
            data: metrics.map(m => ({ inspection_id: row.inspection_id, metric_id: m.metricId, value: m.value })),
        });
    }
    return row;
}
