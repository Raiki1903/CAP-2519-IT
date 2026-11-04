/**
 * Loan controller: unpacks loan requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by loans.routes.ts. Calls loans.validation.ts, loans.service.ts, and shared/middleware/requireAuth.ts
 * (sessionUserOf: who is acting).
 * Used by: Researcher loan requests and return requests, Lab Head approval, TSG release and receipt, and the screens
 * that list loans.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as loansService from './loans.service';
import { readDecisionRemarks, readLoanId, readLoanRequest, readReceiveBody, readReleaseBody, readReturnRequest } from './loans.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

/**
 * Handles GET /api/loans: every loan, newest first, in today's list shape, as `{ success, loans }`. A Custodian gets
 * no name but their own (D2). A failure answers errorHandler's generic 500.
 */
export async function listLoans(req: Request, res: Response): Promise<void> {
    const loans = await loansService.listLoans(sessionUserOf(req));
    res.json({ success: true, loans });
}

/**
 * Handles POST /api/assets/:assetTag/loans: files a loan request for the session user.
 * Answers 201 `{ success, loan }` in the Loan shape, or the AppError's status and message (400, 403, 404, 409), or 500.
 */
export async function requestLoan(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    const data = readLoanRequest(req.body);
    const borrower = sessionUserOf(req);
    const loan = await loansService.requestLoan(req.params.assetTag, data, borrower);

    console.log(`Loan ${loan.loanId} requested by user ${borrower.userId}`);
    res.status(201).json({ success: true, loan });
}

/**
 * Handles PUT /api/loans/:loanId/cancel: the borrower cancels a request still waiting for approval or release.
 * Answers `{ success, loan }`, or the AppError's status and message (400 bad id, 403, 404, 409), or 500.
 */
export async function cancelLoan(req: Request<{ loanId: string }>, res: Response): Promise<void> {
    const loanId = readLoanId(req.params.loanId);
    const actor = sessionUserOf(req);
    const loan = await loansService.cancelLoan(loanId, actor);

    console.log(`Loan ${loanId} cancelled by user ${actor.userId}`);
    res.json({ success: true, loan });
}

/**
 * Handles PUT /api/loans/:loanId/approve: the Head of the asset's home lab approves; the loan waits for TSG's release.
 * Answers `{ success, loan }`, or the AppError's status and message (400, 403, 404, 409), or 500.
 */
export async function approveLoan(req: Request<{ loanId: string }>, res: Response): Promise<void> {
    const loanId = readLoanId(req.params.loanId);
    const remarks = readDecisionRemarks(req.body, false);
    const decider = sessionUserOf(req);
    const loan = await loansService.approveLoan(loanId, remarks, decider);

    console.log(`Loan ${loanId} approved by user ${decider.userId}`);
    res.json({ success: true, loan });
}

/**
 * Handles PUT /api/loans/:loanId/decline: the Head of the asset's home lab declines, with remarks.
 * Answers `{ success, loan }`, or the AppError's status and message (400 no remarks, 403, 404, 409), or 500.
 */
export async function declineLoan(req: Request<{ loanId: string }>, res: Response): Promise<void> {
    const loanId = readLoanId(req.params.loanId);
    const remarks = readDecisionRemarks(req.body, true)!;
    const decider = sessionUserOf(req);
    const loan = await loansService.declineLoan(loanId, remarks, decider);

    console.log(`Loan ${loanId} declined by user ${decider.userId}`);
    res.json({ success: true, loan });
}

/**
 * Handles PUT /api/loans/:loanId/release: TSG releases an approved loan with a Loan Release inspection.
 * Answers `{ success, loan }`, or the AppError's status and message (400, 403, 404, 409), or 500.
 */
export async function releaseLoan(req: Request<{ loanId: string }>, res: Response): Promise<void> {
    const loanId = readLoanId(req.params.loanId);
    const inspection = readReleaseBody(req.body);
    const releaser = sessionUserOf(req);
    const loan = await loansService.releaseLoan(loanId, inspection, releaser);

    console.log(`Loan ${loanId} released by user ${releaser.userId}`);
    res.json({ success: true, loan });
}

/**
 * Handles PUT /api/loans/:loanId/return-request: the borrower asks to return an asset they hold.
 * Answers `{ success, loan }`, or the AppError's status and message (400, 403, 404, 409), or 500.
 */
export async function requestReturn(req: Request<{ loanId: string }>, res: Response): Promise<void> {
    const loanId = readLoanId(req.params.loanId);
    const remarks = readReturnRequest(req.body);
    const actor = sessionUserOf(req);
    const loan = await loansService.requestReturn(loanId, remarks, actor);

    console.log(`Loan ${loanId} return requested by user ${actor.userId}`);
    res.json({ success: true, loan });
}

/**
 * Handles PUT /api/loans/:loanId/receive: TSG receives the asset back with a Return inspection, and opens a Return
 * Damage ticket when damage is reported.
 * Answers `{ success, loan }`, plus `maintenance` when a ticket was opened, or the AppError's status and message
 * (400, 403, 404, 409), or 500.
 */
export async function receiveReturn(req: Request<{ loanId: string }>, res: Response): Promise<void> {
    const loanId = readLoanId(req.params.loanId);
    const { inspection, returnDamage } = readReceiveBody(req.body);
    const receiver = sessionUserOf(req);
    const { loan, maintenance } = await loansService.receiveReturn(loanId, inspection, returnDamage, receiver);

    console.log(maintenance
        ? `Loan ${loanId} received by user ${receiver.userId}, with maintenance ${maintenance.repairId}`
        : `Loan ${loanId} received by user ${receiver.userId}`);
    res.json({ success: true, loan, ...(maintenance ? { maintenance } : {}) });
}
