import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';

export const SERVER_ERROR_MESSAGE = "Something went wrong on the server. Please try again.";
export const BAD_REQUEST_MESSAGE = "The request body could not be read.";

function statusOf(err: unknown): number | undefined {
    const status = (err as any)?.status ?? (err as any)?.statusCode;
    return typeof status === 'number' ? status : undefined;
}

function isClientStatus(status: number | undefined): boolean {
    return status !== undefined && status >= 400 && status < 500;
}

// body-parser (behind express.json and express.urlencoded) tags each of its errors with a type,
// such as 'entity.parse.failed' (400) or 'entity.too.large' (413).
function isBodyReadError(err: unknown): boolean {
    return typeof (err as any)?.type === 'string' && isClientStatus(statusOf(err));
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
    // The answer is already on its way, so it cannot be replaced; Express closes the connection.
    if (res.headersSent) {
        next(err);
        return;
    }

    if (err instanceof AppError) {
        res.status(err.status).json({ success: false, error: err.message });
        return;
    }

    if (isBodyReadError(err)) {
        // Only the type and message: a body that failed to parse can hold a password.
        console.error(`⚠️ ${req.method} ${req.originalUrl}: request body could not be read (${(err as any).type}): ${(err as Error).message}`);
        res.status(statusOf(err)!).json({ success: false, error: BAD_REQUEST_MESSAGE, code: 'BAD_REQUEST' });
        return;
    }

    // Express's own client errors, such as a path parameter that cannot be decoded (400), keep Express's answer.
    if (isClientStatus(statusOf(err))) {
        next(err);
        return;
    }

    console.error(`❌ ${req.method} ${req.originalUrl} failed:`, err);
    res.status(500).json({ success: false, error: SERVER_ERROR_MESSAGE, code: 'SERVER_ERROR' });
}
