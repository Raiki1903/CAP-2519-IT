/**
 * An error that carries the HTTP status it should be answered with.
 * Layer: shared (server errors). Thrown by the validation and service files of features/loans, returns, transfers, disposals,
 * repairs, and inspections; caught by each of those features' controllers. Imports nothing.
 * Used by: every workflow those six features serve (borrow, return, transfer, disposal, repair, inspection, and their decisions).
 */

/**
 * A refusal meant for the user: a 400, 404, or 409 whose message the screen shows.
 * Services throw it instead of writing a response, so they know nothing about HTTP;
 * the controller answers `{ success: false, error: message }` with this status.
 * Any other error is unexpected, and the controller answers 500.
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
