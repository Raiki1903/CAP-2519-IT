/**
 * Auth service: the rules for logging in and out, the session's profile and app role, account updates, and sign-ups.
 * Layer: service. Called by auth.controller.ts and shared/middleware/requireAuth.ts. Calls auth.repository.ts,
 * shared/services/session.ts, shared/services/passwords.ts, and config/env.ts (the session secret).
 * Used by: login for every role, the session reload, the account page, self-registration, and the Lab Head's sign-up approvals.
 */
import type { roles, user_roles, users } from '@prisma/client';
import { MAX_PASSWORD_LENGTH } from '@shared/constants/passwords';
import { ACCOUNT_NOT_ACTIVE_MESSAGE } from '@shared/constants/accountStatuses';
import { APP_ROLE_LABELS, type DatabaseRole, type Role, type StaffUnit } from '@shared/enums/role';
import type {
    AccountUpdateInput,
    AccountUser,
    ApproveRegistrationInput,
    ApprovedUser,
    LoginUser,
    PendingRegistration,
    PendingRegistrationView,
    ProfileUser,
    SessionIdentity,
    SessionLab,
    SignUpRequest,
} from '@shared/types/auth';
import * as authRepository from './auth.repository';
import type { UserProfileRow } from './auth.repository';
import { AppError } from '../../shared/errors/AppError';
import { env } from '../../config/env';
import { DUMMY_PASSWORD_HASH, hashPassword, isPasswordHash, verifyPassword } from '../../shared/services/passwords';
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

/** A stored sign-up request without its password hash, for an answer. (C-04) */
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

/** What a sign-up answers with. */
export const SIGN_UP_SENT_MESSAGE = "Your sign-up was sent. The IT Admin will review it. You can log in once it is approved.";

/**
 * Stores a sign-up as a Pending account with no role, linked to the labs it asks for. The IT Admin approves it with a
 * role (features/users). A Pending account cannot log in.
 *
 * Only the database decides whether the email or the ID number is taken (their unique keys), so two identical
 * sign-ups at the same moment give one account and one 409. (issues #14, #81)
 *
 * @param data the checked body
 * @returns the new account's user id
 * @throws AppError 400 if a requested lab does not exist
 * @throws AppError 409 if an account, of any status, already has the email or the ID number
 */
