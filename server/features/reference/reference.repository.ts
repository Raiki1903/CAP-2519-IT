/**
 * Reference data access: the asset categories.
 * Layer: repository. Called by reference.service.ts. Calls config/prisma.ts.
 * Used by: every answer that shows a category's label or an asset's present value, Register and Edit Asset, and the
 * form option lists.
 */
import { prisma } from '../../config/prisma';

/**
 * Every asset category, inactive ones too.
 *
 * @returns the asset_categories rows, by label
 */
export function listCategories() {
    return prisma.asset_categories.findMany({ orderBy: { label: 'asc' } });
}
