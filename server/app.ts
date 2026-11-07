/**
 * Builds the Express app: the middleware, in order, then the routes, then the error handler.
 * Layer: server app. Called by main.ts. Calls the routes files of features/loans, notifications, retirements, maintenance,
 * inspections, auth, users, activity-log, tickets, assets, analytics, and lookups, shared/middleware/errorHandler.ts, and config/env.ts (the web origin for CORS).
 * Used by: every request to the API.
 */
import express from 'express';
import cors from 'cors';
import { loansRouter } from './features/loans/loans.routes';
import { notificationsRouter } from './features/notifications/notifications.routes';
import { retirementsRouter } from './features/retirements/retirements.routes';
import { maintenanceRouter } from './features/maintenance/maintenance.routes';
import { inspectionsRouter } from './features/inspections/inspections.routes';
import { authRouter } from './features/auth/auth.routes';
import { usersRouter } from './features/users/users.routes';
import { activityLogRouter } from './features/activity-log/activityLog.routes';
import { ticketsRouter } from './features/tickets/tickets.routes';
import { assetsRouter } from './features/assets/assets.routes';
import { analyticsRouter } from './features/analytics/analytics.routes';
import { lookupsRouter } from './features/lookups/lookups.routes';
import { errorHandler } from './shared/middleware/errorHandler';
import { env } from './config/env';

/**
 * The Express app, configured but not listening. main.ts starts it.
 * Every route lives in a feature router (server/features/<process>/). No feature path overlaps another, so the mounting
 * order does not change which handler answers; a path no router knows gets Express's 404. errorHandler, mounted last,
 * answers every error a router or body parser passes on.
 */
export const app = express();

// The deployed site runs behind nginx on the same machine, which sends X-Forwarded-For. With 'loopback', req.ip is
// the forwarded address only for a request that came from this machine, so a direct request cannot fake it. The login
// limit counts failures per address (shared/services/loginLimiter.ts). Locally nothing changes.
app.set('trust proxy', 'loopback');

// A list, not a plain string: with a list, cors sends Access-Control-Allow-Origin only when the request's
// origin is on it, so another site's page gets no CORS headers at all. credentials lets the browser send
// and store the session cookie on these cross-origin calls (web on port 5173, API on port 4000).
app.use(cors({ origin: [env.webOrigin], credentials: true }));
// TODO(M-17): 50 MB bodies, because images are sent as base64 text. Lower it when images move out of the database. Phase 3.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(loansRouter);
app.use(notificationsRouter);
app.use(retirementsRouter);
app.use(maintenanceRouter);
app.use(inspectionsRouter);
app.use(authRouter);
app.use(usersRouter);
app.use(activityLogRouter);
app.use(ticketsRouter);
app.use(assetsRouter);
app.use(analyticsRouter);
app.use(lookupsRouter);

// Last, so it receives the errors of every router and of the body parsers above.
app.use(errorHandler);
