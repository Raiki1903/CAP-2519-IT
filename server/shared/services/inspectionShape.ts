/**
 * The Inspection shape: the people a step names, as the viewer may see them, and an inspection row in the contract's
 * Inspection shape with its metrics flagged against the asset's first recorded values.
 * Layer: shared service. Called by the repositories and services of features/loans, maintenance, retirements, and inspections.
 * Calls Prisma through the client it is given and @shared (labels and flag rules).
 * Used by: every answer that carries an inspection (loan release and return, maintenance receipt and completion, the
 * disposal assessment, inspection filing).
 */
import type { Prisma } from '@prisma/client';
import type { Inspection } from '@shared/types/inspections';
import type { PersonRef } from '@shared/types/assets';
import type { SessionIdentity } from '@shared/types/auth';
import { INSPECTION_TYPE_LABELS } from '@shared/constants/inspectionTypes';
import { ASSET_CONDITION_LABELS } from '@shared/enums/assetCondition';
import { isMetricFlagged } from '@shared/constants/metricFlagRules';
import type { Db } from './assetState';

/** The person fields every answer names. */
export const PERSON = { select: { user_id: true, first_name: true, last_name: true } } as const;

/** What an inspection in an answer includes: its inspector and its metric values with their definitions. */
export const INSPECTION_INCLUDE = {
    users: PERSON,
    metrics: { include: { metric_definitions: true }, orderBy: { metric_id: 'asc' } },
} satisfies Prisma.asset_inspectionsInclude;

/** An inspection row as an answer includes it. */
export type InspectionRow = Prisma.asset_inspectionsGetPayload<{ include: typeof INSPECTION_INCLUDE }>;

/** A person row with the name fields the answers use. */
export type NamedPerson = { user_id: number; first_name: string; last_name: string };

/**
 * The person as this viewer may see them: a Researcher (the "Custodian" app role) sees only their own name and id;
 * anyone else is `{ hidden: true }`. (D2)
 */
export function personFor(viewer: SessionIdentity, person: NamedPerson | null): PersonRef | null {
    if (!person) return null;
    if (viewer.role === "Custodian" && person.user_id !== viewer.userId) return { hidden: true };
    return { userId: person.user_id, name: `${person.first_name} ${person.last_name}` };
}

/** An inspection row in the contract's Inspection shape, its metrics flagged against the asset's first values. */
export function inspectionOf(row: InspectionRow | null, baselines: Map<string, number>, viewer: SessionIdentity): Inspection | null {
    if (!row) return null;
    return {
        inspectionId: row.inspection_id,
        type: row.type,
        typeLabel: INSPECTION_TYPE_LABELS[row.type],
        inspectedBy: personFor(viewer, row.users)!,
        inspectedAt: row.inspected_at.toISOString(),
        condition: row.condition,
        conditionLabel: ASSET_CONDITION_LABELS[row.condition],
        healthScore: row.health_score,
        missingAccessories: row.missing_accessories,
        remarks: row.remarks,
        photo: row.photo,
        metrics: row.metrics.map(m => {
            const value = Number(m.value);
            const baseline = baselines.get(`${row.asset_id}:${m.metric_id}`) ?? null;
            return {
                metricId: m.metric_id,
                metricKey: m.metric_definitions.metric_key,
                name: m.metric_definitions.name,
                unit: m.metric_definitions.unit,
                value,
                flagged: isMetricFlagged(m.metric_definitions.metric_key, value, baseline),
            };
        }),
    };
}

/**
 * The asset's first recorded value of each metric these inspections measured, in one query. A flag rule that needs a
 * baseline compares against it (shared/constants/metricFlagRules.ts).
 *
 * @param db the shared client or a transaction
 * @param inspections the inspections an answer carries
 * @returns the baselines, keyed "<assetId>:<metricId>"
 */
export async function metricBaselinesOf(db: Db, inspections: InspectionRow[]): Promise<Map<string, number>> {
    const metricIds = [...new Set(inspections.flatMap(i => i.metrics.map(m => m.metric_id)))];
    if (metricIds.length === 0) return new Map();
    const assetIds = [...new Set(inspections.map(i => i.asset_id))];
    const values = await db.asset_inspection_metrics.findMany({
        where: { metric_id: { in: metricIds }, asset_inspections: { asset_id: { in: assetIds } } },
        include: { asset_inspections: { select: { asset_id: true } } },
        orderBy: [{ asset_inspections: { inspected_at: 'asc' } }, { inspection_id: 'asc' }],
    });
    const baselines = new Map<string, number>();
    for (const v of values) {
        const key = `${v.asset_inspections.asset_id}:${v.metric_id}`;
        if (!baselines.has(key)) baselines.set(key, Number(v.value));
    }
    return baselines;
}
