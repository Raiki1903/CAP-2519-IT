/**
 * Loan route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls loans.controller.ts.
 * Used by: Custodian borrow request (LoanForm), Lab Head approval (Custody tab and the bell), and the screens that list loans.
 */
import express from 'express';
import * as loansController from './loans.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireAnyRole, requireLabHead } from '../../shared/middleware/permissions';

/** The three loan endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const loansRouter = express.Router();

// Every route needs a session and an Active account. A Researcher who heads no lab borrows; a decision needs the Head
// of the asset's home lab, which the service checks (shared/services/permissions.ts requireHomeLabHead).
loansRouter.get('/api/loans', requireAuth, requireActive, loansController.listLoans);
loansRouter.post('/api/assets/:assetTag/borrow', requireAuth, requireActive, requireAnyRole('RESEARCHER'), loansController.requestLoan);
loansRouter.put('/api/loans/:loanId/decision', requireAuth, requireActive, requireLabHead, loansController.decideLoan);