export async function requestRegistration(data: SignUpRequest): Promise<number> {
    if (await authRepository.countLabs(data.centerIds) !== data.centerIds.length) {
        throw new AppError(400, "One of the labs you chose is not a known lab.");
    }

    const passwordHash = await hashPassword(data.password);
    const userId = await authRepository.createPendingUser(
        {
            first_name: data.firstName,
            last_name: data.lastName,
            email: data.email,
            password: passwordHash,
            id_number: data.idNumber,
            user_type: data.userType,
            user_img: data.avatarUrl ?? null,
        },
        data.centerIds,
    );
    if (userId === null) {
        throw new AppError(409, "An account with this email or ID number already exists. Ask the IT Admin.");
    }
    return userId;
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
 * @throws AppError 409 if the request was filed before passwords were hashed, so it has no hash to copy; the request is kept (C-03)
 * @throws AppError 409 if an account has the request's email or id number by now; the request is kept (issue #14)
 */
export async function approveRegistration(data: ApproveRegistrationInput): Promise<ApprovedUser> {
    const { requestId } = data;
    const targetReq = authRepository.findPendingRegistration(requestId);

    if (!targetReq) {
        throw new AppError(404, "Pending registration request details not found.");
    }

    if (!isPasswordHash(targetReq.password)) {
        throw new AppError(409, "This request was made before passwords were protected. Decline it and ask the applicant to sign up again.");
    }

    // Checked again here: a request filed before the duplicate checks, or an account created since, would otherwise
    // fail inside the database with a 500.
    await refuseTakenByAccount(targetReq.email, targetReq.idNumber);

    // The request's requestedRole is never read: an older request in the file can still name another role.
    const roleRecord = await authRepository.findRoleByName("RESEARCHER");

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
            password: targetReq.password,
            id_number: targetReq.idNumber,
            user_type: targetReq.userType || "STUDENT",
            user_img: targetReq.avatarUrl ? String(targetReq.avatarUrl) : null,
            // An approved sign-up can log in at once; PENDING is for requests stored as accounts (Batch 2b).
            account_status: "ACTIVE"
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
 * There is no Lab Head role: an account that heads a lab (research_centers.head_user_id) gets the Lab Head view,
 * ahead of Researcher. The IT Admin gets its own view, with no asset screens (contract section 6).
 *
 * @param roles the user's user_roles rows, each with its roles row
 * @param headsLab whether the account heads a lab
 * @returns the app role ("ITAdmin", "Staff", "AdRICDirector", "LabHead", or "Custodian") and, for Staff, the unit
 */
// TODO(M-11): ADRIC_SECRETARY maps to Staff (ITS); the team decided it gets the Director view, on the ITS removal branch.
function appRoleFor(roles: (user_roles & { roles: roles })[], headsLab: boolean): { role: string; staffUnit: StaffUnit | null } {
    let determinedRole = "Custodian";
    let staffUnit: StaffUnit | null = null;
    if (roles.some(ur => ur.roles?.role_name === "IT_ADMIN")) {
        determinedRole = "ITAdmin";
    } else if (roles.some(ur => ur.roles?.role_name === "ADRIC_SECRETARY")) {
        determinedRole = "Staff";
        staffUnit = "ITS";
    } else if (roles.some(ur => ur.roles?.role_name === "ADRIC_DIRECTOR")) {
        determinedRole = "AdRICDirector";
    } else if (roles.some(ur => ur.roles?.role_name === "TSG_STAFF")) {
        determinedRole = "Staff";
        staffUnit = "TSG";
    } else if (headsLab) {
        determinedRole = "LabHead";
    }
    return { role: determinedRole, staffUnit };
}

const LOGIN_REFUSED_MESSAGE = "Invalid institutional email address or password.";

/** What a dummy verify hashes in place of a password that is not worth hashing. */
const UNUSABLE_PASSWORD_STAND_IN = "unusable";

/** Every lab the user belongs to, by lab code. There is no first or default lab: no link means []. */
function labsOf(user: UserProfileRow): SessionLab[] {
    return user.user_centers.map(uc => ({
        centerId: uc.research_centers.center_id,
        code: uc.research_centers.short_code,
        name: uc.research_centers.name,
        campus: uc.research_centers.location,
    }));
}

/** The lab the user heads, or null. */
function headOf(user: UserProfileRow): LoginUser['headOf'] {
    return user.headed_center ? { centerId: user.headed_center.center_id, code: user.headed_center.short_code } : null;
}

/** The profile login, /me, and the session reload send: the person's own facts, every lab, and the lab they head. */
function profileOf(user: UserProfileRow, staffUnit: StaffUnit | null): LoginUser {
    return {
        userId: user.user_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        idNumber: user.id_number,
        userType: user.user_type,
        userImg: user.user_img,
        profilePicture: user.user_img,
        labs: labsOf(user),
        headOf: headOf(user),
        accountStatus: user.account_status,
        staffUnit,
    };
}

/**
 * Logs a user in by email and password. Every refusal of the email or password runs one verify and gives the same
 * answer, so neither the answer nor its timing reveals which emails exist. An account whose password is still plain
 * text cannot log in: prisma/hashExistingPasswords.ts is the path for old accounts. Only once the password is right is
 * an account that is not Active refused, with 403.
 *
 * @param email the email as sent; the repository trims it
 * @param password the password as sent
 * @returns the app role and the profile the session keeps
 * @throws AppError 401 if no account has this email and password
 * @throws AppError 403 if the account is Pending, Inactive, or Rejected
 */
export async function login(email: string, password: string): Promise<{ role: string; user: LoginUser }> {
    // Refused before the lookup, so the email plays no part. The check also stops a huge password being hashed.
    if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
        await verifyPassword(UNUSABLE_PASSWORD_STAND_IN, DUMMY_PASSWORD_HASH);
        throw new AppError(401, LOGIN_REFUSED_MESSAGE);
    }

    const user = await authRepository.findUserForLogin(email);

    // A plain-text row fails verifyPassword at once, which would reveal the account, so it takes the dummy path too.
    const storedHash = user && isPasswordHash(user.password) ? user.password : DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyPassword(password, storedHash);

    if (!user || !passwordMatches) {
        throw new AppError(401, LOGIN_REFUSED_MESSAGE);
    }
    if (user.account_status !== "ACTIVE") {
        throw new AppError(403, ACCOUNT_NOT_ACTIVE_MESSAGE);
    }

    const { role: determinedRole, staffUnit } = appRoleFor(user.user_roles || [], user.headed_center !== null);
    return { role: determinedRole, user: profileOf(user, staffUnit) };
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
 * must exist. The app role comes from appRoleFor, as for login and /me; the database roles, the account status, and
 * the lab the account heads come along for the permission checks (shared/middleware/permissions.ts).
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

    const { role, staffUnit } = appRoleFor(user.user_roles || [], user.headed_center !== null);
    const identity: SessionIdentity = {
        userId: user.user_id,
        role: role as Role,
        staffUnit,
        dbRoles: (user.user_roles || []).map(ur => ur.roles.role_name as DatabaseRole),
        accountStatus: user.account_status,
        headOfCenterId: user.headed_center?.center_id ?? null,
    };
    rememberIdentity(token, identity);
    return identity;
}

/**
 * The profile and app role of the session's own account, for the session reload and the account page.
 * Same profile as login, with the role and its label inside it.
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

    const { role: determinedRole, staffUnit } = appRoleFor(user.user_roles || [], user.headed_center !== null);
    return { ...profileOf(user, staffUnit), role: determinedRole, roleLabel: APP_ROLE_LABELS[determinedRole as Role] };
}

/**
 * Saves the name and picture of the session user's own account. (C-06)
 * The picture is changed only when one is sent. The lab is never changed here: the validation refuses a body that
 * sends one (issue #73).
 *
 * @param userId the session user
 * @param data the checked body: names, and the optional picture (under three names)
 * @returns the updated users row, for the log line, and the profile the answer sends, with the account's labs
 * @throws AppError 404 if the account no longer exists (deleted within the 60-second session cache)
 */
export async function updateAccount(userId: number, data: AccountUpdateInput): Promise<{ updatedUser: users; user: AccountUser }> {
    const { firstName, lastName, avatarUrl, userImg, profilePicture } = data;

    const user = await authRepository.findUserById(userId);
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

    // The account's labs, as login and /me give them, so the session and the account page agree.
    const profile = await authRepository.findUserProfileById(user.user_id);

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
            labs: profile ? labsOf(profile) : [],
        }
    };
}
