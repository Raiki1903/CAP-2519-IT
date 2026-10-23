/**
 * Auth service: the rules for logging in and out, the session's profile and app role, account updates, and sign-ups.
 * Layer: service. Called by auth.controller.ts and shared/middleware/requireAuth.ts. Calls auth.repository.ts,
 * shared/services/session.ts, and config/env.ts (the session secret).
 * Used by: login for every role, the session reload, the account page, self-registration, and the Lab Head's sign-up approvals.
 */
import type { roles, user_roles, users } from '@prisma/client';
import type { Role, StaffUnit } from '@shared/enums/role';
import type {
    AccountUpdateInput,
    AccountUser,
    ApproveRegistrationInput,
    ApprovedUser,
    LoginUser,
    PendingRegistration,
    PendingRegistrationView,
    ProfileUser,
    RegistrationRequestInput,
    SessionIdentity,
} from '@shared/types/auth';
import * as authRepository from './auth.repository';
import { AppError } from '../../shared/errors/AppError';
import { env } from '../../config/env';
import { createSessionToken, isLoggedOut, markLoggedOut, verifySessionToken } from '../../shared/services/session';
import { forgetIdentity, recallIdentity, rememberIdentity } from '../../shared/services/sessionCache';

/**
 * Refuses an email or an id number that already belongs to an account. (issue #14)
 *
 * @param email the email to check; the database compares it in any letter case
 * @param idNumber the id number to check
 * @throws AppError 409 with the text the sign-up page shows (UAT EV-05)
 */
async function refuseTakenByAccount(email: string, idNumber: number): Promise<void> {
    if (await authRepository.findUserByEmail(email)) {
        throw new AppError(409, "A registered user with this email already exists.");
    }
    if (await authRepository.findUserByIdNumber(idNumber)) {
        throw new AppError(409, "A registered user with this ID number already exists.");
    }
}

/** A stored sign-up request without its password, for an answer. (C-04) */
function withoutPassword(request: PendingRegistration): PendingRegistrationView {
    const { password, ...view } = request;
    return view;
}

/**
 * The sign-up requests still waiting for a decision, newest first.
 *
 * @returns the PENDING requests, without their passwords (C-04)
 */
export function listPendingRegistrations(): PendingRegistrationView[] {
    return authRepository.listPendingRegistrations().filter(r => r.status === "PENDING").map(withoutPassword);
}

/**
 * Files a sign-up request for a Lab Head to approve. Nothing is written to the database:
 * the request is kept in memory and in pending_registrations.json until it is approved or rejected. (H-17)
 *
 * Every request asks for the Custodian role: a role in the body is ignored, since this route is public. (C-05 family)
 *
 * @param data the checked body: names, email, id number, and the optional user type, lab, password, and picture
 * @returns the stored request, with its REG- id, without its password (C-04)
 * @throws AppError 409 if the email or the id number already belongs to an account, or to a request still waiting (issues #14, #81)
 */
export async function requestRegistration(data: RegistrationRequestInput): Promise<PendingRegistrationView> {
    const { firstName, lastName, email, idNumber, userType, labAffiliation, password, avatarUrl } = data;

    await refuseTakenByAccount(email, Number(idNumber));

    const sameEmail = (r: PendingRegistrationView) => String(r.email).trim().toLowerCase() === String(email).trim().toLowerCase();
    const waiting = listPendingRegistrations();
    if (waiting.some(sameEmail)) {
        throw new AppError(409, "A sign-up request with this email is already waiting for approval.");
    }
    if (waiting.some(r => r.idNumber === Number(idNumber))) {
        throw new AppError(409, "A sign-up request with this ID number is already waiting for approval.");
    }

    const newReq: PendingRegistration = {
        // A random six-digit number: two requests can draw the same id, and approving or rejecting one then drops both.
        id: `REG-${Math.floor(100000 + Math.random() * 900000)}`,
        firstName,
        lastName,
        email,
        idNumber: Number(idNumber),
        userType: userType || "STUDENT",
        requestedRole: "Custodian",
        labAffiliation: labAffiliation || "CITe4D",
        // TODO(C-03): a request without a password gets "password123", stored as plain text (issue #10). Phase 3.
        password: password || "password123",
        avatarUrl,
        submittedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        status: "PENDING"
    };

    authRepository.addPendingRegistration(newReq);
    return withoutPassword(newReq);
}

