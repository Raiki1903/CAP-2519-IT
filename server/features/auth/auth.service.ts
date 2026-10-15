/**
 * Auth service: the rules for logging in, the session's profile and app role, account updates, and sign-ups.
 * Layer: service. Called by auth.controller.ts. Calls auth.repository.ts.
 * Used by: login for every role, the session reload, the account page, self-registration, and the Lab Head's sign-up approvals.
 */
import type { roles, user_roles, users } from '@prisma/client';
import type { Role, StaffUnit } from '@shared/enums/role';
import type {
    AccountUpdateInput,
    AccountUser,
    ApproveRegistrationInput,
    LoginUser,
    PendingRegistration,
    ProfileUser,
    RegisterInput,
    RegistrationRequestInput,
    SessionIdentity,
} from '@shared/types/auth';
import * as authRepository from './auth.repository';
import { AppError } from '../../shared/errors/AppError';
import { env } from '../../config/env';
import { createSessionToken, isLoggedOut, markLoggedOut, verifySessionToken } from '../../shared/services/session';

// Registration accepts the same email more than once (issue #14), kept as is: the email check looks at accounts only,
// not at pending sign-ups, so one email can be requested twice; approving the second then fails with a 500.

/**
 * Creates a Custodian account directly, with no approval step. No screen calls it; deleting it is issue #70.
 * The account gets the CUSTODIAN role if that role row exists, and a lab link only when a center id is sent.
 *
 * @param data the checked body: names, email, password, id number, optional user type and center id
 * @returns the new account's id, names, and email
 * @throws AppError 400 if the email or the id number already belongs to an account
 */
// TODO(C-03): the password is stored as typed (issue #10). Hashing, Phase 3.
export async function register(data: RegisterInput): Promise<{ userId: number; firstName: string; lastName: string; email: string }> {
    const { firstName, lastName, email, password, idNumber, userType, centerId } = data;

    const existingEmail = await authRepository.findUserByEmail(email);
    if (existingEmail) {
        throw new AppError(400, "A user with this email address already exists.");
    }

    const existingId = await authRepository.findUserByIdNumber(Number(idNumber));
    if (existingId) {
        throw new AppError(400, "A user with this ID number already exists.");
    }

    const custodianRole = await authRepository.findRoleByName("CUSTODIAN");

    const user = await authRepository.createUser(
        {
            first_name: firstName,
            last_name: lastName,
            email,
            password,
            id_number: Number(idNumber),
            user_type: userType || "STUDENT"
        },
        custodianRole ? custodianRole.role_id : null,
        centerId ? Number(centerId) : null,
    );

    return { userId: user.user_id, firstName: user.first_name, lastName: user.last_name, email: user.email };
}

/**
 * The sign-up requests still waiting for a decision, newest first.
 *
 * @returns the PENDING requests, each with its password (C-04, issue #72)
 */
export function listPendingRegistrations(): PendingRegistration[] {
    return authRepository.listPendingRegistrations().filter(r => r.status === "PENDING");
}

/**
 * Files a sign-up request for a Lab Head to approve. Nothing is written to the database:
 * the request is kept in memory and in pending_registrations.json until it is approved or rejected. (H-17)
 *
 * @param data the checked body: names, email, id number, and the optional user type, role, lab, password, and picture
 * @returns the stored request, with its REG- id
 * @throws AppError 400 if the email or the id number already belongs to an account
 */
