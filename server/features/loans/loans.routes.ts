import express from 'express';
import * as loansController from './loans.controller';

export const loansRouter = express.Router();

loansRouter.get('/api/asset_loans', loansController.listLoans);
loansRouter.post('/api/assets/:assetTag/borrow', loansController.requestLoan);
loansRouter.put('/api/asset_loans/:loanId/decision', loansController.decideLoan);
