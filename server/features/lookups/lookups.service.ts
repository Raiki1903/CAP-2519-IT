/**
 * Lookups service: builds the option lists the forms pick from.
 * Layer: service. Called by lookups.controller.ts. Calls lookups.repository.ts, shared/constants/poolCustodian.ts, and
 * @shared (the categories, funding sources, and editable statuses).
 * Used by: Edit Asset, Register Equipment, the borrow form, and the sign-up page.
 */
import type { CustodianOption, FormLookups } from '@shared/types/lookups';
import { ASSET_CATEGORIES } from '@shared/enums/assetCategory';
import { EDITABLE_ASSET_STATUSES } from '@shared/enums/assetStatus';
import { FUNDING_SOURCES } from '@shared/constants/fundingSources';
import * as lookupsRepository from './lookups.repository';
import { POOL_CUSTODIAN_ID } from '../../shared/constants/poolCustodian';

/**
 * The lists every form may read, with or without a session. Nothing here names a person.
 *
 * @returns the labs (short code, name, campus), categories, funding sources, and editable statuses
 */
export async function formLookups(): Promise<FormLookups> {
    const centers = await lookupsRepository.findLabs();
    return {
        labs: centers.map(c => ({ code: c.short_code, name: c.name, campus: c.location })),
        categories: ASSET_CATEGORIES,
        fundingSources: FUNDING_SOURCES,
        statuses: EDITABLE_ASSET_STATUSES,
    };
}

/**
 * The people Edit Asset may name as an asset's custodian: the accounts with the Custodian role, without the
 * placeholder (user 1, "nobody holds it"), which the form offers as None instead.
 *
 * @returns each account's user id and "First Last" name, and nothing else about it
 */
export async function custodianOptions(): Promise<CustodianOption[]> {
    const accounts = await lookupsRepository.findCustodianAccounts(POOL_CUSTODIAN_ID);
    return accounts.map(u => ({ userId: u.user_id, name: `${u.first_name} ${u.last_name}` }));
}
