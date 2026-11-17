/**
 * Reference service: the asset categories as the other features read them, and the category checks.
 * Layer: service. Called by features/assets, features/retirements, features/analytics, features/lookups, and
 * features/imports. Calls reference.repository.ts.
 * Used by: every answer that shows a category's label or an asset's present value, Register and Edit Asset, the loan
 * recommender's category filter, and the form option lists.
 * The categories live in asset_categories, so a category added on the Reference Data page needs no code change.
 */
import { AppError } from '../../shared/errors/AppError';
import * as referenceRepository from './reference.repository';

/** One asset category as the services use it. */
export interface CategoryInfo {
    code: string;
    label: string;
    usefulLifeYears: number;
    isActive: boolean;
}

/** Every category by its code, in label order. */
export type CategoryMap = ReadonlyMap<string, CategoryInfo>;

/** The 400 message for a category that is not in the list. */
export const UNKNOWN_CATEGORY_MESSAGE = "Pick a category from the list.";

/** The 400 message for an inactive category on a new asset, or a change to one. */
export const INACTIVE_CATEGORY_MESSAGE = "This category is no longer in use. Pick another from the list.";

/**
 * Every category, inactive ones too, by code. Read it once per request and pass it on.
 *
 * @returns code to label, useful life, and whether it is active
 */
export async function categoryMap(): Promise<CategoryMap> {
    const rows = await referenceRepository.listCategories();
    return new Map(rows.map(c => [c.code, {
        code: c.code,
        label: c.label,
        usefulLifeYears: c.useful_life_years,
        isActive: c.is_active,
    }]));
}

/**
 * One category of a stored asset. Every asset's category is in the table (a foreign key), so the code is shown as its
 * own label, with a useful life of 5 years, only if a row was read before the category existed.
 *
 * @param categories from categoryMap()
 * @param code the asset's category
 */
export function categoryOf(categories: CategoryMap, code: string): CategoryInfo {
    return categories.get(code) ?? { code, label: code, usefulLifeYears: 5, isActive: false };
}

/**
 * Checks the category a body sends for an asset. A new asset needs an active category. An edit may keep the
 * asset's current category even when it is inactive, but a change must be to an active one.
 *
 * @param code the category code the body sends
 * @param currentCode the asset's category before the edit, or undefined for a new asset
 * @throws AppError 400 UNKNOWN_CATEGORY_MESSAGE if it is not a category
 * @throws AppError 400 INACTIVE_CATEGORY_MESSAGE if it is inactive and not the asset's current one
 */
export async function checkAssetCategory(code: string, currentCode?: string): Promise<void> {
    const category = (await categoryMap()).get(code);
    if (!category) throw new AppError(400, UNKNOWN_CATEGORY_MESSAGE);
    if (!category.isActive && code !== currentCode) throw new AppError(400, INACTIVE_CATEGORY_MESSAGE);
}

/**
 * Checks a category filter. An inactive category is still a filter: assets may have it.
 *
 * @param code the category code of the filter
 * @throws AppError 400 UNKNOWN_CATEGORY_MESSAGE if it is not a category
 */
export async function checkCategoryFilter(code: string): Promise<void> {
    if (!(await categoryMap()).has(code)) throw new AppError(400, UNKNOWN_CATEGORY_MESSAGE);
}
