import type { Request, Response } from 'express';
import * as loansService from './loans.service';
import { checkLoanDecision, checkLoanRequest } from './loans.validation';
import { AppError } from '../../shared/errors/AppError';

export async function listLoans(req: Request, res: Response): Promise<void> {
    try {
        const loans = await loansService.listLoans();
        res.json({ success: true, loans });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
}

export async function requestLoan(req: Request<{ assetTag: string }>, res: Response): Promise<void> {
    try {
        const { assetTag } = req.params;
        const data = req.body;
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

export async function decideLoan(req: Request<{ loanId: string }>, res: Response): Promise<void> {
    try {
        const loanId = parseInt(req.params.loanId, 10);
        const { decision } = req.body as { decision?: string };
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
