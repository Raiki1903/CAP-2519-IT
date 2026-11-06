/**
 * Loans per week service: counts, for each week, the loans out and the loans released, per lab and for all labs together,
 * with the average loan length and the three busiest weeks.
 * Layer: service. Called by analytics.controller.ts. Calls utilization.repository.ts, analytics.scope.ts,
 * insights.rules.ts (day helpers), and shared/services/assetState.ts (serverToday).
 * Used by: the Director and Lab Head loans per week chart.
 * Days: a DateTime (released_at, closed_at) is read as the server's local day, and a week runs Monday to Sunday.
 * Evaluated on each request. Nothing is stored and nothing is written.
 */
import type { LabUtilization, UtilizationData, UtilizationSeries } from '@shared/types/analytics';
import type { SessionIdentity } from '@shared/types/auth';
import { serverToday } from '../../shared/services/assetState';
import { resolveScope } from './analytics.scope';
import { addDays, daysBefore, daysBetween, mondayOf } from './insights.rules';
import * as utilizationRepository from './utilization.repository';
import type { UtilizationQuery } from './utilization.validation';

/** How many weeks are marked as busiest. */
const BUSIEST_COUNT = 3;

/** A released loan as the series reads it, by local day. */
interface LoanDays {
    releasedDay: string;
    /** The closing day, or today for a loan still open. */
    endDay: string;
    /** The closing day, or null for a loan still open. */
    closedDay: string | null;
}

/**
 * The weeks, loans out and released, average loan length, and busiest weeks of a set of loans.
 * A loan is out in a week when its days from release to closing (or to today) touch any day of the week.
 *
 * @param loans the loans, by day
 * @param weekStarts the Mondays to show, oldest first
 */
export function seriesOf(loans: LoanDays[], weekStarts: string[]): UtilizationSeries {
    const weeks = weekStarts.map(weekStart => {
        const weekEnd = addDays(weekStart, 6);
        return {
            weekStart,
            loansOut: loans.filter(l => l.releasedDay <= weekEnd && l.endDay >= weekStart).length,
            loansReleased: loans.filter(l => l.releasedDay >= weekStart && l.releasedDay <= weekEnd).length,
        };
    });
    const lengths = loans.filter(l => l.closedDay !== null).map(l => daysBetween(l.releasedDay, l.closedDay!));
    const averageLoanDays = lengths.length === 0 ? null : Math.round((lengths.reduce((sum, n) => sum + n, 0) / lengths.length) * 10) / 10;
    const busiestWeeks = weeks
        .filter(w => w.loansOut > 0)
        .sort((a, b) => b.loansOut - a.loansOut || (a.weekStart < b.weekStart ? 1 : -1))
        .slice(0, BUSIEST_COUNT)
        .map(w => w.weekStart);
    return { weeks, averageLoanDays, busiestWeeks };
}

/**
 * Loans per week for one viewer: the last `weeks` weeks including this one, for the viewer's scope.
 *
 * @param viewer the session user; a Lab Head is limited to their own lab
 * @param query the number of weeks and the optional lab
 * @param asOf today as yyyy-mm-dd; tests fix it, the route never reads it from the request
 * @throws AppError 403 or 400 as resolveScope says
 */
export async function utilizationFor(viewer: SessionIdentity, query: UtilizationQuery, asOf: string = serverToday()): Promise<UtilizationData> {
    const scope = await resolveScope(viewer, query.centerId);
    const firstWeek = addDays(mondayOf(asOf), -7 * (query.weeks - 1));
    const weekStarts = Array.from({ length: query.weeks }, (_, i) => addDays(firstWeek, 7 * i));

    // A day or two wider than the first week, so a time zone shift never drops a loan that touches it.
    const rows = await utilizationRepository.findReleasedLoans(scope.centerId, daysBefore(firstWeek, 2));

    const loans: (LoanDays & { centerId: number; code: string })[] = [];
    for (const row of rows) {
        const releasedDay = serverToday(row.released_at!);
        const closedDay = row.closed_at ? serverToday(row.closed_at) : null;
        const endDay = closedDay ?? asOf;
        if (endDay < firstWeek) continue;
        loans.push({ releasedDay, endDay, closedDay, centerId: row.assets.center_id, code: row.assets.research_centers.short_code });
    }

    const byLab = new Map<number, typeof loans>();
    for (const loan of loans) byLab.set(loan.centerId, [...(byLab.get(loan.centerId) ?? []), loan]);
    const labs: LabUtilization[] = [...byLab.values()]
        .map(labLoans => ({ centerId: labLoans[0].centerId, code: labLoans[0].code, ...seriesOf(labLoans, weekStarts) }))
        .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

    return { asOfDate: asOf, weekCount: query.weeks, scope, total: seriesOf(loans, weekStarts), labs };
}
