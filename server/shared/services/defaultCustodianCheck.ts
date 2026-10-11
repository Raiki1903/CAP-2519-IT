import * as authRepository from '../../features/auth/auth.repository';
import { DEFAULT_CUSTODIAN_ID } from '../constants/defaultCustodian';

/**
 * Startup check: logs an error if user DEFAULT_CUSTODIAN_ID does not exist, instead of
 * letting every asset write fail later with an opaque foreign key error. Never throws.
 * Called by main.ts once the server listens.
 */
export async function assertDefaultCustodianExists() {
    const user = await authRepository.findUserById(DEFAULT_CUSTODIAN_ID);
    if (!user) {
        console.error(
            `\n❌ Startup check failed: no user with user_id = ${DEFAULT_CUSTODIAN_ID} exists in the 'users' table.\n` +
            `   asset_records.current_custodian is a required foreign key, so asset writes will fail until this is fixed.\n` +
            `   Run: SELECT user_id, first_name, last_name FROM users;  to see valid ids, then update DEFAULT_CUSTODIAN_ID.\n` +
            `   If the users table is empty, insert at least one user row first.\n`
        );
    } else {
        console.log(`✅ Default custodian check passed: user_id ${user.user_id} (${user.first_name} ${user.last_name})`);
    }
}
