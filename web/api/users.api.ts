/**
 * Users API: the IT Admin's Pending sign-ups, approving or rejecting one, the users list, and every change to an account
 * or a lab's Head after sign-up. The only place these URLs appear in the frontend.
 * Layer: api. Called by state/pendingSignUps.tsx, features/users/ (the dialogs), and pages/it-admin/UsersPage.tsx.
 * Calls client.ts; types from @shared/types/users.
 * Used by: the IT Admin's Approvals and Users pages.
 */
import type {
  ApproveSignUpInput, ChangeLabsInput, ChangeRoleInput, RejectSignUpInput, SetLabHeadInput, UserListFilters,
} from "@shared/types/users";
import { apiGetRaw, apiPutRaw, readResult, type ApiResult } from "./client";

/**
 * Lists the sign-ups waiting for the IT Admin, oldest first.
 *
 * @returns `success` and `users`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function listPendingUsers(): Promise<ApiResult> {
  return readResult(await apiGetRaw("/api/users?status=PENDING"), "Could not load the sign-ups. Try again.");
}

/**
 * Approves a Pending sign-up with one role and its labs. The IT Admin is read from the session, not sent.
 *
 * @param userId the account
 * @param input the role, and the labs (at least one for a Researcher)
 * @returns `success` and the approved `user`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function approveSignUp(userId: number, input: ApproveSignUpInput): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/users/${userId}/approve`, input), "Could not approve this sign-up. Try again.");
}

/**
 * Rejects a Pending sign-up, with optional remarks for the activity log.
 *
 * @param userId the account
 * @param input the remarks, or null for none
 * @returns `success` and the rejected `user`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function rejectSignUp(userId: number, input: RejectSignUpInput): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/users/${userId}/reject`, input), "Could not reject this sign-up. Try again.");
}

/**
 * Lists the accounts that pass the filters, by last name and then first name. With no status, every account but the
 * Pending ones. Only the filters that are set are sent.
 *
 * @param filters status, role, lab, and search, each optional
 * @returns `success` and `users`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function listUsers(filters: UserListFilters = {}): Promise<ApiResult> {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.role) query.set("role", filters.role);
  if (filters.centerId !== undefined) query.set("centerId", String(filters.centerId));
  if (filters.q) query.set("q", filters.q);
  const text = query.toString();
  const suffix = text ? `?${text}` : "";
  return readResult(await apiGetRaw(`/api/users${suffix}`), "Could not load the users. Try again.");
}

/**
 * Gives an Active or Inactive account one role in place of the one it has.
 *
 * @param userId the account
 * @param input the new role
 * @returns `success` and the changed `user`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function changeRole(userId: number, input: ChangeRoleInput): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/users/${userId}/role`, input), "Could not change the role. Try again.");
}

/**
 * Replaces the labs of an Active or Inactive account.
 *
 * @param userId the account
 * @param input the labs from now on (at least one for a Researcher)
 * @returns `success` and the changed `user`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function changeLabs(userId: number, input: ChangeLabsInput): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/users/${userId}/labs`, input), "Could not change the labs. Try again.");
}

/**
 * Makes an account the Head of a lab in place of the one it has, or leaves the lab with no Head.
 *
 * @param centerId the lab
 * @param input the new Head's account id, or null for no Head
 * @returns `success` and the `lab` with its Head; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function setLabHead(centerId: number, input: SetLabHeadInput): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/research-centers/${centerId}/head`, input), "Could not change the Head. Try again.");
}

/**
 * Deactivates an Active account.
 *
 * @param userId the account
 * @returns `success` and the changed `user`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function deactivateUser(userId: number): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/users/${userId}/deactivate`, {}), "Could not deactivate this account. Try again.");
}

/**
 * Reactivates an Inactive account.
 *
 * @param userId the account
 * @returns `success` and the changed `user`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function reactivateUser(userId: number): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/users/${userId}/reactivate`, {}), "Could not reactivate this account. Try again.");
}

/**
 * Anonymizes an Inactive or Rejected account that is cleared. This cannot be undone.
 *
 * @param userId the account
 * @returns `success` and the changed `user`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function anonymizeUser(userId: number): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/users/${userId}/anonymize`, {}), "Could not anonymize this account. Try again.");
}
