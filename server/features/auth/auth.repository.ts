/**
 * Account, role, and lab row access, and the pending sign-up file: every database read and write the auth endpoints
 * make, plus the user lookups other features need (who to email, a user by email, by typed name, or by id).
 * Layer: repository. Called by auth.service.ts (also on behalf of shared/middleware/requireAuth.ts), the services of features/transfers,
 * disposals, and assets, and shared/services/poolCustodianCheck.ts. Calls config/prisma.ts and Node's fs
 * (pending_registrations.json).
 * Used by: login, every request with a session (its account and roles), the session reload, the account page, sign-ups and their approval, the transfer and disposal emails,
 * the transfer recipient by email, and the new custodian typed in an asset edit.
 */
import fs from 'fs';
import path from 'path';
import type { Prisma } from '@prisma/client';
import type { PendingRegistration } from '@shared/types/auth';
import { prisma } from '../../config/prisma';

/**
 * One user's email, for example the custodian who filed a transfer.
 *
 * @param userId the users.user_id
 * @returns the email, or null if there is no such user or the email is empty
 */
export async function getUserEmail(userId: number): Promise<string | null> {
    const user = await prisma.users.findUnique({ where: { user_id: userId } });
    return user?.email || null;
}

/**
 * Every email address of the users holding one database role.
 * An empty list is not an error: sendEmail logs that nobody was resolved and skips the send.
 *
 * @param roleName a roles.role_name value, for example "ADRIC_DIRECTOR"
 * @returns the addresses, or [] if the role does not exist or nobody holds it
 */
export async function getRoleEmails(roleName: string): Promise<string[]> {
    const role = await prisma.roles.findFirst({ where: { role_name: roleName as any } });
    if (!role) return [];

    const assignments = await prisma.user_roles.findMany({ where: { role_id: role.role_id } });
    const userIds = assignments.map(a => a.user_id);
    if (userIds.length === 0) return [];

    const users = await prisma.users.findMany({ where: { user_id: { in: userIds } } });
    return users.map(u => u.email).filter(Boolean);
}

/** The user with this id, or null. Used by the placeholder custodian startup check and the disposal email. */
export function findUserById(userId: number) {
    return prisma.users.findUnique({ where: { user_id: userId } });
}

/** The user with this email, or null. Used by sign-ups (the duplicate check), the transfer recipient, and the inspection reporter. */
export function findUserByEmail(email: string) {
    return prisma.users.findUnique({ where: { email } });
}

/**
 * The first user whose first and last name match exactly, or null.
 * Used for the one person a screen still sends as typed text: the new custodian in an asset edit (a target, not the
 * person acting).
 */
// TODO(H-10): two people with the same name cannot be told apart, and the caller splits a typed name at its first space (issue #32). Only the asset edit's new custodian still uses it; a person picker replaces it on a branch after step 13.
export function findUserByName(firstName: string, lastName: string) {
    return prisma.users.findFirst({
        where: { first_name: firstName, last_name: lastName },
    });
}

/** The user with this id number, or null. */
export function findUserByIdNumber(idNumber: number) {
    return prisma.users.findUnique({ where: { id_number: idNumber } });
}

/** The first role row with this name, or null. */
export function findRoleByName(roleName: string) {
    return prisma.roles.findFirst({ where: { role_name: roleName as any } });
}

/**
 * Creates a user and, when given, their role link and lab link, in one transaction,
 * so a failed link leaves no account behind.
 *
 * @param data the users row
 * @param roleId the role to link, or null for none
 * @param centerId the research center to link, or null for none
 * @returns the created users row
 */
export function createUser(data: Prisma.usersUncheckedCreateInput, roleId: number | null, centerId: number | null) {
    return prisma.$transaction(async (tx) => {
        const newUser = await tx.users.create({
            data
        });

        if (roleId !== null) {
            await tx.user_roles.create({
                data: {
                    user_id: newUser.user_id,
                    role_id: roleId
                }
            });
        }

        if (centerId !== null) {
            await tx.user_centers.create({
                data: {
                    user_id: newUser.user_id,
                    center_id: centerId
                }
            });
        }

        return newUser;
    });
}

/** The user with this email (trimmed) and password, with their roles and labs, or null. (C-03: compared as plain text) */
export function findUserByCredentials(email: string, password: string) {
    return prisma.users.findFirst({
        where: {
            email: email.trim(),
            password: password
        },
        include: {
            user_roles: {
                include: {
                    roles: true
                }
            },
            user_centers: {
                include: {
                    research_centers: true
                }
            }
        }
    });
}

