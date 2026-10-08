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
    await assertDefaultCustodianExists();
    performDatabaseBackup();
});
