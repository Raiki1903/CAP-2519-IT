/**
 * Users service: the IT Admin's rules for accounts: the users list; approving or rejecting a Pending sign-up; and,
 * after sign-up, the role, the labs, a lab's Head, deactivating, reactivating, and anonymizing.
 * Layer: service. Called by users.controller.ts. Calls users.repository.ts.
 * Used by: the IT Admin's Approvals and Users pages.
 */
import { UNCLEARED_LOAN_STATUSES } from '@shared/constants/loanStatuses';
import { DATABASE_ROLE_LABELS, type DatabaseRole } from '@shared/enums/role';
import type {
    ApproveSignUpInput, ChangeLabsInput, ChangeRoleInput, LabHead, RejectSignUpInput, SetLabHeadInput, User, UserListFilters,
} from '@shared/types/users';
import * as usersRepository from './users.repository';
import type { LockedAccount, SignUpDecision, UserRow } from './users.repository';
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
 * The accounts that pass the filters. `status=PENDING` alone is the Approvals list: the sign-ups waiting, oldest
 * first, each with the labs it asked for. Any other filters, or none, list by last name and then first name; with no
 * status the Pending sign-ups are left out.
 *
 * @param filters status, role, lab, and search, each optional
 * @returns the accounts
 * @throws AppError 400 if the lab does not exist
 */