/** The user with this id, with their roles and labs, or null. */
export function findUserProfileById(userId: number) {
    return prisma.users.findUnique({
        where: { user_id: userId },
        include: {
            user_roles: { include: { roles: true } },
            user_centers: { include: { research_centers: true } }
        }
    });
}

/** The user with this id and their roles, or null. Read for a session at most once a minute per cookie (sessionCache.ts). */
export function findUserRolesById(userId: number) {
    return prisma.users.findUnique({
        where: { user_id: userId },
        include: { user_roles: { include: { roles: true } } }
    });
}

/** Updates a user row and returns it. */
export function updateUser(userId: number, data: Prisma.usersUpdateInput) {
    return prisma.users.update({
        where: { user_id: userId },
        data
    });
}

/** The first research center whose name is the lab name, or whose short code is the lab name or the code taken from it, or null. */
export function findResearchCenterForLab(labName: string, extractedCode: string) {
    return prisma.research_centers.findFirst({
        where: {
            OR: [
                { name: labName },
                { short_code: labName },
                { short_code: extractedCode }
            ]
        }
    });
}

/** The first research center with this short code, or null. */
export function findResearchCenterByCode(shortCode: string) {
    return prisma.research_centers.findFirst({ where: { short_code: shortCode } });
}

/** Inserts a research center and returns it. */
export function createResearchCenter(data: Prisma.research_centersCreateInput) {
    return prisma.research_centers.create({
        data
    });
}

/** The user's first lab link, or null. */
export function findUserCenterOfUser(userId: number) {
    return prisma.user_centers.findFirst({ where: { user_id: userId } });
}

/** Points an existing lab link at another research center. */
export function updateUserCenter(userCentersId: number, centerId: number) {
    return prisma.user_centers.update({
        where: { user_centers_id: userCentersId },
        data: { center_id: centerId }
    });
}

/** Links a user to a research center. */
export function createUserCenter(userId: number, centerId: number) {
    return prisma.user_centers.create({
        data: { user_id: userId, center_id: centerId }
    });
}

// Pending sign-ups are kept in a JSON file, not in the database. The file is read once, when this module loads,
// into the list below; every change rewrites the whole file from that list. The path is the server's working
// folder, which is the repository root under the npm scripts and a temporary folder in the tests.
// TODO(H-17): the file holds each applicant's personal data and password in plain text, beside the code. A table, Phase 3.
const PENDING_FILE = path.join(process.cwd(), "pending_registrations.json");

/** Reads the file, or returns [] when it is missing or unreadable (the error is logged). */
function loadPendingRegistrations(): PendingRegistration[] {
    try {
        if (fs.existsSync(PENDING_FILE)) {
            const raw = fs.readFileSync(PENDING_FILE, "utf-8");
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error("Error loading pending_registrations.json:", e);
    }
    return [];
}

/** Writes the whole list. A failed write is logged and not thrown, so the list in memory and the file can differ. */
function savePendingRegistrations(items: PendingRegistration[]) {
    try {
        fs.writeFileSync(PENDING_FILE, JSON.stringify(items, null, 2), "utf-8");
    } catch (e) {
        console.error("Error saving pending_registrations.json:", e);
    }
}

let pendingRegistrationsStore: PendingRegistration[] = loadPendingRegistrations();

/** Every sign-up request held in memory, newest first, whatever its status. */
export function listPendingRegistrations(): PendingRegistration[] {
    return pendingRegistrationsStore;
}

/** The first sign-up request with this id, or undefined. It is the stored object itself, not a copy. */
export function findPendingRegistration(requestId: string): PendingRegistration | undefined {
    return pendingRegistrationsStore.find(r => r.id === requestId);
}

/** Adds a sign-up request at the front of the list and writes the file. */
export function addPendingRegistration(item: PendingRegistration): void {
    pendingRegistrationsStore.unshift(item);
    savePendingRegistrations(pendingRegistrationsStore);
}

/** Removes every sign-up request with this id and writes the file. */
export function removePendingRegistration(requestId: string): void {
    pendingRegistrationsStore = pendingRegistrationsStore.filter(r => r.id !== requestId);
    savePendingRegistrations(pendingRegistrationsStore);
}
