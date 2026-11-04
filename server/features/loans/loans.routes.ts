/**
 * Loan route table: which URL maps to which controller.
 * Layer: routes. Mounted by server/app.ts. Calls loans.controller.ts.
 * Used by: Researcher loan requests (LoanForm) and return requests, Lab Head approval (Custody tab and the bell), TSG
 * release and receipt (Record Return), and the screens that list loans.
 */
import express from 'express';
import * as loansController from './loans.controller';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireActive, requireAnyRole, requireLabHead, requireTsg } from '../../shared/middleware/permissions';

/** The loan endpoints. Paths are written out in full, so app.ts mounts the router at the root. */
export const loansRouter = express.Router();

// Every route needs a session and an Active account. A Researcher who heads no lab borrows and cancels; the account
// that heads a lab is let through the request route only to be told to use a personal account (the service answers
// 403). The borrower asks to return. A decision needs the Head of the asset's home lab, which the service checks
// (shared/services/permissions.ts requireHomeLabHead). Release and receipt are physical steps, for TSG only.
loansRouter.get('/api/loans', requireAuth, requireActive, loansController.listLoans);
loansRouter.post('/api/assets/:assetTag/loans', requireAuth, requireActive, requireAnyRole('RESEARCHER', 'LAB_HEAD'), loansController.requestLoan);
loansRouter.put('/api/loans/:loanId/cancel', requireAuth, requireActive, requireAnyRole('RESEARCHER'), loansController.cancelLoan);
loansRouter.put('/api/loans/:loanId/approve', requireAuth, requireActive, requireLabHead, loansController.approveLoan);
loansRouter.put('/api/loans/:loanId/decline', requireAuth, requireActive, requireLabHead, loansController.declineLoan);
loansRouter.put('/api/loans/:loanId/release', requireAuth, requireActive, requireTsg, loansController.releaseLoan);
loansRouter.put('/api/loans/:loanId/return-request', requireAuth, requireActive, requireAnyRole('RESEARCHER'), loansController.requestReturn);
loansRouter.put('/api/loans/:loanId/receive', requireAuth, requireActive, requireTsg, loansController.receiveReturn);