export async function listUsers(filters: UserListFilters): Promise<User[]> {
    if (filters.centerId !== undefined && (await usersRepository.findLabs([filters.centerId])).length === 0) {
        throw new AppError(400, "No lab has this id.");
    }
    const approvalsList = filters.status === 'PENDING' && Object.keys(filters).length === 1;
    return (await usersRepository.findUsers(filters, approvalsList ? 'SIGN_UP' : 'NAME')).map(toUser);
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

/** The 400 message when the IT Admin tries to change their own account. */
const OWN_ACCOUNT_MESSAGE = "You can't change your own account here.";

/** The 409 message when the account heads a lab and the change would undo that. */
const HEAD_FIRST_MESSAGE = "Change the lab's Head first.";

/**
 * Refuses a change to the IT Admin's own account. This also keeps the last IT Admin from locking everyone out.
 *
 * @throws AppError 400 if the account is the IT Admin's own
 */
function refuseOwnAccount(userId: number, itAdminId: number): void {
    if (userId === itAdminId) throw new AppError(400, OWN_ACCOUNT_MESSAGE);
}

/**
 * Refuses a role or lab change to an account that is not Active or Inactive: a Pending sign-up goes through
 * Approvals, and a Rejected or anonymized account is kept as it is.
 *
 * @throws AppError 409 for a Pending, Rejected, or anonymized account
 */
function refuseUnlessManaged(account: LockedAccount): void {
    if (account.anonymized) throw new AppError(409, "This account is anonymized and can't be changed.");
    if (account.status === 'PENDING') throw new AppError(409, "This sign-up is still pending. Decide it on the Approvals page.");
    if (account.status === 'REJECTED') throw new AppError(409, "This sign-up was rejected and can't be changed.");
}

/**
 * The account a change left.
 *
 * @throws AppError 404 if there is no such account
 */
function changedUser(row: UserRow | null): User {
    if (!row) throw new AppError(404, "No account has this id.");
    return toUser(row);
}

/**
 * Gives an Active or Inactive account one role in place of the one it has. The account that heads a lab stays a
 * Researcher, because a lab's Head is a Researcher office account.
 *
 * @param userId the account
 * @param input the new role
 * @param itAdminId the session user who changes it (never from the body)
 * @returns the account with its new role
 * @throws AppError 400 if the account is the IT Admin's own
 * @throws AppError 404 if there is no such account
 * @throws AppError 409 if the account is Pending, Rejected, or anonymized, or heads a lab and the role is not Researcher
 */
export async function changeRole(userId: number, input: ChangeRoleInput, itAdminId: number): Promise<User> {
    refuseOwnAccount(userId, itAdminId);
    return changedUser(await usersRepository.changeRole(userId, input.role, itAdminId, (account) => {
        refuseUnlessManaged(account);
        if (account.headOf && input.role !== 'RESEARCHER') throw new AppError(409, HEAD_FIRST_MESSAGE);
        return `From ${account.role ?? 'none'} to ${input.role}`;
    }));
}

/**
 * Replaces the labs of an Active or Inactive account. A Researcher keeps at least one lab, and the account that
 * heads a lab keeps that lab.
 *
 * @param userId the account
 * @param input the labs from now on, each once
 * @param itAdminId the session user who changes them (never from the body)
 * @returns the account with its new labs
 * @throws AppError 400 if the account is the IT Admin's own, a lab does not exist, or a Researcher would have none
 * @throws AppError 404 if there is no such account
 * @throws AppError 409 if the account is Pending, Rejected, or anonymized, or the lab it heads is left out
 */
export async function changeLabs(userId: number, input: ChangeLabsInput, itAdminId: number): Promise<User> {
    refuseOwnAccount(userId, itAdminId);
    const labs = await usersRepository.findLabs(input.centerIds);
    if (labs.length !== input.centerIds.length) {
        throw new AppError(400, "One of the labs you chose is not a known lab.");
    }

    return changedUser(await usersRepository.changeLabs(userId, input.centerIds, itAdminId, (account) => {
        refuseUnlessManaged(account);
        if (account.role === 'RESEARCHER' && input.centerIds.length === 0) {
            throw new AppError(400, "Choose at least one lab for a Researcher.");
        }
        if (account.headOf && !input.centerIds.includes(account.headOf.centerId)) throw new AppError(409, HEAD_FIRST_MESSAGE);
        return labs.map(lab => lab.short_code).join(', ') || 'none';
    }));
}

/**
 * Makes an Active Researcher member of the lab its Head, in place of the one it has, or leaves the lab with no Head.
 * The account that heads a lab is the lab's Researcher office account, and it heads one lab at most.
 *
 * @param centerId the lab
 * @param input the new Head's account, or null for no Head
 * @param itAdminId the session user who changes it (never from the body)
 * @returns the lab with its Head
 * @throws AppError 400 if the new Head is not Active, not a Researcher, or not a member of the lab
 * @throws AppError 404 if there is no such lab or account
 * @throws AppError 409 if the new Head already heads another lab
 */
export async function setLabHead(centerId: number, input: SetLabHeadInput, itAdminId: number): Promise<LabHead> {
    const change = await usersRepository.setLabHead(centerId, input.userId, itAdminId, (lab, newHead) => {
        if (newHead) {
            if (newHead.status !== 'ACTIVE') throw new AppError(400, "The new Head must be an Active account.");
            if (newHead.role !== 'RESEARCHER') throw new AppError(400, "The new Head must be a Researcher account.");
            if (!newHead.centerIds.includes(lab.centerId)) throw new AppError(400, `The new Head must be a member of ${lab.code}.`);
            if (newHead.headOf && newHead.headOf.centerId !== lab.centerId) {
                throw new AppError(409, `This account already heads ${newHead.headOf.code}.`);
            }
        }
        return `${lab.code}: ${lab.head?.name ?? 'none'} to ${newHead?.name ?? 'none'}`;
    });
    if (change.outcome === 'NO_LAB') throw new AppError(404, "No lab has this id.");
    if (change.outcome === 'NO_ACCOUNT') throw new AppError(404, "No account has this id.");
    return change.lab;
}

/**
 * Deactivates an Active account: it can no longer log in or act. Refused while the account heads a lab, or has any
 * open loan, a request still waiting included (D3), so no loan loses its borrower halfway through.
 *
 * @param userId the account
 * @param itAdminId the session user who deactivates it (never from the body)
 * @returns the account, now Inactive
 * @throws AppError 400 if the account is the IT Admin's own
 * @throws AppError 404 if there is no such account
 * @throws AppError 409 if the account is not Active, heads a lab, or has an open loan
 */
export async function deactivateUser(userId: number, itAdminId: number): Promise<User> {
    refuseOwnAccount(userId, itAdminId);
    return changedUser(await usersRepository.setAccountStatus(userId, 'INACTIVE', 'USER_DEACTIVATED', itAdminId, (account) => {
        if (account.status !== 'ACTIVE') throw new AppError(409, "Only an Active account can be deactivated.");
        if (account.headOf) throw new AppError(409, HEAD_FIRST_MESSAGE);
        if (account.openLoanStatuses.length > 0) throw new AppError(409, "This account still has an open loan or loan request.");
        return null;
    }));
}

/**
 * Reactivates an Inactive account that was not anonymized: it can log in and act again.
 *
 * @param userId the account
 * @param itAdminId the session user who reactivates it (never from the body)
 * @returns the account, now Active
 * @throws AppError 404 if there is no such account
 * @throws AppError 409 if the account is anonymized or not Inactive
 */
export async function reactivateUser(userId: number, itAdminId: number): Promise<User> {
    return changedUser(await usersRepository.setAccountStatus(userId, 'ACTIVE', 'USER_REACTIVATED', itAdminId, (account) => {
        if (account.anonymized) throw new AppError(409, "This account is anonymized and can't be reactivated.");
        if (account.status !== 'INACTIVE') throw new AppError(409, "Only an Inactive account can be reactivated.");
        return null;
    }));
}

/**
 * Anonymizes an Inactive or Rejected account that is cleared (no unreturned equipment), for a person who has left.
 * The step cannot be undone. The person's email and ID number are free again for a new sign-up.
 *
 * @param userId the account
 * @param itAdminId the session user who anonymizes it (never from the body)
 * @returns the account, now "Former researcher" with no labs
 * @throws AppError 400 if the account is the IT Admin's own
 * @throws AppError 404 if there is no such account
 * @throws AppError 409 if the account is already anonymized, is not Inactive or Rejected, or is not cleared
 */
export async function anonymizeUser(userId: number, itAdminId: number): Promise<User> {
    refuseOwnAccount(userId, itAdminId);
    return changedUser(await usersRepository.anonymizeUser(userId, itAdminId, (account) => {
        if (account.anonymized) throw new AppError(409, "This account is already anonymized.");
        if (account.status !== 'INACTIVE' && account.status !== 'REJECTED') {
            throw new AppError(409, "Only an Inactive or Rejected account can be anonymized.");
        }
        if (account.openLoanStatuses.some(status => UNCLEARED_LOAN_STATUSES.includes(status))) {
            throw new AppError(409, "This account still has unreturned equipment, so it is not cleared.");
        }
        return null;
    }));
}
