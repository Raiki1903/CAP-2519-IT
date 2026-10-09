/**
 * Loan controller: unpacks loan requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by loans.routes.ts. Calls loans.validation.ts and loans.service.ts.
 * Used by: Custodian borrow request, Lab Head approval.
 */
import type { Request, Response } from 'express';
import * as loansService from './loans.service';
import { checkLoanDecision, checkLoanRequest } from './loans.validation';
import { AppError } from '../../shared/errors/AppError';

/**
 * Handles GET /api/asset_loans: every loan, newest first, as `{ success, loans }`.
 * A failure answers 500 with the raw error message.
 */
// TODO(H-16): the 500 answers here and below send the database's own error text to the browser. errorHandler, step 13.
export async function listLoans(req: Request, res: Response): Promise<void> {
    try {
        const loans = await loansService.listLoans();
        res.json({ success: true, loans });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
}

/**
 * Handles POST /api/assets/:assetTag/borrow: files a pending loan request.
 * Answers `{ success, loan }` with the new row, or the AppError's status and message
 * (400 missing field, 404 unknown tag, 409 refused by the custody request guard), or 500.
 */
export async function requestLoan(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        // Printed before the checks, so a refused request still shows in the server terminal.
        console.log(`🚀 Server received loan request for ${assetTag}:`, data);

        checkLoanRequest(data);
        const loan = await loansService.requestLoan(assetTag, data);

        console.log("✅ Loan request logged in MySQL successfully:", loan.loan_id, assetTag);
        res.json({ success: true, loan });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ MySQL Loan Insertion Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}

/**
 * Handles PUT /api/asset_loans/:loanId/decision: approves or declines a pending loan.
 * Answers `{ success, loan }` with the updated row, or the AppError's status and message
 * (400 bad id, bad decision word, or loan already decided; 404 unknown loan), or 500.
 */
export async function decideLoan(req: Request<{ loanId: string }>, res: Response): Promise<void> {
    try {
        const loanId = parseInt(req.params.loanId, 10);
        const { decision } = req.body as { decision?: string };
        // Printed before the checks, so a refused decision still shows in the server terminal.
        console.log(`🚀 Server received loan decision for #${loanId}:`, decision);

        checkLoanDecision(loanId, decision);
        const updatedLoan = await loansService.decideLoan(loanId, decision);

        console.log(`✅ Loan #${loanId} ${decision}d successfully.`);
        res.json({ success: true, loan: updatedLoan });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ MySQL Loan Decision Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
}
