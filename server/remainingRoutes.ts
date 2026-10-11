/**
 * The routes not yet extracted into server/features/<process>/: the 30 /api/analytics/* routes, and the default custodian startup check.
 * Layer: routes, temporarily all five layers in one file. Mounted by app.ts; main.ts calls the startup check. Calls config/prisma.ts
 * and shared/constants/defaultCustodian.ts.
 * Used by: the Director, Lab Head, and Staff analytics views. The analytics batch of step 12 moves the routes out (22 of them to
 * legacy/analytics-endpoints/, unregistered), and the file is deleted when it is empty.
 */
import express, { Request, Response } from 'express';
import { prisma } from './config/prisma.js';
import { DEFAULT_CUSTODIAN_ID } from './shared/constants/defaultCustodian';

/** The routes below, registered in their original order. app.ts mounts it after the body parsers. */
export const router = express.Router();

/**
 * Startup check: logs an error if user DEFAULT_CUSTODIAN_ID does not exist, instead of
 * letting every asset write fail later with an opaque foreign key error. Never throws.
 * Called by main.ts once the server listens.
 */
export async function assertDefaultCustodianExists() {
    const user = await prisma.users.findUnique({ where: { user_id: DEFAULT_CUSTODIAN_ID } });
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