export async function requestRegistration(data: RegistrationRequestInput): Promise<PendingRegistration> {
    const { firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, password, avatarUrl } = data;

    const existingEmail = await authRepository.findUserByEmail(email);
    if (existingEmail) {
        throw new AppError(400, "A registered user with this email already exists.");
    }

    const existingId = await authRepository.findUserByIdNumber(Number(idNumber));
    if (existingId) {
        throw new AppError(400, "A registered user with this ID number already exists.");
    }

    const newReq: PendingRegistration = {
        // A random six-digit number: two requests can draw the same id, and approving or rejecting one then drops both.
        id: `REG-${Math.floor(100000 + Math.random() * 900000)}`,
        firstName,
        lastName,
        email,
        idNumber: Number(idNumber),
        userType: userType || "STUDENT",
        requestedRole: requestedRole || "Custodian",
        labAffiliation: labAffiliation || "CITe4D",
        // TODO(C-03): a request without a password gets "password123", stored as plain text (issue #10). Phase 3.
        password: password || "password123",
        avatarUrl,
        submittedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        status: "PENDING"
    };

    authRepository.addPendingRegistration(newReq);
    return newReq;
}

/**
 * Approves a sign-up request: creates the account with its role and lab, then drops the request.
 * The role comes from the requested role's wording, and the lab is matched by name or short code;
 * a lab that matches nothing is created as a new research center. (C-05 family, issue #73)
 *
 * @param data `requestId`, plus the request's own fields when the caller has them
 * @returns the created users row, password included (01C 4.1, issue #72)
 * @throws AppError 404 if the id matches no request and the body has no email and names to fall back on
 */
