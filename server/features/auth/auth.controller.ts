/**
 * Auth controller: unpacks login, profile, account, and sign-up requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by auth.routes.ts. Calls auth.validation.ts, auth.service.ts, and shared/middleware/requireAuth.ts
 * (sessionUserOf: who is acting).
 * Used by: login and logout for every role, the session reload, the account page, and self-registration.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as authService from './auth.service';
import { clearedSessionCookieHeader, readCookie, SESSION_COOKIE_NAME, sessionCookieHeader } from '../../shared/services/session';
import { checkAccountUpdate, checkLogin, readSignUpRequest } from './auth.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

// Each handler reads req.body in one destructuring statement. A request with no JSON body (Express 5 leaves
// req.body undefined) therefore throws a TypeError there, which errorHandler answers with its generic 500.
// TODO: a missing body should answer 400, not 500. A body check, its own small fix (not part of step 13a).

/**
 * Handles POST /api/auth/register-request: stores a sign-up as a Pending account with its requested labs, for the IT
 * Admin to approve. A role in the body is not read: the IT Admin picks it on approval.
 * Answers 201 `{ success, message }`, or the AppError's status and message (400 a missing or wrong field, or a lab that
 * does not exist; 409 email or ID number taken), or 500.
 */
export async function requestRegistration(req: Request, res: Response): Promise<void> {
    const data = readSignUpRequest(req.body);
    const userId = await authService.requestRegistration(data);

    console.log(`Sign-up filed: user ${userId} is pending`);
    res.status(201).json({ success: true, message: authService.SIGN_UP_SENT_MESSAGE });
}

/**
 * Handles POST /api/auth/login: checks an email and password, and starts a session.
 * Answers `{ success, role, user }` with the app role and the profile, plus a Set-Cookie header with the signed
 * adric_session cookie (8 hours, HttpOnly); or the AppError's status and message (400 missing email or password,
 * 401 no match, 403 an account that is not Active, 429 too many failed logins; no cookie), or 500.
 */
export async function login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    checkLogin({ email, password });
    const { role, user } = await authService.login(email, password, req.ip);

    res.setHeader('Set-Cookie', sessionCookieHeader(authService.startSession(user.userId)));
    res.json({
        success: true,
        role,
        user
    });
}

/**
 * Handles POST /api/auth/logout, a public route: refuses the request's session cookie from now until it would have
 * expired, and tells the browser to delete it. Answers `{ success: true }` with or without a cookie, so it never fails.
 */
export async function logout(req: Request, res: Response): Promise<void> {
    authService.endSession(readCookie(req.headers.cookie, SESSION_COOKIE_NAME));
    res.setHeader('Set-Cookie', clearedSessionCookieHeader());
    res.json({ success: true });
}

/**
 * Handles GET /api/auth/me: the profile and app role of the session's own account. An `email` in the query,
 * which older pages still send, is ignored, so no one can read another account's profile. (C-06)
 * Answers `{ success, user }`, or 404 if the account no longer exists, or 500.
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
    const user = await authService.getProfile(sessionUserOf(req).userId);

    res.json({
        success: true,
        user
    });
}

/**
 * Handles PUT /api/auth/account: saves the name and picture of the session's own account. An `email` in the
 * body, which older pages still send, is ignored, so no one can change another account (C-06); a `labAffiliation` is
 * refused, so no one can move to another lab (issue #73).
 * Answers `{ success, user }` with the account's own lab, or the AppError's status and message (400 missing name or a
 * lab sent, 404 account gone), or 500.
 */
export async function updateAccount(req: Request, res: Response): Promise<void> {
    const { firstName, lastName, labAffiliation, avatarUrl, userImg, profilePicture } = req.body;
    const data = { firstName, lastName, labAffiliation, avatarUrl, userImg, profilePicture };

    checkAccountUpdate(data);
    const { updatedUser, user } = await authService.updateAccount(sessionUserOf(req).userId, data);

    console.log(`Account ${updatedUser.user_id} updated its profile`);
    res.json({
        success: true,
        user
    });
}
