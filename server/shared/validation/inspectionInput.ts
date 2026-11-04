/**
 * The inspection inside a request body (InspectionInput): its condition, health score, missing accessories,
 * remarks, photo, and metric values, checked the same way for every step that files one.
 * Layer: shared (server validation). Called by features/assets/assets.validation.ts (the Initial inspection) and
 * features/loans/loans.validation.ts (release and receipt).
 * Calls shared/validation/fields.ts, shared/errors/AppError.ts, and @shared/enums/assetCondition.
 * Used by: asset registration, TSG loan release and receipt.
 */
import type { InspectionInput } from '@shared/types/assets';
import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import { AppError } from '../errors/AppError';
import { readText } from './fields';

/** The largest metric value the column holds (decimal 10,2). */
const METRIC_VALUE_LIMIT = 1e8;

/**
 * Reads the metric values of an inspection: a list of `{ metricId, value }`, each metric once. Whether each metric
 * belongs to the asset's category is checked when the inspection is written (shared/services/inspections.ts).
 *
 * @throws AppError 400 if it is not such a list
 */
function readMetrics(value: unknown): { metricId: number; value: number }[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value)) throw new AppError(400, "metrics must be a list of { metricId, value }.");
    const metrics = value.map(item => {
        const metric = item as Record<string, unknown> | null;
        if (!metric || typeof metric !== 'object' || !Number.isInteger(metric.metricId) || (metric.metricId as number) < 1
            || typeof metric.value !== 'number' || !isFinite(metric.value) || Math.abs(metric.value) >= METRIC_VALUE_LIMIT) {
            throw new AppError(400, "Each metric needs a metricId and a number value.");
        }
        return { metricId: metric.metricId as number, value: metric.value };
    });
    if (new Set(metrics.map(m => m.metricId)).size !== metrics.length) throw new AppError(400, "Send each metric only once.");
    return metrics;
}

/**
 * Checks one inspection inside a body: a known condition, an optional health score from 0 to 100, and optional
 * metric values.
 *
 * @param value the body's inspection object
 * @param field its name, for the message
 * @throws AppError 400 if it is missing or a value is wrong
 */
export function readInspectionInput(value: unknown, field: string): InspectionInput {
    if (!value || typeof value !== 'object') throw new AppError(400, `Missing required field: ${field}.`);
    const body = value as Record<string, unknown>;
    if (typeof body.condition !== 'string' || !ASSET_CONDITIONS.includes(body.condition)) {
        throw new AppError(400, `Pick the condition of the ${field} from the list.`);
    }
    const score = body.healthScore;
    if (score !== undefined && score !== null && (!Number.isInteger(score) || (score as number) < 0 || (score as number) > 100)) {
        throw new AppError(400, "healthScore must be a whole number from 0 to 100.");
    }
    return {
        condition: body.condition,
        healthScore: (score as number | null | undefined) ?? null,
        missingAccessories: readText(body, "missingAccessories", 255) ?? null,
        remarks: readText(body, "remarks", 255) ?? null,
        photo: typeof body.photo === 'string' && body.photo ? body.photo : null,
        metrics: readMetrics(body.metrics),
    };
}
