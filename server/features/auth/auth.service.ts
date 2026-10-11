import type { roles, user_roles, users } from '@prisma/client';
import type { StaffUnit } from '@shared/enums/role';
import type {
    AccountUpdateInput,
    AccountUser,
    ApproveRegistrationInput,
    LoginUser,
    PendingRegistration,
    ProfileUser,
    RegisterInput,
    RegistrationRequestInput,
} from '@shared/types/auth';
import * as authRepository from './auth.repository';
import { AppError } from '../../shared/errors/AppError';

/** Creates a Custodian account directly, with no approval step. */
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

/** The sign-up requests still waiting for a decision. */
export function listPendingRegistrations(): PendingRegistration[] {
    return authRepository.listPendingRegistrations().filter(r => r.status === "PENDING");
}

/** Files a sign-up request for Lab Head approval. */
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
        id: `REG-${Math.floor(100000 + Math.random() * 900000)}`,
        firstName,
        lastName,
        email,
        idNumber: Number(idNumber),
        userType: userType || "STUDENT",
        requestedRole: requestedRole || "Custodian",
        labAffiliation: labAffiliation || "CITe4D",
        password: password || "password123",
        avatarUrl,
        submittedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        status: "PENDING"
    };

    authRepository.addPendingRegistration(newReq);
    return newReq;
}

/** Approves a sign-up request: creates the user with its role and lab, then drops the request. */
export async function approveRegistration(data: ApproveRegistrationInput): Promise<users> {
    const { requestId, firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, password } = data;
    let targetReq = authRepository.findPendingRegistration(requestId);

    // Fallback: Use request body fields directly if provided from frontend
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
        const labName = targetReq.labAffiliation.trim();
        const match = labName.match(/\(([^)]+)\)/);
        const extractedCode = match ? match[1].trim() : labName;

        centerRecord = await authRepository.findResearchCenterForLab(labName, extractedCode);

        if (!centerRecord) {
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

    targetReq.status = "APPROVED";
    authRepository.removePendingRegistration(requestId);

    return createdUser;
}

/** Drops a sign-up request without creating an account. */
export function rejectRegistration(requestId: string): void {
    authRepository.removePendingRegistration(requestId);
}

/** Maps a user's database roles to the app role and Staff unit. */
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

/** Logs a user in by email and password. */
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

/** A user's profile and app role, by email. */
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

/** Saves an account's name, picture, and lab. */
export async function updateAccount(data: AccountUpdateInput): Promise<{ updatedUser: users; user: AccountUser }> {
    const { email, firstName, lastName, labAffiliation, avatarUrl, userImg, profilePicture } = data;

    const targetEmail = email.trim();
    let user = await authRepository.findFirstUserByEmail(targetEmail);
    if (!user) {
        user = await authRepository.findFirstUserByEmail(targetEmail.toLowerCase());
    }
    if (!user) {
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
            labAffiliation: labAffiliation || "CITe4D"
        }
    };
}
