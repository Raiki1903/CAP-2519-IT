/**
 * Reference service: the asset categories as the other features read them and the category checks, and the rules for
 * adding and changing categories, labs, and funding sources on the Reference Data page.
 * Layer: service. Called by reference.controller.ts, features/assets, features/retirements, features/analytics,
 * features/lookups, and features/imports. Calls reference.repository.ts and @shared (the campus labels).
 * Used by: every answer that shows a category's label or an asset's present value, Register and Edit Asset, the loan
 * recommender's category filter, the form option lists, and the Reference Data page (TSG and the Secretary).
 * The categories live in asset_categories, so a category added on the Reference Data page needs no code change.
 */
import { CAMPUS_LABELS } from '@shared/constants/campuses';
import type {
    CategoryCreateInput,
    CategoryUpdateInput,
    FundingSourceInput,
    LabCreateInput,
    LabUpdateInput,
    ReferenceCategory,
    ReferenceFundingSource,
    ReferenceLab,
} from '@shared/types/reference';
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

/** The longest category code: the size of asset_categories.code. */
const MAX_CODE_LENGTH = 30;

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

/**
 * The code of a new category, made from its label: upper case, spaces to "_", letters and digits only, at most 30.
 * "Oscilloscope" gives OSCILLOSCOPE, "3D Printer" gives 3D_PRINTER.
 *
 * @param label the category's label
 * @returns the code, or "" when the label has no letter or digit
 */
export function categoryCodeOf(label: string): string {
    return label
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_+/, '')
        .slice(0, MAX_CODE_LENGTH)
        .replace(/_+$/, '');
}

/** Whether two names are the same in any letter case, as MySQL compares them. */
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

type CategoryRow = Awaited<ReturnType<typeof referenceRepository.listCategoriesWithCounts>>[number];
type LabRow = Awaited<ReturnType<typeof referenceRepository.listLabsWithCounts>>[number];
type FundingRow = Awaited<ReturnType<typeof referenceRepository.listFundingSourcesWithCounts>>[number];

/** A category row as the page lists it. */
function categoryShape(row: CategoryRow): ReferenceCategory {
    return { code: row.code, label: row.label, usefulLifeYears: row.useful_life_years, isActive: row.is_active, assetCount: row._count.assets };
}

/** A lab row as the page lists it. */
function labShape(row: LabRow): ReferenceLab {
    const canDelete =
        row._count.assets === 0 &&
        row._count.user_centers === 0 &&
        row.head_user_id === null &&
        row._count.projects === 0 &&
        row._count.loan_destinations === 0;
    return {
        centerId: row.center_id,
        shortCode: row.short_code,
        name: row.name,
        campus: row.location,
        campusLabel: CAMPUS_LABELS[row.location],
        assetCount: row._count.assets,
        canDelete,
    };
}

/** A funding source row as the page lists it. */
function fundingShape(row: FundingRow): ReferenceFundingSource {
    return { fundingSourceId: row.funding_source_id, name: row.name, assetCount: row._count.assets, projectCount: row._count.projects };
}

/** Every category, inactive ones too, with how many assets have each, by label. */
export async function listReferenceCategories(): Promise<ReferenceCategory[]> {
    return (await referenceRepository.listCategoriesWithCounts()).map(categoryShape);
}

/**
 * Adds a category, active, with its code made from the label, and logs it.
 *
 * @param data the checked body
 * @param actorId the session user
 * @returns the new category as the list shows it
 * @throws AppError 400 if the label has no letter or digit to make a code from
 * @throws AppError 409 if a category has this label or this code, in any letter case
 */
export async function addCategory(data: CategoryCreateInput, actorId: number): Promise<ReferenceCategory> {
    const code = categoryCodeOf(data.label);
    if (!code) throw new AppError(400, "The label needs at least one letter or digit.");

    const existing = await referenceRepository.listCategories();
    if (existing.some(c => sameName(c.label, data.label))) {
        throw new AppError(409, `A category named ${data.label} already exists.`);
    }
    if (existing.some(c => sameName(c.code, code))) {
        throw new AppError(409, `A category with the code ${code} already exists.`);
    }

    const created = await referenceRepository.createCategory(
        { code, label: data.label, useful_life_years: data.usefulLifeYears, is_active: true },
        actorId,
        `Category added: ${data.label}`,
    );
    if (!created) throw new AppError(409, `A category named ${data.label} already exists.`);
    return categoryShape((await referenceRepository.findCategoryWithCount(code))!);
}

