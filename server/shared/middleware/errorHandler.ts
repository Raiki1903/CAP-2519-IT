/**
 * Error handler: the one place that turns a failed request into its answer. (H-16)
 * Layer: shared (server middleware). Mounted last by server/app.ts; Express calls it with the error of any controller
 * (a thrown error or a rejected promise), body parser, or router. Calls shared/errors/AppError.ts and the console.
 * Used by: every request to the API that fails.
 */
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';

/** The `error` text of every 500 answer. Written for the user: it names no table, file, or query. */
export const SERVER_ERROR_MESSAGE = "Something went wrong on the server. Please try again.";
/** The `error` text when the request body could not be read (malformed JSON, too large, unsupported charset). */
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

/**
 * Answers a failed request, in this order:
 * an AppError answers its own status with `{ success: false, error: message }`;
 * a body the parsers could not read keeps its status (400, 413, or 415) and answers `{ success: false, error, code: "BAD_REQUEST" }`;
 * Express's own client errors, such as an undecodable path parameter (400), keep Express's answer;
 * anything else is logged in full (method, URL, the error with its stack) and answers 500 with
 * `{ success: false, error: SERVER_ERROR_MESSAGE, code: "SERVER_ERROR" }`, so no database text, stack, or path reaches the browser.
 * Unknown paths never reach it: they keep Express's own 404.
 *
 * @param err what the controller threw or the promise rejected with, or the body parser's error
 * @param next used only to hand back to Express the errors it answers itself
 */
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
