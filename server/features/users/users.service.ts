/**
 * Users service: the IT Admin's rules for Pending sign-ups: who is waiting, and approving or rejecting one.
 * Layer: service. Called by users.controller.ts. Calls users.repository.ts.
 * Used by: the IT Admin's Approvals page.
 */
import { DATABASE_ROLE_LABELS, type DatabaseRole } from '@shared/enums/role';
import type { ApproveSignUpInput, RejectSignUpInput, User } from '@shared/types/users';
import * as usersRepository from './users.repository';
import type { SignUpDecision, UserRow } from './users.repository';
import { AppError } from '../../shared/errors/AppError';

/** An account in the contract's User shape. A Pending sign-up has no role yet, so role and roleLabel are null. */
function toUser(row: UserRow): User {
    const role = (row.user_roles[0]?.roles.role_name ?? null) as DatabaseRole | null;
    return {
        userId: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        idNumber: row.id_number,
        userType: row.user_type,
        role,
        roleLabel: role ? DATABASE_ROLE_LABELS[role] : null,
        accountStatus: row.account_status,
        labs: row.user_centers.map(uc => ({ centerId: uc.research_centers.center_id, code: uc.research_centers.short_code })),
        headOf: row.headed_center ? { centerId: row.headed_center.center_id, code: row.headed_center.short_code } : null,
    };
}

/**
 * The account a decision left, or the refusal for what the locked row held.
 *
 * @throws AppError 404 if there is no such account
 * @throws AppError 409 if the account is no longer Pending
 */
function decidedUser(decision: SignUpDecision): User {
    if (decision.outcome === 'NOT_FOUND') throw new AppError(404, "No account has this id.");
    if (decision.outcome === 'NOT_PENDING') throw new AppError(409, "This sign-up is no longer pending.");
    return toUser(decision.user);
}

/**
 * The sign-ups waiting for the IT Admin, oldest first, each with the labs it asked for.
 *
 * @returns the Pending accounts
 */
export async function listPendingSignUps(): Promise<User[]> {
    return (await usersRepository.findUsersByStatus('PENDING')).map(toUser);
}

/**
 * Approves a Pending sign-up with one role and its labs. A Researcher needs at least one lab; the other roles may
 * have none (the IT Admin, Director, and Secretary usually belong to no lab). There is no Lab Head role: heading a lab
 * is set on the lab (module 6).
 *
 * @param userId the account
 * @param input the role and the labs, each once
 * @param itAdminId the session user who approves (never from the body)
 * @returns the account, now Active
 * @throws AppError 400 if a Researcher gets no lab, or a lab does not exist
 * @throws AppError 404 if there is no such account
 * @throws AppError 409 if the account is no longer Pending
 */
export async function approveSignUp(userId: number, input: ApproveSignUpInput, itAdminId: number): Promise<User> {
    if (input.role === 'RESEARCHER' && input.centerIds.length === 0) {
        throw new AppError(400, "Choose at least one lab for a Researcher.");
    }
    const labs = await usersRepository.findLabs(input.centerIds);
    if (labs.length !== input.centerIds.length) {
        throw new AppError(400, "One of the labs you chose is not a known lab.");
    }

    const details = `Role: ${input.role}; labs: ${labs.map(lab => lab.short_code).join(', ') || 'none'}`;
    return decidedUser(await usersRepository.approveSignUp(userId, input.role, input.centerIds, itAdminId, details));
}

/**
 * Rejects a Pending sign-up. The account keeps its email and ID number, so the same person cannot sign up again
 * until the IT Admin anonymizes it (module 6).
 *
 * @param userId the account
 * @param input the optional remarks, kept in the log row
 * @param itAdminId the session user who rejects (never from the body)
 * @returns the account, now Rejected, with no labs
 * @throws AppError 404 if there is no such account
 * @throws AppError 409 if the account is no longer Pending
 */
export async function rejectSignUp(userId: number, input: RejectSignUpInput, itAdminId: number): Promise<User> {
    return decidedUser(await usersRepository.rejectSignUp(userId, itAdminId, input.remarks));
}