/**
 * Changes a category's label, useful life, or whether it is active, and logs what changed. The code never changes.
 * Nothing is written, and nothing is logged, when every value sent is the one already saved.
 *
 * @param code the category's code, from the URL
 * @param data the checked body
 * @param actorId the session user
 * @returns the category as the list shows it
 * @throws AppError 404 if no category has this code
 * @throws AppError 409 if another category has the new label, in any letter case
 */
export async function changeCategory(code: string, data: CategoryUpdateInput, actorId: number): Promise<ReferenceCategory> {
    const current = await referenceRepository.findCategoryWithCount(code);
    if (!current) throw new AppError(404, `No category found with code ${code}.`);

    const changes: string[] = [];
    const columns: { label?: string; useful_life_years?: number; is_active?: boolean } = {};
    if (data.label !== undefined && data.label !== current.label) {
        const others = (await referenceRepository.listCategories()).filter(c => c.code !== current.code);
        if (others.some(c => sameName(c.label, data.label!))) {
            throw new AppError(409, `A category named ${data.label} already exists.`);
        }
        columns.label = data.label;
        changes.push(`renamed from ${current.label}`);
    }
    if (data.usefulLifeYears !== undefined && data.usefulLifeYears !== current.useful_life_years) {
        columns.useful_life_years = data.usefulLifeYears;
        changes.push(`useful life ${data.usefulLifeYears}`);
    }
    if (data.isActive !== undefined && data.isActive !== current.is_active) {
        columns.is_active = data.isActive;
        changes.push(data.isActive ? "active" : "inactive");
    }
    if (changes.length === 0) return categoryShape(current);

    const label = columns.label ?? current.label;
    const saved = await referenceRepository.updateCategory(current.code, columns, actorId, `Category changed: ${label} (${changes.join(", ")})`);
    if (!saved) throw new AppError(409, `A category named ${label} already exists.`);
    return categoryShape((await referenceRepository.findCategoryWithCount(current.code))!);
}

/** Every lab with its campus and how many assets have it as their home lab, by short code. */
export async function listReferenceLabs(): Promise<ReferenceLab[]> {
    return (await referenceRepository.listLabsWithCounts()).map(labShape);
}

/**
 * Adds a lab, with no Head yet, and logs it. Its asset tags will start with the short code.
 *
 * @param data the checked body
 * @param actorId the session user
 * @returns the new lab as the list shows it
 * @throws AppError 409 if a lab has this short code, in any letter case
 */
export async function addLab(data: LabCreateInput, actorId: number): Promise<ReferenceLab> {
    const taken = `A lab with the short code ${data.shortCode} already exists.`;
    if (await referenceRepository.findLabByShortCode(data.shortCode)) throw new AppError(409, taken);

    const centerId = await referenceRepository.createLab(
        { name: data.name, short_code: data.shortCode, location: data.campus },
        actorId,
        `Lab added: ${data.shortCode}`,
    );
    if (centerId === null) throw new AppError(409, taken);
    return labShape((await referenceRepository.findLabWithCount(centerId))!);
}

/**
 * Changes a lab's name or campus and logs what changed. The short code never changes. Nothing is written, and nothing
 * is logged, when every value sent is the one already saved.
 *
 * @param centerId the lab, from the URL
 * @param data the checked body
 * @param actorId the session user
 * @returns the lab as the list shows it
 * @throws AppError 404 if no lab has this id
 */
export async function changeLab(centerId: number, data: LabUpdateInput, actorId: number): Promise<ReferenceLab> {
    const current = await referenceRepository.findLabWithCount(centerId);
    if (!current) throw new AppError(404, `No lab found with id ${centerId}.`);

    const changes: string[] = [];
    const columns: { name?: string; location?: LabUpdateInput['campus'] } = {};
    if (data.name !== undefined && data.name !== current.name) {
        columns.name = data.name;
        changes.push(`name ${data.name}`);
    }
    if (data.campus !== undefined && data.campus !== current.location) {
        columns.location = data.campus;
        changes.push(`campus ${CAMPUS_LABELS[data.campus]}`);
    }
    if (changes.length === 0) return labShape(current);

    await referenceRepository.updateLab(centerId, columns, actorId, `Lab changed: ${current.short_code} (${changes.join(", ")})`);
    return labShape((await referenceRepository.findLabWithCount(centerId))!);
}

