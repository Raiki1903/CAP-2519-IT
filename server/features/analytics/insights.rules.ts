/**
 * Insight rules: the five pure checks that decide whether an asset gets an advice note, and how urgent it is.
 * Layer: service helper (no database, no wording). Called by insights.service.ts. Calls shared/services/assetState.ts
 * (serverToday) and the shared condition, category, maintenance, loan, and inspection constants.
 * Used by: the Staff, Lab Head, and Director analytics insights.
 * Dates: a DATE column (warranty_expiry, procurement_date, return_by) is compared as its UTC yyyy-mm-dd, as assetState
 * does. A DateTime column (reported_at, inspected_at) is compared as the server's local day. `asOf` is a yyyy-mm-dd
 * given by the caller, so tests can fix it. Day counts are whole calendar days.
 */
import type { InsightChartKey, InsightPriority, InsightRuleId, InsightView } from '@shared/types/analytics';
import { ASSET_CONDITIONS, ASSET_CONDITION_LABELS, type AssetCondition } from '@shared/enums/assetCondition';
import { ASSET_CATEGORY_LABELS, type AssetCategory } from '@shared/enums/assetCategory';
import { MAINTENANCE_STATUS_LABELS, type MaintenanceStatus } from '@shared/constants/maintenanceStatuses';
import { HELD_LOAN_STATUSES } from '@shared/constants/loanStatuses';
import { TSG_INSPECTION_TYPES } from '@shared/constants/inspectionTypes';
import { serverToday } from '../../shared/services/assetState';

/** WAR-01: the warranty ends within this many days. */
export const WARRANTY_WINDOW_DAYS = 90;
/** WAR-01: HIGH when it ends within this many days. */
export const WARRANTY_HIGH_DAYS = 30;
/** LOAN-02: a loan is flagged when it is more than this many days past its return date. */
export const LOAN_GRACE_DAYS = 7;
/** LOAN-02: HIGH when it is more than this many days past. */
export const LOAN_HIGH_DAYS = 14;
/** REP-03: how many days back tickets are counted. */
export const REPAIR_WINDOW_DAYS = 180;
/** REP-03: how many tickets in the window make a note. */
export const REPAIR_MIN_TICKETS = 3;

/**
 * LIFE-04: months after purchase at which a category gets a review note. Demo values only, for the Director UAT:
 * they are a review point, not policy. A category not listed never gets the note.
 */
export const LIFECYCLE_LIMIT_MONTHS: Partial<Record<AssetCategory, number>> = { MONITOR: 60, ROUTER: 60, DEV_KIT: 48 };

/** The asset fields the rules read. */
export interface RuleAsset {
    assetId: number;
    tag: string;
    name: string;
    category: AssetCategory;
    /** assets.status; a Retired asset never gets a note. */
    status: string;
    labCode: string;
    procurementDate: Date | null;
    warrantyExpiry: Date | null;
}

/** A loan as LOAN-02 reads it. */
export interface RuleLoan {
    loanId: number;
    status: string;
    returnBy: Date;
    borrowerName: string;
}

/** A maintenance ticket as REP-03 reads it. */
export interface RuleTicket {
    maintenanceId: number;
    status: MaintenanceStatus;
    reportedAt: Date;
}

/** An inspection as COND-05 reads it. */
export interface RuleInspection {
    inspectionId: number;
    type: string;
    condition: AssetCondition;
    inspectedAt: Date;
}

