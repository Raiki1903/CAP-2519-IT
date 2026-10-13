/**
 * Auth controller: unpacks login, profile, account, and sign-up requests, calls the service, and writes the JSON answers.
 * Layer: controller. Called by auth.routes.ts. Calls auth.validation.ts and auth.service.ts.
 * Used by: login for every role, the session reload, the account page, self-registration, and the Lab Head's sign-up approvals.
 * Errors are not caught here: an AppError or any other failure falls through to shared/middleware/errorHandler.ts,
 * which writes the answer (the AppError's status and message, or a generic 500 with the detail logged on the server).
 */
import type { Request, Response } from 'express';
import * as authService from './auth.service';
import { checkAccountUpdate, checkLogin, checkProfileQuery, checkRegistration, checkRegistrationRequest } from './auth.validation';

// Each handler reads req.body in one destructuring statement. A request with no JSON body (Express 5 leaves
// req.body undefined) therefore throws a TypeError there, which errorHandler answers with its generic 500.
// TODO: a missing body should answer 400, not 500. A body check, its own small fix (not part of step 13a).

/**
 * Handles POST /api/auth/register: creates a Custodian account directly, with no approval step. No screen calls it (deleting it is issue #70).
 * Answers `{ success, user }` with the new account's id, names, and email, or the AppError's status and message
 * (400 missing field, email taken, or id number taken), or 500.
 */
export async function register(req: Request, res: Response): Promise<void> {
    const { firstName, lastName, email, password, idNumber, userType, centerId } = req.body;
    const data = { firstName, lastName, email, password, idNumber, userType, centerId };

    checkRegistration(data);
    const user = await authService.register(data);

    res.json({ success: true, user });
}

/**
 * Handles GET /api/auth/pending-registrations: `{ success, pendingRegistrations }`, newest first.
 * It has no error handling of its own, as before: it reads only the in-memory list.
 */
// TODO(C-04): each request is sent with its password, to anyone who asks (issue #72). Step 13 (requireAuth) and Phase 3 (the table, H-17).
export async function listPendingRegistrations(req: Request, res: Response): Promise<void> {
    res.json({ success: true, pendingRegistrations: authService.listPendingRegistrations() });
}

/**
 * Handles POST /api/auth/register-request: files a sign-up request for a Lab Head to approve.
 * Answers `{ success, registration }` with the stored request, password included (01C 4.1, issue #72),
 * or the AppError's status and message (400 missing field, email taken, or id number taken), or 500.
 */
export async function requestRegistration(req: Request, res: Response): Promise<void> {
    const { firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, password, avatarUrl } = req.body;
    const data = { firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, password, avatarUrl };

    checkRegistrationRequest(data);
    const newReq = await authService.requestRegistration(data);

    console.log(`📝 Registration request created for ${email} (Pending Lab Head Approval). ID: ${newReq.id}`);

    res.json({ success: true, registration: newReq });
}

/**
 * Handles POST /api/auth/approve-registration: creates the account a sign-up request asked for.
 * Answers `{ success, user, message }` with the whole new users row, password included (01C 4.1, issue #72),
 * 404 when neither the request id nor the body describes an account, or 500 (for example an email already taken).
 */
export async function approveRegistration(req: Request, res: Response): Promise<void> {
    const { requestId, firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, password } = req.body;

    const createdUser = await authService.approveRegistration({ requestId, firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, password });

    console.log(`✅ Lab Head Approved User Registration! Created user in MySQL DB: ID ${createdUser.user_id} (${createdUser.email})`);
    res.json({ success: true, user: createdUser, message: `Account approved and created in database for ${createdUser.email}.` });
}

/**
 * Handles POST /api/auth/login: checks an email and password.
 * Answers `{ success, role, user }` with the app role and the profile, or the AppError's status and message
 * (400 missing email or password, 401 no match), or 500.
 */
// TODO(C-06): the answer is the whole session; the browser keeps only the email, in an unsigned cookie. Session issuing, step 13.
export async function login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    checkLogin({ email, password });
    const { role, user } = await authService.login(email, password);

    res.json({
        success: true,
        role,
        user
    });
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
 * Handles GET /api/auth/me?email=...: the profile and app role of the account with that email.
 * Answers `{ success, user }`, or the AppError's status and message (400 no email, 404 no account), or 500.
 */
// TODO(C-06): any email works; nothing checks that the caller is that person. Step 13 (the session user).
export async function getProfile(req: Request, res: Response): Promise<void> {
    const email = req.query.email as string;

    checkProfileQuery(email);
    const user = await authService.getProfile(email);

    res.json({
        success: true,
        user
    });
}

/**
 * Handles PUT /api/auth/account: saves the name, picture, and lab of the account the body's email names.
 * Answers `{ success, user }`, or the AppError's status and message (400 missing field, 404 no account), or 500.
 */
// TODO(C-06): the account is chosen by the email in the body, so anyone can rename anyone (C-02). Step 13 (the session user).
export async function updateAccount(req: Request, res: Response): Promise<void> {
    const { email, firstName, lastName, labAffiliation, avatarUrl, userImg, profilePicture } = req.body;
    const data = { email, firstName, lastName, labAffiliation, avatarUrl, userImg, profilePicture };

    checkAccountUpdate(data);
    const { updatedUser, user } = await authService.updateAccount(data);

    console.log(`👤 Updated user credentials in MySQL DB: ${updatedUser.email} -> ${firstName} ${lastName} (${labAffiliation}) [img length: ${updatedUser.user_img ? updatedUser.user_img.length : 0}]`);
    res.json({
        success: true,
        user
    });
}