/**
 * Approves a sign-up request: creates a Custodian account with its lab, then drops the request.
 * The account is built from the stored request only (C-05), and is always a Custodian, whatever role the request
 * names: the sign-up page only asks for Custodian, and the sign-up route is public. (C-05 family)
 * The lab is matched by name or short code; "No affiliation" and "Not Affiliated" link no lab.
 *
 * @param data `requestId`, the REG- id the server gave the request
 * @returns the new account's id, names, and email (no password or id number: 01C 4.1)
 * @throws AppError 400 if the request's lab matches no research center; nothing is created and the request is kept (issue #73)
 * @throws AppError 404 if the id matches no pending request
 * @throws AppError 409 if an account has the request's email or id number by now; the request is kept (issue #14)
 */
export async function approveRegistration(data: ApproveRegistrationInput): Promise<ApprovedUser> {
    const { requestId } = data;
    const targetReq = authRepository.findPendingRegistration(requestId);

    if (!targetReq) {
        throw new AppError(404, "Pending registration request details not found.");
    }

    // Checked again here: a request filed before the duplicate checks, or an account created since, would otherwise
    // fail inside the database with a 500.
    await refuseTakenByAccount(targetReq.email, targetReq.idNumber);

    // The request's requestedRole is never read: an older request in the file can still name another role.
    const roleRecord = await authRepository.findRoleByName("CUSTODIAN");

    let centerRecord = null;
    if (targetReq.labAffiliation && targetReq.labAffiliation !== "Not Affiliated" && targetReq.labAffiliation !== "No affiliation") {
        // The form sends a full lab name such as "Center for ... (CeLT)"; the code in brackets is tried as a short code.
        const labName = targetReq.labAffiliation.trim();
        const match = labName.match(/\(([^)]+)\)/);
        const extractedCode = match ? match[1].trim() : labName;

        centerRecord = await authRepository.findResearchCenterForLab(labName, extractedCode);

        // A lab that matches nothing (a typo, or a lab with no research center) is refused, never created. The request
        // stays in the list, so the Lab Head can decline it. (issue #73, M-03)
        if (!centerRecord) {
            throw new AppError(400, `The lab on this request, ${labName}, is not a known lab. Decline it and ask the applicant to sign up again.`);
        }
    }

    const createdUser = await authRepository.createUser(
        {
            first_name: targetReq.firstName,
            last_name: targetReq.lastName,
            email: targetReq.email,
            password: targetReq.password || "password123",
            id_number: targetReq.idNumber,
            user_type: targetReq.userType || "STUDENT",
            user_img: targetReq.avatarUrl ? String(targetReq.avatarUrl) : null
        },
        roleRecord ? roleRecord.role_id : null,
        centerRecord ? centerRecord.center_id : null,
    );

    targetReq.status = "APPROVED";
    authRepository.removePendingRegistration(requestId);

    return { userId: createdUser.user_id, firstName: createdUser.first_name, lastName: createdUser.last_name, email: createdUser.email };
}

/**
 * Drops a sign-up request without creating an account. An unknown id changes nothing.
 *
 * @param requestId the REG- id
 */
export function rejectRegistration(requestId: string): void {
    authRepository.removePendingRegistration(requestId);
}

/**
 * Maps a user's database roles to the app role and Staff unit, for login, /me, and every session check (requireRole).
 * The checks run in a fixed order and the first match wins, so an account with several roles gets only one.
 *
 * @param roles the user's user_roles rows, each with its roles row
 * @returns the app role ("Staff", "AdRICDirector", "LabHead", or "Custodian") and, for Staff, the unit
 */
