/**
 * Loan route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls loans.controller.ts.
 * Used by: Custodian borrow request (LoanForm), Lab Head approval (Custody tab and the bell), and the screens that list loans.
 */
import express from 'express';
import * as loansController from './loans.controller';

/** The three loan endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const loansRouter = express.Router();

// TODO(C-02): anyone who can reach the server can list, request, and decide loans; no session or role is checked. requireAuth and requireRole, step 13.
loansRouter.get('/api/asset_loans', loansController.listLoans);
loansRouter.post('/api/assets/:assetTag/borrow', loansController.requestLoan);
loansRouter.put('/api/asset_loans/:loanId/decision', loansController.decideLoan);
