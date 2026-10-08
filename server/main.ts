/**
 * Backend entry point: starts the backup timer and the HTTP listener, then runs the startup check.
 * Layer: server entry. Run by `npm run server` (also `server:watch`, `dev:all`, and the API tests in tests/setup/testServer.ts).
 * Calls config/env.ts, app.ts, remainingRoutes.ts (startup check), and jobs/backup.ts.
 * Used by: every role, through the web app.
 */
import { env } from './config/env';
import { app } from './app';
import { assertDefaultCustodianExists } from './remainingRoutes';
import { performDatabaseBackup } from './jobs/backup';

// Run backup every 6 hours
setInterval(performDatabaseBackup, 6 * 60 * 60 * 1000);

const PORT = env.port;
app.listen(PORT, async () => {
    console.log(`\n==================================================`);
    console.log(`✅ Mini-Backend API is actively listening!`);
    console.log(`🚀 Route Ready: http://localhost:${PORT}/api/assets`);
    console.log(`==================================================\n`);
    // The check only logs. The server keeps running even when user 1 is missing.
    // TODO(H-10): goes when nothing is logged under DEFAULT_CUSTODIAN_ID any more. After step 13, once the session gives the acting user.
    await assertDefaultCustodianExists();
    performDatabaseBackup();
});