// TODO(M-11): ADRIC_SECRETARY maps to Staff (ITS); the team decided it gets the Director view, on the ITS removal branch.
function appRoleFor(roles: (user_roles & { roles: roles })[]): { role: string; staffUnit: StaffUnit | null } {
    let determinedRole = "Custodian";
    let staffUnit: StaffUnit | null = null;
    if (roles.some(ur => ur.roles?.role_name === "ADMIN" || ur.roles?.role_name === "ADRIC_SECRETARY")) {
        determinedRole = "Staff";
        staffUnit = "ITS";
    } else if (roles.some(ur => ur.roles?.role_name === "ADRIC_DIRECTOR")) {
        determinedRole = "AdRICDirector";
    } else if (roles.some(ur => ur.roles?.role_name === "ITS_STAFF")) {
        determinedRole = "Staff";
        staffUnit = "ITS";
    } else if (roles.some(ur => ur.roles?.role_name === "TSG_STAFF")) {
        determinedRole = "Staff";
        staffUnit = "TSG";
    } else if (roles.some(ur => ur.roles?.role_name === "LAB_HEAD")) {
        determinedRole = "LabHead";
    }
    return { role: determinedRole, staffUnit };
}

/**
 * Logs a user in by email and password.
 * The lab is the short code of the account's first lab link, or "CITe4D" when it has none.
 *
 * @param email the email as sent; the repository trims it
 * @param password the password as sent
 * @returns the app role and the profile the session keeps
 * @throws AppError 401 if no account has this email and password
 */
// TODO(C-03): the password is compared as plain text inside the database query, where the column's collation ignores case, so a password in another letter case also logs in (issue #10). Hashing, Phase 3.
export async function login(email: string, password: string): Promise<{ role: string; user: LoginUser }> {
    const user = await authRepository.findUserByCredentials(email, password);

    if (!user) {
        throw new AppError(401, "Invalid institutional email address or password.");
    }

    const { role: determinedRole, staffUnit } = appRoleFor(user.user_roles || []);

    const primaryCenter = user.user_centers[0]?.research_centers?.short_code || "CITe4D";

    return {
        role: determinedRole,
        user: {
            userId: user.user_id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            idNumber: user.id_number,
            userType: user.user_type,
            userImg: user.user_img,
            profilePicture: user.user_img,
            labAffiliation: primaryCenter,
            staffUnit
        }
    };
}

/**
 * A signed session token for an account that just logged in, valid for 8 hours.
 *
 * @param userId the account's users.user_id
 * @returns the token for the adric_session cookie
 */
export function startSession(userId: number): string {
    return createSessionToken(userId, env.sessionSecret);
}

/**
 * Logs a session out: its token is refused from now until it would have expired, and its cached lookup is dropped.
 *
 * @param token the cookie's value, or undefined when the request had none
 */
// A token that does not verify (tampered, expired, or from another secret) is not listed: it is refused anyway.
export function endSession(token: string | undefined): void {
    if (!token) return;
    forgetIdentity(token);
    const claims = verifySessionToken(token, env.sessionSecret);
    if (claims) markLoggedOut(token, claims.expiresAt);
}

/**
 * Who a session token belongs to, for requireAuth: the token must verify, must not have logged out, and its account
 * must exist. The app role comes from appRoleFor, as for login and /me.
 * The signature, expiry, and logged-out checks run on every request without the database, so a logout or a
 * tampered cookie is refused at once. The account and its roles are read from the database at most once a minute
 * per token (shared/services/sessionCache.ts), so a changed role or a removed account takes effect within
 * 60 seconds, not at the next request.
 *
 * @param token the cookie's value
 * @returns the user id, app role, and Staff unit, or null when the session is refused
 */
