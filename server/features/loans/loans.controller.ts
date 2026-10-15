/**
 * Loan controller: unpacks loan requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by loans.routes.ts. Calls loans.validation.ts and loans.service.ts.
 * Used by: Custodian borrow request, Lab Head approval.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as loansService from './loans.service';
import { checkLoanDecision, checkLoanRequest } from './loans.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/**
 * Handles GET /api/asset_loans: every loan, newest first, as `{ success, loans }`.
 * A failure answers errorHandler's generic 500.
 */
export async function listLoans(req: Request, res: Response): Promise<void> {
    const loans = await loansService.listLoans();
    res.json({ success: true, loans });
}

/**
 * Handles POST /api/assets/:assetTag/borrow: files a pending loan request for the session user.
 * Answers `{ success, loan }` with the new row, or the AppError's status and message
 * (400 missing field, 404 unknown tag, 409 refused by the custody request guard), or 500.
 */
export async function requestLoan(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const { assetTag } = req.params;
    const data = req.body;
    // Printed before the checks, so a refused request still shows in the server terminal.
    console.log(`🚀 Server received loan request for ${assetTag}:`, data);

    checkLoanRequest(data);
    const loan = await loansService.requestLoan(assetTag, data, sessionUserOf(req).userId);

    console.log("✅ Loan request logged in MySQL successfully:", loan.loan_id, assetTag);
    res.json({ success: true, loan });
}

/**
 * Handles PUT /api/asset_loans/:loanId/decision: approves or declines a pending loan.
 * Answers `{ success, loan }` with the updated row, or the AppError's status and message
 * (400 bad id, bad decision word, or loan already decided; 404 unknown loan), or 500.
 */
export async function decideLoan(req: Request<{ loanId: string }>, res: Response): Promise<void> {
    const loanId = parseInt(req.params.loanId, 10);
    const { decision } = req.body as { decision?: string };
    // Printed before the checks, so a refused decision still shows in the server terminal.
    console.log(`🚀 Server received loan decision for #${loanId}:`, decision);

    checkLoanDecision(loanId, decision);
    const updatedLoan = await loansService.decideLoan(loanId, decision);

    console.log(`✅ Loan #${loanId} ${decision}d successfully.`);
    res.json({ success: true, loan: updatedLoan });
}