/**
 * Deletes a lab that nothing uses, and logs it.
 *
 * @param centerId the lab, from the URL
 * @param actorId the session user
 * @throws AppError 404 if no lab has this id
 * @throws AppError 409 if the lab is in use by any asset, member, Lab Head, project, or loan
 */
export async function removeLab(centerId: number, actorId: number): Promise<void> {
    const result = await referenceRepository.deleteLab(centerId, actorId);
    if (!result) {
        throw new AppError(404, `No lab found with id ${centerId}.`);
    }
    if (result.deleted) {
        return;
    }
    const usages = 'usages' in result ? result.usages : undefined;
    if (!usages) {
        return;
    }
    const parts: string[] = [];
    if (usages.assetCount > 0) {
        parts.push(`${usages.assetCount} asset${usages.assetCount === 1 ? '' : 's'}`);
    }
    if (usages.memberCount > 0) {
        parts.push(`${usages.memberCount} member${usages.memberCount === 1 ? '' : 's'}`);
    }
    if (usages.hasHead) {
        parts.push('a Lab Head');
    }
    if (usages.projectCount > 0) {
        parts.push(`${usages.projectCount} project${usages.projectCount === 1 ? '' : 's'}`);
    }
    if (usages.loanCount > 0) {
        parts.push(`${usages.loanCount} loan${usages.loanCount === 1 ? '' : 's'}`);
    }
    throw new AppError(409, `This lab is in use and can't be deleted: ${parts.join(', ')}. Rename it instead.`);
}

/** Every funding source with how many assets and projects name it, by name. */
export async function listReferenceFundingSources(): Promise<ReferenceFundingSource[]> {
    return (await referenceRepository.listFundingSourcesWithCounts()).map(fundingShape);
}

/**
 * Adds a funding source and logs it.
 *
 * @param data the checked body
 * @param actorId the session user
 * @returns the new funding source as the list shows it
 * @throws AppError 409 if a funding source has this name, in any letter case
 */
export async function addFundingSource(data: FundingSourceInput, actorId: number): Promise<ReferenceFundingSource> {
    const taken = `A funding source named ${data.name} already exists.`;
    if (await referenceRepository.findFundingSourceByName(data.name)) throw new AppError(409, taken);

    const id = await referenceRepository.createFundingSource(data.name, actorId, `Funding source added: ${data.name}`);
    if (id === null) throw new AppError(409, taken);
    return fundingShape((await referenceRepository.findFundingSourceWithCounts(id))!);
}

/**
 * Renames a funding source and logs it. Nothing is written, and nothing is logged, when the name is the one saved.
 * A change of letter case only is a rename.
 *
 * @param fundingSourceId the funding source, from the URL
 * @param data the checked body
 * @param actorId the session user
 * @returns the funding source as the list shows it
 * @throws AppError 404 if no funding source has this id
 * @throws AppError 409 if another funding source has this name, in any letter case
 */
export async function renameFundingSource(fundingSourceId: number, data: FundingSourceInput, actorId: number): Promise<ReferenceFundingSource> {
    const current = await referenceRepository.findFundingSourceWithCounts(fundingSourceId);
    if (!current) throw new AppError(404, `No funding source found with id ${fundingSourceId}.`);
    if (data.name === current.name) return fundingShape(current);

    const taken = `A funding source named ${data.name} already exists.`;
    const sameNamed = await referenceRepository.findFundingSourceByName(data.name);
    if (sameNamed && sameNamed.funding_source_id !== fundingSourceId) throw new AppError(409, taken);

    const saved = await referenceRepository.renameFundingSource(
        fundingSourceId, data.name, actorId, `Funding source renamed: ${current.name} to ${data.name}`,
    );
    if (!saved) throw new AppError(409, taken);
    return fundingShape((await referenceRepository.findFundingSourceWithCounts(fundingSourceId))!);
}
