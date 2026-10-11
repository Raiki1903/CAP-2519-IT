/**
 * Account lookups other features need: who to email. The first part of the auth feature;
 * login, /me, and the account update join it when auth is extracted later in step 12.
 * Layer: repository. Called by features/transfers/transfers.service.ts and features/disposals/disposals.service.ts. Calls config/prisma.ts.
 * Used by: the transfer and disposal notification emails.
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

/** The user with this email, or null. */
export function findUserByEmail(email: string) {
    return prisma.users.findUnique({ where: { email } });
}

/** The first user whose first and last name match exactly, or null. (H-10) */
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
 * Creates a user and, when given, their role link and lab link, in one transaction.
 *
 * @param roleId the role to link, or null for none
 * @param centerId the research center to link, or null for none
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

/** The user with this email and password, with their roles and labs, or null. */
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

/** The first user with this email, with their roles and labs, or null. */
export function findUserProfileByEmail(email: string) {
    return prisma.users.findFirst({
        where: { email: email.trim() },
        include: {
            user_roles: { include: { roles: true } },
            user_centers: { include: { research_centers: true } }
        }
    });
}

/** The first user with exactly this email, or null. */
export function findFirstUserByEmail(email: string) {
    return prisma.users.findFirst({ where: { email } });
}

/** Every user. */
export function findAllUsers() {
    return prisma.users.findMany();
}

/** Updates a user row and returns it. */
export function updateUser(userId: number, data: Prisma.usersUpdateInput) {
    return prisma.users.update({
        where: { user_id: userId },
        data
    });
}

/** The first research center whose name or short code matches the lab, or null. */
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

// Persistent JSON File Storage for Pending Registrations
const PENDING_FILE = path.join(process.cwd(), "pending_registrations.json");

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

function savePendingRegistrations(items: PendingRegistration[]) {
    try {
        fs.writeFileSync(PENDING_FILE, JSON.stringify(items, null, 2), "utf-8");
    } catch (e) {
        console.error("Error saving pending_registrations.json:", e);
    }
}

let pendingRegistrationsStore: PendingRegistration[] = loadPendingRegistrations();

/** Every sign-up request held in memory, newest first. */
export function listPendingRegistrations(): PendingRegistration[] {
    return pendingRegistrationsStore;
}

/** The sign-up request with this id, or undefined. */
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
