/**
 * Insight text: the title, issue line, preferred action, and alternatives of each rule, as template strings, and the
 * function that turns a rule's hit into the note a viewer reads.
 * Layer: service helper. Called by insights.service.ts. Calls insights.rules.ts (types only).
 * Used by: the Staff, Lab Head, and Director analytics insights.
 * Wording: neutral. Never "must", "unusable", "warranty eligible", or "buy". `{asset}` is "Name (TAG)".
 */
import type { Insight, InsightAlternative, InsightRuleId } from '@shared/types/analytics';
import type { InsightHit } from './insights.rules';

/** Whose words the preferred action uses: Lab Heads, Staff (TSG and the Secretary), or the Director. */
export type InsightAudience = 'labHead' | 'staff' | 'director';

/** The title of each rule. */
export const INSIGHT_TITLES: Record<InsightRuleId, string> = {
    'WAR-01': 'Warranty ending soon',
    'LOAN-02': 'Loan well past its return date',
    'REP-03': 'Repeated repairs',
    'LIFE-04': 'Due for a lifecycle review',
    'COND-05': 'Condition dropping',
};

/** The issue line of each rule: what the data shows. */
export const INSIGHT_ISSUES: Record<InsightRuleId, string> = {
    'WAR-01': 'The warranty for {asset} ends in {N} days ({date}).',
    'LOAN-02': '{asset} is {N} days past its return date.',
    'REP-03': '{asset} had {N} repair tickets in the last 180 days.',
    'LIFE-04': "{asset} was bought {N} months ago, past this category's review point ({L} months, a review point, not policy).",
    'COND-05': "{asset}'s condition went from {prev} to {latest} between its last two TSG inspections.",
};

/** The preferred action of each rule, by who is reading. */
export const INSIGHT_ACTIONS: Record<InsightRuleId, Record<InsightAudience, string>> = {
    'WAR-01': {
        labHead: 'Consider asking TSG for a condition check before it ends.',
        staff: 'Consider an inspection before the warranty ends.',
        director: 'Review assets whose warranty ends soon.',
    },
    'LOAN-02': {
        labHead: 'Consider following up with the borrower and TSG.',
        staff: 'Check where it is and follow up on the return.',
        director: 'Review labs with loans well past their return date.',
    },
    'REP-03': {
        labHead: 'Consider asking TSG to look at the repeated problems.',
        staff: 'Review its repair and inspection history for a repeating fault.',
        director: 'Consider maintenance or replacement planning for it.',
    },
    'LIFE-04': {
        labHead: "Review whether it still suits the lab's work.",
        staff: 'Check its condition if a review is due.',
        director: 'Review replacement planning. This is not a disposal approval.',
    },
    'COND-05': {
        labHead: 'Consider asking TSG why the condition dropped.',
        staff: 'Review the inspection history and decide if it needs work.',
        director: 'Review assets whose condition is dropping.',
    },
};

/**
 * One or two other actions the person could take for each rule's note, best first. Same for every audience.
 * From Macy's plan section 5. COND-05 has none there, so its two are ours.
 */
export const INSIGHT_ALTERNATIVES: Record<InsightRuleId, string[]> = {
    'WAR-01': [
        'Look over its past repair records.',
        "Take no further step if TSG finds a check isn't needed.",
    ],
    'LOAN-02': [
        'Contact the borrower directly.',
        'Check whether a different return arrangement was agreed.',
    ],
    'REP-03': [
        'Look over its condition and inspection history.',
        'Weigh more repairs against a future replacement review.',
    ],
    'LIFE-04': [
        'Keep it in service if a check finds it still suits the work.',
        'Discuss future replacement planning.',
    ],
    'COND-05': [
        'Read the inspection remarks to see what changed.',
        'Plan another inspection to see whether the drop continues.',
    ],
};

/** Fills the `{name}` placeholders of a template. A placeholder with no value is left as it is, so a mistake shows. */
function fill(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/**
 * Turns a rule's hit into the note a viewer reads.
 *
 * @param hit what the rule found
 * @param audience whose words the preferred action uses
 */
export function insightOf(hit: InsightHit, audience: InsightAudience): Insight {
    const vars = { ...hit.vars, asset: `${hit.asset.name} (${hit.asset.tag})` };
    const alternatives: InsightAlternative[] = INSIGHT_ALTERNATIVES[hit.ruleId].map((text, i) => ({ rank: i + 1, text }));
    return {
        id: `${hit.ruleId}:${hit.asset.tag}`,
        ruleId: hit.ruleId,
        view: hit.view,
        priority: hit.priority,
        assetTag: hit.asset.tag,
        assetName: hit.asset.name,
        labCode: hit.asset.labCode,
        title: INSIGHT_TITLES[hit.ruleId],
        issue: fill(INSIGHT_ISSUES[hit.ruleId], vars),
        preferredAction: INSIGHT_ACTIONS[hit.ruleId][audience],
        evidence: hit.evidence,
        alternatives,
        chartKey: hit.chartKey,
    };
}
