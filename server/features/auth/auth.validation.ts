import type { AccountUpdateInput, LoginInput, RegisterInput, RegistrationRequestInput } from '@shared/types/auth';
import { AppError } from '../../shared/errors/AppError';

/** Checks that a direct registration has names, email, password, and id number. */
export function checkRegistration(data: any): asserts data is RegisterInput {
    if (!data.firstName || !data.lastName || !data.email || !data.password || !data.idNumber) {
        throw new AppError(400, "Missing required registration fields.");
    }
}

/** Checks that a sign-up request has names, email, and id number. */
export function checkRegistrationRequest(data: any): asserts data is RegistrationRequestInput {
    if (!data.firstName || !data.lastName || !data.email || !data.idNumber) {
        throw new AppError(400, "Missing required registration fields.");
    }
}

/** Checks that a login has an email and a password. */
export function checkLogin(data: any): asserts data is LoginInput {
    if (!data.email || !data.password) {
        throw new AppError(400, "Please enter your email and password.");
    }
}

/** Checks that the profile request names an email. */
export function checkProfileQuery(email: string): void {
    if (!email) {
        throw new AppError(400, "Email query param required.");
    }
}

/** Checks that an account update has an email, a first name, and a last name. */
export function checkAccountUpdate(data: any): asserts data is AccountUpdateInput {
    if (!data.email || !data.firstName || !data.lastName) {
        throw new AppError(400, "Email, firstName, and lastName are required.");
    }
}
