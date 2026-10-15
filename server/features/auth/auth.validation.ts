/**
 * Auth request checks: is each sign-up, login, profile, and account request shaped correctly, before any database work.
 * Layer: validation. Called by auth.controller.ts. Calls shared/errors/AppError.ts.
 * Used by: login, self-registration, the session reload, and the account page.
 */
import type { AccountUpdateInput, LoginInput, RegisterInput, RegistrationRequestInput } from '@shared/types/auth';
import { AppError } from '../../shared/errors/AppError';

/**
 * Checks that a direct registration has names, email, password, and id number.
 * Only presence is checked; the service looks for duplicates.
 *
 * @param data the fields read from the body
 * @throws AppError 400 if any of the five is missing or empty
 */
export function checkRegistration(data: any): asserts data is RegisterInput {
    if (!data.firstName || !data.lastName || !data.email || !data.password || !data.idNumber) {
        throw new AppError(400, "Missing required registration fields.");
    }
}

/**
 * Checks that a sign-up request has names, email, and id number.
 * The password is not required: the service stores a default when it is missing. (C-03)
 *
 * @param data the fields read from the body
 * @throws AppError 400 if any of the four is missing or empty
 */
export function checkRegistrationRequest(data: any): asserts data is RegistrationRequestInput {
    if (!data.firstName || !data.lastName || !data.email || !data.idNumber) {
        throw new AppError(400, "Missing required registration fields.");
    }
}

/**
 * Checks that a login has an email and a password.
 *
 * @param data the email and password read from the body
 * @throws AppError 400 if either is missing or empty
 */
export function checkLogin(data: any): asserts data is LoginInput {
    if (!data.email || !data.password) {
        throw new AppError(400, "Please enter your email and password.");
    }
}

/**
 * Checks that an account update has an email, a first name, and a last name.
 * The picture and the lab are optional.
 *
 * @param data the fields read from the body
 * @throws AppError 400 if any of the three is missing or empty
 */
export function checkAccountUpdate(data: any): asserts data is AccountUpdateInput {
    if (!data.email || !data.firstName || !data.lastName) {
        throw new AppError(400, "Email, firstName, and lastName are required.");
    }
}
