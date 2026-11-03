/**
 * Auth request checks: is each sign-up, login, profile, and account request shaped correctly, before any database work.
 * Layer: validation. Called by auth.controller.ts. Calls shared/errors/AppError.ts, shared/constants/passwords.ts, and
 * shared/constants/signUp.ts.
 * Used by: login, self-registration, the session reload, and the account page.
 */
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@shared/constants/passwords';
import { ID_NUMBER_MESSAGE, ID_NUMBER_PATTERN, NO_LAB_MESSAGE, SIGN_UP_EMAIL_DOMAIN, SIGN_UP_EMAIL_MESSAGE, USER_TYPES, type UserType } from '@shared/constants/signUp';
import type { AccountUpdateInput, LoginInput, SignUpRequest } from '@shared/types/auth';
import { AppError } from '../../shared/errors/AppError';

/**
 * Reads a sign-up body: names, a DLSU email, an 8-digit ID number, a user type, a password of an allowed length, and
 * at least one lab. Whether each lab exists is checked by the service, which needs the database.
 *
 * @param body the request body
 * @returns the sign-up with the names trimmed, the email trimmed and in lower case, the ID number as a number, and each lab once
 * @throws AppError 400 with a plain message for the first field that is missing or wrong
 */
export function readSignUpRequest(body: any): SignUpRequest {
    const { firstName, lastName, email, idNumber, userType, password, centerIds, avatarUrl } = body ?? {};

    if (!isFilled(firstName) || !isFilled(lastName) || !isFilled(email) || (typeof idNumber !== 'number' && !isFilled(idNumber))) {
        throw new AppError(400, "Missing required registration fields.");
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith(SIGN_UP_EMAIL_DOMAIN) || normalizedEmail.length === SIGN_UP_EMAIL_DOMAIN.length) {
        throw new AppError(400, SIGN_UP_EMAIL_MESSAGE);
    }
    const idText = String(idNumber).trim();
    if (!ID_NUMBER_PATTERN.test(idText)) {
        throw new AppError(400, ID_NUMBER_MESSAGE);
    }
    if (!USER_TYPES.includes(userType)) {
        throw new AppError(400, "Choose Student, Faculty, or Staff as your user type.");
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        throw new AppError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
        throw new AppError(400, `Password must be at most ${MAX_PASSWORD_LENGTH} characters long.`);
    }
    if (!Array.isArray(centerIds) || centerIds.length === 0 || !centerIds.every(id => Number.isInteger(id) && id > 0)) {
        throw new AppError(400, NO_LAB_MESSAGE);
    }

    return {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        idNumber: Number(idText),
        userType: userType as UserType,
        password,
        centerIds: [...new Set<number>(centerIds)],
        avatarUrl: typeof avatarUrl === 'string' && avatarUrl ? avatarUrl : undefined,
    };
}

/** Whether a value is a string with something besides spaces in it. */
function isFilled(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== '';
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
 * Checks that an account update has a first name and a last name, and no lab. The picture is optional.
 * The account is the session user's, so no email is needed. (C-06)
 * The lab cannot be changed here: a Lab Head who moved to another lab would decide that lab's requests. (issue #73)
 *
 * @param data the fields read from the body
 * @throws AppError 400 if either name is missing or empty, or if a lab is sent (an empty one counts as none)
 */
export function checkAccountUpdate(data: any): asserts data is AccountUpdateInput {
    if (!data.firstName || !data.lastName) {
        throw new AppError(400, "firstName and lastName are required.");
    }
    if (data.labAffiliation !== undefined && data.labAffiliation !== null && data.labAffiliation !== "") {
        throw new AppError(400, "Your lab can't be changed here.");
    }
}