// TODO(C-05): an unknown request id plus a body with an email and names creates that account, with the role it asks for. Removing the fallback is issue #71, which needs issue #68 first: in the tab that filed a sign-up, the list holds the Register page's own REG-<timestamp> id, not the server's, so those approvals work only through this fallback.
// TODO(M-11): "ITS" or "Admin" in the requested role maps to ADMIN, so no ITS_STAFF account can be created here. With the ITS removal branch.
export async function approveRegistration(data: ApproveRegistrationInput): Promise<users> {
    const { requestId, firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, password } = data;
    let targetReq = authRepository.findPendingRegistration(requestId);

    if (!targetReq && email && firstName && lastName) {
        targetReq = {
            id: requestId || `REG-${Date.now()}`,
            firstName,
            lastName,
            email,
            idNumber: Number(idNumber) || 10000000,
            userType: userType || "STUDENT",
            requestedRole: requestedRole || "Custodian",
            labAffiliation: labAffiliation || "CITe4D",
            password: password || "password123",
            submittedAt: new Date().toLocaleDateString(),
            status: "PENDING"
        };
    }

    if (!targetReq) {
        throw new AppError(404, "Pending registration request details not found.");
    }

    // Checked in this order, so "Lab Head" wins over anything else in the text.
    const requested = (targetReq.requestedRole || "").toUpperCase();
    let dbRoleName: any = "CUSTODIAN";
    if (requested.includes("HEAD") || requested.includes("LAB")) dbRoleName = "LAB_HEAD";
    else if (requested.includes("TSG")) dbRoleName = "TSG_STAFF";
    else if (requested.includes("ITS") || requested.includes("ADMIN")) dbRoleName = "ADMIN";
    else dbRoleName = "CUSTODIAN";

    let roleRecord = await authRepository.findRoleByName(dbRoleName);
    if (!roleRecord) {
        roleRecord = await authRepository.findRoleByName("CUSTODIAN");
    }

    let centerRecord = null;
    if (targetReq.labAffiliation && targetReq.labAffiliation !== "Not Affiliated" && targetReq.labAffiliation !== "No affiliation") {
        // The form sends a full lab name such as "Center for ... (CeLT)"; the code in brackets is tried as a short code.
        const labName = targetReq.labAffiliation.trim();
        const match = labName.match(/\(([^)]+)\)/);
        const extractedCode = match ? match[1].trim() : labName;

        centerRecord = await authRepository.findResearchCenterForLab(labName, extractedCode);

        if (!centerRecord) {
            // A failed create is logged and the account is created without a lab.
            try {
                centerRecord = await authRepository.createResearchCenter({
                    name: labName,
                    short_code: extractedCode,
                    location: "MANILA"
                });
            } catch (e) {
                console.log(`Note: Research center creation fallback for ${targetReq.labAffiliation}:`, e);
            }
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

    // The request is dropped by the id the caller sent, which is also how a fallback approval leaves the list unchanged.
    targetReq.status = "APPROVED";
    authRepository.removePendingRegistration(requestId);

    return createdUser;
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
 * Maps a user's database roles to the app role and Staff unit, for login and /me.
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

export function startSession(userId: number): string {
    return createSessionToken(userId, env.sessionSecret);
}

// A token that does not verify (tampered, expired, or from another secret) is not listed: it is refused anyway.
export function endSession(token: string | undefined): void {
    if (!token) return;
    const claims = verifySessionToken(token, env.sessionSecret);
    if (claims) markLoggedOut(token, claims.expiresAt);
}

// The role is read from the database on every request, not kept in the cookie, so a changed role
// or a removed account takes effect at the next request.
export async function sessionIdentityFor(token: string): Promise<SessionIdentity | null> {
    const claims = verifySessionToken(token, env.sessionSecret);
    if (!claims || isLoggedOut(token)) return null;

    const user = await authRepository.findUserRolesById(claims.userId);
    if (!user) return null;

    const { role, staffUnit } = appRoleFor(user.user_roles || []);
    return { userId: user.user_id, role: role as Role, staffUnit };
}

/**
 * The profile and app role of the account with this email, for the session reload.
 * Same mapping and lab fallback as login, with the role inside the profile.
 *
 * @param email the email from the query; the repository trims it
 * @returns the profile with its role
 * @throws AppError 404 if no account has this email
 */
export async function getProfile(email: string): Promise<ProfileUser> {
    const user = await authRepository.findUserProfileByEmail(email);

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
 * Saves an account's name, picture, and lab.
 * The account is looked up by the email as sent, then in lower case, then by comparing every account's email in lower case.
 * The picture is changed only when one is sent. A lab code that matches no research center is created as one first.
 *
 * @param data the checked body: email, names, and the optional picture (under three names) and lab code
 * @returns the updated users row, for the log line, and the profile the answer sends
 * @throws AppError 404 if no account matches the email
 */
export async function updateAccount(data: AccountUpdateInput): Promise<{ updatedUser: users; user: AccountUser }> {
    const { email, firstName, lastName, labAffiliation, avatarUrl, userImg, profilePicture } = data;

    const targetEmail = email.trim();
    let user = await authRepository.findFirstUserByEmail(targetEmail);
    if (!user) {
        user = await authRepository.findFirstUserByEmail(targetEmail.toLowerCase());
    }
    if (!user) {
        // TODO(M-01): the last resort loads every account to compare emails in code. Goes with the session user, step 13.
        const allUsers = await authRepository.findAllUsers();
        user = allUsers.find(u => u.email.toLowerCase() === targetEmail.toLowerCase()) || null;
    }

    if (!user) {
        throw new AppError(404, "User not found in database.");
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

    if (labAffiliation && labAffiliation !== "Not Affiliated") {
        let center = await authRepository.findResearchCenterByCode(labAffiliation);
        if (!center) {
            // MANILA_CAMPUS is not a research_centers location, so this create always fails, the empty catch
            // swallows it, and the account keeps its old lab while the answer names the new one.
            // TODO(M-03): a lab code is turned into a new research center instead of being refused (issue #73). A fixed lab list, Phase 3.
            try {
                center = await authRepository.createResearchCenter({ name: `${labAffiliation} Research Laboratory`, short_code: labAffiliation, location: "MANILA_CAMPUS" });
            } catch (e) { }
        }
        if (center) {
            const existingUserCenter = await authRepository.findUserCenterOfUser(user.user_id);
            if (existingUserCenter) {
                await authRepository.updateUserCenter(existingUserCenter.user_centers_id, center.center_id);
            } else {
                await authRepository.createUserCenter(user.user_id, center.center_id);
            }
        }
    }

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
            // The lab sent, not the account's lab: with no lab sent this says CITe4D whatever the account's lab is (issue #73).
            labAffiliation: labAffiliation || "CITe4D"
        }
    };
}