// The cache keeps the session check from adding a query to every request on the slow CCS Cloud link (issue #8).
// A refused lookup (no such account) is not remembered.
export async function sessionIdentityFor(token: string): Promise<SessionIdentity | null> {
    const claims = verifySessionToken(token, env.sessionSecret);
    if (!claims || isLoggedOut(token)) return null;

    const remembered = recallIdentity(token);
    if (remembered) return remembered;

    const user = await authRepository.findUserRolesById(claims.userId);
    if (!user) return null;

    const { role, staffUnit } = appRoleFor(user.user_roles || []);
    const identity: SessionIdentity = { userId: user.user_id, role: role as Role, staffUnit };
    rememberIdentity(token, identity);
    return identity;
}

/**
 * The profile and app role of the session's own account, for the session reload and the account page.
 * Same mapping and lab fallback as login, with the role inside the profile.
 *
 * @param userId the session user (C-06: never an email the caller sends)
 * @returns the profile with its role
 * @throws AppError 404 if the account no longer exists (deleted within the 60-second session cache)
 */
export async function getProfile(userId: number): Promise<ProfileUser> {
    const user = await authRepository.findUserProfileById(userId);

    if (!user) {
        throw new AppError(404, "User profile not found in database.");
    }

    const { role: determinedRole, staffUnit } = appRoleFor(user.user_roles || []);

    const primaryCenter = user.user_centers[0]?.research_centers?.short_code || "CITe4D";

    return {
        userId: user.user_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        idNumber: user.id_number,
        userType: user.user_type,
        userImg: user.user_img,
        profilePicture: user.user_img,
        labAffiliation: primaryCenter,
        role: determinedRole,
        staffUnit
    };
}

/**
 * Saves the name, picture, and lab of the session user's own account. (C-06)
 * The picture is changed only when one is sent. The lab is changed only when a short code is sent, and only to a
 * research center that exists: an unknown code is refused before anything is saved, and no research center is ever
 * created here. (issue #73, M-03)
 *
 * @param userId the session user
 * @param data the checked body: names, and the optional picture (under three names) and lab code
 * @returns the updated users row, for the log line, and the profile the answer sends, with the account's own lab
 * @throws AppError 400 if a lab code is sent that no research center has
 * @throws AppError 404 if the account no longer exists (deleted within the 60-second session cache)
 */
export async function updateAccount(userId: number, data: AccountUpdateInput): Promise<{ updatedUser: users; user: AccountUser }> {
    const { firstName, lastName, labAffiliation, avatarUrl, userImg, profilePicture } = data;

    const user = await authRepository.findUserById(userId);
    if (!user) {
        throw new AppError(404, "User not found in database.");
    }

    const labCode = labAffiliation ? String(labAffiliation).trim() : "";
    let center = null;
    if (labCode && labCode !== "Not Affiliated") {
        center = await authRepository.findResearchCenterByCode(labCode);
        if (!center) {
            throw new AppError(400, `Unknown lab: ${labCode}.`);
        }
    }

    const imgToSave = avatarUrl || userImg || profilePicture;

    const updateData: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim()
    };

    if (imgToSave) {
        updateData.user_img = String(imgToSave);
    }

    const updatedUser = await authRepository.updateUser(user.user_id, updateData);

    if (center) {
        const existingUserCenter = await authRepository.findUserCenterOfUser(user.user_id);
        if (existingUserCenter) {
            await authRepository.updateUserCenter(existingUserCenter.user_centers_id, center.center_id);
        } else {
            await authRepository.createUserCenter(user.user_id, center.center_id);
        }
    }

    // The account's lab after the save, by the same rule as login and /me, so the session and the account page agree.
    const profile = await authRepository.findUserProfileById(user.user_id);
    const accountLab = profile?.user_centers[0]?.research_centers?.short_code || "CITe4D";

    return {
        updatedUser,
        user: {
            userId: updatedUser.user_id,
            firstName: updatedUser.first_name,
            lastName: updatedUser.last_name,
            email: updatedUser.email,
            idNumber: updatedUser.id_number,
            userType: updatedUser.user_type,
            userImg: updatedUser.user_img,
            profilePicture: updatedUser.user_img,
            avatarUrl: updatedUser.user_img,
            labAffiliation: accountLab
        }
    };
}
