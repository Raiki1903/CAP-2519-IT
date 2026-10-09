/**
 * An error that carries the HTTP status it should be answered with.
 * Layer: shared (server errors). Thrown by features/loans (validation and service), caught by loans.controller.ts. Imports nothing.
 * Used by: Custodian borrow request, Lab Head approval (loans is the only feature that throws it so far).
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
