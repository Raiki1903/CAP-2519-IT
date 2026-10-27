/**
 * Backend entry point: starts the HTTP listener, then runs the placeholder custodian startup check.
 * Layer: server entry. Run by `npm run server` (also `server:watch`, `dev:all`, and the API tests in tests/setup/testServer.ts).
 * Calls config/env.ts, app.ts, and shared/services/poolCustodianCheck.ts.
 * Used by: every role, through the web app.
 */
import { env } from './config/env';
import { app } from './app';
import { assertPoolCustodianExists } from './shared/services/poolCustodianCheck';

const PORT = env.port;
const server = app.listen(PORT, async () => {
    console.log(`\n==================================================`);
    console.log(`✅ Mini-Backend API is actively listening!`);
    console.log(`🚀 Route Ready: http://localhost:${PORT}/api/assets`);
    console.log(`==================================================\n`);
    // The check only logs. The server keeps running even when user 1 is missing.
    // TODO(H-10): goes with POOL_CUSTODIAN_ID, when asset_records.current_custodian may be empty (after step 14).
    await assertPoolCustodianExists();
});

server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the other server first.`);
        process.exit(1);
    }
    throw err;
});
