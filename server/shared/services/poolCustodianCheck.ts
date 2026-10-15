/**
 * The placeholder custodian startup check: does user POOL_CUSTODIAN_ID exist?
 * Layer: shared service. Called by server/main.ts once the server listens. Calls features/auth/auth.repository.ts.
 * Used by: no workflow directly; every write that records an asset nobody holds needs that user.
 */
import * as authRepository from '../../features/auth/auth.repository';
import { POOL_CUSTODIAN_ID } from '../constants/poolCustodian';

/**
 * Startup check: logs an error if user POOL_CUSTODIAN_ID does not exist, instead of
 * letting every asset write fail later with an opaque foreign key error. Never throws.
 * Called by main.ts once the server listens.
 */
export async function assertPoolCustodianExists() {
    const user = await authRepository.findUserById(POOL_CUSTODIAN_ID);
    if (!user) {
        console.error(
            `\n❌ Startup check failed: no user with user_id = ${POOL_CUSTODIAN_ID} exists in the 'users' table.\n` +
            `   asset_records.current_custodian is a required foreign key, so asset writes will fail until this is fixed.\n` +
            `   Run: SELECT user_id, first_name, last_name FROM users;  to see valid ids, then update POOL_CUSTODIAN_ID.\n` +
            `   If the users table is empty, insert at least one user row first.\n`
        );
    } else {
        console.log(`✅ Pool custodian check passed: user_id ${user.user_id} (${user.first_name} ${user.last_name}) stands for "nobody holds it"`);
    }
}
