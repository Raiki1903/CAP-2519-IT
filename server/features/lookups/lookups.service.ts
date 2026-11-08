/**
 * Lookups service: builds the option lists the forms pick from.
 * Layer: service. Called by lookups.controller.ts. Calls lookups.repository.ts and @shared (the categories and campuses
 * with their labels).
 * Used by: Edit Asset, Register Asset, the borrow form, Report an issue, the inspection forms, and the sign-up page.
 */
import type { FormLookups } from '@shared/types/lookups';
import { ASSET_CATEGORIES, ASSET_CATEGORY_LABELS, type AssetCategory } from '@shared/enums/assetCategory';
import { CAMPUS_LABELS } from '@shared/constants/campuses';
import * as lookupsRepository from './lookups.repository';

/**
 * The lists every form may read, with or without a session. Nothing here names a person: a lab's Head is given by
 * user id only.
 * Funding sources, issue types, and metrics come from their tables, so a new row needs no code change.
 *
 * @returns labs with their campus, categories with their labels, funding sources, issue types with their suggested
 *   action, the metrics of each category, and projects
 */
export async function formLookups(): Promise<FormLookups> {
    const [centers, fundingSources, issueTypes, categoryMetrics, projects] = await lookupsRepository.findFormLookupTables();

    const metricsByCategory: FormLookups['metricsByCategory'] = {};
    for (const link of categoryMetrics) {
        const m = link.metric_definitions;
        (metricsByCategory[link.category] ??= []).push({
            metricId: m.metric_id,
            metricKey: m.metric_key,
            name: m.name,
            unit: m.unit,
            higherIsBetter: m.higher_is_better,
        });
    }

    return {
        labs: centers.map(c => ({
            centerId: c.center_id,
            code: c.short_code,
            name: c.name,
            campus: c.location,
            campusLabel: CAMPUS_LABELS[c.location],
            headUserId: c.head_user_id,
        })),
        categories: ASSET_CATEGORIES.map(key => ({ key, label: ASSET_CATEGORY_LABELS[key as AssetCategory] })),
        fundingSources: fundingSources.map(f => ({ fundingSourceId: f.funding_source_id, name: f.name })),
        issueTypes: issueTypes.map(t => ({ issueTypeId: t.issue_type_id, key: t.key, name: t.name, suggestedAction: t.suggested_action })),
        metricsByCategory,
        projects: projects.map(p => ({ projectId: p.project_id, code: p.project_code, name: p.project_name, centerId: p.center_id })),
    };
}
