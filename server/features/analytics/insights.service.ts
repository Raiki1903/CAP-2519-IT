/**
 * Insights service: runs the five rules over the rows in the viewer's scope and sorts the notes.
 * Layer: service. Called by analytics.controller.ts. Calls insights.repository.ts, analytics.scope.ts (which lab),
 * insights.rules.ts, insights.text.ts, and shared/services/assetState.ts (serverToday).
 * Used by: the Staff, Lab Head, and Director analytics insights.
 * Evaluated on each request. Nothing is stored and nothing is written.
 */
import type { Insight, InsightPriority, InsightsData } from '@shared/types/analytics';
import type { AssetCategory } from '@shared/enums/assetCategory';
import type { AssetCondition } from '@shared/enums/assetCondition';
import type { SessionIdentity } from '@shared/types/auth';
import { serverToday } from '../../shared/services/assetState';
import { resolveScope } from './analytics.scope';
import * as insightsRepository from './insights.repository';
import {
    REPAIR_WINDOW_DAYS, conditionDropRule, daysBefore, lifecycleRule, overdueLoanRule, repeatRepairsRule, warrantyRule,
    type InsightHit, type RuleAsset, type RuleInspection, type RuleLoan, type RuleTicket,
} from './insights.rules';
import { insightOf, type InsightAudience } from './insights.text';
import type { InsightsQuery } from './insights.validation';

const PRIORITY_ORDER: Record<InsightPriority, number> = { HIGH: 0, MEDIUM: 1, PLANNING: 2 };

/** Groups rows by their asset id. */
function groupByAsset<T>(rows: T[], assetIdOf: (row: T) => number): Map<number, T[]> {
    const groups = new Map<number, T[]>();
    for (const row of rows) {
        const id = assetIdOf(row);
        const group = groups.get(id);
        if (group) group.push(row);
        else groups.set(id, [row]);
    }
    return groups;
}

/** Orders hits: HIGH, MEDIUM, PLANNING, then the most urgent number, then the id. */
function byUrgency(a: { hit: InsightHit; insight: Insight }, b: { hit: InsightHit; insight: Insight }): number {
    return PRIORITY_ORDER[a.hit.priority] - PRIORITY_ORDER[b.hit.priority]
        || a.hit.urgency - b.hit.urgency
        || (a.insight.id < b.insight.id ? -1 : a.insight.id > b.insight.id ? 1 : 0);
}

/**
 * The insights for one viewer: every rule over the assets in their scope, filtered by view, sorted, and counted.
 * An asset has at most one note per rule. Nothing is shown when no rule fires.
 *
 * @param viewer the session user; their role picks the scope and the words
 * @param query the view and optional lab
 * @param asOf today as yyyy-mm-dd; tests fix it, the route never reads it from the request
 * @returns the answer without `success`
 * @throws AppError 403 or 400 as resolveScope says
 */
export async function insightsFor(viewer: SessionIdentity, query: InsightsQuery, asOf: string = serverToday()): Promise<InsightsData> {
    const scope = await resolveScope(viewer, query.centerId);
    const audience: InsightAudience = viewer.role === 'LabHead' ? 'labHead' : viewer.role === 'Staff' ? 'staff' : 'director';

    const [assetRows, loanRows, ticketRows, inspectionRows] = await Promise.all([
        insightsRepository.findAssets(scope.centerId),
        insightsRepository.findHeldLoans(scope.centerId),
        // Two days wider than the rule's window, so a time zone shift never drops a ticket the rule would count.
        insightsRepository.findRecentTickets(scope.centerId, daysBefore(asOf, REPAIR_WINDOW_DAYS + 2)),
        insightsRepository.findTsgInspections(scope.centerId),
    ]);

    const loansByAsset = groupByAsset(loanRows, l => l.asset_id);
    const ticketsByAsset = groupByAsset(ticketRows, t => t.asset_id);
    const inspectionsByAsset = groupByAsset(inspectionRows, i => i.asset_id);

    const hits: InsightHit[] = [];
    for (const row of assetRows) {
        const asset: RuleAsset = {
            assetId: row.asset_id, tag: row.asset_tag, name: row.name, category: row.category as AssetCategory,
            status: row.status, labCode: row.research_centers.short_code,
            procurementDate: row.procurement_date, warrantyExpiry: row.warranty_expiry,
        };
        const loans: RuleLoan[] = (loansByAsset.get(row.asset_id) ?? []).map(l => ({
            loanId: l.loan_id, status: l.status, returnBy: l.return_by, borrowerName: `${l.users.first_name} ${l.users.last_name}`,
        }));
        const tickets: RuleTicket[] = (ticketsByAsset.get(row.asset_id) ?? []).map(t => ({
            maintenanceId: t.maintenance_id, status: t.status, reportedAt: t.reported_at,
        }));
        const inspections: RuleInspection[] = (inspectionsByAsset.get(row.asset_id) ?? []).map(i => ({
            inspectionId: i.inspection_id, type: i.type, condition: i.condition as AssetCondition, inspectedAt: i.inspected_at,
        }));

        hits.push(
            ...[
                warrantyRule(asset, asOf),
                ...loans.map(loan => overdueLoanRule(asset, loan, asOf)),
                // The rows are newest first, so the first inspection is the condition now.
                repeatRepairsRule(asset, tickets, inspections[0]?.condition ?? null, asOf),
                lifecycleRule(asset, asOf),
                conditionDropRule(asset, inspections),
            ].filter((hit): hit is InsightHit => hit !== null),
        );
    }

    const cards = hits
        .filter(hit => query.view === 'all' || hit.view === query.view)
        .map(hit => ({ hit, insight: insightOf(hit, audience) }))
        .sort(byUrgency);

    const summary = { high: 0, medium: 0, planning: 0 };
    for (const { hit } of cards) summary[hit.priority.toLowerCase() as 'high' | 'medium' | 'planning'] += 1;

    return { asOfDate: asOf, scope, summary, insights: cards.map(card => card.insight) };
}
