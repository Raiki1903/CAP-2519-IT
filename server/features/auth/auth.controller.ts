/**
 * Auth controller: unpacks login, profile, account, and sign-up requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by auth.routes.ts. Calls auth.validation.ts, auth.service.ts, and shared/middleware/requireAuth.ts
 * (sessionUserOf: who is acting).
 * Used by: login and logout for every role, the session reload, the account page, self-registration, and the Lab Head's sign-up approvals.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as authService from './auth.service';
import { clearedSessionCookieHeader, readCookie, SESSION_COOKIE_NAME, sessionCookieHeader } from '../../shared/services/session';
import { checkAccountUpdate, checkLogin, checkRegistrationRequest } from './auth.validation';
import { sessionUserOf } from '../../shared/middleware/requireAuth';

// Each handler reads req.body in one destructuring statement. A request with no JSON body (Express 5 leaves
// req.body undefined) therefore throws a TypeError there, which errorHandler answers with its generic 500.
// TODO: a missing body should answer 400, not 500. A body check, its own small fix (not part of step 13a).

/**
 * Handles GET /api/auth/pending-registrations: `{ success, pendingRegistrations }`, newest first, without passwords (C-04).
 * It has no error handling of its own, as before: it reads only the in-memory list.
 */
export async function listPendingRegistrations(req: Request, res: Response): Promise<void> {
    res.json({ success: true, pendingRegistrations: authService.listPendingRegistrations() });
}

/**
 * Handles POST /api/auth/register-request: files a sign-up request for a Lab Head to approve. A `requestedRole` in the
 * body is not read: every request is for a Custodian (C-05 family).
 * Answers `{ success, registration }` with the stored request without its password (C-04),
 * or the AppError's status and message (400 missing field; 409 email or id number taken by an account or by a
 * request still waiting), or 500.
 */
export async function requestRegistration(req: Request, res: Response): Promise<void> {
    const { firstName, lastName, email, idNumber, userType, labAffiliation, password, avatarUrl } = req.body;
    const data = { firstName, lastName, email, idNumber, userType, labAffiliation, password, avatarUrl };

    checkRegistrationRequest(data);
    const newReq = await authService.requestRegistration(data);

    console.log(`📝 Registration request created for ${email} (Pending Lab Head Approval). ID: ${newReq.id}`);

    res.json({ success: true, registration: newReq });
}

/**
 * Handles POST /api/auth/approve-registration: creates the account a sign-up request asked for.
 * Only `requestId` is read: the account comes from the stored request, never from the body. (C-05)
 * Answers `{ success, user, message }` with the new account's id, names, and email only (01C 4.1),
 * 404 when the request id matches no pending request, 409 when an account has its email or id number by now, or 500.
 */
export async function approveRegistration(req: Request, res: Response): Promise<void> {
    const { requestId } = req.body;

    const createdUser = await authService.approveRegistration({ requestId });

    console.log(`✅ Lab Head Approved User Registration! Created user in MySQL DB: ID ${createdUser.userId} (${createdUser.email})`);
    res.json({ success: true, user: createdUser, message: `Account approved and created in database for ${createdUser.email}.` });
}

/**
 * Handles POST /api/auth/login: checks an email and password, and starts a session.
 * Answers `{ success, role, user }` with the app role and the profile, plus a Set-Cookie header with the signed
 * adric_session cookie (8 hours, HttpOnly); or the AppError's status and message (400 missing email or password,
 * 401 no match, no cookie), or 500.
 */
export async function login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    checkLogin({ email, password });
    const { role, user } = await authService.login(email, password);

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
 * Handles POST /api/auth/reject-registration: drops a sign-up request.
 * Answers 200 even for an id no request has, or errorHandler's generic 500. Prints no line of its own.
 */
export async function rejectRegistration(req: Request, res: Response): Promise<void> {
    const { requestId } = req.body;
    authService.rejectRegistration(requestId);
    res.json({ success: true, message: "Registration request rejected." });
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

    console.log(`👤 Updated user credentials in MySQL DB: ${updatedUser.email} -> ${firstName} ${lastName} [img length: ${updatedUser.user_img ? updatedUser.user_img.length : 0}]`);
    res.json({
        success: true,
        user
    });
}
