/**
 * Loan route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls loans.controller.ts.
 * Used by: Custodian borrow request (LoanForm), Lab Head approval (Custody tab and the bell), and the screens that list loans.
 */
import express from 'express';
import * as loansController from './loans.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';

/** The three loan endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const loansRouter = express.Router();

// Every route needs a session; the roles are the approved 13b role table (rows 20 to 22, docs/phase-1c-restructure/02-restructure-log.md).
// TODO(M-02): any Lab Head may decide any lab's loan; whose lab it is is not checked. Lab scoping, after step 14 (a lab_id on assets).
loansRouter.get('/api/asset_loans', requireAuth, loansController.listLoans);
loansRouter.post('/api/assets/:assetTag/borrow', requireAuth, requireRole('Custodian'), loansController.requestLoan);
loansRouter.put('/api/asset_loans/:loanId/decision', requireAuth, requireRole('LabHead'), loansController.decideLoan);
