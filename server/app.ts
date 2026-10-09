/**
 * Builds the Express app: the middleware, in order, then the routes.
 * Layer: server app. Called by main.ts. Calls the routes files of features/loans, returns, transfers, and disposals, and remainingRoutes.ts.
 * Used by: every request to the API.
 */
import express from 'express';
import cors from 'cors';
import { loansRouter } from './features/loans/loans.routes';
import { returnsRouter } from './features/returns/returns.routes';
import { transfersRouter } from './features/transfers/transfers.routes';
import { disposalsRouter } from './features/disposals/disposals.routes';
import { router as remainingRoutes } from './remainingRoutes';

/**
 * The Express app, configured but not listening. main.ts starts it.
 * Feature routers (server/features/<process>/) are mounted here as they are extracted: loans, returns, transfers,
 * and disposals so far, the rest later in step 12. No feature path overlaps another or a path in remainingRoutes.ts,
 * so the mounting order does not change which handler answers.
 */
export const app = express();

// TODO(C-02): CORS allows every origin. Restrict it to the web app's origin. 01C tier 2, with step 13.
app.use(cors());
// TODO(M-17): 50 MB bodies, because images are sent as base64 text. Lower it when images move out of the database. Phase 3.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(loansRouter);
app.use(returnsRouter);
app.use(transfersRouter);
app.use(disposalsRouter);
app.use(remainingRoutes);