/** What a rule found: the facts of one note, before any wording. insights.text.ts turns it into the note. */
export interface InsightHit {
    ruleId: InsightRuleId;
    view: InsightView;
    priority: InsightPriority;
    chartKey: InsightChartKey;
    asset: RuleAsset;
    /** The numbers and words the text templates fill in, by placeholder name. */
    vars: Record<string, string | number>;
    evidence: { label: string; value: string }[];
    /** Smaller is more urgent; compared only between notes of the same priority. */
    urgency: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A DATE column as yyyy-mm-dd. Prisma reads a DATE as midnight UTC, so the UTC date is the stored one. */
export function dateOnly(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/** Whole calendar days from one yyyy-mm-dd to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

/** Midnight UTC, `days` before a yyyy-mm-dd. The repository uses it as a coarse date filter. */
export function daysBefore(day: string, days: number): Date {
    return new Date(Date.parse(`${day}T00:00:00Z`) - days * MS_PER_DAY);
}

/** The yyyy-mm-dd that is `days` after a yyyy-mm-dd. */
export function addDays(day: string, days: number): string {
    return new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The Monday of the week a yyyy-mm-dd falls in. */
export function mondayOf(day: string): string {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    return addDays(day, -((weekday + 6) % 7));
}

/**
 * Whole months from one yyyy-mm-dd to another: a month counts once its day of the month is reached. A purchase on the
 * 31st completes a month only in a month that has a 31st, which keeps the rule a plain calendar one.
 */
export function wholeMonthsBetween(from: string, to: string): number {
    const [y1, m1, d1] = from.split('-').map(Number);
    const [y2, m2, d2] = to.split('-').map(Number);
    return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

function isRetired(asset: RuleAsset): boolean {
    return asset.status === 'RETIRED';
}

/** WAR-01: the warranty ends in 0 to 90 days. HIGH within 30 days, else MEDIUM. */
export function warrantyRule(asset: RuleAsset, asOf: string): InsightHit | null {
    if (isRetired(asset) || !asset.warrantyExpiry) return null;
    const expiry = dateOnly(asset.warrantyExpiry);
    const days = daysBetween(asOf, expiry);
    if (days < 0 || days > WARRANTY_WINDOW_DAYS) return null;
    return {
        ruleId: 'WAR-01', view: 'operational', chartKey: 'warranty', asset,
        priority: days <= WARRANTY_HIGH_DAYS ? 'HIGH' : 'MEDIUM',
        vars: { N: days, date: expiry },
        evidence: [{ label: 'Warranty ends', value: expiry }],
        urgency: days,
    };
}

/**
 * LOAN-02: a held loan (On Loan or Return Requested, the contract's overdue rule) more than 7 days past its return
 * date. HIGH over 14 days, else MEDIUM. Return Requested counts because the asset is still the borrower's until TSG
 * receives it.
 */
export function overdueLoanRule(asset: RuleAsset, loan: RuleLoan, asOf: string): InsightHit | null {
    if (isRetired(asset) || !(HELD_LOAN_STATUSES as readonly string[]).includes(loan.status)) return null;
    const returnBy = dateOnly(loan.returnBy);
    const days = daysBetween(returnBy, asOf);
    if (days <= LOAN_GRACE_DAYS) return null;
    return {
        ruleId: 'LOAN-02', view: 'operational', chartKey: 'overdueLoans', asset,
        priority: days > LOAN_HIGH_DAYS ? 'HIGH' : 'MEDIUM',
        vars: { N: days },
        evidence: [
            { label: 'Return by', value: returnBy },
            { label: 'Borrower', value: loan.borrowerName },
        ],
        urgency: -days,
    };
}

/**
 * REP-03: 3 or more tickets of any type, not Cancelled, reported in the last 180 days (the day 180 days back still
 * counts). Any type counts because the server allows one open ticket per asset, so duplicate reports cannot inflate
 * the count. HIGH when a counted ticket is still open or the current condition is Critical Defect, else MEDIUM.
 *
 * @param currentCondition the asset's condition now (its newest TSG inspection), or null
 */
export function repeatRepairsRule(asset: RuleAsset, tickets: RuleTicket[], currentCondition: AssetCondition | null, asOf: string): InsightHit | null {
    if (isRetired(asset)) return null;
    const recent = tickets
        .filter(t => t.status !== 'CANCELLED')
        .filter(t => {
            const age = daysBetween(serverToday(t.reportedAt), asOf);
            return age >= 0 && age <= REPAIR_WINDOW_DAYS;
        })
        .sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime() || b.maintenanceId - a.maintenanceId);
    if (recent.length < REPAIR_MIN_TICKETS) return null;
    const stillOpen = recent.some(t => t.status !== 'RESOLVED' && t.status !== 'BEYOND_REPAIR');
    return {
        ruleId: 'REP-03', view: 'operational', chartKey: 'repairs', asset,
        priority: stillOpen || currentCondition === 'CRITICAL_DEFECT' ? 'HIGH' : 'MEDIUM',
        vars: { N: recent.length },
        evidence: recent.map(t => ({
            label: `MNT-${t.maintenanceId}`,
            value: `${serverToday(t.reportedAt)} (${MAINTENANCE_STATUS_LABELS[t.status]})`,
        })),
        urgency: -recent.length,
    };
}

/**
 * LIFE-04: the purchase date is set and not in the future, the category has a review point (LIFECYCLE_LIMIT_MONTHS),
 * and the whole months since purchase reach it. Always PLANNING, in the strategic view. The oldest asset comes first.
 */
export function lifecycleRule(asset: RuleAsset, asOf: string): InsightHit | null {
    const limit = LIFECYCLE_LIMIT_MONTHS[asset.category];
    if (isRetired(asset) || limit === undefined || !asset.procurementDate) return null;
    const purchased = dateOnly(asset.procurementDate);
    if (purchased > asOf) return null;
    const months = wholeMonthsBetween(purchased, asOf);
    if (months < limit) return null;
    return {
        ruleId: 'LIFE-04', view: 'strategic', chartKey: 'lifecycle', asset, priority: 'PLANNING',
        vars: { N: months, L: limit },
        evidence: [
            { label: 'Purchased', value: purchased },
            { label: 'Category', value: ASSET_CATEGORY_LABELS[asset.category] },
        ],
        urgency: -months,
    };
}

/**
 * COND-05: the asset's two newest TSG inspections (every type except Self Report) are on different days and the newest
 * condition is worse. HIGH when the newest is Critical Defect, else MEDIUM. A bigger drop comes first.
 *
 * @param inspections the asset's inspections, in any order; Self Reports are ignored here too
 */
export function conditionDropRule(asset: RuleAsset, inspections: RuleInspection[]): InsightHit | null {
    if (isRetired(asset)) return null;
    const [latest, previous] = inspections
        .filter(i => (TSG_INSPECTION_TYPES as readonly string[]).includes(i.type))
        .sort((a, b) => b.inspectedAt.getTime() - a.inspectedAt.getTime() || b.inspectionId - a.inspectionId);
    if (!latest || !previous) return null;
    const latestDay = serverToday(latest.inspectedAt);
    const previousDay = serverToday(previous.inspectedAt);
    if (latestDay === previousDay) return null;
    const drop = ASSET_CONDITIONS.indexOf(latest.condition) - ASSET_CONDITIONS.indexOf(previous.condition);
    if (drop <= 0) return null;
    return {
        ruleId: 'COND-05', view: 'operational', chartKey: 'condition', asset,
        priority: latest.condition === 'CRITICAL_DEFECT' ? 'HIGH' : 'MEDIUM',
        vars: { prev: ASSET_CONDITION_LABELS[previous.condition], latest: ASSET_CONDITION_LABELS[latest.condition] },
        evidence: [
            { label: 'Previous inspection', value: `${previousDay} (${ASSET_CONDITION_LABELS[previous.condition]})` },
            { label: 'Latest inspection', value: `${latestDay} (${ASSET_CONDITION_LABELS[latest.condition]})` },
        ],
        urgency: -drop,
    };
}
