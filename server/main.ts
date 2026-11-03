/**
 * Backend entry point: starts the HTTP listener and says which database it uses.
 * Layer: server entry. Run by `npm run server` (also `server:watch`, `dev:all`, and the API tests in tests/setup/testServer.ts).
 * Calls config/env.ts and app.ts.
 * Used by: every role, through the web app.
 */
import { env } from './config/env';
import { app } from './app';

const PORT = env.port;
const server = app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    // Which database the server is on, so a teammate can tell a local copy from CCS Cloud. Never the password.
    console.log(`Database: ${env.database.name} on ${env.database.host}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the other server first.`);
        process.exit(1);
    }
    throw err;
});
