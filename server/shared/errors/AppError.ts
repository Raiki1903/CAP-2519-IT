/**
 * An error that carries the HTTP status it should be answered with.
 * Layer: shared (server errors). Thrown by the validation and service files of features/loans, returns, transfers, disposals,
 * repairs, inspections, auth, and assets, and by shared/middleware/requireAuth.ts and requireRole.ts; answered by
 * shared/middleware/errorHandler.ts. Imports nothing.
 * Used by: every workflow those eight features serve (borrow, return, transfer, disposal, repair, inspection, their decisions,
 * login, sign-ups, the account page, and the asset registry), and every route that needs a session or a role.
 */

/**
 * A refusal meant for the user: a 400, 401 (no valid session), 403 (another role), 404, or 409, whose message the screen shows.
 * Services throw it instead of writing a response, so they know nothing about HTTP; the controllers do not catch it,
 * and errorHandler answers `{ success: false, error: message }` with this status.
 * Any other error is unexpected: errorHandler logs it and answers a generic 500.
 */
export class AppError extends Error {
    /** The HTTP status to answer with, for example 404. */
    readonly status: number;

    /**
     * @param status the HTTP status to answer with
     * @param message the text sent as `error`, shown to the user
     */
    constructor(status: number, message: string) {
        super(message);
        this.name = 'AppError';
        this.status = status;
    }
}
